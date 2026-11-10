# Setup and delivery

## Local recommended route
Use Ubuntu/WSL2 already available on the user's Windows machine, or native
Windows Claude Code. Python 3.10+, Git and a Node LTS supported by the chosen
stable Expo SDK are needed. This starter does not silently install OS tools.
Official Claude setup: https://code.claude.com/docs/en/setup

After Claude Code is installed and authenticated:
`python3 AVCI_Claude_Baslat.py --setup --start`
Windows Python launcher: `py -3 AVCI_Claude_Baslat.py --setup --start`

`--setup` invokes the official project-scoped install:
`claude plugin install expo@claude-plugins-official --scope project`
This installs Expo skills plus Expo MCP. Do not add another Expo MCP. Optional
account authentication is through `/mcp`. The starter config does not enable
missing plugins by default; the official installer manages its own config.

The main session should verify current Expo docs and initialize `apps/mobile`
with the official stable template, preserving root docs. Do not hardcode an
outdated SDK or install a random dependency set. Resolve once and commit lockfile.
Use `npx expo install` for SDK-compatible native package versions, plus the
current Expo Doctor. Record versions and commands in PROGRESS.md.

## Cloud route
Commit generated project files, including `.claude/`, to a user-owned GitHub
repo and select it in Claude Code web. Project agents/skills carry over; local
plugins and user settings do not. Enabled plugin entries in a repo do not
install them in a cloud session. Self-contained project instructions and
official docs are sufficient for local-core implementation.
If a cloud Expo MCP is needed, follow the current official setup and configure
network/OAuth. Example ONLY, not an automatically activated duplicate:
`examples/expo-cloud.mcp.json`. Never put a token in this file.

## Web browser tests (Playwright)
`apps/mobile` pins `playwright` as an exact devDependency (lockfile-locked).
After `npm ci`, install the matching Chromium once with
`npm run e2e:install-browser` (`--with-deps` on bare Linux), then
`npm run export:web && npm run test:web`. Details: `apps/mobile/README.md`.
Cloud sessions may already provide browsers via `PLAYWRIGHT_BROWSERS_PATH`.

## iOS route
Web preview first. Then EAS development build using the user's Expo account
and Apple signing; no local Mac needed for the EAS cloud build. Linux has no
local Xcode simulator; optional experimental EAS remote simulator requires
verified access/cost and does not replace real-device tests.
App Store Expo Go currently stops at SDK54; do not rely on it for newer SDKs.
Apple Developer is USD99/year, local price at enrollment. TestFlight build
expiry is 90 days. Development/ad hoc provisioning also needs maintenance.
Long-term store distribution needs Apple's current review/privacy requirements.

### iPhone development build: remaining concrete steps (user's account required)
The repo is prepared (`apps/mobile/eas.json`, `expo-dev-client`, local-only
`expo-notifications` plugin). Nothing below has been run from this repo; no
account, project ID, bundle ID or signing identity is stored. Run in `apps/mobile`:
1. `npx eas-cli@latest login` (your Expo account; free tier is enough for builds
   in the queue). Optionally `npx expo install --check` and `npx expo-doctor`.
2. `npx eas-cli@latest init` — creates the EAS project and writes
   `extra.eas.projectId` (and `owner`) into `app.json`; commit that change.
3. Choose your own reverse-DNS bundle ID and add `"ios": { "bundleIdentifier": "..." }`
   to `app.json` (it must be unique and registered to your Apple team).
4. A physical iPhone install needs a paid Apple Developer Program membership
   (USD 99/year, your decision). Then `npx eas-cli@latest device:create`, open the
   link on the iPhone and install the provisioning profile; on iOS 16+ enable
   Settings › Privacy & Security › Developer Mode.
5. `npx eas-cli@latest build --profile development --platform ios` — EAS asks for
   your Apple ID and manages certificates/profiles. Install from the build page.
6. On the computer: `npx expo start --dev-client`, open the app on the iPhone.
   Without a paid membership, `--profile development-simulator` builds for the iOS
   Simulator only (needs a Mac to run).
7. Real-device checklist (none done yet): SQLite migration 4 on existing data,
   rest timer after background/kill and after changing the clock back, notification
   permission allow/deny, reminder delivery at the chosen time and update after a
   program change, Turkish voice present/absent, backup share sheet + Files import,
   delete-all removes pending reminders, airplane mode.
No `submit` profile exists; store submission is out of scope.

## Updates and background
EAS Update requires runtime compatibility. New native dependencies, SDK,
permissions/capabilities need a new binary. Configure dev/preview/production
channels only after project/account identity is known; do not invent IDs.
iOS background execution is scheduled by the OS, not a perpetual agent loop.
Use local reminders and deterministic task-day generation on foreground.
Never automatically publish/store-submit/purchase services as part of this kit.
