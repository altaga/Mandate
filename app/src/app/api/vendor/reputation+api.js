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
import { getSubgraphVendorReputation } from '../../../utilsAPI/vendorReputationGraph.js';

export async function GET(request) {
  return withLabGlitch(request, 'reputation', async () => {
    const [d1Live, subgraphLive] = await Promise.all([
      getLiveVendorReputation(),
      getSubgraphVendorReputation(),
    ]);

    const vendors = Object.values(VENDOR_CATALOG).map((v) => {
      const subgraphStats = v.recipient ? subgraphLive[v.recipient.toLowerCase()] : null;
      const d1Stats = d1Live[v.id];
      // Priority: our own deployed subgraph (indexes real, independently-
      // verifiable on-chain UserOperationEvent logs — nobody we control can
      // fudge this) > D1 (real outcomes, but logged by our own Workers) >
      // static catalog fallback. Never silently blended — reputationSource
      // says exactly which one produced the number.
      let reputation, reputationSource, liveSampleSize, liveAvgLatencyMs;
      if (subgraphStats) {
        reputation = subgraphStats.successRate;
        reputationSource = 'live_subgraph';
        liveSampleSize = subgraphStats.totalOps;
        liveAvgLatencyMs = null;
      } else if (d1Stats) {
        reputation = d1Stats.successRate;
        reputationSource = 'live_d1';
        liveSampleSize = d1Stats.sampleSize;
        liveAvgLatencyMs = d1Stats.avgLatencyMs;
      } else {
        reputation = v.reputation;
        reputationSource = 'static_catalog';
        liveSampleSize = 0;
        liveAvgLatencyMs = null;
      }
      return {
        id: v.id,
        name: v.name,
        reputation,
        reputationSource,
        liveSampleSize,
        liveAvgLatencyMs,
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
