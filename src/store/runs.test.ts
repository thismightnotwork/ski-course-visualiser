import { draftToRun, emptyDraft } from '../domain/runDraft';
import { useRuns } from './runs';

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
});
