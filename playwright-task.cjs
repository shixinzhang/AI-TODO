const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // 导航到应用
    console.log('正在打开应用...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 等待输入框出现
    console.log('等待输入框加载...');
    const input = page.locator('input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    
    // 输入任务名称
    console.log('输入任务名称：发布第三讲');
    await input.fill('发布第三讲');
    await page.waitForTimeout(500);
    
    // 点击添加按钮
    console.log('点击添加按钮...');
    const addButton = page.locator('button[type="submit"]').first();
    await addButton.click();
    
    // 等待任务添加完成
    console.log('等待任务添加完成...');
    await page.waitForTimeout(2000);
    
    // 等待任务出现在页面上
    await page.waitForSelector('text=发布第三讲', { timeout: 10000 });
    
    // 查找拆解按钮并点击
    console.log('查找拆解按钮...');
    const breakdownButton = page.locator('button:has-text("拆解")').first();
    await breakdownButton.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('点击拆解按钮...');
    await breakdownButton.click();
    
    // 等待拆解完成（等待"拆解中..."消失或子任务出现）
    console.log('等待拆解完成...');
    await page.waitForTimeout(5000);
    
    // 检查是否有子任务出现
    const subtasks = await page.locator('.task-item').count();
    console.log(`找到 ${subtasks} 个任务项`);
    
    // 等待一下让用户看到结果
    await page.waitForTimeout(3000);
    
    console.log('操作完成！');
    
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 不关闭浏览器，让用户查看结果
    // await browser.close();
    console.log('浏览器保持打开状态，您可以查看结果');
  }
})();

