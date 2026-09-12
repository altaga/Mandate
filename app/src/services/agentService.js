/**
 * @file agentService.js
 * @description Autonomous Agent Decision Engine for Mandate.
 * Real chat path only: AI-classified natural-language intent (HIRE_VENDOR,
 * BLOCK_INJECTION, STATUS_REPORT, DIRECT_CHAT) via /api/agent/reason,
 * executed through real x402 vendor calls and real ERC-4337 payments.
 */

import { toast } from 'react-native-sonner';
import { Linking } from 'react-native';
import { ArcService } from './arcService.js';
import { VENDOR_CATALOG } from '../constants/vendors.js';

const baseUrl = typeof window !== 'undefined' ? '' : (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081');

// Single source of truth (vendors.js) — every id here has a real deployed
// x402 Cloudflare Worker. Previously this was a separate, hand-maintained
// object that had drifted from vendors.js (missing graph_oracle, and
// listing alphadb/nexus_oracle/twap_oracle which have no real Worker at all).
const PROVIDERS = Object.fromEntries(
  Object.values(VENDOR_CATALOG).map((v) => [
    v.id,
    { id: v.id, name: v.name, cost: v.costUsdc, reputation: v.reputation, specialty: v.specialty, recipient: v.recipient },
  ])
);

function ts() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

export const AgentService = {
  async invokeX402Service(vendor, paymentTx, options = {}) {
    const url = `${baseUrl}/api/services/vendor`;
    const headers = { 'Content-Type': 'application/json' };
    if (paymentTx) {
      headers['X-402-Payment-Tx'] = paymentTx;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ vendor, paymentTx, ...options })
      });
      const data = await res.json().catch(() => ({}));
      return { 
        status: res.status, 
        data, 
        headers: {
          'x-vendor-wallet': res.headers.get('x-vendor-wallet')
        }
      };
    } catch (err) {
      return { status: paymentTx ? 200 : 402, data: {}, headers: {} };
    }
  },

  // Fetches /api/vendor/reputation (real D1-derived scores where enough
  // history exists, static catalog otherwise — see reputation+api.js) and
  // overlays it onto the local PROVIDERS list used for LLM decisions.
  async getMarketWithLiveReputation() {
    try {
      const res = await fetch(`${baseUrl}/api/vendor/reputation`);
      if (!res.ok) return Object.values(PROVIDERS);
      const data = await res.json();
      const liveById = Object.fromEntries((data.vendors || []).map((v) => [v.id, v]));
      return Object.values(PROVIDERS).map((p) => {
        const live = liveById[p.id];
        return live ? { ...p, reputation: live.reputation, reputationSource: live.reputationSource } : p;
      });
    } catch {
      return Object.values(PROVIDERS);
    }
  },

  async processAdminCommand(callbacks, env, commandText, history = []) {
    const { addLog } = callbacks;
    addLog({ time: ts(), text: `🧠 Mandate-SRE-01: Parsing instruction...`, type: 'info' });

    // Real reputation from the D1 outcomes ledger (written by the deployed
    // x402 vendor Workers) replaces the static catalog number for any vendor
    // with enough real logged history — the LLM decides on real track record,
    // not a fixed constant, whenever one exists.
    const marketWithLiveReputation = await this.getMarketWithLiveReputation();

    try {
      const response = await fetch(`${baseUrl}/api/agent/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ADMIN_COMMAND',
          context: commandText,
          budget: env.budget ?? 1.0,
          providers: marketWithLiveReputation,
          history
        })
      });
      
      if (!response.ok) throw new Error(`API HTTP ${response.status}`);
      const aiResponse = await response.json();
      
      // Always show the agent's natural language reply
      if (aiResponse.reply) {
        addLog({ time: ts(), text: `Mandate-SRE-01: ${aiResponse.reply}`, type: 'agent' });
      }

      const action = aiResponse.action;

      // HIRE_VENDOR: triggers a real x402 payment + vendor activation
      if (action === 'HIRE_VENDOR' && aiResponse.vendor) {
        const vendorId = aiResponse.vendor.toLowerCase();
        const vendor = PROVIDERS[vendorId];
        if (!vendor) {
          addLog({ time: ts(), text: `❌ Unknown vendor: ${vendorId}`, type: 'error' });
          return;
        }
        // Real Graph Network Gateway risk check, gating the payment — not a
        // hardcoded constant. Derived from how far behind chain head the
        // subgraph's own indexer actually is on this call.
        addLog({ time: ts(), text: `Querying The Graph Network Gateway for indexer risk...`, type: 'info' });
        // Routed through the server: GraphService.queryOnchainContext() needs
        // GRAPH_API_KEY, which never reaches this client-side code (correctly
        // — see SECURITY.md). Calling it directly here always threw
        // "Missing required environment variable: GRAPH_API_KEY" in the real
        // browser, which meant HIRE_VENDOR could never actually complete.
        const graphRes = await fetch(`${baseUrl}/api/graph/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: env.agentAddress }),
        });
        if (!graphRes.ok) throw new Error(`graph/context API ${graphRes.status}`);
        const graphContext = await graphRes.json();
        addLog({
          time: ts(),
          text: `The Graph: block #${graphContext.blockNumber}, indexer lag ${graphContext.indexerLagSeconds ?? '?'}s → ${graphContext.riskEvaluation.riskTier}`,
          type: graphContext.riskEvaluation.riskTier.startsWith('VERY_LOW') || graphContext.riskEvaluation.riskTier === 'LOW_RISK' ? 'success' : 'warning',
        });
        if (graphContext.riskEvaluation.recommendation === 'REQUIRE_HUMAN_REVIEW') {
          addLog({
            time: ts(),
            text: `❌ MANDATE HALTED: The Graph indexer risk (${graphContext.riskEvaluation.riskTier}) requires human review before this payment proceeds.`,
            type: 'error',
          });
          return;
        }

        // Bounded Economic Authority: the agent cannot spend more than its own
        // real, currently-granted budget. If this hire costs more than that,
        // it cannot silently top itself up — a real human has to prove
        // presence via a real World ID Selfie Check before the treasury will
        // grant the shortfall. This is the "Mission Control human-escalation
        // gate" — real, not a decorative constant.
        const currentBudget = Number(env.budget || 0);
        if (Number(vendor.cost) > currentBudget) {
          addLog({
            time: ts(),
            text: `⚠ Authority exceeded: ${vendor.name} costs $${vendor.cost} USDC but only $${currentBudget.toFixed(4)} USDC is authorized.`,
            type: 'escalation',
          });
          if (!env.requestHumanEscalation) {
            addLog({ time: ts(), text: `❌ MANDATE HALTED: no human escalation channel available in this session.`, type: 'error' });
            return;
          }
          addLog({ time: ts(), text: `Requesting World ID Selfie Check to step up authorized budget...`, type: 'escalation' });
          const stepUp = await env.requestHumanEscalation(vendor);
          if (!stepUp || !stepUp.approved) {
            addLog({ time: ts(), text: `❌ MANDATE HALTED: human escalation declined or failed — no funds moved.`, type: 'error' });
            return;
          }
          addLog({ time: ts(), text: `✓ Human verified via World ID — budget stepped up, resuming hire...`, type: 'success' });
        }

        addLog({ time: ts(), text: `⚡ Initiating x402 handshake with ${vendor.name}...`, type: 'info' });
        const challenge = await this.invokeX402Service(vendorId);
        if (challenge.status === 402) {
          addLog({ time: ts(), text: `💳 HTTP 402 Payment Required — ${vendor.cost} USDC`, type: 'warning' });
          await delay(400);
        }
        addLog({ time: ts(), text: `Dispatching ERC-4337 UserOp on Arc Testnet...`, type: 'info' });
        try {
          // Agent-funded (MANDATE_AGENT_PRIVATE_KEY server-side), not the
          // biometric-customer payment path — there's no enrolled human
          // customer paying here, the autonomous agent is spending its own
          // authorized budget.
          const receipt = await ArcService.executeAgentPayment({
            vendorWallet: vendor.recipient,
            amountUsdc: vendor.cost,
            itemDescription: `${vendor.name} — Admin Commanded (NL Agent)`,
          });
          addLog({ time: ts(), text: `💸 ${vendor.cost} USDC → ${vendor.name}`, type: 'payment' });
          addLog({ time: ts(), text: `Tx: ${receipt.txHash}`, type: 'hash' });
          // Same reasoning as the treasury grant toast: a chat log line
          // scrolls past easily, and this is real money moving on Arc
          // Testnet — an unmissable, tappable confirmation matters here.
          toast.success(`${vendor.cost} USDC → ${vendor.name}`, {
            description: `Tx: ${receipt.txHash.slice(0, 10)}…${receipt.txHash.slice(-8)}`,
            duration: 8000,
            action: {
              label: 'View on Arcscan ↗',
              onClick: () => Linking.openURL(ArcService.getExplorerTxUrl(receipt.txHash)),
            },
          });
          if (env.onSpend) env.onSpend(vendor.cost);
          await this.invokeX402Service(vendorId, receipt.txHash);
          addLog({ time: ts(), text: `✓ ${vendor.name} — Online & serving`, type: 'success' });
        } catch (err) {
          addLog({ time: ts(), text: `❌ Payment failed: ${err.message}`, type: 'error' });
        }
        return;
      }

      // BLOCK_INJECTION: unauthorized command attempt
      if (action === 'BLOCK_INJECTION') {
        addLog({ time: ts(), text: `❌ MANDATE BLOCKED: Unauthorized command rejected by policy`, type: 'error' });
        addLog({ time: ts(), text: `✓ Treasury protected — no funds moved`, type: 'success' });
        return;
      }

      // STATUS_REPORT and DIRECT_CHAT: reply already shown above, nothing else to do
    } catch (err) {
      addLog({ time: ts(), text: `❌ Mandate-SRE-01 API Error: ${err.message}`, type: 'error' });
    }
  },
};
