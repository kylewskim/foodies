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
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

FATSECRET_OAUTH_URL = "https://oauth.fatsecret.com/connect/token"
FATSECRET_API_URL = "https://platform.fatsecret.com/rest/server.api"
FATSECRET_TIMEOUT_SECONDS = float(os.getenv("FATSECRET_TIMEOUT_SECONDS", "20"))

BLENDED_PASS_TERMS = 8
ANCHOR_PASS_COUNT = 3
ANCHOR_PASS_TERMS = 4
RECOVERY_PASS_TERMS = 8
DETAIL_FETCH_CAP = 16
SEARCH_RESULT_CAP = 24
SUPPORT_INGREDIENTS = {
    "egg", "onion", "garlic", "salt", "pepper", "oil", "butter",
    "water", "flour", "sugar", "milk",
}

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
    (re.compile(r"\bcoconut water\b"), "coconut water"),
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
    (re.compile(r"\bchicken\s*feet\b"), "chicken"),
    (re.compile(r"\bchicken\b"), "chicken"),
    (re.compile(r"\bwater\b|\bwate\b"), "water"),
    (re.compile(r"\bpasta\b|\blasagn[ea]\b"), "pasta"),
    (re.compile(r"\bcoca[\s-]?cola\b"), "coca cola"),
    (re.compile(r"\bpepsi\b"), "pepsi"),
    (re.compile(r"\bpocky\b"), "pocky"),
    (re.compile(r"\bpop[\s-]?tarts?\b"), "pop tarts"),
    (re.compile(r"\bcheese\b"), "cheese"),
]

_token_cache = {"access_token": None, "expires_at": 0}


def _today_ymd() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _today_date():
    return datetime.now(timezone.utc).date()


def _now_perf() -> float:
    return time.perf_counter()


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000, 3)


def _normalize_text(value: str) -> str:
    text = (value or "").lower()
    text = re.sub(r"\([^)]*\)", " ", text)
    text = text.replace("…", " ").replace("...", " ")
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

    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", value)
    if m:
        return m.group(1)

    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.date().isoformat()
    except ValueError:
        return _today_ymd()


def _parse_ymd(value: str):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return _today_date()


def _days_until_expiration(expiration_date: str) -> int:
    return (_parse_ymd(expiration_date) - _today_date()).days


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


def _env(name: str, fallback: Optional[str] = None):
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
    if isinstance(types_obj, list):
        return [str(v).strip() for v in types_obj if str(v).strip()]

    raw = recipe_obj.get("recipe_type")
    if isinstance(raw, list):
        return [str(v).strip() for v in raw if str(v).strip()]
    if isinstance(raw, str) and raw.strip():
        return [raw.strip()]
    return []


def _extract_primary_recipe_type(recipe_obj: dict) -> str:
    types = _extract_recipe_types(recipe_obj)
    if types:
        return types[0]
    return _first_non_empty(
        recipe_obj.get("recipe_type"),
        recipe_obj.get("recipe_category"),
        recipe_obj.get("category"),
        "",
    )


def _extract_ingredients(recipe_obj: dict) -> list[dict]:
    ingredients_obj = recipe_obj.get("ingredients")
    if isinstance(ingredients_obj, list):
        out = []
        for row in ingredients_obj:
            if isinstance(row, str) and row.strip():
                out.append({"name": row.strip(), "amount": "", "text": row.strip()})
            elif isinstance(row, dict):
                description = _first_non_empty(
                    row.get("text"),
                    row.get("ingredient_description"),
                    row.get("ingredient_name"),
                    row.get("food_name"),
                    row.get("name"),
                    row.get("measurement_description"),
                )
                if not description:
                    continue
                out.append({
                    "name": _first_non_empty(row.get("name"), row.get("ingredient_name"), row.get("food_name"), description),
                    "amount": _first_non_empty(row.get("amount"), row.get("number_of_units"), row.get("measurement_description"), row.get("quantity"), ""),
                    "text": description,
                })
        return out

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
    if isinstance(directions_obj, list):
        return [str(v).strip() for v in directions_obj if str(v).strip()]
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


