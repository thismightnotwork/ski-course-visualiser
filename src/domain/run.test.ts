import { runSchema } from './run';
import { draftToRun, emptyDraft, newMistakeDraft, newSplitDraft, runToDraft } from './runDraft';
import { mistakesToCsv, runsToCsv } from './runExport';

const ctx = { projectId: 'p', courseId: 'c', units: 'metres' as const };
const valid = (over = {}) => ({ ...emptyDraft('2026-10-07'), skier: 'A', total: '1:23.45', ...over });

describe('runSchema', () => {
  const base = () => {
    const r = draftToRun(valid(), ctx);
    if (!r.ok) throw new Error(r.errors.join(','));
    return r.run;
  };

  it('accepts a valid run and rejects a bad date or empty skier', () => {
    expect(runSchema.safeParse(base()).success).toBe(true);
    expect(runSchema.safeParse({ ...base(), date: '07/10/2026' }).success).toBe(false);
    expect(runSchema.safeParse({ ...base(), skier: '  ' }).success).toBe(false);
  });

  it('rejects delays that swallow the total time', () => {
    expect(runSchema.safeParse({ ...base(), startDelaySec: 50, finishDelaySec: 40 }).success).toBe(
      false,
    );
  });

  it('rejects duplicate, non-increasing or late splits', () => {
    const s = (gateNumber: number, timeSec: number) => ({ gateNumber, timeSec });
    expect(runSchema.safeParse({ ...base(), splits: [s(1, 5), s(1, 6)] }).success).toBe(false);
    expect(runSchema.safeParse({ ...base(), splits: [s(1, 6), s(2, 5)] }).success).toBe(false);
    expect(runSchema.safeParse({ ...base(), splits: [s(1, 500)] }).success).toBe(false);
    expect(runSchema.safeParse({ ...base(), splits: [s(1, 5), s(2, 9)] }).success).toBe(true);
  });
});

describe('draftToRun', () => {
  it('parses the total time and fills defaults', () => {
    const r = draftToRun(valid(), ctx);
    if (!r.ok) throw new Error(r.errors.join(','));
    expect(r.run.totalTimeSec).toBeCloseTo(83.45);
    expect(r.run.penaltySec).toBe(0);
  });

  it('reports missing and malformed times', () => {
    const none = draftToRun(valid({ total: '' }), ctx);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.errors[0]).toContain('Total time');
    const bad = draftToRun(valid({ total: 'abc' }), ctx);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toContain('use a time');
  });

  it('converts mistake positions from feet to metres', () => {
    const mistake = { ...newMistakeDraft(), time: '10', position: '10' };
    const r = draftToRun(valid({ mistakes: [mistake] }), { ...ctx, units: 'feet' });
    if (!r.ok) throw new Error(r.errors.join(','));
    expect(r.run.mistakes[0].positionY).toBeCloseTo(3.048);
  });

  it('rejects non-numeric penalties and out-of-range confidence', () => {
    expect(draftToRun(valid({ penalty: 'x' }), ctx).ok).toBe(false);
    const m = { ...newMistakeDraft(), time: '5', confidence: '2' };
    expect(draftToRun(valid({ mistakes: [m] }), ctx).ok).toBe(false);
  });

  it('round-trips through runToDraft', () => {
    const m = { ...newMistakeDraft(), time: '12.5', gate: '3', penalty: '2', notes: 'late' };
    const sp = { ...newSplitDraft(), gate: '2', time: '9.5' };
    const first = draftToRun(valid({ mistakes: [m], splits: [sp] }), ctx);
    if (!first.ok) throw new Error(first.errors.join(','));
    const second = draftToRun(runToDraft(first.run, 'metres'), { ...ctx, id: first.run.id });
    if (!second.ok) throw new Error(second.errors.join(','));
    expect(second.run.mistakes[0].timeSec).toBeCloseTo(12.5);
    expect(second.run.mistakes[0].gateNumber).toBe(3);
    expect(second.run.splits[0].timeSec).toBeCloseTo(9.5);
  });
});

describe('run exports', () => {
  it('writes a CSV row per run and neutralises formulas in names', () => {
    const r = draftToRun(valid({ skier: '=HYPERLINK("x")' }), ctx);
    if (!r.ok) throw new Error(r.errors.join(','));
    const csv = runsToCsv([r.run]);
    expect(csv.split('\n')[0]).toContain('adjusted_s');
    expect(csv).toContain("'=HYPERLINK");
  });

  it('writes mistakes in time order', () => {
    const a = { ...newMistakeDraft(), time: '20' };
    const b = { ...newMistakeDraft(), time: '5' };
    const r = draftToRun(valid({ mistakes: [a, b] }), ctx);
    if (!r.ok) throw new Error(r.errors.join(','));
    const lines = mistakesToCsv(r.run).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('5,')).toBe(true);
  });
});
