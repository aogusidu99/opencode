const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function startPersistentChrome() {
  console.log('启动带有持久化存储的可视化浏览器...');
  
  // 使用刚刚创建的本地文件夹作为持久化的 User Data 目录
  const userDataDir = 'D:\\Code\\opencode\\.opencode\\chrome_data';
  
  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"], // 移除上方的 "正受到自动测试软件控制" 提示
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled', // 核心绕过参数
        '--disable-infobars',
      ],
      userDataDir: userDataDir,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    
    const page = await browser.newPage();
    
    // 注入更深层的绕过代码
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    console.log('打开 Gmail 登录页...');
    await page.goto('https://mail.google.com/', { waitUntil: 'networkidle2' });
    
    console.log('\n=========================================');
    console.log('✅ 浏览器已启动！');
    console.log('⚠️ 第一次运行需要您手动登录一下您的 Google 账号。');
    console.log('⚠️ 登录完成后，这个浏览器会把所有的 Cookie 和登录状态保存在 chrome_data 文件夹中。');
    console.log('⚠️ 下次再启动时，它就会直接进邮箱，不用再登录了！');
    console.log('=========================================\n');
    
  } catch (error) {
    console.error('启动浏览器失败：', error.message);
  }
}

startPersistentChrome();
