import { z } from 'zod';

export const DATA_SOURCES = ['entered', 'calibrated', 'estimated', 'unknown'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const ELEMENT_TYPES = [
  'start',
  'finish',
  'gate',
  'combination',
  'delay_gate',
  'panel',
  'training_pole',
  'hazard',
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const ELEMENT_LABELS: Record<ElementType, string> = {
  start: 'Start',
  finish: 'Finish',
  gate: 'Gate',
  combination: 'Combination',
  delay_gate: 'Delay gate',
  panel: 'Panel',
  training_pole: 'Training pole',
  hazard: 'Hazard / marked area',
};

export const NUMBERED_TYPES: readonly ElementType[] = ['gate', 'combination', 'delay_gate'];

const DEFAULT_WIDTH: Record<ElementType, number> = {
  start: 6,
  finish: 6,
  gate: 4,
  combination: 4,
  delay_gate: 4,
  panel: 1,
  training_pole: 0.5,
  hazard: 3,
};

const DEFAULT_COLOUR: Record<ElementType, string> = {
  start: '#16a34a',
  finish: '#111827',
  gate: '#dc2626',
  combination: '#2563eb',
  delay_gate: '#f59e0b',
  panel: '#dc2626',
  training_pole: '#9333ea',
  hazard: '#f97316',
};

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #dc2626');

export const elementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(ELEMENT_TYPES),
  x: z.number().finite(),
  y: z.number().finite(),
  rotationDeg: z.number().finite(),
  width: z.number().positive().max(100),
  number: z.number().int().positive().nullable(),
  colour,
  elevation: z.number().finite().nullable(),
  notes: z.string().max(1000),
  source: z.enum(DATA_SOURCES),
  confidence: z.number().min(0).max(1),
});
export type CourseElement = z.infer<typeof elementSchema>;

/**
 * Coordinate frame (metres): x runs across the slope (left to right), y runs down the
 * slope surface from the top edge. The course rectangle is x in [0, width], y in [0, length].
 */
export const courseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  projectId: z.string().min(1),
  width: z.number().positive().max(1000),
  length: z.number().positive().max(5000),
  dimensionSource: z.enum(DATA_SOURCES),
  slopeAngleDeg: z.number().min(0).max(89).nullable(),
  startElevation: z.number().finite().nullable(),
  origin: z.object({ x: z.number().finite(), y: z.number().finite() }),
  elements: z.array(elementSchema),
  notes: z.string().max(5000),
  updatedAt: z.string(),
});
export type Course = z.infer<typeof courseSchema>;

export function createElement(
  type: ElementType,
  x: number,
  y: number,
  id: string = crypto.randomUUID(),
): CourseElement {
  return {
    id,
    type,
    x,
    y,
    rotationDeg: 0,
    width: DEFAULT_WIDTH[type],
    number: null,
    colour: DEFAULT_COLOUR[type],
    elevation: null,
    notes: '',
    source: 'entered',
    confidence: 1,
  };
}

export function createCourse(projectId: string, width: number, length: number, now = new Date()): Course {
  return courseSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    projectId,
    width,
    length,
    dimensionSource: 'entered',
    slopeAngleDeg: null,
    startElevation: null,
    origin: { x: 0, y: 0 },
    elements: [],
    notes: '',
    updatedAt: now.toISOString(),
  });
}
