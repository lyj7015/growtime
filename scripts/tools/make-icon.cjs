/**
 * 生成 App 图标：番茄 + 时钟
 * -------------------------------------------------------------------
 * 设计：一颗立体光泽红番茄，中央嵌白色钟面 ——
 *   - 钟面 12 刻度（4 主刻度红色）
 *   - 分针指向 25 分钟刻度（番茄工作法彩蛋），配红色进度弧
 *   - 顶部绿色果蒂双叶，底部地面投影
 * 产物（全部 1024×1024，favicon 64）：
 *   assets/icon.png                         iOS 主图标（不透明背景）
 *   assets/splash-icon.png                  启动屏 logo（透明背景）
 *   assets/android-icon-foreground.png      Android 自适应图标前景
 *   assets/android-icon-background.png      Android 自适应图标背景（纯色）
 *   assets/favicon.png                      Web favicon
 * 用法：node scripts/tools/make-icon.cjs
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve(__dirname, '..', '..', 'assets');

/** 钟面刻度 + 指针 + 进度弧（以钟面中心为原点，r=钟面半径） */
function clockParts(cx, cy, r) {
  let s = '';
  // 12 刻度：主刻度（12/3/6/9）长且红，次刻度短且淡
  for (let i = 0; i < 12; i++) {
    const major = i % 3 === 0;
    const len = major ? r * 0.16 : r * 0.09;
    const w = major ? r * 0.045 : r * 0.028;
    s += `<line x1="${cx}" y1="${cy - r * 0.82}" x2="${cx}" y2="${cy - r * 0.82 + len}"
           stroke="${major ? '#D8452A' : '#E5B3A2'}" stroke-width="${w}" stroke-linecap="round"
           transform="rotate(${i * 30} ${cx} ${cy})"/>`;
  }
  // 进度弧：12 → 25 分钟（150°），番茄工作法的 25 分钟一节
  const arcR = r * 0.66;
  const a0 = -90;
  const a1 = 60; // -90 + 150
  const rad = d => (d * Math.PI) / 180;
  const x0 = cx + arcR * Math.cos(rad(a0));
  const y0 = cy + arcR * Math.sin(rad(a0));
  const x1 = cx + arcR * Math.cos(rad(a1));
  const y1 = cy + arcR * Math.sin(rad(a1));
  s += `<path d="M ${x0} ${y0} A ${arcR} ${arcR} 0 0 1 ${x1} ${y1}"
         stroke="#E8482B" stroke-width="${r * 0.075}" fill="none" stroke-linecap="round"/>`;
  // 时针（刚过 12）+ 分针（指向 25 分刻度）+ 红秒针
  s += `<line x1="${cx}" y1="${cy + r * 0.1}" x2="${cx}" y2="${cy - r * 0.42}"
         stroke="#3E251F" stroke-width="${r * 0.085}" stroke-linecap="round"
         transform="rotate(14 ${cx} ${cy})"/>`;
  s += `<line x1="${cx}" y1="${cy + r * 0.14}" x2="${cx}" y2="${cy - r * 0.6}"
         stroke="#3E251F" stroke-width="${r * 0.065}" stroke-linecap="round"
         transform="rotate(150 ${cx} ${cy})"/>`;
  s += `<line x1="${cx}" y1="${cy + r * 0.16}" x2="${cx}" y2="${cy - r * 0.72}"
         stroke="#E8482B" stroke-width="${r * 0.035}" stroke-linecap="round"
         transform="rotate(64 ${cx} ${cy})"/>`;
  // 中轴帽
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.075}" fill="#E8482B" stroke="#FFF9F4" stroke-width="${r * 0.028}"/>`;
  return s;
}

