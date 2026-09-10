# World ID Blueprint — Replication Manual

> **Status:** Verified working (Expo Web + IDKit v4), now wired to **Sandbox + Selfie Check**.
> **Success criteria:** IDKit modal shows QR → **Sandbox** World App completes **Selfie Check** →
> UI shows `All set!` and a green `Success:` payload with `action`, `nonce`, `responses[].proof`,
> `nullifier`, `merkle_root`, `environment: "sandbox"`.
>
> Requires the **Sandbox** World App build (TestFlight / Google Play private testing track) —
> the public World App will reject a Sandbox `app_id`/`rp_id`. See §4a below.

This folder is the **minimal, known-good** Expo Web integration for World ID.  
No Mandate, Arc, Graph, biometrics, or other product code — only World ID.

If you deviate from the pinned versions or skip the WASM patch, you will hit `Failed to construct 'URL': Invalid base URL`.

---

## 1. What you are replicating

```
Browser                Expo API routes              World
───────                ───────────────              ─────
TEST WORLD ID  ──►  GET /api/sign
                   (signRequest + dynamic action)
                 ◄── rp_context { rp_id, action, nonce,
                                  created_at, expires_at, signature }

IDKitRequestWidget ──► World App (scan QR / selfie)
                 ◄── proof payload

handleVerify   ──►  POST /api/verify
                   (developer.world.org/api/v4/verify/{app_id})
                 ◄── { success: true }

onSuccess      ──►  Status: Success: { action, responses, ... }
```

Verified production-shaped success fields (example shape):

```json
{
  "action": "face-auth-checkout-<timestamp>",
  "environment": "production",
  "protocol_version": "3.0",
  "nonce": "0x...",
  "responses": [
    {
      "identifier": "secure_document",
      "merkle_root": "0x...",
      "nullifier": "0x...",
      "proof": "0x..."
    }
  ],
  "signal_hash": "0x..."
}
```

---

## 2. Exact package pins (do not change)

Copy these **exact** versions into `package.json`.  
**No `^`, no `~`, no `npx expo install` auto-upgrades.**

```json
{
  "name": "world-id-blueprint",
  "version": "1.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start -c --web",
    "web": "expo start -c --web",
    "install:locked": "npm install --legacy-peer-deps",
    "postinstall": "node scripts/patch-idkit-wasm.js",
    "patch:wasm": "node scripts/patch-idkit-wasm.js"
  },
  "dependencies": {
    "@worldcoin/idkit": "4.2.2",
    "@worldcoin/idkit-core": "4.2.3",
    "expo": "55.0.24",
    "expo-constants": "55.0.16",
    "expo-linking": "55.0.14",
    "expo-router": "55.0.13",
    "expo-status-bar": "55.0.5",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-native": "0.83.6",
    "react-native-safe-area-context": "5.6.2",
    "react-native-screens": "4.23.0",
    "react-native-web": "0.21.0"
  },
  "devDependencies": {
    "@expo/metro-runtime": "57.0.13",
    "babel-preset-expo": "57.0.8"
  }
}
```

| Why these pins matter | |
| --- | --- |
| `idkit` `4.2.2` + `idkit-core` `4.2.3` | Working IDKitRequestWidget + `signRequest` signing API |
| `expo` `55.0.24` + router `55.0.13` | Expo Server routes (`+api.js`) for `/api/sign` + `/api/verify` |
| `@expo/metro-runtime` `57.0.13` | Required for this WASM/hoisting tree (do not “fix” to Expo’s suggested older metro-runtime) |
| `babel-preset-expo` `57.0.8` | Matches the metro-runtime pin |

---

## 3. Folder layout (minimal)

```
World/
├── package.json
├── app.json
├── babel.config.js
├── metro.config.js          # MUST add wasm to assetExts
├── .env                     # secrets (gitignored)
├── .env.example
├── .gitignore
├── public/
│   └── idkit_wasm_bg.wasm   # MUST be served at /idkit_wasm_bg.wasm
├── scripts/
│   └── patch-idkit-wasm.js  # MUST run on postinstall
└── app/
    ├── _layout.js
    ├── index.js             # Redirect → /world-test
    ├── world-test.js        # Widget UI
    └── api/
        ├── sign+api.js      # GET signed rp_context
        └── verify+api.js    # POST World Developer API v4
```

