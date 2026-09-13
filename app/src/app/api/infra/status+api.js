/**
 * @file status+api.js
 * @description GET /api/infra/status
 *
 * Returns real-time health state for all 5 first-party services.
 * Polled every 3 s by useInfraHealth hook in the client.
 *
 * NOT wrapped with withLabGlitch — this endpoint must always be reachable
 * so the monitoring loop can function even when other services are degraded.
 */

import { getAllHealth } from '../../../server/infraHealthStore.js';

export async function GET() {
  const services = await getAllHealth();

  const overallOk = services.every((s) => s.mode === 'first-party' && s.severity === 'ok');
  const activeFailovers = services.filter((s) => s.mode === 'sponsor').length;
  const recovering = services.filter((s) => s.mode === 'recovering').length;
  const critical = services.filter((s) => s.severity === 'critical').length;
  const totalSponsorCost = services.reduce((sum, s) => sum + (s.totalSponsorCost || 0), 0);

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    overallStatus: overallOk ? 'healthy' : activeFailovers > 0 ? 'degraded' : 'recovering',
    summary: { activeFailovers, recovering, critical, totalSponsorCost: Number(totalSponsorCost.toFixed(6)) },
    services,
  });
}
