import pandas as pd

def auto_select_chart(df, question: str) -> dict:
    cols = list(df.columns)
    q = question.lower()
    n_rows = len(df)

    # ── Classify columns ──────────────────────────────

    time_cols = [c for c in cols if any(
        w in c.lower() for w in
        ['date','month','year','week','quarter',
         'period','time','day']
    )]

    numeric_cols = [
        c for c in cols
        if pd.api.types.is_numeric_dtype(df[c])
    ]

    cat_cols = [
        c for c in cols
        if c not in numeric_cols
        and c not in time_cols
        and df[c].nunique() <= 30
    ]

    # helper: first numeric col that is not an ID
    def best_numeric():
        for c in numeric_cols:
            if 'id' not in c.lower():
                return c
        return numeric_cols[0] if numeric_cols else None

    # ── RULE 1 (HIGHEST PRIORITY) ─────────────────────
    # ANY time column → line or area. NEVER pie.
    # This rule fires before everything else.
    if time_cols and numeric_cols:
        y = best_numeric()
        # Multi-category time series → area
        if cat_cols:
            return {
                "chart_type": "area",
                "x_axis": time_cols[0],
                "y_axis": y,
                "color_field": cat_cols[0],
                "title": "",
                "rule_fired": "TIME_MULTI → area"
            }
        # Single metric over time → line
        return {
            "chart_type": "line",
            "x_axis": time_cols[0],
            "y_axis": y,
            "color_field": None,
            "title": "",
            "rule_fired": "TIME_SINGLE → line"
        }

    # ── RULE 2 ────────────────────────────────────────
    # Pie ONLY when ALL 4 conditions are true:
    #   a) no time column (already passed rule 1)
    #   b) 3–7 rows (enough to show, few enough to read)
    #   c) exactly 1 categorical + 1 numeric col
    #   d) question contains a composition keyword
    pie_keywords = [
        'breakdown','share','percent','proportion',
        'distribution','composition','split','portion',
        'ratio','contribution','mix'
    ]
    pie_question = any(w in q for w in pie_keywords)

    if (3 <= n_rows <= 7
            and len(cat_cols) == 1
            and len(numeric_cols) == 1
            and pie_question):
        return {
            "chart_type": "pie",
            "x_axis": cat_cols[0],
            "y_axis": numeric_cols[0],
            "color_field": None,
            "title": "",
            "rule_fired": "PARTS_OF_WHOLE → pie"
        }

    # ── RULE 3 ────────────────────────────────────────
    # Multi-dimension grouped bar
    # 2+ categorical columns → grouped bar
    if len(cat_cols) >= 2 and numeric_cols:
        return {
            "chart_type": "grouped_bar",
            "x_axis": cat_cols[0],
            "y_axis": best_numeric(),
            "color_field": cat_cols[1],
            "title": "",
            "rule_fired": "MULTI_CAT → grouped_bar"
        }

    # ── RULE 4 ────────────────────────────────────────
    # Standard bar: 1 categorical + 1 numeric
    if cat_cols and numeric_cols:
        return {
            "chart_type": "bar",
            "x_axis": cat_cols[0],
            "y_axis": best_numeric(),
            "color_field": None,
            "title": "",
            "rule_fired": "CATEGORY → bar"
        }

    # ── RULE 5 ────────────────────────────────────────
    # Scatter: 2+ numeric, no categories
    if len(numeric_cols) >= 2 and not cat_cols:
        return {
            "chart_type": "scatter",
            "x_axis": numeric_cols[0],
            "y_axis": numeric_cols[1],
            "color_field": None,
            "title": "",
            "rule_fired": "CORRELATION → scatter"
        }

    # ── DEFAULT ───────────────────────────────────────
    y = best_numeric() or (cols[1] if len(cols) > 1
                           else cols[0])
    return {
        "chart_type": "bar",
        "x_axis": cols[0],
        "y_axis": y,
        "color_field": None,
        "title": "",
        "rule_fired": "DEFAULT → bar"
    }
