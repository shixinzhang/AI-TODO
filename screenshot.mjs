import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3000');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'todo-list-screenshot.png', fullPage: true });
await browser.close();
console.log('截图已保存到 todo-list-screenshot.png');
