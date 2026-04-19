export interface TickSet {
  majorInterval: number;
  minorsPerMajor: number;
  majors: number[];
}

const NICE_INTERVALS = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

export function computeTicks(duration: number, targetMajors = 10): TickSet {
  if (!(duration > 0)) return { majorInterval: 0, minorsPerMajor: 4, majors: [] };

  const raw = duration / targetMajors;
  let majorInterval = NICE_INTERVALS[NICE_INTERVALS.length - 1];
  for (const v of NICE_INTERVALS) {
    if (v >= raw) { majorInterval = v; break; }
  }
  const majors: number[] = [];
  for (let t = majorInterval; t <= duration + 1e-6; t += majorInterval) {
    majors.push(t);
  }
  return { majorInterval, minorsPerMajor: 4, majors };
}
