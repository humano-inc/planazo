import resolve, { needsWebBuild, owningPackage } from '../testing/jestResolver';

const ROOT = '/repo/node_modules/.pnpm';
const NATIVE = ['.ios.js', '.native.js', '.js', '.ios.ts', '.native.ts', '.ts'];
/** What the libraries' own rule leaves: `.native.*` goes, the platform stays. */
const WEB = ['.ios.js', '.js', '.ios.ts', '.ts'];

/** pnpm's real layout: peers ride along in the store directory's name. */
const EXPO_MODULES_CORE = `${ROOT}/expo-modules-core@58.0.30_react-native-worklets@0.13.0_react@19.3.0/node_modules/expo-modules-core/build`;
const REANIMATED = `${ROOT}/react-native-reanimated@4.7.1_react-native-worklets@0.13.0_react@19.3.0/node_modules/react-native-reanimated/src`;
const WORKLETS = `${ROOT}/react-native-worklets@0.13.0_react@19.3.0/node_modules/react-native-worklets/src`;
const APP = '/repo/apps/mobile/components/ui';

function options(basedir: string) {
  return { basedir, extensions: NATIVE, defaultResolver: jest.fn(() => '/resolved.js') };
}

describe('owningPackage', () => {
  it('is null for app code outside node_modules', () => {
    expect(owningPackage(APP)).toBeNull();
  });

  it('names the package a plain node_modules directory belongs to', () => {
    expect(owningPackage('/repo/node_modules/zustand/esm')).toBe('zustand');
  });

  it('keeps the scope of a scoped package', () => {
    expect(owningPackage('/repo/node_modules/@expo/vector-icons/build')).toBe('@expo/vector-icons');
  });

  it('reads past the pnpm store name, peers and all', () => {
    expect(owningPackage(EXPO_MODULES_CORE)).toBe('expo-modules-core');
    expect(owningPackage(REANIMATED)).toBe('react-native-reanimated');
  });

  it('uses the innermost node_modules when packages nest', () => {
    expect(owningPackage('/repo/node_modules/a/node_modules/b/lib')).toBe('b');
  });

  it('is null for a bare node_modules directory', () => {
    expect(owningPackage('/repo/node_modules/')).toBeNull();
  });
});

describe('needsWebBuild', () => {
  it('sends a request for Worklets to its JS build, from anywhere', () => {
    expect(needsWebBuild('react-native-worklets', options(APP))).toBe(true);
    expect(needsWebBuild('react-native-worklets/src/mock', options(EXPO_MODULES_CORE))).toBe(true);
  });

  it('sends everything Worklets requires to the JS build', () => {
    expect(needsWebBuild('./WorkletsModule/NativeWorklets', options(WORKLETS))).toBe(true);
  });

  it('leaves expo-modules-core native although its store name mentions Worklets', () => {
    expect(needsWebBuild('./NativeViewManagerAdapter', options(EXPO_MODULES_CORE))).toBe(false);
  });

  it("sends Reanimated's web-only modules to their web builds", () => {
    expect(needsWebBuild('./initializers', options(REANIMATED))).toBe(true);
    expect(needsWebBuild('../animation/util', options(`${REANIMATED}/hook`))).toBe(true);
  });

  it('leaves the rest of Reanimated native although its store name mentions Worklets', () => {
    expect(needsWebBuild('./ReanimatedModule', options(REANIMATED))).toBe(false);
    expect(needsWebBuild('react-native', options(REANIMATED))).toBe(false);
  });

  it('leaves Reanimated itself native when the app imports it', () => {
    expect(needsWebBuild('react-native-reanimated', options(APP))).toBe(false);
  });

  it("leaves a module named like a web-only one alone outside Reanimated", () => {
    expect(needsWebBuild('./initializers', options(EXPO_MODULES_CORE))).toBe(false);
    expect(needsWebBuild('./util', options(APP))).toBe(false);
  });
});

describe('resolve', () => {
  it('drops the native extensions when a web build is needed', () => {
    const opts = options(REANIMATED);
    expect(resolve('./initializers', opts)).toBe('/resolved.js');
    expect(opts.defaultResolver).toHaveBeenCalledWith(
      './initializers',
      expect.objectContaining({ basedir: REANIMATED, extensions: WEB })
    );
  });

  it('passes every other request through untouched', () => {
    const opts = options(EXPO_MODULES_CORE);
    resolve('./NativeViewManagerAdapter', opts);
    expect(opts.defaultResolver).toHaveBeenCalledWith('./NativeViewManagerAdapter', opts);
  });

  it('tolerates a resolver call that carries no extensions', () => {
    const opts = { basedir: WORKLETS, defaultResolver: jest.fn(() => '/resolved.js') };
    resolve('./index', opts);
    expect(opts.defaultResolver).toHaveBeenCalledWith(
      './index',
      expect.objectContaining({ extensions: undefined })
    );
  });
});
