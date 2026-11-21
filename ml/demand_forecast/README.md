# SolarOps material demand forecast prototype

This is Chandra's first forecasting prototype. It uses **synthetic monthly demo data** and must not be presented as real company usage or real-world model accuracy. Forecasts are advisory; the backend remains responsible for stock, reorder quantities, and purchases.

## Files and why they exist

- `sample_history.csv` is a small, reproducible example of monthly usage for panels, inverters, and cable. Keeping data outside the Python code makes it easier to replace demo values with an approved export later.
- `forecast.py` loads and validates that input, compares a training-mean baseline with Linear Regression and Random Forest using chronological validation and holdout windows, and produces advisory predictions. We compare the simple baseline because a more complex model should earn its place by performing better on later dates.
- `make_demo_data.py` regenerates the CSV deterministically. It makes the invented nature of the data visible and avoids hand-editing 108 rows.
- `demo.py` prints a compact explanation of the validation scores, separate holdout scores, selected model, and advisory forecasts for an evaluator.
- `requirements.txt` lists only the Python libraries this prototype imports, so another machine can reproduce the environment without installing unrelated packages.
- `__init__.py` provides a stable import point for the backend adapter, instead of making it import functions from an implementation file directly.
- `examples/forecast_request.json` shows a provisional JSON-style input; its rows are synthetic.
- `examples/forecast_response.json` is an example response generated from the synthetic history. It lets teammates review the shape before the API field names are finalized.
- `examples/evaluation_report.json` records the baseline and model holdout metrics for the same demo data, so the comparison is easy to review without running the script.
- `INTEGRATION.md` is the proposed handoff for Bharath; it separates current assumptions from decisions that still need agreement.

## Run

From this folder:

```powershell
python -m pip install -r requirements.txt
python make_demo_data.py
python demo.py
python forecast.py
```

## Current input fields

`usage_month` (YYYY-MM), `material_id`, `material_name`, `quantity_used`, `unit`, and `is_synthetic`. This prototype assumes one row per material per month, with monthly quantities already aggregated. It forecasts three months by default. IDs are read as text to preserve leading zeroes. Blank values, negative or non-finite quantities, invalid synthetic flags, duplicate material-month rows, and inconsistent units are rejected with an explanation.

## Import and example response

From the repository root, import the public functions with `from ml.demand_forecast import evaluate, forecast, forecast_records, load_history`. Then call `history = load_history()`, `metrics = evaluate(history)`, and `results = forecast(history)`. A backend handling JSON records can pass `request["history"]` to `forecast_records(records, horizon_months=3)`; this adapter uses the same validation as CSV input. The example response is intentionally generated from demo data and is provisional until Bharath confirms the contract.

## Output fields

Each forecast row includes `material_id`, `forecast_period`, `predicted_quantity`, `unit`, `model`, `model_version`, `demo_data`, and `review_needed`. These are provisional fields; confirm names and units with Bharath before backend integration.

## Evaluation and limits

The most recent six months are a final holdout. The six months before them are a validation window used to select a model; only earlier months train that selection. After selection, each model is refit on all pre-holdout months and scored on the untouched holdout. This avoids choosing a model based on the same months used to report its final score. MAE and RMSE are reported for both windows. The chronological split better matches forecasting future months than a random split, which would mix past and future. Items need at least 24 monthly rows to receive the validation and holdout comparison; shorter histories use the mean fallback. The demo has only 36 invented months per item, so the comparison shows how the code works, not which model will perform well on SunPower history. With real data, inspect gaps, changes in units, missing months, and enough seasonal cycles before trusting a model. The prediction function never calculates inventory balance, costs, reorder quantity, or purchases.
