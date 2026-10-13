import { useEffect, useRef, useState } from 'react';

/**
 * 番茄钟激励语
 * -------------------------------------------------------------------
 * 三类语句，纯本地静态文案，不联网、不调大模型：
 *   - success  成功类：强调「已经做到的」，给即时正反馈
 *   - focus    专注类：强调「此刻只做一件事」，拉回注意力
 *   - persist  坚持类：强调「继续下去」，对抗中断与放弃
 *
 * 番茄钟卡片每 3 秒轮换一条。轮换不是简单洗牌 ——
 * 会按当前计时状态调整三类的出现概率：
 *   running  专注中 → 偏专注/坚持（此时讲「成功」容易让人松懈）
 *   paused   暂停   → 偏坚持（最容易放弃的时刻）
 *   idle     待机   → 偏成功（还没开始，需要的是「我也能做到」）
 *   finished 完成   → 偏成功（刚拿到结果，正反馈收益最高）
 */

export type MotivationCategory = 'success' | 'focus' | 'persist';

export const MOTIVATION: Record<MotivationCategory, string[]> = {
  success: [
    'Every finished session is proof you can.',
    'Small wins compound into big change.',
    'You showed up — that was the hard part.',
    'Progress, not perfection. Keep stacking.',
    'Done is a decision you just made.',
    'Look how far this day has already come.',
    'This is what consistency looks like.',
    'You outworked yesterday’s you.',
    'Wins like this add up quietly.',
    'One more rep for your focus muscle.',
    'Proof again: you finish what you start.',
    'That’s a real block of deep work.',
  ],
  focus: [
    'One task. Full attention. Nothing else.',
    'Attention is the rarest currency — spend it here.',
    'Deep work starts when you stop switching.',
    'Single-tasking is a superpower.',
    'Let the world wait twenty-five minutes.',
    'Quiet the noise. Keep the target.',
    'Where attention goes, results follow.',
    'Stay in the lane. The lane is enough.',
    'Nothing outside this timer matters right now.',
    'Pick one thing and go all the way in.',
    'Protect this block. It belongs to you.',
    'Your brain is warming up — stay with it.',
  ],
  persist: [
    'Momentum beats motivation.',
    'Keep going — the middle is where it counts.',
    'Show up again tomorrow. That’s the whole trick.',
    'Stuck is not stopped.',
    'Slow progress is still progress.',
    'Habits are built on days exactly like this.',
    'Don’t break the chain.',
    'Keep the promise you made to yourself.',
    'Boring consistency wins every time.',
    'One more session. That’s all it takes.',
    'The dip is temporary. You are not.',
    'Finish this one, then decide about the next.',
  ],
};

/** 短标签，展示在引语带右侧，让用户看懂这句属于哪一类 */
export const CATEGORY_LABEL: Record<MotivationCategory, string> = {
  success: 'Progress',
  focus: 'Focus',
  persist: 'Keep going',
};

/** 类别前缀符号，纯文本字形，避免引入图标字体 */
export const CATEGORY_GLYPH: Record<MotivationCategory, string> = {
  success: '✦',
  focus: '◎',
  persist: '▲',
};

export type MotivationContext = 'idle' | 'running' | 'paused' | 'finished';

export type MotivationLine = {
  text: string;
  category: MotivationCategory;
  /** 该类别下的稳定序号，供动画 key 使用 */
  index: number;
};

/** 按状态给三类语句加权。数值是相对权重，不必归一化。 */
const WEIGHTS: Record<MotivationContext, Record<MotivationCategory, number>> = {
  running: { focus: 5, persist: 3, success: 2 },
  paused: { focus: 2, persist: 5, success: 3 },
  idle: { focus: 3, persist: 2, success: 5 },
  finished: { focus: 2, persist: 3, success: 5 },
};

const CATS: MotivationCategory[] = ['success', 'focus', 'persist'];

/** 按权重抽一个类别 */
function pickCategory(ctx: MotivationContext): MotivationCategory {
  const w = WEIGHTS[ctx] ?? WEIGHTS.idle;
  const total = CATS.reduce((sum, k) => sum + w[k], 0);
  let r = Math.random() * total;
  for (const k of CATS) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return 'focus';
}

/**
 * 抽一条激励语。
 * 传入 exclude 时会避开同一条文案（同类内重抽一次），保证不会连续两句一模一样。
 */
export function pickMotivation(ctx: MotivationContext, exclude?: string): MotivationLine {
  let category = pickCategory(ctx);
  let lines = MOTIVATION[category];
  let index = Math.floor(Math.random() * lines.length);

  // 抽到重复文案就在同类里换一条；只有一类只有一条时才会放弃
  if (exclude && lines[index] === exclude && lines.length > 1) {
    index = (index + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length;
  }

  return { text: lines[index], category, index };
}

/**
 * 每 intervalMs 轮换一条激励语。
 * 计时状态（context）变化时立刻换一句，让文案与当前处境对得上。
 */
export function useRotatingMotivation(
  context: MotivationContext,
  intervalMs = 3000,
  enabled = true,
): MotivationLine {
  const [line, setLine] = useState<MotivationLine>(() => pickMotivation(context));
  // 首次渲染不换句，避免挂载瞬间闪一下
  const mounted = useRef(false);

  // 计时状态切换 → 立即换一句，让文案与当前处境对得上
  useEffect(() => {
    if (!enabled) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setLine(prev => pickMotivation(context, prev.text));
  }, [context, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setLine(prev => pickMotivation(context, prev.text));
    }, intervalMs);
    return () => clearInterval(id);
  }, [context, intervalMs, enabled]);

  return line;
}
