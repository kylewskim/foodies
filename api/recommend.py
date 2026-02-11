"""
Vercel Python Serverless Function — /api/recommend

Wraps the RecipeRec engine (https://github.com/TanLaura/RecipeRec).

POST /api/recommend
Body: {
  "inventory": [{"name": "Eggs", "expiration_date": "2026-02-12"}, ...],
  "restrictions": ["allergy_nuts", "diet_vegan"],
  "top_k": 8,
  "debug": false
}
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
from pathlib import Path

# Add api directory to path for local imports
API_DIR = Path(__file__).parent
sys.path.insert(0, str(API_DIR))

from core.engine import recommend


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

            inventory = body.get("inventory", [])
            restrictions = body.get("restrictions", [])
            top_k = body.get("top_k", 8)
            debug = body.get("debug", False)

            if not isinstance(inventory, list):
                self._send_error(400, "inventory must be a list")
                return

            # Call engine with correct paths relative to api/ directory
            result = recommend(
                inventory_payload=inventory,
                restrictions=restrictions,
                top_k=top_k,
                debug=debug,
                data_path=API_DIR / "data" / "df_parsed.csv",
                restrictions_path=API_DIR / "config" / "restrictions.json",
                policy_path=API_DIR / "config" / "policy.json",
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
