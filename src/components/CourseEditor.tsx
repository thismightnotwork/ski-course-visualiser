import { useEffect, useState } from 'react';
import {
  COLOUR_LABELS,
  DATA_SOURCES,
  ELEMENT_COLOURS,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
  POLE_TYPES,
  type Course,
  type CourseElement,
  type ElementColour,
  type ElementType,
} from '../domain/course';
import { boundsWarnings, verticalDrop } from '../domain/geometry';
import type { Project } from '../domain/project';
import { formatLength, fromMetres, toMetres, unitLabel } from '../domain/units';
import { useCourses } from '../store/courses';
import CourseCanvas from './CourseCanvas';
import ImportExportPanel from './ImportExportPanel';
import NumberField from './NumberField';

const btn = 'rounded border border-slate-400 px-3 py-1 text-sm disabled:opacity-40';
const input = 'mt-1 w-full rounded border border-slate-400 bg-white p-1 dark:bg-slate-800';

function SetupForm({ project }: { project: Project }) {
  const create = useCourses((s) => s.createCourse);
  const [width, setWidth] = useState(project.units === 'feet' ? '66' : '20');
  const [length, setLength] = useState(project.units === 'feet' ? '400' : '120');
  const [error, setError] = useState('');
  const u = unitLabel(project.units);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = create(
      project.id,
      toMetres(Number(width), project.units),
      toMetres(Number(length), project.units),
    );
    setError(ok ? '' : 'Enter a positive width and length.');
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-3 rounded border border-slate-400 p-4">
      <h2 className="text-xl font-semibold">Create course</h2>
      <p className="text-sm">
        Enter the course area. These are treated as exact measurements you entered. Gate positions
        are added next.
      </p>
      <label className="block">
        Course width ({u})
        <input className={input} value={width} onChange={(e) => setWidth(e.target.value)} />
      </label>
      <label className="block">
        Course length down the slope ({u})
        <input className={input} value={length} onChange={(e) => setLength(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button type="submit" className="rounded bg-sky-700 px-4 py-2 text-white">
        Create course
      </button>
    </form>
  );
}

function EditorBody({ project, course }: { project: Project; course: Course }) {
  const pid = project.id;
  const units = project.units;
  const u = unitLabel(units);
  const actions = useCourses.getState();
  const canUndo = useCourses((s) => (s.past[pid]?.length ?? 0) > 0);
  const canRedo = useCourses((s) => (s.future[pid]?.length ?? 0) > 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ElementType | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [placeColour, setPlaceColour] = useState<ElementColour | 'auto'>('auto');
  const [placePoles, setPlacePoles] = useState<'auto' | '1' | '2'>('auto');

  const dv = (m: number) => fromMetres(m, units);
  const selected = course.elements.find((e) => e.id === selectedId) ?? null;
  const warnings = boundsWarnings(course);
  const hasPoleChoice = selected !== null && POLE_TYPES.includes(selected.type);
  const showWidth = selected !== null && !(hasPoleChoice && selected.poles === 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const s = useCourses.getState();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo(pid);
        else s.undo(pid);
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo(pid);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        s.removeElement(pid, selectedId);
        setSelectedId(null);
      } else if (key === 'r' && !mod && selectedId) {
        const el = s.courses[pid]?.elements.find((x) => x.id === selectedId);
        if (el) s.updateElement(pid, selectedId, { rotationDeg: (el.rotationDeg + 15) % 360 });
      } else if (e.key === 'Escape') {
        setTool(null);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pid, selectedId]);

  const setEl = (patch: Partial<CourseElement>) =>
    selected ? actions.updateElement(pid, selected.id, patch) : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Course tools">
        <button
          type="button"
          className={btn}
          aria-pressed={tool === null}
          onClick={() => setTool(null)}
        >
          Select / move
        </button>
        {ELEMENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${btn} ${tool === t ? 'bg-sky-700 text-white' : ''}`}
            aria-pressed={tool === t}
            onClick={() => setTool(t)}
          >
            + {ELEMENT_LABELS[t]}
          </button>
        ))}
        <button type="button" className={btn} disabled={!canUndo} onClick={() => actions.undo(pid)}>
          Undo
        </button>
        <button type="button" className={btn} disabled={!canRedo} onClick={() => actions.redo(pid)}>
          Redo
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label>
          New colour{' '}
          <select
            className="rounded border border-slate-400 bg-white p-1 dark:bg-slate-800"
            value={placeColour}
            onChange={(e) => setPlaceColour(e.target.value as ElementColour | 'auto')}
          >
            <option value="auto">Default</option>
            {ELEMENT_COLOURS.map((c) => (
              <option key={c} value={c}>
                {COLOUR_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          New poles{' '}
          <select
            className="rounded border border-slate-400 bg-white p-1 dark:bg-slate-800"
            value={placePoles}
            onChange={(e) => setPlacePoles(e.target.value as 'auto' | '1' | '2')}
          >
            <option value="auto">Default</option>
            <option value="1">Single pole</option>
            <option value="2">Pair of poles</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />{' '}
          Grid
        </label>
        <label>
          <input
            type="checkbox"
            checked={showGuides}
            onChange={(e) => setShowGuides(e.target.checked)}
          />{' '}
          Measurement guides
        </label>
      </div>
      <p className="text-xs">
        {tool
          ? `Click the plan to place: ${ELEMENT_LABELS[tool]}. Esc to stop.`
          : 'Drag elements to move them; drag the background to pan. Shortcuts: Ctrl+Z undo, Ctrl+Y redo, Delete remove, R rotate 15 degrees, Esc deselect.'}{' '}
        Saved automatically in this browser (last change{' '}
        {new Date(course.updatedAt).toLocaleTimeString('en-GB')}).
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <CourseCanvas
          course={course}
          units={units}
          selectedId={selectedId}
          placing={tool !== null}
          showGrid={showGrid}
          showGuides={showGuides}
          onSelect={setSelectedId}
          onPlace={(x, y) => {
            if (!tool) return;
            const overrides: Partial<CourseElement> = {};
            if (placeColour !== 'auto') overrides.colour = placeColour;
            if (placePoles !== 'auto') overrides.poles = placePoles === '1' ? 1 : 2;
            const id = actions.addElement(pid, tool, x, y, overrides);
            if (id) setSelectedId(id);
          }}
          onDragStart={() => actions.checkpoint(pid)}
          onDragMove={(id, x, y) => {
            actions.updateElement(pid, id, { x, y }, false);
          }}
        />

        <aside className="space-y-4">
          <section className="space-y-2 rounded border border-slate-400 p-3">
            <h2 className="font-semibold">Course</h2>
            <p className="text-xs">Dimension source: {course.dimensionSource}</p>
            <NumberField
              label="Width"
              unit={u}
              value={dv(course.width)}
              onCommit={(v) => v !== null && actions.setCourseFields(pid, { width: toMetres(v, units) })}
            />
            <NumberField
              label="Length"
              unit={u}
              value={dv(course.length)}
              onCommit={(v) =>
                v !== null && actions.setCourseFields(pid, { length: toMetres(v, units) })
              }
            />
            <NumberField
              label="Slope angle (deg, if known)"
              nullable
              value={course.slopeAngleDeg}
              onCommit={(v) => actions.setCourseFields(pid, { slopeAngleDeg: v })}
            />
            <NumberField
              label="Start elevation"
              unit={u}
              nullable
              value={course.startElevation === null ? null : dv(course.startElevation)}
              onCommit={(v) =>
                actions.setCourseFields(pid, {
                  startElevation: v === null ? null : toMetres(v, units),
                })
              }
            />
            {course.slopeAngleDeg !== null && (
              <p className="text-xs">
                Vertical drop from entered angle:{' '}
                {formatLength(verticalDrop(course.length, course.slopeAngleDeg), units)}
              </p>
            )}
          </section>

          {warnings.length > 0 && (
            <ul className="rounded border border-amber-500 p-3 text-sm">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <section className="space-y-2 rounded border border-slate-400 p-3">
            <h2 className="font-semibold">Selected element</h2>
            {!selected ? (
              <p className="text-sm">Nothing selected.</p>
            ) : (
              <>
                <label className="block text-sm">
                  Type
                  <select
                    className={input}
                    value={selected.type}
                    onChange={(e) => setEl({ type: e.target.value as ElementType })}
                  >
                    {ELEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ELEMENT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs">Gate number: {selected.number ?? 'not numbered'}</p>
                {hasPoleChoice && (
                  <label className="block text-sm">
                    Poles
                    <select
                      className={input}
                      value={String(selected.poles)}
                      onChange={(e) => setEl({ poles: e.target.value === '1' ? 1 : 2 })}
                    >
                      <option value="1">Single pole</option>
                      <option value="2">Pair of poles</option>
                    </select>
                  </label>
                )}
                <label className="block text-sm">
                  Colour
                  <select
                    className={input}
                    value={selected.colour}
                    onChange={(e) => setEl({ colour: e.target.value as ElementColour })}
                  >
                    {ELEMENT_COLOURS.map((c) => (
                      <option key={c} value={c}>
                        {COLOUR_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="X"
                  unit={u}
                  value={dv(selected.x)}
                  onCommit={(v) => v !== null && setEl({ x: toMetres(v, units) })}
                />
                <NumberField
                  label="Y"
                  unit={u}
                  value={dv(selected.y)}
                  onCommit={(v) => v !== null && setEl({ y: toMetres(v, units) })}
                />
                {showWidth && (
                  <>
                    <NumberField
                      label="Rotation (deg)"
                      value={selected.rotationDeg}
                      onCommit={(v) => v !== null && setEl({ rotationDeg: v })}
                    />
                    <NumberField
                      label="Width"
                      unit={u}
                      value={dv(selected.width)}
                      onCommit={(v) => v !== null && setEl({ width: toMetres(v, units) })}
                    />
                  </>
                )}
                <NumberField
                  label="Elevation"
                  unit={u}
                  nullable
                  value={selected.elevation === null ? null : dv(selected.elevation)}
                  onCommit={(v) => setEl({ elevation: v === null ? null : toMetres(v, units) })}
                />
                <label className="block text-sm">
                  Position source
                  <select
                    className={input}
                    value={selected.source}
                    onChange={(e) => setEl({ source: e.target.value as (typeof DATA_SOURCES)[number] })}
                  >
                    {DATA_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Confidence (0 to 1)"
                  value={selected.confidence}
                  onCommit={(v) => v !== null && setEl({ confidence: v })}
                />
                <label className="block text-sm">
                  Notes
                  <textarea
                    key={selected.id}
                    className={input}
                    rows={2}
                    defaultValue={selected.notes}
                    onBlur={(e) => {
                      if (e.target.value !== selected.notes) setEl({ notes: e.target.value });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="rounded border border-red-600 px-3 py-1 text-sm text-red-700 dark:text-red-400"
                  onClick={() => {
                    if (window.confirm('Delete this element? You can undo this afterwards.')) {
                      actions.removeElement(pid, selected.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  Delete element
                </button>
              </>
            )}
          </section>

          <ImportExportPanel project={project} course={course} />

          <section className="rounded border border-slate-400 p-3">
            <h2 className="font-semibold">Elements ({course.elements.length})</h2>
            <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">
              {[...course.elements]
                .sort((a, b) => a.y - b.y)
                .map((el) => (
                  <li key={el.id}>
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-1 text-left ${el.id === selectedId ? 'bg-sky-700 text-white' : ''}`}
                      onClick={() => setSelectedId(el.id)}
                    >
                      {el.number !== null ? `#${el.number} ` : ''}
                      {ELEMENT_LABELS[el.type]} ({dv(el.x).toFixed(1)}, {dv(el.y).toFixed(1)} {u})
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function CourseEditor({ project }: { project: Project }) {
  const course = useCourses((s) => s.courses[project.id]);
  return course ? (
    <EditorBody project={project} course={course} />
  ) : (
    <SetupForm project={project} />
  );
}
