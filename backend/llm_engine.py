import os
import json
import re
import asyncio
from groq import AsyncGroq, RateLimitError
from dotenv import load_dotenv

load_dotenv()


class LLMTimeoutError(Exception):
    pass


class LLMRateLimitError(Exception):
    pass


class LLMEngine:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY not found in .env file.\n"
                "Get your free key at: https://console.groq.com"
            )
        self.client = AsyncGroq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"

    async def call(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 2048,
    ) -> str:
        try:
            # Wrap API request in a timeout
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=20.0,
            )
            return response.choices[0].message.content.strip()
        except asyncio.TimeoutError:
            raise LLMTimeoutError("AI took too long. Please try again.")
        except RateLimitError:
            raise LLMRateLimitError("AI is busy. Rate limit exceeded.")
        except Exception as e:
            print(f"Groq API error: {e}")
            raise e

    def safe_json_parse(self, text: str) -> dict:
        text = re.sub(r"```json|```", "", text).strip()
        try:
            return json.loads(text)
        except Exception:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
            return {"error": "parse_failed", "raw": text}

    def safe_json_array(self, text: str) -> list:
        text = re.sub(r"```json|```", "", text).strip()
        try:
            return json.loads(text)
        except Exception:
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except Exception:
                    pass
            return [
                "Revenue patterns show notable variation across segments",
                "Top performers significantly outpace the average",
                "Trend suggests continued growth opportunity",
            ]
