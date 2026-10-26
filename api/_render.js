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

// KREAM 검색 결과에서 상품명·가격 목록 읽기 (브라우저 하나로 여러 검색어)
async function kreamSearch(queries) {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  const out = {};
  try {
    for (const q of queries) {
      const page = await browser.newPage();
      try {
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
        await page.setRequestInterception(true);
        page.on('request', r => (['image', 'media', 'font'].includes(r.resourceType()) ? r.abort() : r.continue()));
        await page.goto('https://kream.co.kr/search?keyword=' + encodeURIComponent(q), { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));
        const text = await page.evaluate(() => document.body ? document.body.innerText : '');
        // "포켓몬 TCG ... (30팩/일어판)" 다음 줄의 "68,000원"을 짝지음
        const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
        const list = [];
        for (let i = 0; i < lines.length - 1 && list.length < 12; i++) {
          if (/^포켓몬\s*TCG|^Pokemon|박스|BOX|팩|카드/i.test(lines[i]) && lines[i].length > 6) {
            const m = (lines[i + 1] || '').match(/^([\d,]+)원$/);
            if (m) list.push({ name: lines[i], price: Number(m[1].replace(/,/g, '')) });
          }
        }
        out[q] = list;
        out.__debug = (out.__debug || '') + `[${q}] n=${list.length} ${JSON.stringify(lines.slice(14, 24))}\n`;
      } catch { out[q] = []; } finally { await page.close().catch(() => {}); }
    }
  } finally { await browser.close().catch(() => {}); }
  return out;
}

module.exports.kreamSearch = kreamSearch;
