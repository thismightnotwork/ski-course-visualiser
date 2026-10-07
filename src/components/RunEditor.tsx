import { useMemo, useState } from 'react';
import type { Course } from '../domain/course';
import type { Project } from '../domain/project';
import {
  MISTAKE_LABELS,
  MISTAKE_TYPES,
  SEVERITIES,
  type MistakeType,
  type Run,
  type Severity,
} from '../domain/run';
import {
  draftToRun,
  emptyDraft,
  newMistakeDraft,
  newSplitDraft,
  runToDraft,
  type MistakeDraft,
  type RunDraft,
  type SplitDraft,
} from '../domain/runDraft';
import { computeTiming, formatTime, runWarnings } from '../domain/timing';
import { unitLabel } from '../domain/units';
import { useRuns } from '../store/runs';

const input = 'mt-1 w-full rounded border border-slate-400 bg-white p-1 dark:bg-slate-800';
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm';
const SEVERITY_COLOUR: Record<Severity, string> = {
  minor: '#eab308',
  moderate: '#f97316',
  major: '#dc2626',
};

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className='block text-sm'>
      {label}
      <input
        className={input}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

interface Props {
  project: Project;
  course: Course;
  run: Run | null;
  onDone: () => void;
}

export default function RunEditor({ project, course, run, onDone }: Props) {
  const units = project.units;
  const u = unitLabel(units);
  const [draft, setDraft] = useState<RunDraft>(() =>
    run ? runToDraft(run, units) : emptyDraft(new Date().toISOString().slice(0, 10)),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const result = useMemo(
    () =>
      draftToRun(draft, {
        projectId: project.id,
        courseId: course.id,
        units,
        id: run?.id,
        createdAt: run?.createdAt,
      }),
    [draft, project.id, course.id, units, run?.id, run?.createdAt],
  );
  const gateNumbers = course.elements
    .map((e) => e.number)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const set = <K extends keyof RunDraft>(key: K, value: RunDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const patchMistake = (id: string, patch: Partial<MistakeDraft>) =>
    setDraft((d) => ({
      ...d,
      mistakes: d.mistakes.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  const patchSplit = (id: string, patch: Partial<SplitDraft>) =>
    setDraft((d) => ({
      ...d,
      splits: d.splits.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const save = () => {
    if (!result.ok) {
      setSaveError('Fix the problems listed below before saving.');
      return;
    }
    const store = useRuns.getState();
    const ok = run ? store.updateRun(result.run) : store.addRun(result.run);
    if (!ok) {
      setSaveError('The run was rejected by validation.');
      return;
    }
    onDone();
  };

  const timing = result.ok ? computeTiming(result.run) : null;
  const warnings = result.ok ? runWarnings(result.run, gateNumbers) : [];

  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-semibold'>{run ? 'Edit run' : 'New run'}</h2>

      <section className='grid gap-3 rounded border border-slate-400 p-3 sm:grid-cols-2'>
        <div>
          <Text label='Skier name or ID' value={draft.skier} onChange={(v) => set('skier', v)} />
          <p className='text-xs'>
            A nickname or ID is fine. Use one instead of a full name for skiers under 18.
          </p>
        </div>
        <label className='block text-sm'>
          Run date
          <input
            type='date'
            className={input}
            value={draft.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </label>
        <Text label='Total time' value={draft.total} onChange={(v) => set('total', v)} placeholder='1:23.45 or 83.45' />
        <Text label='Penalty time (seconds)' value={draft.penalty} onChange={(v) => set('penalty', v)} />
        <Text label='Start delay (seconds)' value={draft.startDelay} onChange={(v) => set('startDelay', v)} />
        <Text label='Finish delay (seconds)' value={draft.finishDelay} onChange={(v) => set('finishDelay', v)} />
        <p className='text-xs sm:col-span-2'>
          Start and finish delay are seconds inside the total that were not skiing (for example a
          late start signal). They are subtracted to give the raw time. Penalties are added after.
        </p>
        <label className='block text-sm sm:col-span-2'>
          Notes
          <textarea
            className={input}
            rows={2}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
      </section>

      <section className='space-y-3 rounded border border-slate-400 p-3'>
        <div className='flex items-center justify-between'>
          <h3 className='font-semibold'>Mistakes ({draft.mistakes.length})</h3>
          <button
            type='button'
            className={btn}
            onClick={() => set('mistakes', [...draft.mistakes, newMistakeDraft()])}
          >
            Add mistake
          </button>
        </div>
        {result.ok && result.run.totalTimeSec > 0 && (
          <div
            className='relative h-8 rounded bg-slate-200 dark:bg-slate-700'
            role='img'
            aria-label='Mistake timeline'
          >
            {result.run.mistakes.map((m) => (
              <span
                key={m.id}
                title={`${MISTAKE_LABELS[m.type]} at ${formatTime(m.timeSec)} (${m.severity})`}
                className='absolute top-1 h-6 w-2 rounded'
                style={{
                  left: `${Math.min(100, (m.timeSec / result.run.totalTimeSec) * 100)}%`,
                  background: SEVERITY_COLOUR[m.severity],
                }}
              />
            ))}
          </div>
        )}
        {draft.mistakes.length === 0 && <p className='text-sm'>No mistakes recorded.</p>}
        {draft.mistakes.map((m, i) => (
          <fieldset key={m.id} className='grid gap-2 rounded border border-slate-300 p-2 sm:grid-cols-4'>
            <legend className='px-1 text-sm'>
              Mistake {i + 1} ({m.source === 'auto' ? 'automatic, unverified' : 'manual'})
            </legend>
            <label className='block text-sm'>
              Type
              <select
                className={input}
                value={m.type}
                onChange={(e) => patchMistake(m.id, { type: e.target.value as MistakeType })}
              >
                {MISTAKE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MISTAKE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <Text label='Time' value={m.time} onChange={(v) => patchMistake(m.id, { time: v })} placeholder='12.5' />
            <Text label='Gate number' value={m.gate} onChange={(v) => patchMistake(m.id, { gate: v })} />
            <Text
              label={`Position down course (${u})`}
              value={m.position}
              onChange={(v) => patchMistake(m.id, { position: v })}
            />
            <Text
              label='Duration (seconds)'
              value={m.duration}
              onChange={(v) => patchMistake(m.id, { duration: v })}
            />
            <label className='block text-sm'>
              Severity
              <select
                className={input}
                value={m.severity}
                onChange={(e) => patchMistake(m.id, { severity: e.target.value as Severity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <Text
              label='Confidence (0 to 1)'
              value={m.confidence}
              onChange={(v) => patchMistake(m.id, { confidence: v })}
            />
            <Text
              label='Penalty (seconds)'
              value={m.penalty}
              onChange={(v) => patchMistake(m.id, { penalty: v })}
            />
            <div className='sm:col-span-3'>
              <Text label='Notes' value={m.notes} onChange={(v) => patchMistake(m.id, { notes: v })} />
            </div>
            <button
              type='button'
              className={`${btn} self-end`}
              onClick={() => set('mistakes', draft.mistakes.filter((x) => x.id !== m.id))}
            >
              Remove
            </button>
          </fieldset>
        ))}
      </section>

      <section className='space-y-3 rounded border border-slate-400 p-3'>
        <div className='flex items-center justify-between'>
          <h3 className='font-semibold'>Gate split times (optional)</h3>
          <button
            type='button'
            className={btn}
            onClick={() => set('splits', [...draft.splits, newSplitDraft()])}
          >
            Add split
          </button>
        </div>
        <p className='text-xs'>
          Time from the start to each gate. Gates in this course:{' '}
          {gateNumbers.length > 0 ? `${gateNumbers[0]} to ${gateNumbers[gateNumbers.length - 1]}` : 'none yet'}.
        </p>
        {draft.splits.map((s) => (
          <div key={s.id} className='flex flex-wrap items-end gap-2'>
            <Text label='Gate' value={s.gate} onChange={(v) => patchSplit(s.id, { gate: v })} />
            <Text label='Time' value={s.time} onChange={(v) => patchSplit(s.id, { time: v })} />
            <button
              type='button'
              className={btn}
              onClick={() => set('splits', draft.splits.filter((x) => x.id !== s.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className='space-y-1 rounded border border-slate-400 p-3 text-sm' aria-live='polite'>
        <h3 className='font-semibold'>Summary</h3>
        {timing ? (
          <>
            <p>Raw time: {formatTime(timing.rawTimeSec)}</p>
            <p>Penalty time: {formatTime(timing.penaltyTotalSec)}</p>
            <p>Adjusted time: {formatTime(timing.adjustedTimeSec)}</p>
            <p>Mistakes: {timing.mistakeCount}</p>
            <p>
              Average between gates:{' '}
              {timing.avgGateTimeSec === null ? 'not available' : formatTime(timing.avgGateTimeSec)} (
              {timing.avgGateNote})
            </p>
          </>
        ) : (
          <ul className='list-disc pl-5 text-red-700 dark:text-red-400'>
            {!result.ok && result.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className='list-disc pl-5'>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {saveError && (
        <p role='alert' className='text-sm text-red-600'>
          {saveError}
        </p>
      )}
      <div className='flex gap-2'>
        <button type='button' className='rounded bg-sky-700 px-4 py-2 text-white' onClick={save}>
          Save run
        </button>
        <button type='button' className={btn} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
