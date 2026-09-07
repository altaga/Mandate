/**
 * @file activate+api.js
 * @description POST /api/infra/activate
 * Called by infraFailoverService after a successful failover payment.
 * Marks the service in infraHealthStore as running on sponsor.
 */
import { markSponsorActive } from '../../../server/infraHealthStore.js';

export async function POST(request) {
  try {
    const { path, sponsor, cost } = await request.json();
    if (!path) return Response.json({ error: 'path required' }, { status: 400 });
    markSponsorActive(path, sponsor || 'Unknown', Number(cost) || 0);
    return Response.json({ ok: true, path, sponsor, cost });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
