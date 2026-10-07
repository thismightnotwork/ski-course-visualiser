# Photo calibration and the 3D view

## Photo calibration

- The photo is stored in this browser (IndexedDB) and never uploaded. Calibration points are saved with the course in image pixel coordinates.
- Four-point calibration maps the clicked corners (top-left, top-right, bottom-right, bottom-left) onto the course rectangle (width x length from the Plan tab). It assumes one flat plane and warns about strong perspective or a small marked area.
- Known distances give a single metres-per-pixel scale that ignores perspective. Several references are checked against each other.
- Elements placed on the photo are tagged `calibrated`. Starting confidence is 0.7, or 0.4 when the calibration warns about weak geometry. This is a heuristic: change it per element.
- With no calibration, measuring and placing are unavailable and the status panel says so.

## 3D view

- Built from the stored course with simple procedural geometry (no external assets).
- World axes: X across the slope, Y up, Z downhill. If no slope angle is entered the surface is drawn flat.
- Pole heights and sizes are visual defaults, not measurements.
- Camera presets: orbit, top-down, side and from-the-start. A true follow camera and the skier path arrive with video tracking.
- Tests cover the plan-to-world conversion, scene model and camera presets. The WebGL canvas itself is not covered by automated tests because jsdom has no WebGL.
