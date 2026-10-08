import { z } from 'zod';
import type { Course } from './course';
import { worldPosition, type Vec3 } from './scene';

export interface PathPoint {
  x: number;
  y: number;
}

export const pathPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/**
 * Build the default route through a course: start → numbered gates (in order) → finish.
 * Returns an empty array when the course has no start and no numberable gates.
 */
export function defaultPath(course: Course): PathPoint[] {
  const numbered = course.elements
    .filter((element) => element.number !== null)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const start = course.elements.find((element) => element.type === 'start');
  const finish = course.elements.find((element) => element.type === 'finish');

  return [start, ...numbered, finish]
    .filter((element): element is NonNullable<typeof element> => Boolean(element))
    .map((element) => ({ x: element.x, y: element.y }));
}

/**
 * Smooth a manually-entered path using Catmull–Rom interpolation.
 *
 * For paths with fewer than three points the input is returned unchanged.
 * Each segment between consecutive points is subdivided `subdivisions`
 * times, producing a dense, smooth curve suitable for playback.
 */
export function smoothPath(path: PathPoint[], subdivisions = 8): PathPoint[] {
  if (path.length < 3) return path;

  const result: PathPoint[] = [];

  for (let i = 0; i < path.length - 1; i += 1) {
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[i + 1];
    const p3 = path[Math.min(path.length - 1, i + 2)];

    for (let step = 0; step < subdivisions; step += 1) {
      const t = step / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;

      result.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

/**
 * Convert 2D course-plan coordinates to 3D world coordinates.
 * The skier is drawn slightly above the surface (height = 0.08 m).
 */
export function pathToWorld(course: Course, path: PathPoint[]): Vec3[] {
  return path.map((point) => worldPosition(course, point.x, point.y, 0.08));
}

/**
 * Clamp every path point so it stays inside the course rectangle.
 * Points exactly on the boundary are allowed.
 */
export function clampPathToCourse(path: PathPoint[], course: Course): PathPoint[] {
  return path.map((p) => ({
    x: Math.min(Math.max(0, p.x), course.width),
    y: Math.min(Math.max(0, p.y), course.length),
  }));
}

/**
 * Validate that every path coordinate is a finite number.
 */
export function validatePathPoints(path: PathPoint[]): boolean {
  return path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}
