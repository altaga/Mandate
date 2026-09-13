/**
 * mandate-janitor — idle reset for the live demo.
 *
 * The Fault Injector writes real server-side state, which is the point: a
 * fault is real for every caller, not a client-side visual. The cost is that
 * whoever runs the demo leaves it broken behind them, and the next person to
 * open mandate.expo.app inherits a degraded system with no idea why.
 *
 * This runs on a Cron Trigger rather than lazily on a read path, so the state
 * is already clean before anyone arrives — and so the 2-3s client polls stay
 * free of extra D1 work, which matters on a database whose concurrency limits
 * have bitten this project before.
 *
 * "Activity" deliberately means human activity: setting a fault, or the
 * Traffic Simulator running (only lab traffic is written to traffic_hits).
 * The agent's own heartbeat is excluded — it fires whenever any tab is open,
 * so counting it would mean a forgotten tab kept the demo dirty forever.
 */

const IDLE_MS = 20 * 60 * 1000;

async function resetIfIdle(env) {
  const db = env.mandate_reputation;

  const row = await db.prepare(`
    SELECT
      (SELECT COALESCE(MAX(created_at), 0) FROM traffic_hits)              AS last_lab_hit,
      (SELECT COALESCE(MAX(updated_at), 0) FROM traffic_glitch)            AS glitch_at,
      (SELECT COUNT(*) FROM traffic_glitch WHERE mode <> 'off')            AS fault_on,
      (SELECT COUNT(*) FROM infra_health_state WHERE mode <> 'first-party')     AS sponsors_active
  `).first();

  const dirty = (row?.fault_on ?? 0) > 0 || (row?.sponsors_active ?? 0) > 0;
  if (!dirty) return { reset: false, reason: 'already clean' };

  const idleMs = Date.now() - Math.max(row.last_lab_hit ?? 0, row.glitch_at ?? 0);
  if (idleMs < IDLE_MS) return { reset: false, reason: 'in use', idleMs };

  await db.batch([
    db.prepare('DELETE FROM traffic_glitch'),
    db.prepare('DELETE FROM traffic_hits'),
    db.prepare('DELETE FROM infra_health_window'),
    db.prepare('DELETE FROM infra_health_state'),
  ]);

  return { reset: true, idleMs, faultOn: row.fault_on, sponsorsActive: row.sponsors_active };
}

export default {
  async scheduled(event, env) {
    const result = await resetIfIdle(env);
    console.log('[janitor]', JSON.stringify(result));
  },

  // Same logic reachable over HTTP so the behaviour can be checked on demand
  // instead of waiting out a cron tick. Read-only report unless ?run=1.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('run') === '1') {
      return Response.json(await resetIfIdle(env));
    }
    const db = env.mandate_reputation;
    const row = await db.prepare(`
      SELECT
        (SELECT COALESCE(MAX(created_at), 0) FROM traffic_hits)          AS last_lab_hit,
        (SELECT COALESCE(MAX(updated_at), 0) FROM traffic_glitch)        AS glitch_at,
        (SELECT COUNT(*) FROM traffic_glitch WHERE mode <> 'off')        AS fault_on,
        (SELECT COUNT(*) FROM infra_health_state WHERE mode <> 'first-party') AS sponsors_active
    `).first();
    const idleMs = Date.now() - Math.max(row.last_lab_hit ?? 0, row.glitch_at ?? 0);
    return Response.json({
      dirty: (row.fault_on ?? 0) > 0 || (row.sponsors_active ?? 0) > 0,
      idleMinutes: Math.round(idleMs / 60000),
      resetsAfterMinutes: IDLE_MS / 60000,
      ...row,
    });
  },
};
