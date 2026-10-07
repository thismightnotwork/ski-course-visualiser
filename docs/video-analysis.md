# Video analysis

Run the local processor with `docker compose up --build`, then start the frontend with `npm run dev`. Upload a supported video from a project’s Video analysis tab and click Analyse video locally. The browser uploads the file to the local FastAPI service, polls a cancellable job, stores tracking samples and lets you mark start, finish and gates manually before generating a draft run.

The current OpenCV detector is a motion-contour baseline. It can be confused by camera movement, snow spray, shadows, other people and changing lighting. It does not reliably identify a skier and does not estimate technique. Every path and speed-related result is approximate, confidence-scored and requires manual review. Do not treat it as medical, biomechanical or competition-legal analysis.

The service is local by default. Users must have permission to analyse footage; for minors, obtain suitable guardian consent and avoid public sharing.
