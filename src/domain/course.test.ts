import { courseSchema, createCourse, createElement, elementSchema, toRedBlue } from './course';

describe('course model', () => {
  it('creates a valid empty course with entered dimensions', () => {
    const c = createCourse('p1', 20, 120, new Date('2026-10-07T09:00:00Z'));
    expect(courseSchema.safeParse(c).success).toBe(true);
    expect(c.dimensionSource).toBe('entered');
    expect(c.elements).toEqual([]);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => createCourse('p1', 0, 100)).toThrow();
    expect(() => createCourse('p1', 20, -5)).toThrow();
  });

  it('creates valid elements with defaults', () => {
    const g = createElement('gate', 1, 2);
    expect(elementSchema.safeParse(g).success).toBe(true);
    expect(g.source).toBe('entered');
    expect(g.confidence).toBe(1);
    expect(g.poles).toBe(2);
    expect(createElement('training_pole', 0, 0).poles).toBe(1);
  });

  it('only allows red or blue and one or two poles', () => {
    const g = createElement('gate', 1, 2);
    expect(elementSchema.safeParse({ ...g, colour: 'red' }).success).toBe(false);
    expect(elementSchema.safeParse({ ...g, colour: '#16a34a' }).success).toBe(false);
    expect(elementSchema.safeParse({ ...g, colour: '#2563eb' }).success).toBe(true);
    expect(elementSchema.safeParse({ ...g, poles: 3 }).success).toBe(false);
    expect(elementSchema.safeParse({ ...g, poles: 1 }).success).toBe(true);
  });

  it('rejects out-of-range confidence', () => {
    const g = createElement('gate', 1, 2);
    expect(elementSchema.safeParse({ ...g, confidence: 1.5 }).success).toBe(false);
  });

  it('maps legacy colours onto red or blue', () => {
    expect(toRedBlue('#f97316')).toBe('#dc2626');
    expect(toRedBlue('#2563eb')).toBe('#2563eb');
    expect(toRedBlue('garbage')).toBe('#dc2626');
  });

  it('rejects an impossible slope angle', () => {
    const c = createCourse('p1', 20, 100);
    expect(courseSchema.safeParse({ ...c, slopeAngleDeg: 95 }).success).toBe(false);
  });
});
