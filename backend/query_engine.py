import sqlite3
import re
import uuid
import pandas as pd
from datetime import datetime, timedelta
import asyncio

from llm_engine import LLMEngine, LLMTimeoutError, LLMRateLimitError
from chart_advisor import auto_select_chart
from prompt_templates import (
    TEXT_TO_SQL_SYSTEM,
    TEXT_TO_SQL_USER,
    REPAIR_PROMPT_SYSTEM,
    REPAIR_PROMPT_USER,
    CHART_SELECTION_SYSTEM,
    CHART_SELECTION_USER,
    INSIGHT_SYSTEM,
    INSIGHT_USER,
    SELF_CORRECTION_SYSTEM,
    SELF_CORRECTION_USER,
    FOLLOW_UP_SYSTEM,
    FOLLOW_UP_USER,
)

sessions = {}
SESSION_TTL_MINUTES = 30

BUSINESS_KEYWORDS = [
    "revenue", "sales", "region", "product", "customer", "month",
    "year", "quarter", "trend", "top", "total", "average", "count",
    "category", "rep", "tier", "target", "units", "discount",
]

# LAYER 4 — SAFE FALLBACK QUERIES
FALLBACK_QUERIES = [
    (
        ["revenue by region", "sales by region"],
        "SELECT region, SUM(revenue) AS total_revenue FROM sales GROUP BY region ORDER BY total_revenue DESC"
    ),
    (
        ["monthly trend", "sales trend", "revenue trend"],
        "SELECT strftime('%Y-%m', date) AS month, SUM(revenue) AS revenue FROM sales GROUP BY month ORDER BY month"
    ),
    (
        ["top products", "top categories"],
        "SELECT product_category, SUM(revenue) AS revenue FROM sales GROUP BY product_category ORDER BY revenue DESC LIMIT 10"
    ),
    (
        ["quarterly"],
        "SELECT CASE WHEN strftime('%m',date) IN ('01','02','03') THEN 'Q1' WHEN strftime('%m',date) IN ('04','05','06') THEN 'Q2' WHEN strftime('%m',date) IN ('07','08','09') THEN 'Q3' ELSE 'Q4' END AS quarter, SUM(revenue) AS revenue FROM sales GROUP BY quarter"
    ),
    (
        ["customer tier", "revenue by tier", "customer"],
        "SELECT c.tier, COUNT(DISTINCT c.customer_id) AS customers, SUM(s.revenue) AS revenue FROM customers c JOIN sales s ON c.customer_id = s.customer_id GROUP BY c.tier ORDER BY revenue DESC"
    )
]

DEMO_QUERIES = {
    # DEMO QUERY 1
    "total sales revenue by region": (
        ["total sales revenue by region"],
        "SELECT region, SUM(revenue) AS total_revenue "
        "FROM sales GROUP BY region ORDER BY total_revenue DESC"
    ),
    # DEMO QUERY 2
    "monthly sales revenue for q3": (
        ["monthly sales revenue for q3", "highlight the top performer"],
        "SELECT strftime('%Y-%m', date) AS month, "
        "product_category, SUM(revenue) AS revenue "
        "FROM sales "
        "WHERE strftime('%m', date) IN ('07','08','09') "
        "GROUP BY month, product_category ORDER BY month"
    ),
    # DEMO QUERY 3 (Follow up)
    "east and west regions": (
        ["east and west regions"],
        "SELECT region, SUM(revenue) AS total_revenue "
        "FROM sales WHERE region IN ('East','West') "
        "GROUP BY region ORDER BY total_revenue DESC"
    )
}


