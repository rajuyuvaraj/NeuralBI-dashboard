import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List
from dotenv import dotenv_values, load_dotenv
from groq import Groq

load_dotenv()

# Path to .env so we can re-read it dynamically
_ENV_PATH = Path(__file__).parent / ".env"

# Max retries and base delay (seconds) for exponential backoff
MAX_RETRIES = 4
BASE_DELAY = 2  # seconds


def _get_api_key() -> str:
    """Always read the latest API key directly from .env file."""
    values = dotenv_values(_ENV_PATH)
    # Re-using GEMINI_API_KEY env block or GROQ_API_KEY to be safe during migration
    key = values.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY", "")
    if not key:
        key = values.get("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY", "")
    return key.strip()


def _is_rate_limit_error(e: Exception) -> bool:
    """Check if the exception is a rate limit / quota error."""
    s = str(e).lower()
    return any(k in s for k in ["quota", "resource_exhausted", "429", "rate limit", "ratelimit", "too many requests"])


def _call_with_backoff(fn, *args, **kwargs):
    """Call fn(*args, **kwargs) with exponential backoff on rate-limit errors."""
    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            if _is_rate_limit_error(e):
                wait = BASE_DELAY * (2 ** attempt)  # 2, 4, 8, 16 s
                print(f"[GroqEngine] Rate limited. Retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})...")
                time.sleep(wait)
                last_exc = e
            else:
                raise  # non-rate-limit errors bubble up immediately
    raise last_exc  # exhausted all retries


class GeminiEngine:  # Keeping name so we don't need to change main.py or query_engine.py
    def __init__(self, api_key: str = None, model_name: str = None):
        self.api_key = api_key or _get_api_key()
        if not self.api_key:
            raise ValueError(
                "ERROR: GROQ_API_KEY not found in .env file. "
                "Get your key at: https://console.groq.com/"
            )
        self.client = Groq(api_key=self.api_key)

        env_values = dotenv_values(_ENV_PATH)
        self.model_name = model_name or env_values.get("GROQ_MODEL") or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.retry_count = 0

    def _generate(self, prompt: str) -> str:
        """Wrapper around model.generate_content with automatic backoff.
        Re-reads the API key AND model from .env on every call so changes
        take effect immediately without restarting the server."""
        env_values = dotenv_values(_ENV_PATH)
        fresh_key = _get_api_key()
        fresh_model = (env_values.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()

        if (fresh_key and fresh_key != self.api_key) or (fresh_model != self.model_name):
            print(f"[GroqEngine] Config changed — key/model updated, reconfiguring...")
            self.api_key = fresh_key
            self.model_name = fresh_model
            self.client = Groq(api_key=fresh_key)
            
        def _make_call():
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=2048,
                top_p=0.95
            )
            return response.choices[0].message.content

        return _call_with_backoff(_make_call)

    def _extract_json(self, text: str) -> Any:
        """Robustly extract JSON from LLM response text."""
        text = text.strip()
        # Strip markdown code fences
        text = text.replace("```json", "").replace("```", "").strip()

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON object
        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            try:
                return json.loads(text[json_start:json_end])
            except json.JSONDecodeError:
                pass

        # Try extracting JSON array
        arr_start = text.find("[")
        arr_end = text.rfind("]") + 1
        if arr_start != -1 and arr_end > arr_start:
            try:
                return json.loads(text[arr_start:arr_end])
            except json.JSONDecodeError:
                pass

        raise ValueError(f"Could not extract valid JSON from: {text[:200]}")

    def generate_sql(self, prompt: str) -> str:
        """Generate SQL query from natural language with retry logic."""
        self.retry_count = 0
        self.last_error = None
        try:
            sql_query = self._generate(prompt).strip()

            # Clean SQL output
            sql_query = sql_query.replace("```sql", "").replace("```", "").strip()

            if not any(
                keyword in sql_query.upper()
                for keyword in ["SELECT", "INSUFFICIENT_DATA"]
            ):
                # Retry once for bad output (not rate limit)
                self.retry_count = 1
                sql_query = self._generate(prompt).strip()
                sql_query = sql_query.replace("```sql", "").replace("```", "").strip()

                if not any(
                    keyword in sql_query.upper()
                    for keyword in ["SELECT", "INSUFFICIENT_DATA"]
                ):
                    raise ValueError("Invalid SQL generated after retry")

            return sql_query

        except Exception as e:
            error_str = str(e).lower()
            self.retry_count = 1
            self.last_error = str(e)
            if _is_rate_limit_error(e):
                print(f"[GroqEngine] Rate Limit hit! Details: {self.last_error}")
                return "RATE_LIMITED"
            if "404" in error_str or "not found" in error_str:
                return "MODEL_ERROR"
            return "INSUFFICIENT_DATA"

    def select_chart_type(self, prompt: str) -> Dict[str, Any]:
        """Select chart type based on data characteristics."""
        try:
            text = self._generate(prompt)
            chart_config = self._extract_json(text)

            required_keys = ["chart_type", "x_axis", "y_axis", "title"]
            if not all(key in chart_config for key in required_keys):
                raise ValueError("Incomplete chart configuration")

            if "color_field" not in chart_config:
                chart_config["color_field"] = None
            if "reasoning" not in chart_config:
                chart_config["reasoning"] = ""

            return chart_config

        except Exception as e:
            print(f"Chart selection error: {e}")
            return {
                "chart_type": "bar",
                "x_axis": "category",
                "y_axis": "value",
                "color_field": None,
                "title": "Data Visualization",
                "reasoning": "Default visualization due to processing error",
            }

    def generate_insights(self, prompt: str) -> List[str]:
        """Generate insight bullets from data."""
        try:
            text = self._generate(prompt)
            insights = self._extract_json(text)

            if isinstance(insights, list) and len(insights) >= 3:
                return [str(i) for i in insights[:3]]

            raise ValueError("Expected array of 3 insights")

        except Exception as e:
            print(f"Insight generation error: {e}")
            return [
                "Analysis complete — review the chart for details",
                "Data shows notable variation across categories",
                "Consider filtering for more specific insights",
            ]

    def process_follow_up(self, prompt: str) -> Dict[str, Any]:
        """Handle conversational follow-up queries."""
        try:
            text = self._generate(prompt)
            result = self._extract_json(text)

            if "operation" not in result:
                result["operation"] = "NEW_QUERY"

            return result

        except Exception as e:
            print(f"Follow-up processing error: {e}")
            return {
                "operation": "NEW_QUERY",
                "updated_sql": None,
                "chart_changes": {},
                "explanation": "Processing as new query due to error",
            }
