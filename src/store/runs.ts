import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { runSchema, type Run } from '../domain/run';
import type { PathPoint } from '../domain/path';

interface RunState {
  runs: Record<string, Run[]>;
  addRun: (run: Run) => boolean;
  updateRun: (run: Run) => boolean;
  removeRun: (projectId: string, id: string) => void;
  removeProjectRuns: (projectId: string) => void;
}

/**
 * Migrate persisted run data when the store version changes.
 * Version 2: ensure every run has a `path` field.
 */
export function migrateRuns(persisted: unknown, version: number): { runs: Record<string, Run[]> } {
  const saved = (persisted as { runs?: Record<string, Run[]> } | null)?.runs ?? {};
  if (version < 2) {
    return {
      runs: Object.fromEntries(
        Object.entries(saved).map(([projectId, runs]) => [
          projectId,
          runs.map((run) => ({ ...run, path: (run as { path?: PathPoint[] }).path ?? [] })),
        ]),
      ),
    };
  }
  return { runs: saved };
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
    {
      name: 'scv.runs.v1',
      version: 2,
      partialize: (state) => ({ runs: state.runs }),
      migrate: migrateRuns,
    },
  ),
);
