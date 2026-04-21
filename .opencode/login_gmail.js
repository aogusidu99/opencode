const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function loginGmail(email, password) {
  console.log('启动隐身可视化浏览器 (绕过Google机器人检测)...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  console.log('正在访问 Gmail 登录页面...');
  await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail', { waitUntil: 'networkidle2' });

  try {
    // 1. 输入邮箱
    console.log('输入账号...');
    await page.waitForSelector('input[type="email"]', { visible: true });
    await page.type('input[type="email"]', email, { delay: 100 });
    await page.keyboard.press('Enter');

    // 2. 检查是否有需要点击的“继续”按钮或二次验证
    console.log('等待密码框或额外步骤出现...');
    try {
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 8000 });
    } catch (e) {
        console.log('没立刻等到密码框，尝试检查页面是否卡在验证步骤...');
        // 尝试点击所有看起来像“下一步”或“继续”的按钮
        const buttons = await page.$$('button');
        for (let btn of buttons) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text && (text.includes('下一步') || text.includes('Next') || text.includes('继续') || text.includes('Continue'))) {
                console.log('点击下一步/继续...');
                await btn.click();
                await new Promise(r => setTimeout(r, 2000));
                break;
            }
        }
        // 再次等待密码框
        await page.waitForSelector('input[type="password"]', { visible: true, timeout: 10000 });
    }
    await new Promise(r => setTimeout(r, 1000)); // 额外等待动画完全结束
    
    console.log('输入密码...');
    await page.type('input[type="password"]', password, { delay: 100 });
    await page.keyboard.press('Enter');

    // 等待登录成功跳转到收件箱
    console.log('等待登录成功并进入收件箱...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    
    console.log('✅ Gmail 登录操作已执行完毕！');

  } catch (error) {
    console.error('登录过程中遇到问题：', error.message);
    console.log('可能是触发了 Google 的验证码或手机二次验证，请在浏览器中手动完成剩余步骤。');
  }
}

// 从命令行参数获取账号密码，如果没有则提示
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('请提供邮箱和密码作为参数运行。');
  process.exit(1);
}

loginGmail(email, password);
