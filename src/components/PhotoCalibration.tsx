import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import {
  applyHomography,
  assessKnownDistances,
  calibrateFromQuad,
  type KnownDistance,
} from '../domain/calibration';
import { ELEMENT_LABELS, ELEMENT_TYPES, type Course, type ElementType } from '../domain/course';
import { distance, elementEnds, type Point } from '../domain/geometry';
import {
  ACCEPTED_IMAGE_TYPES,
  placementConfidence,
  validateImageFile,
} from '../domain/photo';
import type { Project } from '../domain/project';
import { formatLength, toMetres, unitLabel } from '../domain/units';
import { useCourses } from '../store/courses';

type Mode = 'idle' | 'quad' | 'ref' | 'place' | 'measure';

const HELP: Record<Mode, string> = {
  idle: 'Choose a tool.',
  quad: 'Click the four corners of the course area (the width and length from the Plan tab) in order: top-left, top-right, bottom-right, bottom-left.',
  ref: 'Click both ends of a distance you know, such as two markers.',
  place: 'Click the photo to place the selected element at that spot.',
  measure: 'Click two points to estimate the distance between them.',
};
const CORNERS = ['TL', 'TR', 'BR', 'BL'];
const btn = 'rounded border border-slate-400 px-3 py-1 text-sm disabled:opacity-40';

