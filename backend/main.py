import json
import os
import re
import shutil
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database import DatabaseManager
from llm_engine import GeminiEngine
from query_engine import QueryEngine
from chart_advisor import ChartAdvisor
from insight_generator import InsightGenerator
from prompt_templates import FOLLOW_UP_PROMPT

# ── App setup ───────────────────────────────────────────────

app = FastAPI(title="NeuralBI API", version="1.0.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ──────────────────────────────────────────────

db = DatabaseManager.get_instance()
llm = GeminiEngine()
query_engine = QueryEngine(db, llm)
chart_advisor = ChartAdvisor(llm)
insight_gen = InsightGenerator(llm)

# ── Session store ───────────────────────────────────────────

sessions: Dict[str, Dict[str, Any]] = {}

# ── Pydantic models ─────────────────────────────────────────


class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class FollowUpRequest(BaseModel):
    question: str
    session_id: str


# ── Helpers ─────────────────────────────────────────────────

SUBJECTIVE_WORDS = {"best", "good", "popular", "top", "worst", "favorite", "great", "nice"}

# Generic data words that indicate a data-oriented question regardless of dataset
GENERIC_DATA_WORDS = {
    "show", "list", "get", "find", "display", "give", "tell",
    "total", "average", "count", "sum", "top", "bottom",
    "trend", "growth", "compare", "breakdown", "distribution",
    "monthly", "quarterly", "annual", "yearly", "weekly", "daily",
    "highest", "lowest", "most", "least", "all", "each", "every",
    "by", "per", "between", "from", "chart", "graph", "plot",
}


def get_schema_words() -> set:
    """Build a set of words from actual table names and column names in the database."""
    words = set()
    try:
        tables = db.get_all_tables()
        for table in tables:
            # Add table name and its parts (e.g. "sales_data" -> {"sales_data", "sales", "data"})
            words.add(table["name"].lower())
            for part in table["name"].lower().split("_"):
                if len(part) > 2:
                    words.add(part)
            # Add column names and their parts
            for col in table.get("columns", []):
                words.add(col["name"].lower())
                for part in col["name"].lower().split("_"):
                    if len(part) > 2:
                        words.add(part)
    except Exception:
        pass
    return words


def calculate_confidence(
    sql: str,
    data: list,
    row_count: int,
    question: str,
    retry_used: bool,
    schema_info: dict,
) -> int:
    """Calculate confidence score for the query result."""
    score = 100

    # Penalty: too few rows
    if row_count < 3:
        score -= 15

    # Penalty: Gemini required a retry
    if retry_used:
        score -= 20

    # Penalty: subjective/ambiguous words
    words = set(question.lower().split())
    if words & SUBJECTIVE_WORDS:
        score -= 5

    # Penalty: check column name mismatches
    all_columns = set()
    for table_info in schema_info.get("tables", {}).values():
        for col in table_info.get("columns", []):
            all_columns.add(col["name"].lower())

    # Extract column-like tokens from SQL (after SELECT and in WHERE)
    sql_tokens = re.findall(r'\b([a-z_][a-z0-9_]*)\b', sql.lower())
    sql_keywords = {
        "select", "from", "where", "and", "or", "not", "in", "like",
        "between", "group", "by", "order", "asc", "desc", "limit",
        "as", "on", "join", "inner", "left", "right", "outer",
        "count", "sum", "avg", "min", "max", "distinct", "having",
        "null", "is", "case", "when", "then", "else", "end",
        "strftime", "date", "cast", "coalesce", "ifnull",
    }
    table_names = {t.lower() for t in schema_info.get("tables", {}).keys()}
    for token in sql_tokens:
        if token not in sql_keywords and token not in all_columns and token not in table_names:
            pass  # Could be alias or value — light penalty
    # Simplified: if SQL has any column not in schema, penalize
    # (full check is complex, apply a small general penalty for long queries)
    if len(sql) > 300:
        score -= 5

    return max(0, min(100, score))


def is_vague_question(question: str) -> bool:
    """Check if the question is too vague to process."""
    words = question.strip().split()
    if len(words) < 3:
        question_words = {w.lower() for w in words}
        # Check against generic data words + actual schema words from database
        known_words = GENERIC_DATA_WORDS | get_schema_words()
        if not (question_words & known_words):
            return True
    return False


# ── Endpoints ───────────────────────────────────────────────


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    tables = db.get_all_tables()
    total_rows = sum(t.get("row_count", 0) for t in tables)
    return {
        "status": "ok",
        "model": llm.model_name,
        "database": "connected",
        "tables": len(tables),
        "total_rows": total_rows,
    }


@app.get("/api/schema")
async def get_schema():
    """Return all tables with columns and types."""
    tables = db.get_all_tables()
    return {"tables": tables}


@app.post("/api/query")
async def query(req: QueryRequest):
    """Process a natural language query through the full pipeline."""
    start_time = time.time()
    session_id = req.session_id or str(uuid.uuid4())
    question = req.question.strip()

    # Vague question check
    if is_vague_question(question):
        # Build dynamic suggestions from actual schema
        tables = db.get_all_tables()
        table_names = [t["name"] for t in tables]
        suggestions = [
            f"Available tables: {', '.join(table_names)}",
            "Try: 'Show all data from <table_name>'",
            "Or ask about specific columns, e.g. 'total revenue by region'",
        ]
        return {
            "success": False,
            "session_id": session_id,
            "error_type": "clarification_needed",
            "message": "Could you be more specific? Here's what I have:",
            "suggestions": suggestions,
        }

    # Run the query pipeline (schema → SQL → validate → execute)
    pipeline_result = query_engine.run_pipeline(question)

    # Check for pipeline errors
    if not pipeline_result.get("success"):
        elapsed = round((time.time() - start_time) * 1000)
        return {
            **pipeline_result,
            "session_id": session_id,
            "processing_time_ms": elapsed,
        }

    sql_query = pipeline_result["sql_query"]
    data = pipeline_result["data"]
    columns = pipeline_result["columns"]
    row_count = pipeline_result["row_count"]
    schema_info = pipeline_result["schema_info"]
    stages = pipeline_result["stages"]

    # Stage 5: Chart selection
    t4 = time.time()
    chart_config = chart_advisor.select_chart(
        question=question,
        sql_query=sql_query,
        columns=columns,
        data=data,
        row_count=row_count,
    )
    stages.append({
        "name": "Chart Selection",
        "status": "complete",
        "duration_ms": round((time.time() - t4) * 1000),
    })

    # Stage 6: Insight generation
    t5 = time.time()
    insights = insight_gen.generate(
        question=question,
        sql_query=sql_query,
        chart_config=chart_config,
        data=data,
        row_count=row_count,
    )
    stages.append({
        "name": "Insights",
        "status": "complete",
        "duration_ms": round((time.time() - t5) * 1000),
    })

    # Calculate confidence
    confidence = calculate_confidence(
        sql=sql_query,
        data=data,
        row_count=row_count,
        question=question,
        retry_used=pipeline_result.get("retry_used", False),
        schema_info=schema_info,
    )

    # Timeout check
    elapsed = round((time.time() - start_time) * 1000)
    if elapsed > 15000:
        return {
            "success": False,
            "session_id": session_id,
            "error_type": "timeout",
            "message": "The query took too long to process. Please try again.",
            "processing_time_ms": elapsed,
        }

    # Build response
    card_id = str(uuid.uuid4())
    response = {
        "success": True,
        "session_id": session_id,
        "card_id": card_id,
        "chart_config": chart_config,
        "data": data,
        "columns": columns,
        "sql_query": sql_query,
        "insights": insights,
        "confidence": confidence,
        "row_count": row_count,
        "processing_time_ms": elapsed,
        "pipeline_stages": stages,
    }

    # Store in session
    if session_id not in sessions:
        sessions[session_id] = {"queries": []}
    sessions[session_id]["queries"].append({
        "card_id": card_id,
        "question": question,
        "sql_query": sql_query,
        "chart_config": chart_config,
        "data_summary": {"columns": columns, "row_count": row_count},
    })

    return response


@app.post("/api/follow-up")
async def follow_up(req: FollowUpRequest):
    """Handle conversational follow-up queries."""
    start_time = time.time()
    session_id = req.session_id
    question = req.question.strip()

    # Check session exists
    if session_id not in sessions or not sessions[session_id]["queries"]:
        # No session context — treat as new query
        return await query(QueryRequest(question=question, session_id=session_id))

    # Get original context from last query in session
    last_query = sessions[session_id]["queries"][-1]
    original_question = last_query["question"]
    original_sql = last_query["sql_query"]
    current_chart = json.dumps(last_query["chart_config"])

    # Get schema for prompt
    schema_info = db.get_schema_context()
    schema_text = query_engine.format_schema_for_llm(schema_info)

    # Build follow-up prompt
    prompt = FOLLOW_UP_PROMPT.format(
        original_question=original_question,
        original_sql=original_sql,
        current_chart=current_chart,
        schema=schema_text,
        follow_up=question,
    )

    # Get LLM response
    follow_up_result = llm.process_follow_up(prompt)
    operation = follow_up_result.get("operation", "NEW_QUERY")

    if operation == "NEW_QUERY":
        return await query(QueryRequest(question=question, session_id=session_id))

    if operation in ("FILTER", "MODIFY"):
        updated_sql = follow_up_result.get("updated_sql")
        if not updated_sql:
            return await query(QueryRequest(question=question, session_id=session_id))

        # Validate and execute updated SQL
        is_valid, msg = query_engine.validate_sql(updated_sql)
        if not is_valid:
            return {
                "success": False,
                "session_id": session_id,
                "error_type": "validation_error",
                "message": "I generated a query but it didn't work. Try rephrasing your question more specifically.",
            }

        df = query_engine.execute_query(updated_sql)
        if df.empty:
            return {
                "success": False,
                "session_id": session_id,
                "error_type": "empty_results",
                "message": "Your query ran successfully but returned no matching records. Try a broader date range or different filters.",
            }

        data = df.to_dict(orient="records")
        columns = list(df.columns)
        row_count = len(data)

        # Re-select chart with new data
        chart_config = chart_advisor.select_chart(
            question=f"{original_question} — {question}",
            sql_query=updated_sql,
            columns=columns,
            data=data,
            row_count=row_count,
        )

        # Apply any explicit chart changes from follow-up
        chart_changes = follow_up_result.get("chart_changes", {})
        if chart_changes.get("chart_type"):
            chart_config["chart_type"] = chart_changes["chart_type"]

        # Generate new insights
        insights = insight_gen.generate(
            question=f"{original_question} — {question}",
            sql_query=updated_sql,
            chart_config=chart_config,
            data=data,
            row_count=row_count,
        )

        confidence = calculate_confidence(
            sql=updated_sql,
            data=data,
            row_count=row_count,
            question=question,
            retry_used=False,
            schema_info=schema_info,
        )

        elapsed = round((time.time() - start_time) * 1000)
        card_id = str(uuid.uuid4())

        # Store follow-up in session
        sessions[session_id]["queries"].append({
            "card_id": card_id,
            "question": question,
            "sql_query": updated_sql,
            "chart_config": chart_config,
            "data_summary": {"columns": columns, "row_count": row_count},
        })

        return {
            "success": True,
            "session_id": session_id,
            "card_id": card_id,
            "chart_config": chart_config,
            "data": data,
            "columns": columns,
            "sql_query": updated_sql,
            "insights": insights,
            "confidence": confidence,
            "row_count": row_count,
            "processing_time_ms": elapsed,
            "explanation": follow_up_result.get("explanation", ""),
            "pipeline_stages": [
                {"name": "Follow-up Analysis", "status": "complete", "duration_ms": elapsed},
            ],
        }

    if operation == "RECHART":
        # Reuse original data with new chart config
        last_data = last_query.get("data_summary", {})
        chart_changes = follow_up_result.get("chart_changes", {})

        # Re-execute original SQL to get the data
        df = query_engine.execute_query(original_sql)
        data = df.to_dict(orient="records")
        columns = list(df.columns)

        chart_config = dict(last_query["chart_config"])
        chart_config.update(chart_changes)

        insights = insight_gen.generate(
            question=f"{original_question} — {question}",
            sql_query=original_sql,
            chart_config=chart_config,
            data=data,
            row_count=len(data),
        )

        elapsed = round((time.time() - start_time) * 1000)
        card_id = str(uuid.uuid4())

        return {
            "success": True,
            "session_id": session_id,
            "card_id": card_id,
            "chart_config": chart_config,
            "data": data,
            "columns": columns,
            "sql_query": original_sql,
            "insights": insights,
            "confidence": 90,
            "row_count": len(data),
            "processing_time_ms": elapsed,
            "explanation": follow_up_result.get("explanation", ""),
            "pipeline_stages": [
                {"name": "Rechart", "status": "complete", "duration_ms": elapsed},
            ],
        }

    # Fallback
    return await query(QueryRequest(question=question, session_id=session_id))


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file and load it into the database."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    # Sanitize table name from filename
    table_name = re.sub(r'[^a-z0-9_]', '_', file.filename.rsplit('.', 1)[0].lower())
    table_name = re.sub(r'_+', '_', table_name).strip('_')

    # Save file
    upload_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "uploaded")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Ingest into database
    result = db.ingest_csv(file_path, table_name)

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to load CSV"))

    return result
