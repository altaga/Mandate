export function GET(request) {
  return Response.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment_variables: {
      SUPABASE_URL_LOADED: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY_LOADED: !!process.env.SUPABASE_ANON_KEY,
      ADMIN_API_KEY_LOADED: !!process.env.ADMIN_API_KEY,
      GRAPH_API_KEY_LOADED: !!process.env.GRAPH_API_KEY,
      ARC_RPC_URL_LOADED: !!process.env.ARC_RPC_URL,
      MANDATE_BUYER_ADDRESS_LOADED: !!process.env.MANDATE_BUYER_ADDRESS,
      MANDATE_MERCHANT_ADDRESS_LOADED: !!process.env.MANDATE_MERCHANT_ADDRESS,
      MANDATE_PAYMASTER_ADDRESS_LOADED: !!process.env.MANDATE_PAYMASTER_ADDRESS,
    }
  });
}
