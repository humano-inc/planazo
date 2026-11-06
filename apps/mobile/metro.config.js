// Gives every bundle a debug ID the app can read at runtime. Sentry matches an
// update's source maps by that ID alone, so without this config a crash in an
// update has unreadable frames.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro loads this file as CommonJS.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
