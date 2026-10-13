/**
 * App Store 创意素材（Creative Assets）合成脚本
 * ---------------------------------------------------------------------------
 * Apple 新版产品页三个版位的静态图：
 *   · 产品页面标题 21:9   → 3840×1646  creative-header-21x9.png
 *   · 通用 16:9          → 5244×2950  creative-universal-16x9.png
 *   · 搜索结果 3:2       → 3840×2560  creative-search-3x2.png
 *
 * 规范要点（Apple《创意素材规范》）：
 *   · 图像不得含 Alpha 通道或透明度 —— 全部底色实心；
 *   · 不得出现价格/折扣、网址、版权符号 —— 文案只用功能与品牌；
 *   · 版位四周有安全区（App Store 会裁切/叠字）—— 关键内容远离边缘。
 *
 * 用法（Git Bash）：
 *   NODE_PATH=<managed node workspace> node scripts/marketing/build-creative.cjs
 *
 * 产出：marketing/creative/*.png
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.resolve(__dirname, '..', '..');
const RAW = path.join(ROOT, 'marketing', 'raw');
const ICON = path.join(ROOT, 'assets', 'icon.png');
const OUT = path.join(ROOT, 'marketing', 'creative');

/* 主截图：番茄钟运行中（状态栏浅色底 + 深色图标，底部白色 Tab 栏） */
const SHOT = 'home.png';
const STATUS_BG = '#F2F6FC';
const FG = '#0A1C2F';
const HOMEBAR_BG = '#FFFFFF';

/* ---------------------------------------------------------------- */
const statusIcons = `
<svg class="sb" viewBox="0 0 210 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="0"   y="22" width="7" height="12" rx="2.5" fill="${FG}"/>
  <rect x="12"  y="16" width="7" height="18" rx="2.5" fill="${FG}"/>
  <rect x="24"  y="10" width="7" height="24" rx="2.5" fill="${FG}"/>
  <rect x="36"  y="4"  width="7" height="30" rx="2.5" fill="${FG}"/>
  <path d="M66 16 C74 9, 86 9, 94 16" stroke="${FG}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <path d="M72 24 C77 19.5, 83 19.5, 88 24" stroke="${FG}" stroke-width="5" stroke-linecap="round" fill="none"/>
  <circle cx="80" cy="31" r="3.6" fill="${FG}"/>
  <rect x="120" y="8" width="58" height="28" rx="9" stroke="${FG}" stroke-opacity="0.4" stroke-width="3" fill="none"/>
  <rect x="125" y="13" width="42" height="18" rx="5.5" fill="${FG}"/>
  <path d="M182 16 v12 c6 -1.5, 6 -10.5, 0 -12z" fill="${FG}" fill-opacity="0.4"/>
</svg>`;

/* 三个版位：布局用 flex 居中，安全区靠 padding 保证 */
const assets = [
  {
    out: 'creative-header-21x9.png',
    W: 3840,
    H: 1646,
    pad: 230, // 安全边距
    gap: 120,
    brandIcon: 104,
    brandName: 64,
    h1: 104,
    sub: 42,
    chip: 36,
    phoneW: 555,
    float: null, // 21:9 高度紧张，不放悬浮卡
  },
  {
    out: 'creative-universal-16x9.png',
    W: 5244,
    H: 2950,
    pad: 330,
    gap: 170,
    brandIcon: 168,
    brandName: 102,
    h1: 176,
    sub: 62,
    chip: 48,
    phoneW: 930,
    float: { top: 70, left: -215 },
  },
  {
    out: 'creative-search-3x2.png',
    W: 3840,
    H: 2560,
    pad: 260,
    gap: 140,
    brandIcon: 128,
    brandName: 78,
    h1: 122,
    sub: 48,
    chip: 40,
    phoneW: 700,
    float: { top: 50, left: -160 },
  },
];

