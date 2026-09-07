import { applyGlitch, recordHit } from './trafficLabStore';
import { recordServiceHit, getServiceHealth } from './infraHealthStore';

/**
 * @param sponsorFallback optional () => Promise<Response> — a REAL alternate
 * implementation of this path (e.g. querying The Graph directly instead of
 * the local handler). When the stored mode for `path` is already 'sponsor' or
 * 'recovering' (the orchestrator has already paid to activate a fallback for
 * it), a lab request that would otherwise get the injected fault instead gets
 * served for real via this function — so traffic actually keeps succeeding,
 * not just a status badge saying it should.
 *
 * This check is a single deterministic if() on state already computed by pure
 * threshold math in infraHealthStore — no LLM call, no network dependency, so
 * it keeps working even if the MiniMax reasoning API is out of tokens/down.
 * recordServiceHit() below still always records the TRUE Layer 0 outcome
 * either way, so recovery-probe counting stays honest regardless of what the
 * caller actually receives.
 */
export async function withLabGlitch(request, path, handler, sponsorFallback) {
  const isLab = request?.headers?.get?.('x-traffic-lab') === '1';
  const started = Date.now();

  // ── Non-lab requests: still feed infraHealthStore for real heuristics ──────
  if (!isLab) {
    const response = await handler();
    const latencyMs = Date.now() - started;
    recordServiceHit(path, response.status, latencyMs);
    return response;
  }

  // ── Lab requests: apply glitch AND record in both stores ──────────────────
  const worker = request.headers.get('x-traffic-worker') || '0';
  const glitch = await applyGlitch();

  if (glitch.blocked) {
    const status = glitch.status;

    // infraHealthStore always gets the TRUE Layer 0 outcome, regardless of
    // what we end up returning to the caller below — recovery-probe counting
    // must stay honest about whether Layer 0 itself is actually healthy again.
    recordServiceHit(path, status, Date.now() - started);

    // Pure if-decision: an active (or recovering) sponsor already covers this
    // path, so actually serve the client through it instead of surfacing the
    // raw Layer 0 failure.
    const mode = getServiceHealth(path)?.mode;
    if (sponsorFallback && (mode === 'sponsor' || mode === 'recovering')) {
      try {
        const sponsorResponse = await sponsorFallback();
        // trafficLabStore (the Traffic Simulator's own displayed stats) records
        // what the caller ACTUALLY received — a real success via the sponsor —
        // not the masked Layer 0 failure underneath it.
        recordHit({ path, status: sponsorResponse.status, latencyMs: Date.now() - started, ok: sponsorResponse.ok, worker });
        return sponsorResponse;
      } catch {
        // Sponsor itself failed too — fall through to the real Layer 0 error.
      }
    }

    recordHit({ path, status, latencyMs: Date.now() - started, ok: false, timeout: Boolean(glitch.timeout), worker });
    return Response.json(
      { error: glitch.timeout ? 'Traffic lab timeout' : 'Traffic lab error',
        glitch: glitch.timeout ? 'timeout' : 'error' },
      { status }
    );
  }

  const response = await handler();
  const latencyMs = Date.now() - started;
  recordHit({ path, status: response.status, latencyMs, ok: response.ok, worker });
  recordServiceHit(path, response.status, latencyMs);
  return response;
}
