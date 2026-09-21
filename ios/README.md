# Lep Log — iOS (SwiftUI)

A native SwiftUI client for the Lep Log backend — no WebView, real UIKit/SwiftUI
components throughout. It talks to the existing Next.js app's `/api/*` routes
over plain HTTP(S); nothing in the web app (`app/`, `components/`, `lib/`,
`db/`) changes for this to work.

**Scope of this first pass:** the login/code flow and a fully working Journal
tab (including the "Date seen" / "Date added" sort). Identify, Friends, Map,
and the rest of Profile are stubbed with "coming soon" placeholders — the tab
bar shape is real, the screens aren't built yet.

**Important:** this project was authored without access to Xcode or a Swift
toolchain (built from a Linux container), so none of it has been compiled.
The API contracts (JSON field names, response shapes) were cross-checked
directly against the route handlers in `app/api/`, but Swift/SwiftUI syntax
errors are possible. Expect to fix a handful of small issues the first time
you open this in Xcode — nothing here has had a compiler look at it yet.

## Prerequisites

- A Mac with Xcode installed (from the App Store or [developer.apple.com](https://developer.apple.com))
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`

The actual `.xcodeproj` isn't committed — it's generated from `project.yml`
so the repo doesn't carry Xcode's generated project-file noise. Regenerate it
any time you add/remove/rename Swift files.

## Setup

```bash
cd ios
xcodegen generate
open LepLog.xcodeproj
```

In Xcode: pick a Simulator (or your device), set a signing team under the
`LepLog` target's *Signing & Capabilities* tab, and hit Run.

## Running against the backend

In one terminal, run the existing Next.js app as usual:

```bash
cd ..              # back to the repo root
npm run dev         # http://localhost:3000
```

The iOS Simulator shares its host Mac's network, so it reaches
`http://localhost:3000` with zero extra config — that's the default API
server (`APIConfig.defaultURLString`). To test on a **physical device**,
open the app's Profile tab and change "API server" to your Mac's LAN IP
(e.g. `http://192.168.1.23:3000`); both devices need to be on the same
Wi-Fi. In production, point it at your deployed URL (e.g. Vercel).

`Info.plist` carries a narrow App Transport Security exception scoped to
the literal `localhost` domain, so plain HTTP works in the Simulator without
weakening ATS for any other host. Tighten/remove it once the app only talks
to a deployed HTTPS backend.

## Project layout

```
LepLog/Sources/
  App/            entry point, root view, session/auth state (AppSession)
  Networking/     APIClient (URLSession + async/await), APIConfig (base URL)
  Models/         Codable structs mirroring lib/types.ts
  Support/        Keychain wrapper, bug-group classification, theme color
  Features/
    Auth/         code entry + password-gate screen
    Root/         tab bar + placeholder screens
    Journal/      the one fully-built tab (list, sort, delete)
    Profile/      code display, sign out, dev API-server setting
```

The MOTH-XXXXXX login code is stored in the Keychain (`KeychainStore`), not
`UserDefaults` — it's the sole credential for a user's log, same as the web
app's own framing of it ("that code is the key to your log").

## Next steps toward the App Store

1. **Build out the remaining tabs** — Identify (camera + the existing
   `/api/identify` flow) is the big one; Friends, Map, and the rest of
   Profile (avatar, password, iNaturalist sync) follow the same pattern as
   Journal: a `ViewModel` calling `APIClient` against the matching web route.
2. **Real app icon** — `Resources/Assets.xcassets/AppIcon.appiconset` ships
   with an empty 1024×1024 slot; drop in a real icon before archiving (the
   existing `public/icon-512.png` etc. aren't the right size for the App
   Store's single-icon slot).
3. **Deploy the backend for real** — Vercel + Postgres + Blob storage per
   the root `README.md`'s "Deploying to Vercel" section — needed before this
   app is useful to anyone but you on your own network.
4. **Apple Developer Program** ($99/yr) — needed to register the bundle ID
   (`com.jaredvick.leplog`, set in `project.yml`) for real signing, TestFlight,
   and App Store submission.
5. **Push notifications** — the web app uses standard Web Push (VAPID); a
   native app instead needs APNs via `UNUserNotificationCenter` and a
   server-side hookup to send to it, which isn't wired up yet.
