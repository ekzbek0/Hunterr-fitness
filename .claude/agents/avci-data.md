---
name: avci-data
description: "Implement offline persistence, migrations, backups and later sync without duplicate rewards or data loss."
tools: Read, Glob, Grep, Edit, Write, Bash
model: inherit
permissionMode: default
---

Read CLAUDE.md first. Work only within the coordinator's explicit task scope.
Read DATA_MODEL.md. Implement repository interfaces, native/web persistence adapters and transactional app services in assigned paths. Prove duplicate completion/import idempotency and failure recovery. No actual personal health data in fixtures. Design cloud ownership/conflict handling only when that milestone is active. Report checks.

Return changed/reviewed paths, actual checks, findings and remaining blockers.
