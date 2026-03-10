import asyncio
import os
import io
import re
import requests
import sqlite3
import pandas as pd
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from llm_engine import LLMEngine
from query_engine import QueryEngine

load_dotenv()

DB_PATH = os.getenv("DATABASE_PATH", "./data/neuralbi.db")

# Ensure the database directory exists
db_dir = os.path.dirname(DB_PATH)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)
    print(f"Created database directory: {db_dir}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup checks
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("\n\033[93mWARNING: GROQ_API_KEY not set in .env\033[0m\n")
    if not os.path.exists(DB_PATH):
        print(f"\n\033[93mWARNING: Database not found at {DB_PATH}. A new one will be created on first write.\033[0m\n")
    yield
    # Shutdown
    pass

app = FastAPI(title="NeuralBI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get SQLite connection
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=15.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Global engine instance
query_engine = QueryEngine()

class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    demo_mode: bool = False
    active_tables: list[str] = []

@app.get("/api/health")
async def health_check(db: sqlite3.Connection = Depends(get_db)):
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return {"status": "error", "error_type": "MISSING_API_KEY", "message": "Groq API key is missing."}

        cursor = db.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        return {
            "status": "ok",
            "model": query_engine.llm.model,
            "provider": "Groq",
            "database": "connected",
            "tables": tables
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/schema")
async def get_schema(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    schema = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [{"name": c[1], "type": c[2]} for c in cursor.fetchall()]
        
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        
        cursor.execute(f"SELECT * FROM {table} LIMIT 3")
        sample_rows = cursor.fetchall()
        sample_dicts = [dict(row) for row in sample_rows]
        
        schema[table] = {
            "columns": columns,
            "row_count": count,
            "sample_data": sample_dicts
        }
        
    return {"tables": schema}

class DashboardRequest(BaseModel):
    tables: list[str]
    dashboard_type: str = "auto"

@app.post("/api/dashboard")
async def generate_dashboard(request: DashboardRequest, db: sqlite3.Connection = Depends(get_db)):
    from prompt_templates import DASHBOARD_PLAN_SYSTEM, DASHBOARD_PLAN_USER
    cursor = db.cursor()
    
    tables = request.tables
    if not tables:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
    schema_parts = []
    for table in tables:
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns_info = cursor.fetchall()
            col_details = []
            for c in columns_info:
                col_name = c[1]
                col_type = c[2].upper()
                
                stats = ""
                if any(t in col_type for t in ['INT','REAL','FLOAT','NUMERIC','NUMBER']):
                    cursor.execute(f'SELECT MIN("{col_name}"), MAX("{col_name}"), ROUND(AVG("{col_name}"),2), SUM("{col_name}") FROM "{table}"')
                    r = cursor.fetchone()
                    if r and r[0] is not None:
                        stats = f" [MIN:{r[0]} MAX:{r[1]} AVG:{r[2]} SUM:{r[3]}]"
                col_details.append(f"{col_name} ({col_type}){stats}")
                
            cursor.execute(f"SELECT * FROM {table} LIMIT 5")
            sample_rows = [dict(row) for row in cursor.fetchall()]
            
            schema_parts.append(f"Table: {table}\\nColumns:\\n" + "\\n".join(f"  - {cd}" for cd in col_details) + f"\\nSample Data: {sample_rows}\\n")
        except Exception:
            continue
            
    schema_str = "\\n".join(schema_parts)
    
    llm = LLMEngine()
    user_prompt = DASHBOARD_PLAN_USER.format(schema=schema_str)
    
    raw_plan = await llm.call(DASHBOARD_PLAN_SYSTEM, user_prompt, temperature=0.2, max_tokens=3000)
    plan = llm.safe_json_parse(raw_plan)
    
    if "error" in plan or not isinstance(plan, dict):
        return {"success": False, "message": "Failed to generate dashboard plan."}
        
    # Parallel execution
    async def run_query(sql, conn):
        try:
            df = pd.read_sql_query(sql, conn)
            df = df.where(pd.notnull(df), None)
            return df.to_dict('records')
        except Exception as e:
            return {"error": str(e)}

    tasks = []
    
    for kpi in plan.get("kpis", []):
        tasks.append(run_query(kpi.get("sql", ""), db))
        if kpi.get("trend_sql"):
            tasks.append(run_query(kpi.get("trend_sql", ""), db))
            
    for chart in plan.get("charts", []):
        tasks.append(run_query(chart.get("sql", ""), db))
        
    tasks.append(run_query(plan.get("data_table", {}).get("sql", ""), db))
    
    results = await asyncio.gather(*tasks)
    
    res_idx = 0
    kpis_out = []
    
    def format_value(value, format_type):
        if value is None: return "0"
        try:
            value = float(value)
        except:
            return str(value)
        if format_type == "currency":
            if value >= 1_000_000: return f"${value/1_000_000:.2f}M"
            elif value >= 1_000: return f"${value/1_000:.1f}K"
            return f"${value:,.0f}"
        elif format_type == "number":
            if value >= 1_000_000: return f"{value/1_000_000:.1f}M"
            elif value >= 1_000: return f"{value/1_000:.0f}K"
            return f"{value:,.0f}"
        elif format_type == "percent":
            return f"{value:.1f}%"
        return str(value)

    for kpi in plan.get("kpis", []):
        val_res = results[res_idx]
        res_idx += 1
        
        main_val = 0
        if isinstance(val_res, list) and len(val_res) > 0:
            first_row = val_res[0]
            if first_row and len(first_row.values()) > 0:
                main_val = list(first_row.values())[0]
                
        trend_direction = "flat"
        trend_percent = 0
        
        if kpi.get("trend_sql"):
            trend_res = results[res_idx]
            res_idx += 1
            if isinstance(trend_res, list) and len(trend_res) >= 2:
                try:
                    current = list(trend_res[0].values())[1]
                    previous = list(trend_res[1].values())[1]
                    if previous and previous != 0:
                        change = ((current - previous) / previous) * 100
                        trend_percent = round(abs(change), 1)
                        if change > 0: trend_direction = "up"
                        elif change < 0: trend_direction = "down"
                except Exception:
                    pass
        
        kpis_out.append({
            "id": kpi.get("id", f"kpi_{res_idx}"),
            "title": kpi.get("title", "KPI"),
            "value": main_val,
            "formatted_value": format_value(main_val, kpi.get("format", "number")),
            "format": kpi.get("format", "number"),
            "icon": kpi.get("icon", "📊"),
            "color": kpi.get("color", "indigo"),
            "trend_direction": trend_direction,
            "trend_percent": trend_percent,
            "trend_label": kpi.get("trend_label", "vs previous")
        })
        
    charts_out = []
    for chart in plan.get("charts", []):
        chart_res = results[res_idx]
        res_idx += 1
        data = chart_res if isinstance(chart_res, list) else []
        charts_out.append({
            "id": chart.get("id", f"chart_{res_idx}"),
            "title": chart.get("title", "Chart"),
            "data": data,
            "chart_type": chart.get("chart_type", "bar"),
            "x_axis": chart.get("x_axis"),
            "y_axis": chart.get("y_axis"),
            "color_field": chart.get("color_field"),
            "size": chart.get("size", "medium"),
            "insight": chart.get("insight", "")
        })
        
    table_res = results[res_idx]
    
    return {
        "success": True,
        "dashboard_title": plan.get("dashboard_title", "Auto Dashboard"),
        "subtitle": plan.get("subtitle", "Generated automatically"),
        "generated_at": datetime.now().isoformat(),
        "kpis": kpis_out,
        "charts": charts_out,
        "data_table": {
            "title": plan.get("data_table", {}).get("title", "Data"),
            "columns": plan.get("data_table", {}).get("columns_to_show", []),
            "rows": table_res if isinstance(table_res, list) else []
        }
    }

class AutoAnalyzeResponse(BaseModel):
    success: bool
    analyses: list = []
    generated_at: str = ""

class AutoAnalyzeRequest(BaseModel):
    active_tables: list[str] = []

@app.post("/api/auto-analyze")
async def auto_analyze(request: AutoAnalyzeRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    if request.active_tables:
        tables = request.active_tables
    else:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
    
    schema_parts = []
    for table in tables:
        try:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [c[1] for c in cursor.fetchall()]
            cursor.execute(f"SELECT * FROM {table} LIMIT 3")
            sample_rows = [dict(row) for row in cursor.fetchall()]
            schema_parts.append(f"Table: {table}\nColumns: {columns}\nSample Data: {sample_rows}\n")
        except Exception:
            continue
        
    schema_str = "\n".join(schema_parts)

    # Find JOIN keys if multiple tables
    join_info = ""
    if len(tables) > 1:
        join_hints = query_engine._find_join_keys(tables, cursor)
        if join_hints:
            join_info = "\n\nKnown JOIN relationships:\n" + "\n".join(f"  - {h}" for h in join_hints)
            join_info += "\nGenerate some questions that require JOINing across these tables."
    
    system_prompt = """You are a senior data analyst preparing a morning
    briefing for a CEO. You have access to a database.
    Return ONLY a valid JSON array. No markdown."""

    user_prompt = f"""Given this database schema:
    {schema_str}{join_info}

    Available tables: {', '.join(tables)}

    Generate exactly 5 business intelligence questions
    that a CEO would MOST want to know automatically.
    Focus on: top performers, trends, anomalies,
    comparisons, and actionable insights.

    Rules:
    - Each question must be answerable with a SQL query
    - Questions should reveal genuinely useful insights
    - Mix different types: ranking, trend, comparison, anomaly, breakdown
    - Write as if a data analyst is briefing a CEO

    Return ONLY this JSON:
    [
      {{
        "question": "Which region generated the most revenue this year?",
        "category": "ranking",
        "icon": "🏆",
        "priority": 1
      }}
    ]
    """
    
    llm = LLMEngine()
    raw = await llm.call(system_prompt, user_prompt)
    questions = llm.safe_json_array(raw)
    
    results = []
    for q in questions[:5]:
        try:
            res = await query_engine.process_query(
                question=q.get("question", ""),
                conn=db,
                session_id=None,
                demo_mode=False,
                active_tables=request.active_tables
            )
            if res.get("success"):
                analyses_item = res.copy()
                analyses_item["category"] = q.get("category", "breakdown")
                analyses_item["icon"] = q.get("icon", "📊")
                analyses_item["priority"] = q.get("priority", 3)
                results.append(analyses_item)
            await asyncio.sleep(0.3)
        except Exception as e:
            print(f"Failed analysis for {q}: {e}")
            continue
            
    return {
        "success": True,
        "analyses": results,
        "generated_at": datetime.now().isoformat()
    }

class NarrativeRequest(BaseModel):
    charts: list[dict]
    report_type: str = "executive"
    active_tables: list[str] = []
    focus_area: str = "General Overview"

@app.post("/api/narrative")
async def generate_narrative(request: NarrativeRequest):
    charts_summary_parts = []
    for c in request.charts:
        charts_summary_parts.append(
            f"Chart: {c.get('title')}\n"
            f"Type: {c.get('chart_type')}\n"
            f"Data Summary: {c.get('data_summary', '')}\n"
            f"Question: {c.get('question', '')}\n"
            f"Key insights:\n" + \
            "\n".join([f"- {ins}" for ins in c.get('insights', [])])
        )
    charts_summary = "\n\n".join(charts_summary_parts)

    system_prompt = """You are a senior business analyst
writing an executive briefing report.
Your writing is:
- Clear, professional, and concise
- Data-driven with specific numbers
- Action-oriented with recommendations
- Written for a non-technical C-suite audience
- Structured with proper paragraphs
Return ONLY the narrative text. No JSON. No markdown headers. Just well-written paragraphs."""

    user_prompt = f"""Write a professional executive summary based on
these dashboard analyses:

{charts_summary}

Report type: {request.report_type}
This report is based on analysis of: {', '.join(request.active_tables) if request.active_tables else 'all'} datasets.
Focus area: {request.focus_area}

Structure your report as exactly 3 paragraphs:

PARAGRAPH 1 — PERFORMANCE OVERVIEW:
  Summarize overall business performance.
  Include the most important numbers.
  Set the context.

PARAGRAPH 2 — KEY FINDINGS:
  Highlight 2-3 most important discoveries.
  Mention top performers and underperformers.
  Include specific percentages and values.

PARAGRAPH 3 — RECOMMENDATIONS:
  Give 2-3 specific, actionable recommendations
  based on the data. Be direct and decisive.
  What should the executive do THIS WEEK?

Write in a confident, professional tone.
Total length: 150-200 words."""

    try:
        llm = LLMEngine()
        narrative = await llm.call(system_prompt, user_prompt)
        words = len(narrative.split())
        return {
            "success": True,
            "narrative": narrative,
            "generated_at": datetime.now().isoformat(),
            "chart_count": len(request.charts),
            "word_count": words
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/query")
async def process_query(request: QueryRequest, db: sqlite3.Connection = Depends(get_db)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
        
    result = await query_engine.process_query(
        question=request.question,
        conn=db,
        session_id=request.session_id,
        demo_mode=request.demo_mode,
        active_tables=request.active_tables
    )
    return result

@app.post("/api/follow-up")
async def process_follow_up(request: QueryRequest, db: sqlite3.Connection = Depends(get_db)):
    if not request.session_id:
        raise HTTPException(status_code=400, detail="session_id is required for follow-up")
        
    result = await query_engine.process_follow_up(
        question=request.question,
        session_id=request.session_id,
        conn=db,
        active_tables=request.active_tables
    )
    return result

class SuggestRequest(BaseModel):
    question: str

@app.post("/api/suggest-dataset")
async def suggest_dataset(request: SuggestRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    question_keywords = set(re.findall(r'[a-zA-Z0-9_]+', request.question.lower()))
    
    suggestions = []
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [c[1].lower() for c in cursor.fetchall()]
        
        # calculate matches between question words and any column name substrings
        matching_cols = set()
        for kw in question_keywords:
            if len(kw) <= 2: continue # skip small words
            for col in columns:
                # partial match allowed
                if kw in col or col in kw:
                    matching_cols.add(col)
                    
        score = len(matching_cols)
        suggestions.append({
            "table": table,
            "score": score,
            "matching_columns": list(matching_cols),
            "confidence": "high" if score > 1 else "medium" if score == 1 else "low"
        })
        
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    recommended = suggestions[0]["table"] if suggestions and suggestions[0]["score"] > 0 else None
    
    return {
        "suggestions": suggestions,
        "recommended": recommended
    }

@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: sqlite3.Connection = Depends(get_db)):
    valid_extensions = (".csv", ".xlsx", ".xls")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(400, f"Only CSV and Excel files supported. Got: {ext}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")

    try:
        df = None

        if ext == ".csv":
            decoded = None
            for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    decoded = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if decoded is None:
                raise HTTPException(400, "Could not read this file. Try saving as UTF-8 CSV.")
            try:
                df = pd.read_csv(io.StringIO(decoded))
            except Exception as e:
                raise HTTPException(400, f"Could not parse CSV: {str(e)}")
        else:
            try:
                import openpyxl
                df = pd.read_excel(io.BytesIO(content))
            except Exception as e:
                raise HTTPException(400, f"Could not read Excel file: {str(e)}")

        if df is None or df.empty or len(df.columns) == 0:
            raise HTTPException(400, "No data found in this file.")
        if len(df) == 0:
            raise HTTPException(400, "File has column headers but no data rows.")

        # Clean dataframe
        df.dropna(how='all', inplace=True)
        df.dropna(axis=1, how='all', inplace=True)
        for col in df.select_dtypes(['object']).columns:
            df[col] = df[col].astype(str).str.strip()

        df.columns = [
            re.sub(r'[^a-z0-9_]', '_', str(col).strip().lower().replace(' ', '_'))
            for col in df.columns
        ]

        # Determine table name
        table_name = file.filename.lower()
        for e in valid_extensions:
            table_name = table_name.replace(e, "")
        table_name = table_name.replace(' ', '_')
        table_name = "".join(c for c in table_name if c.isalnum() or c == '_')

        # Detect column types
        col_types = []
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                col_types.append({"name": col, "type": "NUMERIC"})
            elif pd.api.types.is_datetime64_any_dtype(df[col]):
                col_types.append({"name": col, "type": "DATE"})
            else:
                col_types.append({"name": col, "type": "TEXT"})

        # Provide sample questions based on columns
        cols_list = list(df.columns)
        prompt = f"Given these column names: {cols_list},\n" \
                 "suggest 3 simple business questions a user might ask. Return JSON array of 3 question strings."

        llm = LLMEngine()
        raw = await llm.call(
            "Return ONLY a valid JSON array of 3 strings. No markdown.",
            prompt
        )
        sample_questions = llm.safe_json_array(raw)

        # Save to SQLite
        df.to_sql(table_name, db, if_exists="replace", index=False)

        return {
            "success": True,
            "table_name": table_name,
            "table": table_name,
            "row_count": len(df),
            "col_count": len(df.columns),
            "rows": len(df),
            "columns": col_types,
            "suggested_questions": sample_questions,
            "source": "csv" if ext == ".csv" else "excel",
            "message": f"Successfully loaded {len(df)} rows into '{table_name}'"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error processing file: {str(e)}")

class SheetsImportRequest(BaseModel):
    url: str

@app.post("/api/import-sheets")
async def import_sheets(request: SheetsImportRequest, db: sqlite3.Connection = Depends(get_db)):
    pattern = r'docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)'
    match = re.search(pattern, request.url)
    if not match:
        raise HTTPException(400, "Not a valid Google Sheets URL. URL must contain docs.google.com/spreadsheets")

    sheet_id = match.group(1)

    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    gid_match = re.search(r'gid=(\d+)', request.url)
    if gid_match:
        csv_url += f"&gid={gid_match.group(1)}"

    try:
        response = requests.get(csv_url, timeout=15, allow_redirects=True)
    except Exception:
        raise HTTPException(503, "Could not reach Google Sheets. Check your internet connection.")

    if response.status_code == 403:
        raise HTTPException(403, "Sheet is not publicly accessible. Go to Share → Anyone with link → Viewer.")
    if response.status_code != 200:
        raise HTTPException(400, f"Google returned error {response.status_code}. Make sure the sheet is publicly shared.")

    content_type = response.headers.get('content-type', '')
    if 'text/html' in content_type:
        raise HTTPException(403, "Google redirected to login page. Sheet must be set to 'Anyone with link can view'.")

    try:
        df = pd.read_csv(io.StringIO(response.text), encoding='utf-8')
    except Exception as e:
        raise HTTPException(400, f"Could not parse sheet data: {str(e)}")

    if df.empty:
        raise HTTPException(400, "The sheet appears to be empty.")

    # Clean dataframe
    df.dropna(how='all', inplace=True)
    df.dropna(axis=1, how='all', inplace=True)
    for col in df.select_dtypes(['object']).columns:
        df[col] = df[col].astype(str).str.strip()

    df.columns = [
        re.sub(r'[^a-z0-9_]', '_', str(col).strip().lower().replace(' ', '_'))
        for col in df.columns
    ]

    table_name = f"sheet_{sheet_id[:8].lower()}"
    table_name = re.sub(r'[^a-z0-9_]', '_', table_name)

    # Detect column types
    col_types = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            col_types.append({"name": col, "type": "NUMERIC"})
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            col_types.append({"name": col, "type": "DATE"})
        else:
            col_types.append({"name": col, "type": "TEXT"})

    # Provide sample questions based on columns
    cols_list = list(df.columns)
    prompt = f"Given these column names: {cols_list},\n" \
             "suggest 3 simple business questions a user might ask. Return JSON array of 3 question strings."

    llm = LLMEngine()
    raw = await llm.call(
        "Return ONLY a valid JSON array of 3 strings. No markdown.",
        prompt
    )
    sample_questions = llm.safe_json_array(raw)

    # Save to SQLite
    df.to_sql(table_name, db, if_exists="replace", index=False)

    return {
        "success": True,
        "table_name": table_name,
        "table": table_name,
        "row_count": len(df),
        "col_count": len(df.columns),
        "rows": len(df),
        "columns": col_types,
        "suggested_questions": sample_questions,
        "source": "google_sheets",
        "original_url": request.url,
        "message": f"{len(df)} rows imported from Google Sheets"
    }

@app.get("/api/tables")
async def list_tables(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    result = []
    seeded = ['sales', 'customers', 'monthly_targets']
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        cursor.execute(f"PRAGMA table_info({table})")
        cols = cursor.fetchall()
        col_names = [c[1] for c in cols]
        result.append({
            "name": table,
            "row_count": count,
            "col_count": len(col_names),
            "preview_cols": col_names[:3],
            "is_uploaded": table not in seeded
        })
        
    return {"tables": result}

@app.delete("/api/table/{table_name}")
async def delete_table(table_name: str, db: sqlite3.Connection = Depends(get_db)):
    protected = ['sales', 'customers', 'monthly_targets']
    if table_name in protected:
        raise HTTPException(400, "Cannot delete built-in tables")
    cursor = db.cursor()
    cursor.execute(f"DROP TABLE IF EXISTS '{table_name}'")
    db.commit()
    return {"success": True, "message": f"Table '{table_name}' deleted"}

@app.get("/api/stats")
async def get_stats(table: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()

    # Get column info
    cursor.execute(f"PRAGMA table_info('{table}')")
    columns = cursor.fetchall()

    stats = []
    for col in columns:
        col_name = col[1]
        col_type = col[2].upper()
        stat = {"name": col_name, "type": col_type}

        # Get sample values (use double quotes to avoid literal string SELECT)
        cursor.execute(f'SELECT DISTINCT "{col_name}" FROM "{table}" LIMIT 3')
        stat["sample"] = [str(r[0]) for r in cursor.fetchall() if r[0] is not None]

        if any(t in col_type for t in ['INT','REAL','FLOAT','NUMERIC','NUMBER']):
            cursor.execute(f'SELECT MIN("{col_name}"), MAX("{col_name}"), ROUND(AVG("{col_name}"),2), COUNT("{col_name}") FROM "{table}"')
            row = cursor.fetchone()
            stat["min"] = row[0]
            stat["max"] = row[1]
            stat["avg"] = row[2]
            stat["count"] = row[3]
            stat["display_type"] = "NUMERIC"

        elif any(t in col_type for t in ['DATE','TIME']):
            cursor.execute(f'SELECT MIN("{col_name}"), MAX("{col_name}") FROM "{table}"')
            row = cursor.fetchone()
            stat["min_date"] = row[0]
            stat["max_date"] = row[1]
            stat["display_type"] = "DATE"

        else:
            cursor.execute(f'SELECT COUNT(DISTINCT "{col_name}") FROM "{table}"')
            stat["unique_count"] = cursor.fetchone()[0]
            stat["display_type"] = "TEXT"

        stats.append(stat)

    # Row count
    cursor.execute(f"SELECT COUNT(*) FROM '{table}'")
    row_count = cursor.fetchone()[0]

    # Preview (first 5 rows)
    cursor.execute(f"SELECT * FROM '{table}' LIMIT 5")
    rows = cursor.fetchall()
    col_names = [c[1] for c in columns]
    preview = [dict(zip(col_names, r)) for r in rows]

    return {
        "table": table,
        "row_count": row_count,
        "column_count": len(columns),
        "stats": stats,
        "preview": preview
    }
