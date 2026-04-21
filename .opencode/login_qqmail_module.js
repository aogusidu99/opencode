module.exports.login = async (page, account) => {
  console.log(`[QQMail Custom Login] 开始执行针对 ${account.username} 的专属登录脚本...`);
  await page.goto(account.url, { waitUntil: 'networkidle2' });

  try {
    console.log('分析页面结构...');
    const loginBtn = await page.$('.header_login_btn, .login_btn');
    if (loginBtn) {
       console.log('点击首页的登录按钮...');
       await loginBtn.click();
       await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log('寻找实际的登录 iframe...');
    await page.waitForSelector('iframe', { timeout: 10000 });
    const iframes = await page.$$('iframe');
    
    let targetFrame = null;
    for (let f of iframes) {
       let tempFrame = await f.contentFrame();
       if (tempFrame) {
           try {
               const inner = await tempFrame.$('#ptlogin_iframe');
               if (inner) {
                   tempFrame = await inner.contentFrame();
               }
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
      await targetFrame.type('#u', account.username, { delay: 50 });

      console.log('输入密码...');
      await targetFrame.waitForSelector('#p', { visible: true });
      await targetFrame.evaluate(() => document.getElementById('p').value = '');
      await targetFrame.type('#p', account.password, { delay: 50 });

      console.log('点击登录按钮...');
      await targetFrame.click('#login_button');
      console.log('✅ QQ 邮箱登录请求已提交，如果出现滑块验证，请手动在浏览器中拉动。');
    }
  } catch (e) {
    console.log('执行 QQ 登录异常，可能是已经登录或风控阻截:', e.message);
  }
};