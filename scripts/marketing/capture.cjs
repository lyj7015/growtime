/**
 * App Store 截图抓取脚本
 * ---------------------------------------------------------------------------
 * 在 Web 预览（localhost:8081）里注入一套真实感的演示数据，然后按设备视口抓图。
 *
 * 用法（Git Bash）：
 *   node scripts/marketing/capture.cjs            # iPhone 16 Pro 402×874 @3x → 1206×2622
 *   node scripts/marketing/capture.cjs ipad       # iPad Pro 13" 1032×1376 @2x → 2064×2752
 *
 * 产出：marketing/raw/{home,tasks,calendar}.png 或 marketing/raw-ipad/{...}.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = 'http://localhost:8081';
const KEY = 'growtime.state.v1';

/** 设备档案：视口 × 缩放 = App Store 要求的目标像素 */
const DEVICES = {
  iphone: { viewport: { width: 402, height: 874 }, dsf: 3, dir: 'raw', name: 'iPhone 16 Pro' },
  ipad: { viewport: { width: 1032, height: 1376 }, dsf: 2, dir: 'raw-ipad', name: 'iPad Pro 13"' },
  // iPad Pro 13" (M4) 截屏槽位：2007×2853 → 669×951 @3x
  ipad13: { viewport: { width: 669, height: 951 }, dsf: 3, dir: 'raw-ipad13', name: 'iPad Pro 13" M4' },
};
const DEV = DEVICES[process.argv[2]] || DEVICES.iphone;

const OUT_DIR = path.resolve(__dirname, '..', '..', 'marketing', DEV.dir);

/* ---------- 演示数据 -------------------------------------------------- */

const pad = n => `${n}`.padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

const TODAY = keyOf(new Date());
const now = Date.now();

function mkTask(o) {
  return {
    id: o.id,
    title: o.title,
    done: !!o.done,
    date: o.date,
    time: o.time,
    startTime: o.startTime,
    dueTime: o.dueTime,
    createdAt: now - (o.age ?? 0),
    completedAt: o.done ? now - 3600_000 : undefined,
    order: now - (o.age ?? 0),
    estimatePomos: o.estimatePomos,
  };
}

const tasks = [
  // 今日：8 条未完成 + 1 条已完成，首页展示 4 条并出现 "+5 more"，
  // iPad（高屏）任务页也能铺满
  mkTask({ id: 't1', title: 'Design review with the team', date: TODAY, startTime: '09:00', dueTime: '10:00', estimatePomos: 2, age: 900_000 }),
  mkTask({ id: 't2', title: 'Write the Q4 product outline', date: TODAY, startTime: '10:30', dueTime: '12:00', estimatePomos: 3, age: 800_000 }),
  mkTask({ id: 't3', title: 'Gym — leg day', date: TODAY, startTime: '18:30', estimatePomos: 1, age: 700_000 }),
  mkTask({ id: 't4', title: 'Read 20 pages of Deep Work', date: TODAY, startTime: '20:00', estimatePomos: 1, age: 600_000 }),
  mkTask({ id: 't5', title: 'Reply to customer emails', date: TODAY, done: true, estimatePomos: 1, age: 500_000 }),
  mkTask({ id: 't16', title: 'Review pull requests', date: TODAY, startTime: '13:00', estimatePomos: 2, age: 480_000 }),
  mkTask({ id: 't17', title: 'Call the print vendor', date: TODAY, startTime: '14:30', estimatePomos: 1, age: 470_000 }),
  mkTask({ id: 't18', title: 'Outline the launch newsletter', date: TODAY, startTime: '16:00', dueTime: '17:30', estimatePomos: 2, age: 460_000 }),
  mkTask({ id: 't19', title: 'Evening stretch + walk', date: TODAY, startTime: '21:30', estimatePomos: 1, age: 450_000 }),

  // 其余日期：给日历铺出「有时钟标记 + 待办圆点」的层次
  mkTask({ id: 't6', title: 'Weekly planning', date: shift(-3), startTime: '09:30', dueTime: '10:30', estimatePomos: 2, age: 400_000 }),
  mkTask({ id: 't7', title: 'Ship the onboarding fix', date: shift(-3), done: true, estimatePomos: 3, age: 390_000 }),
  mkTask({ id: 't8', title: 'Coffee chat with Sam', date: shift(-1), startTime: '15:00', estimatePomos: 1, age: 380_000 }),
  mkTask({ id: 't9', title: 'Draft the launch email', date: shift(1), startTime: '11:00', dueTime: '17:00', estimatePomos: 2, age: 370_000 }),
  mkTask({ id: 't10', title: 'Sprint retro', date: shift(1), startTime: '16:00', estimatePomos: 1, age: 360_000 }),
  mkTask({ id: 't11', title: 'Prepare investor deck', date: shift(2), startTime: '10:00', dueTime: '18:00', estimatePomos: 4, age: 350_000 }),
  mkTask({ id: 't12', title: 'Book flights for the offsite', date: shift(3), startTime: '13:00', estimatePomos: 1, age: 340_000 }),
  mkTask({ id: 't13', title: 'Review analytics dashboard', date: shift(5), projectLike: true, estimatePomos: 2, age: 330_000 }),
  mkTask({ id: 't14', title: 'Team offsite', date: shift(7), estimatePomos: 3, age: 320_000 }),
  mkTask({ id: 't15', title: 'Monthly budget check', date: shift(-6), startTime: '09:00', estimatePomos: 1, age: 310_000 }),
];

