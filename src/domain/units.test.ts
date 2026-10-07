import { formatLength, fromMetres, toMetres } from './units';

describe('units', () => {
  it('converts feet to metres', () => {
    expect(toMetres(100, 'feet')).toBeCloseTo(30.48, 5);
  });
  it('round-trips', () => {
    expect(fromMetres(toMetres(12.5, 'feet'), 'feet')).toBeCloseTo(12.5, 8);
  });
  it('leaves metres unchanged and formats with a unit', () => {
    expect(toMetres(7, 'metres')).toBe(7);
    expect(formatLength(3.048, 'feet', 1)).toBe('10.0 ft');
  });
});
