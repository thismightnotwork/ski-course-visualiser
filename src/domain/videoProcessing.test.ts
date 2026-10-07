import { applyProcessorJob } from './videoAnalysis';
import { createVideoAnalysis } from './video';

describe('processor job mapping', () => {
  it('preserves metadata and maps failed jobs', () => {
    const a = createVideoAnalysis('p', 'c', { name: 'x.mp4', size: 10, type: 'video/mp4' });
    const mapped = applyProcessorJob(a, { id: 'job', status: 'failed', progress: 0.4, tracking: [], confidence: 0, error: 'OpenCV failed' });
    expect(mapped.status).toBe('failed');
    expect(mapped.error).toBe('OpenCV failed');
    expect(mapped.processorJobId).toBe('job');
  });
});