class QueryEngine:
    def __init__(self):
        self.llm = LLMEngine()

    def _clean_expired_sessions(self):
        now = datetime.now()
        expired = [
            sid for sid, data in sessions.items()
            if now - datetime.fromisoformat(data["timestamp"]) > timedelta(minutes=SESSION_TTL_MINUTES)
        ]
        for sid in expired:
            del sessions[sid]

    def _find_join_keys(self, tables: list[str], cursor) -> list[str]:
        """Auto-detect possible JOIN keys between active tables by finding common column names."""
        table_cols = {}
        for t in tables:
            cursor.execute(f"PRAGMA table_info('{t}')")
            table_cols[t] = [r[1] for r in cursor.fetchall()]

        # Known relationships (hardcoded for built-in tables)
        known = [
            "sales.customer_id = customers.customer_id",
            "sales.region = monthly_targets.region AND strftime('%Y', sales.date) = CAST(monthly_targets.year AS TEXT) AND strftime('%m', sales.date) = printf('%02d', monthly_targets.month)",
        ]

        join_hints = []
        # Add known relationships if both tables are in active set
        active_set = set(tables)
        if 'sales' in active_set and 'customers' in active_set:
            join_hints.append(known[0])
        if 'sales' in active_set and 'monthly_targets' in active_set:
            join_hints.append(known[1])

        # Auto-detect common columns for uploaded/unknown tables
        table_list = list(table_cols.keys())
        for i in range(len(table_list)):
            for j in range(i + 1, len(table_list)):
                t1, t2 = table_list[i], table_list[j]
                # Skip known built-in pairs (already handled)
                pair = {t1, t2}
                if pair == {'sales', 'customers'} or pair == {'sales', 'monthly_targets'}:
                    continue
                common = set(table_cols[t1]) & set(table_cols[t2])
                # Exclude generic columns that are unlikely join keys
                common -= {'id', 'name', 'date', 'created_at', 'updated_at'}
                for col in common:
                    join_hints.append(f"{t1}.{col} = {t2}.{col}")

        return join_hints

    def _build_schema_context(self, conn: sqlite3.Connection, active_tables: list[str] = None) -> tuple:
        cursor = conn.cursor()
        if active_tables:
            tables = active_tables
        else:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall()]

        schema_parts = []
        all_columns = {}
        all_column_names = []
        
        for table in tables:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = cursor.fetchall()
            col_info = [f"{c[1]}({c[2]})" for c in columns]
            all_columns[table] = [c[1] for c in columns]
            all_column_names.extend([c[1] for c in columns])

            cursor.execute(f"SELECT * FROM {table} LIMIT 3")
            sample_rows = cursor.fetchall()
            col_names = [desc[0] for desc in cursor.description]
            sample_dicts = [dict(zip(col_names, row)) for row in sample_rows]

            schema_parts.append(
                f"<table name=\"{table}\">\n"
                f"  <columns>{', '.join(col_info)}</columns>\n"
                f"  <sample_rows>{sample_dicts}</sample_rows>\n"
                f"</table>"
            )

        schema_str = "\n".join(schema_parts)
        return schema_str, all_columns, list(set(all_column_names))

    def _is_vague(self, question: str) -> bool:
        words = question.strip().split()
        if len(words) < 5:
            q_lower = question.lower()
            if not any(kw in q_lower for kw in BUSINESS_KEYWORDS):
                return True
        return False

    def _match_fallback(self, question: str) -> str | None:
        q_lower = question.lower()
        for keywords, sql in FALLBACK_QUERIES:
            if any(kw in q_lower for kw in keywords):
                return sql
        return None

    def _check_demo_mode(self, question: str) -> str | None:
        q_lower = question.lower()
        for _, (keywords, sql) in DEMO_QUERIES.items():
            if any(kw in q_lower for kw in keywords):
                return sql
        return None

    async def _generate_sql(self, question: str, schema_str: str, active_tables: list[str] = None, join_hints: list[str] = None) -> str:
        constraint = ""
        if active_tables:
            constraint = f"IMPORTANT: You may ONLY query these tables: {', '.join(active_tables)}. Do NOT reference any other table."
            if len(active_tables) > 1:
                constraint += f"\n\nYou have access to these tables: {', '.join(active_tables)}"
                constraint += "\n\nIf the question needs data from multiple tables, write a JOIN query."
                constraint += "\nIf question only needs one table, use one table."
                constraint += "\nAlways use table aliases in JOINs: FROM sales s JOIN customers c ON s.customer_id = c.customer_id"
                if join_hints:
                    constraint += f"\n\nKnown/detected JOIN relationships:\n" + "\n".join(f"  - {h}" for h in join_hints)
                constraint += "\n\nFor uploaded tables: look at column names to infer relationships (matching column names between tables are likely join keys)."
        
        prompt = TEXT_TO_SQL_USER.format(schema=schema_str, question=question, active_tables_constraint=constraint)
        raw = await self.llm.call(TEXT_TO_SQL_SYSTEM, prompt)
        raw = re.sub(r"```sql|```", "", raw).strip().rstrip(";")
        return raw

    async def _validate_and_repair_sql(
        self, sql: str, conn: sqlite3.Connection, all_columns: dict, all_column_names: list
    ) -> tuple:
        cursor = conn.cursor()
        was_repaired = False

        for attempt in range(3):
            # Check 1: Syntax
            try:
                cursor.execute(f"EXPLAIN QUERY PLAN {sql}")
            except Exception as e:
                if attempt >= 2:
                    return None, was_repaired
                sql = await self._repair_sql(sql, str(e), all_column_names)
                was_repaired = True
                continue

            # Check 2: Column existence guard
            identifiers = set(re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\b", sql))
            aliases = set(re.findall(r"(?i)\bAS\s+[\"\'\`]?([a-zA-Z_][a-zA-Z0-9_]*)[\"\'\`]?", sql))
            
            sql_keywords = {
                "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "ASC", "DESC",
                "LIMIT", "JOIN", "ON", "AND", "OR", "NOT", "IN", "AS", "SUM",
                "COUNT", "AVG", "MIN", "MAX", "DISTINCT", "HAVING", "BETWEEN",
                "LIKE", "IS", "NULL", "CASE", "WHEN", "THEN", "ELSE", "END",
                "LEFT", "RIGHT", "INNER", "OUTER", "CROSS", "UNION", "ALL",
                "EXISTS", "STRFTIME", "CAST", "COALESCE", "IFNULL", "ROUND",
                "UPPER", "LOWER", "LENGTH", "SUBSTR", "REPLACE", "TRIM",
                "INTEGER", "TEXT", "REAL", "BLOB", "NUMERIC", "Y", "M", "D"
            }
            table_names = set(all_columns.keys())
            known = {n.lower() for n in (set(all_column_names) | sql_keywords | table_names | aliases)}
            known.update({"s", "c", "t", "a", "b", "m", "region", "product_category", "date"})
            known.update({"total_revenue", "revenue", "month", "quarter", "customers", "total_units", "units_sold"})

            unknown = [i for i in identifiers if i.lower() not in known and not i.isdigit()]
            if unknown and attempt < 2:
                sql = await self._repair_sql(sql, f"Unknown columns: {unknown}", all_column_names)
                was_repaired = True
                continue
            elif unknown:
                # GUARD 1 - Strict explicit rejection if hallucinated columns survive repairs
                raise ValueError(f"HALLUCINATED_COLUMN:{','.join(unknown)}")

            return sql, was_repaired

        return None, was_repaired

    async def _repair_sql(self, sql: str, error_msg: str, all_column_names: list) -> str:
        prompt = REPAIR_PROMPT_USER.format(
            error_message=error_msg, original_sql=sql, valid_columns=", ".join(all_column_names)
        )
        repaired = await self.llm.call(REPAIR_PROMPT_SYSTEM, prompt)
        return re.sub(r"```sql|```", "", repaired).strip().rstrip(";")

    async def _self_correct_sql(self, sql: str, question: str, schema_str: str) -> str:
        prompt = SELF_CORRECTION_USER.format(
            original_sql=sql, question=question, schema=schema_str
        )
        corrected = await self.llm.call(SELF_CORRECTION_SYSTEM, prompt)
        return re.sub(r"```sql|```", "", corrected).strip().rstrip(";")

    async def _select_chart_and_insights(self, df: pd.DataFrame, question: str, sql: str) -> tuple:
        config = auto_select_chart(df, question)
        
        sample = df.head(5).to_dict("records")
        coro_chart = None
        coro_insight = None

        if config.get("rule_fired") != "DEFAULT":
            config["title"] = question.title()[:60]
            config["reasoning"] = f"Rule engine: {config['rule_fired']}"
        else:
            prompt = CHART_SELECTION_USER.format(
                question=question, sql_query=sql, columns=list(df.columns),
                row_count=len(df), sample_data=sample
            )
            coro_chart = self.llm.call(CHART_SELECTION_SYSTEM, prompt)

        title = config.get("title", question.title()[:60])
        prompt_in = INSIGHT_USER.format(title=title, question=question, data=sample)
        coro_insight = self.llm.call(INSIGHT_SYSTEM, prompt_in)

        # Asyncio gather for LLM calls if needed
        if coro_chart:
            res_chart, res_insight = await asyncio.gather(coro_chart, coro_insight)
            parsed_chart = self.llm.safe_json_parse(res_chart)
            if "error" not in parsed_chart:
                config = parsed_chart
            insights = self.llm.safe_json_array(res_insight)
        else:
            res_insight = await coro_insight
            insights = self.llm.safe_json_array(res_insight)

        return config, insights

    def _compute_confidence(self, df: pd.DataFrame, was_repaired: bool, was_self_corrected: bool, question: str) -> int:
        score = 100
        if len(df) < 3: score -= 15
        if was_repaired: score -= 10
        if was_self_corrected: score -= 20
        vague_words = ["best", "good", "popular", "worst"]
        if any(w in question.lower() for w in vague_words): score -= 5
        return max(0, min(100, score))
    
    def _verify_numbers(self, df: pd.DataFrame, config: dict, conn: sqlite3.Connection):
        """GUARD 4: Number Cross-Verification (aggregate checksum)."""
        if config.get("chart_type") in ["bar", "pie"]:
            y_axis = config.get("y_axis")
            if y_axis and y_axis in df.columns and pd.api.types.is_numeric_dtype(df[y_axis]):
                return df[y_axis].sum()
        return None

    async def process_query(self, question: str, conn: sqlite3.Connection, session_id: str = None, demo_mode: bool = False, active_tables: list[str] = None) -> dict:
        self._clean_expired_sessions()

        if self._is_vague(question):
            return {
                "success": False, "error_type": "VAGUE",
                "message": "Could you be more specific? I need to know: \n📊 What metric? \n📅 What time period? \n🔍 What dimension?",
                "suggestions": ["Show total revenue by region", "Monthly sales trend for 2024", "Top 5 product categories"]
            }

        schema_str, all_columns, all_column_names = self._build_schema_context(conn, active_tables)

        # Find JOIN keys between active tables
        join_hints = []
        if active_tables and len(active_tables) > 1:
            cursor = conn.cursor()
            join_hints = self._find_join_keys(active_tables, cursor)

        try:
            sql = None
            if demo_mode:
                sql = self._check_demo_mode(question)
                
            if not sql:
                sql = await self._generate_sql(question, schema_str, active_tables, join_hints)

            # GUARD 3: INSUFFICIENT DATA Catch
            if "INSUFFICIENT_DATA" in sql:
                reason = sql.replace("INSUFFICIENT_DATA:", "").strip()
                return {"success": False, "error_type": "INSUFFICIENT_DATA", "reason": reason, "available_columns": all_column_names[:15]}

            validated_sql, was_repaired = await self._validate_and_repair_sql(sql, conn, all_columns, all_column_names)
            
            if not validated_sql:
                # LLM failed, fallback trigger
                sql = self._match_fallback(question)
                if sql:
                    validated_sql, was_repaired = sql, True
                else:
                    return {"success": False, "error_type": "SQL_FAILED", "message": "Could not generate valid SQL."}
            
            sql = validated_sql

            was_self_corrected = False
            result_df = pd.read_sql_query(sql, conn)

            # Self-healing loop if 0 results
            if result_df.empty:
                corrected_sql = await self._self_correct_sql(sql, question, schema_str)
                try:
                    result_df = pd.read_sql_query(corrected_sql, conn)
                    if not result_df.empty:
                        sql, was_self_corrected = corrected_sql, True
                except Exception:
                    pass

                if result_df.empty:
                    return {"success": False, "error_type": "EMPTY_RESULTS", "sql_used": sql}

            # GUARD 2: Sanity Check
            warnings = []
            numeric_cols = result_df.select_dtypes(include='number').columns
            for col in numeric_cols:
                if (result_df[col] < 0).any():
                    warnings.append(f"Negative values detected in {col}.")

            # Parallel Chart & Insights
            chart_config, insights = await self._select_chart_and_insights(result_df, question, sql)
            
            # GUARD 4 Verification
            verified_sum = self._verify_numbers(result_df, chart_config, conn)

            confidence = self._compute_confidence(result_df, was_repaired, was_self_corrected, question)

            if not session_id:
                session_id = str(uuid.uuid4())
            sessions[session_id] = {
                "original_question": question, "sql_query": sql, "chart_config": chart_config,
                "result_data": result_df.to_dict("records"), "timestamp": datetime.now().isoformat(),
            }

            return {
                "success": True, "session_id": session_id, "sql_query": sql,
                "data": result_df.to_dict("records"), "chart_config": chart_config,
                "insights": insights, "confidence": confidence, "row_count": len(result_df),
                "warnings": warnings, "verified_sum": verified_sum
            }

        except LLMTimeoutError as e:
            return {"success": False, "error_type": "TIMEOUT", "message": str(e)}
        except LLMRateLimitError as e:
            return {"success": False, "error_type": "RATE_LIMIT", "message": str(e)}
        except ValueError as e:
            msg = str(e)
            if "HALLUCINATED_COLUMN" in msg:
                cols = msg.split(":")[1]
                return {"success": False, "error_type": "INSUFFICIENT_DATA", "reason": f"Required data fields do not exist: {cols}", "available_columns": all_column_names[:15]}
            return {"success": False, "error_type": "API_ERROR", "message": str(e)}
        except Exception as e:
            fallback = self._match_fallback(question)
            if fallback:
                try:
                    df = pd.read_sql_query(fallback, conn)
                    chart_config, insights = await self._select_chart_and_insights(df, question, fallback)
                    return {
                        "success": True, "session_id": str(uuid.uuid4()), "sql_query": fallback,
                        "data": df.to_dict("records"), "chart_config": chart_config,
                        "insights": insights, "confidence": 80, "row_count": len(df), "warnings": ["Fell back to strict offline match."]
                    }
                except Exception:
                    pass
            return {"success": False, "error_type": "API_ERROR", "message": f"Server error: {str(e)}"}


    async def process_follow_up(self, question: str, session_id: str, conn: sqlite3.Connection, active_tables: list[str] = None) -> dict:
        self._clean_expired_sessions()
        if session_id not in sessions:
            return {"success": False, "error_type": "SESSION_EXPIRED"}

        session = sessions[session_id]
        original_sql = session["sql_query"]
        chart_config = session["chart_config"]
        q_lower = question.lower()

        # Follow up scenarios
        op = None
        if any(kw in q_lower for kw in ["as a pie", "as a bar", "as a line", "change to", "show as", "switch to"]): op = "RECHART"
        elif any(kw in q_lower for kw in ["only", "filter", "show only", "just", "exclude", "remove"]): op = "FILTER"
        elif any(kw in q_lower for kw in ["sort by", "order by", "ranked by", "highest", "lowest", "ascending"]): op = "SORT"
        elif any(kw in q_lower for kw in ["drill", "breakdown", "inside", "within", "details of", "zoom into"]): op = "DRILLDOWN"

        try:
            if op == "RECHART":
                new_chart = dict(chart_config)
                for c_t in ["pie", "bar", "line", "area", "scatter", "grouped_bar"]:
                    if c_t in q_lower:
                        new_chart["chart_type"] = c_t
                        break
                session["chart_config"] = new_chart
                session["timestamp"] = datetime.now().isoformat()
                return {
                    "success": True, "session_id": session_id, "sql_query": original_sql,
                    "data": session["result_data"], "chart_config": new_chart,
                    "insights": ["Chart type updated to " + new_chart["chart_type"]],
                    "confidence": 95, "row_count": len(session["result_data"])
                }

            if op in ["FILTER", "SORT", "DRILLDOWN"]:
                import json
                prompt = FOLLOW_UP_USER.format(
                    original_question=session["original_question"], original_sql=original_sql,
                    current_chart=json.dumps(chart_config), follow_up=question
                )
                raw = await self.llm.call(FOLLOW_UP_SYSTEM, prompt)
                parsed = self.llm.safe_json_parse(raw)
                new_sql = parsed.get("updated_sql") or original_sql
                new_sql = re.sub(r"```sql|```", "", new_sql).strip().rstrip(";")

                result_df = pd.read_sql_query(new_sql, conn)
                new_chart, insights = await self._select_chart_and_insights(result_df, question, new_sql)

                sessions[session_id] = {
                    "original_question": question, "sql_query": new_sql, "chart_config": new_chart,
                    "result_data": result_df.to_dict("records"), "timestamp": datetime.now().isoformat(),
                }
                return {
                    "success": True, "session_id": session_id, "sql_query": new_sql,
                    "data": result_df.to_dict("records"), "chart_config": new_chart,
                    "insights": insights, "confidence": 95, "row_count": len(result_df)
                }
        except Exception:
            pass

        return await self.process_query(question, conn, session_id, active_tables=active_tables)

