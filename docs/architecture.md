# Architecture

Phase 1 is browser-only: React + TypeScript + Vite + Tailwind, Zustand with localStorage persistence, Zod schemas in `src/domain`.

Planned (later phases): React Three Fiber 3D view, FastAPI backend with SQLite (PostgreSQL-compatible schema), async cancellable processing jobs, OpenCV + MediaPipe pose behind a detector interface, S3-compatible storage abstraction.

Decisions:

- Browser-first; local processing preferred for privacy and cost.
- Projects carry `schemaVersion` and a nullable `ownerId` so accounts and collaboration can be added later.
- Lengths are stored in metres internally and converted for display.
