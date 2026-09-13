import { withLabGlitch } from '../../server/withLabGlitch';
import { GraphService } from '../../services/graphService';

// Real sponsor implementation for SPONSOR_MAP.health ('The Graph', blockHeightCheck):
// proves liveness via an actual indexed block from The Graph gateway instead of
// the local status flags. Runs server-side, where GRAPH_API_KEY is available
// (unlike calling GraphService straight from browser JS).
async function fetchHealthViaGraphSponsor() {
  const context = await GraphService.queryOnchainContext();
  // The sponsor's whole claim is "a real indexed block proves this service is
  // live". With no block there is no proof, so throwing is the honest outcome —
  // withLabGlitch catches it and surfaces the real first-party failure instead of
  // reporting 'online' over a null. Previously this path could serve a
  // hardcoded block number when the Gateway was unreachable.
  if (context.blockNumber == null) {
    throw new Error(`Graph sponsor could not prove liveness: ${context.liveGraphResponseStatus}`);
  }
  return Response.json({
    status: 'online',
    servedBy: 'The Graph (sponsor)',
    blockNumber: context.blockNumber,
    blockHash: context.blockHash,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request) {
  return withLabGlitch(request, 'health', async () => Response.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment_variables: {
      ADMIN_API_KEY_LOADED: !!process.env.ADMIN_API_KEY,
      GRAPH_API_KEY_LOADED: !!process.env.GRAPH_API_KEY,
      ARC_RPC_URL_LOADED: !!process.env.ARC_RPC_URL,
      MANDATE_BUYER_ADDRESS_LOADED: !!process.env.MANDATE_BUYER_ADDRESS,
      MANDATE_TREASURY_ADDRESS_LOADED: !!process.env.MANDATE_TREASURY_ADDRESS,
      MANDATE_AGENT_ADDRESS_LOADED: !!process.env.MANDATE_AGENT_ADDRESS,
      MANDATE_MERCHANT_ADDRESS_LOADED: !!process.env.MANDATE_MERCHANT_ADDRESS,
      MANDATE_PAYMASTER_ADDRESS_LOADED: !!process.env.MANDATE_PAYMASTER_ADDRESS,
    }
  }), fetchHealthViaGraphSponsor);
}
