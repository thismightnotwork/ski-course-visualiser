import type { Mistake, Split } from './run';

/** Accepts S, S.ss, M:SS, M:SS.ss and H:MM:SS.ss. Returns seconds or null. */
export function parseTime(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(':');
  if (parts.length > 3) return null;
  if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  for (let i = 0; i < nums.length - 1; i++) {
    if (!Number.isInteger(nums[i])) return null;
  }
  const seconds = nums[nums.length - 1];
  if (nums.length > 1 && seconds >= 60) return null;
  if (nums.length === 3 && nums[1] >= 60) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return '-';
  const cs = Math.round(Math.abs(sec) * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = (cs % 6000) / 100;
  const ss = s.toFixed(2).padStart(5, '0');
  const sign = sec < 0 ? '-' : '';
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${ss}`;
  if (m > 0) return `${sign}${m}:${ss}`;
  return `${sign}${s.toFixed(2)}`;
}

export interface Segment {
  label: string;
  fromGate: number;
  toGate: number;
  seconds: number;
}

export interface TimingInput {
  totalTimeSec: number;
  startDelaySec: number;
  finishDelaySec: number;
  penaltySec: number;
  mistakes: Pick<Mistake, 'penaltySec'>[];
  splits: Split[];
}

export interface TimingSummary {
  rawTimeSec: number;
  manualPenaltySec: number;
  mistakePenaltySec: number;
  penaltyTotalSec: number;
  adjustedTimeSec: number;
  mistakeCount: number;
  segments: Segment[];
  avgGateTimeSec: number | null;
  avgGateNote: string;
}

/** Split segments, measured from the start of timing (gate 0). */
export function gateSegments(splits: Split[]): Segment[] {
  const sorted = [...splits].sort((a, b) => a.gateNumber - b.gateNumber);
  const out: Segment[] = [];
  let prevGate = 0;
  let prevTime = 0;
  for (const s of sorted) {
    out.push({
      label: prevGate === 0 ? `Start to ${s.gateNumber}` : `${prevGate} to ${s.gateNumber}`,
      fromGate: prevGate,
      toGate: s.gateNumber,
      seconds: s.timeSec - prevTime,
    });
    prevGate = s.gateNumber;
    prevTime = s.timeSec;
  }
  return out;
}

export function computeTiming(input: TimingInput): TimingSummary {
  const rawTimeSec = Math.max(0, input.totalTimeSec - input.startDelaySec - input.finishDelaySec);
  const mistakePenaltySec = input.mistakes.reduce((sum, m) => sum + m.penaltySec, 0);
  const penaltyTotalSec = input.penaltySec + mistakePenaltySec;
  const sorted = [...input.splits].sort((a, b) => a.gateNumber - b.gateNumber);
  let avgGateTimeSec: number | null = null;
  let avgGateNote = 'Enter at least two gate split times to see the average time between gates.';
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const gates = last.gateNumber - first.gateNumber;
    if (gates > 0 && last.timeSec > first.timeSec) {
      avgGateTimeSec = (last.timeSec - first.timeSec) / gates;
      avgGateNote = `Average per gate between gate ${first.gateNumber} and gate ${last.gateNumber}, from the entered split times.`;
    }
  }
  return {
    rawTimeSec,
    manualPenaltySec: input.penaltySec,
    mistakePenaltySec,
    penaltyTotalSec,
    adjustedTimeSec: rawTimeSec + penaltyTotalSec,
    mistakeCount: input.mistakes.length,
    segments: gateSegments(input.splits),
    avgGateTimeSec,
    avgGateNote,
  };
}

export interface SectionCount {
  label: string;
  count: number;
}

/**
 * Counts mistakes per section. A section covers the approach to a gate and the gate itself.
 * A mistake is placed by its gate number, otherwise by its position down the slope.
 */
export function mistakesPerSection(
  mistakes: Pick<Mistake, 'gateNumber' | 'positionY'>[],
  gates: { number: number; y: number }[],
): SectionCount[] {
  const sorted = [...gates].sort((a, b) => a.number - b.number);
  const counts = new Map<string, number>();
  const labels = sorted.map((g) => `Gate ${g.number}`);
  labels.forEach((l) => counts.set(l, 0));
  const after = 'After last gate';
  const none = 'Unassigned';
  if (sorted.length > 0) counts.set(after, 0);
  counts.set(none, 0);
  const bump = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);
  for (const m of mistakes) {
    if (m.gateNumber !== null) {
      const g = sorted.find((x) => x.number === m.gateNumber);
      bump(g ? `Gate ${g.number}` : none);
    } else if (m.positionY !== null && sorted.length > 0) {
      const g = sorted.find((x) => x.y >= (m.positionY as number));
      bump(g ? `Gate ${g.number}` : after);
    } else {
      bump(none);
    }
  }
  return [...counts.entries()]
    .filter(([label, count]) => label !== none || count > 0)
    .map(([label, count]) => ({ label, count }));
}

export function runWarnings(
  run: { totalTimeSec: number; mistakes: Mistake[]; splits: Split[] },
  gateNumbers: number[],
): string[] {
  const out: string[] = [];
  for (const m of run.mistakes) {
    if (m.timeSec > run.totalTimeSec) {
      out.push(`A mistake at ${formatTime(m.timeSec)} is later than the total time.`);
    }
    if (m.gateNumber !== null && gateNumbers.length > 0 && !gateNumbers.includes(m.gateNumber)) {
      out.push(`A mistake refers to gate ${m.gateNumber}, which is not in the course.`);
    }
  }
  for (const s of run.splits) {
    if (gateNumbers.length > 0 && !gateNumbers.includes(s.gateNumber)) {
      out.push(`A split refers to gate ${s.gateNumber}, which is not in the course.`);
    }
  }
  if (run.mistakes.some((m) => m.source === 'auto')) {
    out.push('Automatically detected mistakes are unverified: check them against the video.');
  }
  return [...new Set(out)];
}
