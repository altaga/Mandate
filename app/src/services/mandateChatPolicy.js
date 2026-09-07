/**
 * Chat policy for Mandate-SRE-01.
 * Natural-language treasury grants are allocated; spend/hire still needs a Mandate.
 */

const AUTHORIZE_VERB_RE = /\b(start|authorize|grant|allow|allocate|fund|increase|raise|bump|top[- ]?up|give|add)\b/;
const EXPLICIT_GRANT_RE = /\b(authorize|grant)\b/;
const CAPABILITY_RE = /capabilit|what can you|what do you|how (do|does|can)|who are you|what are you|\bhelp\b/;
const OPERATIONAL_RE = /\b(hire|deploy|fire|kill|spend|pay|transfer|scale|offline|inject|failover)\b/;
const AMOUNT_NUM_RE = /\$?\s*(\d+(?:\.\d+)?)\s*(?:usdc|usd|dollars?|bucks?)?/i;
const WORD_AMOUNTS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

export const AGENT_NAME = 'Mandate-SRE-01';
export const DEFAULT_GRANT_USDC = 1;

export function parseAuthorizeAmount(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(max|all|everything|the rest)\b/.test(lower)) return 'max';
  for (const [word, value] of Object.entries(WORD_AMOUNTS)) {
    if (new RegExp(`\\b${word}\\s+(?:more\\s+)?(?:dollars?|usdc|bucks?)\\b`).test(lower)) return value;
  }
  const match = lower.match(AMOUNT_NUM_RE);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

export function resolveGrantAmount({ requested, treasury, defaultGrant = DEFAULT_GRANT_USDC }) {
  const vault = Number(treasury) || 0;
  if (vault <= 0) {
    return { ok: false, error: `${AGENT_NAME}: Treasury is empty on Arc. I cannot grant a Mandate until the treasury wallet holds USDC.` };
  }
  const amount = requested === 'max'
    ? vault
    : (requested == null ? Math.min(defaultGrant, vault) : requested);
  if (!(amount > 0)) {
    return { ok: false, error: `${AGENT_NAME}: Grant amount must be greater than $0.` };
  }
  if (amount > vault) {
    return { ok: false, error: `${AGENT_NAME}: Requested $${amount.toFixed(2)} USDC exceeds live treasury $${vault.toFixed(2)} USDC. Grant a smaller Mandate.` };
  }
  return { ok: true, amount };
}

function isAuthorizeIntent(text) {
  const lower = String(text || '').toLowerCase();
  if (EXPLICIT_GRANT_RE.test(lower)) return true;
  if (!AUTHORIZE_VERB_RE.test(lower)) return false;
  if (/\b(budget|treasury|mandate|usdc|dollars?)\b/.test(lower)) return true;
  return /\bagent\b/.test(lower) && parseAuthorizeAmount(lower) != null;
}

function capabilitiesReply(treasury) {
  const vault = Number(treasury) || 0;
  const starter = Math.min(DEFAULT_GRANT_USDC, vault).toFixed(2);
  return `${AGENT_NAME}: Treasury is the live Arc Testnet USDC in the dedicated treasury wallet ($${vault.toFixed(2)}). A Mandate is a spend cap taken from that vault — I cannot exceed it.

Under an authorized Mandate I will:
1. DISCOVER — query The Graph for vendor reputation
2. DECIDE — hire only providers with ≥95% trust
3. PAY — gasless USDC on Arc (ERC-4337 paymaster) from the granted budget
4. HALT — if cost exceeds remaining budget, I stop.

Say "allow $2 from treasury", "give the agent 5 dollars", or "add 1 to the budget" to grant $${starter}.`;
}

export function classifyPreMandateMessage(text) {
  if (isAuthorizeIntent(text)) return 'AUTHORIZE';
  const lower = (text || '').toLowerCase();
  if (CAPABILITY_RE.test(lower)) return 'CAPABILITIES';
  if (OPERATIONAL_RE.test(lower)) return 'BLOCKED';
  return 'WAITING';
}

export function getPreMandateReply(text, { treasury } = {}) {
  const intent = classifyPreMandateMessage(text);
  if (intent === 'AUTHORIZE') {
    const requested = parseAuthorizeAmount(text);
    return { intent, grant: resolveGrantAmount({ requested, treasury }) };
  }
  if (intent === 'CAPABILITIES') {
    return { intent, reply: capabilitiesReply(treasury) };
  }
  if (intent === 'BLOCKED') {
    return {
      intent,
      reply: `${AGENT_NAME}: That action spends treasury. I have no cryptographic Mandate yet, so it is blocked.\n\nAsk about capabilities, or say "allow $1 from treasury".`
    };
  }
  return {
    intent,
    reply: `${AGENT_NAME}: Mandate is pending. Live treasury is $${(Number(treasury) || 0).toFixed(2)} USDC on Arc. Say "allow $1 from treasury" or "give the agent two dollars".`
  };
}
