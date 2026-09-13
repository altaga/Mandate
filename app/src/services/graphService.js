/**
 * @file graphService.js
 * @description The Graph Network Gateway client + indexer-lag risk engine.
 *
 * Two distinct subgraphs are in play in this project, and it matters which is
 * which:
 *
 *  - OUR OWN subgraph (`mandate-vendor-reputation`, indexing Arc Testnet's
 *    EntryPoint) is queried in `utilsAPI/vendorReputationGraph.js`. That is the
 *    one that gates who gets paid.
 *  - THIS file queries a large, continuously-indexed public subgraph
 *    (Uniswap V3 mainnet by default) through the decentralized Network Gateway,
 *    for one purpose only: a liveness/freshness signal. `_meta.block.timestamp`
 *    tells us how far behind chain head a real indexer actually is right now,
 *    which is what `computeRiskFromIndexerLag()` turns into a payment gate. We
 *    do not claim that subgraph as ours; we consume it as an oracle.
 *
 * Nothing here is allowed to invent a value. Every field is either what the
 * Gateway actually returned or `null` — a fabricated block number served as
 * "proof of liveness" would be worse than no proof at all.
 */

import { CONFIG } from '../constants/config.js';

// Default is the Uniswap V3 mainnet subgraph: high query volume, always
// indexing, so its indexer lag is a meaningful reading of Gateway freshness.
const DEFAULT_LIVENESS_SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
const USDC_MAINNET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

export class GraphService {
  /**
   * Queries The Graph's decentralized Network Gateway for chain-head freshness.
   *
   * Never throws: callers use this as a payment gate, so a Gateway outage has
   * to produce a fail-CLOSED verdict (`REQUIRE_HUMAN_REVIEW`) rather than an
   * exception a caller might swallow and then proceed through.
   */
  static async queryOnchainContext() {
    const apiKey = CONFIG.THE_GRAPH.API_KEY || process.env.GRAPH_API_KEY;
    if (!apiKey) {
      throw new Error("[GraphService Configuration Error] Missing required environment variable: GRAPH_API_KEY. Please set it in app/.env");
    }

    const subgraphId = CONFIG.THE_GRAPH.SUBGRAPH_ID || DEFAULT_LIVENESS_SUBGRAPH_ID;
    const gatewayUrl = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;

    const queryPayload = {
      query: `
        query GatewayLivenessContext {
          _meta { block { number hash timestamp } }
          tokens(where: { id: "${USDC_MAINNET}" }) {
            id
            txCount
            volumeUSD
            totalValueLockedUSD
          }
        }
      `
    };

    const startTime = Date.now();

    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryPayload)
      });

      const latencyMs = Date.now() - startTime;
      const json = await response.json();

      // A GraphQL error body comes back with HTTP 200, so `response.ok` proves
      // nothing here. Treating that as success is how this used to serve a
      // hardcoded block number labelled SUCCESS_LIVE_INDEXED.
      if (json?.errors?.length) {
        throw new Error(json.errors[0]?.message || 'Gateway returned GraphQL errors');
      }
      const meta = json?.data?._meta?.block;
      if (!meta?.number || !meta?.timestamp) {
        throw new Error('Gateway response carried no indexed block');
      }

      const usdcToken = json?.data?.tokens?.[0] || null;

      // Real risk signal derived from the query result actually returned by
      // the Gateway, not a fixed constant: how far behind chain head is this
      // subgraph's indexer? A stale indexer is a genuine reason to be more
      // cautious about trusting on-chain state for a payment decision.
      const indexerLagSeconds = Math.max(0, Math.round(Date.now() / 1000) - Number(meta.timestamp));

      return {
        subgraphId,
        subgraphRole: 'gateway-liveness-oracle',
        network: 'The Graph Decentralized Network',
        blockNumber: Number(meta.number),
        blockHash: meta.hash || null,
        latencyMs,
        queryTimestamp: new Date().toISOString(),
        liveGraphResponseStatus: 'SUCCESS_LIVE_INDEXED',
        usdcTelemetry: usdcToken ? {
          tokenAddress: usdcToken.id,
          txCount: Number(usdcToken.txCount),
          totalVolumeUSD: Number(usdcToken.volumeUSD),
          totalValueLockedUSD: Number(usdcToken.totalValueLockedUSD),
        } : null,
        indexerLagSeconds,
        riskEvaluation: computeRiskFromIndexerLag(indexerLagSeconds),
      };
    } catch (err) {
      console.warn('[GraphService] Network Gateway unreachable:', err.message);
      return {
        subgraphId,
        subgraphRole: 'gateway-liveness-oracle',
        network: 'The Graph Decentralized Network',
        blockNumber: null,
        blockHash: null,
        latencyMs: Date.now() - startTime,
        queryTimestamp: new Date().toISOString(),
        liveGraphResponseStatus: 'GATEWAY_UNREACHABLE',
        error: err.message,
        usdcTelemetry: null,
        indexerLagSeconds: null,
        // The Gateway itself was unreachable, not merely lagging — this is
        // deliberately the highest risk tier, distinct from a live-but-stale
        // indexer, so a caller can't mistake "we heard nothing" for "we
        // checked and it's fine."
        riskEvaluation: {
          riskScore: 100,
          riskTier: 'GATEWAY_UNREACHABLE',
          recommendation: 'REQUIRE_HUMAN_REVIEW',
        },
      };
    }
  }
}

/**
 * Turns real indexer lag (seconds behind the timestamp of the block The Graph
 * Gateway actually returned) into a risk tier. Thresholds are conservative:
 * The Graph's hosted/network indexers typically lag by single-digit seconds
 * under normal conditions, so anything minutes-old is a genuine anomaly.
 */
function computeRiskFromIndexerLag(indexerLagSeconds) {
  if (indexerLagSeconds == null) {
    return { riskScore: 50, riskTier: 'UNKNOWN_NO_TIMESTAMP', recommendation: 'PROCEED_WITH_CAUTION' };
  }
  if (indexerLagSeconds <= 30) {
    return { riskScore: Math.round((indexerLagSeconds / 30) * 10), riskTier: 'VERY_LOW_RISK', recommendation: 'PROCEED_AUTOMATIC_PAYMENT' };
  }
  if (indexerLagSeconds <= 300) {
    return { riskScore: 25, riskTier: 'LOW_RISK', recommendation: 'PROCEED_AUTOMATIC_PAYMENT' };
  }
  if (indexerLagSeconds <= 1800) {
    return { riskScore: 65, riskTier: 'ELEVATED_RISK', recommendation: 'PROCEED_WITH_CAUTION' };
  }
  return { riskScore: 95, riskTier: 'HIGH_RISK_STALE_INDEXER', recommendation: 'REQUIRE_HUMAN_REVIEW' };
}
