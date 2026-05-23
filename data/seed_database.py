"""
Seed database script for NeuralBI.
Creates 'sales' (500+ rows) and 'customers' (100+ rows) tables
with realistic sample data in data/neuralbi.db.
Also exports sample_sales_data.csv.
"""
import sqlite3
import csv
import random
import os
from datetime import datetime, timedelta

random.seed(42)

# Resolve paths relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "neuralbi.db")
CSV_PATH = os.path.join(SCRIPT_DIR, "sample_sales_data.csv")

# ── Data pools ──────────────────────────────────────────────

REGIONS = ["East", "West", "North", "South", "Central"]

CATEGORIES_PRODUCTS = {
    "Electronics": ["Laptop Pro X1", "Wireless Earbuds Z3", "Smart TV 55in", "Tablet Air M2", "Gaming Console S"],
    "Clothing": ["Premium Jacket", "Casual Sneakers", "Silk Dress Shirt", "Denim Jeans Classic", "Sports Hoodie"],
    "Furniture": ["Ergonomic Desk Chair", "Standing Desk Oak", "Bookshelf Modern", "Sofa Sectional L", "Dining Table Set"],
    "Food & Beverage": ["Organic Coffee Blend", "Protein Bar Pack", "Artisan Pasta Set", "Cold Press Juice 12pk", "Gourmet Tea Collection"],
    "Sports": ["Running Shoes Ultra", "Yoga Mat Premium", "Resistance Band Set", "Mountain Bike 27.5", "Swimming Goggles Pro"],
}

SALES_REPS = [
    "Alice Johnson", "Bob Martinez", "Carol Chen", "David Kim", "Elena Rodriguez",
    "Frank Wilson", "Grace Lee", "Hector Patel", "Irene Thompson", "James Anderson",
    "Karen White", "Leo Garcia", "Maria Davis", "Nathan Brown", "Olivia Clark",
]

FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Barbara", "William", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Daniel", "Nancy", "Matthew", "Lisa",
    "Anthony", "Betty", "Mark", "Margaret", "Steven", "Sandra", "Paul", "Ashley",
    "Andrew", "Dorothy", "Joshua", "Kimberly", "Kenneth", "Emily", "Kevin", "Donna",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
]

TIERS = ["Bronze", "Silver", "Gold", "Platinum"]
TIER_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

CITIES_STATES = [
    ("New York", "NY"), ("Los Angeles", "CA"), ("Chicago", "IL"), ("Houston", "TX"),
    ("Phoenix", "AZ"), ("Philadelphia", "PA"), ("San Antonio", "TX"), ("San Diego", "CA"),
    ("Dallas", "TX"), ("San Jose", "CA"), ("Austin", "TX"), ("Jacksonville", "FL"),
    ("Fort Worth", "TX"), ("Columbus", "OH"), ("Charlotte", "NC"), ("Indianapolis", "IN"),
    ("San Francisco", "CA"), ("Seattle", "WA"), ("Denver", "CO"), ("Boston", "MA"),
    ("Nashville", "TN"), ("Portland", "OR"), ("Atlanta", "GA"), ("Miami", "FL"),
]


def random_date(start: datetime, end: datetime) -> str:
    delta = end - start
    random_days = random.randint(0, delta.days)
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")


def create_customers(cursor: sqlite3.Cursor, count: int = 120):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            customer_id INTEGER PRIMARY KEY,
            customer_name TEXT NOT NULL,
            tier TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            join_date TEXT NOT NULL,
            total_orders INTEGER NOT NULL,
            lifetime_value REAL NOT NULL,
            is_active INTEGER NOT NULL
        )
    """)

    customers = []
    used_names = set()
    for i in range(1, count + 1):
        # Generate unique name
        while True:
            name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
            if name not in used_names:
                used_names.add(name)
                break

        tier = random.choices(TIERS, weights=TIER_WEIGHTS, k=1)[0]
        city, state = random.choice(CITIES_STATES)
        join_date = random_date(datetime(2022, 1, 1), datetime(2025, 6, 30))

        # Scale value by tier
        tier_multiplier = {"Bronze": 1, "Silver": 2.5, "Gold": 5, "Platinum": 10}
        base_value = random.uniform(500, 5000)
        lifetime_value = round(base_value * tier_multiplier[tier], 2)
        total_orders = random.randint(1, 15) * (TIERS.index(tier) + 1)
        is_active = 1 if random.random() < 0.85 else 0

        customers.append((
            i, name, tier, city, state, join_date,
            total_orders, lifetime_value, is_active
        ))

    cursor.executemany(
        "INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        customers,
    )
    return customers


def create_sales(cursor: sqlite3.Cursor, customer_ids: list, count: int = 600):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            region TEXT NOT NULL,
            product_category TEXT NOT NULL,
            product_name TEXT NOT NULL,
            revenue REAL NOT NULL,
            units_sold INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            sales_rep TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        )
    """)

    # Revenue ranges by category
    revenue_ranges = {
        "Electronics": (200, 5000),
        "Clothing": (50, 800),
        "Furniture": (150, 3000),
        "Food & Beverage": (20, 300),
        "Sports": (80, 2000),
    }

    categories = list(CATEGORIES_PRODUCTS.keys())
    sales = []

    for i in range(1, count + 1):
        date = random_date(datetime(2024, 1, 1), datetime(2025, 12, 31))
        region = random.choice(REGIONS)
        category = random.choice(categories)
        product = random.choice(CATEGORIES_PRODUCTS[category])

        min_rev, max_rev = revenue_ranges[category]
        revenue = round(random.uniform(min_rev, max_rev), 2)
        units = random.randint(1, 50)
        customer_id = random.choice(customer_ids)
        sales_rep = random.choice(SALES_REPS)

        sales.append((
            i, date, region, category, product,
            revenue, units, customer_id, sales_rep
        ))

    cursor.executemany(
        "INSERT INTO sales VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sales,
    )
    return sales


def export_csv(sales: list):
    headers = [
        "id", "date", "region", "product_category", "product_name",
        "revenue", "units_sold", "customer_id", "sales_rep",
    ]
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(sales)


def main():
    # Remove existing db if present
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Creating customers table...")
    customers = create_customers(cursor, count=120)
    customer_ids = [c[0] for c in customers]
    print(f"  -> {len(customers)} customers created")

    print("Creating sales table...")
    sales = create_sales(cursor, customer_ids, count=600)
    print(f"  -> {len(sales)} sales records created")

    conn.commit()

    # Verify
    cursor.execute("SELECT COUNT(*) FROM customers")
    print(f"  Customers in DB: {cursor.fetchone()[0]}")
    cursor.execute("SELECT COUNT(*) FROM sales")
    print(f"  Sales in DB: {cursor.fetchone()[0]}")

    conn.close()

    print("Exporting sample CSV...")
    export_csv(sales)
    print(f"  -> {CSV_PATH}")

    print(f"\nDatabase created at: {DB_PATH}")
    print("Done!")


if __name__ == "__main__":
    main()
