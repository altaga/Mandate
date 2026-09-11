import { getStats, resetStats } from '../../../server/trafficLabStore';

export async function GET() {
  return Response.json(await getStats());
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (body?.reset) await resetStats();
  return Response.json(await getStats());
}
