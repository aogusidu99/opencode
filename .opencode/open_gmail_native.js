const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function openExistingChrome() {
  console.log('正在接管您现有的 Chrome 浏览器配置...');
  
  // 指向 Windows 默认的 Chrome 用户数据目录
  const userDataDir = 'C:\\Users\\aogus\\AppData\\Local\\Google\\Chrome\\User Data';
  
  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized'],
      // 核心配置：使用您日常的 Chrome 数据（包括书签、密码、登录状态）
      userDataDir: userDataDir,
      // 使用系统中安装的真实 Chrome，而不是 Puppeteer 自带的无内核浏览器
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    
    const page = await browser.newPage();
    console.log('打开 Gmail...');
    await page.goto('https://mail.google.com/', { waitUntil: 'networkidle2' });
    
    console.log('✅ 已经使用您的本地身份打开了 Gmail！');
    // 不关闭浏览器
  } catch (error) {
    console.error('无法启动浏览器！');
    console.error('可能原因：您的 Chrome 浏览器目前正处于打开状态。');
    console.error('提示：Puppeteer 无法接管一个已经在运行中的 Chrome。请先彻底关闭所有打开的 Chrome 窗口，然后再试一次。');
    console.error('详细错误：', error.message);
  }
}

openExistingChrome();
