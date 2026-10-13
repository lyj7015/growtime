/**
 * App Store 宣传图合成脚本 — iPad Pro 13" 版
 * ---------------------------------------------------------------------------
 * 把 marketing/raw-ipad 里的 2064×2752 原始截图，套上营销标题、iPad 设备框、
 * iOS 状态栏与 Home 指示条，输出 3 张 2064×2752 的成品宣传图。
 *
 * 用法（Git Bash）：
 *   NODE_PATH=<managed node workspace> node scripts/marketing/build-posters-ipad.cjs
 *
 * 产出：marketing/appstore-ipad-{1,2,3}.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RAW = path.resolve(__dirname, '..', '..', 'marketing', 'raw-ipad13');
const OUT = path.resolve(__dirname, '..', '..', 'marketing');

/* iPad Pro 13" (M4) 截图槽位要求：竖屏 2007 × 2853 */
const W = 2007;
const H = 2853;

const posters = [
  {
    shot: 'home.png',
    out: 'appstore-ipad-1.png',
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
    out: 'appstore-ipad-2.png',
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
    out: 'appstore-ipad-3.png',
    headline: 'See your whole month <em>at a glance</em>',
    sub: 'Deadlines, scheduled tasks and focus history — all on one calm calendar.',
    glow: 'rgba(255,94,58,0.16)',
    glowX: '82%',
    glowY: '50%',
    // 日历详情弹层打开时屏幕整体压暗：状态栏条带跟随变暗、图标转白
    statusBg: 'rgb(138,144,152)',
    fg: '#FFFFFF',
    homebarBg: '#F2F6FC',
  },
];

/* iOS 状态栏右侧图标（信号 / Wi-Fi / 电池）；iPad 无刘海，样式与 iPhone 相同 */
function statusIcons(fg, s) {
  const w = Math.round(210 * s);
  const h = Math.round(40 * s);
  return `
<svg width="${w}" height="${h}" viewBox="0 0 210 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="0"   y="22" width="7" height="12" rx="2.5" fill="${fg}"/>
  <rect x="12"  y="16" width="7" height="18" rx="2.5" fill="${fg}"/>
  <rect x="24"  y="10" width="7" height="24" rx="2.5" fill="${fg}"/>
  <rect x="36"  y="4"  width="7" height="30" rx="2.5" fill="${fg}"/>
  <path d="M66 16 C74 9, 86 9, 94 16" stroke="${fg}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M72 24 C77 19.5, 83 19.5, 88 24" stroke="${fg}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <circle cx="80" cy="31" r="3.6" fill="${fg}"/>
  <rect x="120" y="8" width="58" height="28" rx="9" stroke="${fg}" stroke-opacity="0.4" stroke-width="3" fill="none"/>
  <rect x="125" y="13" width="42" height="18" rx="5.5" fill="${fg}"/>
  <path d="M182 16 v12 c6 -1.5, 6 -10.5, 0 -12z" fill="${fg}" fill-opacity="0.4"/>
</svg>`;
}

/* iPad 版面参数（画布 2007×2853，竖屏 9:12.8，比旧 12.9" 槽位略窄略高） */
const L = {
  copyTop: 138,
  copySide: 126,
  h1: 100,
  sub: 41,
  // 设备框：外宽 1300，padding 22 → 屏宽 1256 → 图高 1256*2853/2007 ≈ 1786
  phoneW: 1300,
  phonePad: 22,
  phoneRadius: 62,
  screenRadius: 42,
  statusH: 116,
  timeSize: 44,
  iconScale: 1.25,
  homebarH: 90,
  homebarW: 312,
  phoneTop: 733,
};

function html(p, b64) {
  const screenW = L.phoneW - L.phonePad * 2;
  const imgH = Math.round((screenW * H) / W);
  const deviceH = L.phonePad * 2 + L.statusH + imgH + L.homebarH;

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
      radial-gradient(1100px 900px at ${p.glowX} ${p.glowY}, ${p.glow}, rgba(255,94,58,0) 62%),
      radial-gradient(1500px 1100px at 88% -6%, rgba(94,146,255,0.14), rgba(94,146,255,0) 60%),
      linear-gradient(180deg, #FFFFFF 0%, #F2F6FC 46%, #E4EEFB 100%);
  }

  .copy {
    position: absolute;
    top: ${L.copyTop}px;
    left: ${L.copySide}px;
    right: ${L.copySide}px;
    text-align: center;
  }
  h1 {
    font-size: ${L.h1}px;
    line-height: 1.12;
    font-weight: 800;
    letter-spacing: -3.5px;
    color: #0A1C2F;
    text-wrap: balance;
  }
  h1 em { font-style: normal; color: #FF5E3A; }
  .sub {
    margin-top: 30px;
    font-size: ${L.sub}px;
    line-height: 1.42;
    font-weight: 500;
    letter-spacing: -0.4px;
    color: #6A7E94;
  }

  /* ---------------- iPad 设备框（均匀窄边框，无刘海） ---------------- */
  .phone {
    position: absolute;
    top: ${L.phoneTop}px;
    left: 50%;
    transform: translateX(-50%);
    width: ${L.phoneW}px;
    border-radius: ${L.phoneRadius}px;
    background: linear-gradient(160deg, #2A3A4E 0%, #0E1720 55%, #22303F 100%);
    padding: ${L.phonePad}px;
    box-shadow:
      0 70px 140px -44px rgba(10, 28, 47, 0.45),
      0 28px 56px -22px rgba(10, 28, 47, 0.30),
      inset 0 1px 1px rgba(255, 255, 255, 0.28);
  }
  .screen {
    border-radius: ${L.screenRadius}px;
    overflow: hidden;
    background: ${p.statusBg};
  }

  /* 顶部状态栏（与截图同底色，视觉上无缝拼接） */
  .statusbar {
    height: ${L.statusH}px;
    background: ${p.statusBg};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 64px 0 78px;
  }
  .time {
    font-size: ${L.timeSize}px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: ${p.fg};
    font-variant-numeric: tabular-nums;
  }

  .screen img { display: block; width: ${screenW}px; height: ${imgH}px; }

  /* Home 指示条（底色跟随截图最后一行的背景色，无缝拼接） */
  .homebar {
    height: ${L.homebarH}px;
    background: ${p.homebarBg};
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 24px;
  }
  .homebar span {
    width: ${L.homebarW}px;
    height: 12px;
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

  <div class="phone" style="height: ${deviceH}px;">
    <div class="screen">
      <div class="statusbar">
        <div class="time">9:41</div>
        <div>${statusIcons(p.fg, L.iconScale)}</div>
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
