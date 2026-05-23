import json
from typing import Any, Dict, List

from llm_engine import GeminiEngine
from prompt_templates import INSIGHT_PROMPT


class InsightGenerator:
    def __init__(self, llm_engine: GeminiEngine):
        self.llm = llm_engine

    def generate(
        self,
        question: str,
        sql_query: str,
        chart_config: Dict[str, Any],
        data: List[Dict],
        row_count: int,
    ) -> List[str]:
        """Generate 3 insight bullets about the data."""
        # Take first 10 rows as sample (don't send full dataset to LLM)
        sample_data = json.dumps(data[:10], default=str)

        prompt = INSIGHT_PROMPT.format(
            title=chart_config.get("title", "Data Visualization"),
            question=question,
            chart_type=chart_config.get("chart_type", "bar"),
            data=sample_data,
        )

        insights = self.llm.generate_insights(prompt)

        # Validate we got 3 insights
        if len(insights) < 3:
            insights = self._fallback_insights(data, chart_config)

        return insights[:3]

    def _fallback_insights(
        self, data: List[Dict], chart_config: Dict[str, Any]
    ) -> List[str]:
        """Generate basic statistical insights as fallback."""
        insights = []

        if not data:
            return [
                "No data available for analysis",
                "Try a different query for insights",
                "Upload more data for richer analysis",
            ]

        row_count = len(data)
        insights.append(f"Dataset contains {row_count} records for analysis")

        # Try to find numeric columns for basic stats
        y_axis = chart_config.get("y_axis", "")
        if y_axis and y_axis in data[0]:
            values = [row[y_axis] for row in data if isinstance(row.get(y_axis), (int, float))]
            if values:
                avg_val = sum(values) / len(values)
                max_val = max(values)
                insights.append(f"Average {y_axis}: {avg_val:,.2f}")
                insights.append(f"Highest {y_axis}: {max_val:,.2f}")
            else:
                insights.append("Numeric analysis not available for this dataset")
                insights.append("Consider filtering for more specific results")
        else:
            insights.append("Review chart visualization for key patterns")
            insights.append("Try refining your query for deeper insights")

        return insights[:3]
