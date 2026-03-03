const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    defaultViewport: { width: 1200, height: 1200 }
  });
  const page = await browser.newPage();

  console.log('Navigating to game...');
  await page.goto('http://localhost:5175', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));

  console.log('Using debug injection to force open the share modal...');
  await page.evaluate(() => {
    if (window.__DEBUG_SET_STATE__) {
      window.__DEBUG_SET_STATE__(0);
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  // Verify modal is open by checking for a debug button
  let isModalOpen = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="debug-btn-0"]');
  });

  if (!isModalOpen) {
    console.log('ERROR: MODAL STILL NOT OPEN');
    await browser.close();
    process.exit(1);
  }

  console.log('Modal is open, starting screenshots...');

  const dir = '/Users/coreychen/.gemini/antigravity/brain/ff957918-7a23-4c4c-abdd-fe65667e8f1d/';
  const labels = ['0_stars', '1_star', '2_stars', '3_stars', '4_stars', '5_stars', '5_stars_badges'];

  for (let i = 0; i <= 6; i++) {
    console.log(`Taking screenshot for state ${i}...`);
    
    // Click the physical debug button in the UI
    await page.evaluate((n) => {
      document.querySelector(`[data-testid="debug-btn-${n}"]`).click();
    }, i);
    
    await new Promise(r => setTimeout(r, 1500)); // wait for React to render and CSS to transition
    
    const buffer = await page.screenshot({ type: 'png' });
    const filepath = path.join(dir, `${labels[i]}_v8.png`);
    fs.writeFileSync(filepath, buffer);
    console.log(`Wrote ${filepath}`);
  }

  await browser.close();
  console.log('Done!');
})();
