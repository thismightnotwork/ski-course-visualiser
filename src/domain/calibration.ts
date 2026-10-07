import type { Point } from './geometry';
import { distance } from './geometry';

/** Row-major 3x3 matrix. */
export type Matrix3 = [number, number, number, number, number, number, number, number, number];

function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-9) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = m[i][n];
    for (let c = i + 1; c < n; c++) s -= m[i][c] * x[c];
    x[i] = s / m[i][i];
  }
  return x;
}

/** Homography mapping four source points onto four destination points. */
export function computeHomography(src: Point[], dst: Point[]): Matrix3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
}

export function applyHomography(h: Matrix3, p: Point): Point | null {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-12) return null;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

export function invertMatrix3(m: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const s = 1 / det;
  return [
    (e * i - f * h) * s,
    (c * h - b * i) * s,
    (b * f - c * e) * s,
    (f * g - d * i) * s,
    (a * i - c * g) * s,
    (c * d - a * f) * s,
    (d * h - e * g) * s,
    (b * g - a * h) * s,
    (a * e - b * d) * s,
  ];
}

export function isConvexQuad(p: Point[]): boolean {
  if (p.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i];
    const b = p[(i + 1) % 4];
    const c = p[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function quadArea(p: Point[]): number {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export type QuadCalibration =
  | {
      ok: true;
      imageToCourse: Matrix3;
      courseToImage: Matrix3;
      source: 'calibrated';
      warnings: string[];
    }
  | { ok: false; reason: string };

/**
 * Four-point calibration. Image points must be clicked in order: top-left, top-right,
 * bottom-right, bottom-left of a rectangle of known width and length on the slope surface.
 * Assumes the four points lie on one flat plane.
 */
export function calibrateFromQuad(
  imagePoints: Point[],
  courseWidth: number,
  courseLength: number,
  imageSize?: { width: number; height: number },
): QuadCalibration {
  if (!(courseWidth > 0) || !(courseLength > 0)) {
    return { ok: false, reason: 'Course width and length must be positive.' };
  }
  if (!isConvexQuad(imagePoints)) {
    return {
      ok: false,
      reason: 'The four points must form a convex shape, clicked in order around the rectangle.',
    };
  }
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: courseWidth, y: 0 },
    { x: courseWidth, y: courseLength },
    { x: 0, y: courseLength },
  ];
  const h = computeHomography(imagePoints, dst);
  const inv = h ? invertMatrix3(h) : null;
  if (!h || !inv) return { ok: false, reason: 'These points do not define a usable transform.' };

  const warnings: string[] = [
    'Assumes the four points lie on one flat plane. Curved or uneven slopes will distort results.',
  ];
  const [p0, p1, p2, p3] = imagePoints;
  const horiz = distance(p0, p1) / distance(p3, p2);
  const vert = distance(p0, p3) / distance(p1, p2);
  const worst = Math.max(horiz, 1 / horiz, vert, 1 / vert);
  if (worst > 3) {
    warnings.push('Strong perspective: opposite edges differ greatly in size, so accuracy is low.');
  }
  if (imageSize && quadArea(imagePoints) / (imageSize.width * imageSize.height) < 0.1) {
    warnings.push('The marked area covers under 10% of the photo, so small click errors are amplified.');
  }
  return { ok: true, imageToCourse: h, courseToImage: inv, source: 'calibrated', warnings };
}

/** Metres per pixel from one known distance. Only valid for a roughly square-on view. */
export function scaleFromKnownDistance(a: Point, b: Point, realMetres: number): number | null {
  const px = distance(a, b);
  if (px < 1e-6 || !(realMetres > 0)) return null;
  return realMetres / px;
}

export interface KnownDistance {
  a: Point;
  b: Point;
  realMetres: number;
}

export type ScaleAssessment =
  | {
      ok: true;
      metresPerPixel: number;
      maxDeviation: number;
      source: 'calibrated';
      warnings: string[];
    }
  | { ok: false; reason: string };

export function assessKnownDistances(items: KnownDistance[]): ScaleAssessment {
  const warnings: string[] = [
    'A single scale ignores perspective. Treat results as approximate unless the camera faces the slope square-on.',
  ];
  const scales: number[] = [];
  for (const item of items) {
    const s = scaleFromKnownDistance(item.a, item.b, item.realMetres);
    if (s === null) warnings.push('One reference was ignored because its length or pixel distance was invalid.');
    else {
      scales.push(s);
      if (distance(item.a, item.b) < 20) {
        warnings.push('A reference spans fewer than 20 pixels, so its scale is imprecise.');
      }
    }
  }
  if (scales.length === 0) {
    return { ok: false, reason: 'At least one valid known distance is needed for scale.' };
  }
  const mean = scales.reduce((s, v) => s + v, 0) / scales.length;
  const maxDeviation = Math.max(...scales.map((s) => Math.abs(s - mean) / mean));
  if (scales.length === 1) {
    warnings.push('Only one reference: scale consistency cannot be checked.');
  } else if (maxDeviation > 0.1) {
    warnings.push('References are inconsistent (over 10% apart), which suggests perspective or entry errors.');
  }
  return { ok: true, metresPerPixel: mean, maxDeviation, source: 'calibrated', warnings };
}
