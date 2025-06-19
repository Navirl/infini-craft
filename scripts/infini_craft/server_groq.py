"""FastAPI server that uses Groq API (qwen3-32B) instead of a local ExLlama/Transformers model.
Requires environment variable `GROQ_API_KEY`.
Run with: `uvicorn infini_craft.server_groq:app --reload`
"""
from __future__ import annotations

import os
from pathlib import Path
import traceback
import json
from functools import lru_cache
from typing import List, Annotated
from pydantic import BaseModel

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, BadRequestError

# -----------------------------------------------------------------------------
# Groq client configuration
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Configuration helpers
# -----------------------------------------------------------------------------

def _load_api_key() -> str:
    """Return Groq API key.

    Looks for a file named `groq_api_key.txt` in the same directory as this script.
    Fallback to `GROQ_API_KEY` env var if the file is missing or empty.
    The file should contain only the plain API key string with no extra whitespace.
    """
    cfg_path = Path(__file__).with_name("groq_api_key.txt")
    if cfg_path.exists():
        key = cfg_path.read_text(encoding="utf-8").strip()
        if key:
            return key
    return os.getenv("GROQ_API_KEY", "")


API_KEY = _load_api_key()

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=API_KEY,
)
MODEL_NAME = "qwen/qwen3-32b"

# -----------------------------------------------------------------------------
# FastAPI boilerplate
# -----------------------------------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------

def chat(
    messages: List[dict],
    temperature: float = 0.0,
    max_tokens: int = 30000,  # Increased for safer JSON generation
    json_mode: bool = False,
) -> str:
    """Call Groq ChatCompletion and return assistant content."""
    kwargs = {}
    if json_mode:
        # Force the model to return a valid JSON object. Groq follows the same
        # `response_format` parameter semantics as the OpenAI API.
        kwargs["response_format"] = {"type": "json_object"}

    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
    except BadRequestError as e:
        # Groq returns a 400 with code 'json_validate_failed' when the model
        # fails to satisfy the strict JSON requirement. Fallback by retrying
        # without the response_format constraint so that we still get a reply
        # that we can attempt to parse heuristically.
        if json_mode:
            print(f"[chat] JSON mode failed, retrying in text mode: {e}")
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        else:
            raise

    return completion.choices[0].message.content.strip()


def create_add_prompt(symbols: List[str]) -> List[dict]:
    """Prompt Groq to combine symbols and return JSON {"symbol": str, "emoji": str}."""
    joined = "+".join(symbols)
    user_msg = f'''Combine the following symbols: {joined}

Return a single JSON object with two keys: "symbol" and "emoji". Do not add any other text.

Example for "Water" + "Fire":
{{
  "symbol": "Steam",
  "emoji": "💨"
}}'''
    return [
        {"role": "system", "content": "You are an API that returns JSON."},
        {"role": "user", "content": user_msg},
    ]


def create_split_prompt(symbol: str) -> List[dict]:
    """Prompt Groq to split a symbol and return JSON {"parts": [ {symbol, emoji}, {symbol, emoji} ]}."""
    user_msg = f'''Split the following symbol into two parts: {symbol}

Return a single JSON object with one key: "parts". The value should be a list of two objects, each with "symbol" and "emoji" keys. Do not add any other text.

Example for "Steam":
{{
  "parts": [
    {{
      "symbol": "Water",
      "emoji": "💧"
    }},
    {{
      "symbol": "Fire",
      "emoji": "🔥"
    }}
  ]
}}'''
    return [
        {"role": "system", "content": "You are an API that returns JSON."},
        {"role": "user", "content": user_msg},
    ]


def parse_add_response(text: str):
    """Parse JSON response for add. Fallback to legacy space-separated format."""
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "symbol" in data:
            return {"symbol": data.get("symbol", "").strip(), "emoji": data.get("emoji", "").strip()}
    except Exception:
        pass  # fall back to legacy parsing
    try:
        word, emoji = text.strip().rsplit(" ", 1)
    except ValueError:
        word, emoji = text.strip(), ""
    return {"symbol": word.strip(), "emoji": emoji.strip()}


def parse_split_response(text: str):
    """Parse JSON response for split. Fallback to legacy '+' format."""
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "parts" in data and isinstance(data["parts"], list):
            result = []
            for item in data["parts"][:2]:
                if isinstance(item, dict):
                    result.append({
                        "symbol": str(item.get("symbol", "")).strip(),
                        "emoji": str(item.get("emoji", "")).strip(),
                    })
            # pad to 2
            while len(result) < 2:
                result.append({"symbol": "", "emoji": ""})
            return result[:2]
    except Exception:
        pass  # fallback

    # Legacy '+' parsing
    parts = text.split("+")
    result = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        try:
            word, emoji = part.rsplit(" ", 1)
        except ValueError:
            word, emoji = part, ""
        result.append({"symbol": word.strip(), "emoji": emoji.strip()})
    while len(result) < 2:
        result.append({"symbol": "", "emoji": ""})
    return result[:2]

# -----------------------------------------------------------------------------
# Caching wrappers
# -----------------------------------------------------------------------------

@lru_cache
def _add(symbols: tuple[str]):
    response_text = chat(create_add_prompt(list(symbols)), json_mode=True)
    parsed = parse_add_response(response_text)
    print(f"add symbols={symbols} response='{response_text}' parsed={parsed}")
    return parsed


@lru_cache
def _split(symbol: str):
    response_text = chat(create_split_prompt(symbol), json_mode=True)
    parsed = parse_split_response(response_text)
    print(f"split symbol={symbol} response='{response_text}' parsed={parsed}")
    return parsed

# -----------------------------------------------------------------------------
# API endpoints

# -----------------------------------------------------------------------------
# Payload models for custom prompt endpoints
# -----------------------------------------------------------------------------

class AddCustomRequest(BaseModel):
    messages: List[dict]
    symbols: List[str]


class SplitCustomRequest(BaseModel):
    messages: List[dict]
    symbol: str


# -----------------------------------------------------------------------------
# API endpoints
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------

@app.get("/add")
async def add(symbols: Annotated[List[str], Query()]):
    try:
        return _add(tuple(symbols))
    except Exception:
        print(traceback.format_exc())
        return {"symbol": "", "emoji": ""}


@app.get("/split")
async def split(symbol: str):
    try:
        return _split(symbol)
    except Exception:
        print(traceback.format_exc())
        return [{"symbol": "", "emoji": ""}, {"symbol": "", "emoji": ""}]


@app.post("/add_custom")
async def add_custom(req: AddCustomRequest):
    """Combine symbols with a fully custom prompt supplied by the client."""
    try:
        response_text = chat(req.messages, json_mode=True)
        parsed = parse_add_response(response_text)
        print(f"add_custom symbols={req.symbols} response='{response_text}' parsed={parsed}")
        return parsed
    except Exception:
        print(traceback.format_exc())
        return {"symbol": "", "emoji": ""}


@app.post("/split_custom")
async def split_custom(req: SplitCustomRequest):
    """Split a symbol with a fully custom prompt supplied by the client."""
    try:
        response_text = chat(req.messages, json_mode=True)
        parsed = parse_split_response(response_text)
        print(f"split_custom symbol={req.symbol} response='{response_text}' parsed={parsed}")
        return parsed
    except Exception:
        print(traceback.format_exc())
        return [{"symbol": "", "emoji": ""}, {"symbol": "", "emoji": ""}]
