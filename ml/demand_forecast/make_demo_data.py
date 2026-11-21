import csv
from datetime import date
from pathlib import Path

# Reproducible demo data only. These values are invented and are not company records.
materials = [
    ("MAT-PANEL-001", "Solar panel", "piece", 78, 1.8, 10),
    ("MAT-INV-001", "Inverter", "piece", 18, 0.45, 3),
    ("MAT-CABLE-001", "DC cable", "meter", 520, 12, 7),
]
months = 36
start_year, start_month = 2023, 11
out = Path(__file__).with_name("sample_history.csv")
with out.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["usage_month", "material_id", "material_name", "quantity_used", "unit", "is_synthetic"])
    for material_id, name, unit, base, trend, seasonal in materials:
        for i in range(months):
            month_num = start_month - 1 + i
            year = start_year + month_num // 12
            month = month_num % 12 + 1
            # Stable demo pattern: mild growth and annual variation, no randomness.
            seasonal_bump = seasonal if month in (3, 4, 10, 11) else 0
            quantity = max(0, round(base + trend * i + seasonal_bump))
            writer.writerow([date(year, month, 1).strftime("%Y-%m"), material_id, name, quantity, unit, "true"])
print(out)
