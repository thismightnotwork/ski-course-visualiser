import { createCourse } from './course';
import { autoTrackPlaceholder, draftRunTiming, markerAt, normalisePoint, trackingToCourse } from './videoAnalysis';
import { createVideoAnalysis, validateVideoFile } from './video';

describe('video validation and analysis', () => {
  const file = { name: 'run.mp4', size: 1000, type: 'video/mp4' };

  it('validates supported uploads and rejects unsupported files', () => {
    expect(validateVideoFile(file)).toBeNull();
    expect(validateVideoFile({ ...file, type: 'video/avi' })).not.toBeNull();
    expect(validateVideoFile({ ...file, size: 0 })).not.toBeNull();
  });

  it('creates an analysis with an honest placeholder state', () => {
    const a = createVideoAnalysis('p', 'c', file, new Date(0));
    expect(a.status).toBe('metadata');
    expect(a.confidence).toBe(0);
    expect(a.notes).toContain('approximate');
  });

  it('normalises and clamps points', () => {
    expect(normalisePoint(50, 25, 100, 100)).toEqual({ x: 0.5, y: 0.25 });
    expect(normalisePoint(-10, 200, 100, 100)).toEqual({ x: 0, y: 1 });
  });

  it('creates manual markers and a placeholder path', () => {
    let a = createVideoAnalysis('p', 'c', file);
    a = { ...a, durationSec: 20, width: 100, height: 100 };
    a = { ...a, startMarker: markerAt(a, 'start', 2, { x: 0.5, y: 0.1 }) };
    a = { ...a, finishMarker: markerAt(a, 'finish', 17, { x: 0.5, y: 0.9 }) };
    a = autoTrackPlaceholder(a, 5);
    expect(a.tracking).toHaveLength(5);
    expect(draftRunTiming(a)).toBe(15);
    expect(trackingToCourse(a, createCourse('p', 20, 100))[2].y).toBeCloseTo(50);
  });
});
