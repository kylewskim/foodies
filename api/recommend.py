"""
Vercel Python Serverless Function — /api/recommend

Proxies to the standalone RecipeRec service.

POST /api/recommend
Body: {
  "inventory": [{"name": "Eggs", "expiration_date": "2026-02-12"}, ...],
  "restrictions": ["allergy_nuts", "diet_vegan"],
  "top_k": 8,
  "debug": false,
  "provider_enabled": true
}
"""

import json
import os
import re
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_RECOMMENDER_URL = "https://reciperec.onrender.com/recommend"
RECOMMENDER_URL = os.getenv("RECOMMENDER_URL", DEFAULT_RECOMMENDER_URL)
RECOMMENDER_TIMEOUT_SECONDS = float(os.getenv("RECOMMENDER_TIMEOUT_SECONDS", "15"))

VALID_CATEGORIES = {
    "produce",
    "protein",
    "grains",
    "dairy",
    "snacks",
    "condiments",
    "beverages",
    "prepared",
    "canned",
    "frozen",
    "other",
}

DROP_TOKENS = {
    "fresh",
    "organic",
    "large",
    "small",
    "pack",
    "packs",
    "package",
    "bottle",
    "bottles",
    "jar",
    "bag",
    "bags",
    "lb",
    "lbs",
    "oz",
    "g",
    "kg",
    "ml",
    "l",
    "ct",
    "count",
    "piece",
    "pieces",
    "each",
    "bunch",
    "series",
    "now",
    "app",
    "ft",
    "f",
    "t",
    "pro",
}

NON_FOOD_HINTS = {
    "colgate",
    "toothpaste",
    "toothbrush",
    "mouthwash",
    "detergent",
    "soap",
    "shampoo",
    "conditioner",
    "deodorant",
    "lotion",
    "cleaner",
    "bleach",
    "cat food",
    "dog food",
    "purina",
    "litter",
}

ALIASES = [
    (re.compile(r"\bbanana(s)?\b"), "banana"),
    (re.compile(r"\begg(s)?\b"), "egg"),
    (re.compile(r"\bonion(s)?\b"), "onion"),
    (re.compile(r"\bzucchini\b"), "zucchini"),
    (re.compile(r"\b(cara cara )?orange(s)?\b"), "orange"),
    (re.compile(r"\bmozzarella\b"), "mozzarella"),
    (re.compile(r"\bgreek yogurt\b|\byogurt\b"), "yogurt"),
    (re.compile(r"\bmilk\b"), "milk"),
    (re.compile(r"\bpork\s*belly\b|\bporkbelly\b"), "pork belly"),
    (re.compile(r"\bsalmon(s)?\b"), "salmon"),
    (re.compile(r"\bchicken\s*feet\b"), "chicken feet"),
    (re.compile(r"\bchicken\b"), "chicken"),
    (re.compile(r"\bwater\b|\bwate\b"), "water"),
    (re.compile(r"\bcoconut water\b"), "coconut water"),
    (re.compile(r"\bpasta\b|\blasagn[ea]\b"), "pasta"),
    (re.compile(r"\bcoca[\s-]?cola\b"), "coca cola"),
    (re.compile(r"\bpepsi\b"), "pepsi"),
    (re.compile(r"\bpocky\b"), "pocky"),
    (re.compile(r"\bpop[\s-]?tarts?\b"), "pop tarts"),
    (re.compile(r"\bcheese\b"), "cheese"),
]


