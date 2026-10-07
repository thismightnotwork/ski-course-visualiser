import { useRef, useState } from 'react';
import { ELEMENT_LABELS, type Course, type CourseElement } from '../domain/course';
import { elementEnds } from '../domain/geometry';
import { formatLength, type Units } from '../domain/units';

interface Props {
  course: Course;
  units: Units;
  selectedId: string | null;
  placing: boolean;
  showGrid: boolean;
  showGuides: boolean;
  onSelect: (id: string | null) => void;
  onPlace: (x: number, y: number) => void;
  onDragStart: () => void;
  onDragMove: (id: string, x: number, y: number) => void;
}

type Drag =
  | { kind: 'element'; id: string }
  | { kind: 'pan'; lastX: number; lastY: number; moved: number }
  | null;

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function CourseCanvas({
  course,
  units,
  selectedId,
  placing,
  showGrid,
  showGuides,
  onSelect,
  onPlace,
  onDragStart,
  onDragMove,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag>(null);
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

  const onSvgDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (placing) {
      const p = toCourse(e);
      if (p) onPlace(round2(p.x), round2(p.y));
      return;
    }
    dragRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onElementDown = (e: React.PointerEvent<SVGElement>, id: string) => {
    e.stopPropagation();
    onSelect(id);
    if (placing) return;
    onDragStart();
    dragRef.current = { kind: 'element', id };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'element') {
      const p = toCourse(e);
      if (p) onDragMove(d.id, round2(p.x), round2(p.y));
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
    if (d?.kind === 'pan' && d.moved < 3) onSelect(null);
  };

  const renderElement = (el: CourseElement) => {
    const [a, b] = elementEnds(el);
    const selected = el.id === selectedId;
    const label = el.number !== null ? String(el.number) : ELEMENT_LABELS[el.type];
    const thick = el.type === 'start' || el.type === 'finish';
    return (
      <g
        key={el.id}
        style={{ cursor: placing ? 'crosshair' : 'move' }}
        onPointerDown={(e) => onElementDown(e, el.id)}
      >
        {el.type === 'hazard' ? (
          <rect
            x={-el.width / 2}
            y={-el.width / 4}
            width={el.width}
            height={el.width / 2}
            transform={`translate(${el.x} ${el.y}) rotate(${el.rotationDeg})`}
            fill={el.colour}
            fillOpacity={0.3}
            stroke={selected ? '#0ea5e9' : el.colour}
            strokeWidth={selected ? 0.25 : 0.1}
          />
        ) : (
          <>
            {selected && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#0ea5e9"
                strokeWidth={0.8}
                strokeLinecap="round"
                opacity={0.5}
              />
            )}
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
          </>
        )}
        <text
          x={el.x}
          y={el.y - 0.7}
          fontSize={0.9}
          textAnchor="middle"
          fill="currentColor"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Course plan"
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        className="h-[60vh] min-h-[360px] w-full touch-none rounded border border-slate-400 text-slate-900 dark:text-slate-100"
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
        {showGrid && (
          <g stroke="#94a3b8" strokeWidth={0.04} opacity={0.6}>
            {gridX.map((x) => (
              <line key={`x${x}`} x1={x} y1={0} x2={x} y2={course.length} />
            ))}
            {gridY.map((y) => (
              <line key={`y${y}`} x1={0} y1={y} x2={course.width} y2={y} />
            ))}
          </g>
        )}
        <rect
          x={0}
          y={0}
          width={course.width}
          height={course.length}
          fill="none"
          stroke="#475569"
          strokeWidth={0.12}
        />
        {showGuides && (
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
        )}
        {course.elements.map(renderElement)}
      </svg>
      <div className="absolute right-2 top-2 flex gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          className="rounded border border-slate-400 bg-white px-2 text-slate-900"
          onClick={() => setZoom((z) => Math.min(16, z * 1.4))}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="rounded border border-slate-400 bg-white px-2 text-slate-900"
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.4))}
        >
          -
        </button>
        <button
          type="button"
          className="rounded border border-slate-400 bg-white px-2 text-slate-900"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset view
        </button>
      </div>
    </div>
  );
}
