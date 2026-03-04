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
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

RECOMMENDER_URL = os.getenv("RECOMMENDER_URL", "https://reciperec.onrender.com/recommend")
RECOMMENDER_TIMEOUT_SECONDS = float(os.getenv("RECOMMENDER_TIMEOUT_SECONDS", "15"))


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            inventory = body.get("inventory", [])
            restrictions = body.get("restrictions", [])
            top_k = body.get("top_k", 8)
            debug = body.get("debug", False)
            provider_enabled = body.get("provider_enabled", True)

            if not isinstance(inventory, list):
                self._send_error(400, "inventory must be a list")
                return

            result = self._call_recommender(
                {
                    "inventory": inventory,
                    "restrictions": restrictions,
                    "top_k": top_k,
                    "debug": debug,
                    "provider_enabled": provider_enabled,
                }
            )

            self._send_json(200, result)

        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON in request body")
        except Exception as e:
            self._send_error(500, f"Internal error: {str(e)}")

    def do_GET(self):
        self._send_json(200, {
            "status": "ok",
            "engine": "RecipeRec v2",
        })

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
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

    def _call_recommender(self, payload: dict):
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
                return json.loads(resp_body) if resp_body else {}
        except HTTPError as e:
            body = e.read().decode("utf-8") if hasattr(e, "read") else ""
            raise RuntimeError(f"Recommender error {e.code}: {body}") from e
        except URLError as e:
            raise RuntimeError(f"Recommender unreachable: {e}") from e
