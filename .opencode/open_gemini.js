const puppeteer = require('puppeteer');
const { exec } = require('child_process');

async function openGemini() {
  let wsUrl = '';
  
  // 1. 尝试获取现有原生浏览器的 WebSocket URL
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    wsUrl = data.webSocketDebuggerUrl;
    console.log('找到已经运行的原生 Chrome 窗口...');
  } catch (e) {
    // 2. 如果没找到，说明窗口被关了，重新拉起
    console.log('未检测到运行中的 Chrome，正在重新拉起带有持久化配置的原生浏览器...');
    exec('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\\Code\\opencode\\.opencode\\chrome_data"');
    
    await new Promise(r => setTimeout(r, 3000));
    try {
      const response = await fetch('http://127.0.0.1:9222/json/version');
      const data = await response.json();
      wsUrl = data.webSocketDebuggerUrl;
    } catch (err) {
      console.error('无法启动或连接到原生浏览器。');
      return;
    }
  }

  try {
    console.log('接管浏览器控制权...');
    const browser = await puppeteer.connect({ 
      browserWSEndpoint: wsUrl,
      defaultViewport: null 
    });
    
    // 我们在这里新开一个标签页 (Tab)，以免覆盖您刚才的 Gmail 页面
    console.log('新建标签页...');
    const page = await browser.newPage();
    
    console.log('导航至 Gemini (https://gemini.google.com/)...');
    await page.goto('https://gemini.google.com/', { waitUntil: 'networkidle2' });
    
    console.log('✅ 成功打开 Gemini！由于浏览器共享了您的持久化登录状态，您现在应该已经处于直接可用状态。');

    // 释放控制权
    browser.disconnect();
  } catch (err) {
    console.error('自动化操作执行失败:', err.message);
  }
}

openGemini();
