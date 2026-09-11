# Security Model

## What changed and why

An audit found a real, exploitable issue: `/api/treasury/grant` and
`/api/payment/agent-pay` accepted any amount to any address, protected only
by an Origin check (`app/src/utilsAPI/corsHelper.js` +
`app/src/app/+middleware.js`). **Origin checking is not authentication** — it
stops another website from making the request on a victim's behalf (CSRF),
but it does nothing against a direct `curl` call with a forged `Origin`
header, since only real browsers enforce that header honestly. Proven
empirically: a `curl` with a spoofed `Origin: https://mandate.expo.app` moved
real funds from the treasury with zero other credentials.

Fixed in both routes:
- **`agent-pay`**: the recipient must be an address already listed in
  `VENDOR_CATALOG` or `SPONSOR_MAP` (`app/src/constants/vendors.js`), and the
  amount can never exceed that vendor's own listed cost. An arbitrary address
  or an inflated amount is rejected with `403`, not just logged.
- **`treasury/grant`**: capped at `MAX_GRANT_USDC` (currently 5) per call,
  regardless of what a client requests.

Neither fix requires an API key on the client, on purpose — see below.

## Why no API key was added to these two routes

Both routes are meant to be called directly from the browser as part of the
live demo (Mission Control's grant flow, the judge-facing "Add User to
Mandate" screen, and the NL admin chat's `HIRE_VENDOR` action). A key that
authorizes real payments cannot be shipped to a page anyone can load — that
would just move the vulnerability from "no auth" to "the auth secret is
public," which is worse, not better. The correct boundary here is **bounding
the blast radius of every call** (known recipients only, capped amounts),
not gatekeeping who can call it at all. That matches the product's own
premise — bounded authority, not zero risk.

`ADMIN_API_KEY` still exists and is checked in `+middleware.js`, but it's for
genuinely server-to-server / operator-script use (see
`app/scripts/*.js`) — it is never referenced by any client-bundled code
(verified: grepped the real production `npx expo export -p web` output for
every server secret's actual value; none appear).

## What's verified never reaches the browser

`EXPO_PUBLIC_*` is the only prefix Expo will inline into a web bundle, and
even then only where code actually references
`process.env.EXPO_PUBLIC_X` — an unreferenced `EXPO_PUBLIC_*` var never
appears in the built output either. Verified directly against a real
production build (`npx expo export -p web`, then grepped `dist/` for the
literal value of every secret below) rather than assumed:

`GRAPH_API_KEY`, `ADMIN_API_KEY`, `WORLD_SECRET_KEY`,
`MANDATE_TREASURY_PRIVATE_KEY`, `MANDATE_AGENT_PRIVATE_KEY`,
`MANDATE_PAYMASTER_PRIVATE_KEY`, `MANDATE_BUYER_PRIVATE_KEY`,
`MANDATE_MERCHANT_PRIVATE_KEY`, `SUPABASE_SECRET_KEY`,
`RED_TEAM_BYPASS_KEY`, `X402_GATEWAY_KEY`, `SUPERADMIN_TOKEN`,
`CLOUDFLARE_API_TOKEN`.

Also removed two `EXPO_PUBLIC_*` vars that duplicated real secrets
(`EXPO_PUBLIC_GRAPH_API_KEY`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` +
`EXPO_PUBLIC_SUPABASE_URL`) — none were referenced by any code, so nothing
broke, but a secret sitting under a public-prefixed name is a live
loaded gun for the next person who adds a client-side usage without
realizing what that prefix does. Gone from both `.env.example` and the real
`.env`.

## Second pass: purging unused vars entirely

A follow-up request was stricter: don't just confirm nothing leaks, remove
anything not actually used, and demote anything not genuinely needed by the
browser. Every var was checked by tracing its actual consumer (not just a
literal grep for the name — `constants/config.js`'s `getEnv()` builds the
`EXPO_PUBLIC_` fallback name dynamically, so some real client dependencies
don't show up as a literal string match; each candidate was traced to its
`CONFIG.*` field and then to whether that field is read from a
client-rendered file).

**Removed entirely** (zero consumers anywhere, client or server) — from both
`.env` and `.env.example`:
`ARC_CHAIN_ID` / `EXPO_PUBLIC_ARC_CHAIN_ID` (the chain ID is hardcoded
`5042002` everywhere it's actually needed, this config field was never
read), `ARC_EXPLORER_URL` (the explorer URL is hardcoded in `config.js`
instead), `CLOUDFLARE_ACCESS_KEY` / `CLOUDFLARE_SECRET_ACCESS_KEY` /
`CLOUDFLARE_S3_API_ENDPOINT` (R2 credentials with no code path using them),
`EXPO_PUBLIC_TOKEN_CIRBTC` / `_EURC` / `_USDC` (no `TOKENS` config block
exists to consume them), `SUPABASE_URL` / `SUPABASE_ANON_KEY` /
`SUPABASE_SECRET_KEY` (see correction below — there is no real Supabase
usage left at all), `SUPERADMIN_TOKEN`, `WORLD_SIGNER_ADDRESS`, and all 8
`VENDOR_KEY_*` vars (`AI_INFERENCE`, `ARC_BUNDLER`, `CLOUDBURST`,
`GRAPH_ORACLE`, `MEGACOMPUTE`, `QUICKSCALE`, `RESILIENTDB`, `WEB_SEARCH`).

**Correction to this doc's earlier claim:** an earlier version of this file
said the Supabase health-check ping in `infraFailoverService.js` still
needed `SUPABASE_URL`. That was wrong — grepped the whole real codebase for
any actual `fetch()` to a Supabase URL and found none. The only two places
that ever read `SUPABASE_URL`/`SUPABASE_ANON_KEY` were `health+api.js`'s
`*_LOADED` boolean flags, which reported nothing meaningful once nothing
downstream used the values. Removed those two flags along with the vars.

**Kept, confirmed genuinely needed client-side** despite showing zero literal
matches for the `EXPO_PUBLIC_` name itself (traced through `getEnv()`'s
dynamic fallback to real usage in client components/hooks):
`EXPO_PUBLIC_WORLD_APP_ID` / `_RP_ID` / `_ENVIRONMENT` (the IDKit widget in
`EnrollmentScreen.js`/`world-test.js`/`add-user.js` needs these as literal
render props — not secrets, they're public protocol identifiers World's own
docs require to be client-visible), `EXPO_PUBLIC_MANDATE_BUYER_ADDRESS`
(used by `mandateModule.js`/`biometricService.js`, part of the judge
onboarding flow, not the deleted POS payment flow it looks adjacent to),
`EXPO_PUBLIC_MANDATE_MERCHANT_ADDRESS` (used by `graphService.js`/
`agentService.js`, both client-side), `EXPO_PUBLIC_MANDATE_PAYMASTER_ADDRESS`
(used by `arcService.js`, client-side).

## Third pass: a real private-key-exfiltration endpoint

`GET /api/db/users` (only CORS-gated — same non-authentication caveat as
everywhere else) returned every enrolled user's **full** D1 record,
including `agentKey` (a real ERC-4337 owner private key generated at
enrollment) and `faceVector`. Confirmed by tracing every consumer: nothing
live needs either field from this HTTP route. `recognize+api.js` does real
server-side face matching, but calls `getAllEnrolledUsersFromDb()` directly
(not this HTTP route) — it still gets the real vector. The only client-side
code that ever read `faceVector` back (`biometricService.js`'s
`identifyUserByFaceVector`, a 1-tap face-login flow) and the only code that
ever read `agentKey` back (the deleted POS `payment/execute` route) both
have zero remaining callers. Fixed by stripping both fields from the
response unconditionally — `db/users+api.js`'s `toPublicProfile()`.

No real user had enrolled yet when this was found (verified: the live
endpoint returned an empty list), so nothing needs rotating from this one.
Deployed the fix to production immediately rather than batching it with
other work, since every minute this endpoint stayed live increased the
odds of a real judge's private key being captured.

**Lower-severity, not fixed here:** enrolled-user IDs are
`'usr_' + Date.now().toString(36)` (`biometricService.js`) — a predictable
timestamp, not a random one. `upsertEnrolledUser`'s `ON CONFLICT(id) DO
UPDATE` means a guessed/nearby ID could overwrite another user's D1 record.
Checked the actual blast radius: it's data-integrity only, not fund theft —
the Mandate budget grant flow (`ArcService.grantFromTreasury`) always pays
into the shared `MANDATE_AGENT_ADDRESS`, never anything read from this
table, so corrupting a record can't redirect real money. Worth a real ID
scheme and a write-ownership check eventually, not urgent enough to block
on right now.

## Env var reference (post-purge)

See `.env.example` for the full authoritative list with placeholder values.
Categories:

- **Server-only secrets** (never referenced by client code, verified against
  a real production bundle): all `*_PRIVATE_KEY`, `ADMIN_API_KEY`,
  `WORLD_SECRET_KEY`, `GRAPH_API_KEY`, `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`, `X402_GATEWAY_KEY`, `RED_TEAM_BYPASS_KEY`,
  `MINIMAX_API_KEY`.
- **Server-only, not secret** (URLs/IDs with no auth power of their own):
  `ARC_RPC_URL`, `ARC_ENTRY_POINT`, `GRAPH_SUBGRAPH_ID`, `WORLD_RP_ID`,
  `WORLD_APP_ID` (server copy), `CLOUDFLARE_WORKER_SUBDOMAIN`,
  `*_ADDRESS` variants, `VENDOR_ADDR_*`.
- **Legitimately public** (`EXPO_PUBLIC_*`, safe by design, each one traced
  to a real client-side consumer above): `EXPO_PUBLIC_ARC_RPC_URL`,
  `EXPO_PUBLIC_MANDATE_AGENT_ADDRESS`, `EXPO_PUBLIC_MANDATE_TREASURY_ADDRESS`,
  `EXPO_PUBLIC_MANDATE_BUYER_ADDRESS`, `EXPO_PUBLIC_MANDATE_MERCHANT_ADDRESS`,
  `EXPO_PUBLIC_MANDATE_PAYMASTER_ADDRESS`, `EXPO_PUBLIC_WORLD_APP_ID`,
  `EXPO_PUBLIC_WORLD_RP_ID`, `EXPO_PUBLIC_WORLD_ENVIRONMENT`.

Nothing is listed as "present but unused" anymore — that category was
purged entirely in this pass.

## Disclosures from this audit

Two, both the same category of mistake and both worth being upfront about
rather than quietly not mentioning: while auditing `.env` in this session,
plain `grep`/`cat`-style commands printed real values directly into this
session's own terminal output/transcript twice — once catching
`SUPABASE_SECRET_KEY` (now moot, that var and the table it guarded are both
gone), and once catching `CLOUDFLARE_ACCESS_KEY` /
`CLOUDFLARE_SECRET_ACCESS_KEY` (R2 credentials, now also removed since
nothing used them). Neither went to a third party, but a credential that
sat in a terminal transcript is reasonable to rotate out of caution even
though removing the unused vars already closes the practical exposure.

## Known limitation, not fixed here

Neither `agent-pay` nor `treasury/grant` rate-limits repeated calls — the
per-call caps bound each request, but nothing stops many small requests back
to back. Out of scope for this pass; flagging so it isn't mistaken for
solved.
