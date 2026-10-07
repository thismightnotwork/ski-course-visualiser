import { createCourse } from './course';
import { applyProcessorJob, draftRunTiming, markerAt, trackingToCourse, updateTrackingPoint } from './videoAnalysis';
import { createVideoAnalysis } from './video';

describe('video analysis utilities', () => {
  it('maps processor output and creates course points after markers', () => {
    let a = createVideoAnalysis('p', 'c', { name: 'x.mp4', size: 10, type: 'video/mp4' });
    a = { ...a, durationSec: 20, startMarker: markerAt({ ...a, durationSec: 20 }, 'start', 2, { x: 0.5, y: 0.1 }), finishMarker: markerAt({ ...a, durationSec: 20 }, 'finish', 17, { x: 0.5, y: 0.9 }) };
    a = applyProcessorJob(a, { id: 'j', status: 'completed', progress: 1, tracking: [{ time_sec: 2, x: 0.5, y: 0.1, confidence: 0.31, source: 'auto' }], confidence: 0.31 });
    expect(draftRunTiming(a)).toBe(15);
    expect(trackingToCourse(a, createCourse('p', 20, 100))[0].y).toBeCloseTo(0);
  });
  it('manual-corrects a sample and raises its confidence', () => {
    let a = createVideoAnalysis('p', 'c', { name: 'x.mp4', size: 10, type: 'video/mp4' });
    a = applyProcessorJob(a, { id: 'j', status: 'completed', progress: 1, tracking: [{ time_sec: 1, x: 0.2, y: 0.3, confidence: 0.1, source: 'auto' }], confidence: 0.1 });
    const corrected = updateTrackingPoint(a, 0, 0.4, 0.5);
    expect(corrected.tracking[0].point).toEqual({ x: 0.4, y: 0.5 });
    expect(corrected.tracking[0].source).toBe('manual');
    expect(corrected.tracking[0].confidence).toBe(1);
  });
});
