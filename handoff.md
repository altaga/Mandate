# Agent Handoff Document

## 1. What We Accomplished
- **Landing Page Redesign (`app/src/app/index.js`)**: Updated the main landing page to feature a premium, Swiss-style typography layout with clear, explicit step-by-step instructions ("HOW TO USE MANDATE"). We fixed Flexbox layout bugs where the `actionPointer` text ("<- JUMP STRAIGHT TO DEMO") would wrap incorrectly and get misaligned. We ultimately anchored the buttons to a fixed width of `340px` so they are completely symmetrical and the pointers stay firmly to their right.
- **Standby Catalog UI Fix (`demo-chat.js`)**: Restored the `STANDBY` badge and styling for the standby vendors catalog that was accidentally deleted or commented out previously.
- **World ID Integration (WASM Patch)**: We encountered the `Failed to construct 'URL': Invalid base URL` error silently breaking the IDKit widget (showing "Something went wrong"). This happened because `npm i --legacy-peer-deps` overrode the patched `idkit-core` without running `postinstall`. We manually patched `app/node_modules/@worldcoin/idkit-core/dist/index.js` to point `new URL("/idkit_wasm_bg.wasm", window.location.origin)` and cleared the Metro cache.

## 2. Where We Left Off
- All UI and config changes have been successfully committed and pushed to the `main` branch.
- The user tested the World ID verification on the `Add User` screen, and the verification via the Simulator Sandbox succeeded ("Face Capture & World ID Complete").

## 3. The New Error (Next Steps)
- Immediately after the successful World ID verification, the Expo app threw an error modal: **`Enrollment Error: Requiring unknown module "3243".`**
- **Clues for the next agent:**
  - This is a Metro bundler error indicating a missing or unresolved module dynamically required at runtime after the World ID callback.
  - It might be related to the `ethers` library or `@noble/hashes` trying to load native `crypto` modules in the React Native environment, as seen by these recurring warnings in the server logs:
    > `WARN  Attempted to import the module ... @noble\hashes\crypto.js which is not listed in the "exports" ...`
  - Another possibility is that the `face-api.js` or `ethers` polyfills (`react-native-get-random-values`, etc.) are failing to resolve in the specific callback path when signing the wallet payload or enrolling the user on-chain.
  - **Immediate next action:** Inspect `EnrollmentScreen.js` (specifically the `handleVerify` or `onSuccess` function callbacks from World ID) to identify what cryptography or wallet generation functions are called right after the green checkmark appears, and ensure all polyfills (e.g. `import 'react-native-get-random-values';`) are correctly imported before `ethers` is used.
