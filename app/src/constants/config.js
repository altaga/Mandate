/**
 * @file config.js
 * @description Protocol Environment Configuration for Mandate.
 * Strictly driven by environment variables with explicit absence validation.
 */

// Metro/Expo's env inlining for the browser bundle only works on a STATIC
// `process.env.EXPO_PUBLIC_X` member expression — it's a build-time text
// substitution, not a real runtime object (in the actual browser, process.env
// only ever has NODE_ENV; every EXPO_PUBLIC_ value that reaches the client
// does so because the literal expression was replaced before bundling). A
// computed lookup like `process.env[\`EXPO_PUBLIC_${key}\`]` is invisible to
// that substitution and always evaluates to undefined at runtime, silently.
// getEnv() therefore takes both values as already-resolved arguments from
// literal expressions at each call site below, rather than building the
// EXPO_PUBLIC_ name itself.
function getEnv(serverValue, publicValue, isRequired = false, keyName = '', hint = '') {
  const value = serverValue || publicValue;

  if (isRequired && !value) {
    const errorMsg = `[Mandate Configuration Error] Missing required environment variable: ${keyName}.${hint ? ' ' + hint : ' Please define it in app/.env'}`;
    console.error(errorMsg);
    if (typeof window === 'undefined') {
      throw new Error(errorMsg);
    }
  }
  return value || '';
}

export const CONFIG = {
  ENV: getEnv(process.env.NODE_ENV, undefined) || 'testnet',

  WORLD_ID: {
    APP_ID: getEnv(process.env.WORLD_APP_ID, process.env.EXPO_PUBLIC_WORLD_APP_ID),
    RP_ID: getEnv(process.env.WORLD_RP_ID, process.env.EXPO_PUBLIC_WORLD_RP_ID),
    ACTION: getEnv(process.env.WORLD_ACTION, undefined) || 'face-auth-checkout',
    HIGH_VALUE_ACTION: getEnv(process.env.WORLD_HIGH_VALUE_ACTION, undefined) || 'mandate-high-value-checkout',
    // Fixed (never timestamped) action used ONLY for enrollment + login. The nullifier_hash for
    // a given person is deterministic per (person, action) — checkout intentionally timestamps
    // its action per attempt (so nullifier reuse can't be mistaken for double-spend), but that
    // means it can never be used to recognize a returning person. This one must stay identical
    // across every enrollment/login call so enrolled_users.world_nullifier can be looked up again.
    RECOGNITION_ACTION: getEnv(process.env.WORLD_RECOGNITION_ACTION, undefined) || 'mandate-user-recognition',
    // "production" | "staging" | "sandbox" — see World ID Sandbox docs. Requires the Sandbox
    // World App build (TestFlight / Play testing track), not the public World App.
    ENVIRONMENT: getEnv(process.env.WORLD_ENVIRONMENT, process.env.EXPO_PUBLIC_WORLD_ENVIRONMENT) || 'sandbox',
    DEEP_LINK_SCHEME: 'mandate://world-callback',
    WORLD_APP_SCHEME: 'https://worldcoin.org/verify',
    VERIFICATION_LEVELS: {
      DEVICE: 'device',
      ORB: 'orb',
      SELFIE: 'selfie'
    }
  },

  THE_GRAPH: {
    API_KEY: getEnv(process.env.GRAPH_API_KEY, undefined, typeof window === 'undefined', 'GRAPH_API_KEY', 'Required for querying decentralized vendor market reputation.'),
    SUBGRAPH_ID: getEnv(process.env.GRAPH_SUBGRAPH_ID, undefined) || '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    GATEWAY_URL: `https://gateway.thegraph.com/api/${getEnv(process.env.GRAPH_API_KEY, undefined)}/subgraphs/id/${getEnv(process.env.GRAPH_SUBGRAPH_ID, undefined) || '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'}`,
    STUDIO_URL: getEnv(process.env.GRAPH_STUDIO_URL, undefined),
    NETWORK: 'the-graph-decentralized-network',
    POLL_INTERVAL_MS: 3000
  },

  ARC_NETWORK: {
    CHAIN_ID: Number(getEnv(process.env.ARC_CHAIN_ID, undefined)) || 5042002,
    SETTLEMENT_RAIL: 'Arc Testnet USDC Settlement Engine (ERC-4337 Account Abstraction)',
    RPC_URL: getEnv(process.env.ARC_RPC_URL, process.env.EXPO_PUBLIC_ARC_RPC_URL, true, 'ARC_RPC_URL', 'Required for Arc Testnet RPC connectivity.'),

    // Settlement Accounts strictly sourced from environment
    DEFAULT_BUYER_ADDRESS: getEnv(process.env.MANDATE_BUYER_ADDRESS, process.env.EXPO_PUBLIC_MANDATE_BUYER_ADDRESS, true, 'MANDATE_BUYER_ADDRESS', 'Required for POS buyer wallet telemetry.'),
    TREASURY_ADDRESS: getEnv(process.env.MANDATE_TREASURY_ADDRESS, process.env.EXPO_PUBLIC_MANDATE_TREASURY_ADDRESS, true, 'MANDATE_TREASURY_ADDRESS', 'Required for Mandate agent treasury vault.'),
    TREASURY_OWNER_ADDRESS: getEnv(process.env.MANDATE_TREASURY_OWNER_ADDRESS, undefined, false, 'MANDATE_TREASURY_OWNER_ADDRESS', 'Owner EOA of the treasury ERC-4337 smart account.'),
    AGENT_ADDRESS: getEnv(process.env.MANDATE_AGENT_ADDRESS, process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS, false, 'MANDATE_AGENT_ADDRESS', 'Mandate prepaid spending wallet that receives treasury grants.'),
    AGENT_OWNER_ADDRESS: getEnv(process.env.MANDATE_AGENT_OWNER_ADDRESS, undefined, false, 'MANDATE_AGENT_OWNER_ADDRESS', 'Owner EOA of the agent ERC-4337 smart account.'),
    ACCOUNT_FACTORY_ADDRESS: getEnv(process.env.ARC_ACCOUNT_FACTORY, undefined) || '0x9406Cc6185a346906296840746125a0E44976454',
    MERCHANT_CONTRACT: getEnv(process.env.MANDATE_MERCHANT_ADDRESS, process.env.EXPO_PUBLIC_MANDATE_MERCHANT_ADDRESS, true, 'MANDATE_MERCHANT_ADDRESS', 'Required for merchant settlement.'),
    PAYMASTER_ADDRESS: getEnv(process.env.MANDATE_PAYMASTER_ADDRESS, process.env.EXPO_PUBLIC_MANDATE_PAYMASTER_ADDRESS, true, 'MANDATE_PAYMASTER_ADDRESS', 'Required for ERC-4337 gas sponsorship.'),

    ENTRY_POINT_ADDRESS: getEnv(process.env.ARC_ENTRY_POINT, undefined) || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    FAUCET_URL: 'https://faucet.circle.com',
    EXPLORER_URL: 'https://testnet.arcscan.app',
    CURRENCY: 'USDC',
  },

};
