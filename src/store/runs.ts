import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { runSchema, type Run } from '../domain/run';

interface RunState {
  runs: Record<string, Run[]>;
  addRun: (run: Run) => boolean;
  updateRun: (run: Run) => boolean;
  removeRun: (projectId: string, id: string) => void;
  removeProjectRuns: (projectId: string) => void;
}

export const useRuns = create<RunState>()(
  persist(
    (set) => ({
      runs: {},
      addRun: (run) => {
        const parsed = runSchema.safeParse(run);
        if (!parsed.success) return false;
        set((s) => ({
          runs: { ...s.runs, [run.projectId]: [...(s.runs[run.projectId] ?? []), parsed.data] },
        }));
        return true;
      },
      updateRun: (run) => {
        const parsed = runSchema.safeParse({ ...run, updatedAt: new Date().toISOString() });
        if (!parsed.success) return false;
        set((s) => ({
          runs: {
            ...s.runs,
            [run.projectId]: (s.runs[run.projectId] ?? []).map((r) =>
              r.id === run.id ? parsed.data : r,
            ),
          },
        }));
        return true;
      },
      removeRun: (projectId, id) =>
        set((s) => ({
          runs: { ...s.runs, [projectId]: (s.runs[projectId] ?? []).filter((r) => r.id !== id) },
        })),
      removeProjectRuns: (projectId) =>
        set((s) => ({
          runs: Object.fromEntries(Object.entries(s.runs).filter(([k]) => k !== projectId)),
        })),
    }),
    { name: 'scv.runs.v1', version: 1 },
  ),
);
