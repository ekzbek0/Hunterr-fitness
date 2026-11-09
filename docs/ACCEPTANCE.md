# Acceptance and verification

The starter kit itself is not app-test evidence. Record actual results here
or in PROGRESS.md only after implementing and running the app.

## First vertical slice
Create profile -> generate today -> record check-in -> complete daily core ->
see XP/level -> reload/restart -> identical history and total. Airplane-mode
native flow is tested when an iPhone build exists. Web flow needs persistence
through reload, not just React state.

## Critical domain cases
1. Same task tapped twice, retried or imported twice grants one reward.
2. Same-day plan revision or workout->recovery swap grants no second reward.
3. Completed habit swapped for another habit cannot farm another reward.
4. Timezone change, date rollback, foreground resume and missed days cannot
   create simultaneous/reopened rewarded days. Test a DST transition as well.
5. Changing x1->x2 never changes prescription and does not rewrite today's XP.
6. Extra sets do not grant more XP; planned rest earns the same core reward.
7. Missed/illness days create no negative XP, punishment or exercise debt.
8. High rank never overrides pain/illness/poor-recovery protection.
9. Missing RIR, incomplete sets, noncomparable exercise or changed equipment
   prevents load increase. Include per-dumbbell vs combined-load cases.
10. Smallest equipment increment above 5% cap preserves current load.
11. Load zero, negative/NaN input, invalid ranges and max-level arithmetic safe.
12. LLM malformed/excessive/unsupported proposals cannot change prescription.
13. Accept/decline/restart preserves original and proposed plan audit history.
14. Export/import round trip preserves IDs/units; invalid/future export leaves
    current database untouched. Migration failure can recover.
15. Unknown HealthKit readings are unknown, never fabricated 0 steps.
16. Deletion tombstones prevent sync resurrection; backups are restored only
    through an explicit restore action. Two offline devices converge correctly.
17. Sessions older than the configured recency limit or a long training gap
    cannot trigger an increase from historical performance; rebaseline offered.
18. Weekly review retried on another day, imported twice or synced from two
    devices yields one canonical reward per persisted weekly cycle.
19. Systemic illness pauses structured training; localized joint pain pauses
    affected movements and never prompts a painful replacement.

## UX cases
- A new user can start without weight/photos/account/notification permissions.
- Today, rest day, workout in progress, empty history, errors and retry work.
- Workout can be interrupted and resumed; rest timer handles app backgrounding.
- Turkish long labels fit; screen reader and large text remain usable.
- Reduced Motion disables nonessential animation. Sound/haptics are optional.
- Local reminder denial is nonfatal; reminders don't duplicate on reschedule.
- TTS can stop immediately. Missing Turkish voice or silent-mode behavior is
  handled truthfully and tested on device, not assumed from web playback.

## Checks after each relevant slice
Run the app's implemented typecheck/lint/domain test commands and web export.
Select tests for real invariants; avoid snapshots that only mirror styling.
Use a browser flow for web. Use compatible RN component tooling for native UI.
Before beta, run actual iPhone checks for SQLite migrations, foreground resume,
notifications, TTS, file backup, low connectivity and permissions.
No claimed native pass based on web screenshot alone.

## Milestone completion
M0: persistent task->XP slice. M1: profile/schedule/workout logging.
M2: accepted training proposals + tested game progression.
M3: daily local core with charts, backup, speech/reminder capability boundaries.
M4: optional network features have ownership/deletion/conflict/privacy tests.
M5: actual signed-device result and remaining distribution steps documented.
