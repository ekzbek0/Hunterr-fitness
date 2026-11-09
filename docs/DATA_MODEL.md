# Data and persistence contract

## Domain separation
`src/domain/training` computes proposals; `src/domain/game` computes rewards;
`src/data` persists; UI uses application services. Domain functions are pure,
clock/random/network are injected. Training functions never import XP/rank.

## Tables (implement migrations, not these descriptions as SQL)
| Entity | Essential fields/invariants |
|---|---|
| profile | id UUID, timezone IANA, preferences, confirmedAt, schemaVersion |
| exercise | id, movement, equipment, loadConvention, howTo, contentVersion |
| plan_version | id, parentId, source, acceptedAt, reason, immutable prescription |
| schedule_slot | stable id, date, sessionTemplateId, state |
| workout_session | UUID, slotId, planVersionId, start/end, syncVersion |
| set_log | UUID, sessionId, exerciseSeriesId, kind warmup/work, reps/load/unit/RIR |
| daily_checkin | taskDayId, optional sleep/energy/fatigue/soreness, safety flags |
| task_day | UUID, sequence, capturedTimezone, localDate, start/end, multiplier |
| quest_slot | taskDayId+stable slotKey UNIQUE, status, kind, version |
| xp_ledger | profileId+scopeKind+scopeId+slotKey UNIQUE, baseXP, multiplier, awardedXP, completedAt |
| weekly_review | stable weeklyCycleId UNIQUE, proposal IDs, accepted/declined |
| measurement | UUID, type, value, unit, measuredAt, tombstone |
| media | UUID, owner, private local/cloud path, consent, tombstone |
| outbox | UUID operation id, entity id, baseVersion, action, retry metadata |
| app_meta | schemaVersion, contentVersion, migrations, lastTaskDay |

## Exactly-once reward
Daily completion + ledger insert are one transaction. Daily reward scope is
`day` with scopeId=taskDayId. Weekly scope is `week` with scopeId=weeklyCycleId
and slotKey=weekly-review. Weekly review completion + its 40-base-XP ledger
insert are one transaction; completing/retrying/importing on another day in
the same cycle cannot reward again. Capture the multiplier when the weekly
cycle first opens; changes never rewrite that cycle's reward. Persist weekly
cycle identity/boundaries/timezone and never reopen a closed cycle after clock
or timezone changes. No row can refer ambiguously to both reward scopes.
A stable daily-core slot
survives workout replacement, rescheduling or recovery mode. Other habit
slot identities also persist through same-day plan edits. A UNIQUE conflict
returns existing reward; never use rendered component IDs as reward identity.
Changing a completed habit preference takes effect next day; no swap farming.
Repeating an import/sync never reapplies XP. Totals derive from the ledger;
any displayed cache must be transactionally consistent and reconstructable.
Completed reward is not revoked when editing a workout. Reopening the same
task does not issue another reward. Explain this in the personal-use UI.

## Day and timezone
Use a taskDay UUID/monotonic sequence with its captured timezone/boundaries.
At foreground/open, resume its unclosed snapshot or close once and create
the next day. A timezone change applies to future snapshots; it must not
reopen a closed day, create simultaneous days or extend a day by rolling back
the device clock. Clock anomalies freeze new rewards until reconciled, with
history retained. Offline history is permitted; do not promise tamper-proof
competition. Specify and test chosen travel policy in docs/DECISIONS.md.
The day's multiplier is captured once; settings changes apply next task day.
Background execution at midnight is not required for correct day generation.

## Offline and web
Native SQLite is behind a repository interface. The web preview uses an
IndexedDB adapter or verified web SQLite configuration; do not silently use
nonpersistent memory or unconditional native imports. Store interrupted set
entry state safely. Apply migrations transactionally and preserve backup.
Tokens in SecureStore; SQLite isn't automatically app-layer encrypted.

## Export/import/delete
Versioned export with clear scope, ISO timestamps, units, checksums and no
authentication tokens. Validate full import into staging before commit;
duplicates idempotent; future unsupported versions fail without modifying DB.
Validate IDs, ranges and relationships. Malformed/oversized import cannot
wipe good data. Native sharing/file handling tested separately from web.
Delete all local records/media/notifications, clear caches and pending jobs;
if sync enabled, write deletion tombstones/server deletion and reconcile
before declaring remote deletion complete. Deleted data must not resurrect
through old backup or sync without an explicit user restore choice.

## Later cloud
Supabase ownership RLS on every user table; service-role keys never in client.
Private media bucket and signed URLs. Prefer server reconciliation for UNIQUE
taskDay/slot reward keys. Two offline devices must converge on one task day
and one reward per logical slot; offline optimistic rewards may be corrected
after sync with a transparent explanation. Do not promise globally exactly-once
awards from local UUIDs alone. Reject/merge conflicting schedule revisions;
separate raw event IDs from the canonical logical reward identity.
Workout edits use explicit version conflict handling; no silent last-writer
wins for prescriptions. Confirm the conflict policy before implementing M4.
No health payloads in analytics, logs, exception reports or development repos.