---

## 4. Credentials (`.env`)

Copy World ID keys from the Mandate main app (`../app/.env`), World-only:

```env
WORLD_APP_ID=app_...
WORLD_RP_ID=rp_...
WORLD_SECRET_KEY=0x...
WORLD_SIGNER_ADDRESS=0x...

EXPO_PUBLIC_WORLD_APP_ID=app_...   # same as WORLD_APP_ID (public)
EXPO_PUBLIC_WORLD_RP_ID=rp_...     # same as WORLD_RP_ID
```

Rules:

- `WORLD_SECRET_KEY` is the RP signing private key from the World Developer Portal.
- `WORLD_RP_ID` used by `/api/sign` **must** match the RP that owns that secret.
- `WORLD_APP_ID` / `EXPO_PUBLIC_WORLD_APP_ID` must match the App ID registered in the portal.
- Never commit `.env`.

### 4a. Sandbox setup (required for Selfie Check testing)

```env
EXPO_PUBLIC_WORLD_ENVIRONMENT=sandbox   # "production" | "staging" | "sandbox"
```

1. Request Sandbox access in the World Developer Portal (Apple Account email for TestFlight,
   or Google Play email for the private testing track) — sandbox apps aren't publicly listed.
2. Install the **Sandbox** World App build on your phone. The regular public World App will
   reject verification requests carrying `environment: "sandbox"`.
3. Proofs still POST to the same endpoint (`developer.world.org/api/v4/verify/{app_id}`) —
   Sandbox doesn't change the verify call, only the widget's `environment` prop and the app
   build used to scan/approve.

---

## 5. Mandatory Expo / Metro config

### `app.json`

```json
{
  "expo": {
    "name": "world-id-blueprint",
    "slug": "world-id-blueprint",
    "version": "1.0.0",
    "scheme": "world-id-blueprint",
    "platforms": ["web"],
    "web": {
      "bundler": "metro",
      "output": "server"
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

`web.output: "server"` is required for Expo API routes.

### `metro.config.js`

```js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required: Metro does not serve .wasm by default; IDKit needs it.
config.resolver.assetExts.push('wasm');

module.exports = config;
```

### `babel.config.js`

```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

---

## 6. Mandatory WASM fix (the thing that breaks without docs)

### Root cause

`@worldcoin/idkit-core` loads WASM with:

```js
new URL("idkit_wasm_bg.wasm", import.meta.url)
```

Expo Metro corrupts `import.meta.url` →:

```text
[IDKit] Flow error: Failed to initialize IDKit WASM:
TypeError: Failed to construct 'URL': Invalid base URL
```

### Fix (two parts)

**A. Static file**

1. Copy `node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm`  
   → `public/idkit_wasm_bg.wasm`
2. Confirm after server start: `GET /idkit_wasm_bg.wasm` returns **200** and `Content-Type: application/wasm`.

**B. Patch `idkit-core` (postinstall)**

`scripts/patch-idkit-wasm.js` rewrites:

```js
// BEFORE (broken under Metro)
new URL("idkit_wasm_bg.wasm", import.meta.url)

// AFTER (working)
new URL("/idkit_wasm_bg.wasm", window.location.origin)
```

This repo runs that automatically via `"postinstall"`. After any clean install you should see:

```text
[patch-idkit-wasm] patched idkit-core WASM loader → /idkit_wasm_bg.wasm
```

Manual re-run:

```powershell
npm run patch:wasm
```

---

## 7. Backend routes (must match widget)

### `GET /api/sign` — dynamic action + `signRequest`

Critical:

- Action must be unique per attempt: ``face-auth-checkout-${Date.now()}``
- Return the **same** `action` that was signed inside `rp_context`
- Include `rp_id`, `nonce`, `created_at`, `expires_at`, `signature`

See `app/api/sign+api.js`.

### `POST /api/verify` — World Developer API v4

```text
POST https://developer.world.org/api/v4/verify/{WORLD_APP_ID}
```

Body must include the IDKit proof **and** the same dynamic `action` used at sign time.  
See `app/api/verify+api.js`.

---

