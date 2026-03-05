"""
Vercel Python Serverless Function — /api/recommend

Direct FatSecret integration (no RecipeRec proxy).
"""

import base64
import json
import os
import re
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

FATSECRET_OAUTH_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_TIMEOUT_SECONDS = float(os.getenv("FATSECRET_TIMEOUT_SECONDS", "20"))

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

CATEGORY_PRIORITY = {
    "protein": 0,
    "produce": 1,
    "dairy": 2,
    "grains": 3,
    "prepared": 4,
    "frozen": 5,
    "canned": 6,
    "snacks": 7,
    "condiments": 8,
    "beverages": 9,
    "other": 10,
}

DROP_TOKENS = {
    "fresh", "organic", "large", "small", "pack", "packs", "package", "bottle", "bottles",
    "jar", "bag", "bags", "lb", "lbs", "oz", "g", "kg", "ml", "l", "ct", "count",
    "piece", "pieces", "each", "bunch", "series", "now", "app", "ft", "f", "t", "pro",
    "brand", "value", "grocery", "grocer", "natural", "balanced", "food", "stick", "sticks",
}

NON_FOOD_HINTS = {
    "colgate", "toothpaste", "toothbrush", "mouthwash", "detergent", "soap", "shampoo", "conditioner",
    "deodorant", "lotion", "cleaner", "bleach", "purina", "litter",
}

ALIASES = [
    (re.compile(r"\\bbanana(s)?\\b"), "banana"),
    (re.compile(r"\\begg(s)?\\b"), "egg"),
    (re.compile(r"\\bonion(s)?\\b"), "onion"),
    (re.compile(r"\\bzucchini\\b"), "zucchini"),
    (re.compile(r"\\b(cara cara )?orange(s)?\\b"), "orange"),
    (re.compile(r"\\bmozzarella\\b"), "mozzarella"),
    (re.compile(r"\\bgreek yogurt\\b|\\byogurt\\b"), "yogurt"),
    (re.compile(r"\\bmilk\\b"), "milk"),
    (re.compile(r"\\bpork\\s*belly\\b|\\bporkbelly\\b"), "pork belly"),
    (re.compile(r"\\bsalmon(s)?\\b"), "salmon"),
    (re.compile(r"\\bchicken\\s*feet\\b"), "chicken"),
    (re.compile(r"\\bchicken\\b"), "chicken"),
    (re.compile(r"\\bwater\\b|\\bwate\\b"), "water"),
    (re.compile(r"\\bcoconut water\\b"), "coconut water"),
    (re.compile(r"\\bpasta\\b|\\blasagn[ea]\\b"), "pasta"),
    (re.compile(r"\\bcoca[\\s-]?cola\\b"), "coca cola"),
    (re.compile(r"\\bpepsi\\b"), "pepsi"),
    (re.compile(r"\\bpocky\\b"), "pocky"),
    (re.compile(r"\\bpop[\\s-]?tarts?\\b"), "pop tarts"),
    (re.compile(r"\\bcheese\\b"), "cheese"),
]

_token_cache = {"access_token": None, "expires_at": 0}


