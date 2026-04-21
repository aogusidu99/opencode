const puppeteer = require('puppeteer');
const { exec } = require('child_process');

async function autoLoginGmail() {
  let wsUrl = '';
  
  // 1. 尝试获取现有原生浏览器的 WebSocket URL
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    wsUrl = data.webSocketDebuggerUrl;
    console.log('找到已经运行的原生 Chrome 窗口...');
  } catch (e) {
    // 2. 如果没找到，说明窗口被关了，我们再次用原生命令拉起它
    console.log('未检测到运行中的 Chrome，正在重新拉起带有持久化配置的原生浏览器...');
    exec('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\\Code\\opencode\\.opencode\\chrome_data"');
    
    // 等待浏览器启动并开启调试端口
    await new Promise(r => setTimeout(r, 3000));
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      const data = await response.json();
      wsUrl = data.webSocketDebuggerUrl;
    } catch (err) {
      console.error('无法启动或连接到原生浏览器，请确保之前没有残留的隐藏进程。');
      return;
    }
  }

  try {
    console.log('接管浏览器控制权...');
    const browser = await puppeteer.connect({ 
      browserWSEndpoint: wsUrl,
      defaultViewport: null 
    });
    
    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    
    console.log('打开 Gmail...');
    await page.goto('https://mail.google.com/', { waitUntil: 'networkidle2' });
    
    // 检查当前的 URL 或者页面元素，判断是否需要重新输入密码
    const currentUrl = page.url();
    if (currentUrl.includes('signin') || currentUrl.includes('ServiceLogin')) {
        console.log('检测到处于未登录状态，开始自动化登录流程...');
        
        // 尝试输入账号
        const emailInput = await page.$('input[type="email"]');
        if (emailInput) {
            console.log('输入账号...');
            await page.type('input[type="email"]', 'aogusidu99@gmail.com', { delay: 50 });
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 2000)); // 等待跳转
        }
        
        // 尝试输入密码
        try {
            console.log('等待密码框出现...');
            await page.waitForSelector('input[type="password"]', { visible: true, timeout: 5000 });
            await page.type('input[type="password"]', '1Wndcbd.', { delay: 50 });
            await page.keyboard.press('Enter');
            console.log('✅ 密码提交完成！');
        } catch (pwdErr) {
            console.log('没有出现密码框，可能是因为遇到了图形验证码或其他安全拦截。');
        }
    } else {
        console.log('✅ 成功进入 Gmail！');
        console.log('状态：您已经处于免密登录状态，因为之前的凭证已经成功持久化保存了。');
    }

    // 释放控制权，但不关闭浏览器
    browser.disconnect();
  } catch (err) {
    console.error('自动化操作执行失败:', err.message);
  }
}

autoLoginGmail();
