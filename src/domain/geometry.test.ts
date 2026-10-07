import { createCourse, createElement, type CourseElement } from './course';
import {
  boundsWarnings,
  distance,
  distanceBetween,
  elementEnds,
  numberGates,
  toLocal,
  toWorld,
  verticalDrop,
} from './geometry';

describe('geometry', () => {
  it('computes distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('round-trips local and world coordinates', () => {
    const origin = { x: 2, y: -3 };
    const p = { x: 10, y: 7 };
    expect(toWorld(toLocal(p, origin), origin)).toEqual(p);
  });

  it('places gate ends along x at rotation 0 and along y at 90 degrees', () => {
    const g = createElement('gate', 5, 10, 'g');
    g.width = 4;
    const [l, r] = elementEnds(g);
    expect(l.x).toBeCloseTo(3);
    expect(r.x).toBeCloseTo(7);
    const [t, b] = elementEnds({ ...g, rotationDeg: 90 });
    expect(t.y).toBeCloseTo(8);
    expect(b.y).toBeCloseTo(12);
    expect(t.x).toBeCloseTo(5);
  });

  it('returns the centre twice for a single pole', () => {
    const g = { ...createElement('gate', 5, 10, 'g'), poles: 1 as const };
    const [a, b] = elementEnds(g);
    expect(a).toEqual({ x: 5, y: 10 });
    expect(b).toEqual({ x: 5, y: 10 });
  });

  it('numbers only gates, combinations and delay gates in downhill order', () => {
    const els: CourseElement[] = [
      createElement('gate', 5, 30, 'c'),
      createElement('start', 5, 0, 's'),
      createElement('gate', 5, 10, 'a'),
      createElement('delay_gate', 5, 20, 'b'),
      createElement('panel', 5, 15, 'p'),
    ];
    const byId = Object.fromEntries(numberGates(els).map((e) => [e.id, e.number]));
    expect(byId).toEqual({ a: 1, b: 2, c: 3, s: null, p: null });
  });

  it('breaks y ties using x', () => {
    const els = [createElement('gate', 8, 10, 'right'), createElement('gate', 2, 10, 'left')];
    const byId = Object.fromEntries(numberGates(els).map((e) => [e.id, e.number]));
    expect(byId).toEqual({ left: 1, right: 2 });
  });

  it('computes vertical drop from slope length and angle', () => {
    expect(verticalDrop(100, 30)).toBeCloseTo(50);
    expect(verticalDrop(100, 0)).toBe(0);
  });

  it('measures distance between elements and returns null for unknown ids', () => {
    const els = [createElement('gate', 0, 0, 'a'), createElement('gate', 3, 4, 'b')];
    expect(distanceBetween(els, 'a', 'b')).toBe(5);
    expect(distanceBetween(els, 'a', 'zzz')).toBeNull();
  });

  it('warns about elements outside the course', () => {
    const course = createCourse('p1', 20, 50);
    course.elements = [createElement('gate', 5, 10, 'in'), createElement('gate', 25, 10, 'out')];
    expect(boundsWarnings(course)).toHaveLength(1);
  });
});
