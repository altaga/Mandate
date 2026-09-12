import { applyGlitch, recordHit } from './trafficLabStore';
import { recordServiceHit, getServiceHealth } from './infraHealthStore';

/**
 * Wraps a Layer 0 service handler with fault injection + health recording.
 *
 * Which paths an injected fault is allowed to break:
 *
 *  - Only paths that have a REAL sponsor implementation wired as the 4th
 *    argument (health → The Graph, balances → Arc RPC, probe → Arc RPC).
 *    Breaking 'catalog' or 'reputation', which have no sponsor fallback,
 *    would leave the agent marking a sponsor active while every request kept
 *    failing — a badge claiming a recovery that can't happen.
 *  - Deliberately NOT 'reason'. That path is the agent's own cognition, not
 *    infrastructure it serves traffic from; injecting a data-plane fault into
 *    the control plane you're trying to watch respond is backwards. A genuine
 *    LLM outage is already handled for real by callAgentReason()'s
 *    deterministic fallback in infraFailoverService.js.
 */
const FAULTABLE_PATHS = new Set(['health', 'balances', 'probe']);

/**
 * @param sponsorFallback optional () => Promise<Response> — a REAL alternate
 * implementation of this path (e.g. querying The Graph directly instead of
 * the local handler). When the stored mode for `path` is already 'sponsor' or
 * 'recovering' (the orchestrator has already paid to activate a fallback for
 * it), a request that would otherwise get the injected fault instead gets
 * served for real via this function — so traffic actually keeps succeeding,
 * not just a status badge saying it should.
 *
 * This check is a single deterministic if() on state already computed by pure
 * threshold math in infraHealthStore — no LLM call, no network dependency, so
 * it keeps working even if the MiniMax reasoning API is out of tokens/down.
 * recordServiceHit() below still always records the TRUE Layer 0 outcome
 * either way, so recovery-probe counting stays honest regardless of what the
 * caller actually receives.
 *
 * recordHit/recordServiceHit are awaited (not fire-and-forget) — EAS
 * Hosting's runtime can tear down the function as soon as the Response is
 * returned, which was silently dropping unawaited writes in practice.
 */
export async function withLabGlitch(request, path, handler, sponsorFallback) {
  const started = Date.now();

  // The lab tag marks the Traffic Simulator's own synthetic load. It used to
  // also decide whether an injected fault applied at all, which made the
  // Fault Injector, the Traffic Simulator and the agent one tangled unit: a
  // "down" service was only ever down for the simulator, so the agent could
  // only discover a broken Layer 0 if a human happened to have the Traffic
  // panel running, and every real caller sailed straight through a service
  // the UI was reporting as degraded. The fault now applies to whoever calls
  // the service — the simulator, the agent's own heartbeat, the app's own
  // screens — and this tag only decides whether the hit is written to the
  // simulator's own auditable hit log (/api/traffic/stats).
  const isLab = request?.headers?.get?.('x-traffic-lab') === '1';
  const worker = isLab ? (request.headers.get('x-traffic-worker') || '0') : null;

  const glitch = FAULTABLE_PATHS.has(path) ? await applyGlitch() : { blocked: false };

  if (glitch.blocked) {
    const status = glitch.status;

    // infraHealthStore always gets the TRUE Layer 0 outcome, regardless of
    // what we end up returning to the caller below — recovery-probe counting
    // must stay honest about whether Layer 0 itself is actually healthy again.
    await recordServiceHit(path, status, Date.now() - started);

    // Pure if-decision: an active (or recovering) sponsor already covers this
    // path, so actually serve the caller through it instead of surfacing the
    // raw Layer 0 failure. This now covers every caller, not just the
    // simulator — once the agent has paid to fail a path over, the app's own
    // screens keep working through the sponsor it bought. That is the entire
    // point of the failover, and it was previously invisible outside the lab.
    const mode = (await getServiceHealth(path))?.mode;
    if (sponsorFallback && (mode === 'sponsor' || mode === 'recovering')) {
      try {
        const sponsorResponse = await sponsorFallback();
        // The simulator's log records what the caller ACTUALLY received — a
        // real success via the sponsor — not the masked failure underneath.
        if (isLab) {
          await recordHit({ path, status: sponsorResponse.status, latencyMs: Date.now() - started, ok: sponsorResponse.ok, worker });
        }
        return sponsorResponse;
      } catch {
        // Sponsor itself failed too — fall through to the real Layer 0 error.
      }
    }

    if (isLab) {
      await recordHit({ path, status, latencyMs: Date.now() - started, ok: false, timeout: Boolean(glitch.timeout), worker });
    }
    return Response.json(
      { error: glitch.timeout ? 'Layer 0 timeout' : 'Layer 0 unavailable',
        glitch: glitch.timeout ? 'timeout' : 'error' },
      { status }
    );
  }

  const response = await handler();
  const latencyMs = Date.now() - started;
  await Promise.all([
    recordServiceHit(path, response.status, latencyMs),
    isLab
      ? recordHit({ path, status: response.status, latencyMs, ok: response.ok, worker })
      : Promise.resolve(),
  ]);
  return response;
}