def _today_ymd() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _normalize_text(value: str) -> str:
    text = (value or "").lower()
    text = re.sub(r"\\([^)]*\\)", " ", text)
    text = text.replace("…", " ").replace("...", " ")
    text = re.sub(r"[^a-z0-9\\s-]", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
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
    tokens = [t for t in tokens if not re.fullmatch(r"\\d+", t)]
    tokens = [t for t in tokens if not re.fullmatch(r"\\d+[a-z]+", t)]
    if not tokens:
        return ""

    weak_tail = {"item", "items", "grocery", "grocer", "natural", "balanced", "protein", "food"}
    for token in reversed(tokens):
        if token not in weak_tail and len(token) >= 3:
            if token.endswith("s") and len(token) > 4:
                return token[:-1]
            return token

    return tokens[-1]


def _normalize_expiration_date(raw_date) -> str:
    value = raw_date.strip() if isinstance(raw_date, str) else ""
    if not value:
        return _today_ymd()

    m = re.search(r"\\b(\\d{4}-\\d{2}-\\d{2})\\b", value)
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
    return cat if cat in VALID_CATEGORIES else "other"


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
        if existing is None or normalized["expiration_date"] < existing["expiration_date"]:
            cleaned[normalized_name] = normalized

    normalized_inventory = sorted(
        cleaned.values(),
        key=lambda item: (
            item["expiration_date"],
            CATEGORY_PRIORITY.get(item["category"], 10),
            len(item["name"]),
            item["name"],
        ),
    )[:30]

    preprocess_debug = {
        "input_count": len(inventory),
        "output_count": len(normalized_inventory),
        "dropped_non_food": dropped_non_food,
        "dropped_empty_or_noise": dropped_empty,
    }
    return normalized_inventory, preprocess_debug


def _env(name: str, fallback: str | None = None):
    return os.getenv(name) or (os.getenv(fallback) if fallback else None)


def _fatsecret_client_id():
    return _env("FATSECRET_CLIENT_ID", "VITE_FATSECRET_CLIENT_ID")


def _fatsecret_client_secret():
    return _env("FATSECRET_CLIENT_SECRET", "VITE_FATSECRET_CLIENT_SECRET")


def _fatsecret_token() -> str:
    now = int(time.time())
    if _token_cache["access_token"] and now < int(_token_cache["expires_at"]):
        return _token_cache["access_token"]

    client_id = _fatsecret_client_id()
    client_secret = _fatsecret_client_secret()
    if not client_id or not client_secret:
        raise RuntimeError("Missing FATSECRET_CLIENT_ID/FATSECRET_CLIENT_SECRET")

    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
    body = urlencode({"grant_type": "client_credentials", "scope": "basic"}).encode("utf-8")
    req = Request(
        FATSECRET_OAUTH_URL,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic}",
        },
        method="POST",
    )

    with urlopen(req, timeout=FATSECRET_TIMEOUT_SECONDS) as resp:
        payload = json.loads(resp.read().decode("utf-8") or "{}")

    token = payload.get("access_token")
    expires_in = int(payload.get("expires_in", 300))
    if not token:
        raise RuntimeError("FatSecret token response missing access_token")

    _token_cache["access_token"] = token
    _token_cache["expires_at"] = now + max(expires_in - 30, 60)
    return token


def _fatsecret_search(search_expression: str, top_k: int):
    token = _fatsecret_token()
    methods = ["recipes.search.v3", "recipes.search.v2", "recipes.search"]
    last_error = None

    for method in methods:
        params = {
            "method": method,
            "search_expression": search_expression,
            "max_results": str(top_k),
            "page_number": "0",
            "format": "json",
        }
        url = f"{FATSECRET_API_URL}?{urlencode(params)}"
        req = Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
        try:
            with urlopen(req, timeout=FATSECRET_TIMEOUT_SECONDS) as resp:
                payload = json.loads(resp.read().decode("utf-8") or "{}")
            if "error" in payload:
                last_error = payload["error"]
                continue
            return payload
        except HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else ""
            last_error = {"status": e.code, "body": body}
        except URLError as e:
            raise RuntimeError(f"FatSecret unreachable: {str(e)}") from e

    raise RuntimeError(f"FatSecret search failed: {last_error}")


def _fatsecret_recipe_get(recipe_id: str):
    token = _fatsecret_token()
    methods = ["recipe.get.v2", "recipe.get"]
    last_error = None

    for method in methods:
        params = {
            "method": method,
            "recipe_id": str(recipe_id),
            "format": "json",
        }
        url = f"{FATSECRET_API_URL}?{urlencode(params)}"
        req = Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
        try:
            with urlopen(req, timeout=FATSECRET_TIMEOUT_SECONDS) as resp:
                payload = json.loads(resp.read().decode("utf-8") or "{}")
            if "error" in payload:
                last_error = payload["error"]
                continue
            return payload
        except HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else ""
            last_error = {"status": e.code, "body": body}
        except URLError as e:
            raise RuntimeError(f"FatSecret unreachable: {str(e)}") from e

    raise RuntimeError(f"FatSecret recipe.get failed: {last_error}")


