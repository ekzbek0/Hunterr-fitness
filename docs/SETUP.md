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

### iPhone builds: what is prepared and what needs your account
Prepared in the repo: `apps/mobile/eas.json` (three profiles), `expo-dev-client`,
local-only `expo-notifications` plugin. Nothing below has been run from this repo.
No Expo account, EAS project ID, bundle ID or signing identity is stored or invented.
No `submit` profile exists; store submission, TestFlight and paid services are out of scope.

| Profile | What you get | Needs a computer running `expo start`? |
| --- | --- | --- |
| `development` | Debug build with the dev client; loads JS from your dev server | Yes |
| `preview` | Release build, JS bundle embedded, internal (ad hoc) distribution | No |
| `development-simulator` | Dev client for the iOS Simulator (needs a Mac) | Yes |

#### One-time account and signing steps (both iPhone routes)
Run in `apps/mobile`:
1. `npx eas-cli@latest login` with your own Expo account.
2. `npx eas-cli@latest init` creates the EAS project and writes `extra.eas.projectId`
   (and `owner`) into `app.json`. Commit that change.
3. Choose your own reverse-DNS bundle ID and add `"ios": { "bundleIdentifier": "..." }`
   to `app.json`. It must be unique and registered to your Apple team.
4. Installing on a physical iPhone needs a paid Apple Developer Program membership
   (USD 99/year; your decision). Internal distribution uses ad hoc provisioning, so each
   iPhone must be registered: `npx eas-cli@latest device:create`, open the link on the
   iPhone and install the profile. A device added later needs a new build.
5. On the first build EAS asks for your Apple ID and creates the distribution
   certificate and provisioning profile. Let EAS manage them, or supply your own.

#### A. Daily-use build (no dev server): `preview`
For using the app day to day and for beta testing on your own registered devices.
1. `npx eas-cli@latest build --profile preview --platform ios`
2. Open the build page link on the iPhone and install. The app starts on its own;
   no computer, Metro or dev server is involved, and it works offline.
3. `expo-updates` is not installed, so there are no over-the-air updates: every code
   change needs a new `preview` build installed over the old one. Installing a new build
   over the old one keeps the app's local data; deleting the app deletes it (export a
   backup first).
4. Ad hoc provisioning profiles expire after one year; rebuild before then.

#### B. Development client (for development only): `development`
1. `npx eas-cli@latest build --profile development --platform ios`, install from the
   build page. On iOS 16+ enable Settings › Privacy & Security › Developer Mode.
2. On the computer: `npx expo start --dev-client`; open the app on the iPhone on the
   same network and pick the server. Without the server this build shows only the
   launcher: it is not a daily-use build.
3. New native dependencies, permissions or `app.json` plugin changes need a new build;
   plain JS/TS changes do not.
Use a different bundle ID per profile only if you want both installed side by side;
with one bundle ID the later install replaces the earlier one (data is kept).

#### Checks that could not be run in the cloud session
`npx expo-doctor` (2 of 20 checks need `exp.host`) and `npx expo install --check` need
network access to Expo. Run both on your machine before the first build.

#### Real-device checklist (none done yet)
SQLite migration 4 on existing data; rest timer after background/kill and after setting
the clock back; notification permission allow and deny; reminder delivery at the chosen
time and its update after a program change; Turkish voice present/absent; backup through
the share sheet to Files and import from Files (including a rejected file); delete-all
removes pending reminders; airplane mode; `preview` build cold start without a dev server.

## Updates and background
EAS Update requires runtime compatibility. New native dependencies, SDK,
permissions/capabilities need a new binary. Configure dev/preview/production
channels only after project/account identity is known; do not invent IDs.
iOS background execution is scheduled by the OS, not a perpetual agent loop.
Use local reminders and deterministic task-day generation on foreground.
Never automatically publish/store-submit/purchase services as part of this kit.
