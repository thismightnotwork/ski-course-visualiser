# Import and export

All files use metres, whatever units the project displays.

## JSON

`format: "ski-course-visualiser"`, `formatVersion: 1`, plus `project` (name, units) and the full `course`. Import validates the whole course, rebinds it to the open project and replaces the current course. The change is undoable.

## CSV

Columns: `type, x_m, y_m, rotation_deg, width_m, poles, colour, elevation_m, source, confidence, number, notes`.

- Required: `type`, `x_m`, `y_m`. Other columns fall back to element defaults.
- `type`: start, finish, gate, combination, delay_gate, panel, training_pole, hazard.
- `poles`: 1 or 2. `colour`: red or blue. `number` is recalculated and ignored on import.
- Notes starting with `=`, `+`, `-` or `@` are prefixed with an apostrophe on export so spreadsheets do not run them as formulas. The prefix is removed on import.
- Limits: 2 MB file, 2000 rows. Any invalid row rejects the whole file and reports row numbers.
