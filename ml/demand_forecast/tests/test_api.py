"""HTTP adapter checks using FastAPI's in-process test client."""
import json
from pathlib import Path
import unittest

from fastapi.testclient import TestClient

from ml.demand_forecast.api import app


EXAMPLE_REQUEST = Path(__file__).resolve().parents[1] / "examples" / "forecast_request.json"


class ForecastApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.request = json.loads(EXAMPLE_REQUEST.read_text(encoding="utf-8"))

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_forecast_endpoint_returns_reviewable_rows(self):
        response = self.client.post("/api/v1/forecast", json=self.request)
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 9)
        self.assertTrue(all(row["demo_data"] and row["review_needed"] for row in results))

    def test_invalid_horizon_has_documented_error_shape(self):
        request = dict(self.request, horizon_months=1.5)
        response = self.client.post("/api/v1/forecast", json=request)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "invalid_request")

    def test_invalid_history_has_documented_error_shape(self):
        request = json.loads(json.dumps(self.request))
        request["history"][0]["quantity_used"] = -1
        response = self.client.post("/api/v1/forecast", json=request)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "invalid_history")


if __name__ == "__main__":
    unittest.main()
