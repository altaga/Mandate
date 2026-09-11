import { getGlitch, setGlitch } from '../../../server/trafficLabStore';

const MODES = new Set(['off', 'latency', 'error', 'timeout']);

export async function GET() {
  return Response.json(await getGlitch());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = String(body?.mode || '');
    if (!MODES.has(mode)) {
      return Response.json({ error: 'mode must be off, latency, error, or timeout' }, { status: 400 });
    }
    return Response.json(await setGlitch({ mode, latencyMs: body?.latencyMs }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
