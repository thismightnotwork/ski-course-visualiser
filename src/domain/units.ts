export type Units = 'metres' | 'feet';

const METRES_PER_FOOT = 0.3048;

export function toMetres(value: number, units: Units): number {
  return units === 'feet' ? value * METRES_PER_FOOT : value;
}

export function fromMetres(metres: number, units: Units): number {
  return units === 'feet' ? metres / METRES_PER_FOOT : metres;
}

export function unitLabel(units: Units): string {
  return units === 'feet' ? 'ft' : 'm';
}

export function formatLength(metres: number, units: Units, digits = 2): string {
  return `${fromMetres(metres, units).toFixed(digits)} ${unitLabel(units)}`;
}
