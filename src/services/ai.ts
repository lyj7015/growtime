import { addDays, clockToMinutes, dateKey, todayKey, uid } from '../utils';
import type { ClockTime, DateKey, SoundId, Task } from '../types';

/**
 * 本地规则 AI —— 纯离线算法，不联网、不调用大模型。
 * 规格明确要求保持轻量化本地 AI，因此这里没有任何网络请求。
 */

/* ------------------------------------------------------------------ *
 * 1. 自然语言时间识别
 * ------------------------------------------------------------------ */

export type ParsedTime = {
  /** 识别出的日期 */
  date: DateKey;
  /** 识别出的时刻，未提及则为 undefined */
  time?: ClockTime;
  /** 去掉时间描述后剩下的任务标题 */
  title: string;
  /** 原始输入 */
  raw: string;
  /** 是否真的识别到了时间 */
  matched: boolean;
  /** 识别出的预估番茄数，例如 "3 🍅" → 3 */
  pomos?: number;
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function p2(n: number) {
  return `${n}`.padStart(2, '0');
}

function clock(h: number, m = 0): ClockTime {
  const hh = ((h % 24) + 24) % 24;
  return `${p2(hh)}:${p2(m)}`;
}

/** 从文本中抽取第一个时刻，返回 minutes 与该片段在原文中的位置 */
function extractTime(raw: string): { minutes: number; start: number; end: number } | null {
  const lower = raw.toLowerCase();
  const timeRe =
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)\b|\b(?:at\s+)?(\d{1,2}):(\d{2})\b|\bat\s+(\d{1,2})\b/;

  const m = timeRe.exec(lower);
  if (!m || m.index === undefined) return null;

  // 形如 "3pm" / "3:30pm" / "15:00" / "at 9"
  const g1 = m[1] ? Number(m[1]) : undefined;
  const g2 = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.replace(/[.]/g, '');
  const g3 = m[4] ? Number(m[4]) : undefined;
  const g4 = m[5] ? Number(m[5]) : 0;
  const g5 = m[6] ? Number(m[6]) : undefined;

  let hours: number;
  let minutes = 0;
  if (g3 !== undefined) {
    hours = g3;
    minutes = g4;
  } else if (g5 !== undefined) {
    hours = g5;
  } else if (g1 !== undefined) {
    hours = g1;
    minutes = g2;
  } else {
    return null;
  }

  if (mer) {
    const isPM = mer.startsWith('p');
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59) return null;
  return { minutes: hours * 60 + minutes, start: m.index, end: m.index + m[0].length };
}

