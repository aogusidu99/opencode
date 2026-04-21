const puppeteer = require('puppeteer');
const { exec } = require('child_process');

async function loginQQMail() {
  let wsUrl = '';
  
  // 1. 获取现有原生浏览器的 WebSocket URL
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    wsUrl = data.webSocketDebuggerUrl;
    console.log('找到已经运行的原生 Chrome 窗口...');
  } catch (e) {
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
    
    console.log('新建标签页...');
    const page = await browser.newPage();
    
    console.log('导航至 QQ 邮箱 (mail.qq.com)...');
    await page.goto('https://mail.qq.com/', { waitUntil: 'networkidle2' });
    
    // QQ邮箱有多种页面结构，我们先尝试点击可能出现的"登录"按钮，或者直接寻找 iframe
    console.log('分析页面结构...');
    try {
      // 有时候 mail.qq.com 会先展示一个推广页，需要点击“登录”
      const loginBtn = await page.$('.header_login_btn, .login_btn');
      if (loginBtn) {
         console.log('点击首页的登录按钮...');
         await loginBtn.click();
         await new Promise(r => setTimeout(r, 1000));
      }
      
      // 循环寻找所有的 iframe，因为腾讯的类名经常变动
      console.log('寻找实际的登录 iframe...');
      await page.waitForSelector('iframe', { timeout: 10000 });
      const iframes = await page.$$('iframe');
      
      let targetFrame = null;
      for (let f of iframes) {
         const name = await page.evaluate(el => el.name || el.id || el.className || el.src, f);
         // 只要是 iframe 都进去找找有没有 #u 账号输入框
         let tempFrame = await f.contentFrame();
         if (tempFrame) {
             try {
                 // 检查是否有嵌套的 ptlogin
                 const inner = await tempFrame.$('#ptlogin_iframe');
                 if (inner) {
                     tempFrame = await inner.contentFrame();
                 }
                 
                 // 检查是否包含密码登录切换按钮或账号输入框
                 const hasInput = await tempFrame.$('#u');
                 const hasSwitcher = await tempFrame.$('#switcher_plogin');
                 
                 if (hasInput || hasSwitcher) {
                     targetFrame = tempFrame;
                     console.log('✅ 成功定位到包含账号输入框的底层 iframe!');
                     break;
                 }
             } catch(e) {}
         }
      }

      if (targetFrame) {
        try {
          const switcher = await targetFrame.$('#switcher_plogin');
          if (switcher) {
            console.log('检测到二维码模式，正在切换到账号密码模式...');
            await switcher.click();
            await new Promise(r => setTimeout(r, 1000)); 
          }
        } catch (switchErr) {}

        console.log('输入 QQ 账号...');
        await targetFrame.waitForSelector('#u', { visible: true, timeout: 5000 });
        await targetFrame.evaluate(() => document.getElementById('u').value = '');
        await targetFrame.type('#u', 'aogusidu99@qq.com', { delay: 50 });

        console.log('输入密码...');
        await targetFrame.waitForSelector('#p', { visible: true });
        await targetFrame.evaluate(() => document.getElementById('p').value = '');
        await targetFrame.type('#p', '1Wndcbd.', { delay: 50 });

        console.log('点击登录按钮...');
        await targetFrame.click('#login_button');

        console.log('\n✅ QQ 邮箱的账号密码已自动提交完成！');
        console.log('====================================================');
        console.log('⚠️ 注意：腾讯的安全系统非常严格，通常此时会弹出一个【安全滑块验证码】(拼图)。');
        console.log('⚠️ 由于滑块验证码需要真实的人类拖动轨迹，请您直接在弹出的浏览器中手动拖动一下滑块完成最后一步！');
        console.log('====================================================\n');
      } else {
        console.log('未能获取到登录 iframe 的内容。您可能已经处于登录状态，或者页面结构有变。');
      }
    } catch (e) {
      console.log('未检测到登录框，可能是您之前已经登录过 QQ 邮箱，或者页面跳转到了其他地方。', e.message);
    }

    // 释放控制权
    browser.disconnect();
  } catch (err) {
    console.error('自动化操作执行失败:', err.message);
  }
}

loginQQMail();
