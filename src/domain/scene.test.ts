import { createCourse, createElement } from './course';
import { numberGates } from './geometry';
import { buildSceneModel, cameraPreset, worldPosition } from './scene';

const flat = () => createCourse('p1', 20, 100);

describe('worldPosition', () => {
  it('centres a flat course on the origin', () => {
    const c = flat();
    expect(worldPosition(c, 0, 0)).toEqual([-10, 0, -50]);
    expect(worldPosition(c, 20, 100)).toEqual([10, 0, 50]);
  });

  it('raises the top of a sloped course and shortens the horizontal run', () => {
    const c = { ...flat(), slopeAngleDeg: 30 };
    const top = worldPosition(c, 10, 0);
    const bottom = worldPosition(c, 10, 100);
    expect(top[1]).toBeCloseTo(25);
    expect(bottom[1]).toBeCloseTo(-25);
    expect(top[2]).toBeCloseTo(-50 * Math.cos(Math.PI / 6));
  });

  it('adds height straight up', () => {
    expect(worldPosition(flat(), 10, 50, 1.8)[1]).toBeCloseTo(1.8);
  });
});

describe('buildSceneModel', () => {
  it('builds two poles for a pair and one for a single pole', () => {
    const c = flat();
    const pair = createElement('gate', 10, 50, 'pair');
    const single = { ...createElement('gate', 5, 60, 'single'), poles: 1 as const };
    c.elements = numberGates([pair, single]);
    const m = buildSceneModel(c);
    const pairPoles = m.poles.filter((p) => p.id.startsWith('pair'));
    expect(pairPoles.map((p) => p.position[0]).sort((a, b) => a - b)).toEqual([-2, 2]);
    expect(m.poles.filter((p) => p.id.startsWith('single'))).toHaveLength(1);
  });

  it('adds panels, bars and hazards for the matching element types', () => {
    const c = flat();
    c.elements = [
      createElement('panel', 10, 20, 'p'),
      createElement('start', 10, 0, 's'),
      createElement('finish', 10, 100, 'f'),
      createElement('hazard', 3, 30, 'h'),
    ];
    const m = buildSceneModel(c);
    expect(m.panels).toHaveLength(1);
    expect(m.bars).toHaveLength(2);
    expect(m.hazards).toHaveLength(1);
  });

  it('labels numbered gates, start and finish and orders the course line', () => {
    const c = flat();
    c.elements = numberGates([
      createElement('gate', 10, 60, 'b'),
      createElement('gate', 10, 20, 'a'),
      createElement('start', 10, 0, 's'),
      createElement('finish', 10, 100, 'f'),
    ]);
    const m = buildSceneModel(c);
    expect(m.labels.map((l) => l.text).sort()).toEqual(['1', '2', 'Finish', 'Start']);
    expect(m.courseLine).toHaveLength(4);
    expect(m.courseLine[0][2]).toBeLessThan(m.courseLine[3][2]);
  });

  it('warns about a missing slope angle and uncertain positions', () => {
    const c = flat();
    c.elements = [{ ...createElement('gate', 1, 1, 'g'), source: 'estimated' as const }];
    const m = buildSceneModel(c);
    expect(m.warnings.some((w) => w.includes('Slope angle'))).toBe(true);
    expect(m.warnings.some((w) => w.includes('estimated or unknown'))).toBe(true);
    expect(buildSceneModel({ ...c, slopeAngleDeg: 20 }).warnings.some((w) => w.includes('Slope'))).toBe(
      false,
    );
  });
});

describe('cameraPreset', () => {
  it('looks straight down for the top view', () => {
    const v = cameraPreset(flat(), 'top');
    expect(v.position[1]).toBeGreaterThan(100);
    expect(v.target).toEqual([0, 0, 0]);
  });

  it('starts at the start element for the first-person view and falls back to the top centre', () => {
    const c = flat();
    expect(cameraPreset(c, 'first_person').position[0]).toBeCloseTo(0);
    c.elements = [createElement('start', 4, 0, 's')];
    const v = cameraPreset(c, 'first_person');
    expect(v.position[0]).toBeCloseTo(-6);
    expect(v.position[1]).toBeCloseTo(1.7);
    expect(v.target[2]).toBeGreaterThan(v.position[2]);
  });
});