/** 抽取日期描述 */
function extractDate(raw: string, base: DateKey): { date: DateKey; start: number; end: number } | null {
  const lower = raw.toLowerCase();

  // 今天 / 明天 / 后天
  const rel: Record<string, number> = {
    today: 0, 'this afternoon': 0, tonight: 0,
    tomorrow: 1, 'next day': 1,
    'day after tomorrow': 2,
  };
  for (const [word, delta] of Object.entries(rel)) {
    const idx = lower.indexOf(word);
    if (idx >= 0) return { date: addDays(base, delta), start: idx, end: idx + word.length };
  }

  // in N days / in a week
  let m = /\bin\s+(\d+)\s+days?\b/.exec(lower);
  if (m && m.index !== undefined) {
    return { date: addDays(base, Number(m[1])), start: m.index, end: m.index + m[0].length };
  }
  m = /\bin\s+(a|one|two|three|four|five|six|seven)\s+weeks?\b/.exec(lower);
  if (m && m.index !== undefined) {
    const wordMap: Record<string, number> = {
      a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    };
    return {
      date: addDays(base, wordMap[m[1]] * 7),
      start: m.index,
      end: m.index + m[0].length,
    };
  }

  // 下周三 / next friday
  m = /\b(?:next\s+|this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(lower);
  if (m && m.index !== undefined) {
    const target = WEEKDAYS.indexOf(m[1]);
    if (target >= 0) {
      const [y, mo, d] = base.split('-').map(Number);
      const cur = new Date(y, mo - 1, d).getDay();
      let delta = (target - cur + 7) % 7;
      // "next friday" 若已过本週则顺延一周
      if (lower.startsWith('next') && delta === 0) delta = 7;
      return { date: addDays(base, delta), start: m.index, end: m.index + m[0].length };
    }
  }

  // 12月25日 / december 25 / 25 dec / 12/25
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(lower);
  if (m && m.index !== undefined) {
    const mo = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (mo >= 0 && mo <= 11 && day >= 1 && day <= 31) {
      const [yy] = base.split('-').map(Number);
      let year = m[3] ? Number(m[3]) : yy;
      if (year < 100) year += 2000;
      const dt = new Date(year, mo, day);
      // 只填月日时，若已过去则认为是明年
      if (!m[3] && dateKey(dt) < base) dt.setFullYear(year + 1);
      return { date: dateKey(dt), start: m.index, end: m.index + m[0].length };
    }
  }

  m = new RegExp(
    `\\b(${MONTHS.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})\\b`,
  ).exec(lower);
  if (m && m.index !== undefined) {
    const monthWord = m[1] ?? m[4];
    const dayStr = m[2] ?? m[3];
    const mo = MONTHS.indexOf(monthWord);
    const day = Number(dayStr);
    if (mo >= 0 && day >= 1 && day <= 31) {
      const [yy] = base.split('-').map(Number);
      const dt = new Date(yy, mo, day);
      if (dateKey(dt) < base) dt.setFullYear(yy + 1);
      return { date: dateKey(dt), start: m.index, end: m.index + m[0].length };
    }
  }

  return null;
}

/** 清理标题：去掉时间/日期片段、介词、多余空白 */
function cleanTitle(raw: string, spans: Array<[number, number]>): string {
  let s = raw;
  for (const [a, b] of spans.sort((x, y) => y[0] - x[0])) {
    s = s.slice(0, a) + ' ' + s.slice(b);
  }
  return s
    // 番茄数标记不该留在标题里：N 🍅 / N pomodoros / N x25min
    .replace(/\d+\s*(?:🍅|🥕|🍓|pomos?|pomodoros?|x\s*25\s*min)/gi, ' ')
    .replace(/\b(?:on|at|in|by|for|due|remind me to|remind me|remember to|remember)\b/gi, ' ')
    .replace(/[,\s]+/g, ' ')
    .trim()
    .replace(/^[-–—•·\s]+|[-–—•·\s]+$/g, '');
}

/**
 * 抽取预估番茄数
 * 支持 "3 🍅" / "3 pomodoros" / "5 pomos" / "2x25min"
 */
function extractPomos(raw: string): { count: number; start: number; end: number } | null {
  const m =
    /(\d+)\s*(?:🍅|🥕|🍓|pomos?|pomodoros?|x\s*25\s*min)/i.exec(raw);
  if (!m || m.index === undefined) return null;
  const n = parseInt(m[1], 10);
  // 上限 20，防止误输入（如"2026年"）导致异常大数字
  if (!Number.isFinite(n) || n < 1 || n > 20) return null;
  return { count: n, start: m.index, end: m.index + m[0].length };
}

/**
 * 核心卖点：把一句自然语言拆成「标题 + 日期 + 时刻」
 * 例："Team meeting tomorrow at 9am" → { title:'Team meeting', date: 明天, time:'09:00' }
 * 支持中英文常见表达。
 */
export function parseNaturalLanguage(input: string, base: DateKey = todayKey()): ParsedTime {
  const raw = input.trim();
  const spans: Array<[number, number]> = [];

  const d = extractDate(raw, base);
  if (d) spans.push([d.start, d.end]);
  const t = extractTime(raw);
  if (t) spans.push([t.start, t.end]);
  const p = extractPomos(raw);
  if (p) spans.push([p.start, p.end]);

  // 兼容中文：「明天 9 点开会」「周三下午 3 点半」
  let cnDate: DateKey | undefined;
  let cnTime: ClockTime | undefined;
  if (/今天/.test(raw)) cnDate = base;
  else if (/明天|明日/.test(raw)) cnDate = addDays(base, 1);
  else if (/后天/.test(raw)) cnDate = addDays(base, 2);
  if (!cnDate) {
    const cnWeek = raw.match(/周([一二三四五六日天])/);
    if (cnWeek) {
      const map: Record<string, number> = {
        一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
      };
      const target = map[cnWeek[1]];
      const [y, mo, dd] = base.split('-').map(Number);
      const cur = new Date(y, mo - 1, dd).getDay();
      let delta = (target - cur + 7) % 7;
      if (delta === 0) delta = 7;
      cnDate = addDays(base, delta);
    }
  }
  if (!cnTime) {
    const cn = raw.match(/(\d{1,2})\s*[点時时]\s*(?:(\d{1,2})\s*分?)?\s*(半)?/);
    if (cn) {
      let h = Number(cn[1]);
      const mm = cn[2] ? Number(cn[2]) : cn[3] ? 30 : 0;
      if (raw.includes('下午') || raw.includes('晚上')) {
        if (h < 12) h += 12;
      }
      cnTime = clock(h, mm);
    }
  }
  if (!cnTime) {
    const cnNoon = raw.match(/(上午|中午|下午|晚上|早上)/);
    if (cnNoon && /开会|见面|约/.test(raw)) {
      const h = cnNoon[1] === '上午' || cnNoon[1] === '早上' ? 9 : cnNoon[1] === '中午' ? 12 : 14;
      cnTime = clock(h, 0);
    }
  }

  const date = d?.date ?? cnDate;
  const time =
    t?.minutes !== undefined
      ? clock(Math.floor(t.minutes / 60), t.minutes % 60)
      : cnTime;

  // cleaned 可能是空串 —— 例如用户只输入了 “3 🍅”，没有标题文字。
// 这种情况下回退到原文，但要先剥掉已被识别掉的标记，
// 否则 “3 🍅” 会直接变成任务标题。
  const cleaned = cleanTitle(raw, spans);
  const title = cleaned || cleanTitle(raw, []);

  return {
    date: date ?? base,
    time,
    title,
    raw,
    matched: Boolean(date || time),
    pomos: p?.count,
  };
}

/* ------------------------------------------------------------------ *
 * 2. 提示类 AI（首页小字，无弹窗）
 * ------------------------------------------------------------------ */

/** AI Task Tip：任务过多时给出收敛建议 */
export function aiTaskTip(todayCount: number, doneCount: number): string | null {
  const remaining = todayCount - doneCount;
  if (remaining > 5) {
    return "Don't overwhelm yourself. Focus on 2~3 key tasks today.";
  }
  if (todayCount > 0 && doneCount === todayCount) {
    return 'All clear for today. Anything left for tomorrow?';
  }
  if (remaining === 3 && todayCount > 3) {
    return "You're on a roll. Three tasks left — keep the rhythm going.";
  }
  return null;
}

/** AI Daily Review：查看历史日期时的一句话轻复盘 */
export function aiDailyReview(date: DateKey, pomos: number, minutes: number): string | null {
  const isToday = date === todayKey();
  if (isToday) return null;
  if (pomos === 0) return 'A quiet day. Rest is part of the process too.';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (pomos >= 6) return `You finished ${pomos} pomodoros on this day — that's ${dur} of deep work.`;
  if (pomos >= 4) return `You finished ${pomos} pomodoros on this day.`;
  return `You finished ${pomos} pomodoro${pomos === 1 ? '' : 's'} on this day — ${dur} in total.`;
}

/** AI 专注提示：开始一个番茄时给一句轻引导 */
export function aiFocusHint(taskTitle?: string, phase?: 'focus' | 'break'): string {
  if (phase === 'break') return 'Break done. Small breath, then back in.';
  if (!taskTitle) return 'One task. Full attention. Start.';
  return `Focusing on “${taskTitle}”. Nothing else right now.`;
}

/* ------------------------------------------------------------------ *
 * 3. 白噪音场景匹配（按任务类型关键词，纯本地）
 * ------------------------------------------------------------------ */

/**
 * 按任务类型关键词匹配白噪音场景。
 * 顺序很重要：**更具体的规则必须排在更宽泛的前面**。
 * 例如 "Code review" 既像阅读又像写代码，必须让 code 规则先命中，
 * 否则会被 read/review 规则抢走，匹配到错误的白噪音。
 */
const SCENE_RULES: Array<{ test: RegExp; sound: SoundId; scene: string }> = [
  // 具体场景优先
  { test: /\b(code|debug|build|program|deploy|ship|programming|coding|refactor|api)\b/i, sound: 'cafe', scene: 'Steady coding' },
  { test: /\b(meet|meeting|meetings|call|interview|talk|present|presentation|sync|standup|1:1|one-on-one)\b/i, sound: 'cafe_street', scene: 'Open conversation' },
  { test: /\b(design|draw|sketch|sketching|creative|whiteboard|wireframe|prototype|illustrate)\b/i, sound: 'forest', scene: 'Open creative space' },
  { test: /\b(run|running|gym|workout|sport|train|training|swim|yoga)\b/i, sound: 'ocean', scene: 'Rhythmic motion' },
  { test: /\b(relax|meditate|meditation|sleep|rest|calm|stretch|nap|breathe)\b/i, sound: 'rain', scene: 'Calm & reset' },
  // 宽泛的阅读 / 学习场景放最后兜底
  { test: /\b(read|reading|book|study|learn|essay|thesis|paper|review|notes|homework|research)\b/i, sound: 'library', scene: 'Deep reading' },
];

/** 根据任务标题推荐白噪音场景；无匹配返回默认 */
export function aiMatchSound(taskTitle?: string): { sound: SoundId; scene: string } {
  if (!taskTitle) return { sound: 'rain', scene: 'Default focus' };
  for (const r of SCENE_RULES) {
    if (r.test.test(taskTitle)) return { sound: r.sound, scene: r.scene };
  }
  return { sound: 'rain', scene: 'Default focus' };
}

/* ------------------------------------------------------------------ *
 * 4. 任务标题 → 建议
 * ------------------------------------------------------------------ */

/** 勾选完成后的一句轻反馈，让「完成任务」有正向反馈 */
export function aiCompletePraise(doneCount: number): string {
  if (doneCount === 1) return 'First one down. Nice start.';
  if (doneCount % 5 === 0) return `${doneCount} done. That's a real rhythm.`;
  if (doneCount % 3 === 0) return 'Three more in the bag.';
  return 'Done. Keep it moving.';
}