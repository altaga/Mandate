import { withLabGlitch } from '../../../server/withLabGlitch';

async function realProbe(worker) {
  return Response.json({
    ok: true,
    worker,
    target: 'probe',
    status: 200,
    timestamp: new Date().toISOString(),
  });
}

// Real sponsor implementation for SPONSOR_MAP.probe ('Arc', directRpc): proves
// network reachability with a live Arc RPC call instead of the local no-op ok.
async function probeViaArcSponsor(worker) {
  try {
    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    const data = await response.json();
    const blockNumber = data?.result ? parseInt(data.result, 16) : null;
    return Response.json({
      ok: true,
      worker,
      target: 'probe',
      status: 200,
      servedBy: 'Arc RPC (sponsor)',
      blockNumber,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { ok: false, worker, target: 'probe', status: 502, error: error.message },
      { status: 502 }
    );
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const worker = url.searchParams.get('worker') || request.headers.get('x-traffic-worker') || '0';
  return withLabGlitch(
    request,
    'probe',
    () => realProbe(worker),
    () => probeViaArcSponsor(worker)
  );
}
