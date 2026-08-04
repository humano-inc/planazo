// Regenerate the app icon, adaptive icon, splash lockup and favicon.
//
//   node scripts/build-brand-assets.mjs
//
// Source of truth: "Planazo Auth & Store Assets" 1b/1c. The mark is the letter P
// in Bricolage Grotesque 800, paper on ember — there is no illustration in
// Planazo, so nothing here is hand-drawn and everything is reproducible.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPng } from './render-html.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'apps/mobile/assets');
// Play listing art is uploaded to the console rather than bundled into the app,
// so it sits with the other store deliverables instead of in assets/.
const PLAY = join(ROOT, 'store-assets/play');

const EMBER = '#F2542D';
const PAPER = '#FCF8F4';
const INK = '#171215';

/**
 * Mark ratios measured off the design doc and constant at every size: the glyph
 * is 0.77 of the tile, tracked in by 0.038, and nudged down-right so the P sits
 * optically centred rather than metrically centred.
 */
function mark({ size, color = PAPER, ratio = 0.77 }) {
  return `<span style="
    font-family: 'Bricolage'; font-weight: 800;
    font-size: ${size * ratio}px; line-height: ${size * ratio}px;
    letter-spacing: ${size * -0.038}px; color: ${color};
    transform: translate(${size * 0.0156}px, ${size * 0.0234}px);
  ">P</span>`;
}

const centred = (extra = '') =>
  `display:flex; align-items:center; justify-content:center; overflow:hidden; ${extra}`;

const targets = [
  {
    name: 'iOS app icon (full-bleed square, the OS applies its own mask)',
    out: join(ASSETS, 'icon.png'),
    width: 1024,
    height: 1024,
    body: `<div style="${centred(`width:1024px; height:1024px; background:${EMBER};`)}">
      ${mark({ size: 1024 })}
    </div>`,
  },
  {
    // Android draws this over adaptiveIcon.backgroundColor and crops it to a
    // shape of the launcher's choosing, so the glyph is pulled well inside the
    // 66% safe circle rather than filling the tile like the iOS icon does.
    name: 'Android adaptive foreground (transparent, inside the safe circle)',
    out: join(ASSETS, 'adaptive-icon.png'),
    width: 1024,
    height: 1024,
    transparent: true,
    body: `<div style="${centred('width:1024px; height:1024px;')}">
      ${mark({ size: 1024, ratio: 0.606 })}
    </div>`,
  },
  {
    // resizeMode "contain" scales this to the screen, so the padding around the
    // lockup is what sets its final size — not a number in app.json.
    name: 'Splash lockup (transparent, sits on paper)',
    out: join(ASSETS, 'splash-icon.png'),
    width: 1024,
    height: 1024,
    transparent: true,
    body: `<div style="${centred('width:1024px; height:1024px; flex-direction:column; gap:70px;')}">
      <div style="${centred(
        `width:364px; height:364px; border-radius:119px; background:${EMBER};`,
      )}">${mark({ size: 364 })}</div>
      <span style="
        font-family: 'Bricolage'; font-weight: 800;
        font-size: 119px; line-height: 133px; letter-spacing: -2.5px; color: ${INK};
      ">Planazo</span>
    </div>`,
  },
  {
    // Android masks this to a silhouette and tints it with the plugin's colour,
    // so every non-transparent pixel comes out solid — a coloured source is why
    // an unconfigured app shows a white square in the status bar.
    name: 'Android notification icon (white on transparent, system-tinted)',
    out: join(ASSETS, 'notification-icon.png'),
    width: 96,
    height: 96,
    transparent: true,
    body: `<div style="${centred('width:96px; height:96px;')}">
      ${mark({ size: 96, color: '#FFFFFF', ratio: 0.606 })}
    </div>`,
  },
  {
    // Play takes the listing icon as its own upload rather than reading it out
    // of the bundle the way App Store Connect does, and it wants 512 square.
    name: 'Play listing icon (512², full-bleed)',
    out: join(PLAY, 'icon-512.png'),
    width: 512,
    height: 512,
    body: `<div style="${centred(`width:512px; height:512px; background:${EMBER};`)}">
      ${mark({ size: 512 })}
    </div>`,
  },
  {
    // Mandatory for a Play listing, with no App Store equivalent. Play crops the
    // edges on some surfaces, so the lockup stays centred and well inside them.
    name: 'Play feature graphic (1024 x 500)',
    out: join(PLAY, 'feature-graphic.png'),
    width: 1024,
    height: 500,
    body: `<div style="${centred(`width:1024px; height:500px; background:${EMBER}; gap:44px;`)}">
      <div style="${centred(
        `width:188px; height:188px; border-radius:61px; background:${PAPER}; flex:none;`,
      )}">${mark({ size: 188, color: EMBER })}</div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <span style="
          font-family: 'Bricolage'; font-weight: 800;
          font-size: 92px; line-height: 100px; letter-spacing: -2px; color: ${PAPER};
        ">Planazo</span>
        <span style="
          font-family: 'Instrument'; font-weight: 500;
          font-size: 30px; line-height: 38px; color: ${PAPER}; opacity: 0.82;
        ">Plans that actually happen</span>
      </div>
    </div>`,
  },
  {
    name: 'Web favicon',
    out: join(ASSETS, 'favicon.png'),
    width: 64,
    height: 64,
    transparent: true,
    body: `<div style="${centred(
      `width:64px; height:64px; border-radius:21px; background:${EMBER};`,
    )}">${mark({ size: 64 })}</div>`,
  },
];

for (const target of targets) {
  renderPng(target);
  console.log(`  ${target.out.replace(`${ROOT}/`, '')}  —  ${target.name}`);
}

console.log('\nDone. Icons are generated: edit this script, never the PNGs.');
