from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.db.models import MLPrediction
from app.schemas.api import MLPredictionItem, MLTrainRequest, MLTrainResponse
from app.services.ml_service import train_and_predict

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/train", response_model=MLTrainResponse)
def train_model(payload: MLTrainRequest, db: Session = Depends(get_db_session)) -> MLTrainResponse:
    try:
        result = train_and_predict(db, horizon_months=payload.horizon_months)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MLTrainResponse(
        model="RandomForestRegressor",
        trained_records=result.trained_records,
        validation_mae=result.validation_mae,
        predictions=[MLPredictionItem(**p) for p in result.predictions],
    )


@router.get("/predictions", response_model=list[MLPredictionItem])
def list_predictions(db: Session = Depends(get_db_session)) -> list[MLPredictionItem]:
    stmt = (
        select(MLPrediction)
        .where(MLPrediction.scope == "global")
        .order_by(MLPrediction.year, MLPrediction.month)
    )
    rows = db.scalars(stmt).all()
    return [
        MLPredictionItem(
            utility=row.utility,
            year=row.year,
            month=row.month,
            value=round(row.predicted_value, 2),
        )
        for row in rows
    ]
