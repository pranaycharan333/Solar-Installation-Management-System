"""Print a compact, evaluator-friendly view of the synthetic forecast demo."""
if __package__:
    from .forecast import evaluate, forecast, load_history
else:
    from forecast import evaluate, forecast, load_history


def _score(metrics: dict, model: str) -> str:
    score = metrics[model]
    return f"MAE {score['mae']:.2f}, RMSE {score['rmse']:.2f}"


def main() -> None:
    history = load_history()
    reports = evaluate(history)
    predictions = forecast(history)
    print("SOLAROPS MATERIAL DEMAND FORECAST - SYNTHETIC DEMO DATA")
    print("Metrics illustrate the workflow only; they are not real-world accuracy.\n")

    for report in reports:
        material_id = report["material_id"]
        print(f"{material_id} - {report['status']}")
        if report["status"] != "evaluated":
            print(f"  {report['rows']} rows; the historical-mean fallback is used.\n")
            continue
        validation = report["metrics"]["validation"]
        holdout = report["metrics"]["holdout"]
        print(f"  Selected on validation: {report['selected_model']}")
        print(f"  Validation: {report['validation_start']} onward; {report['validation_rows']} months")
        for model in validation:
            print(f"    {model}: {_score(validation, model)}")
        print(f"  Untouched holdout: {report['holdout_start']} onward; {report['holdout_rows']} months")
        for model in holdout:
            print(f"    {model}: {_score(holdout, model)}")
        print()

    print("ADVISORY FORECAST")
    for item in predictions:
        print(
            f"  {item['forecast_period']} | {item['material_id']} | "
            f"{item['predicted_quantity']:.2f} {item['unit']} | "
            f"{item['model']} | review required"
        )


if __name__ == "__main__":
    main()
