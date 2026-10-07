# Local video processor

Run from the repository root with `docker compose up --build`. The frontend talks to `http://localhost:8000` using `VITE_VIDEO_PROCESSOR_URL`.

The OpenCV baseline samples video frames and returns an approximate motion-contour path. It is an experimental detector, not reliable skier recognition, pose diagnosis, biomechanical measurement or a competition-legal result. Confidence and manual review are mandatory. Replace the detector inside `JobManager._run` with a validated pose/person model later.
