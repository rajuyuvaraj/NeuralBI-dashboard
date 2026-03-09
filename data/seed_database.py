import sqlite3
import pandas as pd
import os
import sys


def seed():
    base = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base, "neuralbi.db")
    conn = sqlite3.connect(db_path)

    files = [
        ("sales.csv", "sales"),
        ("customers.csv", "customers"),
        ("monthly_targets.csv", "monthly_targets"),
    ]

    for csv_file, table in files:
        path = os.path.join(base, csv_file)
        if not os.path.exists(path):
            print(f"Missing: {path}")
            print("   Make sure the CSV files are in the data/ directory.")
            sys.exit(1)
        df = pd.read_csv(path)
        df.to_sql(table, conn, if_exists="replace", index=False)
        print(f"  {table}: {len(df)} rows loaded")

    # Verify all tables loaded
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print(f"\n  Database ready at: {db_path}")
    print(f"   Tables: {tables}")
    conn.close()


if __name__ == "__main__":
    seed()
