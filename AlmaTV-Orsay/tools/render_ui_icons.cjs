/* Iconos originales locales: dos tonos en PNG para Samsung Orsay. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const shapes = {
  media: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4z"/>',
  saver: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-6 4 4 3-5 5 7"/>',
  network: '<path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r="1"/>',
  browser: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>'
};
(async () => {
 const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
 for (const [name, drawing] of Object.entries(shapes)) {
  const page = await browser.newPage({viewport:{width:48,height:24},deviceScaleFactor:1});
  const svg = color => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</svg>';
  await page.setContent('<style>body{margin:0;display:flex;background:transparent}</style>'+svg('#ffffff')+svg('#193d48'));
  await page.screenshot({path:path.resolve(__dirname,'../app/assets/icons',name+'.png'),omitBackground:true});
  await page.close();
 }
 await browser.close();
})();
