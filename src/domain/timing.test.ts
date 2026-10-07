import {
  computeTiming,
  formatTime,
  gateSegments,
  mistakesPerSection,
  parseTime,
  runWarnings,
} from './timing';
import type { Mistake } from './run';

const mistake = (over: Partial<Mistake> = {}): Mistake => ({
  id: 'm',
  type: 'wide_line',
  timeSec: 10,
  gateNumber: null,
  positionY: null,
  durationSec: 0,
  severity: 'minor',
  notes: '',
  confidence: 1,
  source: 'manual',
  penaltySec: 0,
  ...over,
});

describe('parseTime', () => {
  it('parses seconds, minutes and hours', () => {
    expect(parseTime('45')).toBe(45);
    expect(parseTime('45.3')).toBeCloseTo(45.3);
    expect(parseTime('1:23.45')).toBeCloseTo(83.45);
    expect(parseTime('1:02:03.5')).toBeCloseTo(3723.5);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '1:75', '1:2:3:4', '-5', '1.5:30', '1:60:00']) {
      expect(parseTime(bad)).toBeNull();
    }
  });
});

describe('formatTime', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatTime(9.5)).toBe('9.50');
    expect(formatTime(83.45)).toBe('1:23.45');
    expect(formatTime(60)).toBe('1:00.00');
    expect(formatTime(3725.5)).toBe('1:02:05.50');
  });

  it('round-trips through parseTime', () => {
    expect(parseTime(formatTime(83.45))).toBeCloseTo(83.45);
  });
});

describe('computeTiming', () => {
  const input = {
    totalTimeSec: 50,
    startDelaySec: 0.5,
    finishDelaySec: 0.5,
    penaltySec: 2,
    mistakes: [mistake({ penaltySec: 3 }), mistake()],
    splits: [],
  };

  it('subtracts delays and adds manual and mistake penalties', () => {
    const t = computeTiming(input);
    expect(t.rawTimeSec).toBeCloseTo(49);
    expect(t.manualPenaltySec).toBe(2);
    expect(t.mistakePenaltySec).toBe(3);
    expect(t.penaltyTotalSec).toBe(5);
    expect(t.adjustedTimeSec).toBeCloseTo(54);
    expect(t.mistakeCount).toBe(2);
  });

  it('never gives a negative raw time', () => {
    expect(computeTiming({ ...input, totalTimeSec: 0.5 }).rawTimeSec).toBe(0);
  });

  it('gives no average between gates with fewer than two splits and says why', () => {
    const t = computeTiming({ ...input, splits: [{ gateNumber: 2, timeSec: 10 }] });
    expect(t.avgGateTimeSec).toBeNull();
    expect(t.avgGateNote).toContain('at least two');
  });

  it('averages time per gate between the first and last split', () => {
    const splits = [
      { gateNumber: 4, timeSec: 20 },
      { gateNumber: 2, timeSec: 10 },
    ];
    const t = computeTiming({ ...input, splits });
    expect(t.avgGateTimeSec).toBeCloseTo(5);
    expect(t.segments.map((s) => s.seconds)).toEqual([10, 10]);
  });
});

describe('gateSegments', () => {
  it('measures from the start and between splits', () => {
    const segs = gateSegments([
      { gateNumber: 3, timeSec: 12 },
      { gateNumber: 5, timeSec: 20 },
    ]);
    expect(segs[0].label).toBe('Start to 3');
    expect(segs[1].label).toBe('3 to 5');
    expect(segs[1].seconds).toBe(8);
  });
});

describe('mistakesPerSection', () => {
  const gates = [
    { number: 1, y: 10 },
    { number: 2, y: 20 },
  ];

  it('places mistakes by gate number, then by position', () => {
    const res = mistakesPerSection(
      [
        { gateNumber: 2, positionY: null },
        { gateNumber: null, positionY: 5 },
        { gateNumber: null, positionY: 25 },
        { gateNumber: null, positionY: null },
        { gateNumber: 9, positionY: null },
      ],
      gates,
    );
    const by = Object.fromEntries(res.map((r) => [r.label, r.count]));
    expect(by['Gate 1']).toBe(1);
    expect(by['Gate 2']).toBe(1);
    expect(by['After last gate']).toBe(1);
    expect(by['Unassigned']).toBe(2);
  });

  it('works without gates and hides an empty unassigned bucket', () => {
    expect(mistakesPerSection([], [])).toEqual([]);
    expect(mistakesPerSection([{ gateNumber: null, positionY: null }], [])).toEqual([
      { label: 'Unassigned', count: 1 },
    ]);
  });
});

describe('runWarnings', () => {
  it('flags late mistakes, unknown gates and unverified automatic mistakes', () => {
    const w = runWarnings(
      {
        totalTimeSec: 30,
        mistakes: [
          mistake({ timeSec: 40 }),
          mistake({ gateNumber: 9 }),
          mistake({ source: 'auto' }),
        ],
        splits: [{ gateNumber: 8, timeSec: 10 }],
      },
      [1, 2, 3],
    );
    expect(w.some((x) => x.includes('later than the total'))).toBe(true);
    expect(w.some((x) => x.includes('gate 9'))).toBe(true);
    expect(w.some((x) => x.includes('split refers to gate 8'))).toBe(true);
    expect(w.some((x) => x.includes('unverified'))).toBe(true);
  });
});
