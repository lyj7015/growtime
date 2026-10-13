/**
 * App Store 宣传图合成脚本
 * ---------------------------------------------------------------------------
 * 把 marketing/raw 里的 1206×2622 原始截图，套上营销标题、设备框、
 * iOS 状态栏与 Home 指示条，输出 3 张 1206×2622 的成品宣传图。
 *
 * 用法（Git Bash）：
 *   NODE_PATH=<managed node workspace> node scripts/marketing/build-posters.cjs
 *
 * 产出：marketing/appstore-{1,2,3}.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAW = path.resolve(__dirname, '..', '..', 'marketing', 'raw');
const OUT = path.resolve(__dirname, '..', '..', 'marketing');

const W = 1206;
const H = 2622;

const posters = [
  {
    shot: 'home.png',
    out: 'appstore-1.png',
    headline: 'Turn 25 minutes into <em>real progress</em>',
    sub: 'A pomodoro timer that turns scattered minutes into daily momentum.',
    glow: 'rgba(255,94,58,0.20)',
    glowX: '50%',
    glowY: '58%',
    statusBg: '#F2F6FC',
    fg: '#0A1C2F',
    homebarBg: '#FFFFFF',
  },
  {
    shot: 'tasks.png',
    out: 'appstore-2.png',
    headline: 'Plan your day <em>in seconds</em>',
    sub: 'Type one line to get a task — with times, estimates and pomodoro counts built in.',
    glow: 'rgba(255,126,95,0.18)',
    glowX: '18%',
    glowY: '52%',
    statusBg: '#F2F6FC',
    fg: '#0A1C2F',
    homebarBg: '#FFFFFF',
  },
  {
    shot: 'calendar.png',
    out: 'appstore-3.png',
    headline: 'See your whole month <em>at a glance</em>',
    sub: 'Deadlines, scheduled tasks and focus history — all on one calm calendar.',
    glow: 'rgba(255,94,58,0.16)',
    glowX: '82%',
    glowY: '50%',
    // 日历图里当日详情弹层打开，屏幕整体压暗：状态栏条带跟随变暗、图标转白
    statusBg: 'rgb(138,144,152)',
    fg: '#FFFFFF',
    homebarBg: '#F2F6FC',
  },
];

/* iOS 状态栏右侧图标（信号 / Wi-Fi / 电池），走 SVG 手绘；颜色跟随 fg */
function statusIcons(fg) {
  return `
<svg width="210" height="40" viewBox="0 0 210 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- signal bars -->
  <rect x="0"   y="22" width="7" height="12" rx="2.5" fill="${fg}"/>
  <rect x="12"  y="16" width="7" height="18" rx="2.5" fill="${fg}"/>
  <rect x="24"  y="10" width="7" height="24" rx="2.5" fill="${fg}"/>
  <rect x="36"  y="4"  width="7" height="30" rx="2.5" fill="${fg}"/>
  <!-- wifi -->
  <path d="M66 16 C74 9, 86 9, 94 16" stroke="${fg}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M72 24 C77 19.5, 83 19.5, 88 24" stroke="${fg}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <circle cx="80" cy="31" r="3.6" fill="${fg}"/>
  <!-- battery -->
  <rect x="120" y="8" width="58" height="28" rx="9" stroke="${fg}" stroke-opacity="0.4" stroke-width="3" fill="none"/>
  <rect x="125" y="13" width="42" height="18" rx="5.5" fill="${fg}"/>
  <path d="M182 16 v12 c6 -1.5, 6 -10.5, 0 -12z" fill="${fg}" fill-opacity="0.4"/>
</svg>`;
}

function html(p, b64) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    position: relative;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background:
      radial-gradient(900px 760px at ${p.glowX} ${p.glowY}, ${p.glow}, rgba(255,94,58,0) 62%),
      radial-gradient(1200px 900px at 88% -6%, rgba(94,146,255,0.14), rgba(94,146,255,0) 60%),
      linear-gradient(180deg, #FFFFFF 0%, #F2F6FC 46%, #E4EEFB 100%);
  }

  .copy {
    position: absolute;
    top: 150px;
    left: 90px;
    right: 90px;
    text-align: center;
  }
  h1 {
    font-size: 92px;
    line-height: 1.13;
    font-weight: 800;
    letter-spacing: -3.5px;
    color: #0A1C2F;
    text-wrap: balance;
  }
  h1 em { font-style: normal; color: #FF5E3A; }
  .sub {
    margin-top: 30px;
    font-size: 39px;
    line-height: 1.42;
    font-weight: 500;
    letter-spacing: -0.4px;
    color: #6A7E94;
  }

  /* ---------------- 设备框 ---------------- */
  .phone {
    position: absolute;
    top: 566px;
    left: 50%;
    transform: translateX(-50%);
    width: 860px;
    border-radius: 96px;
    background: linear-gradient(160deg, #2A3A4E 0%, #0E1720 55%, #22303F 100%);
    padding: 16px;
    box-shadow:
      0 60px 120px -40px rgba(10, 28, 47, 0.45),
      0 24px 48px -20px rgba(10, 28, 47, 0.30),
      inset 0 1px 1px rgba(255, 255, 255, 0.28);
  }
  .screen {
    border-radius: 80px;
    overflow: hidden;
    background: #F2F6FC;
  }

  /* 顶部状态栏（与截图同底色，视觉上无缝拼接） */
  .statusbar {
    height: 116px;
    background: ${p.statusBg};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30px 58px 0 74px;
  }
  .time {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: ${p.fg};
    font-variant-numeric: tabular-nums;
  }

  .screen img { display: block; width: 828px; height: auto; }

  /* Home 指示条（底色跟随截图最后一行的背景色，无缝拼接） */
  .homebar {
    height: 84px;
    background: ${p.homebarBg};
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 22px;
  }
  .homebar span {
    width: 280px;
    height: 11px;
    border-radius: 6px;
    background: #0A1C2F;
    opacity: 0.82;
  }
</style>
</head>
<body>
  <div class="copy">
    <h1>${p.headline}</h1>
    <div class="sub">${p.sub}</div>
  </div>

  <div class="phone">
    <div class="screen">
      <div class="statusbar">
        <div class="time">9:41</div>
        <div>${statusIcons(p.fg)}</div>
      </div>
      <img src="data:image/png;base64,${b64}">
      <div class="homebar"><span></span></div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  for (const p of posters) {
    const b64 = fs.readFileSync(path.join(RAW, p.shot)).toString('base64');
    const file = path.join(OUT, `.poster-src-${p.out}.html`);
    fs.writeFileSync(file, html(p, b64));
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, p.out), clip: { x: 0, y: 0, width: W, height: H } });
    fs.unlinkSync(file);
    console.log('  ✓', p.out);
  }

  await browser.close();
  console.log('\n完成 →', OUT);
}

main().catch(e => {
  console.error('合成失败:', e);
  process.exit(1);
});