def _contains_term(text: str, term: str) -> bool:
    normalized_text = _normalize_text(text)
    normalized_term = _normalize_text(term)
    if not normalized_text or not normalized_term:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(normalized_term)}(?![a-z0-9])", normalized_text) is not None


def _recipe_key(recipe_obj: dict) -> str:
    return str(recipe_obj.get("recipe_id") or recipe_obj.get("title") or recipe_obj.get("recipe_name") or "").strip().lower()


def _inventory_names(inventory) -> list[str]:
    return [item["name"] for item in inventory]


def _build_inventory_context(inventory):
    context = {}
    total = len(inventory)
    for index, item in enumerate(inventory):
        days_until = _days_until_expiration(item["expiration_date"])
        urgency_window = max(0, 30 - min(max(days_until, -7), 30))
        rank_weight = max(1, total - index)
        expiry_weight = float(urgency_window + (rank_weight * 2))
        context[item["name"]] = {
            "expiration_date": item["expiration_date"],
            "days_until_expiration": days_until,
            "expiry_rank": index,
            "expiry_weight": expiry_weight,
            "category": item["category"],
        }
    return context


def _dedupe_terms(terms, limit):
    out = []
    seen = set()
    for term in terms:
        normalized = _normalize_text(term)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(term)
        if len(out) >= limit:
            break
    return out


def _make_search_pass(label: str, kind: str, terms, anchor_terms=None):
    deduped = _dedupe_terms(terms, BLENDED_PASS_TERMS)
    if len(deduped) == 0:
        return None
    return {
        "label": label,
        "kind": kind,
        "terms": deduped,
        "expression": " ".join(deduped),
        "anchor_terms": _dedupe_terms(anchor_terms or [], ANCHOR_PASS_TERMS),
    }


def _build_search_passes(inventory):
    names = _inventory_names(inventory)
    if not names:
        return []

    passes = []
    passes.append(_make_search_pass("blended", "blended", names[:BLENDED_PASS_TERMS]))

    for anchor_index in range(min(ANCHOR_PASS_COUNT, len(names))):
        anchor = names[anchor_index]
        terms = [anchor]

        preferred_indexes = [
            anchor_index + 1,
            anchor_index + 3,
            BLENDED_PASS_TERMS + anchor_index,
            anchor_index + 5,
        ]
        for preferred_index in preferred_indexes:
            if preferred_index < len(names):
                terms.append(names[preferred_index])

        for name in names:
            if len(_dedupe_terms(terms, ANCHOR_PASS_TERMS)) >= ANCHOR_PASS_TERMS:
                break
            terms.append(name)

        passes.append(
            _make_search_pass(
                f"expiry_anchor_{anchor_index + 1}",
                "expiry_anchor",
                terms[:ANCHOR_PASS_TERMS],
                [anchor],
            )
        )

    recovery_terms = names[BLENDED_PASS_TERMS:BLENDED_PASS_TERMS + RECOVERY_PASS_TERMS]
    if len(recovery_terms) == 0:
        recovery_terms = names[max(0, len(names) - RECOVERY_PASS_TERMS):]
    passes.append(_make_search_pass("coverage_recovery", "recovery", recovery_terms))

    deduped_passes = []
    seen_expressions = set()
    for pass_def in passes:
        if not pass_def:
            continue
        expr = pass_def["expression"]
        if not expr or expr in seen_expressions:
            continue
        seen_expressions.add(expr)
        deduped_passes.append(pass_def)
    return deduped_passes


def _match_inventory_from_texts(texts, inventory_names):
    matched = []
    normalized_texts = [_normalize_text(text) for text in texts if _normalize_text(text)]
    for name in inventory_names:
        normalized_name = _normalize_text(name)
        if not normalized_name:
            continue
        if any(_contains_term(text, normalized_name) for text in normalized_texts):
            matched.append(name)
    return matched


def _fallback_match_recipe(recipe_obj: dict, inventory_names: list[str]):
    title = _first_non_empty(recipe_obj.get("recipe_name"), recipe_obj.get("title"), "")
    desc = _first_non_empty(recipe_obj.get("recipe_description"), recipe_obj.get("description"), "")
    category = _extract_primary_recipe_type(recipe_obj)
    texts = [title, desc, category]
    return _match_inventory_from_texts(texts, inventory_names)


