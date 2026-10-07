import { NUMBERED_TYPES, POLE_TYPES, type Course, type CourseElement } from './course';

export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function toLocal(p: Point, origin: Point): Point {
  return { x: p.x - origin.x, y: p.y - origin.y };
}

export function toWorld(p: Point, origin: Point): Point {
  return { x: p.x + origin.x, y: p.y + origin.y };
}

/** True when the element is drawn as one pole rather than a pair. */
export function isSinglePole(el: CourseElement): boolean {
  return el.poles === 1 && POLE_TYPES.includes(el.type);
}

/**
 * End points of an element. Rotation 0 places them left and right of the centre along x.
 * A single pole returns the centre point twice.
 */
export function elementEnds(el: CourseElement): [Point, Point] {
  if (isSinglePole(el)) return [{ x: el.x, y: el.y }, { x: el.x, y: el.y }];
  const rad = (el.rotationDeg * Math.PI) / 180;
  const dx = (Math.cos(rad) * el.width) / 2;
  const dy = (Math.sin(rad) * el.width) / 2;
  return [
    { x: el.x - dx, y: el.y - dy },
    { x: el.x + dx, y: el.y + dy },
  ];
}

/** Assigns 1..n to gates, combinations and delay gates in downhill order (y, then x). */
export function numberGates(elements: CourseElement[]): CourseElement[] {
  const order = elements
    .filter((e) => NUMBERED_TYPES.includes(e.type))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((e) => e.id);
  return elements.map((e) => {
    const index = order.indexOf(e.id);
    return { ...e, number: index === -1 ? null : index + 1 };
  });
}

/** Length is measured along the slope surface, so vertical drop is length * sin(angle). */
export function verticalDrop(length: number, slopeAngleDeg: number): number {
  return length * Math.sin((slopeAngleDeg * Math.PI) / 180);
}

export function distanceBetween(
  elements: CourseElement[],
  idA: string,
  idB: string,
): number | null {
  const a = elements.find((e) => e.id === idA);
  const b = elements.find((e) => e.id === idB);
  return a && b ? distance(a, b) : null;
}

/** Returns human-readable warnings for elements whose centre lies outside the course rectangle. */
export function boundsWarnings(course: Course): string[] {
  return course.elements
    .filter((e) => e.x < 0 || e.x > course.width || e.y < 0 || e.y > course.length)
    .map((e) => `${e.type} ${e.number ?? e.id} is outside the course area`);
}
