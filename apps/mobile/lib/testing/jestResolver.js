/**
 * The ui project's Jest resolver: Reanimated's and Worklets' Jest rules, keyed
 * on the package that asks rather than on a substring of its path (PLA-141).
 *
 * Reanimated 4.6+ splits a dozen modules (its initializer among them) into
 * native and web builds, and under Jest it needs the web ones: the native
 * initializer throws "`setCSSEventHandler` is not available in JSReanimated"
 * the moment anything imports Reanimated. Worklets likewise needs its JS build.
 * Both ship a Jest resolver for this (`react-native-reanimated/jest/resolver`,
 * which calls Worklets' own).
 *
 * Used as they are, those resolvers break under pnpm. They search the
 * requesting directory's path for their package name, and pnpm writes peers
 * into directory names: expo-modules-core lives at
 * `.pnpm/expo-modules-core@58…_react-native-worklets@0.13.0…/node_modules/
 * expo-modules-core`, and Reanimated's own directory names Worklets the same
 * way. The search then strips the native build from expo-modules-core (every
 * native view, expo-symbols first, throws on import) and from all of
 * Reanimated (which then asks for react-native-web).
 *
 * So the rules are applied here by owning package. Worklets' rule is one line
 * and is restated. Reanimated's list of web-only modules changes between
 * releases, so it is asked of Reanimated's resolver rather than copied.
 *
 * Plain CommonJS because Jest loads a resolver with `require`, untransformed.
 */
const reanimatedResolver = require('react-native-reanimated/jest/resolver');

const REANIMATED = 'react-native-reanimated';
const WORKLETS = 'react-native-worklets';
const NODE_MODULES = '/node_modules/';

/** The package named at the start of a bare specifier or a path tail. */
function packageName(specifier) {
  const [first, second] = specifier.split('/');
  if (!first || first.startsWith('.')) return null;
  if (first.startsWith('@')) return second ? `${first}/${second}` : null;
  return first;
}

/**
 * The package a directory belongs to: the one after the last `node_modules/`,
 * so pnpm's `.pnpm/<name>@<peers>/` prefix never counts. Null outside
 * node_modules, which is app code.
 */
function owningPackage(dir) {
  const at = dir.lastIndexOf(NODE_MODULES);
  if (at === -1) return null;
  return packageName(dir.slice(at + NODE_MODULES.length));
}

/**
 * Whether Reanimated's resolver sends this request to its web build. Asked
 * with a stand-in directory that names Reanimated and nothing else, so the
 * answer depends on the request alone and never on pnpm's peer suffixes.
 */
function reanimatedWantsWeb(request, options) {
  let wantsWeb = false;
  reanimatedResolver(request, {
    ...options,
    basedir: `${NODE_MODULES}${REANIMATED}`,
    defaultResolver: (_request, asked) => {
      wantsWeb = asked.extensions?.length !== options.extensions?.length;
      return '';
    },
  });
  return wantsWeb;
}

/** True when this request has to resolve to a web or JS build. */
function needsWebBuild(request, options) {
  const owner = owningPackage(options.basedir);
  if (owner === WORKLETS || packageName(request) === WORKLETS) return true;
  return owner === REANIMATED && reanimatedWantsWeb(request, options);
}

function withoutNativeExtensions(options) {
  return {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes('native')),
  };
}

function resolve(request, options) {
  const target = needsWebBuild(request, options) ? withoutNativeExtensions(options) : options;
  return options.defaultResolver(request, target);
}

module.exports = resolve;
module.exports.owningPackage = owningPackage;
module.exports.needsWebBuild = needsWebBuild;
