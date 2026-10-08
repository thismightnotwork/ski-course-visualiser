import { createCourse, createElement } from './course';
import {
  clampPathToCourse,
  defaultPath,
  pathToWorld,
  smoothPath,
  validatePathPoints,
} from './path';

function makeCourse() {
  const course = createCourse('projectId', 20, 100);
  const start = { ...createElement('start', 10, 0), number: null };
  const gate1 = { ...createElement('gate', 8, 25), number: 1 };
  const gate2 = { ...createElement('gate', 5, 50), number: 2 };
  const gate3 = { ...createElement('gate', 10, 75), number: 3 };
  const finish = { ...createElement('finish', 10, 100), number: null };
  course.elements.push(start, gate1, gate2, gate3, finish);
  return course;
}

describe('defaultPath', () => {
  it('returns start → numbered gates in order → finish', () => {
    const course = makeCourse();
    const result = defaultPath(course);
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ x: 10, y: 0 });
    expect(result[1]).toEqual({ x: 8, y: 25 });
    expect(result[2]).toEqual({ x: 5, y: 50 });
    expect(result[3]).toEqual({ x: 10, y: 75 });
    expect(result[4]).toEqual({ x: 10, y: 100 });
  });

  it('returns empty array when no start or gates', () => {
    const course = createCourse('projectId', 20, 100);
    expect(defaultPath(course)).toEqual([]);
  });

  it('returns only start and finish when no gates', () => {
    const course = createCourse('projectId', 20, 100);
    course.elements.push({ ...createElement('start', 10, 0), number: null });
    course.elements.push({ ...createElement('finish', 10, 100), number: null });
    const result = defaultPath(course);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 10, y: 0 });
    expect(result[1]).toEqual({ x: 10, y: 100 });
  });
});

describe('smoothPath', () => {
  it('returns path unchanged when fewer than 3 points', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(smoothPath(path, 8)).toEqual(path);
  });

  it('returns empty for empty input', () => {
    expect(smoothPath([], 8)).toEqual([]);
  });

  it('produces more points than the input for paths with 3+ points', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 10 },
    ];
    const result = smoothPath(path, 8);
    expect(result.length).toBeGreaterThan(path.length);
  });

  it('starts and ends at the original endpoints', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    const result = smoothPath(path, 8);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]).toEqual({ x: 20, y: 0 });
  });
});

describe('pathToWorld', () => {
  it('converts 2D course coordinates to 3D world coordinates', () => {
    const course = makeCourse();
    const path = defaultPath(course);
    const world = pathToWorld(course, path);
    expect(world).toHaveLength(path.length);
    for (const point of world) {
      expect(point).toHaveLength(3);
      expect(Number.isFinite(point[0])).toBe(true);
      expect(Number.isFinite(point[1])).toBe(true);
      expect(Number.isFinite(point[2])).toBe(true);
    }
  });

  it('centres the course in world space', () => {
    const course = makeCourse();
    const world = pathToWorld(course, [{ x: course.width / 2, y: course.length / 2 }]);
    expect(world[0][0]).toBeCloseTo(0);
    expect(world[0][2]).toBeCloseTo(0);
  });

  it('returns empty array for empty path', () => {
    const course = makeCourse();
    expect(pathToWorld(course, [])).toEqual([]);
  });
});

describe('clampPathToCourse', () => {
  it('leaves in-bounds points unchanged', () => {
    const course = makeCourse();
    const path = [{ x: 10, y: 50 }];
    expect(clampPathToCourse(path, course)).toEqual(path);
  });

  it('clamps out-of-bounds points to course edges', () => {
    const course = makeCourse();
    const path = [{ x: -5, y: 120 }];
    const result = clampPathToCourse(path, course);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(100);
  });

  it('handles multiple points', () => {
    const course = makeCourse();
    const path = [
      { x: -5, y: 50 },
      { x: 10, y: 200 },
      { x: 30, y: 30 },
    ];
    const result = clampPathToCourse(path, course);
    expect(result[0]).toEqual({ x: 0, y: 50 });
    expect(result[1]).toEqual({ x: 10, y: 100 });
    expect(result[2]).toEqual({ x: 20, y: 30 });
  });
});

describe('validatePathPoints', () => {
  it('returns true for finite coordinates', () => {
    expect(
      validatePathPoints([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ]),
    ).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(validatePathPoints([])).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(validatePathPoints([{ x: NaN, y: 2 }])).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(validatePathPoints([{ x: 1, y: Infinity }])).toBe(false);
  });
});
