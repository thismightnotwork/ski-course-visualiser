import type { Course } from './course';
import type { VideoAnalysis, VideoMarker } from './video';

export function normalisePoint(x: number, y: number, width: number, height: number) {
  return {
    x: Math.max(0, Math.min(1, x / Math.max(1, width))),
    y: Math.max(0, Math.min(1, y / Math.max(1, height))),
  };
}

export function markerAt(
  analysis: VideoAnalysis,
  kind: VideoMarker['kind'],
  timeSec: number,
  point: { x: number; y: number } | null,
  gateNumber: number | null = null,
): VideoMarker {
  return {
    id: crypto.randomUUID(),
    kind,
    timeSec: Math.max(0, Math.min(analysis.durationSec, timeSec)),
    gateNumber,
    point,
    source: 'manual',
    confidence: 1,
  };
}

export function autoTrackPlaceholder(analysis: VideoAnalysis, samples = 120): VideoAnalysis {
  const count = Math.max(2, Math.min(samples, 10000));
  const tracking = Array.from({ length: count }, (_, i) => ({
    timeSec: (analysis.durationSec * i) / (count - 1),
    point: { x: 0.5, y: i / (count - 1) },
    confidence: 0,
    source: 'auto' as const,
  }));
  return {
    ...analysis,
    status: 'ready',
    progress: 1,
    tracking,
    confidence: 0,
    error: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Maps a normalised video point to the course plan only as a rough visual aid. */
export function trackingToCourse(
  analysis: VideoAnalysis,
  course: Course,
): { x: number; y: number; confidence: number }[] {
  const start = analysis.startMarker?.point;
  const finish = analysis.finishMarker?.point;
  if (!start || !finish) return [];
  const dx = finish.x - start.x;
  const dy = finish.y - start.y;
  if (Math.hypot(dx, dy) < 1e-9) return [];
  return analysis.tracking.map((s) => ({
    x: Math.max(0, Math.min(course.width, ((s.point.x - start.x) / dx) * course.width)),
    y: Math.max(0, Math.min(course.length, ((s.point.y - start.y) / dy) * course.length)),
    confidence: s.confidence,
  }));
}

export function draftRunTiming(analysis: VideoAnalysis): number | null {
  if (!analysis.startMarker || !analysis.finishMarker) return null;
  const duration = analysis.finishMarker.timeSec - analysis.startMarker.timeSec;
  return duration > 0 ? duration : null;
}
