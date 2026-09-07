import { getStats, resetStats } from '../../../server/trafficLabStore';

export function GET() {
  return Response.json(getStats());
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body?.reset) resetStats();
  return Response.json(getStats());
}
