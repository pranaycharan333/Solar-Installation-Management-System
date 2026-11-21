"""Small, advisory material-demand forecast prototype for SolarOps.

The included history is synthetic. Results are a demo, not an inventory decision.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "sample_history.csv"
REQUIRED_COLUMNS = {"usage_month", "material_id", "material_name", "quantity_used", "unit", "is_synthetic"}


def _features(months: pd.Series, origin: pd.Timestamp) -> np.ndarray:
    dates = pd.to_datetime(months.astype(str) + "-01")
    elapsed = (dates.dt.year - origin.year) * 12 + dates.dt.month - origin.month
    angle = 2 * np.pi * (dates.dt.month - 1) / 12
    return np.column_stack([elapsed.to_numpy(), np.sin(angle), np.cos(angle)])


def _validate_history(frame: pd.DataFrame) -> pd.DataFrame:
    """Validate and normalize monthly material usage rows."""
    frame = frame.copy()
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(f"History is missing required columns: {', '.join(sorted(missing))}")

    text_columns = ["usage_month", "material_id", "material_name", "unit", "is_synthetic"]
    for column in text_columns:
        frame[column] = frame[column].astype("string").str.strip()
        if frame[column].isna().any() or frame[column].eq("").any():
            raise ValueError(f"{column} cannot contain blank values")

    frame["usage_month"] = pd.to_datetime(
        frame["usage_month"] + "-01", format="%Y-%m-%d", errors="raise"
    )
    frame["quantity_used"] = pd.to_numeric(frame["quantity_used"], errors="raise")
    quantities = frame["quantity_used"].to_numpy(dtype=float)
    if not np.isfinite(quantities).all():
        raise ValueError("quantity_used must contain finite numbers")
    if (quantities < 0).any():
        raise ValueError("quantity_used cannot be negative")

    frame["is_synthetic"] = frame["is_synthetic"].str.lower()
    invalid_flags = set(frame["is_synthetic"]) - {"true", "false"}
    if invalid_flags:
        raise ValueError("is_synthetic must be true or false")
    if frame.duplicated(["usage_month", "material_id"]).any():
        raise ValueError("Each material can have only one row per month in this prototype")
    unit_counts = frame.groupby("material_id")["unit"].nunique()
    inconsistent_units = unit_counts[unit_counts > 1].index.tolist()
    if inconsistent_units:
        raise ValueError(
            "Each material must use one consistent unit; check: "
            + ", ".join(inconsistent_units)
        )

    return frame.sort_values(["material_id", "usage_month"]).reset_index(drop=True)


def load_history(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load and validate monthly usage from a CSV file."""
    frame = pd.read_csv(path, dtype={"material_id": "string"})
    return _validate_history(frame)



def _models():
    return {
        "training_mean": None,
        "linear_regression": make_pipeline(StandardScaler(), LinearRegression()),
        "random_forest": RandomForestRegressor(n_estimators=200, max_depth=3, random_state=42),
    }


def _nonnegative_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    """Score feasible quantities using the same zero floor as forecast output."""
    feasible = np.maximum(0.0, np.asarray(predicted, dtype=float))
    return {
        "mae": round(float(mean_absolute_error(actual, feasible)), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, feasible))), 3),
    }