export default function PhotoCalibration({
  project,
  course,
}: {
  project: Project;
  course: Course;
}) {
  const pid = project.id;
  const units = project.units;
  const storageKey = `photo:${pid}`;
  const cal = course.calibration ?? null;
  const fileRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const urlRef = useRef<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [quadPts, setQuadPts] = useState<Point[]>([]);
  const [refA, setRefA] = useState<Point | null>(null);
  const [pair, setPair] = useState<{ a: Point; b: Point } | null>(null);
  const [metres, setMetres] = useState('');
  const [measurePts, setMeasurePts] = useState<Point[]>([]);
  const [showPhoto, setShowPhoto] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [opacity, setOpacity] = useState(1);
  const [placeType, setPlaceType] = useState<ElementType>('gate');

  const showBlob = useCallback((blob: Blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageUrl(url);
    };
    img.onerror = () => setError('That file could not be read as an image.');
    img.src = url;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await get<Blob>(storageKey);
        if (blob && !cancelled) showBlob(blob);
      } catch {
        /* IndexedDB unavailable: the photo just will not persist */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, showBlob]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const quadResult = useMemo(
    () =>
      cal?.quadPoints
        ? calibrateFromQuad(
            cal.quadPoints,
            course.width,
            course.length,
            size ? { width: size.w, height: size.h } : undefined,
          )
        : null,
    [cal, course.width, course.length, size],
  );
  const quad = quadResult && quadResult.ok ? quadResult : null;
  const refResult = useMemo(
    () => (cal && cal.references.length > 0 ? assessKnownDistances(cal.references) : null),
    [cal],
  );
  const scale = refResult && refResult.ok ? refResult : null;

  const handleFile = async (file: File) => {
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (cal && !window.confirm('A new photo needs a new calibration. Clear the current one?')) return;
    setError(null);
    if (cal) useCourses.getState().setCourseFields(pid, { calibration: null });
    setQuadPts([]);
    setRefA(null);
    setPair(null);
    setMeasurePts([]);
    setMode('idle');
    showBlob(file);
    try {
      await set(storageKey, file);
    } catch {
      setError('The photo could not be saved in this browser, so it will be lost on reload.');
    }
  };

  const removePhoto = async () => {
    if (!window.confirm('Remove the photo and its calibration from this browser?')) return;
    try {
      await del(storageKey);
    } catch {
      /* nothing stored */
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setImageUrl(null);
    setSize(null);
    useCourses.getState().setCourseFields(pid, { calibration: null });
    setMode('idle');
  };

  const saveCalibration = (next: { quadPoints?: Point[] | null; references?: KnownDistance[] }) => {
    if (!size) return false;
    const quadPoints = next.quadPoints !== undefined ? next.quadPoints : (cal?.quadPoints ?? null);
    const references = next.references ?? cal?.references ?? [];
    return useCourses.getState().setCourseFields(pid, {
      calibration: {
        method: quadPoints ? 'quad' : 'known_distance',
        imageWidth: size.w,
        imageHeight: size.h,
        quadPoints,
        references,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const toImage = (e: React.MouseEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const finishQuad = (points: Point[]) => {
    const r = calibrateFromQuad(
      points,
      course.width,
      course.length,
      size ? { width: size.w, height: size.h } : undefined,
    );
    setQuadPts([]);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    saveCalibration({ quadPoints: points });
    setMode('place');
  };

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toImage(e);
    if (!p || !size) return;
    if (mode === 'quad') {
      const pts = [...quadPts, p];
      if (pts.length < 4) setQuadPts(pts);
      else finishQuad(pts);
    } else if (mode === 'ref') {
      if (!refA) setRefA(p);
      else {
        setPair({ a: refA, b: p });
        setRefA(null);
      }
    } else if (mode === 'place' && quad) {
      const c = applyHomography(quad.imageToCourse, p);
      if (c) {
        useCourses.getState().addElement(pid, placeType, c.x, c.y, {
          source: 'calibrated',
          confidence: placementConfidence(quad.warnings),
        });
      }
    } else if (mode === 'measure') {
      setMeasurePts((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
    }
  };

  const addReference = () => {
    if (!pair) return;
    const m = toMetres(Number(metres), units);
    if (!Number.isFinite(m) || !(m > 0)) {
      setError('Enter a positive distance.');
      return;
    }
    if (distance(pair.a, pair.b) < 1e-6) {
      setError('The two points are identical.');
      return;
    }
    setError(null);
    saveCalibration({ references: [...(cal?.references ?? []), { a: pair.a, b: pair.b, realMetres: m }] });
    setPair(null);
    setMetres('');
    setMode('idle');
  };

  const measureText = (): string | null => {
    if (measurePts.length < 2) return null;
    const [a, b] = measurePts;
    if (quad) {
      const ca = applyHomography(quad.imageToCourse, a);
      const cb = applyHomography(quad.imageToCourse, b);
      if (ca && cb) {
        return `${formatLength(distance(ca, cb), units)} (estimate, assumes a flat plane)`;
      }
    }
    if (scale) {
      return `${formatLength(distance(a, b) * scale.metresPerPixel, units)} (approximate, ignores perspective)`;
    }
    return 'No calibration yet, so this distance cannot be given.';
  };

  const project2 = (p: Point) => (quad ? applyHomography(quad.courseToImage, p) : null);
  const warnings: string[] = [];
  if (quadResult && quadResult.ok) warnings.push(...quadResult.warnings);
  if (quadResult && !quadResult.ok) warnings.push(quadResult.reason);
  if (refResult && refResult.ok) warnings.push(...refResult.warnings);
  if (cal && size && (Math.abs(cal.imageWidth - size.w) > 0.5 || Math.abs(cal.imageHeight - size.h) > 0.5)) {
    warnings.push('This photo has a different size from the one that was calibrated.');
  }

  const sw = size ? size.w / 500 : 1;
  const shownQuad = quadPts.length > 0 ? quadPts : (cal?.quadPoints ?? []);
  const corners = quad
    ? [
        { x: 0, y: 0 },
        { x: course.width, y: 0 },
        { x: course.width, y: course.length },
        { x: 0, y: course.length },
      ]
        .map(project2)
        .filter((p): p is Point => p !== null)
    : [];
  const u = unitLabel(units);
  const measured = measureText();

  return (
    <div className='space-y-3'>
      {!imageUrl ? (
        <div
          className='cursor-pointer rounded border-2 border-dashed border-slate-400 p-10 text-center'
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void handleFile(f);
          }}
          onClick={() => fileRef.current?.click()}
        >
          <p className='font-semibold'>Upload a photo of the whole course</p>
          <p className='text-sm'>
            Drag and drop, or click to choose a JPEG, PNG or WebP (up to 15 MB). The photo stays in
            this browser and is never uploaded.
          </p>
        </div>
      ) : (
        <>
          <div className='flex flex-wrap items-center gap-2' role='toolbar' aria-label='Photo tools'>
            <button type='button' className={btn} onClick={() => { setMode('quad'); setQuadPts([]); }}>
              Four-point calibration
            </button>
            <button type='button' className={btn} onClick={() => { setMode('ref'); setRefA(null); }}>
              Known distance
            </button>
            <button type='button' className={btn} disabled={!quad} onClick={() => setMode('place')}>
              Place elements
            </button>
            <button type='button' className={btn} onClick={() => { setMode('measure'); setMeasurePts([]); }}>
              Measure
            </button>
            <select
              aria-label='Element to place'
              className='rounded border border-slate-400 bg-white p-1 text-sm dark:bg-slate-800'
              value={placeType}
              onChange={(e) => setPlaceType(e.target.value as ElementType)}
            >
              {ELEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ELEMENT_LABELS[t]}
                </option>
              ))}
            </select>
            <button type='button' className={btn} onClick={() => fileRef.current?.click()}>
              Replace photo
            </button>
            <button type='button' className={btn} onClick={() => void removePhoto()}>
              Remove photo
            </button>
            {cal && (
              <button
                type='button'
                className={btn}
                onClick={() => {
                  if (window.confirm('Clear the calibration? Placed elements are kept.')) {
                    useCourses.getState().setCourseFields(pid, { calibration: null });
                  }
                }}
              >
                Clear calibration
              </button>
            )}
          </div>
          <div className='flex flex-wrap items-center gap-4 text-sm'>
            <label>
              <input type='checkbox' checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />{' '}
              Original photo
            </label>
            <label>
              <input
                type='checkbox'
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
              />{' '}
              Course overlay
            </label>
            <label>
              Photo opacity{' '}
              <input
                type='range'
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </label>
          </div>
          <p className='text-sm'>
            {HELP[mode]}
            {mode === 'quad' && ` Next: point ${Math.min(quadPts.length + 1, 4)} of 4.`}
          </p>
        </>
      )}

      <input
        ref={fileRef}
        type='file'
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className='hidden'
        aria-label='Choose course photo'
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />

      {error && (
        <p role='alert' className='text-sm text-red-600'>
          {error}
        </p>
      )}

      {pair && (
        <div className='flex flex-wrap items-end gap-2 rounded border border-slate-400 p-3'>
          <label className='text-sm'>
            Real distance ({u})
            <input
              className='mt-1 block rounded border border-slate-400 bg-white p-1 dark:bg-slate-800'
              value={metres}
              onChange={(e) => setMetres(e.target.value)}
            />
          </label>
          <button type='button' className={btn} onClick={addReference}>
            Add reference
          </button>
          <button type='button' className={btn} onClick={() => setPair(null)}>
            Cancel
          </button>
        </div>
      )}

      {imageUrl && size && (
        <svg
          ref={svgRef}
          role='img'
          aria-label='Photo with course overlay'
          viewBox={`0 0 ${size.w} ${size.h}`}
          className='max-h-[70vh] w-full cursor-crosshair rounded border border-slate-400'
          onClick={onSvgClick}
        >
          {showPhoto && <image href={imageUrl} width={size.w} height={size.h} opacity={opacity} />}
          {showOverlay && quad && (
            <g>
              <polygon
                points={corners.map((p) => `${p.x},${p.y}`).join(' ')}
                fill='none'
                stroke='#0ea5e9'
                strokeWidth={sw * 1.5}
              />
              {course.elements.map((el) => {
                const [ea, eb] = elementEnds(el);
                const a = project2(ea);
                const b = project2(eb);
                if (!a || !b) return null;
                const single = a.x === b.x && a.y === b.y;
                return (
                  <g key={el.id}>
                    {!single && (
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={el.colour} strokeWidth={sw * 1.5} />
                    )}
                    <circle cx={a.x} cy={a.y} r={sw * 3} fill={el.colour} />
                    {!single && <circle cx={b.x} cy={b.y} r={sw * 3} fill={el.colour} />}
                    {el.number !== null && (
                      <text
                        x={a.x}
                        y={a.y - sw * 6}
                        fontSize={size.w / 45}
                        fill='#ffffff'
                        stroke='#000000'
                        strokeWidth={sw * 0.4}
                      >
                        {el.number}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
          {shownQuad.map((p, i) => (
            <g key={`q${i}`}>
              <circle cx={p.x} cy={p.y} r={sw * 4} fill='#f59e0b' />
              <text x={p.x + sw * 5} y={p.y} fontSize={size.w / 45} fill='#f59e0b'>
                {CORNERS[i]}
              </text>
            </g>
          ))}
          {(cal?.references ?? []).map((r, i) => (
            <line
              key={`r${i}`}
              x1={r.a.x}
              y1={r.a.y}
              x2={r.b.x}
              y2={r.b.y}
              stroke='#22c55e'
              strokeWidth={sw * 1.5}
            />
          ))}
          {refA && <circle cx={refA.x} cy={refA.y} r={sw * 4} fill='#22c55e' />}
          {measurePts.map((p, i) => (
            <circle key={`m${i}`} cx={p.x} cy={p.y} r={sw * 4} fill='#a855f7' />
          ))}
          {measurePts.length === 2 && (
            <line
              x1={measurePts[0].x}
              y1={measurePts[0].y}
              x2={measurePts[1].x}
              y2={measurePts[1].y}
              stroke='#a855f7'
              strokeWidth={sw * 1.5}
            />
          )}
        </svg>
      )}

      {measured && <p className='text-sm'>Measured: {measured}</p>}

      <section className='space-y-1 rounded border border-amber-500 p-3 text-sm'>
        <h2 className='font-semibold'>Calibration status</h2>
        {quad && <p>Four-point calibration is active (positions placed here are marked calibrated).</p>}
        {scale && (
          <p>
            Known-distance scale: {scale.metresPerPixel.toFixed(4)} m per pixel from{' '}
            {cal?.references.length} reference(s).
          </p>
        )}
        {!quad && !scale && (
          <p>
            No reliable scale yet. A single photo cannot give exact geometry: add the four corners of
            a known rectangle, or at least two known distances.
          </p>
        )}
        <ul className='list-disc pl-5'>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        {cal && cal.references.length > 0 && (
          <ul className='pl-0'>
            {cal.references.map((r, i) => (
              <li key={i}>
                Reference {i + 1}: {formatLength(r.realMetres, units)}{' '}
                <button
                  type='button'
                  className='underline'
                  onClick={() => saveCalibration({ references: cal.references.filter((_, j) => j !== i) })}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
