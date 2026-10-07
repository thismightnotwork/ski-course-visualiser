import { useRef } from 'react';
import type { Course } from '../domain/course';
import type { Project } from '../domain/project';
import { COURSE_TYPE_LABELS } from '../domain/project';
import { MISTAKE_LABELS, type Run } from '../domain/run';
import { mistakesToCsv } from '../domain/runExport';
import { computeTiming, formatTime, mistakesPerSection, runWarnings } from '../domain/timing';
import { formatLength } from '../domain/units';
import { download, slug } from '../lib/download';
import CoursePlanStatic from './CoursePlanStatic';

const btn = 'rounded border border-slate-400 px-3 py-1 text-sm print:hidden';

export default function RunReport({
  project,
  course,
  run,
  onBack,
}: {
  project: Project;
  course: Course;
  run: Run;
  onBack: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const units = project.units;
  const timing = computeTiming(run);
  const gates = course.elements
    .filter((e) => e.number !== null)
    .map((e) => ({ number: e.number as number, y: e.y }));
  const sections = mistakesPerSection(run.mistakes, gates);
  const warnings = runWarnings(
    run,
    gates.map((g) => g.number),
  );
  const marked = run.mistakes.map((m) => m.gateNumber).filter((n): n is number => n !== null);

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const w = 800;
    clone.setAttribute('width', String(w));
    clone.setAttribute(
      'height',
      String(Math.round((w * (course.length + 8)) / (course.width + 8))),
    );
    clone.removeAttribute('class');
    download(
      `${slug(project.name)}-plan.svg`,
      new XMLSerializer().serializeToString(clone),
      'image/svg+xml',
    );
  };

  return (
    <article className='space-y-4'>
      <div className='flex flex-wrap gap-2'>
        <button type='button' className={btn} onClick={onBack}>
          Back to runs
        </button>
        <button type='button' className={btn} onClick={() => window.print()}>
          Print or save as PDF
        </button>
        <button
          type='button'
          className={btn}
          onClick={() =>
            download(`${slug(run.skier)}-${run.date}-mistakes.csv`, mistakesToCsv(run), 'text/csv')
          }
        >
          Export mistakes CSV
        </button>
        <button type='button' className={btn} onClick={downloadSvg}>
          Download plan SVG
        </button>
      </div>

      <header>
        <h2 className='text-2xl font-bold'>Run report: {run.skier}</h2>
        <p className='text-sm'>
          {project.name} / {COURSE_TYPE_LABELS[project.courseType]} / {run.date}
        </p>
      </header>

      <section className='grid gap-2 text-sm sm:grid-cols-2'>
        <p>Total time entered: {formatTime(run.totalTimeSec)}</p>
        <p>
          Start / finish delay removed: {formatTime(run.startDelaySec)} / {formatTime(run.finishDelaySec)}
        </p>
        <p>Raw time: {formatTime(timing.rawTimeSec)}</p>
        <p>
          Penalty: {formatTime(timing.penaltyTotalSec)} (manual {formatTime(timing.manualPenaltySec)}
          , from mistakes {formatTime(timing.mistakePenaltySec)})
        </p>
        <p className='font-semibold'>Adjusted time: {formatTime(timing.adjustedTimeSec)}</p>
        <p>Mistakes: {timing.mistakeCount}</p>
        <p className='sm:col-span-2'>
          Average between gates:{' '}
          {timing.avgGateTimeSec === null ? 'not available' : formatTime(timing.avgGateTimeSec)} (
          {timing.avgGateNote})
        </p>
      </section>

      <section>
        <h3 className='font-semibold'>Course</h3>
        <p className='text-sm'>
          {formatLength(course.width, units)} wide by {formatLength(course.length, units)} long (source:{' '}
          {course.dimensionSource}).{' '}
          {course.slopeAngleDeg === null
            ? 'Slope angle not entered.'
            : `Slope angle ${course.slopeAngleDeg} degrees (entered).`}{' '}
          {course.calibration
            ? 'A photo calibration is stored with this course.'
            : 'No photo calibration.'}
        </p>
        <div className='mt-2 max-w-md'>
          <CoursePlanStatic ref={svgRef} course={course} markedGates={marked} />
        </div>
        <p className='text-xs'>Orange rings mark gates with a recorded mistake.</p>
      </section>

      {timing.segments.length > 0 && (
        <section>
          <h3 className='font-semibold'>Gate-to-gate splits</h3>
          <table className='mt-1 w-full max-w-md text-sm'>
            <thead>
              <tr className='text-left'>
                <th>Section</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {timing.segments.map((s) => (
                <tr key={s.label}>
                  <td>{s.label}</td>
                  <td>{formatTime(s.seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3 className='font-semibold'>Mistakes per section</h3>
        {sections.length === 0 ? (
          <p className='text-sm'>No gates in the course, so sections are not available.</p>
        ) : (
          <ul className='text-sm'>
            {sections.map((s) => (
              <li key={s.label}>
                {s.label}: {s.count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className='font-semibold'>Mistake timeline</h3>
        {run.mistakes.length === 0 ? (
          <p className='text-sm'>No mistakes recorded.</p>
        ) : (
          <table className='mt-1 w-full text-sm'>
            <thead>
              <tr className='text-left'>
                <th>Time</th>
                <th>Type</th>
                <th>Gate</th>
                <th>Duration</th>
                <th>Severity</th>
                <th>Confidence</th>
                <th>Source</th>
                <th>Penalty</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...run.mistakes]
                .sort((a, b) => a.timeSec - b.timeSec)
                .map((m) => (
                  <tr key={m.id}>
                    <td>{formatTime(m.timeSec)}</td>
                    <td>{MISTAKE_LABELS[m.type]}</td>
                    <td>{m.gateNumber ?? '-'}</td>
                    <td>{formatTime(m.durationSec)}</td>
                    <td>{m.severity}</td>
                    <td>{Math.round(m.confidence * 100)}%</td>
                    <td>{m.source === 'auto' ? 'automatic (unverified)' : 'manual'}</td>
                    <td>{formatTime(m.penaltySec)}</td>
                    <td>{m.notes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {run.notes && (
        <section>
          <h3 className='font-semibold'>Notes</h3>
          <p className='text-sm'>{run.notes}</p>
        </section>
      )}

      {warnings.length > 0 && (
        <ul className='list-disc rounded border border-amber-500 p-3 pl-8 text-sm'>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <p className='text-xs'>
        Times and mistakes are as entered by the user. This is a training record, not an official
        result, and it makes no claim of competition-legal or biomechanical accuracy.
      </p>
    </article>
  );
}
