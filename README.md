# SkiCourse Visualiser

Open-source (MIT) web app for creating, analysing and visualising ski race courses for indoor snow centres, dry slopes and outdoor areas.

## Status

Phase 1 of 7: app shell, dashboard, project creation, browser persistence and a typed data model. The course editor, 3D view, run recording, video analysis, avatar and comparison are not built yet. See `docs/` and the roadmap below.

## What it does not guarantee

A single photo or ordinary video cannot give exact geometry or a diagnosis of ski technique. When computer vision is added, all results will be labelled as estimates with confidence levels and will be manually correctable. Output is not medically or biomechanically accurate, nor competition-legal.

## Run locally

Requires Node.js 20+.

```bash
git clone https://github.com/thismightnotwork/ski-course-visualiser.git
cd ski-course-visualiser
npm install
npm run dev
```

Open http://localhost:5173.

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## Privacy

Data stays in your browser. You must have permission to upload or analyse videos of people; for minors obtain guardian consent and do not assume public sharing is allowed.

## Roadmap

1. Shell, dashboard, projects (this release)
2. 2D course editor, measurements, import/export, calibration
3. 3D visualiser
4. Run recording and reports
5. Video upload, jobs, tracking and pose
6. Avatar, replay, comparison
7. Hardening, accessibility, Docker, deployment docs

## Contributing

Issues and pull requests are welcome. Run all checks before opening a PR.
