import { GraphService } from '../../../services/graphService.js';

// Server-only wrapper around GraphService.queryOnchainContext() — that
// function needs GRAPH_API_KEY, which must never reach the browser (verified
// against a real production bundle, see SECURITY.md). Two real client-side
// callers were importing GraphService directly and always throwing
// "Missing required environment variable: GRAPH_API_KEY" in the actual
// browser runtime: infraFailoverService.js's Graph-sponsor failover path,
// and agentService.js's HIRE_VENDOR indexer-risk gate. Both now call this
// route instead.
export async function POST() {
  try {
    // No parameters: this call reads Gateway freshness, which is a property of
    // the network, not of any particular wallet. It used to accept a wallet and
    // a merchant address purely to echo invented stats back about them.
    const context = await GraphService.queryOnchainContext();
    return Response.json(context);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
