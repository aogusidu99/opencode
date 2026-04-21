const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function startStackOverflowLogin() {
  console.log('启动第三方授权绕过方案...');
  
  const userDataDir = 'D:\\Code\\opencode\\.opencode\\chrome_data';
  
  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
      ],
      userDataDir: userDataDir,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    
    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} }; // 伪造 Chrome 特征
    });

    console.log('正在访问 StackOverflow (通过第三方进行 Google 登录)...');
    // 我们不直接访问 accounts.google.com，而是访问第三方网站
    await page.goto('https://stackoverflow.com/users/login', { waitUntil: 'networkidle2' });
    
    console.log('请在打开的 StackOverflow 页面中，点击 "Log in with Google" 进行登录！');
    console.log('登录完成后，您就可以直接打开 Gmail (mail.google.com) 了，且以后都不用再登录！');

  } catch (error) {
    console.error('启动浏览器失败：', error.message);
  }
}

startStackOverflowLogin();