## 8. Frontend widget rules (`app/world-test.js`)

| Rule | Detail |
| --- | --- |
| Fetch sign first | Do not open the widget until `rp_context` exists |
| Sync action | `action={dynamicAction}` must equal `data.action` from `/api/sign` |
| Preset | Use `preset={selfieCheckLegacy()}` for Selfie Check. `deviceLegacy()` still works if you need the device-only flow. **Not** `identityCheck()` (crashes in 4.2.2) |
| Environment | `environment={ENVIRONMENT}` (from `EXPO_PUBLIC_WORLD_ENVIRONMENT`, defaults to `"sandbox"`) |
| Legacy proofs | `allow_legacy_proofs={true}` |
| Errors | Use `console.log` in `onError` — Expo Web turns `console.error` into a red screen |
| Verify | `handleVerify` must POST to `/api/verify` with `{ proof, action: dynamicAction }` |

---

## 9. Install & run (Windows PowerShell)

From this folder (`World/`):

```powershell
# Clean install (required if anything looks corrupted)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue

npm install --legacy-peer-deps
# expect: [patch-idkit-wasm] patched ...

npx expo start -c --web --port 8082
```

Open:

- `http://localhost:8082` (redirects to `/world-test`)
- Hard refresh after restarts: `Ctrl+Shift+R`

Smoke checks:

```powershell
Invoke-WebRequest http://localhost:8082/idkit_wasm_bg.wasm | Select-Object StatusCode
Invoke-WebRequest http://localhost:8082/api/sign | Select-Object StatusCode
```

Both must be **200**. Then click **TEST WORLD ID**, scan QR in World App, complete verification.

---

## 10. Expected UX (pass / fail)

| Step | Pass | Fail |
| --- | --- | --- |
| Click TEST WORLD ID | Status → fetching → Opening IDKit widget | `WORLD_SECRET_KEY missing` / sign 500 |
| Widget | World modal + QR (“Connect your World ID”) | `Invalid base URL` / “Something went wrong” |
| Phone verify | Modal → green check **All set!** | Stuck QR / already verified (static action) |
| Page status | Green `Success: {...proof...}` | verify 400 / action mismatch |

---

## 11. Troubleshooting matrix

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Failed to construct 'URL': Invalid base URL` | Missing WASM public file and/or unpatched `idkit-core` | Ensure `public/idkit_wasm_bg.wasm`, run `npm run patch:wasm`, restart with `-c`, hard refresh |
| Widget “Something went wrong” | Often the WASM error disguised by IDKit UI | Enable `setDebug(true)`, read Chrome console (`F12`) |
| `Cannot read properties of undefined (reading 'attributes')` | `identityCheck()` preset bug in 4.2.2 | Use `deviceLegacy()` |
| QR never useful / silent reject | Static action or action ≠ signed action | Timestamp action in `/api/sign`; pass `data.action` into widget + verify |
| Expo red screen on widget error | `console.error` in `onError` | Switch to `console.log` / `console.warn` |
| `/api/sign` 500 | Missing env | Confirm `.env` loaded (`env: export WORLD_...` in Expo logs) |
| Works in HTML standalone, fails in React | Metro WASM path | This blueprint’s patch + `public/` file — do not rely on unpkg standalone inside Expo |

---

## 12. Porting into another Expo app

1. Lock the same package versions (table in §2).
2. Copy `metro.config.js` wasm line.
3. Copy `public/idkit_wasm_bg.wasm` + `scripts/patch-idkit-wasm.js` + `postinstall`.
4. Copy `sign+api.js` / `verify+api.js` patterns.
5. Copy widget props pattern from `world-test.js`.
6. Copy only the `WORLD_*` env keys.
7. `npm install --legacy-peer-deps` → `npx expo start -c --web`.

Do **not** mix this with a different Expo major or a floating `@worldcoin/idkit` range until you re-verify WASM + QR end-to-end.

---

## 13. Source of truth

| Item | Location |
| --- | --- |
| Working blueprint code | this `World/` folder |
| Working product integration | `../app` (`/world-test`, `/api/sign`, `/api/verify`) |
| Credentials | `../app/.env` → mirrored into `World/.env` |
| This manual | `World/README.md` |
