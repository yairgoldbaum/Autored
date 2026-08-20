import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_URL = process.env.APP_URL || 'http://localhost:19006';
const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9223);
const OUT_DIR = process.env.RESPONSIVE_OUT_DIR || '/tmp/autored-responsive';

const mobileWidths = [320, 360, 375, 390, 412, 430];
const viewports = [
  ...mobileWidths.map((width) => ({ width, height: 932, mobile: true })),
  { width: 768, height: 1024, mobile: false },
  { width: 1024, height: 900, mobile: false },
];

const scenarios = [
  { name: 'stock', run: async () => {} },
  { name: 'stock-filters', run: async (page) => page.clickText('Filtros') },
  { name: 'stock-detail', run: async (page) => page.clickFirstStockCard() },
  { name: 'clientes', run: async (page) => page.clickText('Clientes') },
  { name: 'clientes-new', run: async (page) => { await page.clickText('Clientes'); await page.clickText('Nuevo'); } },
  { name: 'kpis', run: async (page) => page.clickText('KPIs') },
  { name: 'subastas', run: async (page) => page.clickPoint('rightHeaderAction') },
  { name: 'alta', run: async (page) => page.clickPoint('fab') },
];

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = fetch(url, options);
    req.then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
      return res.json();
    }).then(resolve, reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.ws.addEventListener('message', (event) => this.handleMessage(JSON.parse(event.data)));
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
  }

  handleMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    for (const listener of [...this.listeners]) {
      if (listener.method === message.method && (!listener.sessionId || listener.sessionId === message.sessionId)) {
        listener.resolve(message.params || {});
        this.listeners = this.listeners.filter((item) => item !== listener);
      }
    }
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timed out: ${method}`));
        }
      }, 15000);
    });
  }

  waitEvent(method, sessionId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const listener = { method, sessionId, resolve };
      this.listeners.push(listener);
      setTimeout(() => {
        if (this.listeners.includes(listener)) {
          this.listeners = this.listeners.filter((item) => item !== listener);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, timeout);
    });
  }

  close() {
    this.ws.close();
  }
}

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async evaluate(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
    }
    return result.result.value;
  }

  async navigate(url) {
    const loaded = this.cdp.waitEvent('Page.loadEventFired', this.sessionId).catch(() => null);
    await this.send('Page.navigate', { url });
    await loaded;
    await this.waitForApp();
  }

  async waitForApp() {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const ready = await this.evaluate(`(() => {
        const text = document.body?.innerText || '';
        return document.readyState !== 'loading' && (text.includes('Stock de Veh') || text.includes('Clientes') || text.includes('KPIs'));
      })()`);
      if (ready) return;
      await sleep(250);
    }
    throw new Error('App did not render in time');
  }

  async clickText(text) {
    const clicked = await this.evaluate(`(() => {
      const targetText = ${JSON.stringify(text)};
      const nodes = Array.from(document.querySelectorAll('body *')).filter((el) => {
        const value = (el.textContent || '').trim();
        return value === targetText || value.startsWith(targetText + ' ');
      });
      const node = nodes.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!node) return false;
      const clickable = node.closest('[role="button"],button,a') || node;
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()`);
    await sleep(600);
    return clicked;
  }

  async clickPoint(kind) {
    const clicked = await this.evaluate(`(() => {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const point =
        ${JSON.stringify(kind)} === 'fab'
          ? { x: Math.round(vw / 2), y: Math.max(40, vh - 84) }
          : { x: Math.max(20, vw - 34), y: 40 };
      const el = document.elementFromPoint(point.x, point.y);
      if (!el) return false;
      const clickable = el.closest('[role="button"],button,a') || el;
      clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()`);
    await sleep(700);
    return clicked;
  }

  async clickFirstStockCard() {
    const clicked = await this.evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('body *')).filter((el) => (el.textContent || '').trim() === 'Precio Venta');
      const node = labels.find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!node) return false;
      let cursor = node;
      for (let i = 0; cursor && i < 8; i += 1) {
        const rect = cursor.getBoundingClientRect();
        if (rect.width > 180 && rect.height > 70) break;
        cursor = cursor.parentElement;
      }
      (cursor || node).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()`);
    await sleep(700);
    return clicked;
  }

  async measure() {
    return this.evaluate(`(() => {
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const sw = document.documentElement.scrollWidth;
      const offenders = [];
      const isHidden = (el) => {
        const style = getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
      };
      const inHorizontalScroller = (el) => {
        let cursor = el.parentElement;
        while (cursor && cursor !== document.body) {
          const style = getComputedStyle(cursor);
          const canScroll = cursor.scrollWidth > cursor.clientWidth + 1;
          if (canScroll && (style.overflowX === 'auto' || style.overflowX === 'scroll')) return true;
          cursor = cursor.parentElement;
        }
        return false;
      };
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (isHidden(el)) continue;
        if (inHorizontalScroller(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.right > vw + 1 || rect.left < -1) {
          const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90);
          offenders.push({
            tag: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || '',
            text,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      }
      return {
        viewport: { width: vw, height: vh },
        scrollWidth: sw,
        bodyWidth: document.body.scrollWidth,
        offenders: offenders.slice(0, 12),
      };
    })()`);
  }

  async screenshot(filePath) {
    const result = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  }
}

async function launchChrome() {
  mkdirSync(OUT_DIR, { recursive: true });
  const userDataDir = mkdtempSync(join(tmpdir(), 'autored-chrome-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${DEBUG_PORT}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  chrome.stderr.on('data', () => {});

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const version = await requestJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      return { chrome, userDataDir, wsUrl: version.webSocketDebuggerUrl };
    } catch {
      await sleep(200);
    }
  }
  chrome.kill('SIGTERM');
  throw new Error('Chrome did not expose the debugging port');
}

async function createPage(cdp, viewport) {
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const page = new Page(cdp, attached.sessionId);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 3 : 1,
    mobile: viewport.mobile,
  });
  return { page, targetId: target.targetId };
}

async function run() {
  const { chrome, userDataDir, wsUrl } = await launchChrome();
  const cdp = new CdpClient(wsUrl);
  await cdp.open();
  const failures = [];
  const results = [];

  try {
    for (const viewport of viewports) {
      for (const scenario of scenarios) {
        const { page, targetId } = await createPage(cdp, viewport);
        process.stdout.write(`checking ${scenario.name} @ ${viewport.width}px\n`);
        await page.navigate(APP_URL);
        await scenario.run(page);
        const metrics = await page.measure();
        const overflow = metrics.scrollWidth > metrics.viewport.width + 1 || metrics.offenders.length > 0;
        const row = {
          width: viewport.width,
          scenario: scenario.name,
          scrollWidth: metrics.scrollWidth,
          offenders: metrics.offenders.length,
        };
        results.push(row);
        if (overflow) {
          failures.push({ ...row, sample: metrics.offenders.slice(0, 3) });
        }
        if ([320, 430, 768].includes(viewport.width) && ['stock', 'clientes', 'kpis', 'stock-detail', 'alta'].includes(scenario.name)) {
          await page.screenshot(join(OUT_DIR, `${scenario.name}-${viewport.width}.png`));
        }
        await cdp.send('Target.closeTarget', { targetId });
      }
    }
  } finally {
    cdp.close();
    chrome.kill('SIGTERM');
    await sleep(500);
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      // Chrome can keep a profile handle open briefly after SIGTERM; the temp
      // directory is harmless and should not hide the validation result.
    }
  }

  console.table(results);
  if (failures.length) {
    console.error(JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`Responsive validation passed. Screenshots: ${OUT_DIR}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
