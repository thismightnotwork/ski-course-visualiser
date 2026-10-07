import { useState } from 'react';
import { ELEMENT_LABELS, type Course, type CourseElement } from '../domain/course';
import { distance } from '../domain/geometry';
import type { Project } from '../domain/project';
import { formatLength, fromMetres, toMetres, unitLabel } from '../domain/units';
import { useCourses } from '../store/courses';
import NumberField from './NumberField';

export default function DistancePanel({ project, course }: { project: Project; course: Course }) {
  const units = project.units;
  const u = unitLabel(units);
  const els = [...course.elements].sort((a, b) => a.y - b.y);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const a = els.find((e) => e.id === idA);
  const b = els.find((e) => e.id === idB);
  const d = a && b ? distance(a, b) : null;

  const label = (e: CourseElement) =>
    `${e.number !== null ? `#${e.number} ` : ''}${ELEMENT_LABELS[e.type]} (${fromMetres(e.x, units).toFixed(1)}, ${fromMetres(e.y, units).toFixed(1)} ${u})`;

  const setDistance = (value: number | null) => {
    if (value === null || !a || !b || d === null || d < 1e-9) return false;
    const target = toMetres(value, units);
    if (!(target > 0)) return false;
    const k = target / d;
    return useCourses
      .getState()
      .updateElement(project.id, b.id, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  };

  const select = (value: string, onChange: (v: string) => void, name: string) => (
    <label className='block text-sm'>
      {name}
      <select
        className='mt-1 w-full rounded border border-slate-400 bg-white p-1 dark:bg-slate-800'
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value=''>Choose an element</option>
        {els.map((e) => (
          <option key={e.id} value={e.id}>
            {label(e)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className='max-w-xl space-y-2 rounded border border-slate-400 p-3'>
      <h2 className='font-semibold'>Distance between elements</h2>
      {select(idA, setIdA, 'From')}
      {select(idB, setIdB, 'To')}
      {a && b && d !== null && (
        <>
          <p className='text-sm'>
            Distance: {formatLength(d, units)} (dx {formatLength(Math.abs(b.x - a.x), units)}, dy{' '}
            {formatLength(Math.abs(b.y - a.y), units)}). Position sources: {a.source} / {b.source}.
            {(a.source === 'estimated' || b.source === 'estimated') && ' Treat this as an estimate.'}
          </p>
          <NumberField
            label='Set distance (moves the second element along the line)'
            unit={u}
            value={fromMetres(d, units)}
            onCommit={setDistance}
          />
        </>
      )}
    </section>
  );
}
