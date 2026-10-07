import { z } from 'zod';

export const COURSE_TYPES = ['indoor', 'outdoor', 'dry_slope'] as const;
export const SURFACE_TYPES = ['snow', 'artificial_snow', 'dry_slope_matting', 'other'] as const;

export const COURSE_TYPE_LABELS: Record<(typeof COURSE_TYPES)[number], string> = {
  indoor: 'Indoor snow',
  outdoor: 'Outdoor',
  dry_slope: 'Dry slope',
};

export const SURFACE_LABELS: Record<(typeof SURFACE_TYPES)[number], string> = {
  snow: 'Snow',
  artificial_snow: 'Artificial snow',
  dry_slope_matting: 'Dry-slope matting',
  other: 'Other',
};

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  location: z.string().trim().max(160),
  courseType: z.enum(COURSE_TYPES),
  surfaceType: z.enum(SURFACE_TYPES),
  description: z.string().trim().max(2000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  units: z.enum(['metres', 'feet']),
  notes: z.string().trim().max(5000),
});

export type ProjectForm = z.infer<typeof projectFormSchema>;

export const projectSchema = projectFormSchema.extend({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  ownerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

export function createProject(input: ProjectForm, now = new Date()): Project {
  const data = projectFormSchema.parse(input);
  const iso = now.toISOString();
  return {
    ...data,
    schemaVersion: 1,
    id: crypto.randomUUID(),
    ownerId: null,
    createdAt: iso,
    updatedAt: iso,
  };
}
