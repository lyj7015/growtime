/**
 * Premium 权益中心（单一事实来源）
 * ---------------------------------------------------------------------------
 * 免费版（永久可用，不做任何削减）：
 *   番茄钟（25 / 5 / 15）、任务、日历、统计、3 种白噪音、底部横幅广告。
 *
 * Premium（一次性买断）解锁的三项权益：
 *   1. no_ads      去掉全部横幅广告
 *   2. sounds      8 种白噪音全部解锁（免费 3 种）
 *   3. durations   自定义专注 / 短休 / 长休时长（免费固定 25 / 5 / 15）
 *
 * 为什么要有这个文件：
 *   权益文案一旦分散在设置页、弹层、营销页里，就必然漂移 ——
 *   用户看到的「买它能得到什么」和代码里真正限制的东西必须是同一份清单。
 *   这里同时被 components/Paywall.tsx、screens/SettingsScreen.tsx、
 *   screens/HomeScreen.tsx 消费；App Store 的支持页/营销页文案也照这份清单写。
 */
import type { SoundId } from '../types';

// ---------------------------------------------------------------------------
// 白噪音目录
// ---------------------------------------------------------------------------

export type SoundOption = {
  id: SoundId;
  label: string;
  /** 免费用户可用 */
  free: boolean;
  /** 与该声音匹配的专注场景，用于列表副标题与本地 AI 匹配说明 */
  scene: string;
};

/**
 * 顺序即列表顺序：免费的三首先出现，付费的排在后面 ——
 * 让免费用户一眼看到「我有的」和「还差什么」，而不是一屏锁。
 */
export const SOUNDS: readonly SoundOption[] = [
  { id: 'rain', label: 'Rain', free: true, scene: 'Calm & reset' },
  { id: 'library', label: 'Library', free: true, scene: 'Deep reading' },
  { id: 'forest', label: 'Forest', free: true, scene: 'Open creative space' },
  { id: 'cafe', label: 'Café', free: false, scene: 'Steady coding' },
  { id: 'ocean', label: 'Ocean', free: false, scene: 'Rhythmic motion' },
  { id: 'fireplace', label: 'Fireplace', free: false, scene: 'Warm evening' },
  { id: 'night', label: 'Night', free: false, scene: 'Late hours' },
  { id: 'cafe_street', label: 'Street', free: false, scene: 'Open conversation' },
];

export const FREE_SOUND_COUNT = SOUNDS.filter(s => s.free).length;
export const TOTAL_SOUND_COUNT = SOUNDS.length;

/** 该白噪音是否对当前用户上锁 */
export function isSoundLocked(id: SoundId, premiumUnlocked: boolean): boolean {
  if (premiumUnlocked) return false;
  return !SOUNDS.some(s => s.id === id && s.free);
}

export function soundLabel(id: SoundId): string {
  return SOUNDS.find(s => s.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// 计时预设
// ---------------------------------------------------------------------------

/** 免费版固定档位（与 utils 里的 DEFAULT_PRESET 保持一致） */
export const FREE_PRESET = { focus: 25, shortBreak: 5, longBreak: 15 } as const;

/** 自定义时长的允许区间（分钟） */
export const PRESET_MIN = 1;
export const PRESET_MAX = 180;

/**
 * 免费用户不能改时长。
 * 注意：只拦「修改」，不回写历史数据 —— 老用户之前存下的自定义值照旧生效，
 * 不会因为这次改动被悄悄重置。
 */
export function isDurationsLocked(premiumUnlocked: boolean): boolean {
  return !premiumUnlocked;
}

// ---------------------------------------------------------------------------
// 权益清单（设置页对比 + 购买弹层共用）
// ---------------------------------------------------------------------------

export type PremiumPerk = {
  id: PremiumFeatureId;
  icon: string;
  title: string;
  detail: string;
};

export type PremiumFeatureId = 'no_ads' | 'sounds' | 'durations' | 'general';

export const PREMIUM_PERKS: readonly PremiumPerk[] = [
  {
    id: 'no_ads',
    icon: '⊘',
    title: 'No banner ads',
    detail: 'Timer, Tasks and Calendar stay completely clean.',
  },
  {
    id: 'sounds',
    icon: '♪',
    title: `All ${TOTAL_SOUND_COUNT} focus sounds`,
    detail: `${FREE_SOUND_COUNT} are free — unlock the other ${TOTAL_SOUND_COUNT - FREE_SOUND_COUNT}.`,
  },
  {
    id: 'durations',
    icon: '◷',
    title: 'Custom focus & break lengths',
    detail: `Any length from ${PRESET_MIN} to ${PRESET_MAX} minutes, not just 25 / 5 / 15.`,
  },
];

/** 设置页文案用：一句话说清免费版有什么，免得用户以为被砍了功能 */
export const FREE_TIER_SUMMARY =
  'Free forever: full pomodoro timer, unlimited tasks, the calendar and all statistics.';

// ---------------------------------------------------------------------------
// 购买弹层文案
// ---------------------------------------------------------------------------

export type PaywallCopy = {
  /** 弹层大标题 */
  title: string;
  /** 触发场景的一句上下文 */
  context: string;
};

/**
 * 按触发场景生成弹层文案。
 * 用户点到哪就把哪件事说清楚 —— 比一刀切的「升级吧」可信得多。
 */
export function paywallCopy(
  feature: PremiumFeatureId,
  opts: { soundLabel?: string } = {},
): PaywallCopy {
  switch (feature) {
    case 'sounds':
      return {
        title: 'Unlock every focus sound',
        context: opts.soundLabel
          ? `“${opts.soundLabel}” is part of Premium. ${FREE_SOUND_COUNT} sounds stay free forever.`
          : `Premium unlocks all ${TOTAL_SOUND_COUNT} focus sounds. ${FREE_SOUND_COUNT} stay free forever.`,
      };
    case 'durations':
      return {
        title: 'Set your own focus length',
        context:
          'Premium lets you run any focus and break length you want, instead of the fixed 25 / 5 / 15.',
      };
    case 'no_ads':
      return {
        title: 'Go ad-free',
        context: 'One purchase removes every banner ad, on every screen, for good.',
      };
    default:
      return {
        title: 'Go Premium',
        context: 'One purchase. No subscription, nothing to cancel.',
      };
  }
}

/** 购买按钮的兜底价格文案（真实价格以商店返回的 localizedPrice 为准） */
export const FALLBACK_PRICE = '$9.99';
