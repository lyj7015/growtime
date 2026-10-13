/**
 * 白噪音播放走查（Web 预览）
 * ---------------------------------------------------------------------------
 * 用户反馈「手机上听不到声音」，所以这个脚本不只看界面，而是**验证音频真的在播**：
 *   - expo-audio 的 web 实现用 `new Audio(uri)`，元素不挂到 DOM，因此用
 *     addInitScript 劫持 Audio 构造函数，把实例收集到 window.__audios
 *   - 判定标准是 currentTime 会在 1.5 秒内推进（仅 paused=false 不够，
 *     加载失败时元素也可以是「未暂停但没走时间」）
 *
 * 用法：
 *   NODE_PATH=<managed node workspace> node scripts/tools/check-ambience.cjs
 *
 * 产出：marketing/.preview/ambience-*.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP_URL = 'http://localhost:8081';
const KEY = 'growtime.state.v1';
const OUT = path.resolve(__dirname, '..', '..', 'marketing', '.preview');

const pad = n => `${n}`.padStart(2, '0');
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();
const now = Date.now();

const state = {
  tasks: [
    { id: 'a1', title: 'Design review with the team', done: false, date: today, startTime: '09:00', estimatePomos: 2, createdAt: now - 900000, order: now - 900000 },
    { id: 'a2', title: 'Write the Q4 product outline', done: false, date: today, startTime: '10:30', estimatePomos: 3, createdAt: now - 800000, order: now - 800000 },
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
  onboarding: { slidesSeen: true },
};

/** 读取所有播放器实例的真实状态 */
async function audios(page) {
  return page.evaluate(() =>
    (window.__audios || []).map(a => ({
      src: (a.src || '').split('/').pop(),
      paused: a.paused,
      t: Math.round(a.currentTime * 100) / 100,
      loop: a.loop,
      volume: Math.round(a.volume * 100) / 100,
      ready: a.readyState,
      err: a.error ? a.error.code : null,
    })),
  );
}

/** 等 currentTime 真的往前走，返回推进量 */
async function advanced(page, ms = 1500) {
  const before = (await audios(page)).filter(a => !a.paused).map(a => a.t);
  await page.waitForTimeout(ms);
  const after = (await audios(page)).filter(a => !a.paused).map(a => a.t);
  if (!before.length) return null;
  return Math.round((after[after.length - 1] - before[before.length - 1]) * 100) / 100;
}

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
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

  // 劫持 Audio 构造函数（必须在页面脚本之前执行）
  await ctx.addInitScript(() => {
    const Orig = window.Audio;
    window.__audios = [];
    window.Audio = function (...args) {
      const el = new Orig(...args);
      window.__audios.push(el);
      return el;
    };
    window.Audio.prototype = Orig.prototype;
  });

  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') console.log('    [browser error]', m.text().slice(0, 160));
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(([k, v]) => {
    window.localStorage.clear();
    window.localStorage.setItem(k, v);
  }, [KEY, JSON.stringify(state)]);
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  console.log('\n1) 设置页试听');
  await page.locator('text="Settings"').last().click();
  await page.waitForTimeout(800);
  await page.locator('[aria-label="Rain"]').click();
  const adv1 = await advanced(page, 1500);
  const a1 = await audios(page);
  check('点击 Rain 后有播放器在走时间', adv1 !== null && adv1 > 0.5, `+${adv1}s  ${JSON.stringify(a1[a1.length - 1] || {})}`);
  check('加载的是 rain.m4a', (a1[a1.length - 1] || {}).src === 'rain.m4a');
  check('loop = true', (a1[a1.length - 1] || {}).loop === true);
  await page.screenshot({ path: path.join(OUT, 'ambience-settings-playing.png') });

  console.log('\n2) 再点一次应停止');
  await page.locator('[aria-label="Rain"]').click();
  await page.waitForTimeout(700);
  const a2 = await audios(page);
  check('全部已暂停', a2.every(a => a.paused), JSON.stringify(a2.map(a => a.paused)));

  console.log('\n3) 切到另一段应换文件并继续播');
  await page.locator('[aria-label="Library"]').click();
  const adv3 = await advanced(page, 1500);
  const a3 = await audios(page);
  check('Library 在播放', adv3 !== null && adv3 > 0.5, `+${adv3}s`);
  check('加载的是 library.m4a', (a3[a3.length - 1] || {}).src === 'library.m4a');

  console.log('\n4) 离开设置页应停止试听');
  await page.locator('text="Timer"').last().click();
  await page.waitForTimeout(900);
  const a4 = await audios(page);
  check('离开后已暂停', a4.every(a => a.paused));

  console.log('\n5) 专注计时中应自动播放选定的白噪音');
  await page.locator('text="Tasks"').last().click();
  await page.waitForTimeout(800);
  await page.getByText('▶ Pomodoro').first().click({ timeout: 8000 });
  await page.waitForTimeout(1500);
  const adv5 = await advanced(page, 1500);
  const a5 = await audios(page);
  check('计时开始后自动播放', adv5 !== null && adv5 > 0.5, `+${adv5}s`);
  check('播的是设置里选的那段（library）', (a5[a5.length - 1] || {}).src === 'library.m4a');
  check('界面出现 ♪ 徽章', (await page.getByText('♪', { exact: true }).count()) > 0);
  await page.screenshot({ path: path.join(OUT, 'ambience-home-playing.png'), fullPage: false });

  console.log('\n6) 暂停计时应停声');
  await page.getByText('Pause', { exact: true }).first().click();
  await page.waitForTimeout(800);
  const a6 = await audios(page);
  check('暂停后已停声', a6.every(a => a.paused));
  await page.screenshot({ path: path.join(OUT, 'ambience-home-paused.png') });

  console.log('\n7) 总开关关闭后再点音效：应顺手打开并出声（而不是点了没反应）');
  await page.locator('text="Settings"').last().click();
  await page.waitForTimeout(700);
  const before7 = (await audios(page)).length;
  await page.locator('[aria-label="Focus sound"]').click();
  await page.waitForTimeout(500);
  check('总开关已关闭（文案随之变化）', (await page.getByText('Off — stays silent during focus.').count()) > 0);
  await page.locator('[aria-label="Library"]').click();
  const adv7 = await advanced(page, 1500);
  check('点击后恢复播放', adv7 !== null && adv7 > 0.5, `+${adv7}s`);
  check('开关被自动打开（文案随之变化）', (await page.getByText(/^Plays/).count()) > 0);

  console.log('\n8) 总开关关闭后，专注计时不应出声');
  await page.locator('[aria-label="Focus sound"]').click(); // 再关掉
  await page.waitForTimeout(400);
  const before8 = (await audios(page)).length;
  await page.locator('text="Tasks"').last().click();
  await page.waitForTimeout(700);
  await page.getByText('▶ Pomodoro').first().click({ timeout: 8000 });
  await page.waitForTimeout(1600);
  const a8 = await audios(page);
  check('计时运行但保持静音', a8.slice(before8).every(a => a.paused), JSON.stringify(a8.slice(-1)));
  check('界面无 ♪ 徽章', (await page.getByText('♪', { exact: true }).count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'ambience-sound-off.png') });

  await browser.close();
  console.log(`\n${failures === 0 ? '全部通过' : failures + ' 项未通过'} → ${OUT}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('走查失败:', e);
  process.exit(1);
});
