import { useEffect, useRef, useState } from 'react';
import { ELEMENT_LABELS, type Course, type CourseElement } from '../domain/course';
import { elementEnds, isSinglePole } from '../domain/geometry';
import type { PathPoint } from '../domain/path';
import { clampPathToCourse, defaultPath, validatePathPoints } from '../domain/path';
import { formatLength, type Units } from '../domain/units';

const btn = 'rounded border border-slate-400 px-3 py-1 text-sm disabled:opacity-40';
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  course: Course;
  units: Units;
  initialPath: PathPoint[];
  onPathChange: (path: PathPoint[]) => void;
}

type Drag =
  | { kind: 'point'; index: number }
  | { kind: 'pan'; lastX: number; lastY: number; moved: number }
  | null;

export default function PathEditor({ course, units, initialPath, onPathChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag>(null);
  const pathRef = useRef<PathPoint[]>(initialPath);
  const historyRef = useRef<PathPoint[][]>([]);
  const futureRef = useRef<PathPoint[][]>([]);

  const [path, setPath] = useState<PathPoint[]>(initialPath);
  const [editing, setEditing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const vw = (course.width + 8) / zoom;
  const vh = (course.length + 8) / zoom;
  const vx = course.width / 2 + pan.x - vw / 2;
  const vy = course.length / 2 + pan.y - vh / 2;

  const maxDim = Math.max(course.width, course.length);
  const step = maxDim <= 60 ? 1 : maxDim <= 300 ? 5 : 10;
  const gridX: number[] = [];
  for (let x = 0; x <= course.width; x += step) gridX.push(x);
  const gridY: number[] = [];
  for (let y = 0; y <= course.length; y += step) gridY.push(y);

  useEffect(() => {
    const current = JSON.stringify(path);
    const incoming = JSON.stringify(initialPath);
    if (current !== incoming) {
      pathRef.current = initialPath;
      historyRef.current = [];
      futureRef.current = [];
      setPath(initialPath);
      setSelectedIndex(null);
    }
  }, [initialPath, path]);

  const toCourse = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const commitPath = (newPath: PathPoint[]) => {
    if (!validatePathPoints(newPath)) return;
    const clamped = clampPathToCourse(newPath, course);
    historyRef.current.push(pathRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    pathRef.current = clamped;
    setPath(clamped);
    onPathChange(clamped);
  };

  const commitPathRef = useRef(commitPath);
  useEffect(() => {
    commitPathRef.current = commitPath;
  });

  const undoPath = () => {
    if (historyRef.current.length === 0) return;
    const current = pathRef.current;
    const prev = historyRef.current.pop()!;
    futureRef.current.push(current);
    pathRef.current = prev;
    setPath(prev);
    onPathChange(prev);
  };

  const redoPath = () => {
    if (futureRef.current.length === 0) return;
    const current = pathRef.current;
    const next = futureRef.current.pop()!;
    historyRef.current.push(current);
    pathRef.current = next;
    setPath(next);
    onPathChange(next);
  };

  const addPointAt = (x: number, y: number) => {
    const clamped = clampPathToCourse([{ x: round2(x), y: round2(y) }], course)[0];
    commitPath([...path, clamped]);
    setSelectedIndex(path.length);
  };

  const movePoint = (index: number, x: number, y: number) => {
    const clamped = clampPathToCourse([{ x: round2(x), y: round2(y) }], course)[0];
    const next = [...path];
    next[index] = clamped;
    commitPath(next);
    setSelectedIndex(index);
  };

  const resetToDefault = () => {
    const def = clampPathToCourse(defaultPath(course), course);
    commitPath(def);
    setSelectedIndex(null);
  };

  const clearPath = () => {
    commitPath([]);
    setSelectedIndex(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIndex !== null) {
          e.preventDefault();
          commitPathRef.current(pathRef.current.filter((_, i) => i !== selectedIndex));
          setSelectedIndex(null);
        }
      } else if (e.key === 'Escape') {
        setEditing(false);
        setSelectedIndex(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIndex]);

  const onSvgDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editing) {
      dragRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY, moved: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const p = toCourse(e);
    if (!p) return;
    addPointAt(p.x, p.y);
  };

  const onPointDown = (e: React.PointerEvent<SVGGElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIndex(index);
    if (!editing) return;
    dragRef.current = { kind: 'point', index };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'point') {
      const p = toCourse(e);
      if (p) movePoint(d.index, p.x, p.y);
      return;
    }
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    setPan((p) => ({ x: p.x - dx / ctm.a, y: p.y - dy / ctm.d }));
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === 'pan' && d.moved < 3) setSelectedIndex(null);
  };

  const renderCourseShape = (el: CourseElement) => {
    const [a, b] = elementEnds(el);
    if (el.type === 'hazard') {
      return (
        <g key="shape">
          <rect
            x={-el.width / 2}
            y={-el.width / 4}
            width={el.width}
            height={el.width / 2}
            transform={`translate(${el.x} ${el.y}) rotate(${el.rotationDeg})`}
            fill={el.colour}
            fillOpacity={0.3}
            stroke={el.colour}
            strokeWidth={0.1}
          />
        </g>
      );
    }
    if (isSinglePole(el)) {
      return (
        <g key="shape">
          <circle cx={el.x} cy={el.y} r={0.3} fill={el.colour} />
          <circle cx={el.x} cy={el.y} r={0.9} fill="transparent" />
        </g>
      );
    }
    const thick = el.type === 'start' || el.type === 'finish';
    return (
      <g key="shape">
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={el.colour}
          strokeWidth={thick ? 0.35 : 0.18}
          strokeLinecap="round"
        />
        {!thick && (
          <>
            <circle cx={a.x} cy={a.y} r={0.22} fill={el.colour} />
            <circle cx={b.x} cy={b.y} r={0.22} fill={el.colour} />
          </>
        )}
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="transparent"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </g>
    );
  };

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Path editor tools"
      >
        <button
          type="button"
          className={`${btn} ${editing ? 'bg-sky-700 text-white' : ''}`}
          aria-pressed={editing}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Stop editing path' : 'Edit skier path'}
        </button>

        <button
          type="button"
          className={btn}
          disabled={!editing || historyRef.current.length === 0}
          onClick={undoPath}
        >
          Undo
        </button>

        <button
          type="button"
          className={btn}
          disabled={!editing || futureRef.current.length === 0}
          onClick={redoPath}
        >
          Redo
        </button>

        <button type="button" className={btn} onClick={resetToDefault}>
          {path.length === 0 ? 'Initialize from default route' : 'Reset to default route'}
        </button>

        <button type="button" className={btn} onClick={clearPath} disabled={path.length === 0}>
          Clear path
        </button>

        <button
          type="button"
          className={btn}
          onClick={() => setZoom((z) => Math.min(16, z * 1.4))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset view
        </button>
      </div>

      <p className="text-xs">
        {editing
          ? 'Click the plan to add path points. Drag handles to move them. Delete key removes the selected point.'
          : 'Enable "Edit skier path" to add or move points.'}{' '}
        {path.length > 0
          ? `Custom path has ${path.length} point${path.length === 1 ? '' : 's'}.`
          : 'Path is empty (the default route will be used for playback).'}
      </p>

      <div className="relative">
        <svg
          ref={svgRef}
          role="img"
          aria-label="Course plan with skier path"
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          className="h-[40vh] min-h-[240px] w-full touch-none rounded border border-slate-400 text-slate-900 dark:text-slate-100"
          onPointerDown={onSvgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <rect
            x={0}
            y={0}
            width={course.width}
            height={course.length}
            className="fill-sky-100 dark:fill-slate-700"
          />
          <g stroke="#cbd5e1" strokeWidth={0.04} opacity={0.6}>
            {gridX.map((x) => (
              <line key={`x${x}`} x1={x} y1={0} x2={x} y2={course.length} />
            ))}
            {gridY.map((y) => (
              <line key={`y${y}`} x1={0} y1={y} x2={course.width} y2={y} />
            ))}
          </g>
          <rect
            x={0}
            y={0}
            width={course.width}
            height={course.length}
            fill="none"
            stroke="#475569"
            strokeWidth={0.12}
          />
          {course.elements.map((el) => (
            <g key={el.id} style={{ pointerEvents: 'none' }}>
              {renderCourseShape(el)}
              <text
                x={el.x}
                y={el.y - 0.7}
                fontSize={0.9}
                textAnchor="middle"
                fill="currentColor"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {el.number !== null ? el.number : ELEMENT_LABELS[el.type]}
              </text>
            </g>
          ))}
          {path.length > 1 && (
            <polyline
              points={path.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#f97316"
              strokeWidth={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
          )}
          {path.map((p, i) => (
            <g
              key={i}
              onPointerDown={(e) => onPointDown(e, i)}
              style={{ cursor: editing ? 'grab' : 'default' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={selectedIndex === i ? 0.8 : 0.5}
                fill={selectedIndex === i ? '#0ea5e9' : '#f97316'}
                stroke="#111827"
                strokeWidth={0.15}
              />
              <text
                x={p.x}
                y={p.y}
                fontSize={0.7}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontWeight="bold"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {i + 1}
              </text>
            </g>
          ))}
          <g fill="currentColor" stroke="currentColor" strokeWidth={0.06} fontSize={0.9}>
            <line x1={0} y1={-1.5} x2={course.width} y2={-1.5} />
            <text x={course.width / 2} y={-2} textAnchor="middle" stroke="none">
              {formatLength(course.width, units)}
            </text>
            <line x1={-1.5} y1={0} x2={-1.5} y2={course.length} />
            <text
              transform={`translate(-2 ${course.length / 2}) rotate(-90)`}
              textAnchor="middle"
              stroke="none"
            >
              {formatLength(course.length, units)}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
