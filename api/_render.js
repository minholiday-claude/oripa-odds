// 화면이 나중에 그려지는 사이트(자바스크립트 렌더링)를 진짜 브라우저로 열어 글자를 읽는다.

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd])/i;

async function renderText(url) {
  // 둘 다 ES 모듈이라 import()로 불러옴
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36');
    await page.setViewport({ width: 430, height: 1400 });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const t = r.resourceType();
      let host = '';
      try { host = new URL(r.url()).hostname; } catch {}
      if (['image', 'media', 'font'].includes(t) || PRIVATE.test(host)) return r.abort();
      r.continue();
    });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    return await page.evaluate(() => {
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent.trim()).join('\n');
      return { title: document.title, ld, body: document.body ? document.body.innerText : '' };
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { renderText };
