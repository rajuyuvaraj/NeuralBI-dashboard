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

DB_PATH = os.getenv("DATABASE_PATH", "../data/neuralbi.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup checks
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("\n\033[93mWARNING: GROQ_API_KEY not set in .env\033[0m\n")
    if not os.path.exists(DB_PATH):
        print(f"\n\033[93mWARNING: Database not found at {DB_PATH}\033[0m\n")
    yield
    # Shutdown
    pass

app = FastAPI(title="NeuralBI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
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
    
    system_prompt = """You are a senior data analyst preparing a morning
    briefing for a CEO. You have access to a database.
    Return ONLY a valid JSON array. No markdown."""

    user_prompt = f"""Given this database schema:
    {schema_str}

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
    if not file.filename.endswith(valid_extensions):
        return {"success": False, "message": "Only CSV and Excel files are supported"}
        
    try:
        content = await file.read()
        df = None
        
        if file.filename.endswith(".csv"):
            # Multi-encoding support
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(io.BytesIO(content), encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if df is None:
                return {"success": False, "message": "Failed to decode CSV file"}
        else:
            # Excel support
            try:
                df = pd.read_excel(io.BytesIO(content))
            except Exception as e:
                return {"success": False, "message": "Failed to decode Excel file"}
            
        # Clean dataframe
        df.dropna(how='all', inplace=True)
        for col in df.select_dtypes(['object']).columns:
            df[col] = df[col].astype(str).str.strip()
            
        df.columns = [
            re.sub(r'[^a-z0-9_]', '_', str(col).strip().lower().replace(' ', '_'))
            for col in df.columns
        ]
        
        # Determine table name
        table_name = file.filename.lower()
        for ext in valid_extensions:
            table_name = table_name.replace(ext, "")
        table_name = table_name.replace(' ', '_')
        table_name = "".join(c for c in table_name if c.isalnum() or c == '_')
        
        # Provide sample questions based on columns
        cols_list = list(df.columns)
        prompt = f"Given these column names: {cols_list},\n" \
                 "suggest 3 simple business questions a user might ask. Return JSON array of 3 question strings."
        
        # Using LLM asynchronously
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
            "table": table_name,
            "rows": len(df),
            "columns": len(df.columns),
            "suggested_questions": sample_questions,
            "message": f"Successfully loaded {len(df)} rows into '{table_name}'"
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error processing file: {str(e)}"}

class SheetsImportRequest(BaseModel):
    url: str

@app.post("/api/import-sheets")
async def import_sheets(request: SheetsImportRequest, db: sqlite3.Connection = Depends(get_db)):
    # Extract sheet ID from URL using regex
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', request.url)
    if not match:
        return {"success": False, "message": "Invalid Google Sheets URL"}
        
    sheet_id = match.group(1)
    
    # Build export URL
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    
    try:
        # Fetch with requests
        response = requests.get(csv_url, timeout=15)
        if response.status_code != 200:
            return {
                "success": False,
                "message": "Could not fetch sheet. Make sure it is set to 'Anyone with link can view'"
            }
            
        df = pd.read_csv(io.StringIO(response.text))
        
        # Clean dataframe
        df.dropna(how='all', inplace=True)
        for col in df.select_dtypes(['object']).columns:
            df[col] = df[col].astype(str).str.strip()
            
        df.columns = [
            re.sub(r'[^a-z0-9_]', '_', str(col).strip().lower().replace(' ', '_'))
            for col in df.columns
        ]
        
        table_name = f"sheet_{sheet_id[:8].lower()}"
        
        # Provide sample questions based on columns
        cols_list = list(df.columns)
        prompt = f"Given these column names: {cols_list},\n" \
                 "suggest 3 simple business questions a user might ask. Return JSON array of 3 question strings."
        
        # Using LLM asynchronously
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
            "table": table_name,
            "rows": len(df),
            "columns": len(df.columns),
            "suggested_questions": sample_questions,
            "message": f"Successfully imported {len(df)} rows from Google Sheets"
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error importing Google Sheets: {str(e)}"}

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
