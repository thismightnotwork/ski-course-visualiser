import { z } from 'zod';

export const MISTAKE_TYPES = [
  'wide_line',
  'tight_line',
  'missed_gate',
  'straddled_gate',
  'skid',
  'loss_of_balance',
  'fall',
  'stop',
  'delay',
  'unknown',
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  wide_line: 'Wide line',
  tight_line: 'Tight line',
  missed_gate: 'Missed gate',
  straddled_gate: 'Straddled gate',
  skid: 'Skid',
  loss_of_balance: 'Loss of balance',
  fall: 'Fall',
  stop: 'Stop',
  delay: 'Delay',
  unknown: 'Unknown',
};

export const SEVERITIES = ['minor', 'moderate', 'major'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const mistakeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(MISTAKE_TYPES),
  timeSec: z.number().min(0).max(36000),
  gateNumber: z.number().int().positive().nullable(),
  positionY: z.number().min(0).nullable(),
  durationSec: z.number().min(0).max(3600),
  severity: z.enum(SEVERITIES),
  notes: z.string().max(1000),
  confidence: z.number().min(0).max(1),
  source: z.enum(['manual', 'auto']),
  penaltySec: z.number().min(0).max(600),
});
export type Mistake = z.infer<typeof mistakeSchema>;

export const splitSchema = z.object({
  gateNumber: z.number().int().positive(),
  timeSec: z.number().min(0).max(36000),
});
export type Split = z.infer<typeof splitSchema>;

const runObject = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  projectId: z.string().min(1),
  courseId: z.string().min(1),
  skier: z.string().trim().min(1, 'Enter a name or ID').max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  totalTimeSec: z.number().positive().max(36000),
  startDelaySec: z.number().min(0).max(3600),
  finishDelaySec: z.number().min(0).max(3600),
  penaltySec: z.number().min(0).max(3600),
  notes: z.string().max(5000),
  mistakes: z.array(mistakeSchema).max(500),
  splits: z.array(splitSchema).max(500),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Run = z.infer<typeof runObject>;

export const runSchema = runObject.superRefine((r, ctx) => {
  if (r.startDelaySec + r.finishDelaySec >= r.totalTimeSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDelaySec'],
      message: 'Start and finish delay must be less than the total time',
    });
  }
  const sorted = [...r.splits].sort((a, b) => a.gateNumber - b.gateNumber);
  sorted.forEach((s, i) => {
    if (i > 0 && s.gateNumber === sorted[i - 1].gateNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits'],
        message: `Gate ${s.gateNumber} has more than one split`,
      });
    } else if (i > 0 && s.timeSec <= sorted[i - 1].timeSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits'],
        message: 'Split times must increase with gate number',
      });
    }
    if (s.timeSec > r.totalTimeSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['splits'],
        message: 'A split is later than the total time',
      });
    }
  });
});
