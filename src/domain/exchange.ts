import {
  BLUE,
  COLOUR_LABELS,
  ELEMENT_TYPES,
  RED,
  courseSchema,
  createElement,
  elementSchema,
  type Course,
  type CourseElement,
  type ElementType,
} from './course';

export const FORMAT = 'ski-course-visualiser';
export const FORMAT_VERSION = 1;
export const MAX_CSV_ROWS = 2000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function exportCourseJson(
  course: Course,
  project: { name: string; units: string },
  now = new Date(),
): string {
  return JSON.stringify(
    {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      exportedAt: now.toISOString(),
      project,
      course,
    },
    null,
    2,
  );
}

export function parseCourseJson(text: string, projectId: string): ParseResult<Course> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'File does not contain a course export.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== FORMAT) return { ok: false, error: 'Not a SkiCourse Visualiser file.' };
  if (obj.formatVersion !== FORMAT_VERSION) {
    return { ok: false, error: `Unsupported format version: ${String(obj.formatVersion)}.` };
  }
  if (typeof obj.course !== 'object' || obj.course === null) {
    return { ok: false, error: 'The file has no course data.' };
  }
  const parsed = courseSchema.safeParse({ ...(obj.course as object), projectId });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `Invalid course data: ${issues}` };
  }
  return { ok: true, value: parsed.data };
}

const CSV_HEADER = [
  'type',
  'x_m',
  'y_m',
  'rotation_deg',
  'width_m',
  'poles',
  'colour',
  'elevation_m',
  'source',
  'confidence',
  'number',
  'notes',
];

function csvCell(v: string | number | null): string {
  if (v === null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportElementsCsv(course: Course): string {
  const lines = [CSV_HEADER.join(',')];
  for (const e of course.elements) {
    lines.push(
      [
        e.type,
        e.x,
        e.y,
        e.rotationDeg,
        e.width,
        e.poles,
        COLOUR_LABELS[e.colour].toLowerCase(),
        e.elevation,
        e.source,
        e.confidence,
        e.number,
        e.notes,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

const num = (raw: string): number | undefined => (raw === '' ? undefined : Number(raw));

export function parseElementsCsv(text: string): ParseResult<CourseElement[]> {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return { ok: false, error: 'The CSV file is empty.' };
  if (rows.length - 1 > MAX_CSV_ROWS) {
    return { ok: false, error: `Too many rows (maximum ${MAX_CSV_ROWS}).` };
  }
  const header = rows[0].map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/_(m|deg)$/, ''),
  );
  const idx = new Map(header.map((h, i) => [h, i]));
  for (const need of ['type', 'x', 'y']) {
    if (!idx.has(need)) return { ok: false, error: `Missing required column: ${need}` };
  }
  const cell = (row: string[], name: string) => {
    const i = idx.get(name);
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  const elements: CourseElement[] = [];
  const errors: string[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const typeRaw = cell(row, 'type').toLowerCase();
    if (!(ELEMENT_TYPES as readonly string[]).includes(typeRaw)) {
      errors.push(`Row ${r + 1}: unknown type "${typeRaw}"`);
      continue;
    }
    const type = typeRaw as ElementType;
    const overrides: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => {
      if (value !== undefined) overrides[key] = value;
    };
    set('rotationDeg', num(cell(row, 'rotation')));
    set('width', num(cell(row, 'width')));
    set('poles', num(cell(row, 'poles')));
    set('elevation', num(cell(row, 'elevation')));
    set('confidence', num(cell(row, 'confidence')));
    set('source', cell(row, 'source') || undefined);
    const colour = cell(row, 'colour').toLowerCase();
    if (colour === 'red') overrides.colour = RED;
    else if (colour === 'blue') overrides.colour = BLUE;
    else if (colour !== '') overrides.colour = colour;
    const notes = cell(row, 'notes').replace(/^'(?=[=+\-@])/, '');
    if (notes) overrides.notes = notes;

    const candidate = {
      ...createElement(type, Number(cell(row, 'x')), Number(cell(row, 'y'))),
      ...overrides,
    };
    const parsed = elementSchema.safeParse(candidate);
    if (parsed.success) elements.push(parsed.data);
    else {
      const i = parsed.error.issues[0];
      errors.push(`Row ${r + 1}: ${i.path.join('.')} ${i.message}`);
    }
  }
  if (errors.length > 0) {
    const shown = errors.slice(0, 5).join('; ');
    const more = errors.length > 5 ? ` (and ${errors.length - 5} more)` : '';
    return { ok: false, error: shown + more };
  }
  return { ok: true, value: elements };
}
