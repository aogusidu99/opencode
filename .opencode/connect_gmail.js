const puppeteer = require('puppeteer');

async function connectAndLogin() {
  try {
    // 获取原生浏览器的 WebSocket 连接地址
    console.log('正在寻找已开启的原生 Chrome 窗口 (端口 9222)...');
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    const wsUrl = data.webSocketDebuggerUrl;
    
    console.log('成功找到浏览器内核！正在接管控制权...');
    // 接管浏览器
    const browser = await puppeteer.connect({ 
      browserWSEndpoint: wsUrl,
      defaultViewport: null 
    });
    
    // 获取当前活动标签页
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    console.log('导航至 Gmail 登录页...');
    await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', { waitUntil: 'networkidle2' });
    
    // 尝试执行自动化登录操作
    try {
      const emailInput = await page.$('input[type="email"]');
      if (emailInput) {
         console.log('发现账号输入框，开始自动输入账号...');
         await page.type('input[type="email"]', 'aogusidu99@gmail.com', { delay: 50 });
         await page.keyboard.press('Enter');
         
         console.log('等待密码框出现...');
         await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
         await new Promise(r => setTimeout(r, 1000)); // 等待过渡动画
         
         console.log('输入密码...');
         await page.type('input[type="password"]', '1Wndcbd.', { delay: 50 });
         await page.keyboard.press('Enter');
         
         console.log('✅ 账号密码提交完成！请在浏览器中确认是否成功进入邮箱。');
      } else {
         console.log('✅ 未检测到邮箱输入框，这通常意味着您已经处于登录状态，或者页面跳转到了收件箱！');
      }
    } catch (e) {
      console.log('⚠️ 自动化输入环节遇到异常或被风控阻断:', e.message);
    }
    
    // 断开连接，把浏览器还给用户
    browser.disconnect();
  } catch (err) {
    console.error('❌ 连接失败。请确保您没有关掉刚才那个原生 Chrome 窗口！错误:', err.message);
  }
}

connectAndLogin();
