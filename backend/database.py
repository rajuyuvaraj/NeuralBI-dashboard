import sqlite3
import pandas as pd
import os
from typing import Any, Dict, List
from dotenv import load_dotenv

load_dotenv()


class DatabaseManager:
    _instance = None

    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.getenv("DATABASE_PATH", "../data/neuralbi.db")
        # Resolve relative path based on this file's location
        if not os.path.isabs(self.db_path):
            base_dir = os.path.dirname(os.path.abspath(__file__))
            self.db_path = os.path.normpath(os.path.join(base_dir, self.db_path))

        self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        # Enable WAL mode for concurrent reads during writes
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA foreign_keys=ON")

    @classmethod
    def get_instance(cls, db_path: str = None) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = cls(db_path)
        return cls._instance

    @classmethod
    def reset_instance(cls):
        if cls._instance is not None:
            cls._instance.close()
            cls._instance = None

    def get_connection(self) -> sqlite3.Connection:
        return self.connection

    def get_schema_context(self) -> Dict[str, Any]:
        """Get comprehensive database schema information for LLM context."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]

        schema_info: Dict[str, Any] = {
            "tables": {},
            "sample_data": {},
        }

        for table in tables:
            cursor.execute(f"PRAGMA table_info({table});")
            columns = cursor.fetchall()

            schema_info["tables"][table] = {
                "columns": [
                    {
                        "name": col[1],
                        "type": col[2],
                        "nullable": not col[3],
                        "primary_key": bool(col[5]),
                    }
                    for col in columns
                ]
            }

            column_names = [col[1] for col in columns]
            cursor.execute(f"SELECT * FROM {table} LIMIT 3;")
            sample_rows = cursor.fetchall()

            schema_info["sample_data"][table] = [
                dict(zip(column_names, row)) for row in sample_rows
            ]

        return schema_info

    def get_all_tables(self) -> List[Dict]:
        """Return all tables with columns and types for the schema endpoint."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]

        result = []
        for table in tables:
            cursor.execute(f"PRAGMA table_info({table});")
            columns = cursor.fetchall()

            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            row_count = cursor.fetchone()[0]

            result.append({
                "name": table,
                "row_count": row_count,
                "columns": [
                    {
                        "name": col[1],
                        "type": col[2],
                        "primary_key": bool(col[5]),
                    }
                    for col in columns
                ],
            })

        return result

    def execute_raw(self, sql: str) -> pd.DataFrame:
        """Execute a raw SQL query and return results as DataFrame."""
        try:
            df = pd.read_sql_query(sql, self.connection)
            return df
        except Exception as e:
            print(f"Query execution error: {e}")
            return pd.DataFrame()

    def ingest_csv(self, file_path: str, table_name: str) -> Dict[str, Any]:
        """Ingest a CSV file into the database as a new table."""
        try:
            df = pd.read_csv(file_path)
            # Temporarily disable foreign keys so DROP TABLE (from if_exists="replace") succeeds
            self.connection.execute("PRAGMA foreign_keys=OFF")
            df.to_sql(table_name, self.connection, if_exists="replace", index=False)
            self.connection.execute("PRAGMA foreign_keys=ON")
            return {
                "success": True,
                "table_name": table_name,
                "row_count": len(df),
                "columns": [
                    {"name": col, "type": str(df[col].dtype)}
                    for col in df.columns
                ],
            }
        except Exception as e:
            # Re-enable foreign keys even on failure
            self.connection.execute("PRAGMA foreign_keys=ON")
            print(f"CSV ingestion error: {e}")
            return {"success": False, "error": str(e)}

    def close(self):
        if self.connection:
            self.connection.close()
