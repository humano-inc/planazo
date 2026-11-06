// The fingerprint is the runtime version, and an update only reaches a binary
// with the same one. A non-native edit that changes it cuts every installed app
// off from updates until the next store build, so those edits stay out of it.
//
// These are names, not `SourceSkips` values: `@expo/fingerprint` does not resolve
// from this package, and a config that fails to load is ignored without a word.
// The list replaces the default preset, so it repeats the entries to keep.
//
// Changing this list changes the fingerprint, which has the same effect as a
// native change: installed apps stop receiving updates until the next store build.
//
// `platforms` in app.json guards the same thing. Left out, Expo infers it from
// whether `react-dom` resolves, and pnpm's bin shims make it resolve through
// NODE_PATH. The same code then had one fingerprint in a local build and another
// from `eas update`, so the update never reached the build.
module.exports = {
  sourceSkips: [
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'PackageJsonScriptsAll',
    'GitIgnore',
  ],
};
