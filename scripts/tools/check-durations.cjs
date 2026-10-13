/**
 * 自定义时长走查（Web 预览）
 * ---------------------------------------------------------------------------
 * 覆盖两件事：
 *   1. 免费用户：三行时长是锁定态，点一下能打开购买弹层（而不是点了没反应）
 *   2. Premium 用户：三个时长都能自由改，且改动能落到本地存储
 *
 * 重点盯的坑：越界输入被静默丢弃 —— 输入框里写着 300，实际存的还是 25，
 * 回到首页才发现没生效。所以断言不只看界面显示，还直接读 localStorage。
 *
 * 用法：
 *   NODE_PATH=<managed node workspace> node scripts/tools/check-durations.cjs
 *
 * 产出：marketing/.preview/durations-*.png
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

function makeState({ premium, presets }) {
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
      hapticsEnabled: true,
      presets,
      longBreakInterval: 4,
      autoStartBreak: false,
      features: { pomodoro: true, quadrant: false, habit: false },
      premiumUnlocked: premium,
      rewardedUntil: null,
      silentDuringFocus: false,
    },
    account: { id: 'acc_demo', email: null, provider: 'guest', isGuest: true, createdAt: now },
    onboarding: { slidesSeen: true },
  };
}

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

/** 从 localStorage 读回真实的 presets（界面显示不等于真存下去了） */
async function storedPresets(page) {
  return page.evaluate(k => {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    try {
      return JSON.parse(raw).settings.presets;
    } catch {
      return null;
    }
  }, KEY);
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
    if (m.type() === 'error') console.log('    [browser error]', m.text().slice(0, 160));
  });

  const focusBox = page.locator('[aria-label="Focus length in minutes"]');
  const shortBox = page.locator('[aria-label="Short break length in minutes"]');
  const plus = page.locator('[aria-label="Increase by 5 minutes"]');
  const minus = page.locator('[aria-label="Decrease by 5 minutes"]');

  /** 载入指定状态并停在设置页的 Timer 卡片 */
  async function load(premium, presets) {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.evaluate(
      ([k, v]) => {
        window.localStorage.clear();
        window.localStorage.setItem(k, v);
      },
      [KEY, JSON.stringify(makeState({ premium, presets }))],
    );
    await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.locator('text="Settings"').last().click();
    await page.waitForTimeout(800);
  }

  /* ---------------- 1) 免费用户 ---------------- */
  console.log('\n1) 免费用户：时长应为锁定态，且点击能进购买弹层');
  await load(false, { focus: 25, shortBreak: 5, longBreak: 15 });

  const lockedRows = page.locator('[aria-label$="locked. Unlock Premium to change."]');
  check('三行时长都是锁定态', (await lockedRows.count()) === 3, `实际 ${await lockedRows.count()} 行`);
  check('锁定行显示固定值 25 min', (await page.getByText('25 min').count()) > 0);
  check('没有可编辑输入框', (await focusBox.count()) === 0);
  check('没有 ±5 按钮', (await plus.count()) === 0);
  await lockedRows.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'durations-free-locked.png') });

  await page.locator('[aria-label="Focus, locked. Unlock Premium to change."]').click();
  await page.waitForTimeout(900);
  check('点击锁定行打开了购买弹层', (await page.getByText('Set your own focus length').count()) > 0);
  await page.screenshot({ path: path.join(OUT, 'durations-free-paywall.png') });
  await page.getByText('Not now', { exact: true }).click();
  await page.waitForTimeout(600);
  check('关闭弹层后仍是锁定态（没被误解锁）', (await lockedRows.count()) === 3);
  check('免费用量未被写脏', JSON.stringify(await storedPresets(page)) === JSON.stringify({ focus: 25, shortBreak: 5, longBreak: 15 }));

  /* ---------------- 2) Premium 用户 ---------------- */
  console.log('\n2) Premium 用户：三个时长可自由改');
  await load(true, { focus: 25, shortBreak: 5, longBreak: 15 });

  check('三个输入框都在', (await focusBox.count()) === 1 && (await shortBox.count()) === 1 && (await page.locator('[aria-label="Long break length in minutes"]').count()) === 1);
  check('±5 按钮每行一对', (await plus.count()) === 3 && (await minus.count()) === 3, `+${await plus.count()} / -${await minus.count()}`);
  check('初值 25', (await focusBox.inputValue()) === '25');
  check('锁定态已消失', (await lockedRows.count()) === 0);

  await plus.first().click();
  await page.waitForTimeout(300);
  check('点 +5 → 30', (await focusBox.inputValue()) === '30', `显示 ${await focusBox.inputValue()}`);
  await plus.first().click();
  await page.waitForTimeout(300);
  check('再点 +5 → 35', (await focusBox.inputValue()) === '35');
  await minus.first().click();
  await page.waitForTimeout(300);
  check('点 −5 → 30', (await focusBox.inputValue()) === '30');
  check('已写入本地存储 focus=30', (await storedPresets(page))?.focus === 30, JSON.stringify(await storedPresets(page)));

  console.log('\n3) 任意值直填');
  await focusBox.fill('47');
  await page.waitForTimeout(400);
  await focusBox.blur();
  await page.waitForTimeout(400);
  check('填 47 生效', (await focusBox.inputValue()) === '47');
  check('本地存储 focus=47', (await storedPresets(page))?.focus === 47, JSON.stringify(await storedPresets(page)));

  await shortBox.fill('7');
  await page.waitForTimeout(400);
  await shortBox.blur();
  await page.waitForTimeout(400);
  check('短休填 7 生效', (await storedPresets(page))?.shortBreak === 7);
  check('焦点时长不受牵连', (await storedPresets(page))?.focus === 47);

  console.log('\n4) 越界输入应「收拢」而不是静默丢弃');
  await focusBox.fill('300');
  await page.waitForTimeout(400);
  await focusBox.blur();
  await page.waitForTimeout(500);
  check('填 300 收拢到上限 180（界面）', (await focusBox.inputValue()) === '180', `显示 ${await focusBox.inputValue()}`);
  check('填 300 收拢到上限 180（存储）', (await storedPresets(page))?.focus === 180, JSON.stringify(await storedPresets(page)));
  check('到上限后 +5 按钮置灰', (await plus.first().getAttribute('aria-disabled')) === 'true');

  await focusBox.fill('0');
  await page.waitForTimeout(400);
  await focusBox.blur();
  await page.waitForTimeout(500);
  check('填 0 收拢到下限 1（存储）', (await storedPresets(page))?.focus === 1, JSON.stringify(await storedPresets(page)));
  check('到下限后 −5 按钮置灰', (await minus.first().getAttribute('aria-disabled')) === 'true');

  await focusBox.fill('');
  await page.waitForTimeout(400);
  await focusBox.blur();
  await page.waitForTimeout(500);
  check('清空后回填原值，不留空框', (await focusBox.inputValue()) === '1', `显示 "${await focusBox.inputValue()}"`);

  console.log('\n5) 刷新后设置应保留');
  await focusBox.fill('45');
  await page.waitForTimeout(400);
  await focusBox.blur();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.locator('text="Settings"').last().click();
  await page.waitForTimeout(900);
  check('重启后 Focus 仍为 45', (await focusBox.inputValue()) === '45', `显示 ${await focusBox.inputValue()}`);
  check('重启后 Short break 仍为 7', (await shortBox.inputValue()) === '7');

  await focusBox.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'durations-premium.png') });

  console.log('\n6) 改时长不应打断正在跑的计时');
  await page.locator('text="Tasks"').last().click();
  await page.waitForTimeout(800);
  await page.getByText('▶ Pomodoro').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  const before = await page.getByText(/^\d{2}:\d{2}$/).first().textContent().catch(() => null);
  await page.locator('text="Settings"').last().click();
  await page.waitForTimeout(700);
  await focusBox.fill('90');
  await page.waitForTimeout(300);
  await focusBox.blur();
  await page.waitForTimeout(700);
  // 回计时页读剩余时间：若设置改动重置了当前段，这里会变成 89:5x
  await page.locator('text="Timer"').last().click();
  await page.waitForTimeout(900);
  const after = await page.getByText(/^\d{2}:\d{2}$/).first().textContent().catch(() => null);
  const toSec = t => {
    const [m, s] = `${t}`.split(':').map(Number);
    return m * 60 + s;
  };
  check(
    '计时运行中改时长，剩余时间不被重置',
    before !== null && after !== null && Math.abs(toSec(before) - toSec(after)) <= 3,
    `${before} → ${after}（此时设置已改为 90）`,
  );
  check('改动照样写入存储', (await storedPresets(page))?.focus === 90);

  await browser.close();
  console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项未通过'} → ${OUT}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('走查失败:', e);
  process.exit(1);
});
