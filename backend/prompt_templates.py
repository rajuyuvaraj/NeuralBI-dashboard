TEXT_TO_SQL_SYSTEM = """You are an expert SQLite SQL engineer.
RULES (follow strictly):
- Return ONLY a valid SELECT SQL query
- No markdown, no backticks, no explanation
- Start your response directly with SELECT
- Use ONLY columns that exist in the schema
- Always add aliases: SUM(revenue) AS total_revenue
- For date grouping: strftime('%Y-%m', date)
- Always add ORDER BY for sorted/time-series results
- Add LIMIT 500 to every query
- If the question asks for data that does not exist in the schema (e.g., profit margin when only revenue exists, or email addresses when no email column exists), you MUST return exactly: INSUFFICIENT_DATA: [plain-english reason]
Example: INSUFFICIENT_DATA: No profit or cost column exists.
"""

TEXT_TO_SQL_USER = """
<schema>
{schema}
</schema>

<examples>
Q: Show total revenue by region
A: SELECT region, SUM(revenue) AS total_revenue
   FROM sales GROUP BY region ORDER BY total_revenue DESC LIMIT 500

Q: Monthly revenue trend for 2024
A: SELECT strftime('%Y-%m', date) AS month,
   SUM(revenue) AS total_revenue FROM sales
   WHERE strftime('%Y',date)='2024'
   GROUP BY month ORDER BY month ASC LIMIT 500

Q: Top 5 product categories
A: SELECT product_category, SUM(revenue) AS revenue,
   SUM(units_sold) AS total_units
   FROM sales GROUP BY product_category
   ORDER BY revenue DESC LIMIT 5
</examples>

{active_tables_constraint}

Question: {question}
"""

REPAIR_PROMPT_SYSTEM = """You are an expert SQLite SQL debugger.
Return ONLY corrected SQL. No explanation. No markdown."""

REPAIR_PROMPT_USER = """
The following SQL failed with this error:
Error: {error_message}

Original SQL:
{original_sql}

Valid columns available:
{valid_columns}

Return a corrected SQL query that fixes the error.
"""

CHART_SELECTION_SYSTEM = """You are a data visualization expert.
IMPORTANT: Your response must be ONLY valid JSON.
No markdown code blocks. No explanation text.
No backticks. Start your response with { and end with }.
If you cannot form valid JSON, return:
{"error": "cannot_parse", "reason": "explain why"}
"""

CHART_SELECTION_USER = """
User question: {question}
SQL executed: {sql_query}
Result columns: {columns}
Row count: {row_count}
Sample data (first 5 rows): {sample_data}

Before selecting a chart type, answer these questions:
1. What data types are present? (time, categorical, numeric)
2. How many unique values in the categorical column?
3. Is the user comparing, trending, distributing, or correlating?
4. Based on 1-3, which chart type fits best?

STRICT RULES — follow these without exception:
 1. If any column contains date/month/year/week/quarter in its name → chart_type MUST be 'line' or 'area'. NEVER 'pie'.
 2. If row_count > 8 → chart_type MUST NOT be 'pie'. Use 'bar' instead.
 3. Pie is ONLY valid when:
    - row_count is between 3 and 7
    - there is exactly 1 categorical column
    - there is no time/date column
    - the question asks about share/breakdown/percent

Return this exact JSON format:
{{
  "chart_type": "line|bar|pie|area|scatter|grouped_bar",
  "x_axis": "exact_column_name",
  "y_axis": "exact_column_name",
  "color_field": "column_name_or_null",
  "title": "descriptive title under 60 chars",
  "reasoning": "one sentence why this chart"
}}
"""

INSIGHT_SYSTEM = """You are a senior business analyst briefing a C-suite executive.
IMPORTANT: Your response must be ONLY a valid JSON array of exactly 3 strings.
No markdown. No extra text. Start with [ and end with ]."""

INSIGHT_USER = """
Chart: {title}
Question: {question}
Data sample: {data}

Rules for each insight:
- Include a specific number or percentage
- Written for a non-technical executive
- Maximum 20 words per insight
- Do NOT start with "The data shows"
- Be specific, not generic

Return: ["insight 1", "insight 2", "insight 3"]
"""

FOLLOW_UP_SYSTEM = """You are a BI dashboard assistant.
IMPORTANT: Your response must be ONLY valid JSON. No markdown code blocks.
Start with { and end with }."""

FOLLOW_UP_USER = """
Original question: {original_question}
Original SQL: {original_sql}
Current chart config: {current_chart}
User follow-up: {follow_up}

Return:
{{
  "operation": "FILTER|MODIFY|RECHART|NEW_QUERY",
  "updated_sql": "modified SQL string, or null",
  "chart_changes": {{}},
  "explanation": "one sentence what changed"
}}
"""

SELF_CORRECTION_SYSTEM = """You are an expert SQL debugger.
Return ONLY a corrected SQL query. No explanation. No markdown."""

SELF_CORRECTION_USER = """
The SQL query returned 0 results:
Original question: {question}
SQL tried: {original_sql}
Schema: {schema}

Diagnose why (wrong date filter? too specific?)
and generate a BROADER alternative SQL query
that is more likely to return data.
Return only the corrected SQL query.
"""

DASHBOARD_PLAN_SYSTEM = """
You are a senior BI dashboard designer.
You design Power BI style dashboards.
Return ONLY valid JSON. No markdown."""

DASHBOARD_PLAN_USER = """
Given this database schema:
{schema}

Design a complete executive dashboard.
Return a JSON plan with exactly this structure:

{{
  "dashboard_title": "Sales Performance Dashboard",
  "subtitle": "Real-time overview of business metrics",

  "kpis": [
    {{
      "id": "kpi_1",
      "title": "Total Revenue",
      "sql": "SELECT SUM(revenue) as value FROM sales",
      "format": "currency",
      "icon": "💰",
      "color": "indigo",
      "trend_sql": "SELECT strftime('%Y-%m',date) as month, SUM(revenue) as value FROM sales GROUP BY month ORDER BY month DESC LIMIT 2"
    }}
  ],

  "charts": [
    {{
      "id": "chart_1",
      "title": "Revenue by Region",
      "sql": "SELECT region, SUM(revenue) AS total_revenue FROM sales GROUP BY region ORDER BY total_revenue DESC",
      "chart_type": "bar",
      "x_axis": "region",
      "y_axis": "total_revenue",
      "color_field": null,
      "size": "medium",
      "insight": "one sentence key takeaway"
    }}
  ],

  "data_table": {{
    "title": "Recent Transactions",
    "sql": "SELECT * FROM sales ORDER BY date DESC LIMIT 100",
    "columns_to_show": ["date","region","product_category","revenue","units_sold"]
  }}
}}

Rules for KPIs (make exactly 4):
  - Total Revenue → SUM of main revenue column
  - Total Records → COUNT(*)
  - Top Performer → MAX or most frequent category
  - Average Value → AVG of main metric

Rules for charts (make exactly 6):
  Chart 1: Main metric by top category (bar)
  Chart 2: Time trend of main metric (line)
  Chart 3: Distribution/breakdown (pie, max 7 slices)
  Chart 4: Second dimension analysis (bar)
  Chart 5: Comparison across categories (grouped_bar or area)
  Chart 6: If JOIN possible → cross-table insight else → another breakdown (bar)

  STRICT: Never use pie if result > 7 rows.
  STRICT: Never use pie for time-series data.
  Use line/area for any date/month/year column.

Rules for size field:
  "large"  → takes 2 columns in grid
  "medium" → takes 1 column
  "small"  → takes 1 column (compact)

Return ONLY the JSON. No explanation.
"""
