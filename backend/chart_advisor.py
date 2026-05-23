import json
from typing import Any, Dict, List

from llm_engine import GeminiEngine
from prompt_templates import CHART_SELECTION_PROMPT


class ChartAdvisor:
    def __init__(self, llm_engine: GeminiEngine):
        self.llm = llm_engine

    def select_chart(
        self,
        question: str,
        sql_query: str,
        columns: List[str],
        data: List[Dict],
        row_count: int,
    ) -> Dict[str, Any]:
        """Select the best chart type for the given data."""
        # Take first 5 rows as sample for prompt
        sample_data = json.dumps(data[:5], default=str)

        prompt = CHART_SELECTION_PROMPT.format(
            question=question,
            sql_query=sql_query,
            columns=", ".join(columns),
            row_count=row_count,
            sample_data=sample_data,
        )

        chart_config = self.llm.select_chart_type(prompt)

        # Apply heuristic overrides
        chart_config = self._apply_heuristics(chart_config, columns, data, row_count)

        return chart_config

    def _apply_heuristics(
        self,
        config: Dict[str, Any],
        columns: List[str],
        data: List[Dict],
        row_count: int,
    ) -> Dict[str, Any]:
        """Apply domain heuristics to override LLM chart selection when appropriate."""
        chart_type = config.get("chart_type", "bar")

        # If pie chart with too many categories, switch to bar
        if chart_type == "pie" and row_count > 7:
            config["chart_type"] = "bar"
            config["reasoning"] = (
                f"Switched from pie to bar: {row_count} categories exceeds pie chart limit of 7"
            )

        # Ensure x_axis and y_axis reference actual columns
        x_axis = config.get("x_axis", "")
        y_axis = config.get("y_axis", "")

        if x_axis not in columns and columns:
            config["x_axis"] = columns[0]
        if y_axis not in columns and len(columns) > 1:
            config["y_axis"] = columns[1]
        elif y_axis not in columns and columns:
            config["y_axis"] = columns[0]

        # If color_field doesn't match a column, set to None
        color_field = config.get("color_field")
        if color_field and color_field not in columns:
            config["color_field"] = None

        # Validate chart type is supported
        supported = {"line", "bar", "pie", "area", "scatter", "stacked_bar", "grouped_bar"}
        if config["chart_type"] not in supported:
            config["chart_type"] = "bar"

        return config
