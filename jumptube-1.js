const { firefox } = require('playwright');
const path = require('path');

(async () => {
  const profilePath = path.resolve(__dirname, 'firefox-profile-1');

  const context = await firefox.launchPersistentContext(profilePath, {
    headless: false,
    viewport: null
  });

  const jumptaskPage = await context.newPage();
  await jumptaskPage.goto('https://app.jumptask.io/earn?tags%5B%5D=Watch+%26+Profit#all_tasks', { waitUntil: 'load' });
  console.log('Page opened successfully using native Firefox viewport!');

  const containerSelector = 'div.MuiStack-root.css-dvxtzn > div.MuiGrid2-root.MuiGrid2-container.MuiGrid2-direction-xs-row.MuiGrid2-grid-xs-grow.css-hvx45w';
  await jumptaskPage.waitForSelector(containerSelector);
  const container = jumptaskPage.locator(containerSelector);
  const childDivSelector = 'div.MuiGrid2-root.MuiGrid2-direction-xs-row.MuiGrid2-grid-xs-12.MuiGrid2-grid-md-6.css-tnatjl';
  const childDivs = container.locator(childDivSelector);

  const count = await childDivs.count();
  console.log(`Found ${count} matching div(s) inside the container.`);
  if (count === 0) {
    console.log('No containers found, exiting successfully.');
    await context.close();
    return;
  }

  let checkboxClicked = false; // Track checkbox click only on first run

  // Loop over containers
  for (let index = 0; index < count; index++) {
    try {
      await childDivs.nth(index).click();
      console.log(`Clicked container #${index + 1}`);

      const boxDiv = jumptaskPage.locator('div.MuiBox-root.css-jl6j1q');
      await boxDiv.waitFor({ state: 'visible', timeout: 5000 });

      // Step 1: Find quoted phrase
      const liElements = boxDiv.locator('li');
      let phrase = null;
      for (let i = 0; i < await liElements.count(); i++) {
        const text = await liElements.nth(i).innerText();
        const match = text.match(/"([^"]+)"/);
        if (match) { phrase = match[1]; break; }
      }
      if (!phrase) { console.log('No quoted phrase found. Skipping container.'); continue; }

      // Step 1a: Check and click checkbox on first run
      if (!checkboxClicked) {
        const checkbox = jumptaskPage.locator('input.PrivateSwitchBase-input.css-j8yymo');
        if (await checkbox.count() > 0) {
          try { await checkbox.check(); checkboxClicked = true; console.log('Checkbox clicked on first run'); } 
          catch (err) { console.log('Checkbox exists but could not be clicked:', err); }
        }
      }

      // Step 1b: Check for challenge input field
      const challengeInput = jumptaskPage.locator('input[data-testid="challenge-input"]');
      const challengeExists = await challengeInput.count() > 0;

      // Step 2: Start Task
      const startButton = jumptaskPage.locator('p.MuiTypography-root.MuiTypography-body1.css-9a5dms', { hasText: 'Start Task' });
      await startButton.click();

      // Step 3: Open YouTube and search
      let youtubePage;
      try {
        [youtubePage] = await Promise.all([context.waitForEvent('page')]);
        await youtubePage.waitForLoadState('domcontentloaded');
        if (!youtubePage.url().includes('youtube.com')) { await youtubePage.close(); continue; }

        const searchInput = youtubePage.locator('input.ytSearchboxComponentInput.yt-searchbox-input.title[name="search_query"]');
        await searchInput.waitFor({ state: 'visible', timeout: 15000 });
        await searchInput.fill(phrase);
        await searchInput.press('Enter');
        console.log(`Searched "${phrase}"`);
        await youtubePage.waitForTimeout(5000);
      } catch (err) {
        console.log('Error opening YouTube:', err);
        if (youtubePage) await youtubePage.close();
        continue;
      }

      // Step 4: Loop through videos (simplified for brevity)
      try {
        const videoItems = youtubePage.locator('ytd-video-renderer');
        const maxVideosToCheck = Math.min(await videoItems.count(), 5);
        for (let i = 0; i < maxVideosToCheck; i++) {
          try {
            await videoItems.nth(i).locator('a#thumbnail').click();
            await youtubePage.waitForTimeout(5000);
            const descriptionDiv = youtubePage.locator('div#description');
            await descriptionDiv.waitFor({ state: 'visible', timeout: 8000 });
            await youtubePage.goBack();
          } catch (err) { console.log(`Error processing video #${i + 1}:`, err); }
        }
      } catch (err) { console.log('Video processing failed:', err); }

      try { await youtubePage.close(); } catch {}

      // Step 5: Dismiss pop-ups
      const closeButtons = boxDiv.locator('button[aria-label="Close"]');
      for (let i = 0; i < await closeButtons.count(); i++) {
        if (await closeButtons.nth(i).isVisible()) { await closeButtons.nth(i).click(); break; }
      }

    } catch (err) {
      console.log(`Error processing container #${index + 1}:`, err);
      // Continue to next container without stopping script
    }

    await jumptaskPage.waitForTimeout(1000);
  }

  console.log('All containers processed, exiting successfully.');
  await context.close();
})();
