import { z } from 'zod';

export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const VIDEO_JOB_STATUSES = ['idle', 'metadata', 'queued', 'processing', 'ready', 'failed', 'cancelled'] as const;
export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];

export const videoPointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type VideoPoint = z.infer<typeof videoPointSchema>;

export const videoMarkerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['start', 'finish', 'gate']),
  timeSec: z.number().min(0).max(36000),
  gateNumber: z.number().int().positive().nullable(),
  point: videoPointSchema.nullable(),
  source: z.enum(['manual', 'auto']),
  confidence: z.number().min(0).max(1),
});
export type VideoMarker = z.infer<typeof videoMarkerSchema>;

export const trackingSampleSchema = z.object({
  timeSec: z.number().min(0).max(36000),
  point: videoPointSchema,
  confidence: z.number().min(0).max(1),
  source: z.enum(['auto', 'manual']),
});
export type TrackingSample = z.infer<typeof trackingSampleSchema>;

export const videoAnalysisSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  projectId: z.string().min(1),
  courseId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(MAX_VIDEO_BYTES),
  mimeType: z.enum(VIDEO_TYPES),
  durationSec: z.number().positive().max(36000),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive().max(1000).nullable(),
  status: z.enum(VIDEO_JOB_STATUSES),
  progress: z.number().min(0).max(1),
  error: z.string().max(1000).nullable(),
  processorJobId: z.string().nullable(),
  startMarker: videoMarkerSchema.nullable(),
  finishMarker: videoMarkerSchema.nullable(),
  gateMarkers: z.array(videoMarkerSchema).max(500),
  tracking: z.array(trackingSampleSchema).max(100000),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(5000),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;

export function validateVideoFile(file: { type: string; size: number }): string | null {
  if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) return 'Use an MP4, MOV or WebM video.';
  if (file.size <= 0) return 'The video file is empty.';
  if (file.size > MAX_VIDEO_BYTES) return 'The video is larger than 500 MB.';
  return null;
}

export function createVideoAnalysis(projectId: string, courseId: string, file: { name: string; size: number; type: string }, now = new Date()): VideoAnalysis {
  const problem = validateVideoFile(file);
  if (problem) throw new Error(problem);
  const iso = now.toISOString();
  return videoAnalysisSchema.parse({
    schemaVersion: 1, id: crypto.randomUUID(), projectId, courseId, fileName: file.name.slice(0, 255), fileSize: file.size, mimeType: file.type,
    durationSec: 0.001, width: 1, height: 1, fps: null, status: 'metadata', progress: 0, error: null, processorJobId: null,
    startMarker: null, finishMarker: null, gateMarkers: [], tracking: [], confidence: 0,
    notes: 'Local computer vision is an approximate visual aid, not a technique diagnosis or competition-legal measurement.', createdAt: iso, updatedAt: iso,
  });
}
