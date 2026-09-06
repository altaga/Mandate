const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Required: Metro does not serve .wasm by default; IDKit needs it.
config.resolver.assetExts.push('wasm');

module.exports = config;
