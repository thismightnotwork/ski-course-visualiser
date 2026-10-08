import { runSchema, type MistakeType, type Run, type Severity } from './run';
import type { PathPoint } from './path';
import { formatTime, parseTime } from './timing';
import { fromMetres, toMetres, type Units } from './units';

export interface MistakeDraft {
  id: string;
  type: MistakeType;
  time: string;
  gate: string;
  position: string;
  duration: string;
  severity: Severity;
  confidence: string;
  source: 'manual' | 'auto';
  penalty: string;
  notes: string;
}

export interface SplitDraft {
  id: string;
  gate: string;
  time: string;
}

export interface RunDraft {
  skier: string;
  date: string;
  total: string;
  startDelay: string;
  finishDelay: string;
  penalty: string;
  notes: string;
  mistakes: MistakeDraft[];
  splits: SplitDraft[];
  path: PathPoint[];
}

export interface DraftContext {
  projectId: string;
  courseId: string;
  units: Units;
  id?: string;
  createdAt?: string;
  now?: Date;
}

export type DraftResult = { ok: true; run: Run } | { ok: false; errors: string[] };

export const emptyDraft = (today: string): RunDraft => ({
  skier: '',
  date: today,
  total: '',
  startDelay: '0',
  finishDelay: '0',
  penalty: '0',
  notes: '',
  mistakes: [],
  splits: [],
  path: [],
});

export const newMistakeDraft = (): MistakeDraft => ({
  id: crypto.randomUUID(),
  type: 'unknown',
  time: '',
  gate: '',
  position: '',
  duration: '0',
  severity: 'minor',
  confidence: '1',
  source: 'manual',
  penalty: '0',
  notes: '',
});

export const newSplitDraft = (): SplitDraft => ({ id: crypto.randomUUID(), gate: '', time: '' });

/** Clearly labelled demo data so the app can be shown without a real skier. */
export function sampleDraft(today: string, gateNumbers: number[]): RunDraft {
  const draft = emptyDraft(today);
  draft.skier = 'Sample skier (demo data)';
  draft.total = '45.30';
  draft.notes = 'Sample data for demonstration only. Not a real run.';
  if (gateNumbers.length >= 3) {
    draft.mistakes = [
      {
        ...newMistakeDraft(),
        type: 'wide_line',
        time: '18.4',
        gate: String(gateNumbers[2]),
        severity: 'minor',
        notes: 'Sample mistake',
      },
    ];
  }
  return draft;
}

export function draftToRun(draft: RunDraft, ctx: DraftContext): DraftResult {
  const errors: string[] = [];
  const num = (label: string, s: string, fallback: number): number => {
    if (s.trim() === '') return fallback;
    const v = Number(s);
    if (!Number.isFinite(v)) {
      errors.push(`${label}: enter a number`);
      return fallback;
    }
    return v;
  };
  const optNum = (label: string, s: string): number | null => {
    if (s.trim() === '') return null;
    const v = Number(s);
    if (!Number.isFinite(v)) {
      errors.push(`${label}: enter a number`);
      return null;
    }
    return v;
  };
  const time = (label: string, s: string): number => {
    if (s.trim() === '') {
      errors.push(`${label}: enter a time`);
      return 0;
    }
    const v = parseTime(s);
    if (v === null) {
      errors.push(`${label}: use a time like 1:23.45 or 83.45`);
      return 0;
    }
    return v;
  };

  const totalTimeSec = time('Total time', draft.total);
  const startDelaySec = num('Start delay', draft.startDelay, 0);
  const finishDelaySec = num('Finish delay', draft.finishDelay, 0);
  const penaltySec = num('Penalty', draft.penalty, 0);

  const mistakes = draft.mistakes.map((m, i) => {
    const n = `Mistake ${i + 1}`;
    const position = optNum(`${n} position`, m.position);
    return {
      id: m.id,
      type: m.type,
      timeSec: time(`${n} time`, m.time),
      gateNumber: optNum(`${n} gate`, m.gate),
      positionY: position === null ? null : toMetres(position, ctx.units),
      durationSec: num(`${n} duration`, m.duration, 0),
      severity: m.severity,
      notes: m.notes,
      confidence: num(`${n} confidence`, m.confidence, 1),
      source: m.source,
      penaltySec: num(`${n} penalty`, m.penalty, 0),
    };
  });
  const splits = draft.splits.map((s, i) => ({
    gateNumber: optNum(`Split ${i + 1} gate`, s.gate) ?? 0,
    timeSec: time(`Split ${i + 1} time`, s.time),
  }));

  if (errors.length > 0) return { ok: false, errors };

  const now = (ctx.now ?? new Date()).toISOString();
  const parsed = runSchema.safeParse({
    schemaVersion: 1,
    id: ctx.id ?? crypto.randomUUID(),
    projectId: ctx.projectId,
    courseId: ctx.courseId,
    skier: draft.skier,
    date: draft.date,
    totalTimeSec,
    startDelaySec,
    finishDelaySec,
    penaltySec,
    notes: draft.notes,
    mistakes,
    splits,
    createdAt: ctx.createdAt ?? now,
    updatedAt: now,
    path: draft.path,
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 5)
        .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)),
    };
  }
  return { ok: true, run: parsed.data };
}

export function runToDraft(run: Run, units: Units): RunDraft {
  return {
    skier: run.skier,
    date: run.date,
    total: formatTime(run.totalTimeSec),
    startDelay: String(run.startDelaySec),
    finishDelay: String(run.finishDelaySec),
    penalty: String(run.penaltySec),
    notes: run.notes,
    mistakes: run.mistakes.map((m) => ({
      id: m.id,
      type: m.type,
      time: formatTime(m.timeSec),
      gate: m.gateNumber === null ? '' : String(m.gateNumber),
      position:
        m.positionY === null ? '' : String(Math.round(fromMetres(m.positionY, units) * 100) / 100),
      duration: String(m.durationSec),
      severity: m.severity,
      confidence: String(m.confidence),
      source: m.source,
      penalty: String(m.penaltySec),
      notes: m.notes,
    })),
    splits: run.splits.map((s) => ({
      id: crypto.randomUUID(),
      gate: String(s.gateNumber),
      time: formatTime(s.timeSec),
    })),
    path: run.path ?? [],
  };
}
