const puppeteer = require('puppeteer');

(async () => {
  console.log('启动可视化浏览器...');
  const browser = await puppeteer.launch({
    headless: false, // 设为 false，直接打开可视化网页
    defaultViewport: null,
    args: ['--start-maximized'] // 最大化窗口
  });
  
  const page = await browser.newPage();
  console.log('正在访问 Outlook 登录页面...');
  await page.goto('https://login.live.com/', { waitUntil: 'networkidle2' });

  // 1. 输入邮箱
  console.log('输入账号...');
  await page.waitForSelector('input[type="email"]', { visible: true });
  await page.type('input[type="email"]', 'aogusidu99@outlook.com', { delay: 50 });
  await page.keyboard.press('Enter');

  console.log('检测登录方式页面...');
  await new Promise(r => setTimeout(r, 2000)); // 等待跳转

  // 尝试检测是否出现了"使用密码"的选项
  try {
    const passwordOption = await page.$('div[role="button"][data-bind*="usePassword"]'); // 或者尝试通用文本匹配
    
    if (!passwordOption) {
       // 如果选择器没找到，尝试通过文本内容查找 "使用密码"
       const elements = await page.$$('div');
       for (let el of elements) {
           const text = await page.evaluate(e => e.textContent, el);
           if (text && text.includes('使用密码') && text.length < 20) { // 简单限制长度避免匹配到大块文本
               console.log('找到"使用密码"选项，正在点击...');
               await el.click();
               break;
           }
       }
    } else {
       console.log('找到"使用密码"按钮，正在点击...');
       await passwordOption.click();
    }
    await new Promise(r => setTimeout(r, 1500)); // 等待密码输入框出现
  } catch (e) {
    console.log('未检测到登录方式选择页，或点击失败，直接尝试寻找密码框...');
  }

  // 2. 输入密码
  console.log('输入密码...');
  await page.waitForSelector('input[name="passwd"]', { visible: true });
  // 等待微软账号页面的切换动画完成
  await new Promise(r => setTimeout(r, 1500));
  await page.type('input[name="passwd"]', '1Wndcbd.', { delay: 50 });
  await page.keyboard.press('Enter');

  // 3. 处理 "是否保持登录状态" (Stay signed in)
  console.log('处理保持登录状态提示...');
  // 输入密码后会有多次网络重定向，增加基础等待时间
  await new Promise(r => setTimeout(r, 4000));

  try {
    // 放宽等待条件，寻找任何可能是按钮的元素，加长超时时间到 10 秒
    await page.waitForSelector('button, input[type="submit"], input[type="button"], input[id="idSIButton9"]', { visible: true, timeout: 10000 });
    
    // 扩大搜索范围，包含 button, input 和 role="button" 的 div
    const elements = await page.$$('button, input, div[role="button"]');
    let clicked = false;
    for (let el of elements) {
      const val = await page.evaluate(e => e.value || e.innerText || e.textContent, el);
      if (val && (val.trim() === '是' || val.trim() === 'Yes' || val.trim() === 'Accept')) {
        console.log('找到"是"按钮，正在点击...');
        await el.click();
        clicked = true;
        break;
      }
    }
    
    // Fallback：如果文字没匹配上，优先点击 id 为 idSIButton9 的元素（微软标准主按钮）
    if (!clicked) {
        console.log('尝试点击默认的主确认按钮...');
        const mainBtn = await page.$('#idSIButton9');
        if (mainBtn) {
            await mainBtn.click();
        } else {
            console.log('连默认按钮也没找到，跳过。');
        }
    }

  } catch (e) {
    console.log('没有出现保持登录提示，继续...');
  }

  console.log('✅ 登录操作已完成！您可以直接在弹出的浏览器中查看您的邮箱了。');
  // 注意：我们不调用 browser.close()，这样浏览器窗口会一直为您保留开启状态。
})();
