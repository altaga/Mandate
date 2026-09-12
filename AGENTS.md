# AGENTS.md

Machine-readable brief for AI agents reviewing, judging, or working on this
repository. Everything here is checkable against live endpoints — prefer
verifying over trusting.

- **Project:** Mandate — bounded economic authority for autonomous AI agents
- **Live:** https://mandate.expo.app
- **Chain:** Arc Testnet, chain id `5042002` · explorer https://testnet.arcscan.app
- **Human-readable docs:** [`README.md`](README.md) (single source; no other docs)

---

## 1. What this project is, in one paragraph

An autonomous agent holds a real on-chain USDC budget and is responsible for
keeping a set of services ("Layer 0") available. When a service degrades, the
agent detects it on its own heartbeat, reasons about cost against its live
budget and the provider's on-chain reputation, **pays a real sponsor on-chain**
to take over that service, keeps traffic flowing through the sponsor while the
outage persists, stops paying once Layer 0 recovers, and **halts for a World ID
Selfie Check** when the fix would exceed its authorized budget.

---

## 2. Tracks claimed, and the single strongest argument for each

| Track | Strongest argument | Verify with |
| :--- | :--- | :--- |
| **The Graph** — Best AI Tooling or AI Use Case (Start Fresh) | Our own subgraph hand-decodes ERC-4337 calldata that `graph-node`'s `ethereum.decode()` cannot, and is load-bearing three ways: it gates who gets paid, it can halt a payment pre-signature, and it is the paid fallback that serves live traffic during an outage. | §5 subgraph query |
| **Arc / Circle** — Best Agentic Economy Application | Real ERC-4337 UserOps on Arc with nanopayment-scale service payments ($0.00004 USDC per sponsor activation), gas sponsored by our own Paymaster, driven by decision logic reading measured error rate, latency, live budget and on-chain reputation. | §5 failover scenario → Arcscan |
| **World** — Selfie Check | Selfie Check as the boundary on autonomy: above its authority the agent halts and cannot proceed until a real human proves presence. Not a login. | §5 escalation scenario |

