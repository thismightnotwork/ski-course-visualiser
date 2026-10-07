import { createElement } from '../domain/course';
import { migrateCourses, useCourses } from './courses';

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

  it('places elements with colour and pole overrides and rejects invalid ones', () => {
    const id = api().addElement(P, 'gate', 5, 10, { colour: '#2563eb', poles: 1 });
    const el = api().courses[P].elements.find((e) => e.id === id);
    expect(el?.colour).toBe('#2563eb');
    expect(el?.poles).toBe(1);
    expect(
      api().addElement(P, 'gate', 5, 10, { colour: '#16a34a' as unknown as '#2563eb' }),
    ).toBeNull();
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

  it('replaces elements as one undoable step', () => {
    api().addElement(P, 'gate', 5, 10);
    const next = [createElement('gate', 1, 1), createElement('gate', 2, 2)];
    expect(api().replaceElements(P, next)).toBe(true);
    expect(api().courses[P].elements).toHaveLength(2);
    api().undo(P);
    expect(api().courses[P].elements).toHaveLength(1);
  });

  it('removes a course and its history', () => {
    api().addElement(P, 'gate', 5, 10);
    api().removeCourse(P);
    expect(api().courses[P]).toBeUndefined();
    expect(api().past[P]).toBeUndefined();
  });

  it('migrates legacy colours and missing poles', () => {
    const legacy = { ...createElement('training_pole', 1, 1), colour: '#f97316' } as never;
    const course = { ...api().courses[P], elements: [legacy] };
    const out = migrateCourses({ [P]: course })[P].elements[0];
    expect(out.colour).toBe('#dc2626');
    expect(out.poles).toBe(1);
  });
});
