#!/usr/bin/env node
/**
 * Inline a walkthrough page's screenshots so it can be published as an artifact.
 *
 * The artifact CSP blocks every external host, so an <img src="file.png"> in a
 * published page renders as a broken icon with no error anyone will see. Every
 * screenshot has to travel inside the HTML as a data URI, which is what this
 * does: each `__IMG:name__` token becomes the base64 of `shots/name.png`,
 * downscaled first so a seven-shot page stays under a megabyte.
 *
 *   cp scripts/walkthrough/template.html /tmp/pla-61.html
 *   # edit the copy, drop the PNGs in /tmp/shots/
 *   pnpm walkthrough /tmp/pla-61.html
 *   # → /tmp/pla-61.built.html, ready for the Artifact tool
 *
 * See AGENTS.md, "Every PR ends with a walkthrough artifact".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Screenshots arrive 1206px wide (a 3x iPhone 16 Pro grab) and render about a
 * third of that in the page's grid, so the extra pixels are pure page weight.
 */
const MAX_WIDTH = 700;

/** The artifact host's own ceiling is 16MB, counting the base64 expansion. */
const MAX_BYTES = 15 * 1024 * 1024;

const TOKEN = /__IMG:([a-zA-Z0-9_-]+)__/g;

function die(message) {
  console.error(`walkthrough: ${message}`);
  process.exit(1);
}

/**
 * A copy of the shot scaled to MAX_WIDTH, or the original when `sips` is not
 * there. Losing the resize costs page weight, never the build.
 */
function scaled(source, workDir) {
  const out = join(workDir, `${Buffer.from(source).toString('base64url')}.png`);
  try {
    execFileSync('sips', ['-Z', String(MAX_WIDTH), source, '--out', out], {
      stdio: 'ignore',
    });
    return out;
  } catch {
    return source;
  }
}

function main() {
  const [pagePath, outPath] = process.argv.slice(2);
  if (!pagePath) {
    die('usage: pnpm walkthrough <page.html> [out.html]');
  }

  const page = resolve(pagePath);
  if (!existsSync(page)) die(`no such page: ${page}`);

  const shotsDir = join(dirname(page), 'shots');
  const target = resolve(outPath ?? page.replace(/\.html$/, '') + '.built.html');
  if (target === page) die('the output would overwrite the source page; pass a second path');

  const workDir = mkdtempSync(join(tmpdir(), 'walkthrough-'));
  const html = readFileSync(page, 'utf8');
  const missing = [];
  let inlined = 0;

  const built = html.replace(TOKEN, (_match, name) => {
    const source = join(shotsDir, `${name}.png`);
    if (!existsSync(source)) {
      missing.push(source);
      return '';
    }
    inlined += 1;
    const bytes = readFileSync(scaled(source, workDir));
    return `data:image/png;base64,${bytes.toString('base64')}`;
  });

  if (missing.length > 0) {
    die(
      `missing screenshot${missing.length === 1 ? '' : 's'}:\n  ${missing.join('\n  ')}\n` +
        `Shoot them into ${shotsDir}, named to match each __IMG:name__ token.`
    );
  }
  if (inlined === 0) {
    die(`no __IMG:name__ tokens in ${page}. Did you edit the template's <img src> values?`);
  }

  const size = Buffer.byteLength(built);
  if (size > MAX_BYTES) {
    die(
      `${(size / 1024 / 1024).toFixed(1)}MB is over the artifact ceiling. ` +
        'Drop a screenshot or crop the tall ones.'
    );
  }

  writeFileSync(target, built);
  console.log(`${target}\n${inlined} screenshots · ${(size / 1024).toFixed(0)} KB`);
}

main();
