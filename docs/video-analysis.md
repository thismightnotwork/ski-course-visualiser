# Video analysis (browser MVP)

The first video feature is intentionally conservative. It does not claim to diagnose ski technique or produce competition-legal measurements.

- Uploads are validated as MP4, MOV or WebM up to 500 MB and kept in browser object URLs during the session. The metadata record is persisted locally; the original binary is not automatically uploaded or publicly shared.
- Mark video start and finish at the current playback frame. Gate markers can be added manually.
- `Create approximate tracking draft` currently generates a visible placeholder path with confidence 0. This is an explicit extension point, not a fake detector.
- `Generate draft run` creates a manual-review run from the start/finish and gate markers. It is not silently treated as ground truth.
- A production detector should implement the same tracking sample interface, run asynchronously in a cancellable job and record confidence per sample. A future FastAPI/OpenCV/MediaPipe adapter can replace the placeholder without changing the UI data model.
- Users must have permission to analyse uploaded footage. For minors, obtain appropriate guardian consent and avoid public sharing.
