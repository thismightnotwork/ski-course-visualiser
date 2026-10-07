from typing import Literal
from pydantic import BaseModel, Field
class TrackingPoint(BaseModel):
    time_sec: float = Field(ge=0); x: float = Field(ge=0, le=1); y: float = Field(ge=0, le=1); confidence: float = Field(ge=0, le=1); source: Literal['auto', 'manual'] = 'auto'
class VideoJob(BaseModel):
    id: str; status: Literal['queued', 'processing', 'completed', 'failed', 'cancelled']; progress: float = Field(ge=0, le=1); error: str | None = None; duration_sec: float | None = None; width: int | None = None; height: int | None = None; fps: float | None = None; tracking: list[TrackingPoint] = []; confidence: float = Field(ge=0, le=1); warning: str
