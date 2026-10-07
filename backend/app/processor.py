from __future__ import annotations
import threading, uuid
from pathlib import Path
import cv2
from .models import TrackingPoint, VideoJob
class JobManager:
    def __init__(self, root: Path): self.root = root; self.root.mkdir(parents=True, exist_ok=True); self.jobs: dict[str, VideoJob] = {}; self.cancelled: set[str] = set(); self.lock = threading.Lock()
    def create(self, filename: str, data: bytes) -> VideoJob:
        job_id = str(uuid.uuid4()); path = self.root / f'{job_id}_{Path(filename).name[:100]}'; path.write_bytes(data); job = VideoJob(id=job_id, status='queued', progress=0, confidence=0, warning='Tracking is an estimate and must be manually reviewed.')
        with self.lock: self.jobs[job_id] = job
        threading.Thread(target=self._run, args=(job_id, path), daemon=True).start(); return job
    def get(self, job_id: str) -> VideoJob | None:
        with self.lock: return self.jobs.get(job_id)
    def cancel(self, job_id: str) -> bool:
        with self.lock:
            if job_id not in self.jobs or self.jobs[job_id].status in {'completed', 'failed', 'cancelled'}: return False
            self.cancelled.add(job_id); return True
    def _set(self, job_id: str, **changes) -> None:
        with self.lock: self.jobs[job_id] = self.jobs[job_id].model_copy(update=changes)
    def _run(self, job_id: str, path: Path) -> None:
        cap = cv2.VideoCapture(str(path))
        try:
            if not cap.isOpened(): self._set(job_id, status='failed', error='OpenCV could not open this video.'); return
            fps = cap.get(cv2.CAP_PROP_FPS) or 0; frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0); width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0); height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0); duration = frames / fps if fps > 0 and frames > 0 else None
            self._set(job_id, status='processing', width=width, height=height, fps=fps or None, duration_sec=duration)
            points: list[TrackingPoint] = []; previous = None; index = 0; sample_every = max(1, frames // 240) if frames else 1
            while True:
                with self.lock:
                    if job_id in self.cancelled: self._set(job_id, status='cancelled'); return
                ok, frame = cap.read()
                if not ok: break
                if index % sample_every == 0:
                    gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (9, 9), 0)
                    if previous is None: point = (width / 2, height / 2); confidence = 0.0
                    else:
                        diff = cv2.absdiff(previous, gray); _, mask = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY); mask = cv2.dilate(mask, None, iterations=2); contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); contour = max(contours, key=cv2.contourArea, default=None)
                        if contour is not None and cv2.contourArea(contour) > max(100, width * height * 0.0005): x, y, w, h = cv2.boundingRect(contour); point = (x + w / 2, y + h / 2); confidence = min(0.45, cv2.contourArea(contour) / (width * height * 0.08))
                        else: point = (width / 2, height / 2); confidence = 0.0
                    previous = gray; t = index / fps if fps > 0 else float(index); points.append(TrackingPoint(time_sec=t, x=max(0, min(1, point[0] / max(1, width))), y=max(0, min(1, point[1] / max(1, height))), confidence=confidence)); self._set(job_id, progress=min(0.99, index / max(1, frames)))
                index += 1
            mean = sum(p.confidence for p in points) / len(points) if points else 0; self._set(job_id, status='completed', progress=1, tracking=points, confidence=mean)
        except Exception as exc: self._set(job_id, status='failed', error=str(exc))
        finally:
            cap.release()
            try: path.unlink(missing_ok=True)
            except OSError: pass
