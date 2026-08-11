import { feedbackSheetOpen } from '../feedbackState';

/**
 * There is no logic here to test, and a test asserting `false === false` would
 * be one. What this module actually promises is that every importer holds the
 * *same* holder: the screenshot listener has to see the flag the sheet set, or
 * it stacks a second sheet on top of the one being screenshotted.
 */
describe('feedbackSheetOpen', () => {
  afterEach(() => {
    feedbackSheetOpen.current = false;
  });

  it('starts closed', () => {
    expect(feedbackSheetOpen.current).toBe(false);
  });

  it('is one shared holder, so a write is visible to every other importer', () => {
    feedbackSheetOpen.current = true;

    // `require` rather than dynamic `import`, which needs --experimental-vm-modules.
    // Either way the point is the module registry: a second importer gets the
    // same object, not a fresh one.
    const seenElsewhere = require('../feedbackState') as typeof import('../feedbackState');
    expect(seenElsewhere.feedbackSheetOpen.current).toBe(true);
    expect(seenElsewhere.feedbackSheetOpen).toBe(feedbackSheetOpen);
  });
});
