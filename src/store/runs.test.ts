import { draftToRun, emptyDraft } from '../domain/runDraft';
import { migrateRuns, useRuns } from './runs';

const make = (skier = 'A') => {
  const r = draftToRun(
    { ...emptyDraft('2026-10-07'), skier, total: '50' },
    { projectId: 'p', courseId: 'c', units: 'metres' },
  );
  if (!r.ok) throw new Error(r.errors.join(','));
  return r.run;
};

describe('run store', () => {
  beforeEach(() => useRuns.setState({ runs: {} }));

  it('adds, updates and removes runs', () => {
    const run = make();
    expect(useRuns.getState().addRun(run)).toBe(true);
    expect(useRuns.getState().runs.p).toHaveLength(1);
    expect(useRuns.getState().updateRun({ ...run, skier: 'B' })).toBe(true);
    expect(useRuns.getState().runs.p[0].skier).toBe('B');
    useRuns.getState().removeRun('p', run.id);
    expect(useRuns.getState().runs.p).toHaveLength(0);
  });

  it('rejects invalid runs', () => {
    expect(useRuns.getState().addRun({ ...make(), totalTimeSec: -1 })).toBe(false);
    expect(useRuns.getState().runs.p).toBeUndefined();
  });

  it('removes all runs for a project', () => {
    useRuns.getState().addRun(make());
    useRuns.getState().removeProjectRuns('p');
    expect(useRuns.getState().runs.p).toBeUndefined();
  });

  it('migrates legacy runs without a path field to have empty path', () => {
    const run = make();
    const legacyRun = { ...run };
    delete (legacyRun as { path?: unknown }).path;

    const persisted = { runs: { p: [legacyRun] } };
    const migrated = migrateRuns(persisted, 1);

    expect(migrated.runs.p[0].path).toEqual([]);
  });

  it('preserves existing paths during migration', () => {
    const run = {
      ...make(),
      path: [
        { x: 5, y: 10 },
        { x: 8, y: 20 },
      ],
    };
    const persisted = { runs: { p: [run] } };
    const migrated = migrateRuns(persisted, 1);

    expect(migrated.runs.p[0].path).toEqual([
      { x: 5, y: 10 },
      { x: 8, y: 20 },
    ]);
  });

  it('does not alter runs at the current version', () => {
    const run = make();
    const persisted = { runs: { p: [run] } };
    const migrated = migrateRuns(persisted, 2);

    expect(migrated.runs.p[0].path).toEqual([]);
  });
});