def _detail_match_recipe(recipe_obj: dict, inventory_names: list[str]):
    ingredients = _extract_ingredients(recipe_obj)
    ingredient_texts = []
    for row in ingredients:
        if isinstance(row, dict):
            ingredient_texts.append(_first_non_empty(row.get("text"), row.get("name"), ""))
    ingredient_texts = [text for text in ingredient_texts if text]
    if len(ingredient_texts) == 0:
        return []
    return _match_inventory_from_texts(ingredient_texts, inventory_names)


def _search_candidate_priority(candidate):
    return (
        -candidate["pass_hits"],
        -len(candidate["anchor_terms"]),
        -len(candidate["search_matched"]),
        candidate["best_rank"],
        -candidate["rank_credit"],
    )


def _run_search_passes(inventory, top_k: int):
    started_at = _now_perf()
    search_passes = _build_search_passes(inventory)
    search_limit = max(12, min(SEARCH_RESULT_CAP, top_k))
    inventory_names = _inventory_names(inventory)
    raw_recipe_total = 0
    candidates = {}
    pass_debug = []

    for pass_def in search_passes:
        pass_started_at = _now_perf()
        payload = _fatsecret_search(pass_def["expression"], search_limit)
        raw_recipes = _extract_recipe_list(payload)
        raw_recipe_total += len(raw_recipes)
        pass_debug.append({
            "label": pass_def["label"],
            "kind": pass_def["kind"],
            "expression": pass_def["expression"],
            "result_count": len(raw_recipes),
            "anchor_terms": pass_def["anchor_terms"],
            "duration_ms": _elapsed_ms(pass_started_at),
        })

        for rank, rec in enumerate(raw_recipes):
            if not isinstance(rec, dict):
                continue

            key = _recipe_key(rec)
            if not key:
                continue

            candidate = candidates.get(key)
            if candidate is None:
                fallback_matched = _fallback_match_recipe(rec, inventory_names)
                candidate = {
                    "search_recipe": rec,
                    "pass_set": set(),
                    "pass_labels": [],
                    "pass_hits": 0,
                    "anchor_terms": set(),
                    "best_rank": rank,
                    "rank_credit": 0,
                    "search_matched": set(fallback_matched),
                    "detail_recipe": None,
                }
                candidates[key] = candidate
            else:
                candidate["search_matched"].update(_fallback_match_recipe(rec, inventory_names))

            if pass_def["label"] not in candidate["pass_set"]:
                candidate["pass_set"].add(pass_def["label"])
                candidate["pass_labels"].append(pass_def["label"])
                candidate["pass_hits"] += 1
                candidate["anchor_terms"].update(pass_def["anchor_terms"])
                candidate["rank_credit"] += max(0, search_limit - rank)
                candidate["best_rank"] = min(candidate["best_rank"], rank)

            current_image = _extract_recipe_image(candidate["search_recipe"])
            incoming_image = _extract_recipe_image(rec)
            if not current_image and incoming_image:
                candidate["search_recipe"] = rec

    ordered_candidates = sorted(candidates.values(), key=_search_candidate_priority)
    timing = {
        "total_ms": _elapsed_ms(started_at),
        "pass_count": len(search_passes),
        "search_limit": search_limit,
    }
    return ordered_candidates, search_passes, pass_debug, raw_recipe_total, timing


def _fetch_candidate_details(candidates):
    started_at = _now_perf()
    tried = 0
    succeeded = 0
    failures = 0
    detail_timings = []
    for candidate in candidates[:DETAIL_FETCH_CAP]:
        recipe_id = str(candidate["search_recipe"].get("recipe_id") or "").strip()
        if not recipe_id:
            continue
        tried += 1
        detail_started_at = _now_perf()
        try:
            payload = _fatsecret_recipe_get(recipe_id)
            recipe_obj = payload.get("recipe")
            if not isinstance(recipe_obj, dict):
                failures += 1
                continue
            candidate["detail_recipe"] = _map_recipe_detail(recipe_obj)
            succeeded += 1
            detail_timings.append({
                "recipe_id": recipe_id,
                "duration_ms": _elapsed_ms(detail_started_at),
                "status": "ok",
            })
        except Exception:
            candidate["detail_recipe"] = None
            failures += 1
            detail_timings.append({
                "recipe_id": recipe_id,
                "duration_ms": _elapsed_ms(detail_started_at),
                "status": "error",
            })
    total_ms = _elapsed_ms(started_at)
    return {
        "tried": tried,
        "succeeded": succeeded,
        "failed": failures,
        "total_ms": total_ms,
        "avg_ms": round(total_ms / tried, 3) if tried else 0.0,
        "samples": detail_timings[: min(len(detail_timings), 8)],
    }


