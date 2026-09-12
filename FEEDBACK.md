# Integration Feedback & Engineering Log

Everything that fought back while building Mandate, per technology — what we
hit, how we worked around it, and what we would ask the provider for.

Written to be useful two ways:

- **For sponsors:** honest developer-experience feedback, including the parts
  where we were the ones who were wrong.
- **For reviewers and agents:** every section opens with the **exact files to
  read** to see what was actually implemented for that technology, so nothing
  here has to be taken on trust.

Main documentation: [`README.md`](README.md) · Agent brief: [`AGENTS.md`](AGENTS.md)

**Contents:** [The Graph](#the-graph) · [Arc / Circle](#arc) ·
[World ID](#world-id) · [Cloudflare D1 & Workers](#cloudflare) ·
[EAS Hosting & Expo](#eas) · [React Native Web](#rnw) ·
[Our own mistakes](#our-mistakes) · [How we verified](#verification)

---

<a id="the-graph"></a>

## 🔷 The Graph

### Read this code

| File | What it shows |
| :--- | :--- |
| [`subgraph/src/mapping.ts`](subgraph/src/mapping.ts) | The hand-rolled ABI head/tail decoder (`decodeVendorPayment`) — the core workaround described below |
| [`subgraph/schema.graphql`](subgraph/schema.graphql) | `VendorReputation` entity aggregated from real on-chain events |
| [`subgraph/subgraph.yaml`](subgraph/subgraph.yaml) | Arc Testnet data source, EntryPoint address, event handler wiring |
| [`app/src/services/graphService.js`](app/src/services/graphService.js) | Gateway queries: chain head, USDC telemetry, indexer-lag risk score |
| [`app/src/app/api/graph/context+api.js`](app/src/app/api/graph/context+api.js) | Server-side Gateway proxy (keeps `GRAPH_API_KEY` off the client) |
| [`app/src/app/api/vendor/reputation+api.js`](app/src/app/api/vendor/reputation+api.js) | Subgraph-first reputation resolution (`reputationSource`) |
| [`app/src/app/api/health+api.js`](app/src/app/api/health+api.js) | The Graph as a paid liveness sponsor (`fetchHealthViaGraphSponsor`) |

### The big one: `ethereum.decode()` cannot decode our calldata

`graph-node`'s generic `ethereum.decode()` **cannot decode a dynamic array of
tuples where each element has more than one dynamic field.** We did not read
this in a doc — we found it by testing against a real Arc Testnet transaction,
where `ethereum.decode()` returned `null` on calldata that `ethers.js` decodes
correctly on the first try.

This matters for anyone indexing ERC-4337, because that shape is exactly what
`EntryPoint.handleOps(UserOperation[] ops, address beneficiary)` is. Every
account-abstraction subgraph will walk into it.

Our workaround is `decodeVendorPayment` in
[`subgraph/src/mapping.ts`](subgraph/src/mapping.ts): we walk the Solidity ABI
head/tail layout by hand to reach the nested
`SimpleAccount.execute(dest, value, func)` and pull the real vendor address and
amount out of it. We verified the byte offsets in plain Node against real
transactions *before* writing a line of AssemblyScript, because debugging
offset math inside a deployed subgraph is miserable.

**What we would ask for:** either fix the decoder for this shape, or say
plainly in the docs that it is unsupported and show the manual-offset pattern.
Right now it fails by returning `null`, which reads like *no match* rather than
*cannot decode* — we lost hours assuming our handler was wired wrong.

### Smaller notes

- **AssemblyScript debuggability.** `graph-node`'s AssemblyScript subset has no
  practical step-debugging, so the only loop is deploy → wait → read logs. Any
  official "decode this calldata locally with the same semantics as the indexer"
  harness would pay for itself immediately.
- **Studio vs Gateway split.** Studio query URLs and Gateway URLs behave
  differently in terms of keys and rate limits, and it took a while to work out
  which one belongs in a server route. A single page contrasting the two —
  *use Studio for this, Gateway for that* — would help.
- **Positive, and worth saying:** the subgraph itself is the most trustworthy
  component we shipped. Reputation derived from indexed on-chain events is
  something a judge can verify independently of anything we host, which is
  exactly why we made it the top-priority source rather than a nice-to-have.

---

<a id="arc"></a>

## 🔶 Arc / Circle

### Read this code

| File | What it shows |
| :--- | :--- |
| [`app/src/server/erc4337.js`](app/src/server/erc4337.js) | UserOp construction, signing, EntryPoint submission — hand-rolled on `ethers.js` |
| [`app/src/app/api/payment/agent-pay+api.js`](app/src/app/api/payment/agent-pay+api.js) | The agent's real on-chain payment path |
| [`app/src/app/api/treasury/grant+api.js`](app/src/app/api/treasury/grant+api.js) | Treasury → agent budget grant (real transfer) |
| [`app/paymaster-worker/`](app/paymaster-worker) | Our own Paymaster for gas sponsorship |
| [`app/x402-vendor-worker/`](app/x402-vendor-worker) | Deployed x402 vendor Workers (HTTP 402 → pay → serve) |
| [`app/src/services/arcService.js`](app/src/services/arcService.js) | Balances, explorer URLs, payment entry points |
| [`app/src/app/api/treasury/balances+api.js`](app/src/app/api/treasury/balances+api.js) | Arc RPC as a real sponsor fallback (`directRpc`) |

### What we built at this layer

We implemented the ERC-4337 primitives directly against the EntryPoint with
`ethers.js`, and deployed our own Paymaster, rather than calling Circle's Agent
Stack SDK. For an agent signing its own payments, auditability of the exact
bytes going on-chain was worth more than the abstraction. Everything below is
what that cost us.

### What was hard

- **Confirmation latency is a UX problem, not just a number.** A real payment
  takes ~10–20s to confirm. That is fine for a backend and brutal for a demo:
  a browser holds a connection open the whole time, and with several other
  polls running it eats the per-origin connection budget. We had to design
  around it (optimistic UI, then reconcile against the real balance) rather
  than pretend it was instant. Guidance on the expected confirmation envelope,
  and a recommended pattern for agents that must keep serving while a payment
  is in flight, would be genuinely useful.
- **Nanopayments are the interesting case and the least documented one.** Our
  sponsor activations cost **$0.00004 USDC**. Getting sub-cent amounts to
  survive formatting, storage and display without rounding to `$0.00` took real
  care — we had to move to 6-decimal formatting throughout
  ([`app/src/app/api/treasury/balances+api.js`](app/src/app/api/treasury/balances+api.js)
  has the note). A worked nanopayment example, end to end, would be a good
  addition to the Arc docs.
- **Paymaster + testnet faucet friction.** Running a demo that spends real
  testnet USDC on every take means constantly refilling. Nothing is broken
  here, but it shapes how a hackathon project gets built: we ended up writing
  the demo so a depleted treasury degrades gracefully instead of failing hard.

### What worked well

Arc's RPC being fast and boring is a feature — it is the one dependency we
never had to defend against. That is exactly why it ends up as the fallback
provider for two services in our own architecture: when our proxy layer is the
thing that is broken, calling the chain directly is the recovery.

---

<a id="world-id"></a>

## 🌍 World ID — Selfie Check

### Read this code

| File | What it shows |
| :--- | :--- |
| [`app/src/components/EnrollmentScreen.js`](app/src/components/EnrollmentScreen.js) | Selfie Check at onboarding (IDKit v4, `selfieCheckLegacy` preset) |
| [`app/src/app/(screens)/demo-chat.js`](app/src/app/%28screens%29/demo-chat.js) | The economic-authority escalation gate (`requestHumanEscalation`) |
| [`app/src/app/api/verify+api.js`](app/src/app/api/verify+api.js) | Server-side proof verification against the real verify API |
| [`app/src/app/api/sign+api.js`](app/src/app/api/sign+api.js) | RP-key signing for the verification request |
| [`app/src/utils/security.js`](app/src/utils/security.js) | Nullifier tracking — anti-replay |
| [`app/src/services/agentService.js`](app/src/services/agentService.js) | Where the agent halts and demands escalation (`HIRE_VENDOR` over budget) |

Registered App ID `app_11a0069f40eddb35899a9ec904f3e441`, RP ID
`rp_b741b56a51172a0d`, action `mandate-operator-auth`.

### Docs & integration flow

**Strengths.** The IDKit v4 separation between the React component and
server-side verification is clean, and the zero-knowledge explanation — how a
proof establishes a distinct human action without revealing identity — is the
best writing of its kind we have read.

**Gaps we hit:**

- **`device` vs `selfieCheckLegacy` is blurred.** It is not obvious from the
  quickstart which verification level you can develop against *before* Sandbox
  access is granted. A single table stating "develop against `device`, switch to
  the Selfie Check preset once whitelisted" would have removed a day of
  hesitation.
- **No deep-link schema for React Native / Expo.** The web modal is documented;
  the mobile trigger is not. Developers need the explicit
  `worldapp://verify?action=…&app_id=…` schema and the expected callback
  parameters to build a custom flow. We reverse-engineered it.
- **v3 → v4 migration table missing.** Prop names changed around verification
  levels and presets. A migration table mapping *how to request Device vs
  Selfie vs Orb credentials* between versions would have saved hours.

### Developer Portal

Registering the App ID and action took under three minutes, and dashboard
visibility into verification volume is good. Two asks:

- **RP keypair handling needs a helper.** Generating the RP keypair and then
  producing a correct signed request is where server-side integration actually
  stalls. An in-portal signature generator, or a copy-paste `curl` builder for
  the exact request your app should be sending, would remove the guesswork.
- **Sandbox access behind a Google Form is a hard blocker in a 48-hour event.**
  A Stripe-style "test mode" toggle in the portal would change adoption
  materially. We built against `device` while waiting, then switched.

### Sandbox, proof flows, edge cases

- **Nullifier replay is a real risk in agent scenarios and is not called out.**
  A multi-step agent can retry an action and re-submit the same proof payload.
  We had to implement explicit nullifier tracking ourselves
  ([`app/src/utils/security.js`](app/src/utils/security.js)) to reject reuse.
  For an agent-facing product this deserves to be a documented requirement with
  a recommended storage pattern, not something each team rediscovers.
- **Desktop reviewers without World App are a dead end.** Async judging happens
  on a laptop. The QR flow assumes a phone with the Sandbox build installed —
  which reviewers will not have. We added a clearly-labelled sandbox fallback so
  the escalation pipeline can be exercised end to end regardless of device;
  without it, the entire feature is unreviewable by the people evaluating it.
- **Document- vs device-based proofs could not be tested before whitelisting.**
  Our backend normalises both into a single tier as a result.

### The part worth keeping

Used as a *login*, Selfie Check would be unremarkable. Used as the **ceiling on
an autonomous spender** it is doing something no other primitive in our stack
can: it is the only reason an agent with a wallet and a broken dependency stops
instead of spending. That framing — proof-of-human as an authorization boundary
rather than an identity check — is what we would put front and centre in the
Selfie Check docs.

---

<a id="cloudflare"></a>

## ☁️ Cloudflare D1 & Workers

### Read this code

| File | What it shows |
| :--- | :--- |
| [`app/src/server/d1Client.js`](app/src/server/d1Client.js) | The D1 **REST** client (we are outside Workers, so no binding) |
| [`app/src/server/infraHealthStore.js`](app/src/server/infraHealthStore.js) | Health state machine + the batched-read fix described below |
| [`app/src/server/trafficLabStore.js`](app/src/server/trafficLabStore.js) | Fault state, auditable hit log, conditional-aggregation query |
| [`app/src/utilsAPI/rateLimitGuard.js`](app/src/utilsAPI/rateLimitGuard.js) | Per-IP rate limiting, one atomic D1 statement |
| [`app/x402-vendor-worker/`](app/x402-vendor-worker) · [`app/paymaster-worker/`](app/paymaster-worker) | Deployed Workers |

D1 gave us something we genuinely needed — state shared across server instances
— and then cost us two of the hardest bugs in the project. Both were about the
**REST API**, which is what you use when your app is *not* a Worker.

### Read-replica lag under write load, with no way to ask for consistency

Under sustained writes, reads through the REST API served **stale data for
20–25 seconds**, then caught up all at once.

We chased this for a long time because the symptom was bizarre: the traffic
panel's counters froze solid while the requests behind them were demonstrably
succeeding. We only pinned it by tracing the network directly — individual
requests completing in real time while the displayed total sat still, then
jumped by the entire missed amount at once. Nothing was broken; the reads were
simply behind the writes.

Inside a Worker you can reach for D1 Sessions and a bookmark to get
read-your-own-writes. **From the REST API there is no equivalent**, so there was
no correct fix available — only an architectural one: stop asking a shared table
for numbers the client already knows, and count locally
([`app/src/hooks/useTrafficLab.js`](app/src/hooks/useTrafficLab.js)). The
durable server-side record stays for auditability.

**What we would ask for:** expose session/bookmark consistency on the REST API,
or state its consistency model explicitly in the docs. Right now the REST API
reads as "the same database, over HTTP", and it is not.

### Concurrent request fan-out silently drops results

`getAllHealth()` originally issued **12 concurrent D1 REST calls** per poll (six
paths × two queries), every three seconds. Under load, some of those calls
consistently failed — and because `queryD1` catches, logs and returns `null`,
the caller fell through to a default state instead of an error.

The consequence was subtle and severe: one path (`probe`) reported *perfectly
healthy* while D1 itself held the correct row showing it failing. The agent
therefore never saw it cross the failover threshold and never repaired it. We
found it by diffing a direct `wrangler d1 execute` read against the live API
response at the same instant.

Fixed by batching twelve queries into two (`WHERE path IN (…)` plus a window
function for last-N-per-path) in
[`app/src/server/infraHealthStore.js`](app/src/server/infraHealthStore.js).

**What we would ask for:** guidance on a sane concurrency ceiling for the REST
API, and ideally a batch endpoint. A silent partial failure that looks like
valid data is the worst possible failure mode.

### Positives

- Window functions work (`ROW_NUMBER() OVER (PARTITION BY …)`) — that let us
  collapse the fan-out cleanly.
- `INSERT … ON CONFLICT DO UPDATE … RETURNING` in a single statement made the
  rate limiter genuinely atomic across instances, which an in-memory counter
  could never be here.
- Workers themselves were the least troublesome part of the whole stack.

---

<a id="eas"></a>

## 🚀 EAS Hosting & Expo

### Read this code

| File | What it shows |
| :--- | :--- |
| [`app/src/app/+middleware.js`](app/src/app/+middleware.js) | CORS gating across all API routes |
| [`app/src/server/withLabGlitch.js`](app/src/server/withLabGlitch.js) | Why shared state had to leave process memory |
| [`app/metro.config.js`](app/metro.config.js) | `unstable_enablePackageExports = false` and the reason |
| [`app/scripts/patch-idkit-wasm-url.js`](app/scripts/patch-idkit-wasm-url.js) | Postinstall patch for the IDKit WASM URL |

### The free tier throttles, and it does not look like throttling

The single most expensive bug of the project. Under sustained demo load the
deployment starts returning **`429` with an HTML body**:

> *"This deployment is receiving too many requests. This free-tier deployment
> has temporarily exceeded its request rate limit… upgrade to a paid plan to
> lift this limit."*

Two separate mysteries turned out to be this one thing:

1. **`429`s appearing in our own traffic log**, indistinguishable from the
   infrastructure faults we were deliberately injecting — a billing limit
   masquerading as the thing the product exists to demonstrate.
2. **`Unexpected token 'T', "This deplo"… is not valid JSON`** — hours of
   confusion, chasing a parser bug that did not exist. It was
   *"**This deplo**yment is receiving too many requests"*, HTML, hitting
   `response.json()`.

**What we would ask for, in order of value:**

- **Return JSON for API routes**, or at least respect `Accept:
  application/json`. An HTML error page delivered to a `fetch()` guarantees a
  misleading parse error miles from the real cause.
- **Send `Retry-After` and a machine-readable error code.** We could have
  backed off correctly in minutes instead of misdiagnosing for hours.
- **Surface the limit in the dashboard**, ideally with current usage. We
  reverse-engineered the ceiling empirically: three simulator workers at HIGH
  intensity run clean, five cross it.

We now label throttled hits as *hosting-throttled* in the UI and exclude them
from the failure count, precisely so this can never again be mistaken for
infrastructure failing.

### Multi-instance runtime breaks the obvious thing

The runtime does not guarantee that the same Node process serves every request.
Anything kept in `globalThis` is therefore per-instance and non-deterministic —
which produced our most confusing early bug: **65 real HTTP 503s visible in the
browser console while the panel read "0 failures"**, because the counter lived
in a different instance than the one that served the requests.

This is documented behaviour once you go looking, but the failure is silent and
looks like a logic bug. A prominent note in the API-routes docs — *state must be
external; here is why* — would save teams a day. It is what pushed all shared
state into D1.

### Deploy flow gotchas

- `eas deploy` will happily ship a **stale export**. Our first deploy reported
  `Project export: server - exported 8 hours ago` and shipped code from that
  morning. `npx expo export -p web` must run first, every time; nothing warns
  you.
- Deploying without `--prod` creates a preview URL, which is easy to mistake for
  a production deploy when the command output looks nearly identical.
- Fire-and-forget writes get dropped: the runtime can tear the function down as
  soon as the response is returned. Every state write had to be explicitly
  awaited — see the comments in
  [`app/src/server/trafficLabStore.js`](app/src/server/trafficLabStore.js).

### Bundler conflicts

- **`ethers` + `@noble/hashes` vs Metro package exports.** Resolution broke
  until we set `unstable_enablePackageExports = false`
  ([`app/metro.config.js`](app/metro.config.js) carries the full explanation).
- **IDKit ships a WASM URL that does not survive bundling.** We patch it in a
  postinstall step ([`app/scripts/patch-idkit-wasm-url.js`](app/scripts/patch-idkit-wasm-url.js))
  rather than committing a patched dependency.

---

<a id="rnw"></a>

## ⚛️ React Native Web

### Read this code

| File | What it shows |
| :--- | :--- |
| [`app/src/features/mandate-control/`](app/src/features/mandate-control) | The Mission Control panels |
| [`app/src/app/(screens)/demo-chat.js`](app/src/app/%28screens%29/demo-chat.js) | Panel state, tab state, agent wiring |

- **`Pressable` cancels a press if the pointer moves between down and up.**
  Standard tap-vs-drag disambiguation inherited from touch, and correct — but on
  web with a mouse it means a few pixels of drift silently swallows the click.
  We found this the hard way while automating the demo: roughly one click in
  three did nothing, with no error anywhere. Worth a line in the web docs.
- **Text nodes are not addressable the way DOM text is.** Every visible string
  becomes a `<div>`, so an exact-text selector can match an off-screen node
  before the visible one. Any team writing e2e tests against RNW will hit this.

---

<a id="our-mistakes"></a>

## 🔧 Problems that were our own fault

Included because they are the most instructive part, and because a reviewer
will find the fixes in the git history anyway.

**The fault only broke the demo.** Fault injection was gated behind an
`x-traffic-lab` header, so a "down" service was only down for our own traffic
simulator. `curl` got a cheerful `200` from a service the UI was reporting as
degraded. It looked right on screen and was theatre underneath. The fault now
applies to whoever calls the service — see
[`app/src/server/withLabGlitch.js`](app/src/server/withLabGlitch.js).

**The agent could only notice while someone was watching.** Its awareness came
entirely from traffic the demo panel generated, so a fault injected with that
panel closed went undetected forever. It now runs its own heartbeat
([`app/src/services/infraFailoverService.js`](app/src/services/infraFailoverService.js),
`beatOwnServices`).

**We faulted the agent's solvency read and deadlocked it.** With
`/api/treasury/balances` faultable, the first balance read fails, the agent
reasons against `$0.0000`, and refuses its own recovery as unaffordable —
*including the free sponsors*. It cannot read its budget until it fails over and
will not fail over until it can read its budget. Solvency is control plane;
`balances` and `reason` are now exempt from injection.

**"Unknown" is not "zero".** A failed balance read zeroed the budget instead of
leaving the last known value, which is how the deadlock above got its teeth. A
failed read means *could not check*, not *the money is gone*
([`app/src/hooks/useAgentTreasury.js`](app/src/hooks/useAgentTreasury.js)).

**The heartbeat DDoS'd our own deployment.** Beating on top of a running traffic
simulator pushed us over the hosting rate limit and pulled real `429`s into the
demo. The heartbeat now stays quiet while the simulator is running — it exists
to guarantee signal when nothing else provides it, not to add to it.

---

<a id="verification"></a>

## 🔬 How we verified all of this

Because "it looked right" is how most of the bugs above survived as long as
they did:

- **Network tracing over UI observation.** The D1 replica-lag bug was invisible
  from the UI and obvious the moment we logged request start/end times.
- **Direct database reads as ground truth.** Diffing `wrangler d1 execute`
  against the live API at the same instant is what exposed the silent
  concurrent-read failures.
- **Reading the frames, not the logs.** The demo recordings were checked by
  extracting frames and looking at them; several defects (a frozen counter, a
  visible parse error, throttled rows) were only ever visible that way.
- **Parsing the diagrams with mermaid itself.** Two architecture diagrams had
  been silently rendering as raw code blocks on GitHub for who knows how long.
  Running every diagram through mermaid's own parser found them in seconds.
- **`curl` as the arbiter.** Any claim about server behaviour that cannot be
  reproduced with `curl`, outside the browser, we treated as unproven — which
  is exactly how we discovered the fault was not actually affecting real
  callers.
