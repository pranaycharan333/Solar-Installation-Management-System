"""Optional HTTP adapter for the advisory demand-forecast prototype.

The route and field names are provisional until the shared backend contract is approved.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, StrictStr

from .forecast import forecast_records


class HistoryRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    usage_month: StrictStr
    material_id: StrictStr
    material_name: StrictStr
    quantity_used: StrictInt | StrictFloat
    unit: StrictStr
    is_synthetic: StrictBool


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    history: list[HistoryRecord] = Field(min_length=1)
    horizon_months: Annotated[StrictInt, Field(gt=0)] = 3


class ForecastResult(BaseModel):
    material_id: str
    forecast_period: str
    predicted_quantity: float
    unit: str
    model: str
    model_version: str
    fallback_reason: str | None
    demo_data: bool
    review_needed: bool


app = FastAPI(
    title="SolarOps Demand Forecast Adapter",
    version="1.0.0",
    description="Provisional HTTP wrapper for advisory material demand forecasts.",
)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_request",
                "message": "The forecast request does not match the provisional input schema.",
                "details": [
                    {"location": error["loc"], "message": error["msg"]}
                    for error in exc.errors()
                ],
            }
        },
    )


@app.exception_handler(ValueError)
async def forecast_input_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "invalid_history",
                "message": str(exc),
            }
        },
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/forecast", response_model=list[ForecastResult], tags=["forecast"])
def create_forecast(request: ForecastRequest) -> list[dict]:
    """Forecast from validated JSON history; outputs remain advisory."""
    return forecast_records(
        [row.model_dump() for row in request.history],
        horizon_months=request.horizon_months,
    )
