/**
 * 走查：滚轮式日期时间选择（年月日时分秒）+ 日历落位 + 番茄元素
 * 用法：NODE_PATH=<managed node workspace> node scripts/tools/check-composer-datetime.cjs
 * 需要 dev server 在 http://localhost:8081
 */
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const KEY = 'growtime.state.v1';
const ITEM_H = 38;
const now = Date.now();

const state = {
  tasks: [],
  sessions: [],
  settings: {
    themeMode: 'light', soundEnabled: false, soundId: 'rain', hapticsEnabled: false,
    presets: { focus: 25, shortBreak: 5, longBreak: 15 }, longBreakInterval: 4, autoStartBreak: false,
    features: { pomodoro: true, quadrant: false, habit: false }, premiumUnlocked: true,
    rewardedUntil: null, silentDuringFocus: false,
  },
  account: { id: 'a', email: null, provider: 'guest', isGuest: true, createdAt: now },
  onboarding: { slidesSeen: true },
};

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
};

const leafText = page => v =>
  page.evaluate(
    v => [...document.querySelectorAll('div')].some(e => e.textContent === v && e.children.length === 0),
    v,
  );

/** 滚动某列滚轮：找列头(如 HOUR)所在容器里的可滚动 div，设 scrollTop 并派发 scroll 事件 */
async function wheelTo(page, label, index) {
  await page.evaluate(
    ([t, idx, h]) => {
      const heads = [...document.querySelectorAll('div')].filter(
        e => e.textContent === t && e.children.length === 0,
      );
      const head = heads[heads.length - 1];
      if (!head) throw new Error('wheel header not found: ' + t);
      let node = head;
      let scroller = null;
      while (node && node !== document.body) {
        node = node.parentElement;
        if (!node) break;
        scroller = [...node.querySelectorAll('div')].find(el => {
          const ov = getComputedStyle(el).overflowY;
          return ov === 'auto' || ov === 'scroll';
        });
        if (scroller) break;
      }
      if (!scroller) throw new Error('scrollable div not found for ' + t);
      scroller.scrollTop = idx * h;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    },
    [label, index, ITEM_H],
  );
  // 等滚动去抖（120ms）提交
  await page.waitForTimeout(260);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(
    ([k, v]) => {
      localStorage.clear();
      localStorage.setItem(k, v);
    },
    [KEY, JSON.stringify(state)],
  );
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  const Y = new Date().getFullYear();

  // ---- 1) 滚轮选择 Start：10月20日 14:30:35 ----
  await page.getByText('+', { exact: true }).last().click();
  await page.waitForTimeout(600);
  check('弹窗打开（New task）', await leafText(page)('New task'));
  await page.getByPlaceholder('e.g. Finish the project outline').fill('Compose quarterly report');

  await page.getByText('Not set').first().click();
  await page.waitForTimeout(500);
  // 展开 → 自动落到「现在」；再滚到目标值
  await wheelTo(page, 'YEAR', 1); // years = [Y-1, Y, Y+1, Y+2]
  await wheelTo(page, 'MONTH', 9); // 10 月
  await wheelTo(page, 'DAY', 19); // 20 日
  await wheelTo(page, 'HOUR', 14);
  await wheelTo(page, 'MIN', 6); // 30 分（5 分一档）
  await wheelTo(page, 'SEC', 7); // 35 秒
  await page.waitForTimeout(300);
  check('Start 摘要 = Oct 20 · 14:30:35', await leafText(page)('Oct 20 · 14:30:35'));
  check(
    '归属日预览联动为 10 月 20 日',
    await leafText(page)(
      `Shows on ${new Date(Y, 9, 20).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} in Calendar`,
    ),
  );
  await page.screenshot({ path: path.resolve('marketing', '.preview', 'composer-wheel.png') });

  // ---- 2) Deadline：10月21日 18:00（展开后从「现在」滚动）----
  await page.getByText('Not set').first().click();
  await page.waitForTimeout(500);
  await wheelTo(page, 'DAY', 20); // 21 日
  await wheelTo(page, 'HOUR', 18);
  await wheelTo(page, 'MIN', 0); // 00 分
  await wheelTo(page, 'SEC', 0);
  await page.waitForTimeout(300);
  check('Deadline 摘要 = Oct 21 · 18:00', await leafText(page)('Oct 21 · 18:00'));
  check('Deadline 摘要唯一', (await page.getByText('Oct 21 · 18:00').count()) === 1);

  // ---- 3) 添加 + 存储断言 ----
  await page.getByText('Add task').last().click();
  await page.waitForTimeout(700);
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
  const t = (stored.tasks || [])[0] || {};
  const expectStart = new Date(Y, 9, 20, 14, 30, 35).getTime();
  const expectDue = new Date(Y, 9, 21, 18, 0, 0).getTime();
  check('task.date = 起始日期', t.date === `${Y}-10-20`, t.date);
  check('startAt epoch 精确到秒', t.startAt === expectStart, `${t.startAt} vs ${expectStart}`);
  check('dueAt epoch 正确', t.dueAt === expectDue, `${t.dueAt} vs ${expectDue}`);
  check('dueDate = 截止日（跨天）', t.dueDate === `${Y}-10-21`, t.dueDate);
  check('startTime/dueTime 降维字段同步', t.startTime === '14:30' && t.dueTime === '18:00', `${t.startTime}~${t.dueTime}`);

  // ---- 4) 日历 20 日出现该任务 ----
  await page.locator('text="Calendar"').last().click();
  await page.waitForTimeout(900);
  await page.getByText('20', { exact: true }).last().click();
  await page.waitForTimeout(900);
  check('日历 20 日弹层出现新任务', await leafText(page)('Compose quarterly report'));

  // ---- 5) 番茄元素 ----
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.resolve('marketing', '.preview', 'composer-calendar.png') });
  // 日历图例中的迷你番茄（SVG ellipse 数量 > 0 即有渲染）
  const tomatoSvgs = await page.evaluate(
    () => [...document.querySelectorAll('svg')].filter(s => s.querySelector('radialGradient')).length,
  );
  check('日历页渲染了迷你番茄（radialGradient SVG）', tomatoSvgs > 0, `${tomatoSvgs} 个`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('走查失败:', e);
  process.exit(1);
});
