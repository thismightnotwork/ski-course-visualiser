import { calibrationSchema, courseSchema, createCourse } from './course';
import { MAX_IMAGE_BYTES, placementConfidence, validateImageFile } from './photo';

describe('validateImageFile', () => {
  it('accepts supported images', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('rejects other types, empty files and oversized files', () => {
    expect(validateImageFile({ type: 'image/gif', size: 1000 })).not.toBeNull();
    expect(validateImageFile({ type: 'application/pdf', size: 1000 })).not.toBeNull();
    expect(validateImageFile({ type: 'image/png', size: 0 })).not.toBeNull();
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).not.toBeNull();
  });
});

describe('placementConfidence', () => {
  it('is lower when calibration warns about weak geometry', () => {
    expect(placementConfidence(['Assumes the four points lie on one flat plane.'])).toBe(0.7);
    expect(placementConfidence(['Strong perspective: opposite edges differ greatly.'])).toBe(0.4);
    expect(placementConfidence(['The marked area covers under 10% of the photo.'])).toBe(0.4);
  });
});

describe('calibration schema', () => {
  const pt = (x: number, y: number) => ({ x, y });
  const base = {
    method: 'quad' as const,
    imageWidth: 800,
    imageHeight: 600,
    quadPoints: [pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)],
    references: [],
    updatedAt: '2026-10-07T00:00:00Z',
  };

  it('accepts four points and rejects other counts or bad references', () => {
    expect(calibrationSchema.safeParse(base).success).toBe(true);
    expect(calibrationSchema.safeParse({ ...base, quadPoints: [pt(0, 0)] }).success).toBe(false);
    const badRef = { ...base, references: [{ a: pt(0, 0), b: pt(1, 1), realMetres: -2 }] };
    expect(calibrationSchema.safeParse(badRef).success).toBe(false);
  });

  it('defaults a course without calibration to null', () => {
    const c = createCourse('p', 20, 100);
    expect(c.calibration).toBeNull();
    const { calibration: _unused, ...legacy } = c;
    void _unused;
    const parsed = courseSchema.safeParse(legacy);
    expect(parsed.success && parsed.data.calibration).toBeNull();
  });
});
