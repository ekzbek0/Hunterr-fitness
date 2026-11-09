---
name: offline-sync
description: "Work on AVCI persistence, transactional XP, migrations, backups or account synchronization."
---

Read docs/DATA_MODEL.md. For $ARGUMENTS, use avci-data and test real retry/import/conflict failure modes. Local-only core precedes cloud sync. Schema validation and safe recovery must precede destructive import or migration. Do not leak health data.
