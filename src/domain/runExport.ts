import type { Course } from './course';
import type { Run } from './run';
import { computeTiming } from './timing';

function cell(v: string | number | null): string {
  if (v === null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const row = (values: (string | number | null)[]) => values.map(cell).join(',');

export function runsToCsv(runs: Run[]): string {
  const lines = [
    row([
      'skier',
      'date',
      'total_s',
      'start_delay_s',
      'finish_delay_s',
      'raw_s',
      'manual_penalty_s',
      'mistake_penalty_s',
      'adjusted_s',
      'mistakes',
      'avg_gate_s',
      'notes',
    ]),
  ];
  for (const r of runs) {
    const t = computeTiming(r);
    lines.push(
      row([
        r.skier,
        r.date,
        r.totalTimeSec,
        r.startDelaySec,
        r.finishDelaySec,
        t.rawTimeSec,
        t.manualPenaltySec,
        t.mistakePenaltySec,
        t.adjustedTimeSec,
        t.mistakeCount,
        t.avgGateTimeSec === null ? null : Math.round(t.avgGateTimeSec * 1000) / 1000,
        r.notes,
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

export function mistakesToCsv(run: Run): string {
  const lines = [
    row([
      'time_s',
      'type',
      'gate',
      'position_y_m',
      'duration_s',
      'severity',
      'confidence',
      'source',
      'penalty_s',
      'notes',
    ]),
  ];
  for (const m of [...run.mistakes].sort((a, b) => a.timeSec - b.timeSec)) {
    lines.push(
      row([
        m.timeSec,
        m.type,
        m.gateNumber,
        m.positionY,
        m.durationSec,
        m.severity,
        m.confidence,
        m.source,
        m.penaltySec,
        m.notes,
      ]),
    );
  }
  return lines.join('\n') + '\n';
}

export function exportRunsJson(
  project: { name: string; units: string },
  course: Course,
  runs: Run[],
  now = new Date(),
): string {
  return JSON.stringify(
    {
      format: 'ski-course-visualiser-runs',
      formatVersion: 1,
      exportedAt: now.toISOString(),
      project,
      course,
      runs,
    },
    null,
    2,
  );
}
