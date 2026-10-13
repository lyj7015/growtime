/**
 * 视觉走查：番茄舞台（倒计时立体番茄）+ 引导页动效
 * 产出 6 张截图到 marketing/.preview/，人工核对视觉。
 *
 * 用法：
 *   NODE_PATH=<managed node workspace> node scripts/tools/check-visuals.cjs
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = 'http://localhost:8081';
const KEY = 'growtime.state.v1';
const OUT = path.resolve(__dirname, '..', '..', 'marketing', '.preview');

const pad = n => `${n}`.padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = Date.now();

function makeState({ onboardingSeen }) {
  return {
    tasks: [
      {
        id: 'a1',
        title: 'Design review with the team',
        done: false,
        date: today,
        startTime: '09:00',
        estimatePomos: 2,
        createdAt: now - 900000,
        order: now - 900000,
      },
    ],
    sessions: [],
    settings: {
      themeMode: 'light',
      soundEnabled: true,
      soundId: 'rain',
      hapticsEnabled: false,
      presets: { focus: 25, shortBreak: 5, longBreak: 15 },
      longBreakInterval: 4,
      autoStartBreak: false,
      features: { pomodoro: true, quadrant: false, habit: false },
      premiumUnlocked: true,
      rewardedUntil: null,
      silentDuringFocus: false,
    },
    account: { id: 'acc_demo', email: null, provider: 'guest', isGuest: true, createdAt: now },
    onboarding: { slidesSeen: onboardingSeen },
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') console.log('    [browser error]', m.text().slice(0, 200));
  });

  const load = async onboardingSeen => {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(
      ([k, v]) => {
        window.localStorage.clear();
        window.localStorage.setItem(k, v);
      },
      [KEY, JSON.stringify(makeState({ onboardingSeen }))],
    );
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
  };

  /* ---- 1) 引导页：4 页各截一帧（动画循环中，帧相位不同） ---- */
  console.log('\n1) 引导页动效');
  await load(false);
  const W = 402;
  for (let i = 0; i < 4; i++) {
    if (i > 0) {
      await page.evaluate(w => {
        const scrollers = document.querySelectorAll('div[style*="overflow-x"]');
        // 直接用 RN ScrollView 的 DOM：滚到第 i 页
        const el = document.querySelector('[dir="auto"]')?.closest('body');
        window.scrollTo(0, 0);
      }, W);
      await page.locator('text="Continue"').click();
      await page.waitForTimeout(1400);
    } else {
      await page.waitForTimeout(2000); // 让第一页动画跑起来
    }
    await page.screenshot({ path: path.join(OUT, `onboard-${i + 1}.png`) });
    console.log(`  ✓ onboard-${i + 1}.png`);
  }

  /* ---- 2) 首页番茄：空闲态 + 运行态 ---- */
  console.log('\n2) 首页番茄舞台');
  await page.getByText('Get started', { exact: true }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, 'tomato-idle.png') });
  console.log('  ✓ tomato-idle.png');

  await page.getByText('Start', { exact: true }).first().click();
  await page.waitForTimeout(4200); // 让进度走一点、呼吸动画到相位
  await page.screenshot({ path: path.join(OUT, 'tomato-running.png') });
  console.log('  ✓ tomato-running.png');

  await browser.close();
  console.log(`\n完成 → ${OUT}`);
}

main().catch(e => {
  console.error('失败:', e);
  process.exit(1);
});
