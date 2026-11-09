/**
 * Training profile facts the user confirms before a program is generated.
 * Pure validation only; never imports game logic. Body measurements are
 * optional and never required to use the app.
 */

export const GOALS = ['muscle', 'strength', 'general-fitness', 'fat-loss-support'] as const;
export type Goal = (typeof GOALS)[number];

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const EQUIPMENT = ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullup-bar', 'bands', 'bodyweight'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** Movement restrictions the user declares; affected exercises are never generated. */
export const LIMITATIONS = ['overhead', 'spinal-loading', 'deep-knee-flexion', 'wrist-loading'] as const;
export type Limitation = (typeof LIMITATIONS)[number];

/** 0 = Monday … 6 = Sunday (ISO order). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TrainingProfileInput {
  goal: Goal;
  trainingDays: readonly number[];
  sessionMinutes: number | null;
  equipment: readonly string[];
  experience: Experience;
  limitations: readonly string[];
  heightCm: number | null;
  weightKg: number | null;
}

export interface TrainingProfileFacts {
  goal: Goal;
  trainingDays: Weekday[];
  sessionMinutes: number | null;
  equipment: Equipment[];
  experience: Experience;
  limitations: Limitation[];
  heightCm: number | null;
  weightKg: number | null;
}

export type ProfileError =
  | 'goal'
  | 'training-days'
  | 'session-minutes'
  | 'equipment'
  | 'experience'
  | 'limitations'
  | 'height'
  | 'weight';

export class TrainingProfileError extends RangeError {
  constructor(public readonly field: ProfileError) {
    super(`invalid training profile field: ${field}`);
  }
}

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && list.includes(v as T);

function optionalRange(v: number | null, min: number, max: number, field: ProfileError): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new TrainingProfileError(field);
  return Math.round(v * 10) / 10;
}

/** Validates and normalises (sorted, de-duplicated) a confirmed training profile. */
export function validateTrainingProfile(input: TrainingProfileInput): TrainingProfileFacts {
  if (!isIn(GOALS, input.goal)) throw new TrainingProfileError('goal');
  if (!isIn(EXPERIENCE_LEVELS, input.experience)) throw new TrainingProfileError('experience');

  const days = [...new Set(input.trainingDays)];
  if (days.length !== input.trainingDays.length) throw new TrainingProfileError('training-days');
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new TrainingProfileError('training-days');
  if (days.length < 2 || days.length > 6) throw new TrainingProfileError('training-days');

  const equipment = [...new Set(input.equipment)];
  if (equipment.length === 0 || !equipment.every((e) => isIn(EQUIPMENT, e))) throw new TrainingProfileError('equipment');
  // Bodyweight is always possible; keep it so every pattern can find an option.
  if (!equipment.includes('bodyweight')) equipment.push('bodyweight');

  const limitations = [...new Set(input.limitations)];
  if (!limitations.every((l) => isIn(LIMITATIONS, l))) throw new TrainingProfileError('limitations');

  let sessionMinutes: number | null = null;
  if (input.sessionMinutes !== null) {
    if (!Number.isInteger(input.sessionMinutes) || input.sessionMinutes < 15 || input.sessionMinutes > 180) {
      throw new TrainingProfileError('session-minutes');
    }
    sessionMinutes = input.sessionMinutes;
  }

  return {
    goal: input.goal,
    trainingDays: (days as Weekday[]).sort((a, b) => a - b),
    sessionMinutes,
    equipment: (equipment as Equipment[]).sort((a, b) => EQUIPMENT.indexOf(a) - EQUIPMENT.indexOf(b)),
    experience: input.experience,
    limitations: (limitations as Limitation[]).sort((a, b) => LIMITATIONS.indexOf(a) - LIMITATIONS.indexOf(b)),
    heightCm: optionalRange(input.heightCm, 100, 250, 'height'),
    weightKg: optionalRange(input.weightKg, 30, 300, 'weight'),
  };
}

/**
 * Editable suggestion for a new user (the PPLPP preference from planning
 * notes). It is a draft: nothing is stored until the user confirms it.
 */
export const DRAFT_TRAINING_PROFILE: TrainingProfileInput = {
  goal: 'muscle',
  trainingDays: [0, 1, 2, 4, 5],
  sessionMinutes: 60,
  equipment: ['barbell', 'dumbbell', 'bench', 'cable', 'machine', 'pullup-bar', 'bodyweight'],
  experience: 'intermediate',
  limitations: [],
  heightCm: null,
  weightKg: null,
};
