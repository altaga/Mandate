/**
 * @file recover+api.js
 * @description POST /api/infra/recover
 * Called by infraFailoverService when Layer 0 recovery is confirmed.
 * Marks the service in infraHealthStore as back on Layer 0.
 */
import { markLayer0Recovered } from '../../../server/infraHealthStore.js';

export async function POST(request) {
  try {
    const { path } = await request.json();
    if (!path) return Response.json({ error: 'path required' }, { status: 400 });
    markLayer0Recovered(path);
    return Response.json({ ok: true, path });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
