import { useCourses } from './courses';

const P = 'p1';
const api = () => useCourses.getState();

describe('course store', () => {
  beforeEach(() => {
    useCourses.setState({ courses: {}, past: {}, future: {} });
    api().createCourse(P, 20, 120);
  });

  it('does not overwrite an existing course and rejects bad sizes', () => {
    expect(api().createCourse(P, 30, 30)).toBe(false);
    expect(api().createCourse('p2', 0, 10)).toBe(false);
    expect(api().courses[P].width).toBe(20);
  });

  it('auto-numbers gates in downhill order', () => {
    const a = api().addElement(P, 'gate', 5, 30);
    api().addElement(P, 'gate', 5, 10);
    api().addElement(P, 'start', 5, 0);
    const els = api().courses[P].elements;
    expect(els.find((e) => e.id === a)?.number).toBe(2);
    expect(els.find((e) => e.type === 'start')?.number).toBeNull();
  });

  it('undoes and redoes additions', () => {
    api().addElement(P, 'gate', 5, 10);
    api().addElement(P, 'gate', 5, 20);
    api().undo(P);
    expect(api().courses[P].elements).toHaveLength(1);
    api().redo(P);
    expect(api().courses[P].elements).toHaveLength(2);
  });

  it('clears redo history after a new change', () => {
    api().addElement(P, 'gate', 5, 10);
    api().undo(P);
    api().addElement(P, 'gate', 6, 11);
    api().redo(P);
    expect(api().courses[P].elements).toHaveLength(1);
  });

  it('rejects invalid element and course edits', () => {
    const id = api().addElement(P, 'gate', 5, 10) as string;
    expect(api().updateElement(P, id, { width: 0 })).toBe(false);
    expect(api().updateElement(P, id, { x: 7 })).toBe(true);
    expect(api().setCourseFields(P, { slopeAngleDeg: 95 })).toBe(false);
    expect(api().setCourseFields(P, { slopeAngleDeg: 20 })).toBe(true);
  });

  it('does not record history for drag updates', () => {
    const id = api().addElement(P, 'gate', 5, 10) as string;
    const before = api().past[P].length;
    api().updateElement(P, id, { x: 6 }, false);
    expect(api().past[P].length).toBe(before);
  });

  it('removes elements', () => {
    const id = api().addElement(P, 'gate', 5, 10) as string;
    api().removeElement(P, id);
    expect(api().courses[P].elements).toHaveLength(0);
  });
});
