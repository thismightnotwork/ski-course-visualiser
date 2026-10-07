import { createCourse } from './course';
import { applyProcessorJob, draftRunTiming, markerAt, normalisePoint, trackingToCourse } from './videoAnalysis';
import { createVideoAnalysis, validateVideoFile } from './video';

describe('video validation and processor integration', () => {
  const file = { name: 'run.mp4', size: 1000, type: 'video/mp4' };
  it('validates supported uploads and rejects unsupported files', () => {
    expect(validateVideoFile(file)).toBeNull();
    expect(validateVideoFile({ ...file, type: 'video/avi' })).not.toBeNull();
  });
  it('creates an honest local-analysis state', () => {
    const a = createVideoAnalysis('p', 'c', file, new Date(0));
    expect(a.status).toBe('metadata');
    expect(a.confidence).toBe(0);
    expect(a.processorJobId).toBeNull();
  });
  it('normalises points and maps processor output', () => {
    expect(normalisePoint(50, 25, 100, 100)).toEqual({ x: 0.5, y: 0.25 });
    let a = createVideoAnalysis('p', 'c', file);
    a = { ...a, durationSec: 20, width: 100, height: 100, startMarker: markerAt({ ...a, durationSec: 20 }, 'start', 2, { x: 0.5, y: 0.1 }), finishMarker: markerAt({ ...a, durationSec: 20 }, 'finish', 17, { x: 0.5, y: 0.9 }) };
    a = applyProcessorJob(a, { id: 'j', status: 'completed', progress: 1, duration_sec: 20, width: 100, height: 100, fps: 30, tracking: [{ time_sec: 2, x: 0.5, y: 0.1, confidence: 0.4, source: 'auto' }], confidence: 0.4 });
    expect(a.status).toBe('ready');
    expect(draftRunTiming(a)).toBe(15);
    expect(trackingToCourse(a, createCourse('p', 20, 100))[0].y).toBeCloseTo(0);
  });
});
