# Forecast backend handoff

This note describes Chandra's current model interface for review. The names and aggregation choices below are **proposals**, not an agreed API contract. Bharath should confirm them against the database schema and shared API contract before integration.

## What the forecast needs

The current prototype expects monthly historical usage with one row per material per month:

| Field | Meaning | Current expectation |
|---|---|---|
| `usage_month` | Month when material was used | `YYYY-MM`; one row per month |
| `material_id` | Stable inventory identifier | Treat as text; preserve leading zeroes |
| `material_name` | Display name | Non-empty text |
| `quantity_used` | Quantity actually consumed | Non-negative finite number |
| `unit` | Canonical measure for the material | Must stay consistent for each material |
| `is_synthetic` | Whether the source data is invented for a demo | `true` or `false` |

The prototype currently treats `quantity_used` as actual usage, not the planned quantity in an estimate. Data must be aggregated to this grain before it enters the model. If the database stores usage per project or per stock movement, the backend or an agreed data-preparation step should aggregate it by month and material.

## Python call

From the repository root, the current callable entry points are:

```python
from ml.demand_forecast import evaluate, forecast, forecast_records

metrics = evaluate(history_dataframe)
results = forecast(history_dataframe, horizon_months=3)
# Or pass JSON-style records from a backend request:
results = forecast_records(request["history"], horizon_months=3)
```

`history_dataframe` must use the fields above and contain parsed monthly usage rows. `forecast()` returns one result per material and forecast month. It selects a candidate using a six-month chronological validation window, then reports its score on a separate, later six-month holdout; with fewer than 24 rows for a material, it falls back to the historical mean. This choice is a prototype rule, not yet a production model-selection policy.

## Provisional result shape

```json
{
  "material_id": "MAT-PANEL-001",
  "forecast_period": "2026-11",
  "predicted_quantity": 147.21,
  "unit": "piece",
  "model": "linear_regression",
  "model_version": "1.0.0",
  "demo_data": true,
  "review_needed": true
}
```

The generated example is in `examples/forecast_response.json`. All forecast values remain advisory. The backend must continue to calculate stock balances, reorder quantities, prices, and purchase orders from authoritative records and business rules.

## Confirm with Bharath

1. Is monthly actual usage the right target, and what database events count as material used?
2. Which inventory identifier and canonical unit should the model receive for each material?
3. Missing months currently mark that material history incomplete and trigger the mean fallback. Should a true zero-usage month arrive as an explicit zero row?
4. What history window and forecast horizon should the backend request?
5. Does the backend want to call `forecast_records()` with JSON-style records, or construct a DataFrame directly? The adapter exists, while its field names remain provisional.
6. What response envelope, error shape, and model-version format should the endpoint use?

Until those points are agreed, keep the sample data clearly marked synthetic and treat the response fields as provisional.
