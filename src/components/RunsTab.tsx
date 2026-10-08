import { useState } from 'react';
import type { Course } from '../domain/course';
import type { Project } from '../domain/project';
import type { Run } from '../domain/run';
import { draftToRun, sampleDraft } from '../domain/runDraft';
import { exportRunsJson, runsToCsv } from '../domain/runExport';
import { computeTiming, formatTime } from '../domain/timing';
import { download, slug } from '../lib/download';
import { useRuns } from '../store/runs';
import RunEditor from './RunEditor';
import RunReport from './RunReport';
import Scene3D from './Scene3D';

type View =
  { kind: 'list' } | { kind: 'edit'; runId: string | null } | { kind: 'report'; runId: string };

const EMPTY: Run[] = [];
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';

export default function RunsTab({ project, course }: { project: Project; course: Course }) {
  const runs = useRuns((state) => state.runs[project.id] ?? EMPTY);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [showPlayback, setShowPlayback] = useState(false);
  const [playbackRunId, setPlaybackRunId] = useState<string | null>(null);

  const find = (id: string | null) => runs.find((run) => run.id === id) ?? null;
  const playbackRun = find(playbackRunId);

  if (view.kind === 'edit') {
    return (
      <RunEditor
        project={project}
        course={course}
        run={find(view.runId)}
        onDone={() => setView({ kind: 'list' })}
      />
    );
  }
  if (view.kind === 'report') {
    const run = find(view.runId);
    if (run) {
      return (
        <RunReport
          project={project}
          course={course}
          run={run}
          onBack={() => setView({ kind: 'list' })}
        />
      );
    }
  }

  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  const addSample = () => {
    const gateNumbers = course.elements
      .map((e) => e.number)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    const result = draftToRun(sampleDraft(new Date().toISOString().slice(0, 10), gateNumbers), {
      projectId: project.id,
      courseId: course.id,
      units: project.units,
    });
    if (result.ok) useRuns.getState().addRun(result.run);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-sky-700 px-4 py-2 text-white"
          onClick={() => setView({ kind: 'edit', runId: null })}
        >
          New run
        </button>
        <button type="button" className={btn} onClick={addSample}>
          Add sample run (demo data)
        </button>

        <button type="button" className={btn} onClick={() => setShowPlayback((value) => !value)}>
          {showPlayback ? 'Hide 3D playback' : 'Show 3D playback'}
        </button>

        {runs.length > 0 && (
          <>
            <button
              type="button"
              className={btn}
              onClick={() =>
                download(`${slug(project.name)}-runs.csv`, runsToCsv(runs), 'text/csv')
              }
            >
              Export runs CSV
            </button>
            <button
              type="button"
              className={btn}
              onClick={() =>
                download(
                  `${slug(project.name)}-runs.json`,
                  exportRunsJson({ name: project.name, units: project.units }, course, runs),
                  'application/json',
                )
              }
            >
              Export runs JSON
            </button>
          </>
        )}
      </div>

      {showPlayback && (
        <section className="space-y-2 rounded border border-slate-400 p-3">
          <h2 className="text-xl font-semibold">Course playback</h2>

          {runs.length > 0 ? (
            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="block">
                Select run for playback
                <select
                  className="mt-1 w-full rounded border border-slate-400 bg-white p-1 dark:bg-slate-800"
                  value={playbackRunId ?? ''}
                  onChange={(e) => setPlaybackRunId(e.target.value || null)}
                >
                  <option value="">No run selected (default route)</option>
                  {sorted.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.skier} — {formatTime(run.totalTimeSec)} —{' '}
                      {run.path.length > 0 ? 'custom path' : 'default path'}
                    </option>
                  ))}
                </select>
              </label>
              {playbackRun && (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Path: {playbackRun.path.length > 0 ? 'custom route' : 'default route'}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm">
              No runs saved yet. Create a run first to select it for playback.
            </p>
          )}

          <p className="text-sm">
            This is a simulated skier following the{' '}
            {playbackRun && playbackRun.path.length > 0
              ? 'custom path for that run'
              : 'default course route'}{' '}
            (start → gates → finish). It does not reconstruct the skier's exact line from video.
          </p>

          <Scene3D course={course} run={playbackRun ?? undefined} />
        </section>
      )}

      {sorted.length === 0 ? (
        <div className="rounded border border-dashed border-slate-400 p-8 text-center">
          <h2 className="text-lg font-semibold">No runs yet</h2>
          <p className="mt-2 text-sm">
            Record a run with its time, penalties and mistakes. Runs are stored in this browser
            only.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Skier</th>
                <th>Date</th>
                <th>Raw</th>
                <th>Penalty</th>
                <th>Adjusted</th>
                <th>Mistakes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const t = computeTiming(r);
                return (
                  <tr key={r.id} className="border-t border-slate-300 dark:border-slate-700">
                    <td>{r.skier}</td>
                    <td>{r.date}</td>
                    <td>{formatTime(t.rawTimeSec)}</td>
                    <td>{formatTime(t.penaltyTotalSec)}</td>
                    <td>{formatTime(t.adjustedTimeSec)}</td>
                    <td>{t.mistakeCount}</td>
                    <td className="space-x-1 whitespace-nowrap py-1">
                      <button
                        type="button"
                        className={btn}
                        onClick={() => setView({ kind: 'edit', runId: r.id })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={btn}
                        onClick={() => setView({ kind: 'report', runId: r.id })}
                      >
                        Report
                      </button>
                      <button
                        type="button"
                        className="rounded border border-red-600 px-3 py-1 text-sm text-red-700 dark:text-red-400"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete the run for "${r.skier}"? This cannot be undone.`,
                            )
                          ) {
                            useRuns.getState().removeRun(project.id, r.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
