import { courseSchema, createCourse, createElement, elementSchema } from './course';

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
  });

  it('rejects a bad colour and out-of-range confidence', () => {
    const g = createElement('gate', 1, 2);
    expect(elementSchema.safeParse({ ...g, colour: 'red' }).success).toBe(false);
    expect(elementSchema.safeParse({ ...g, confidence: 1.5 }).success).toBe(false);
  });

  it('rejects an impossible slope angle', () => {
    const c = createCourse('p1', 20, 100);
    expect(courseSchema.safeParse({ ...c, slopeAngleDeg: 95 }).success).toBe(false);
  });
});
