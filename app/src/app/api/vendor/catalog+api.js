/**
 * @file catalog+api.js
 * @description GET /api/vendor/catalog
 *
 * Public read endpoint for the vendor catalog (no private keys exposed).
 * Wrapped with withLabGlitch so degradation triggers the static offline fallback.
 *
 * When the first-party service is healthy: returns full vendor list (free).
 * When degraded:           agent serves STATIC_CATALOG_SAFE from vendors.js (free, local).
 */

import { withLabGlitch } from '../../../server/withLabGlitch.js';
import { STATIC_CATALOG_SAFE } from '../../../constants/vendors.js';

export async function GET(request) {
  return withLabGlitch(request, 'catalog', async () => {
    return Response.json({
      ok: true,
      source: 'first-party',
      timestamp: new Date().toISOString(),
      vendors: STATIC_CATALOG_SAFE,
      count: STATIC_CATALOG_SAFE.length,
    });
  });
}
