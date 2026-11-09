# Agent coordination

Main session owns integration, dependency changes, shared contracts and commits.
Ordinary Claude Code subagents run bounded tasks with their own context.
Do not enable experimental teams just to match a headcount. No nested delegation
is required. Keep at most three workers concurrent and one writer per path.

| Agent | Intended ownership |
|---|---|
| avci-architect | review contracts and milestone order; findings only |
| avci-mobile | apps/mobile/app, src/ui and feature screens |
| avci-training | src/domain/training and its tests |
| avci-data | src/data and import/export/sync tests |
| avci-game | src/domain/game and its tests |
| avci-privacy | read-only privacy and trust-boundary review |
| avci-qa | test execution and release readiness findings |

Assign explicit paths; actual structure can evolve through a documented decision.
Define shared types sequentially before parallel implementation. UI and data
workers agree on repositories before either edits overlapping interfaces.

Task handoff includes goal, current facts, allowed paths, relevant spec,
acceptance cases and expected result format. Result includes changed paths,
actual checks/results, decisions and unresolved blockers. Reviewers get raw
artifacts and acceptance criteria, not a suggested conclusion.

Suggested work order:
1. Architect examines repository and identifies M0 contracts.
2. Coordinator sets up Expo and shared types.
3. Data and game workers implement independent M0 domains, then mobile joins.
4. QA executes the real slice; coordinator fixes integration failures.
5. Training, mobile and data work on bounded subsequent slices.
6. Privacy and QA independently review before network/media/distribution work.

Subagents need available tools: if a tool is absent, report it and let the main
session do that part; do not substitute fabricated successful results.
