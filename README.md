# SolarOps Intelligence

SolarOps Intelligence is a solar installation and service management project for SunPower Solutions. The repository currently contains a frontend demonstration and Chandra's material-demand forecasting prototype.

## Current project status

- The React and TypeScript frontend previews Customer, Technician, and Admin dashboards using illustrative data. It is a UI demo; login, authorization, and backend storage are not connected yet.
- The Python forecasting module compares a historical-mean baseline, Linear Regression, and Random Forest. It uses synthetic monthly usage, so its metrics demonstrate the evaluation process rather than real-world accuracy.
- The backend, database, and end-to-end customer workflow are not present in this checkout yet. Do not treat the frontend role preview or demo forecast as production behavior.

## Repository layout

- `frontend/` contains the role-based UI demo and its own setup guide.
- `ml/demand_forecast/` contains the demand forecast module, reproducible synthetic data, example JSON request/response, evaluation report, and backend handoff notes.
- `.gitignore` excludes local Python environments, caches, and environment files. Keep real credentials and customer data out of Git; use `.env.example` for placeholder variable names.

## Run the frontend

Install Node.js LTS, then from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local address Vite prints. The role selector previews the three dashboards. See `frontend/README.md` for screen details and current limitations.

## Run the forecasting demo

Use Python 3.9 or newer. From the repository root:

```powershell
python -m pip install -r ml/demand_forecast/requirements.txt
python ml/demand_forecast/make_demo_data.py
python -m ml.demand_forecast.demo
```

The demo prints validation and holdout scores followed by three months of advisory forecasts. The sample history is synthetic and clearly marked as such. The module forecasts demand only; the backend must calculate stock, reorder quantities, prices, and purchase orders from authoritative records.

Verify the forecast rules from the repository root with `python -m unittest discover -s ml/demand_forecast/tests -v`. The same checks and demo run automatically in GitHub Actions when forecast files change.

See `ml/demand_forecast/README.md` for the input format and model details, and `ml/demand_forecast/INTEGRATION.md` for the proposed fields and decisions awaiting backend agreement.

## Integration rule

Agree shared field names, units, status values, API response shapes, and error handling with the backend owner before replacing demo data or connecting API calls. Model outputs remain recommendations that require human review.
