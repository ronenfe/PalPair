const puppeteer = require('puppeteer');

const BOT_COUNT = 5;
let browser = null;
const botPages = [];

async function startBots() {
  console.log(`Launching ${BOT_COUNT} AI bots with video streams...`);
  
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-background-networking'
    ]
  });
  
  for (let i = 1; i <= BOT_COUNT; i++) {
    const page = await browser.newPage();
    
    // Enable console logs from the bot page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Bot-')) {
        console.log(text);
      }
    });
    
    // Navigate to bot page
    await page.goto(`http://localhost:3000/bot.html?id=${i}`);
    botPages.push(page);
    
    // Small delay between bot launches
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`All ${BOT_COUNT} bots launched successfully`);
}

// Start bots
startBots().catch(err => {
  console.error('Failed to start bots:', err);
  process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down bots...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
