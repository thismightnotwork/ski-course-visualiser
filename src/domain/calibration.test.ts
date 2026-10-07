import {
  applyHomography,
  assessKnownDistances,
  calibrateFromQuad,
  isConvexQuad,
  scaleFromKnownDistance,
} from './calibration';

const rect = [
  { x: 10, y: 20 },
  { x: 210, y: 20 },
  { x: 210, y: 120 },
  { x: 10, y: 120 },
];

describe('calibrateFromQuad', () => {
  it('maps an axis-aligned rectangle linearly', () => {
    const r = calibrateFromQuad(rect, 20, 10);
    if (!r.ok) throw new Error(r.reason);
    const mid = applyHomography(r.imageToCourse, { x: 110, y: 70 });
    expect(mid?.x).toBeCloseTo(10);
    expect(mid?.y).toBeCloseTo(5);
    const end = applyHomography(r.imageToCourse, { x: 210, y: 120 });
    expect(end?.x).toBeCloseTo(20);
    expect(end?.y).toBeCloseTo(10);
  });

  it('maps perspective corners exactly and round-trips', () => {
    const quad = [
      { x: 200, y: 100 },
      { x: 400, y: 100 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
    ];
    const r = calibrateFromQuad(quad, 10, 50);
    if (!r.ok) throw new Error(r.reason);
    const corner = applyHomography(r.imageToCourse, quad[2]);
    expect(corner?.x).toBeCloseTo(10);
    expect(corner?.y).toBeCloseTo(50);
    const course = applyHomography(r.imageToCourse, { x: 300, y: 300 });
    const back = course ? applyHomography(r.courseToImage, course) : null;
    expect(back?.x).toBeCloseTo(300);
    expect(back?.y).toBeCloseTo(300);
  });

  it('rejects collinear and self-crossing points', () => {
    const line = [0, 1, 2, 3].map((x) => ({ x, y: 0 }));
    expect(calibrateFromQuad(line, 10, 10).ok).toBe(false);
    const bowtie = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isConvexQuad(bowtie)).toBe(false);
    expect(calibrateFromQuad(bowtie, 10, 10).ok).toBe(false);
  });

  it('rejects non-positive course sizes', () => {
    expect(calibrateFromQuad(rect, 0, 10).ok).toBe(false);
  });

  it('warns about strong perspective and a small marked area', () => {
    const quad = [
      { x: 190, y: 100 },
      { x: 210, y: 100 },
      { x: 600, y: 500 },
      { x: 0, y: 500 },
    ];
    const r = calibrateFromQuad(quad, 10, 50);
    if (!r.ok) throw new Error(r.reason);
    expect(r.warnings.some((w) => w.includes('perspective'))).toBe(true);
    const small = calibrateFromQuad(rect, 20, 10, { width: 4000, height: 3000 });
    if (!small.ok) throw new Error(small.reason);
    expect(small.warnings.some((w) => w.includes('under 10%'))).toBe(true);
  });
});

describe('known-distance scale', () => {
  it('computes metres per pixel', () => {
    expect(scaleFromKnownDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, 10)).toBeCloseTo(0.02);
  });

  it('returns null for invalid input', () => {
    expect(scaleFromKnownDistance({ x: 1, y: 1 }, { x: 1, y: 1 }, 10)).toBeNull();
    expect(scaleFromKnownDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, -1)).toBeNull();
  });

  it('needs at least one valid reference', () => {
    expect(assessKnownDistances([]).ok).toBe(false);
  });

  it('warns when only one reference is given', () => {
    const r = assessKnownDistances([{ a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, realMetres: 10 }]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.metresPerPixel).toBeCloseTo(0.02);
    expect(r.warnings.some((w) => w.includes('Only one reference'))).toBe(true);
  });

  it('flags inconsistent references', () => {
    const r = assessKnownDistances([
      { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, realMetres: 10 },
      { a: { x: 0, y: 0 }, b: { x: 0, y: 500 }, realMetres: 15 },
    ]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.maxDeviation).toBeGreaterThan(0.1);
    expect(r.warnings.some((w) => w.includes('inconsistent'))).toBe(true);
  });

  it('accepts consistent references', () => {
    const r = assessKnownDistances([
      { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, realMetres: 10 },
      { a: { x: 0, y: 0 }, b: { x: 0, y: 500 }, realMetres: 10.2 },
    ]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.maxDeviation).toBeLessThan(0.1);
    expect(r.warnings.some((w) => w.includes('inconsistent'))).toBe(false);
  });
});
