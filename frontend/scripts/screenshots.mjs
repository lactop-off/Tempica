// 全画面のスクリーンショットを撮る Playwright スクリプト（CI 用）。
// フロント(:8080)＋バックエンド(:3000) が起動している前提。シードの管理者でログインし、
// デスクトップ/モバイル両ビューポートで各画面を撮影して screenshots/ に保存する。
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SHOT_BASE_URL || 'http://localhost:8080';
const EMAIL = process.env.SHOT_EMAIL || 'admin@example.com';
const PASSWORD = process.env.SHOT_PASSWORD || 'Password123!';

// 認証後に撮影する画面
const ROUTES = [
  ['dashboard', '/dashboard'],
  ['punch', '/punch'],
  ['attendance', '/attendance'],
  ['requests', '/requests'],
  ['requests-new', '/requests/new'],
  ['approvals', '/approvals'],
  ['shift', '/shift'],
  ['leave', '/leave'],
  ['members', '/members'],
  ['work-patterns', '/work-patterns'],
  ['roles', '/roles'],
  ['closing', '/closing'],
  ['notifications', '/notifications'],
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(context, vp) {
  const page = await context.newPage();
  await page.setViewportSize({ width: vp.width, height: vp.height });

  // 未認証のログイン画面
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await page.screenshot({ path: `screenshots/${vp.name}/00-login.png`, fullPage: true });

  // ログイン（フォーム送信）
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(1500);

  let i = 1;
  for (const [name, route] of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      await sleep(1600); // データ取得・フォント読込待ち
      await page.screenshot({
        path: `screenshots/${vp.name}/${String(i).padStart(2, '0')}-${name}.png`,
        fullPage: true,
      });
      console.log(`captured ${vp.name}/${name}`);
    } catch (e) {
      console.error(`failed ${vp.name}/${name}:`, e.message);
    }
    i++;
  }
  await page.close();
}

async function main() {
  for (const vp of VIEWPORTS) await mkdir(`screenshots/${vp.name}`, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ locale: 'ja-JP' });
    await shoot(context, vp);
    await context.close();
  }
  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