def _evaluate_candidate(candidate, inventory_context, inventory_names):
    detail_recipe = candidate.get("detail_recipe")
    matched = []
    matched_via = "fallback"
    if isinstance(detail_recipe, dict):
        matched = _detail_match_recipe(detail_recipe, inventory_names)
        if matched:
            matched_via = "detail"

    if len(matched) == 0:
        source = detail_recipe if isinstance(detail_recipe, dict) else candidate["search_recipe"]
        matched = _fallback_match_recipe(source, inventory_names)

    if len(matched) == 0:
        return None

    matched = sorted(set(matched), key=lambda name: inventory_context.get(name, {}).get("expiry_rank", 999))
    missing = [name for name in inventory_names if name not in matched]
    coverage = len(matched) / max(len(inventory_names), 1)
    expiry_score = sum(inventory_context.get(name, {}).get("expiry_weight", 0.0) for name in matched)
    coverage_score = (len(matched) * 18.0) + (coverage * 100.0)
    multi_bonus = 36.0 if len(matched) >= 3 else (10.0 if len(matched) == 2 else 0.0)
    pass_bonus = (candidate["pass_hits"] * 10.0) + max(0.0, 18.0 - (candidate["best_rank"] * 2.0))
    anchor_bonus = sum(inventory_context.get(name, {}).get("expiry_weight", 0.0) * 0.2 for name in matched if name in candidate["anchor_terms"])
    base_score = round((expiry_score * 6.0) + coverage_score + multi_bonus + pass_bonus + anchor_bonus, 3)

    candidate["matched"] = matched
    candidate["missing"] = missing
    candidate["coverage"] = coverage
    candidate["base_score"] = base_score
    candidate["matched_via"] = matched_via
    return candidate


def _representative_ingredient(candidate, ingredient_frequency, inventory_context):
    matched = candidate.get("matched", [])
    if len(matched) == 0:
        return None
    eligible = [name for name in matched if name not in SUPPORT_INGREDIENTS]
    pool = eligible or matched
    return min(
        pool,
        key=lambda name: (
            ingredient_frequency.get(name, 0),
            inventory_context.get(name, {}).get("expiry_rank", 999),
            len(name),
            name,
        ),
    )


