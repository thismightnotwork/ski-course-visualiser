import type { Course, CourseElement, ElementType } from './course';
import { elementEnds, isSinglePole } from './geometry';

export type Vec3 = [number, number, number];

/** Visual defaults in metres. These are not measurements. */
const HEIGHT: Record<ElementType, number> = {
  start: 1.2,
  finish: 2.5,
  gate: 1.8,
  combination: 1.8,
  delay_gate: 1.8,
  panel: 1.4,
  training_pole: 1.5,
  hazard: 0.5,
};

export interface PoleModel {
  id: string;
  position: Vec3;
  height: number;
  radius: number;
  colour: string;
}
export interface BoxModel {
  id: string;
  position: Vec3;
  size: Vec3;
  yaw: number;
  colour: string;
}
export interface HazardModel {
  id: string;
  position: Vec3;
  size: [number, number];
  yaw: number;
  colour: string;
}
export interface LabelModel {
  id: string;
  text: string;
  position: Vec3;
}
export interface SceneModel {
  surface: { width: number; length: number; angleRad: number };
  poles: PoleModel[];
  panels: BoxModel[];
  bars: BoxModel[];
  hazards: HazardModel[];
  labels: LabelModel[];
  courseLine: Vec3[];
  warnings: string[];
}

export function slopeAngleRad(course: Course): number {
  return ((course.slopeAngleDeg ?? 0) * Math.PI) / 180;
}

/**
 * Course plan coordinates (x across, y down the slope surface) to world coordinates.
 * World: X across, Y up, Z downhill. The surface is centred on the origin.
 */
export function worldPosition(course: Course, x: number, y: number, height = 0): Vec3 {
  const a = slopeAngleRad(course);
  return [
    x - course.width / 2,
    (course.length / 2 - y) * Math.sin(a) + height,
    (y - course.length / 2) * Math.cos(a),
  ];
}

const lift = (p: Vec3, h: number): Vec3 => [p[0], p[1] + h, p[2]];

export function buildSceneModel(course: Course): SceneModel {
  const poles: PoleModel[] = [];
  const panels: BoxModel[] = [];
  const bars: BoxModel[] = [];
  const hazards: HazardModel[] = [];
  const labels: LabelModel[] = [];
  const angle = slopeAngleRad(course);

  for (const el of course.elements) {
    const [ea, eb] = elementEnds(el);
    const a = worldPosition(course, ea.x, ea.y);
    const b = worldPosition(course, eb.x, eb.y);
    const centre = worldPosition(course, el.x, el.y);
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const rad = (el.rotationDeg * Math.PI) / 180;
    const yaw = dx === 0 && dz === 0 ? -rad : -Math.atan2(dz, dx);
    const height = HEIGHT[el.type];
    const single = isSinglePole(el);
    const pole = (suffix: string, position: Vec3): PoleModel => ({
      id: `${el.id}:${suffix}`,
      position,
      height,
      radius: el.type === 'finish' ? 0.06 : 0.03,
      colour: el.colour,
    });

    if (el.type === 'hazard') {
      hazards.push({
        id: el.id,
        position: centre,
        size: [el.width, el.width / 2],
        yaw,
        colour: el.colour,
      });
    } else {
      if (single) poles.push(pole('0', centre));
      else {
        poles.push(pole('0', a));
        poles.push(pole('1', b));
      }
      const length = Math.hypot(dx, dz);
      if (el.type === 'start') {
        bars.push({
          id: el.id,
          position: lift(centre, 1.0),
          size: [el.width, 0.05, 0.05],
          yaw,
          colour: el.colour,
        });
      }
      if (el.type === 'finish') {
        bars.push({
          id: el.id,
          position: lift(centre, height - 0.2),
          size: [el.width, 0.4, 0.04],
          yaw,
          colour: el.colour,
        });
      }
      if (el.type === 'panel') {
        if (single) {
          panels.push({
            id: el.id,
            position: [
              centre[0] + Math.cos(rad) * 0.3,
              centre[1] + 1.1,
              centre[2] + Math.sin(rad) * 0.3 * Math.cos(angle),
            ],
            size: [0.5, 0.35, 0.02],
            yaw: -rad,
            colour: el.colour,
          });
        } else {
          panels.push({
            id: el.id,
            position: lift(centre, 1.05),
            size: [length, 0.7, 0.02],
            yaw,
            colour: el.colour,
          });
        }
      }
    }

    const text =
      el.number !== null
        ? String(el.number)
        : el.type === 'start'
          ? 'Start'
          : el.type === 'finish'
            ? 'Finish'
            : null;
    if (text) labels.push({ id: el.id, text, position: lift(centre, height + 0.5) });
  }

  const numbered = course.elements
    .filter((e) => e.number !== null)
    .sort((p, q) => (p.number as number) - (q.number as number));
  const start = course.elements.find((e) => e.type === 'start');
  const finish = course.elements.find((e) => e.type === 'finish');
  const sequence = [start, ...numbered, finish].filter((e): e is CourseElement => e !== undefined);
  const courseLine = sequence.map((e) => worldPosition(course, e.x, e.y, 0.05));

  const warnings: string[] = [];
  if (course.slopeAngleDeg === null) {
    warnings.push('Slope angle not entered: the surface is drawn flat.');
  }
  const uncertain = course.elements.filter(
    (e) => e.source === 'estimated' || e.source === 'unknown',
  ).length;
  if (uncertain > 0) {
    warnings.push(`${uncertain} element position(s) are estimated or unknown and drawn as stored.`);
  }
  warnings.push('Pole heights and sizes are visual defaults, not measurements.');

  return {
    surface: { width: course.width, length: course.length, angleRad: angle },
    poles,
    panels,
    bars,
    hazards,
    labels,
    courseLine,
    warnings,
  };
}

export type CameraPreset = 'orbit' | 'top' | 'side' | 'first_person';

export const CAMERA_LABELS: Record<CameraPreset, string> = {
  orbit: 'Orbit',
  top: 'Top-down',
  side: 'Side',
  first_person: 'From the start',
};

export interface CameraView {
  position: Vec3;
  target: Vec3;
}

export function cameraPreset(course: Course, preset: CameraPreset): CameraView {
  const w = course.width;
  const l = course.length;
  const d = Math.max(w, l);
  const rise = (l / 2) * Math.sin(slopeAngleRad(course));
  switch (preset) {
    case 'top':
      return { position: [0, d * 1.3 + 10, 0.01], target: [0, 0, 0] };
    case 'side':
      return { position: [w / 2 + d * 1.1 + 5, 2, 0], target: [0, 0, 0] };
    case 'first_person': {
      const start = course.elements.find((e) => e.type === 'start');
      const sx = start ? start.x : w / 2;
      const sy = start ? start.y : 0;
      return {
        position: worldPosition(course, sx, sy, 1.7),
        target: worldPosition(course, sx, Math.min(l, sy + 40), 1.0),
      };
    }
    default:
      return {
        position: [w * 0.8 + 5, rise + d * 0.4 + 5, -l * 0.6 - 5],
        target: [0, 0, 0],
      };
  }
}
