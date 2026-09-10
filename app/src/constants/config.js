/**
 * @file config.js
 * @description Protocol Environment Configuration for Mandate.
 * Strictly driven by environment variables with explicit absence validation.
 */

function getEnv(key, isRequired = false, hint = '') {
  const value = 
    (typeof process !== 'undefined' && process.env ? process.env[key] : undefined) ||
    (typeof process !== 'undefined' && process.env ? process.env[`EXPO_PUBLIC_${key}`] : undefined);

  if (isRequired && !value) {
    const errorMsg = `[Mandate Configuration Error] Missing required environment variable: ${key}.${hint ? ' ' + hint : ' Please define it in app/.env'}`;
    console.error(errorMsg);
    if (typeof window === 'undefined') {
      throw new Error(errorMsg);
    }
  }
  return value || '';
}

export const CONFIG = {
  ENV: getEnv('NODE_ENV') || 'testnet',

  WORLD_ID: {
    APP_ID: getEnv('WORLD_APP_ID', false),
    RP_ID: getEnv('WORLD_RP_ID', false),
    ACTION: getEnv('WORLD_ACTION', false) || 'face-auth-checkout',
    HIGH_VALUE_ACTION: getEnv('WORLD_HIGH_VALUE_ACTION', false) || 'mandate-high-value-checkout',
    // "production" | "staging" | "sandbox" — see World ID Sandbox docs. Requires the Sandbox
    // World App build (TestFlight / Play testing track), not the public World App.
    ENVIRONMENT: getEnv('WORLD_ENVIRONMENT', false) || 'sandbox',
    DEEP_LINK_SCHEME: 'mandate://world-callback',
    WORLD_APP_SCHEME: 'https://worldcoin.org/verify',
    VERIFICATION_LEVELS: {
      DEVICE: 'device',
      ORB: 'orb',
      SELFIE: 'selfie'
    }
  },

  THE_GRAPH: {
    API_KEY: getEnv('GRAPH_API_KEY', typeof window === 'undefined', 'Required for querying decentralized vendor market reputation.'),
    SUBGRAPH_ID: getEnv('GRAPH_SUBGRAPH_ID') || '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    GATEWAY_URL: `https://gateway.thegraph.com/api/${getEnv('GRAPH_API_KEY')}/subgraphs/id/${getEnv('GRAPH_SUBGRAPH_ID') || '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'}`,
    STUDIO_URL: getEnv('GRAPH_STUDIO_URL'),
    NETWORK: 'the-graph-decentralized-network',
    POLL_INTERVAL_MS: 3000
  },

  ARC_NETWORK: {
    CHAIN_ID: Number(getEnv('ARC_CHAIN_ID')) || 5042002,
    SETTLEMENT_RAIL: 'Arc Testnet USDC Settlement Engine (ERC-4337 Account Abstraction)',
    RPC_URL: getEnv('ARC_RPC_URL', true, 'Required for Arc Testnet RPC connectivity.'),
    
    // Settlement Accounts strictly sourced from environment
    DEFAULT_BUYER_ADDRESS: getEnv('MANDATE_BUYER_ADDRESS', true, 'Required for POS buyer wallet telemetry.'),
    TREASURY_ADDRESS: getEnv('MANDATE_TREASURY_ADDRESS', true, 'Required for Mandate agent treasury vault.'),
    TREASURY_OWNER_ADDRESS: getEnv('MANDATE_TREASURY_OWNER_ADDRESS', false, 'Owner EOA of the treasury ERC-4337 smart account.'),
    AGENT_ADDRESS: getEnv('MANDATE_AGENT_ADDRESS', false, 'Mandate prepaid spending wallet that receives treasury grants.'),
    AGENT_OWNER_ADDRESS: getEnv('MANDATE_AGENT_OWNER_ADDRESS', false, 'Owner EOA of the agent ERC-4337 smart account.'),
    ACCOUNT_FACTORY_ADDRESS: getEnv('ARC_ACCOUNT_FACTORY') || '0x9406Cc6185a346906296840746125a0E44976454',
    MERCHANT_CONTRACT: getEnv('MANDATE_MERCHANT_ADDRESS', true, 'Required for merchant settlement.'),
    PAYMASTER_ADDRESS: getEnv('MANDATE_PAYMASTER_ADDRESS', true, 'Required for ERC-4337 gas sponsorship.'),
    
    ENTRY_POINT_ADDRESS: getEnv('ARC_ENTRY_POINT') || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    FAUCET_URL: 'https://faucet.circle.com',
    EXPLORER_URL: 'https://testnet.arcscan.app',
    CURRENCY: 'USDC',
    DELEGATED_SPEND: {
      AUTO_APPROVE_THRESHOLD_USDC: 50.00,
      REQUIRE_WORLD_STEP_UP_THRESHOLD_USDC: 50.00
    }
  },

  SUPABASE: {
    URL: getEnv('SUPABASE_URL', false),
    ANON_KEY: getEnv('SUPABASE_ANON_KEY', false)
  }
};
