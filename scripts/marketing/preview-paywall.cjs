/**
 * Premium 门槛与引导的走查脚本
 * ---------------------------------------------------------------------------
 * 在 Web 预览里注入演示数据，逐个确认：
 *   · 首页免费引导行 / 点开购买弹层
 *   · 设置页：锁定的白噪音、锁定的时长字段、Premium 权益清单
 *   · 权益写为已购后：锁定态全部解开（引导行消失、时长可编辑）
 *
 * 用法（Git Bash）：
 *   NODE_PATH=<managed node workspace> node scripts/marketing/preview-paywall.cjs
 * 产出：marketing/.preview/*.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = 'http://localhost:8081';
const KEY = 'growtime.state.v1';
const OUT_DIR = path.resolve(__dirname, '..', '..', 'marketing', '.preview');

const pad = n => `${n}`.padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = keyOf(new Date());
const now = Date.now();

const mk = (id, title, o = {}) => ({
  id,
  title,
  done: !!o.done,
  date: TODAY,
  time: o.time,
  startTime: o.startTime,
  dueTime: o.dueTime,
  createdAt: now - (o.age ?? 0),
  order: now - (o.age ?? 0),
  estimatePomos: o.estimatePomos,
});

const state = premiumUnlocked => ({
  tasks: [
    mk('t1', 'Design review with the team', { startTime: '09:00', dueTime: '10:00', estimatePomos: 2, age: 90000 }),
    mk('t2', 'Write the Q4 product outline', { startTime: '10:30', dueTime: '12:00', estimatePomos: 3, age: 80000 }),
    mk('t3', 'Gym — leg day', { startTime: '18:30', estimatePomos: 1, age: 70000 }),
    mk('t4', 'Read 20 pages of Deep Work', { startTime: '20:00', estimatePomos: 1, age: 60000 }),
  ],
  sessions: [
    { id: 's1', taskId: 't1', taskTitle: 'Design review with the team', date: TODAY, startedAt: now - 3600000, minutes: 25, completed: true },
    { id: 's2', taskId: 't2', taskTitle: 'Write the Q4 product outline', date: TODAY, startedAt: now - 7200000, minutes: 25, completed: true },
  ],
  settings: {
    themeMode: 'light',
    soundEnabled: true,
    hapticsEnabled: true,
    presets: { focus: 25, shortBreak: 5, longBreak: 15 },
    longBreakInterval: 4,
    autoStartBreak: false,
    features: { pomodoro: true, quadrant: false, habit: false },
    premiumUnlocked,
    rewardedUntil: null,
    silentDuringFocus: false,
  },
  account: { id: 'acc_demo', email: null, provider: 'guest', isGuest: true, createdAt: now },
  onboarding: { slidesSeen: true },
});

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'en-US',
  });
  const page = await ctx.newPage();

  const shot = async name => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
    console.log('  ✓', name);
  };

  const inject = async unlocked => {
    await page.evaluate(
      ([k, v]) => {
        window.localStorage.clear();
        window.localStorage.setItem(k, v);
      },
      [KEY, JSON.stringify(state(unlocked))],
    );
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2200);
  };

  const tap = async (sel, label) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded({ timeout: 6000 }).catch(() => {});
    await el.click({ timeout: 6000 });
    console.log('   · tapped', label || sel);
  };

  // ---------------------------------------------------------------- 免费用户
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await inject(false);

  // 1) 首页：引导行可见
  await shot('free-home');

  // 2) 点引导行 → 弹层
  await tap('text=Premium — ad-free', 'Premium upsell row');
  await shot('paywall-general');
  await tap('text=Not now', 'close');

  // 3) 设置页：锁定态
  await tap('text="Settings"', 'Settings tab');
  await shot('free-settings-top');
  await tap('text="White noise"', 'scroll to sounds');
  await shot('free-settings-sounds');
  await tap('text="Go Premium"', 'scroll to premium card');
  await shot('free-settings-premium');

  // 4) 锁定的白噪音 → 弹层（带具体声音名）
  await tap('text=Café', 'locked sound');
  await shot('paywall-sounds');
  await tap('text=Not now', 'close');

  // 5) 锁定的时长字段 → 弹层
  await tap('text="White noise"', 'scroll up');
  await tap('text="25"', 'locked focus field');
  await shot('paywall-durations');
  await tap('text=Not now', 'close');

  // ---------------------------------------------------------------- 已购用户
  await inject(true);
  await shot('pro-home');
  await tap('text="Settings"', 'Settings tab');
  await shot('pro-settings-top');
  await tap('text="White noise"', 'scroll to sounds');
  await shot('pro-settings-sounds');
  await tap('text="Go Premium"', 'premium card').catch(() => {});
  await shot('pro-settings-premium');

  await browser.close();
  console.log('\n完成 →', OUT_DIR);
}

main().catch(e => {
  console.error('走查失败:', e);
  process.exit(1);
});