def _require_positive_integer(value: int, name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{name} must be a positive integer")


def evaluate(
    history: pd.DataFrame,
    minimum_rows: int = 24,
    holdout_months: int = 6,
    validation_months: int = 6,
) -> list[dict]:
    """Select models on a validation window and report separate future holdout metrics."""
    _require_positive_integer(minimum_rows, "minimum_rows")
    _require_positive_integer(holdout_months, "holdout_months")
    _require_positive_integer(validation_months, "validation_months")
    if minimum_rows <= holdout_months + validation_months:
        raise ValueError("minimum_rows must leave at least one training row")
    reports = []
    for material_id, group in history.groupby("material_id", sort=True):
        group = group.sort_values("usage_month").reset_index(drop=True)
        observed_months = group["usage_month"].dt.to_period("M")
        expected_months = pd.period_range(observed_months.min(), observed_months.max(), freq="M")
        missing_months = [str(month) for month in expected_months.difference(observed_months)]
        if missing_months:
            reports.append({
                "material_id": str(material_id),
                "status": "incomplete_history",
                "rows": len(group),
                "missing_months": missing_months,
            })
            continue
        if len(group) < minimum_rows:
            reports.append({"material_id": material_id, "status": "insufficient_history", "rows": len(group), "minimum_rows": minimum_rows})
            continue

        holdout_start = len(group) - holdout_months
        validation_start = holdout_start - validation_months
        train = group.iloc[:validation_start]
        validation = group.iloc[validation_start:holdout_start]
        holdout = group.iloc[holdout_start:]
        if train.empty or validation.empty or holdout.empty:
            reports.append({"material_id": material_id, "status": "insufficient_split", "rows": len(group)})
            continue

        origin = train["usage_month"].iloc[0]
        x_train = _features(train["usage_month"].dt.strftime("%Y-%m"), origin)
        x_validation = _features(validation["usage_month"].dt.strftime("%Y-%m"), origin)
        y_train = train["quantity_used"].to_numpy()
        y_validation = validation["quantity_used"].to_numpy()
        validation_metrics = {}
        validation_mae = {}
        validation_mean = float(y_train.mean())
        for name, model in _models().items():
            predicted = np.full(len(validation), validation_mean) if model is None else model.fit(x_train, y_train).predict(x_validation)
            validation_metrics[name] = _nonnegative_metrics(y_validation, predicted)
            validation_mae[name] = validation_metrics[name]["mae"]
        selected_model = min(validation_mae, key=validation_mae.get)

        fit_data = group.iloc[:holdout_start]
        x_fit = _features(fit_data["usage_month"].dt.strftime("%Y-%m"), origin)
        x_holdout = _features(holdout["usage_month"].dt.strftime("%Y-%m"), origin)
        y_fit = fit_data["quantity_used"].to_numpy()
        y_holdout = holdout["quantity_used"].to_numpy()
        holdout_metrics = {}
        holdout_mean = float(y_fit.mean())
        for name, model in _models().items():
            predicted = np.full(len(holdout), holdout_mean) if model is None else model.fit(x_fit, y_fit).predict(x_holdout)
            holdout_metrics[name] = _nonnegative_metrics(y_holdout, predicted)

        reports.append({
            "material_id": str(material_id),
            "status": "evaluated",
            "train_rows": len(train),
            "validation_rows": len(validation),
            "validation_start": validation["usage_month"].iloc[0].strftime("%Y-%m"),
            "holdout_fit_rows": len(fit_data),
            "holdout_rows": len(holdout),
            "holdout_start": holdout["usage_month"].iloc[0].strftime("%Y-%m"),
            "selected_model": selected_model,
            "metrics": {"validation": validation_metrics, "holdout": holdout_metrics},
        })
    return reports



def forecast(history: pd.DataFrame, horizon_months: int = 3, minimum_rows: int = 24, holdout_months: int = 6, validation_months: int = 6) -> list[dict]:
    """Return advisory forecasts using validation-selected models or the mean fallback."""
    _require_positive_integer(horizon_months, "horizon_months")
    reports = {r["material_id"]: r for r in evaluate(history, minimum_rows, holdout_months, validation_months)}
    results = []
    for material_id, group in history.groupby("material_id", sort=True):
        group = group.sort_values("usage_month").reset_index(drop=True)
        report = reports[material_id]
        row = group.iloc[-1]
        if report["status"] != "evaluated" or len(group) < minimum_rows:
            model_name = "training_mean"
            fallback_reason = report["status"] if report["status"] != "evaluated" else "insufficient_history"
        else:
            model_name = report["selected_model"]
            fallback_reason = None
        origin = group["usage_month"].iloc[0]
        x_train = _features(group["usage_month"].dt.strftime("%Y-%m"), origin)
        if model_name == "training_mean":
            fitted = None
            prediction = float(group["quantity_used"].mean())
        else:
            fitted = _models()[model_name]
            fitted.fit(x_train, group["quantity_used"].to_numpy())
            prediction = None
        for step in range(1, horizon_months + 1):
            target = row["usage_month"] + pd.DateOffset(months=step)
            month = target.strftime("%Y-%m")
            if fitted is not None:
                value = float(fitted.predict(_features(pd.Series([month]), origin))[0])
            else:
                value = prediction
            results.append({
                "material_id": str(material_id),
                "forecast_period": month,
                "predicted_quantity": round(max(0.0, value), 2),
                "unit": str(row["unit"]),
                "model": model_name,
                "model_version": "1.0.0",
                "fallback_reason": fallback_reason,
                # A forecast that used any synthetic history must remain labeled as demo data.
                "demo_data": bool(group["is_synthetic"].astype(str).str.lower().eq("true").any()),
                "review_needed": True,
            })
    return results


def forecast_records(records: list[dict], horizon_months: int = 3) -> list[dict]:
    """Forecast from JSON-style history records using the provisional field names."""
    if not records:
        raise ValueError("records must contain at least one usage row")
    if any(not isinstance(record, dict) for record in records):
        raise ValueError("each history record must be a JSON object")
    if any(not isinstance(record.get("material_id"), str) for record in records):
        raise ValueError("material_id must be sent as text to preserve leading zeroes")
    history = _validate_history(pd.DataFrame.from_records(records))
    return forecast(history, horizon_months=horizon_months)


def main() -> None:
    history = load_history()
    print("TEMPORAL HOLDOUT METRICS (demo data; not real-world accuracy)")
    print(json.dumps(evaluate(history), indent=2))
    print("\nADVISORY FORECAST")
    print(json.dumps(forecast(history), indent=2))


if __name__ == "__main__":
    main()