def _extract_recipe_list(search_payload):
    recipes_obj = search_payload.get("recipes") if isinstance(search_payload, dict) else None
    if not isinstance(recipes_obj, dict):
        return []

    data = recipes_obj.get("recipe")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def _to_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str) and v.strip()]
    if isinstance(value, str):
        return [value] if value.strip() else []
    return []


def _to_dict_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def _first_non_empty(*values):
    for v in values:
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _extract_recipe_image(obj: dict):
    direct = _first_non_empty(obj.get("recipe_image"), obj.get("image_url"), obj.get("image"))
    if direct:
        return direct
    images = obj.get("recipe_images")
    if isinstance(images, dict):
        raw = images.get("recipe_image")
        if isinstance(raw, list):
            for item in raw:
                if isinstance(item, str) and item.strip():
                    return item.strip()
                if isinstance(item, dict):
                    nested = _first_non_empty(item.get("recipe_image"), item.get("image"), item.get("url"))
                    if nested:
                        return nested
        elif isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def _pick_bucket(category_text: str):
    low = (category_text or "").lower()
    if any(k in low for k in ["snack", "dessert", "beverage", "drink", "breakfast"]):
        return "quick_bites"
    return "main"


def _extract_recipe_types(recipe_obj: dict) -> list[str]:
    types_obj = recipe_obj.get("recipe_types")
    if isinstance(types_obj, dict):
        rt = types_obj.get("recipe_type")
        if isinstance(rt, list):
            return [str(v).strip() for v in rt if str(v).strip()]
        if isinstance(rt, str) and rt.strip():
            return [rt.strip()]
    raw = recipe_obj.get("recipe_type")
    if isinstance(raw, list):
        return [str(v).strip() for v in raw if str(v).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    return []


def _extract_ingredients(recipe_obj: dict) -> list[dict]:
    ingredients_obj = recipe_obj.get("ingredients")
    if not isinstance(ingredients_obj, dict):
        return []
    rows = _to_dict_list(ingredients_obj.get("ingredient"))
    out = []
    for row in rows:
        description = _first_non_empty(
            row.get("ingredient_description"),
            row.get("ingredient_name"),
            row.get("food_name"),
            row.get("measurement_description"),
        )
        if not description:
            continue
        out.append({
            "name": _first_non_empty(row.get("ingredient_name"), row.get("food_name"), description),
            "amount": _first_non_empty(row.get("number_of_units"), row.get("measurement_description"), row.get("quantity"), ""),
            "text": description,
        })
    return out


def _extract_directions(recipe_obj: dict) -> list[str]:
    directions_obj = recipe_obj.get("directions")
    if not isinstance(directions_obj, dict):
        return []
    rows = _to_dict_list(directions_obj.get("direction"))
    out = []
    for row in rows:
        text = _first_non_empty(row.get("direction_description"), row.get("instruction"), row.get("text"), "")
        if text:
            out.append(text)
    return out


def _extract_serving_info(recipe_obj: dict):
    serving_size = None
    calories = None

    serving_sizes_obj = recipe_obj.get("serving_sizes")
    if isinstance(serving_sizes_obj, dict):
        servings = _to_dict_list(serving_sizes_obj.get("serving"))
        if servings:
            first = servings[0]
            serving_size = _first_non_empty(
                first.get("serving_size"),
                first.get("serving_description"),
                first.get("metric_serving_amount"),
                first.get("number_of_units"),
            )
            cal_raw = first.get("calories")
            try:
                calories = int(float(str(cal_raw))) if cal_raw is not None else None
            except (TypeError, ValueError):
                calories = None

    if calories is None:
        cal_raw = recipe_obj.get("calories")
        try:
            calories = int(float(str(cal_raw))) if cal_raw is not None else None
        except (TypeError, ValueError):
            calories = None

    return serving_size, calories


def _map_recipe_detail(recipe_obj: dict):
    recipe_types = _extract_recipe_types(recipe_obj)
    recipe_type = recipe_types[0] if recipe_types else _first_non_empty(
        recipe_obj.get("recipe_type"),
        recipe_obj.get("recipe_category"),
        recipe_obj.get("category"),
        "",
    )
    serving_size, calories = _extract_serving_info(recipe_obj)
    ingredients = _extract_ingredients(recipe_obj)
    directions = _extract_directions(recipe_obj)

    return {
        "recipe_id": str(recipe_obj.get("recipe_id") or ""),
        "title": _first_non_empty(recipe_obj.get("recipe_name"), recipe_obj.get("title"), "Untitled"),
        "url": _first_non_empty(recipe_obj.get("recipe_url"), recipe_obj.get("url")),
        "image_url": _extract_recipe_image(recipe_obj),
        "description": _first_non_empty(recipe_obj.get("recipe_description"), recipe_obj.get("description"), ""),
        "prep_time": _first_non_empty(recipe_obj.get("preparation_time_min"), recipe_obj.get("prep_time"), ""),
        "cook_time": _first_non_empty(recipe_obj.get("cooking_time_min"), recipe_obj.get("cook_time"), ""),
        "serving_size": serving_size,
        "calories": calories,
        "recipe_type": recipe_type,
        "recipe_types": recipe_types,
        "ingredients": ingredients,
        "instructions": directions,
        "source": "fatsecret",
        "provider": "fatsecret",
    }


def _match_inventory_ingredients(recipe_text: str, inventory_names: list[str]):
    text = _normalize_text(recipe_text)
    matched = []
    for name in inventory_names:
        n = _normalize_text(name)
        if not n:
            continue
        if f" {n} " in f" {text} " or n in text:
            matched.append(name)
    return matched


def _build_recommendations(inventory, raw_recipes):
    inventory_names = [i["name"] for i in inventory]
    out = []

    for rec in raw_recipes:
        if not isinstance(rec, dict):
            continue

        title = _first_non_empty(rec.get("recipe_name"), rec.get("title"))
        if not title:
            continue

        desc = _first_non_empty(rec.get("recipe_description"), rec.get("description"), "")
        raw_category = _first_non_empty(rec.get("recipe_type"), rec.get("recipe_types"), rec.get("category"), rec.get("recipe_category"), "")
        recipe_text = f"{title} {desc} {raw_category}".strip()
        matched = _match_inventory_ingredients(recipe_text, inventory_names)

        if not matched:
            continue

        missing = [name for name in inventory_names if name not in matched]
        coverage = len(matched) / max(len(inventory_names), 1)
        score = round((len(matched) * 10) + (coverage * 100), 3)
        image_url = _extract_recipe_image(rec)

        out.append({
            "recipe_id": str(rec.get("recipe_id") or title),
            "title": title,
            "url": _first_non_empty(rec.get("recipe_url"), rec.get("url")),
            "image_url": image_url,
            "description": desc,
            "time_minutes": _first_non_empty(rec.get("preparation_time_min"), rec.get("cooking_time_min"), rec.get("time_minutes")),
            "instructions": [],
            "bucket": _pick_bucket(raw_category),
            "score": score,
            "coverage": coverage,
            "matched": matched,
            "missing": missing,
            "reasons": [f"Matched {len(matched)} inventory ingredients"],
            "violations": [],
            "category": raw_category,
            "recipe_category": raw_category,
            "source": "fatsecret",
            "provider": "fatsecret",
        })

    out.sort(key=lambda r: (len(r.get("matched", [])), r.get("coverage", 0), r.get("score", 0)), reverse=True)

    deduped = []
    seen = set()
    for rec in out:
        key = str(rec.get("recipe_id") or rec.get("title") or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(rec)

    return deduped


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            detail_recipe_id = body.get("recipe_id")
            if isinstance(detail_recipe_id, str) and detail_recipe_id.strip():
                normalized_id = detail_recipe_id.strip()
                if normalized_id.lower().startswith("fatsecret:"):
                    normalized_id = normalized_id.split(":", 1)[1]
                detail_payload = _fatsecret_recipe_get(normalized_id)
                recipe_obj = detail_payload.get("recipe")
                if not isinstance(recipe_obj, dict):
                    self._send_error(502, "FatSecret recipe.get response missing recipe object")
                    return
                mapped_detail = _map_recipe_detail(recipe_obj)
                self._send_json(200, {
                    "mode": "detail",
                    "source": "fatsecret",
                    "recipe": mapped_detail,
                    "debug": {
                        "requested_recipe_id": detail_recipe_id,
                        "normalized_recipe_id": normalized_id,
                    },
                })
                return

            inventory = body.get("inventory", [])
            restrictions = body.get("restrictions", [])
            requested_top_k = body.get("top_k", 8)
            debug = bool(body.get("debug", False))

            if not isinstance(inventory, list):
                self._send_error(400, "inventory must be a list")
                return

            normalized_inventory, preprocess_debug = _preprocess_inventory(inventory)
            if not normalized_inventory:
                self._send_json(200, {
                    "mode": "empty_fridge",
                    "source": "fatsecret",
                    "source_note": "No valid food inventory",
                    "inventory_summary": {
                        "unique_items_count": 0,
                        "expiring_soon_count": 0,
                        "expiring_soon_items": [],
                    },
                    "recommendations": [],
                    "shopping_list": [],
                    "debug": {"preprocess": preprocess_debug, "restrictions": restrictions},
                })
                return

            try:
                top_k_int = int(requested_top_k)
            except (TypeError, ValueError):
                top_k_int = 8
            top_k = max(8, min(50, top_k_int))

            search_terms = [i["name"] for i in normalized_inventory][:8]
            search_expression = " ".join(search_terms)

            raw_payload = _fatsecret_search(search_expression, top_k)
            raw_recipes = _extract_recipe_list(raw_payload)
            mapped = _build_recommendations(normalized_inventory, raw_recipes)[:top_k]

            expiring_soon = [i["name"] for i in normalized_inventory[:10]]
            mode = "abundant" if len(normalized_inventory) >= 6 else "low_stock"

            result = {
                "mode": mode,
                "source": "fatsecret",
                "source_note": f"expr='{search_expression}'",
                "inventory_summary": {
                    "unique_items_count": len(normalized_inventory),
                    "expiring_soon_count": len(expiring_soon),
                    "expiring_soon_items": expiring_soon,
                },
                "recommendations": mapped,
                "shopping_list": [],
            }

            if debug:
                result["debug"] = {
                    "preprocess": preprocess_debug,
                    "search_expression": search_expression,
                    "search_terms": search_terms,
                    "raw_recipe_count": len(raw_recipes),
                    "mapped_recipe_count": len(mapped),
                    "restrictions": restrictions,
                }

            self._send_json(200, result)

        except HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else ""
            self._send_error(e.code, f"FatSecret HTTP error: {body}")
        except URLError as e:
            self._send_error(502, f"FatSecret unreachable: {str(e)}")
        except Exception as e:
            self._send_error(500, f"Internal error: {str(e)}")

    def do_GET(self):
        configured = bool(_fatsecret_client_id() and _fatsecret_client_secret())
        self._send_json(200, {
            "status": "ok",
            "engine": "fatsecret-direct",
            "fatsecret_configured": configured,
            "timeout_seconds": FATSECRET_TIMEOUT_SECONDS,
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
