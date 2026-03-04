// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field resolution so libraries like
// @tanstack/react-query resolve correctly without fallback warnings.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
