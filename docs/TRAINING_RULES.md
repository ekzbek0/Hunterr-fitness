# Adaptive training contract v0.1

## Evidence vs initial product settings
ACSM 2026 supports consistent personalized resistance training, sufficient
volume and training major muscle groups, without universal failure training
or unnecessarily complex techniques. It does NOT validate our readiness score,
our exact thresholds, our XP economy or an individual prescription.

The numbers below are conservative, configurable product hypotheses. Present
them as such in internal docs and explanations; do not attribute them to a
medical trial. Never auto-increase a prescription without acceptance.

## Input
For an exercise: stable exercise/equipment/load-convention ID, planned work
sets, rep range, actual work-set load/reps/RIR, session date, technique/ROM
comparability, relevant pain flags, recovery flags, available increment.
Daily check-in: sleep hours optional, energy 1..5, fatigue 1..5, soreness
0..3, new/increasing joint pain yes/no/unknown, illness yes/no/unknown,
urgent symptoms flags; unknown is a distinct state, never zero.

## Priority and deterministic decision
1. Urgent symptom (chest pain, fainting, unusual severe breathlessness): pause
   training and show urgent-care direction. Use localized emergency copy
   verified for the selected region; do not invent phone numbers.
2. Current systemic illness: pause structured training as a whole and offer
   recovery and appropriate healthcare direction. New/increasing localized
   joint pain: pause affected movements; do not replace them with another
   painful movement. Do not diagnose or treat illness as a hard-workout swap.
3. Missing pain/illness answers or incomplete progression data: do not approve
   load increase. Offer to complete check-in; preserve current prescription.
4. Sleep <6h OR fatigue >=4/5 OR marked soreness 3/3: freeze load increase;
   offer rest or a roughly 25% work-set reduction. Reduction is a proposal,
   bounded to >=1 set for retained exercises; rest is always available.
5. Otherwise follow existing accepted plan. Daily readiness is not permission
   to add random extra sets, increase frequency or prescribe maximal testing.

## Weekly double progression proposal
First apply a recency/training-gap gate: if the latest comparable session is
older than 14 days, or the gap between the two sessions exceeds 14 days,
preserve the plan and offer a conservative rebaseline rather than an increase.
This configurable 14-day gate is a product hypothesis, not a medical cutoff.
Only consider the latest TWO comparable complete sessions for the same
exercise series, with all planned work sets reaching the upper rep target,
RIR >=2 in every work set, no pain/illness/recovery blocker and confirmed
technique comparability. Missing RIR means insufficient evidence.
Propose only the smallest available equipment increment and at most +5% of
the existing load. If the smallest increment exceeds the cap, preserve load;
do not round up, add sets, or demand failure to earn progression.
No automatic 1RM tests. No load progression for zero-load bodyweight exercises
through division by zero: use a separately reviewed progression strategy later.
Two sessions with performance decline and high fatigue can trigger a lighter
week proposal, never an automatic increase. Compare equivalent sessions only.

## Change lifecycle
Inputs -> pure rule evaluation -> structured proposal + reason_codes -> schema
and bounds validation -> UI before/after preview -> user accepts/declines ->
versioned plan. Stable user-editable original always recoverable.
Generate proposals on weekly review or meaningful new data, not every render.
Plan changes never mint another daily-core reward.

## LLM boundary
AI receives a minimal opt-in summary, not a raw photo by default. It can explain
an existing rule outcome or produce a typed candidate. No direct DB write tool
to change prescriptions. Candidate has source/version/reasons and is validated
against equipment, pain/recovery and load/volume bounds before preview.
Malformed, unsupported or excessive candidates are rejected with a readable
fallback. Offline rule logic remains fully available.

## Program frequency
Allow import of the user's preferred 5-day PPLPP. State actual weekly muscle
exposure accurately, including one leg session if that is the schedule. Offer
a reviewed alternative if two exposures are desired. No forced daily anime
challenge such as 100 pushups/situps/squats + 10km regardless of baseline.

## Clinical limits
This is a personal training organizer, not a diagnosis or rehabilitation system.
Safety copy is short and contextual, not a repeated blocking disclaimer.
Medication, SARM, steroid and peptide protocols are outside this app's v1 scope.