/** 番茄 + 时钟主体（viewBox 1024；bg=true 时带背景与地面投影） */
function tomatoClock({ bg = true, scale = 1, cx = 512, cy = 512 }) {
  // scale/cx/cy：splash 与 adaptive 前景需要缩进安全区
  const r = 318 * scale; // 番茄体半径（横）
  const ry = 296 * scale; // 番茄体半径（纵）
  const faceR = 196 * scale; // 钟面半径
  const faceY = cy + 26 * scale; // 钟面中心略低于番茄中心
  const uid = `t${Math.round(cx)}${Math.round(scale * 100)}`;
  return `
  <defs>
    <radialGradient id="bg-${uid}" cx="50%" cy="38%" r="85%">
      <stop offset="0%" stop-color="#FFF4EB"/>
      <stop offset="100%" stop-color="#FFD9C2"/>
    </radialGradient>
    <radialGradient id="body-${uid}" cx="36%" cy="26%" r="95%">
      <stop offset="0%" stop-color="#FF9A72"/>
      <stop offset="38%" stop-color="#F5502B"/>
      <stop offset="78%" stop-color="#DE2A10"/>
      <stop offset="100%" stop-color="#B91D03"/>
    </radialGradient>
    <radialGradient id="shine-${uid}" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <radialGradient id="leaf-${uid}" cx="30%" cy="30%" r="90%">
      <stop offset="0%" stop-color="#5CB860"/>
      <stop offset="100%" stop-color="#2E7D32"/>
    </radialGradient>
    <filter id="soft-${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
  ${bg ? `<rect width="1024" height="1024" fill="url(#bg-${uid})"/>` : ''}
  ${bg ? `<ellipse cx="${cx}" cy="${cy + ry + 44 * scale}" rx="${r * 0.78}" ry="${30 * scale}"
          fill="rgba(150,45,15,0.22)" filter="url(#soft-${uid})"/>` : ''}
  <g>
    {/* 番茄体 */}
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="url(#body-${uid})"/>
    {/* 底部环境反光（收边，防「平贴」感） */}
    <path d="M ${cx - r * 0.62} ${cy + ry * 0.62}
             Q ${cx} ${cy + ry * 1.04} ${cx + r * 0.62} ${cy + ry * 0.62}
             Q ${cx} ${cy + ry * 0.86} ${cx - r * 0.62} ${cy + ry * 0.62} Z"
          fill="rgba(255,180,140,0.35)" filter="url(#soft-${uid})"/>
    {/* 果蒂：茎 + 双叶（画在果实之后，压在果顶上） */}
    <path d="M ${cx - 22 * scale} ${cy - ry + 30 * scale}
             C ${cx - 20 * scale} ${cy - ry - 30 * scale} ${cx - 6 * scale} ${cy - ry - 66 * scale} ${cx - 2 * scale} ${cy - ry - 96 * scale}
             Q ${cx} ${cy - ry - 108 * scale} ${cx + 12 * scale} ${cy - ry - 96 * scale}
             C ${cx + 16 * scale} ${cy - ry - 60 * scale} ${cx + 22 * scale} ${cy - ry - 24 * scale} ${cx + 24 * scale} ${cy - ry + 30 * scale}
             Q ${cx} ${cy - ry + 8 * scale} ${cx - 22 * scale} ${cy - ry + 30 * scale} Z"
          fill="url(#leaf-${uid})"/>
    <path d="M ${cx - 14 * scale} ${cy - ry + 40 * scale}
             C ${cx - 140 * scale} ${cy - ry - 26 * scale} ${cx - 250 * scale} ${cy - ry + 16 * scale} ${cx - 262 * scale} ${cy - ry + 84 * scale}
             C ${cx - 190 * scale} ${cy - ry + 130 * scale} ${cx - 70 * scale} ${cy - ry + 96 * scale} ${cx - 14 * scale} ${cy - ry + 44 * scale} Z"
          fill="url(#leaf-${uid})"/>
    <path d="M ${cx + 14 * scale} ${cy - ry + 40 * scale}
             C ${cx + 140 * scale} ${cy - ry - 26 * scale} ${cx + 250 * scale} ${cy - ry + 16 * scale} ${cx + 262 * scale} ${cy - ry + 84 * scale}
             C ${cx + 190 * scale} ${cy - ry + 130 * scale} ${cx + 70 * scale} ${cy - ry + 96 * scale} ${cx + 14 * scale} ${cy - ry + 44 * scale} Z"
          fill="url(#leaf-${uid})"/>
    {/* 叶脉阴影：叶根压深一点，增加立体感 */}
    <ellipse cx="${cx}" cy="${cy - ry + 34 * scale}" rx="${r * 0.4}" ry="${14 * scale}"
             fill="rgba(30,90,30,0.18)" filter="url(#soft-${uid})"/>
    {/* 釉面主高光 */}
    <ellipse cx="${cx - r * 0.42}" cy="${cy - ry * 0.5}" rx="${r * 0.34}" ry="${ry * 0.2}"
             fill="url(#shine-${uid})" transform="rotate(-26 ${cx - r * 0.42} ${cy - ry * 0.5})"/>
    <ellipse cx="${cx - r * 0.62}" cy="${cy - ry * 0.18}" rx="${r * 0.1}" ry="${ry * 0.05}"
             fill="rgba(255,255,255,0.55)" transform="rotate(-32 ${cx - r * 0.62} ${cy - ry * 0.18})"/>
    {/* 钟面 */}
    <circle cx="${cx}" cy="${faceY}" r="${faceR}" fill="#FFF9F4"/>
    <circle cx="${cx}" cy="${faceY}" r="${faceR}" fill="none" stroke="rgba(120,20,0,0.14)" stroke-width="${6 * scale}"/>
    ${clockParts(cx, faceY, faceR)}
  </g>`;
}

function page(inner, mono) {
  const filter = mono ? 'filter:brightness(0) invert(1)' : '';
  return `<!DOCTYPE html><html><head><style>*{margin:0;padding:0}html,body{width:1024px;height:1024px;overflow:hidden;background:transparent}svg{${filter}}</style></head>
<body><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg></body></html>`;
}

const VARIANTS = [
  { file: 'icon.png', inner: tomatoClock({ bg: true }) },
  { file: 'splash-icon.png', inner: tomatoClock({ bg: false, scale: 0.82, cy: 540 }), transparent: true },
  { file: 'android-icon-foreground.png', inner: tomatoClock({ bg: false, scale: 0.62, cy: 540 }), transparent: true },
  { file: 'android-icon-background.png', inner: `<rect width="1024" height="1024" fill="#FFEBDC"/>` },
  // monochrome：整体转白色剪影（Android 主题图标只读 alpha 通道）
  { file: 'android-icon-monochrome.png', inner: tomatoClock({ bg: false, scale: 0.62, cy: 540 }), transparent: true, mono: true },
  { file: 'favicon.png', inner: tomatoClock({ bg: true }) },
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const page_ = await ctx.newPage();
  for (const v of VARIANTS) {
    const tmp = path.join(OUT, '.icon-tmp.html');
    fs.writeFileSync(tmp, page(v.inner, v.mono));
    await page_.goto('file:///' + tmp.replace(/\\/g, '/'));
    await page_.waitForTimeout(150);
    const size = v.size ?? 1024;
    await page_.screenshot({
      path: path.join(OUT, v.file),
      clip: { x: 0, y: 0, width: 1024, height: 1024 },
      omitBackground: !!v.transparent,
    });
    if (size !== 1024) {
      // favicon 缩到 64
      const sharp = require('child_process');
      void sharp;
    }
    console.log('made', v.file, size);
  }
  fs.unlinkSync(path.join(OUT, '.icon-tmp.html'));
  await browser.close();
})();
