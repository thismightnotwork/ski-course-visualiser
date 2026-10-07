import { BLUE, RED, createCourse, createElement } from './course';
import {
  exportCourseJson,
  exportElementsCsv,
  parseCourseJson,
  parseCsv,
  parseElementsCsv,
} from './exchange';

const base = () => {
  const c = createCourse('p1', 20, 120);
  c.elements = [createElement('gate', 5, 10, 'a')];
  return c;
};

describe('JSON exchange', () => {
  it('round-trips and rebinds to the target project', () => {
    const text = exportCourseJson(base(), { name: 'n', units: 'metres' }, new Date(0));
    const r = parseCourseJson(text, 'p2');
    if (!r.ok) throw new Error(r.error);
    expect(r.value.projectId).toBe('p2');
    expect(r.value.elements[0].x).toBe(5);
  });

  it('rejects invalid JSON and foreign files', () => {
    expect(parseCourseJson('nope', 'p').ok).toBe(false);
    expect(parseCourseJson('{"format":"other"}', 'p').ok).toBe(false);
  });

  it('rejects unsupported versions and invalid data', () => {
    const obj = JSON.parse(exportCourseJson(base(), { name: 'n', units: 'metres' }));
    expect(parseCourseJson(JSON.stringify({ ...obj, formatVersion: 99 }), 'p').ok).toBe(false);
    obj.course.elements[0].width = -1;
    const r = parseCourseJson(JSON.stringify(obj), 'p');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('width');
  });
});

describe('CSV exchange', () => {
  it('parses quoted fields with commas, quotes and newlines', () => {
    expect(parseCsv('a,"b,""c""\nd",e\n')).toEqual([['a', 'b,"c"\nd', 'e']]);
  });

  it('round-trips colour, poles and awkward notes', () => {
    const c = base();
    c.elements[0] = { ...c.elements[0], colour: BLUE, poles: 1, notes: 'a, "q"\nline' };
    const r = parseElementsCsv(exportElementsCsv(c));
    if (!r.ok) throw new Error(r.error);
    expect(r.value[0].colour).toBe(BLUE);
    expect(r.value[0].poles).toBe(1);
    expect(r.value[0].notes).toBe('a, "q"\nline');
  });

  it('neutralises spreadsheet formulas on export and restores them on import', () => {
    const c = base();
    c.elements[0] = { ...c.elements[0], notes: '=SUM(A1)' };
    const csv = exportElementsCsv(c);
    expect(csv).toContain("'=SUM(A1)");
    const r = parseElementsCsv(csv);
    if (!r.ok) throw new Error(r.error);
    expect(r.value[0].notes).toBe('=SUM(A1)');
  });

  it('applies defaults and accepts CRLF', () => {
    const r = parseElementsCsv('type,x,y\r\ngate,1,2\r\ntraining_pole,3,4\r\n');
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toHaveLength(2);
    expect(r.value[0].poles).toBe(2);
    expect(r.value[0].colour).toBe(RED);
    expect(r.value[1].poles).toBe(1);
  });

  it('reports missing columns, unknown types and invalid values', () => {
    const missing = parseElementsCsv('type,x\ngate,1');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('y');
    const badType = parseElementsCsv('type,x,y\nhoop,1,2');
    expect(badType.ok).toBe(false);
    if (!badType.ok) expect(badType.error).toContain('Row 2');
    expect(parseElementsCsv('type,x,y,width\ngate,1,2,-3').ok).toBe(false);
    expect(parseElementsCsv('type,x,y,colour\ngate,1,2,green').ok).toBe(false);
    expect(parseElementsCsv('').ok).toBe(false);
  });
});
