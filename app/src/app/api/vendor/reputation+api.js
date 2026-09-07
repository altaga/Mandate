/**
 * @file reputation+api.js
 * @description GET /api/vendor/reputation
 *
 * Returns trust scores and SLA metadata for all known vendors.
 * Wrapped with withLabGlitch so the Traffic Lab can corrupt it —
 * triggering the agent's heuristic failover to The Graph Subgraph.
 *
 * When Layer 0 is healthy: returns local VENDOR_CATALOG data (free).
 * When degraded:           agent switches to GraphService.queryOnchainContext()
 *                          and pays $0.00004 USDC per query to The Graph.
 */

import { withLabGlitch } from '../../../server/withLabGlitch.js';
import { VENDOR_CATALOG } from '../../../constants/vendors.js';

export async function GET(request) {
  return withLabGlitch(request, 'reputation', async () => {
    const vendors = Object.values(VENDOR_CATALOG).map((v) => ({
      id: v.id,
      name: v.name,
      reputation: v.reputation,
      costUsdc: v.costUsdc,
      specialty: v.specialty,
      normalLatencyMs: v.normalLatencyMs,
      maxSlaLatencyMs: v.maxSlaLatencyMs,
      sponsor: v.sponsor || false,
      sponsorFor: v.sponsorFor || [],
      // Derived trust tier
      trustTier: v.reputation >= 99 ? 'ELITE'
                : v.reputation >= 95 ? 'TRUSTED'
                : v.reputation >= 85 ? 'PROVISIONAL'
                : 'RESTRICTED',
    }));

    return Response.json({
      ok: true,
      source: 'layer0',
      timestamp: new Date().toISOString(),
      vendors,
    });
  });
}
