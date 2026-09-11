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
import { getLiveVendorReputation } from '../../../utilsAPI/vendorReputationD1.js';

export async function GET(request) {
  return withLabGlitch(request, 'reputation', async () => {
    const live = await getLiveVendorReputation();

    const vendors = Object.values(VENDOR_CATALOG).map((v) => {
      const liveStats = live[v.id];
      // Real, D1-derived reputation replaces the static catalog number once a
      // vendor has enough real logged outcomes; below that it's honestly
      // reported as the static fallback, not silently blended.
      const reputation = liveStats ? liveStats.successRate : v.reputation;
      return {
        id: v.id,
        name: v.name,
        reputation,
        reputationSource: liveStats ? 'live_d1' : 'static_catalog',
        liveSampleSize: liveStats?.sampleSize || 0,
        liveAvgLatencyMs: liveStats?.avgLatencyMs ?? null,
        costUsdc: v.costUsdc,
        specialty: v.specialty,
        normalLatencyMs: v.normalLatencyMs,
        maxSlaLatencyMs: v.maxSlaLatencyMs,
        sponsor: v.sponsor || false,
        sponsorFor: v.sponsorFor || [],
        trustTier: reputation >= 99 ? 'ELITE'
                  : reputation >= 95 ? 'TRUSTED'
                  : reputation >= 85 ? 'PROVISIONAL'
                  : 'RESTRICTED',
      };
    });

    return Response.json({
      ok: true,
      source: 'layer0',
      timestamp: new Date().toISOString(),
      vendors,
    });
  });
}
