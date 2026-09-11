const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// Expo SDK 52+ turns this on by default. ethers v6 (via @noble/hashes,
// @noble/curves) ships a package.json "exports" map with node/browser/
// react-native conditions, and Metro's exports resolver picks the wrong one
// for some of their internal submodule imports in this project's config —
// symptom: "Requiring unknown module '<number>'" the first time a code path
// that touches ethers.Wallet.createRandom() runs (reported after a real
// World ID success in EnrollmentScreen.js's handleEnroll; the warning
// "Attempted to import ... @noble/hashes/crypto.js which is not listed in
// the exports" shows up right before it). Every other ethers usage in this
// app (JsonRpcProvider, Wallet-from-private-key, Contract calls — all of
// payments/treasury/chat) works fine, so this isn't a general ethers
// breakage, just this one resolution path. Falling back to Metro's
// traditional main/browser-field resolution is the standard fix for this
// exact class of issue.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
