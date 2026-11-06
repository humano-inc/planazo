# Shipping updates

Screens, logic, copy and images can reach phones without a store build or an
Apple review. Merging does nothing on its own: a person presses **Ship**.

## Set up once

Add two repository secrets in GitHub → Settings → Secrets and variables → Actions:

| Secret | Where it comes from |
| --- | --- |
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens, with the `project:releases` and `org:read` scopes |

The Sentry token already on EAS has secret visibility, so it can be used by EAS
builds but never read back. GitHub needs its own.

## Ship

GitHub → Actions → **Ship** → Run workflow, on `main`, channel `production`. Or:

```bash
gh workflow run ship.yml --ref main -f channel=production
```

Phones do not change at once. An app checks on launch, downloads in the
background, and runs the update the next time it cold starts. Only phones on a
store build carrying `expo-updates` (1.1.0 onwards) receive anything.

Migrations go live on merge, before any Ship, so they must keep working with
every version of the app still in use.

## When Ship stops

| The run says | It means | Do this |
| --- | --- | --- |
| CI is still running | That commit's tests or migration deploy have not finished | Press Ship again when they do |
| CI finished as `failure` | main is red, and its migrations may not be deployed | Fix main, then press Ship |
| CI has no run for it on main | It was started from another branch | Run it on `main` |
| No finished build can run this code | A native change landed, so no installed app can run this JavaScript | Make a store build (`APP-STORE.md`) |
| Warning: will not reach a platform | One platform has a matching build, the other does not | Ship went out to the one. Make a store build for the other |
| Upload source maps failed | The update is live, but its crashes are unreadable | Re-run the workflow, which publishes again and retries the upload |

## What needs a store build

Anything native: a new native module, an SDK upgrade, or a native field in
`app.json` such as a permission string, icon or plugin. JavaScript-only
dependencies, `package.json` scripts and `expo.version` do not.

`apps/mobile/fingerprint.config.js` decides what counts. To see what changed
between this checkout and a build:

```bash
cd apps/mobile
eas fingerprint:compare --build-id <build id>
```

## Roll back

Find the last good update, then publish it again:

```bash
cd apps/mobile
eas update:list --branch production --non-interactive
eas update:republish --group <update group id> --non-interactive
```

To go back to the JavaScript inside the store build instead, which also drops
every update shipped since that build:

```bash
eas update:roll-back-to-embedded --channel production --non-interactive
```

Either way, a phone picks it up the same way as any update: on launch, running
it on the next cold start. An update that crashes before its first screen on its
first launch rolls back on its own. One that crashes later keeps crashing until
one of these commands, or a fix, goes out.
