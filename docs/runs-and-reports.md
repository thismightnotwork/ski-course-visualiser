# Runs, timing and reports

## Timing rules (documented decisions)

- Raw time = total time entered minus start delay minus finish delay. Delays are seconds inside the total that were not skiing, for example a late start signal. They default to 0.
- Penalty time = the manual penalty plus the penalty entered on each mistake. Penalties default to 0: no official rule profile is assumed, so you decide what each mistake costs.
- Adjusted time = raw time + penalty time.
- Average between gates needs at least two gate split times. It is the time between the first and last split divided by the number of gates between them. Otherwise it is shown as not available with the reason.
- Splits are measured from the start of timing and must increase with gate number.

## Mistakes

Each mistake has a type, timestamp, optional gate number or position down the course, duration, severity, confidence (0 to 1), source (manual or automatic) and notes. Automatic mistakes will be flagged as unverified. Mistakes per section group by gate number first, then by position; a section is the approach to a gate and the gate itself.

## Reports and exports

- Run report: print or save as PDF from the browser. It includes timing, a plan with mistake gates ringed, splits, sections and the mistake table.
- Exports: runs CSV and JSON, mistakes CSV for one run, and the course plan as SVG.
- Spreadsheet formulas in text fields are neutralised in CSV files.

## Privacy

Runs are stored in this browser only. Use a nickname or ID instead of a full name for skiers under 18, and do not share reports without permission from the skier or guardian.
