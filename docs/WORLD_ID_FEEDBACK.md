# World ID Selfie Check & Developer Portal Feedback

**Project**: Mandate (Bounded Economic Authority for Autonomous AI Agents)  
**Track**: World — Selfie Check ($3,500 Prize Pool)  
**Registered App ID**: `app_11a0069f40eddb35899a9ec904f3e441`  
**Registered RP ID**: `rp_b741b56a51172a0d`  
**Target Action**: `mandate-operator-auth`  

---

## 1. Executive Summary & Use Case: Bounded AI Escalation

In **Mandate**, World ID Selfie Check acts as a load-bearing **Human Escalation Gate** for autonomous AI systems. 

When an AI agent is given a finite treasury ($1.00 USDC) to keep production infrastructure online, it can hire and fire vendors autonomously under strict policy bounds. However, when a catastrophic database incident requires $1.20 USDC and exceeds the agent's authorized budget, the agent cannot proceed alone. 

Instead of failing silently or risking unbounded spending, Mandate halts and triggers a **World ID verification** (`verification_level="device"` with document / device proof compatibility). A human operator completes verification to cryptographically sign off on the treasury amendment (+$1.00 USDC). Once the zero-knowledge proof payload (`nullifier_hash`, `merkle_root`, `proof`) is validated against World's verification API (`https://developer.world.org/api/v4/verify`), Mandate logs the verified human nullifier in encrypted local storage with anti-replay protection and unlocks autonomous recovery.

---

## 2. Developer Experience Feedback & Evaluation

### A. SelfieCheck Docs & Integration Flow (`docs.world.org`)
* **Strengths**:
  * The IDKit v4 documentation provides clear separation between `@worldcoin/idkit` React component usage and server-side verification endpoints.
  * The conceptual explanation of how zero-knowledge proofs protect user privacy while guaranteeing distinct human actions is best-in-class.
* **Areas for Improvement & Feedback**:
  * **Selfie Check API Differentiation**: In the developer docs, there is occasional ambiguity between the standard `device` verification level and the new `selfieCheckLegacy` preset. Clarifying in the quickstart table that `device` acts as the low-friction verification level for mobile testing before full Selfie Check sandbox access is granted would eliminate developer hesitation.
  * **Deep-Linking Schema for React Native**: While the web modal (`IDKitWidget`) is straightforward, React Native / Expo developers require explicit URI schemas (`worldapp://verify?action=...&app_id=...`) and expected callback parameters to build custom mobile trigger flows cleanly.

### B. Developer Portal Navigation, Search & Discovery (`developer.world.org`)
* **Strengths**:
  * Registering an App ID (`app_11a0069f40eddb35899a9ec904f3e441`) and setting up actions (`mandate-operator-auth`) took less than 3 minutes.
  * The portal's search functionality is fast, and the dashboard provides clear visibility into action verification volume.
* **Areas for Improvement & Feedback**:
  * **RP Key Management**: Generating and viewing Relaying Party (RP) keypairs for HMAC backend signatures would benefit from a built-in sandbox signature generator or interactive curl command generator directly in the portal.
  * **Access Request Flow for Beta Credentials**: The Google Form requirement for Selfie Check Sandbox access creates a friction barrier for 48-hour hackathons. Having an instant "Selfie Check Test Mode" switch inside the Developer Portal (similar to Stripe's test API keys) would dramatically increase adoption.

### C. Sandbox App States, Proof Flows & Edge Cases
* **Strengths**:
  * The World ID Sandbox App is invaluable for testing proof generation without requiring a physical Orb or device camera.
* **Edge Cases & Findings**:
  * **Anti-Replay / Nullifier Reuse**: In multi-step agent scenarios, an agent might attempt to verify twice with the same proof payload. We had to implement explicit nullifier tracking in our `SecurityService.isNullifierReused()` to store nullifier hashes and block double-spending or replay attacks.
  * **Network Resilience on Desktop**: When async hackathon judges evaluate web applications on desktop without the World App installed, the IDKit QR code flow can become a blocker. We implemented a dedicated fallback simulation button that creates a compliant sandbox device proof payload so evaluators can test the end-to-end escalation pipeline regardless of device state.

### D. What Was Confusing, Missing, Broken, or Hard to Test
* **What Was Confusing**:
  * The transition from IDKit v3 to v4 introduced changes in prop names (e.g., `verification_level` accepting `"device"` or `"orb"` vs presets). A migration table specifically addressing how to request Device/Selfie credentials vs Orb credentials would save hours of debugging.
* **What Was Hard to Test**:
  * Testing document-based vs device-based proofs during local development before receiving Sandbox whitelist confirmation. To overcome this, our backend normalizes both `device` and `document` proofs into the `World ID Device Proof (Selfie Check Equivalent)` tier.

---

## 3. Summary Recommendation

World ID provides the missing cryptographic link between autonomous AI agents and real human accountability. By anchoring budget escalations to World ID proofs, Mandate proves that AI agents can operate with bounded economic authority while keeping treasury control firmly in the hands of verified humans.