class UpstreamHTTPError(Exception):
    def __init__(self, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"Recommender error {status}: {body}")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            inventory = body.get("inventory", [])
            restrictions = body.get("restrictions", [])
            requested_top_k = body.get("top_k", 8)
            debug = body.get("debug", False)
            requested_provider_enabled = body.get("provider_enabled", True)
            provider_enabled = True

            if debug:
                print("[/api/recommend] incoming request body:")
                print(json.dumps(body, ensure_ascii=False))
            if requested_provider_enabled is False:
                print("[/api/recommend] provider_enabled=false requested by client; forcing provider_enabled=true by policy.")

            if not isinstance(inventory, list):
                self._send_error(400, "inventory must be a list")
                return

            normalized_inventory, preprocess_debug = _preprocess_inventory(inventory)

            try:
                top_k_int = int(requested_top_k)
            except (TypeError, ValueError):
                top_k_int = 8
            top_k = max(12, min(64, top_k_int))

            result = self._call_recommender(
                {
                    "inventory": normalized_inventory,
                    "restrictions": restrictions,
                    "top_k": top_k,
                    "debug": debug,
                    "provider_enabled": provider_enabled,
                },
                debug=bool(debug),
            )

            if isinstance(result, dict) and result.get("source") == "local_fallback":
                self._send_error(502, "Upstream provider fallback blocked by policy (source=local_fallback)")
                return

            if debug and isinstance(result, dict):
                existing_debug = result.get("debug")
                if not isinstance(existing_debug, dict):
                    existing_debug = {}
                existing_debug["preprocess"] = preprocess_debug
                result["debug"] = existing_debug

                print("[/api/recommend] upstream parsed response:")
                print(json.dumps(result, ensure_ascii=False))

            if isinstance(result, dict):
                recs = result.get("recommendations")
                if not isinstance(recs, list):
                    print("[/api/recommend] warning: upstream response has no recommendations array")
                elif debug and recs:
                    first = recs[0]
                    if isinstance(first, dict):
                        print("[/api/recommend] first recommendation keys:")
                        print(json.dumps(list(first.keys()), ensure_ascii=False))

            self._send_json(200, result)

        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON in request body")
        except UpstreamHTTPError as e:
            # Preserve upstream error semantics (4xx/5xx) instead of collapsing to 500.
            self._send_error(e.status, f"Upstream recommender returned {e.status}: {e.body}")
        except URLError as e:
            self._send_error(502, f"Recommender unreachable: {str(e)}")
        except Exception as e:
            self._send_error(500, f"Internal error: {str(e)}")

    def do_GET(self):
        self._send_json(200, {
            "status": "ok",
            "engine": "RecipeRec v2",
            "recommender_configured": bool(RECOMMENDER_URL),
            "recommender_url": RECOMMENDER_URL,
            "timeout_seconds": RECOMMENDER_TIMEOUT_SECONDS,
        })

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _send_error(self, status: int, message: str):
        self._send_json(status, {"error": message})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _call_recommender(self, payload: dict, debug: bool = False):
        data = json.dumps(payload).encode("utf-8")
        req = Request(
            RECOMMENDER_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(req, timeout=RECOMMENDER_TIMEOUT_SECONDS) as resp:
                resp_body = resp.read().decode("utf-8")
                if debug:
                    print("[/api/recommend] upstream raw response body:")
                    print(resp_body)
                return json.loads(resp_body) if resp_body else {}
        except HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else ""
            raise UpstreamHTTPError(e.code, body) from e


def _today_ymd() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _normalize_text(value: str) -> str:
    text = (value or "").lower()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = text.replace("…", " ")
    text = text.replace("...", " ")
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _looks_non_food(normalized_name: str) -> bool:
    text = _normalize_text(normalized_name)
    return any(hint in text for hint in NON_FOOD_HINTS)


def _normalize_item_name(raw_name: str) -> str:
    text = _normalize_text(raw_name)
    if not text:
        return ""

    for pattern, canonical in ALIASES:
        if pattern.search(text):
            return canonical

    tokens = [t for t in text.split(" ") if t and t not in DROP_TOKENS]
    tokens = [t for t in tokens if not re.fullmatch(r"\d+", t)]
    tokens = [t for t in tokens if not re.fullmatch(r"\d+[a-z]+", t)]

    if not tokens:
        return ""

    # Prefer meaningful tail token, but avoid weak OCR leftovers.
    weak_tail = {"item", "items", "grocery", "grocer", "natural", "balanced", "protein"}
    for token in reversed(tokens):
        if token not in weak_tail and len(token) >= 3:
            if token.endswith("s") and len(token) > 4:
                return token[:-1]
            return token

    return tokens[-1]


def _normalize_expiration_date(raw_date) -> str:
    if isinstance(raw_date, str):
        value = raw_date.strip()
    else:
        value = ""

    if not value:
        return _today_ymd()

    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", value)
    if m:
        return m.group(1)

    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        return _today_ymd()


def _normalize_category(raw_category) -> str:
    if not isinstance(raw_category, str):
        return "other"
    cat = raw_category.strip().lower()
    if cat in VALID_CATEGORIES:
        return cat
    return "other"


def _preprocess_inventory(inventory):
    cleaned = {}
    dropped_non_food = 0
    dropped_empty = 0

    for entry in inventory:
        if not isinstance(entry, dict):
            continue

        raw_name = str(entry.get("name", "")).strip()
        if not raw_name:
            dropped_empty += 1
            continue

        if _looks_non_food(raw_name):
            dropped_non_food += 1
            continue

        normalized_name = _normalize_item_name(raw_name)
        if not normalized_name:
            dropped_empty += 1
            continue

        normalized = {
            "name": normalized_name,
            "expiration_date": _normalize_expiration_date(entry.get("expiration_date")),
            "category": _normalize_category(entry.get("category")),
        }

        existing = cleaned.get(normalized_name)
        if existing is None:
            cleaned[normalized_name] = normalized
            continue

        # Keep earliest expiry when duplicate ingredient names exist.
        if normalized["expiration_date"] < existing["expiration_date"]:
            cleaned[normalized_name] = normalized

    normalized_inventory = sorted(cleaned.values(), key=lambda item: item["name"])

    # If filtering is too aggressive, fall back to a permissive pass.
    if len(normalized_inventory) < 3 and len(inventory) >= 3:
        permissive = []
        seen = set()
        for entry in inventory:
            if not isinstance(entry, dict):
                continue
            raw_name = str(entry.get("name", "")).strip()
            text = _normalize_text(raw_name)
            if not text or text in seen:
                continue
            seen.add(text)
            permissive.append(
                {
                    "name": text,
                    "expiration_date": _normalize_expiration_date(entry.get("expiration_date")),
                    "category": _normalize_category(entry.get("category")),
                }
            )
        if permissive:
            normalized_inventory = permissive

    preprocess_debug = {
        "input_count": len(inventory),
        "output_count": len(normalized_inventory),
        "dropped_non_food": dropped_non_food,
        "dropped_empty_or_noise": dropped_empty,
    }
    return normalized_inventory, preprocess_debug
