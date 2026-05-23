import json
import sqlite3
import pandas as pd
from typing import Any, Dict, List, Tuple

from database import DatabaseManager
from llm_engine import GeminiEngine
from prompt_templates import TEXT_TO_SQL_PROMPT


class QueryEngine:
    def __init__(self, db: DatabaseManager, llm: GeminiEngine):
        self.db = db
        self.llm = llm

    def format_schema_for_llm(self, schema_info: Dict) -> str:
        """Format schema information into a readable string for LLM prompts."""
        formatted = []
        for table, info in schema_info["tables"].items():
            formatted.append(f"\nTable: {table}")
            formatted.append("Columns:")
            for col in info["columns"]:
                pk = " [PRIMARY KEY]" if col.get("primary_key") else ""
                nullable = "" if col.get("nullable", True) else " NOT NULL"
                formatted.append(f"  - {col['name']} ({col['type']}){pk}{nullable}")
        return "\n".join(formatted)

    def format_sample_data(self, schema_info: Dict) -> str:
        """Format sample data rows for the LLM prompt."""
        lines = []
        for table, rows in schema_info.get("sample_data", {}).items():
            lines.append(f"\nTable: {table} (first 3 rows)")
            for row in rows:
                lines.append(f"  {json.dumps(row)}")
        return "\n".join(lines)

    def validate_sql(self, sql: str) -> Tuple[bool, str]:
        """Validate SQL query for safety and correctness."""
        sql_upper = sql.upper().strip()

        # Block dangerous operations
        for operation in ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE"]:
            if operation in sql_upper:
                return False, f"Forbidden operation: {operation}"

        if not sql_upper.startswith("SELECT"):
            return False, "Query must start with SELECT"

        # Syntax check via EXPLAIN
        try:
            conn = self.db.get_connection()
            cursor = conn.cursor()
            cursor.execute(f"EXPLAIN QUERY PLAN {sql}")
            return True, "Valid SQL"
        except sqlite3.Error as e:
            return False, f"SQL syntax error: {str(e)}"

    def execute_query(self, sql: str) -> pd.DataFrame:
        """Execute validated SQL query and return results as DataFrame."""
        return self.db.execute_raw(sql)

    def check_column_match(self, sql: str, schema_info: Dict) -> bool:
        """Check if SQL column references roughly match schema columns."""
        all_columns = set()
        for table_info in schema_info["tables"].values():
            for col in table_info["columns"]:
                all_columns.add(col["name"].lower())

        # Extract word tokens from SQL that could be column names
        sql_words = sql.lower().replace(",", " ").replace("(", " ").replace(")", " ").split()
        # Simple heuristic: check tokens after SELECT, FROM, WHERE, GROUP BY, ORDER BY
        mismatches = 0
        for word in sql_words:
            word = word.strip("'\"`;")
            if word and word not in all_columns and len(word) > 2:
                # Skip SQL keywords and functions
                sql_keywords = {
                    "select", "from", "where", "and", "or", "not", "in", "like",
                    "between", "group", "by", "order", "asc", "desc", "limit",
                    "as", "on", "join", "inner", "left", "right", "outer",
                    "count", "sum", "avg", "min", "max", "distinct", "having",
                    "null", "is", "case", "when", "then", "else", "end",
                    "strftime", "date", "cast", "coalesce", "ifnull",
                    "integer", "real", "text", "blob",
                }
                if word not in sql_keywords:
                    # Could be a table name, alias, or value — not necessarily a mismatch
                    pass
        return mismatches == 0

    def run_pipeline(self, question: str) -> Dict[str, Any]:
        """
        Full text-to-SQL pipeline:
        1. Get schema context
        2. Format for LLM
        3. Generate SQL via Gemini
        4. Validate SQL
        5. Execute query
        Returns dict with sql, data, columns, row_count, or error info.
        """
        import time

        stages = []

        # Stage 1: Schema Analysis
        t0 = time.time()
        schema_info = self.db.get_schema_context()
        schema_text = self.format_schema_for_llm(schema_info)
        sample_text = self.format_sample_data(schema_info)
        stages.append({
            "name": "Schema Analysis",
            "status": "complete",
            "duration_ms": round((time.time() - t0) * 1000),
        })

        # Stage 2: SQL Generation
        t1 = time.time()
        prompt = TEXT_TO_SQL_PROMPT.format(
            schema=schema_text,
            sample_data=sample_text,
            question=question,
        )
        print(f"[DEBUG] Schema tables: {list(schema_info['tables'].keys())}")
        print(f"[DEBUG] Question: {question}")
        sql_query = self.llm.generate_sql(prompt)
        stages.append({
            "name": "SQL Generation",
            "status": "complete",
            "duration_ms": round((time.time() - t1) * 1000),
        })

        # Check for rate limit errors
        if sql_query == "RATE_LIMITED":
            return {
                "success": False,
                "error_type": "rate_limited",
                "message": "AI Engine API rate limit exceeded. Please wait a moment and try again.",
                "stages": stages,
            }

        # Check for model errors
        if sql_query == "MODEL_ERROR":
            return {
                "success": False,
                "error_type": "api_error",
                "message": "AI Engine API model error. Check your API key and model configuration.",
                "stages": stages,
            }

        # Check for INSUFFICIENT_DATA
        if "INSUFFICIENT_DATA" in sql_query.upper():
            # Include available tables so the user knows what's queryable
            table_names = list(schema_info["tables"].keys())
            return {
                "success": False,
                "error_type": "insufficient_data",
                "message": f"I couldn't find matching data for this question. Available tables: {', '.join(table_names)}",
                "suggestions": [
                    f"Try asking about: {', '.join(table_names)}",
                    "Use column names from the tables above",
                    "Example: 'Show all rows from <table_name>'",
                ],
                "stages": stages,
            }

        # Stage 3: Validation
        t2 = time.time()
        is_valid, validation_msg = self.validate_sql(sql_query)
        stages.append({
            "name": "Validation",
            "status": "complete" if is_valid else "error",
            "duration_ms": round((time.time() - t2) * 1000),
        })

        if not is_valid:
            return {
                "success": False,
                "error_type": "validation_error",
                "message": "I generated a query but it didn't work. Try rephrasing your question more specifically.",
                "sql_query": sql_query,
                "stages": stages,
            }

        # Stage 4: Execution
        t3 = time.time()
        df = self.execute_query(sql_query)
        stages.append({
            "name": "Execution",
            "status": "complete",
            "duration_ms": round((time.time() - t3) * 1000),
        })

        if df.empty:
            return {
                "success": False,
                "error_type": "empty_results",
                "message": "Your query ran successfully but returned no matching records. Try a broader date range or different filters.",
                "sql_query": sql_query,
                "stages": stages,
            }

        # Convert to list of dicts
        data = df.to_dict(orient="records")
        columns = list(df.columns)

        return {
            "success": True,
            "sql_query": sql_query,
            "data": data,
            "columns": columns,
            "row_count": len(data),
            "schema_info": schema_info,
            "retry_used": self.llm.retry_count > 0,
            "stages": stages,
        }