def _build_candidate_response(candidate, inventory_context):
    search_recipe = candidate["search_recipe"]
    detail_recipe = candidate.get("detail_recipe") or {}
    recipe = detail_recipe if isinstance(detail_recipe, dict) and detail_recipe else search_recipe
    raw_category = _extract_primary_recipe_type(recipe)
    recipe_types = _extract_recipe_types(recipe)
    image_url = _extract_recipe_image(detail_recipe) or _extract_recipe_image(search_recipe)
    if not image_url:
        return None

    matched = candidate.get("matched", [])
    expiring_prioritized = matched[:3]
    reasons = [f"Uses {len(matched)} of your ingredients"]
    if expiring_prioritized:
        reasons.append(f"Prioritizes expiring items: {', '.join(expiring_prioritized)}")
    if candidate.get("matched_via") == "detail":
        reasons.append("Verified against recipe ingredients")

    return {
        "recipe_id": str(recipe.get("recipe_id") or search_recipe.get("recipe_id") or recipe.get("title") or search_recipe.get("title") or ""),
        "title": _first_non_empty(recipe.get("title"), recipe.get("recipe_name"), search_recipe.get("recipe_name"), search_recipe.get("title"), "Untitled"),
        "url": _first_non_empty(recipe.get("url"), recipe.get("recipe_url"), search_recipe.get("recipe_url"), search_recipe.get("url")),
        "image_url": image_url,
        "description": _first_non_empty(recipe.get("description"), recipe.get("recipe_description"), search_recipe.get("recipe_description"), search_recipe.get("description"), ""),
        "prep_time": _first_non_empty(recipe.get("prep_time"), recipe.get("preparation_time_min"), search_recipe.get("preparation_time_min"), search_recipe.get("prep_time")),
        "cook_time": _first_non_empty(recipe.get("cook_time"), recipe.get("cooking_time_min"), search_recipe.get("cooking_time_min"), search_recipe.get("cook_time")),
        "time_minutes": _first_non_empty(recipe.get("time_minutes"), recipe.get("prep_time"), recipe.get("cook_time"), search_recipe.get("time_minutes")),
        "serving_size": _first_non_empty(recipe.get("serving_size"), recipe.get("serving")),
        "calories": recipe.get("calories"),
        "ingredients": _extract_ingredients(recipe),
        "instructions": _extract_directions(recipe) if not isinstance(recipe.get("instructions"), list) else recipe.get("instructions"),
        "bucket": _pick_bucket(raw_category),
        "score": round(candidate.get("score", candidate.get("base_score", 0.0)), 3),
        "coverage": candidate.get("coverage", 0.0),
        "matched": matched,
        "missing": candidate.get("missing", []),
        "reasons": reasons,
        "violations": [],
        "category": raw_category,
        "recipe_category": raw_category,
        "recipe_type": _first_non_empty(recipe.get("recipe_type"), raw_category),
        "recipe_types": recipe_types,
        "source": "fatsecret",
        "provider": "fatsecret",
    }


def _greedy_rerank(candidates, inventory_context, top_k: int):
    remaining = [candidate for candidate in candidates if candidate.get("matched")]
    selected = []
    representative_counts = {}
    ingredient_selected_counts = {}
    last_representative = None
    diversity_summary = []

    while remaining and len(selected) < top_k:
        best_index = None
        best_final_score = None
        best_breakdown = None

        for index, candidate in enumerate(remaining):
            representative = candidate.get("representative_ingredient")
            recovery_bonus = 0.0
            for ingredient in candidate.get("matched", []):
                if ingredient_selected_counts.get(ingredient, 0) == 0:
                    recovery_bonus += min(24.0, 4.0 + (inventory_context.get(ingredient, {}).get("expiry_weight", 0.0) * 0.35))

            diversity_penalty = 0.0
            if representative:
                diversity_penalty += representative_counts.get(representative, 0) * 22.0
                if representative == last_representative:
                    diversity_penalty += 16.0

            overlap_penalty = 0.0
            if selected and candidate.get("matched"):
                previous = set(selected[-1].get("matched", []))
                overlap = len(previous.intersection(candidate["matched"])) / max(len(set(candidate["matched"])), 1)
                if overlap >= 0.75:
                    overlap_penalty = 10.0

            final_score = candidate.get("base_score", 0.0) + recovery_bonus - diversity_penalty - overlap_penalty
            if best_final_score is None or final_score > best_final_score:
                best_index = index
                best_final_score = final_score
                best_breakdown = {
                    "recovery_bonus": round(recovery_bonus, 3),
                    "diversity_penalty": round(diversity_penalty + overlap_penalty, 3),
                }

        chosen = remaining.pop(best_index)
        chosen["score"] = round(best_final_score, 3)
        chosen["selection_breakdown"] = best_breakdown
        selected.append(chosen)

        representative = chosen.get("representative_ingredient")
        if representative:
            representative_counts[representative] = representative_counts.get(representative, 0) + 1
            last_representative = representative
        else:
            last_representative = None

        for ingredient in chosen.get("matched", []):
            ingredient_selected_counts[ingredient] = ingredient_selected_counts.get(ingredient, 0) + 1

        diversity_summary.append({
            "title": _first_non_empty(chosen["search_recipe"].get("recipe_name"), chosen["search_recipe"].get("title"), "Untitled"),
            "representative_ingredient": representative,
            "recovery_bonus": chosen["selection_breakdown"]["recovery_bonus"],
            "diversity_penalty": chosen["selection_breakdown"]["diversity_penalty"],
            "final_score": chosen["score"],
        })

    return selected, diversity_summary


