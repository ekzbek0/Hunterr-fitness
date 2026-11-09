# Product contract

## Experience
Turkish first, personal single-user, iPhone first. Visual direction: dark navy,
restrained electric blue/violet, legible text, original hunter-avatar fantasy,
clear daily progress and optional restrained haptics. No franchise assets.
Use semantic colors; recovery is a successful state. Dynamic Type, VoiceOver,
44pt interaction targets and Reduce Motion. No flickering or constant particles.

Navigation: Bugün / Antrenman / Karakter / Gelişim / Ayarlar.
Coach explanations can be a contextual sheet; do not add chat as a dependency
for task completion. Show only information useful to the person exercising.

## Onboarding
Confirm current goal, current routine, available days/time, equipment and
exercise limitations. Biometrics and photos optional. Existing conversation
facts are suggestions, never current measurements. Defaults are editable.
Ask about pain separately from normal delayed muscle soreness. Provide a
manual route when permissions are declined. Never ask for drug/stack details
as a requirement for using this app.

## Workouts
Plan a scheduled session; show exercise names, prescription, how-to text,
alternatives preserving movement pattern/equipment. Track actual load unit,
sets, reps, rest and optional RIR; distinguish per-dumbbell from total load.
Warm-up entries never count as hard working sets. Interrupted sessions resume.
Editing prior sets updates history, not retroactive fabricated rewards.
Changing an exercise/equipment creates a different progression series.
Technical clips may be link-outs or licensed assets; show a readable how-to
when missing. Never invent a working video URL.

## Daily loop
Persistent daily snapshot with schedule timezone and multiplier snapshot.
Check-in -> appropriate daily-core slot -> optional chosen habit slots.
Daily-core can resolve to training, planned recovery or illness/pain recovery.
Allow defer/reschedule without tomorrow's exercise debt. No negative XP.
Additional sets/exercise outside the plan earn no additional XP.
Task completion can be self-reported: do not claim objective body verification.

## Game economy: initial tunable design, not physiology
- Check-in 10 XP; daily core 60 XP (workout/recovery equal).
- Two optional habit slots 15 XP each. Base daily maximum = 100 XP.
- Weekly review = 40 XP once per persisted weekly cycle, outside daily cap.
- XP multiplier selection: 0.5, 1, 1.5, 2; default 1. Changes apply to the
  next generated task day, never rewrite completed rewards. Round each slot
  using documented half-up integer rounding. Store granted amount permanently.
- Level threshold for level L>=1: totalXP >= 50*(L-1)*L. Thus L1=0,
  L2=100, L3=300, L4=600. Bound supported levels and use integer-safe arithmetic.
- Ranks by level: E1, D5, C10, B20, A35, S50. Cosmetic prestige only.
- Avatar, title, original story vignette and optional original celebration clip
  unlocks. Exercise safety instructions and useful core functions never gated.
- Photo submission earns no exclusive XP. No reward for body weight itself,
  extreme weight loss, calorie restriction or ignoring pain.
- User can disable story, sound, animations and streak presentation.

## Progress and habits
Show strength/reps for comparable exercises, habit continuity, measurement
trends with dates and units. Weekly average weight only if user elects logging.
No precise body-fat estimate from images. AI visual feedback, if later built,
is separately opt-in and describes only limited observations with uncertainty.
Nutrition tasks start with regular meal planning/logging; exact calorie/fluid
targets require current information and user preference, not avatar rank.

## Scope
M0-M3 local core: onboarding, today, logging, XP, rules, avatar, progress,
local reminders, opt-in speech, export/import and deletion.
M4 optional: private photo journal, account sync, HealthKit, server AI.
No social leaderboard, payments, subscriptions, live 3D world, continuous
listening or AI form-video diagnosis in the first build.

## Acceptance UX
Every screen has loading/empty/error states, navigation back and editable
settings. The user can finish the core without notifications, microphone,
camera, account or HealthKit. No nonfunctional controls labelled as available.
