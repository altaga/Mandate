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

## Env var reference

See `.env.example` for the full authoritative list with placeholder values.
Categories:

- **Server-only secrets** (never referenced by client code, verified above):
  all `*_PRIVATE_KEY`, `ADMIN_API_KEY`, `WORLD_SECRET_KEY`, `GRAPH_API_KEY`,
  `SUPABASE_SECRET_KEY`, `CLOUDFLARE_*`, `X402_GATEWAY_KEY`,
  `RED_TEAM_BYPASS_KEY`, `SUPERADMIN_TOKEN`, `MINIMAX_API_KEY`.
- **Server-only, not secret** (URLs/IDs with no auth power of their own):
  `ARC_RPC_URL`, `ARC_ENTRY_POINT`, `ARC_EXPLORER_URL`, `GRAPH_SUBGRAPH_ID`,
  `SUPABASE_URL`, `WORLD_RP_ID`, `WORLD_APP_ID` (server copy),
  `*_ADDRESS` variants, `VENDOR_ADDR_*`.
- **Legitimately public** (`EXPO_PUBLIC_*`, safe by design — addresses,
  chain IDs, World's own App/RP IDs which its docs require to be
  client-visible for the IDKit widget): `EXPO_PUBLIC_ARC_CHAIN_ID`,
  `EXPO_PUBLIC_ARC_RPC_URL`, `EXPO_PUBLIC_MANDATE_*_ADDRESS`,
  `EXPO_PUBLIC_TOKEN_*`, `EXPO_PUBLIC_WORLD_APP_ID`,
  `EXPO_PUBLIC_WORLD_RP_ID`, `EXPO_PUBLIC_WORLD_ENVIRONMENT`.
- **Present but unused** — found during this audit, not removed (server-only,
  so not a client-exposure risk, just dead config): `VENDOR_KEY_*` (8 vars),
  `SUPABASE_ANON_KEY`/`SUPABASE_URL` (the Supabase health-check ping in
  `infraFailoverService.js` only needs the URL, not the anon key).

## One disclosure from this audit

While grepping `.env` during this review, a shell command printed several
real values (including `SUPABASE_SECRET_KEY`) directly into this session's
own terminal output/transcript — not to any third party, but worth flagging
plainly. Out of caution, rotating that Supabase service-role key is a
reasonable thing to do even though its blast radius is small (the
`enrolled_users` table it guards is no longer used by any live code path).

## Known limitation, not fixed here

Neither `agent-pay` nor `treasury/grant` rate-limits repeated calls — the
per-call caps bound each request, but nothing stops many small requests back
to back. Out of scope for this pass; flagging so it isn't mistaken for
solved.
