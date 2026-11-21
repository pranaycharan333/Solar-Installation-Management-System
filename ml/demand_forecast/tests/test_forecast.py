"""Behavior checks for the SolarOps demand forecast prototype."""
import json
from pathlib import Path
import unittest

from ml.demand_forecast import evaluate, forecast_records, load_history


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
EXAMPLE_REQUEST = Path(__file__).resolve().parents[1] / "examples" / "forecast_request.json"


class ForecastBehaviorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.request = json.loads(EXAMPLE_REQUEST.read_text(encoding="utf-8"))
        cls.records = cls.request["history"]

    def test_json_request_returns_reviewable_forecasts(self):
        results = forecast_records(self.records, self.request["horizon_months"])
        self.assertEqual(len(results), 9)
        self.assertEqual({row["forecast_period"] for row in results}, {"2026-11", "2026-12", "2027-01"})
        for row in results:
            self.assertTrue(row["demo_data"])
            self.assertTrue(row["review_needed"])
            self.assertIn("fallback_reason", row)
            self.assertGreaterEqual(row["predicted_quantity"], 0)

    def test_mixed_synthetic_history_stays_labeled_as_demo_data(self):
        material_id = self.records[0]["material_id"]
        material_rows = [dict(row) for row in self.records if row["material_id"] == material_id]
        material_rows[-1]["is_synthetic"] = False

        results = forecast_records(material_rows)

        self.assertTrue(all(row["demo_data"] for row in results))

    def test_validation_and_holdout_are_separate_chronological_windows(self):
        history = load_history(REPOSITORY_ROOT / "ml" / "demand_forecast" / "sample_history.csv")
        report = evaluate(history)[0]
        self.assertEqual(report["train_rows"], 24)
        self.assertEqual(report["validation_rows"], 6)
        self.assertEqual(report["validation_start"], "2025-11")
        self.assertEqual(report["holdout_start"], "2026-05")
        self.assertEqual(report["holdout_rows"], 6)

    def test_sparse_history_uses_mean_fallback(self):
        material_id = self.records[0]["material_id"]
        sparse = [row for row in self.records if row["material_id"] == material_id][:12]
        results = forecast_records(sparse)
        self.assertTrue(all(row["model"] == "training_mean" for row in results))
        self.assertTrue(all(row["fallback_reason"] == "insufficient_history" for row in results))

    def test_missing_month_uses_incomplete_history_fallback(self):
        material_id = self.records[0]["material_id"]
        material_rows = [row for row in self.records if row["material_id"] == material_id]
        del material_rows[10]
        results = forecast_records(material_rows)
        self.assertTrue(all(row["model"] == "training_mean" for row in results))
        self.assertTrue(all(row["fallback_reason"] == "incomplete_history" for row in results))

    def test_duplicate_material_month_is_rejected(self):
        material_id = self.records[0]["material_id"]
        material_rows = [row for row in self.records if row["material_id"] == material_id]
        with self.assertRaisesRegex(ValueError, "only one row per month"):
            forecast_records(material_rows + [material_rows[0]])

    def test_inconsistent_material_units_are_rejected(self):
        material_id = self.records[0]["material_id"]
        material_rows = [dict(row) for row in self.records if row["material_id"] == material_id]
        material_rows[-1]["unit"] = "box"
        with self.assertRaisesRegex(ValueError, "one consistent unit"):
            forecast_records(material_rows)

    def test_negative_usage_is_rejected(self):
        record = dict(self.records[0])
        record["quantity_used"] = -1
        with self.assertRaisesRegex(ValueError, "cannot be negative"):
            forecast_records([record])


if __name__ == "__main__":
    unittest.main()
