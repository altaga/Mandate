# Judging Notes

Quick reference for evaluating Mandate against the specific tracks below.
Everything here is checked against live endpoints, not claims — links and
commands are included so any of this can be independently re-verified.

## Which tracks we're submitting for

- **The Graph — Best AI Tooling or AI Use Case with The Graph (From Scratch pool).**
  Not the "Best Use of Composable or Standardized Graph Products" track — we
  query a single custom subgraph, not a composition of multiple Graph
  products, so that track's own rules point here instead.
- **Arc — Best Agentic Economy Application with Circle Agent Stack.**
- **World — Selfie Check.**

## The Graph: what's real and how to check it

- Our own deployed subgraph: `https://api.studio.thegraph.com/query/1758530/mandate-vendor-reputation`
  indexes `EntryPoint.UserOperationEvent` on **Arc Testnet** (chain id
  `5042002`), decoding each event's underlying `SimpleAccount.execute(dest,
  value, func)` calldata to get the real vendor address and amount actually
  paid, and aggregates it into per-vendor success/failure reputation.
- This reputation is the top-priority source in `/api/vendor/reputation`
  (`reputationSource: "live_subgraph"`) — it's what the agent's hiring
  decision (`agentService.js`'s `processAdminCommand` → `HIRE_VENDOR`) reads,
  ahead of the Cloudflare D1 ledger and the static catalog fallback.
- `graph-node`'s generic `ethereum.decode()` cannot decode a dynamic array of
  tuples with more than one dynamic field per element — confirmed by testing
  against a real Arc Testnet transaction, where it returned `null` on
  calldata `ethers.js` decodes correctly. `subgraph/src/mapping.ts` walks the
  Solidity ABI head/tail layout by hand instead (`decodeVendorPayment`),
  verified byte-offset-by-byte in plain Node before ever touching
  AssemblyScript.
- Separately, `graphService.js` queries The Graph's Network Gateway for real
  chain-head data (block + USDC telemetry) and derives a real indexer-lag
  risk score from it (not a fixed constant) — `processAdminCommand` halts a
  real payment if that score recommends human review.
- To re-verify: `curl -X POST https://api.studio.thegraph.com/query/1758530/mandate-vendor-reputation/v0.0.4 -H "Content-Type: application/json" -d '{"query":"{ vendorReputations(first:10){ id totalOps successCount successRate } }"}'`

## Arc: what's real, and one honest gap

- Real ERC-4337 account abstraction against Arc Testnet's EntryPoint
  (`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`): UserOp construction,
  signing, gas sponsorship via our own Paymaster Worker, and real native-USDC
  transfers (`erc4337.js`, `payment/agent-pay+api.js`).
- **Gap we're being upfront about:** this AA layer is hand-rolled with
  `ethers.js` directly against the EntryPoint, not built on Circle's named
  Agent Stack / App Kits SDKs. We chose this for full transparency over the
  exact bytes being signed and submitted (useful for a judge to audit), not
  to avoid Circle's tooling. The qualification requirements (functional MVP +
  diagram + video + repo) don't name a required SDK, so this doesn't block
  eligibility, but a judge specifically checking for Agent Stack usage won't
  find it.

## World: what's real

- Real World ID Selfie Check (IDKit v4, `selfieCheckLegacy()` preset) at two
  points: judge onboarding (`app/src/components/EnrollmentScreen.js`) and the
  Mission Control human-escalation gate, both verified against
  `developer.world.org`'s real verify API — a failed check cannot reach the
  step it gates.
- Developer feedback document: [`docs/WORLD_ID_FEEDBACK.md`](docs/WORLD_ID_FEEDBACK.md).

## Architecture

Full diagrams: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
