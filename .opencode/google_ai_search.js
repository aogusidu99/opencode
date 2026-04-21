const puppeteer = require('puppeteer');
const { exec } = require('child_process');

async function getBrowserWsUrl() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    const data = await res.json();
    return data.webSocketDebuggerUrl;
  } catch (e) {
    return null;
  }
}

async function launchBrowser() {
  console.log('🚀 拉起持久化原生浏览器...');
  exec('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\\Code\\opencode\\.opencode\\chrome_data"');
  await new Promise(r => setTimeout(r, 3000));
  return await getBrowserWsUrl();
}

async function googleAISearch(query) {
  let wsUrl = await getBrowserWsUrl();
  if (!wsUrl) {
    wsUrl = await launchBrowser();
  }
  if (!wsUrl) {
    console.error('❌ 无法连接到浏览器，请确保 Chrome 已关闭且无残留进程。');
    process.exit(1);
  }

  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  const page = await browser.newPage();

  console.log(`🔍 正在 Google 搜索: "${query}" ...`);
  // 加上 &hl=zh-CN 强制返回中文结果
  await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN`, { waitUntil: 'domcontentloaded' });

  // 等待 AI 概览生成 (Google SGE 通常是流式输出，需要几秒钟)
  console.log('⏳ 等待 Google AI 概览生成 (约等待 4 秒)...');
  await new Promise(r => setTimeout(r, 4000));

  // 提取搜索结果内容
  const result = await page.evaluate(() => {
    let aiOverview = "";
    let regularResults = [];

    // --- 提取 AI 概览 (SGE) / 特色答案区 ---
    // 寻找常见的 Featured Snippet 结构
    const snippetBlock = document.querySelector('div[data-attrid="wa:/description"]');
    if (snippetBlock) {
        aiOverview = snippetBlock.innerText;
    } else {
        // 如果没有官方的 Snippet，抓取 #search 最上面的大块独立文本（这通常是 SGE AI 答案）
        // 因为 AI 概览的类名一直在随机变化，我们用启发式方法：查找所有大的文本段落
        const allDivs = document.querySelectorAll('#search div');
        for (let i = 0; i < Math.min(allDivs.length, 20); i++) {
            let text = allDivs[i].innerText;
            if (text && text.length > 200 && text.includes('。') && !allDivs[i].querySelector('h3')) {
                aiOverview = text;
                break;
            }
        }
    }

    // --- 提取常规搜索结果 ---
    // 不依赖复杂的类名嵌套，直接找 h3 (因为 h3 通常是标题)
    const resultElements = Array.from(document.querySelectorAll('h3')).map(el => el.closest('div'));
    
    // 过滤并去重
    const seenLinks = new Set();
    
    for (let el of resultElements) {
        if (!el) continue;
        const titleEl = el.querySelector('h3');
        const linkEl = el.querySelector('a');
        
        if (titleEl && linkEl && linkEl.href && linkEl.href.startsWith('http')) {
            if (seenLinks.has(linkEl.href)) continue;
            seenLinks.add(linkEl.href);
            
            // 往上找两层，提取里面的全部文本作为摘要 (去掉标题部分)
            let snippetContainer = el.parentElement;
            if (snippetContainer) {
               snippetContainer = snippetContainer.parentElement || snippetContainer;
            } else {
               snippetContainer = el;
            }
            
            let snippet = snippetContainer.innerText || "";
            snippet = snippet.replace(titleEl.innerText, '').trim();
            snippet = snippet.substring(0, 150).replace(/\n/g, ' ') + '...';
            
            regularResults.push({
                title: titleEl.innerText,
                link: linkEl.href,
                snippet: snippet
            });
            
            if (regularResults.length >= 5) break;
        }
    }
    
    // AI 概览获取：抓取最顶部带有多段文字的块
    const allDivs = document.querySelectorAll('div');
    for (let i = 0; i < Math.min(allDivs.length, 50); i++) {
        let text = allDivs[i].innerText;
        // 如果文本块很长，而且不包含 HTTP 链接文字，就当做是摘要
        if (text && text.length > 150 && text.includes('。') && !text.includes('http') && !allDivs[i].querySelector('h3')) {
            aiOverview = text.substring(0, 500) + '...';
            break;
        }
    }
    
    return { aiOverview, regularResults };
  });

  console.log('\n==================================================');
  console.log(`🤖 【Google AI 概览 / 顶部精准答案】:`);
  if (result.aiOverview && result.aiOverview.length > 20) {
     // 简单排版，去除过多空行
     console.log(result.aiOverview.replace(/\n{3,}/g, '\n\n'));
  } else {
     console.log('(未触发 AI 概览，或未能提取到直达答案。请参考下方传统结果)');
  }
  console.log('--------------------------------------------------');
  console.log(`📄 【Top 5 传统搜索结果】:`);
  result.regularResults.forEach((r, i) => {
      console.log(`[${i+1}] ${r.title}`);
      console.log(`    链接: ${r.link}`);
      console.log(`    摘要: ${r.snippet}\n`);
  });
  console.log('==================================================\n');

  await page.close();
  browser.disconnect();
}

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.log('请提供搜索词，例如: node google_ai_search.js 什么是量子计算');
  process.exit(1);
}

googleAISearch(query);