/** 今天完成的番茄：5 个 × 25 分钟 = 125 分钟 → "2h 5m" */
const sessions = [
  { id: 's1', taskId: 't1', taskTitle: 'Design review with the team', date: TODAY, startedAt: now - 4 * 3600_000, minutes: 25, completed: true },
  { id: 's2', taskId: 't1', taskTitle: 'Design review with the team', date: TODAY, startedAt: now - 3.4 * 3600_000, minutes: 25, completed: true },
  { id: 's3', taskId: 't2', taskTitle: 'Write the Q4 product outline', date: TODAY, startedAt: now - 2.6 * 3600_000, minutes: 25, completed: true },
  { id: 's4', taskId: 't2', taskTitle: 'Write the Q4 product outline', date: TODAY, startedAt: now - 1.8 * 3600_000, minutes: 25, completed: true },
  { id: 's5', taskId: 't5', taskTitle: 'Reply to customer emails', date: TODAY, startedAt: now - 1.1 * 3600_000, minutes: 25, completed: true },
  // 往月/往日的记录，让日历有「番茄点」
  { id: 's6', taskId: 't6', taskTitle: 'Weekly planning', date: shift(-3), startedAt: now - 3 * 86400_000, minutes: 25, completed: true },
  { id: 's7', taskId: 't6', taskTitle: 'Weekly planning', date: shift(-3), startedAt: now - 3 * 86400_000 + 1800_000, minutes: 25, completed: true },
  { id: 's8', taskId: 't8', taskTitle: 'Coffee chat with Sam', date: shift(-1), startedAt: now - 86400_000, minutes: 25, completed: true },
];

const state = {
  tasks,
  sessions,
  settings: {
    themeMode: 'light',
    soundEnabled: true,
    hapticsEnabled: true,
    presets: { focus: 25, shortBreak: 5, longBreak: 15 },
    longBreakInterval: 4,
    autoStartBreak: false,
    features: { pomodoro: true, quadrant: false, habit: false },
    // 营销截图展示「最佳状态」：无 Premium 引导行、无锁定音效
    premiumUnlocked: true,
    rewardedUntil: null,
    silentDuringFocus: false,
  },
  account: { id: 'acc_demo', email: null, provider: 'guest', isGuest: true, createdAt: now },
  onboarding: { slidesSeen: true },
};

/* ---------- 抓图 ------------------------------------------------------ */

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`设备: ${DEV.name}  ${DEV.viewport.width}×${DEV.viewport.height} @${DEV.dsf}x  →  ${DEV.viewport.width * DEV.dsf}×${DEV.viewport.height * DEV.dsf}px`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: DEV.viewport,
    deviceScaleFactor: DEV.dsf,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'en-US',
  });
  const page = await ctx.newPage();

  // 先打开一次，拿到同源上下文再写入演示数据
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([k, v]) => {
      window.localStorage.clear();
      window.localStorage.setItem(k, v);
    },
    [KEY, JSON.stringify(state)],
  );
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });

  const shot = async name => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
    console.log('  ✓', name);
  };

  // --- 1) 任务页 --------------------------------------------------------
  await page.waitForTimeout(2500); // 等 FadeIn 动画稳定
  await page.locator('text="Tasks"').last().click();
  await page.waitForTimeout(900);
  await shot('tasks');

  // --- 2) 首页 / 番茄钟 -------------------------------------------------
  // 从任务页点「▶ Pomodoro」启动：计时卡会带上任务名，比 Free focus 更有说服力；
  // 点击后 app 会自动切回首页
  await page.locator('text="▶ Pomodoro"').first().click({ timeout: 8000 });
  await page.waitForTimeout(6000); // 让进度环推进一点点
  await shot('home');

  // --- 3) 日历页 --------------------------------------------------------
  await page.locator('text="Calendar"').last().click();
  await page.waitForTimeout(900);
  if (DEV === DEVICES.ipad) {
    // iPad 高屏：当日弹层会盖住大半屏，先抓一张无弹层的纯净月历
    await shot('calendar');
    // 再点「今天」抓弹层版备用
    await page.locator('text="Today"').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot('calendar-sheet');
  } else {
    // 点「今天」，展开当日详情弹层
    await page.locator('text="Today"').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot('calendar');
  }

  await browser.close();
  console.log('\n完成 →', OUT_DIR);
}

main().catch(e => {
  console.error('抓图失败:', e);
  process.exit(1);
});
