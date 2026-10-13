/**
 * AI 时间识别与提示逻辑的自测脚本
 * 运行：npx tsx scripts/test-ai.ts   （或用 node --experimental-strip-types）
 */
import { parseNaturalLanguage, aiTaskTip, aiDailyReview, aiMatchSound } from '../src/services/ai';
import { todayKey, addDays } from '../src/utils';

let pass = 0;
let fail = 0;

function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
    console.log(`       实际: ${JSON.stringify(actual)}`);
    console.log(`       期望: ${JSON.stringify(expected)}`);
  }
}

const T = todayKey();
const T1 = addDays(T, 1);
const T2 = addDays(T, 2);

console.log('\n=== 自然语言时间识别 ===');

check(
  'tomorrow at 9am',
  (() => { const r = parseNaturalLanguage('Design review tomorrow at 9am'); return [r.date, r.time, r.title]; })(),
  [T1, '09:00', 'Design review'],
);

check(
  'today 3:30pm',
  (() => { const r = parseNaturalLanguage('Call the studio today at 3:30pm'); return [r.date, r.time, r.title]; })(),
  [T, '15:30', 'Call the studio'],
);

check(
  'in 3 days',
  (() => { const r = parseNaturalLanguage('Renew passport in 3 days'); return [r.date, r.title]; })(),
  [addDays(T, 3), 'Renew passport'],
);

check(
  'next friday',
  (() => {
    const r = parseNaturalLanguage('Submit report next friday');
    const [y, m, d] = r.date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay() === 5;
  })(),
  true,
);

check(
  '无时间信息时落到今天',
  (() => { const r = parseNaturalLanguage('Water the plants'); return [r.date, r.matched]; })(),
  [T, false],
);

check(
  '纯时间不吞掉标题',
  (() => { const r = parseNaturalLanguage('Standup at 9am'); return r.title; })(),
  'Standup',
);

check(
  '9am 不会被误读成 9 分钟后',
  (() => { const r = parseNaturalLanguage('Gym at 9am'); return r.time; })(),
  '09:00',
);

check(
  '12am / 12pm 边界',
  (() => [parseNaturalLanguage('A at 12am').time, parseNaturalLanguage('B at 12pm').time])(),
  ['00:00', '12:00'],
);

check('中文：明天 9 点开会', (() => { const r = parseNaturalLanguage('明天 9 点开会'); return [r.date, r.time]; })(), [T1, '09:00']);
check('中文：下午 3 点半', (() => parseNaturalLanguage('明天 下午 3 点半 面试').time)(), '15:30');

console.log('\n=== 番茄数识别 ===');
check('“3 🍅” → 3，且不进标题', (() => { const r = parseNaturalLanguage('Write report 3 🍅'); return [r.pomos, r.title]; })(), [3, 'Write report']);
check('“2 pomodoros”', parseNaturalLanguage('Review code 2 pomodoros').pomos, 2);
check('“5 pomos”', parseNaturalLanguage('Study 5 pomos').pomos, 5);
check('日期+时间+番茄数同时识别', (() => {
  const r = parseNaturalLanguage('Design review tomorrow at 9am 3 🍅');
  return [r.date, r.time, r.pomos, r.title];
})(), [T1, '09:00', 3, 'Design review']);
check('番茄标记从标题中移除', parseNaturalLanguage('3 🍅').title, '');
check('超过 20 的数字不当作番茄数', parseNaturalLanguage('2026 report').pomos, undefined);
check('没有番茄标记时为 undefined', parseNaturalLanguage('Plain task').pomos, undefined);
check('纯番茄数也会显示解析提示', parseNaturalLanguage('Email 2 🍅').matched, false);

console.log('\n=== AI 提示 ===');
check('任务过多时给收敛建议', aiTaskTip(9, 1), "Don't overwhelm yourself. Focus on 2~3 key tasks today.");
check('全部完成时给正反馈', aiTaskTip(3, 3), 'All clear for today. Anything left for tomorrow?');
check('历史日期轻复盘', aiDailyReview(addDays(T, -1), 4, 100), 'You finished 4 pomodoros on this day.');
check('空白日也有话说', aiDailyReview(addDays(T, -1), 0, 0), 'A quiet day. Rest is part of the process too.');
check('今天不弹复盘', aiDailyReview(T, 4, 100), null);

console.log('\n=== 白噪音场景匹配 ===');
check(
  '具体规则优先于宽泛规则（Code review → Cafe 而非 Library）',
  aiMatchSound('Code review').sound,
  'cafe',
);
check('阅读 → Library', aiMatchSound('Read chapter 3').sound, 'library');
check('写代码 → Cafe', aiMatchSound('Debug the login bug').sound, 'cafe');
check('会议 → Street', aiMatchSound('Team meeting').sound, 'cafe_street');
check('设计 → Forest', aiMatchSound('Sketch new UI').sound, 'forest');
check('无标题 → Rain', aiMatchSound(undefined).sound, 'rain');

console.log(`\n结果: ${pass} 通过, ${fail} 失败\n`);
(globalThis as any).process.exit(fail > 0 ? 1 : 0);