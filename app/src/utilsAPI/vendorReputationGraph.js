// Server-only: queries Mandate's own deployed subgraph (indexing real
// EntryPoint.UserOperationEvent logs on Arc Testnet, decoded down to the
// specific vendor + amount of each real on-chain payment) for real,
// decentralized vendor reputation — independent of and complementary to the
// D1 ledger (which is written by the vendor Workers themselves; this is
// written by nobody we control, only by indexing real chain state).

const SUBGRAPH_QUERY_URL = 'https://api.studio.thegraph.com/query/1758530/mandate-vendor-reputation/v0.0.4';
const MIN_SAMPLES_FOR_LIVE_SCORE = 3;

async function querySubgraph(query) {
  try {
    const res = await fetch(SUBGRAPH_QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok || data.errors) return null;
    return data.data;
  } catch (err) {
    console.warn('[vendorReputationGraph] query failed:', err.message);
    return null;
  }
}

/**
 * Returns { [vendorAddressLowercase]: { successRate, totalOps, totalPaidWei, source: 'live_subgraph' } }
 * for every vendor with at least MIN_SAMPLES_FOR_LIVE_SCORE real on-chain
 * UserOperations decoded to them. Callers should treat a vendor's absence
 * from the result the same way as too few D1 samples: fall back, don't guess.
 */
export async function getSubgraphVendorReputation() {
  const data = await querySubgraph(
    `{ vendorReputations(first: 100) { id totalOps successCount successRate totalPaidWei lastUpdatedAt } }`
  );
  if (!data || !data.vendorReputations) return {};

  const result = {};
  for (const row of data.vendorReputations) {
    const totalOps = Number(row.totalOps);
    if (totalOps < MIN_SAMPLES_FOR_LIVE_SCORE) continue;
    result[row.id.toLowerCase()] = {
      successRate: Math.round(Number(row.successRate) * 10) / 10,
      totalOps,
      totalPaidWei: row.totalPaidWei,
      source: 'live_subgraph',
    };
  }
  return result;
}