function html(a, shotB64, iconB64) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${a.W}px; height: ${a.H}px; overflow: hidden; }
  body {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${a.gap}px;
    padding: 0 ${a.pad}px;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif;
    /* 实心渐变底（无透明），橙色品牌光晕 + 冷色辅光 */
    background:
      radial-gradient(${a.H * 0.95}px ${a.H * 0.85}px at 68% 46%, rgba(255,94,58,0.16), rgba(255,94,58,0) 62%),
      radial-gradient(${a.W * 0.5}px ${a.H * 0.9}px at 4% 0%, rgba(94,146,255,0.13), rgba(94,146,255,0) 60%),
      linear-gradient(180deg, #FFFFFF 0%, #F2F6FC 52%, #E4EEFB 100%);
  }

  /* ---------------- 左侧文案 ---------------- */
  .copy { flex: 1; min-width: 0; max-width: ${Math.round(a.W * 0.46)}px; }
  .brand { display: flex; align-items: center; gap: ${Math.round(a.brandIcon * 0.28)}px; }
  .brand img { width: ${a.brandIcon}px; height: ${a.brandIcon}px; border-radius: ${Math.round(a.brandIcon * 0.23)}px;
               box-shadow: 0 ${Math.round(a.brandIcon * 0.12)} ${Math.round(a.brandIcon * 0.3)} -${Math.round(a.brandIcon * 0.12)} rgba(10,28,47,.45); }
  .brand span { font-size: ${a.brandName}px; font-weight: 800; letter-spacing: -${a.brandName * 0.02}px; color: #0A1C2F; }
  h1 {
    margin-top: ${Math.round(a.h1 * 0.5)}px;
    font-size: ${a.h1}px; line-height: 1.06; font-weight: 800;
    letter-spacing: -${a.h1 * 0.032}px; color: #0A1C2F; text-wrap: balance;
  }
  h1 em { font-style: normal; color: #FF5E3A; }
  .sub {
    margin-top: ${Math.round(a.h1 * 0.34)}px;
    font-size: ${a.sub}px; line-height: 1.4; font-weight: 500;
    letter-spacing: -0.3px; color: #6A7E94;
  }
  .chips { display: flex; gap: ${Math.round(a.chip * 0.5)}px; margin-top: ${Math.round(a.h1 * 0.4)}px; }
  .chip {
    font-size: ${a.chip}px; font-weight: 700; color: #B23A1D;
    background: rgba(255,94,58,0.10);
    border: ${Math.max(2, Math.round(a.chip * 0.06))}px solid rgba(255,94,58,0.25);
    padding: ${Math.round(a.chip * 0.38)}px ${Math.round(a.chip * 0.85)}px; border-radius: 999px; white-space: nowrap;
  }

  /* ---------------- 手机框（尺寸随 --w 缩放） ---------------- */
  .visual { position: relative; flex: none; }
  .phone {
    --w: ${a.phoneW}px; width: var(--w);
    border-radius: calc(var(--w) * .158);
    padding: calc(var(--w) * .031);
    background: linear-gradient(160deg, #2A3A4E 0%, #0E1720 55%, #22303F 100%);
    box-shadow:
      0 ${a.H * 0.05}px ${a.H * 0.09}px -${a.H * 0.03}px rgba(10, 28, 47, 0.45),
      0 ${a.H * 0.02}px ${a.H * 0.04}px -${a.H * 0.015}px rgba(10, 28, 47, 0.30),
      inset 0 1px 1px rgba(255, 255, 255, 0.28);
  }
  .screen { border-radius: calc(var(--w) * .129); overflow: hidden; background: ${STATUS_BG}; }
  .statusbar {
    height: calc(var(--w) * .112);
    background: ${STATUS_BG};
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 calc(var(--w) * .072) 0 calc(var(--w) * .082);
  }
  .time { font-size: calc(var(--w) * .047); font-weight: 700; color: ${FG}; font-variant-numeric: tabular-nums; }
  .sb { height: calc(var(--w) * .05); width: auto; display: block; }
  .screen img { display: block; width: 100%; height: auto; }
  .homebar {
    height: calc(var(--w) * .075);
    background: ${HOMEBAR_BG};
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: calc(var(--w) * .02);
  }
  .homebar span { width: calc(var(--w) * .232); height: calc(var(--w) * .009); border-radius: 999px; background: #0A1C2F; opacity: .82; }

  /* ---------------- 悬浮数据卡 ---------------- */
  .float {
    position: absolute;
    display: ${a.float ? 'flex' : 'none'};
    ${a.float ? `top: ${a.float.top}px; left: ${a.float.left}px;` : ''}
    align-items: center; gap: ${Math.round(a.phoneW * 0.045)}px;
    background: #FFFFFF; border: ${Math.max(2, Math.round(a.phoneW * 0.008))}px solid #E4ECF6;
    border-radius: ${Math.round(a.phoneW * 0.11)}px;
    padding: ${Math.round(a.phoneW * 0.055)}px ${Math.round(a.phoneW * 0.075)}px;
    box-shadow: 0 ${a.H * 0.025}px ${a.H * 0.045}px -${a.H * 0.02}px rgba(10, 28, 47, 0.5);
  }
  .float .dot { position: relative; width: ${Math.round(a.phoneW * 0.115)}px; height: ${Math.round(a.phoneW * 0.115)}px;
                border-radius: ${Math.round(a.phoneW * 0.038)}px; background: rgba(255,94,58,0.14); flex: none; }
  .float .dot::after { content: ''; position: absolute; inset: 0; margin: auto;
                       width: ${Math.round(a.phoneW * 0.036)}px; height: ${Math.round(a.phoneW * 0.036)}px;
                       border-radius: 50%; background: #FF5E3A; }
  .float strong { display: block; font-size: ${Math.round(a.phoneW * 0.052)}px; letter-spacing: -0.5px; color: #0A1C2F; }
  .float small { display: block; font-size: ${Math.round(a.phoneW * 0.042)}px; color: #8BA0B5; }
</style>
</head>
<body>
  <div class="copy">
    <div class="brand">
      <img src="data:image/png;base64,${iconB64}" alt="">
      <span>GrowTime</span>
    </div>
    <h1>Turn scattered minutes into <em>real progress</em></h1>
    <div class="sub">A calm pomodoro timer with tasks and a focus calendar.</div>
    <div class="chips">
      <span class="chip">No account needed</span>
      <span class="chip">Works offline</span>
      <span class="chip">Private by design</span>
    </div>
  </div>

  <div class="visual">
    <div class="float">
      <span class="dot"></span>
      <div><strong>4 pomodoros</strong><small>today · 1h 40m</small></div>
    </div>
    <div class="phone">
      <div class="screen">
        <div class="statusbar">
          <div class="time">9:41</div>
          ${statusIcons}
        </div>
        <img src="data:image/png;base64,${shotB64}">
        <div class="homebar"><span></span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const shotB64 = fs.readFileSync(path.join(RAW, SHOT)).toString('base64');
  const iconRaw = fs.readFileSync(ICON);
  const iconB64 = iconRaw.toString('base64');

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();

  for (const a of assets) {
    const file = path.join(OUT, `.src-${a.out}.html`);
    fs.writeFileSync(file, html(a, shotB64, iconB64));
    await page.setViewportSize({ width: a.W, height: a.H });
    await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, a.out), clip: { x: 0, y: 0, width: a.W, height: a.H } });
    fs.unlinkSync(file);
    console.log('  ✓', a.out, `(${a.W}×${a.H})`);
  }

  await browser.close();
  console.log('\n完成 →', OUT);
}

main().catch(e => {
  console.error('合成失败:', e);
  process.exit(1);
});