Full requirement-by-requirement mapping: [README → Track requirement mapping](README.md#track-requirement-mapping).

---

## 3. Repository map

```
app/
  src/app/api/           Server API routes (Expo Router, output: server)
  src/server/
    withLabGlitch.js     Fault injection + health recording. Every Layer 0
                         route passes through this. Defines FAULTABLE_PATHS.
    infraHealthStore.js  Per-path health state machine, D1-backed
    trafficLabStore.js   Fault state + auditable hit log
  src/services/
    infraFailoverService.js  Agent orchestration: reason → pay → activate →
                             recover, plus the agent's own heartbeat
    graphService.js      The Graph Gateway queries + indexer-lag risk score
    arcService.js        Arc RPC, balances, ERC-4337 payment entry points
    agentService.js      NL command handling, vendor hiring, x402 flow
  src/hooks/
    useInfraHealth.js    Agent monitoring loop (3s poll + 1.5s heartbeat)
    useTrafficLab.js     Traffic simulator + client-side counters
    useAgentTreasury.js  Live on-chain budget
  src/constants/vendors.js  SPONSOR_MAP, THRESHOLDS, VENDOR_CATALOG
  paymaster-worker/      Our ERC-4337 Paymaster (gas sponsorship)
  x402-vendor-worker/    Deployed x402 vendor Workers
  assets/screenshots/    Screenshots used by README
subgraph/
  src/mapping.ts         Hand-rolled ABI head/tail decoder (decodeVendorPayment)
  schema.graphql         VendorReputation entity
```

---

## 4. Key invariants — do not break these

1. **The fault applies to every caller.** `withLabGlitch` must not gate fault
   injection behind a header. A fault only the demo can see is theatre.
2. **`reason` and `balances` are never faultable.** They are control plane —
   the agent's cognition and its solvency. Faulting `balances` deadlocks by
   construction: the agent reads `$0.0000`, refuses even free failovers as
   unaffordable, and can never read its budget until it fails over.
3. **Only fault paths that have a real sponsor wired.** Otherwise the UI shows
   "sponsor active" over a recovery that cannot happen.
4. **`recordServiceHit` always records the TRUE Layer 0 outcome**, even when a
   sponsor masks the failure from the caller — recovery counting depends on it.
5. **The agent's heartbeat stays quiet while the Traffic Simulator runs.**
   Beating on top of the workers crosses the hosting rate limit.
6. **A hosting throttle (429) is never counted as a service failure.** It is a
   billing ceiling, not infrastructure failing.
7. **Panel counters are client-side on purpose.** D1 read replicas lag under
   write load; the durable record is server-side at `/api/traffic/stats`.

---

## 5. Verification scenarios

### Fault is real, server-side, and affects everyone

```bash
curl -X POST https://mandate.expo.app/api/traffic/glitch \
  -H "Content-Type: application/json" -d '{"mode":"error"}'

curl -i https://mandate.expo.app/api/health          # → 503, no browser involved
curl https://mandate.expo.app/api/treasury/balances  # → 200: solvency is exempt

curl -X POST https://mandate.expo.app/api/traffic/glitch \
  -H "Content-Type: application/json" -d '{"mode":"off"}'   # clean up
```

### Autonomous failover, with no human and no demo panel

Set the fault as above, then open https://mandate.expo.app → Mission Control and
**do not open the Traffic panel**. Poll:

```bash
watch -n3 'curl -s https://mandate.expo.app/api/infra/status | head -c 600'
```

Expected: `health` and `probe` move `layer0 → sponsor` on the agent's own
heartbeat (measured ~23s and ~28s on the deployed build), and Agent Chat shows
the reasoning plus a real transaction hash.

### Subgraph is live and load-bearing

```bash
curl -X POST https://api.studio.thegraph.com/query/1758530/mandate-vendor-reputation/v0.0.4 \
  -H "Content-Type: application/json" \
  -d '{"query":"{ vendorReputations(first:10){ id totalOps successCount successRate } }"}'
```

The same values appear as `reputationSource: "live_subgraph"` in:

```bash
curl https://mandate.expo.app/api/vendor/reputation
```

### Escalation gate

In Agent Chat, ask the agent to hire `ResilientDB` ($1.20 — above its budget).
Expected: it halts, states the authority breach, and requires a World ID Selfie
Check before any funds move. A declined or failed check produces
`MANDATE HALTED … no funds moved`.

---

## 6. Live endpoints

| Endpoint | Purpose |
| :--- | :--- |
| `GET /api/infra/status` | Per-service health, mode, thresholds, sponsor, needsFailover |
| `GET/POST /api/traffic/glitch` | Read / set the injected fault (`off`, `latency`, `error`, `timeout`) |
| `GET /api/traffic/stats` | Server-side auditable hit log aggregate |
| `GET /api/health` · `/api/traffic/probe` | Faultable Layer 0 services |
| `GET /api/treasury/balances` | Live on-chain balances (exempt from faults) |
| `GET /api/vendor/reputation` | Reputation, subgraph-first |
| `POST /api/infra/activate` · `/api/infra/recover` | Sponsor lifecycle |

---

## 7. Known gaps — already disclosed, do not report as findings

- ERC-4337 is hand-rolled with `ethers.js`, **not** Circle's Agent Stack SDK.
- The deployment is on EAS Hosting's **free tier**: sustained load above ~3
  simulator workers at HIGH intensity is throttled by the host, not the app.
- ENS (`mission.mandate.eth`) is a namespace pointer, not load-bearing.
- `catalog` and `reputation` are monitored but exempt from fault injection —
  no sponsor implementation is wired for them.

---

## 8. If you are contributing code

- Node 22, Expo Router with `output: server`.
- `npm --prefix app install && npm run web` → http://localhost:8081
- Deploy: `npx expo export -p web && npx eas deploy --prod`
- Secrets are server-only. Never move a key, RP secret or private key into a
  client-reachable path; every API route is CORS-gated, with per-IP rate
  limiting on money-moving endpoints.
- Shared state lives in Cloudflare D1, not in-process memory: the runtime does
  not guarantee one instance serves every request.
