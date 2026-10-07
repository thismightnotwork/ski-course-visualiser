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

type View = { kind: 'list' } | { kind: 'edit'; runId: string | null } | { kind: 'report'; runId: string };

const EMPTY: Run[] = [];
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';

export default function RunsTab({ project, course }: { project: Project; course: Course }) {
  const runs = useRuns((s) => s.runs[project.id] ?? EMPTY);
  const [view, setView] = useState<View>({ kind: 'list' });
  const find = (id: string | null) => runs.find((r) => r.id === id) ?? null;

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
    <section className='space-y-3'>
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          className='rounded bg-sky-700 px-4 py-2 text-white'
          onClick={() => setView({ kind: 'edit', runId: null })}
        >
          New run
        </button>
        <button type='button' className={btn} onClick={addSample}>
          Add sample run (demo data)
        </button>
        {runs.length > 0 && (
          <>
            <button
              type='button'
              className={btn}
              onClick={() => download(`${slug(project.name)}-runs.csv`, runsToCsv(runs), 'text/csv')}
            >
              Export runs CSV
            </button>
            <button
              type='button'
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

      {sorted.length === 0 ? (
        <div className='rounded border border-dashed border-slate-400 p-8 text-center'>
          <h2 className='text-lg font-semibold'>No runs yet</h2>
          <p className='mt-2 text-sm'>
            Record a run with its time, penalties and mistakes. Runs are stored in this browser only.
          </p>
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left'>
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
                  <tr key={r.id} className='border-t border-slate-300 dark:border-slate-700'>
                    <td>{r.skier}</td>
                    <td>{r.date}</td>
                    <td>{formatTime(t.rawTimeSec)}</td>
                    <td>{formatTime(t.penaltyTotalSec)}</td>
                    <td>{formatTime(t.adjustedTimeSec)}</td>
                    <td>{t.mistakeCount}</td>
                    <td className='space-x-1 whitespace-nowrap py-1'>
                      <button
                        type='button'
                        className={btn}
                        onClick={() => setView({ kind: 'edit', runId: r.id })}
                      >
                        Edit
                      </button>
                      <button
                        type='button'
                        className={btn}
                        onClick={() => setView({ kind: 'report', runId: r.id })}
                      >
                        Report
                      </button>
                      <button
                        type='button'
                        className='rounded border border-red-600 px-3 py-1 text-sm text-red-700 dark:text-red-400'
                        onClick={() => {
                          if (window.confirm(`Delete the run for "${r.skier}"? This cannot be undone.`)) {
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
