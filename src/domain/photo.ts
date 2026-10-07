export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Browser-side check only. A server must repeat it when a backend is added. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a JPEG, PNG or WebP image.';
  }
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_IMAGE_BYTES) return 'The image is larger than 15 MB.';
  return null;
}

/**
 * Starting confidence for elements placed on a calibrated photo. A heuristic, not a measurement:
 * lower when calibration warns about strong perspective or a small marked area.
 */
export function placementConfidence(warnings: string[]): number {
  const weak = warnings.some((w) => w.startsWith('Strong perspective') || w.includes('under 10%'));
  return weak ? 0.4 : 0.7;
}
