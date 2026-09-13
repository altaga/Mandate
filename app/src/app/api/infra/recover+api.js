/**
 * @file recover+api.js
 * @description POST /api/infra/recover
 * Called by infraFailoverService when first-party recovery is confirmed.
 * Marks the service in infraHealthStore as back on the first-party service.
 */
import { markFirstPartyRecovered } from '../../../server/infraHealthStore.js';

export async function POST(request) {
  try {
    const { path } = await request.json();
    if (!path) return Response.json({ error: 'path required' }, { status: 400 });
    await markFirstPartyRecovered(path);
    return Response.json({ ok: true, path });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
