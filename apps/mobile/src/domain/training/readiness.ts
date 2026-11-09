/**
 * Minimal daily-core suggestion from a check-in (docs/TRAINING_RULES.md,
 * "Priority and deterministic decision", steps 1-4). Never imports game logic.
 * Thresholds are configurable product hypotheses, not medical cutoffs.
 */

export type TriState = 'yes' | 'no' | 'unknown';

export interface CheckinInput {
  sleepHours: number | null;
  energy: number; // 1..5
  fatigue: number; // 1..5
  soreness: number; // 0..3
  jointPain: TriState;
  illness: TriState;
}

export type ReasonCode =
  | 'illness'
  | 'joint-pain'
  | 'safety-unknown'
  | 'short-sleep'
  | 'high-fatigue'
  | 'marked-soreness';

export interface CoreSuggestion {
  /** 'pause-training': structured training paused, recovery offered. */
  mode: 'follow-plan' | 'recovery-offered' | 'pause-training';
  /** Load increases are never approved when true. */
  freezeLoadIncrease: boolean;
  reasons: ReasonCode[];
}

function isIntIn(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function validateCheckin(input: CheckinInput): CheckinInput {
  const tri = ['yes', 'no', 'unknown'];
  if (!isIntIn(input.energy, 1, 5)) throw new RangeError('energy must be 1..5');
  if (!isIntIn(input.fatigue, 1, 5)) throw new RangeError('fatigue must be 1..5');
  if (!isIntIn(input.soreness, 0, 3)) throw new RangeError('soreness must be 0..3');
  if (!tri.includes(input.jointPain) || !tri.includes(input.illness)) {
    throw new RangeError('pain/illness must be yes, no or unknown');
  }
  if (input.sleepHours !== null) {
    if (!Number.isFinite(input.sleepHours) || input.sleepHours < 0 || input.sleepHours > 24) {
      throw new RangeError('sleepHours must be 0..24 or null');
    }
  }
  return { ...input };
}

export function suggestCore(input: CheckinInput): CoreSuggestion {
  const c = validateCheckin(input);
  if (c.illness === 'yes') return { mode: 'pause-training', freezeLoadIncrease: true, reasons: ['illness'] };
  const reasons: ReasonCode[] = [];
  if (c.jointPain === 'yes') reasons.push('joint-pain');
  if (c.illness === 'unknown' || c.jointPain === 'unknown') reasons.push('safety-unknown');
  if (c.sleepHours !== null && c.sleepHours < 6) reasons.push('short-sleep');
  if (c.fatigue >= 4) reasons.push('high-fatigue');
  if (c.soreness >= 3) reasons.push('marked-soreness');
  const recovery = reasons.some((r) => r !== 'safety-unknown');
  return {
    mode: recovery ? 'recovery-offered' : 'follow-plan',
    freezeLoadIncrease: reasons.length > 0,
    reasons,
  };
}