def _build_recommendations(inventory, top_k: int):
    started_at = _now_perf()
    inventory_names = _inventory_names(inventory)
    inventory_context_started_at = _now_perf()
    inventory_context = _build_inventory_context(inventory)
    inventory_context_timing = {"total_ms": _elapsed_ms(inventory_context_started_at)}

    search_started_at = _now_perf()
    candidates, search_passes, pass_debug, raw_recipe_total, search_timing = _run_search_passes(inventory, top_k)
    search_timing["wrapper_ms"] = _elapsed_ms(search_started_at)

    detail_started_at = _now_perf()
    detail_fetch = _fetch_candidate_details(candidates)
    detail_fetch["wrapper_ms"] = _elapsed_ms(detail_started_at)

    evaluation_started_at = _now_perf()
    evaluated = []
    for candidate in candidates:
        evaluated_candidate = _evaluate_candidate(candidate, inventory_context, inventory_names)
        if evaluated_candidate is not None:
            evaluated.append(evaluated_candidate)
    evaluation_timing = {
        "total_ms": _elapsed_ms(evaluation_started_at),
        "evaluated_count": len(evaluated),
    }

    representative_started_at = _now_perf()
    ingredient_frequency = {}
    for candidate in evaluated:
        for ingredient in candidate.get("matched", []):
            ingredient_frequency[ingredient] = ingredient_frequency.get(ingredient, 0) + 1

    for candidate in evaluated:
        candidate["representative_ingredient"] = _representative_ingredient(candidate, ingredient_frequency, inventory_context)
    representative_timing = {"total_ms": _elapsed_ms(representative_started_at)}

    rerank_started_at = _now_perf()
    selected_candidates, diversity_summary = _greedy_rerank(evaluated, inventory_context, top_k)
    rerank_timing = {
        "total_ms": _elapsed_ms(rerank_started_at),
        "selected_candidate_count": len(selected_candidates),
    }

    response_build_started_at = _now_perf()
    mapped = []
    dropped_no_image = 0
    for candidate in selected_candidates:
        mapped_recipe = _build_candidate_response(candidate, inventory_context)
        if mapped_recipe is None:
            dropped_no_image += 1
            continue
        mapped.append(mapped_recipe)
        if len(mapped) >= top_k:
            break
    response_build_timing = {
        "total_ms": _elapsed_ms(response_build_started_at),
        "mapped_count": len(mapped),
    }

    debug = {
        "search_expressions": pass_debug,
        "detail_fetch_count": detail_fetch,
        "candidate_count_before_after_dedupe": {
            "before": raw_recipe_total,
            "after": len(candidates),
            "evaluated": len(evaluated),
            "selected": len(mapped),
        },
        "diversity_penalty_summary": diversity_summary[: min(len(diversity_summary), 12)],
        "dropped_no_image": dropped_no_image,
        "timings_ms": {
            "inventory_context": inventory_context_timing,
            "search": search_timing,
            "detail_fetch": detail_fetch,
            "evaluation": evaluation_timing,
            "representative_selection": representative_timing,
            "rerank": rerank_timing,
            "response_build": response_build_timing,
            "total": {
                "total_ms": _elapsed_ms(started_at),
            },
        },
        "inventory_weights": {
            name: {
                "expiry_rank": meta["expiry_rank"],
                "days_until_expiration": meta["days_until_expiration"],
                "expiry_weight": round(meta["expiry_weight"], 3),
            }
            for name, meta in inventory_context.items()
        },
    }

    return mapped, debug, search_passes


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            request_started_at = _now_perf()
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

            mapped, ranking_debug, search_passes = _build_recommendations(normalized_inventory, top_k)
            expiring_soon = [item["name"] for item in normalized_inventory[:10]]
            mode = "abundant" if len(normalized_inventory) >= 6 else "low_stock"

            result = {
                "mode": mode,
                "source": "fatsecret",
                "source_note": f"passes={len(search_passes)}",
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
                    "restrictions": restrictions,
                    "request_total_ms": _elapsed_ms(request_started_at),
                    **ranking_debug,
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
