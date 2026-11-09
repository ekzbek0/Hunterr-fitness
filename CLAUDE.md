# AVCI project instructions

Build a Turkish, iPhone-first, offline-capable fitness RPG. Read
`docs/PROJE_PLANI.md`, `docs/PRODUCT.md`, `docs/TRAINING_RULES.md`,
`docs/DATA_MODEL.md`, `docs/ACCEPTANCE.md`, then `docs/PROGRESS.md`.

## Implementation
- Expo + React Native + TypeScript + Expo Router. Create the app in `apps/mobile`;
  preserve this repository's instructions. Verify the current stable Expo SDK
  and supported Node LTS from official docs; pin the resulting lockfile.
- Keep the first implementation a single Expo app. Put deterministic pure
  functions in `apps/mobile/src/domain`; no premature packages/monorepo tooling.
- Native SQLite behind repository interfaces; a persistent web adapter for the
  web preview. No unconditional native-only imports in web code.
- First slice works without accounts, API keys, LLM, photos or HealthKit.
  Mock data must be clearly labelled and kept separate from actual records.
- Use migrations, transactional writes, stable IDs and a unique XP ledger.
- User UI and status updates are Turkish; technical identifiers may be English.
- Use original art, titles and sound; preserve the motivating fantasy-system
  atmosphere without copying franchise characters, logos, music or screens.

## Product invariants
- XP/rank never determines physiological load. The XP multiplier affects XP only.
- Planned recovery has the same daily-core reward as a planned workout.
- No punishment workouts, exercise debt, body-attractiveness scores or XP for
  extra unplanned volume. No photo-based exact body-fat or muscle-mass claims.
- Previous profile facts are unconfirmed drafts until the user verifies them.
- Training changes need reason, preview, user acceptance and an audit record.
- AI can explain and propose structured changes; it cannot directly mutate a
  training prescription. Validate every proposal through deterministic rules.
- Safety tutorials are available from day one, never gated behind XP.
- User health data/photos stay out of development fixtures, logs and prompts.
  AI/cloud photo sharing is separately opt-in. No AI key in client bundles.

## Work method
- Main Claude session coordinates. Use project agents for bounded tasks.
  At most three concurrent workers; one writer per path. Reviewers return findings.
- Start with working vertical slices, not a dashboard mockup or a giant rewrite.
- Read `docs/TEAM.md` for ownership and task handoffs. Agent teams are optional
  and disabled by default; ordinary subagents suffice.
- After each meaningful slice run relevant typecheck, lint, domain tests and
  a web export; native-specific behavior needs real iPhone evidence later.
- Keep `docs/PROGRESS.md` and `docs/DECISIONS.md` current. Never mark an unrun
  native check as passed. Report actual commands and failures briefly.
- Do not stop after proposing a plan. Build the next authorized milestone.
  Preserve work when blocked and continue independent local features.
- Routine reversible coding and local installs are authorized. No production
  deployment, paid service purchase or store submission is authorized here.
- Preserve unrelated files; do not weaken permissions or use bypass flags.

## Official Expo tools
If the official Expo plugin is installed, load its overview and relevant
skills when needed. It also registers Expo MCP: do not add a duplicate server.
In cloud sessions, repo agents/skills work but local plugins do not carry over.
Missing MCP access must not block the offline implementation: consult official
docs and proceed. See `docs/SETUP.md` and `docs/SOURCES.md`.
