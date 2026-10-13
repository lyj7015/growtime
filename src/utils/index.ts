import type {
  Account,
  DateKey,
  FeatureFlags,
  OnboardingState,
  PomodoroSession,
  Settings,
  Task,
} from '../types';

/** 生成一个足够随机的本地 id */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 取本地时区的 YYYY-MM-DD。不能用 toISOString，那是 UTC，会导致跨零点归错日期。 */
export function dateKey(d: Date = new Date()): DateKey {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): DateKey {
  return dateKey(new Date());
}

/** DateKey 加减天数 */
export function addDays(key: DateKey, delta: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dateKey(dt);
}

/** 该日期是星期几（0=周日）。日历需要以周日或周一开头排布。 */
export function weekdayOf(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** 月历网格：返回 6*7=42 个日期键，从周首开始覆盖整月 */
export function monthGrid(year: number, month: number, weekStartsOn = 0): DateKey[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(year, month, 1 - lead);
  const out: DateKey[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(dateKey(dt));
  }
  return out;
}

export function isSameMonth(key: DateKey, year: number, month: number): boolean {
  const [y, m] = key.split('-').map(Number);
  return y === year && m - 1 === month;
}

export function isToday(key: DateKey): boolean {
  return key === todayKey();
}

/** HH:mm → 分钟数 */
export function clockToMinutes(c: string): number {
  const [h, m] = c.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 两位补零 */
export function p2(n: number): string {
  return `${n}`.padStart(2, '0');
}

/** 秒 → mm:ss */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
}

export const DEFAULT_PRESET = { focus: 25, shortBreak: 5, longBreak: 15 } as const;

/** 功能模块默认全部隐藏 —— 规格明确要求「默认界面极简」 */
export const DEFAULT_FEATURES: FeatureFlags = {
  pomodoro: true,
  quadrant: false,
  habit: false,
};

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  soundEnabled: true,
  soundId: 'rain',
  hapticsEnabled: true,
  presets: { ...DEFAULT_PRESET },
  longBreakInterval: 4,
  autoStartBreak: false,
  features: { ...DEFAULT_FEATURES },
  premiumUnlocked: false,
  rewardedUntil: null,
  silentDuringFocus: false,
};

export function makeGuestAccount(): Account {
  return {
    id: uid('acc'),
    email: null,
    provider: 'guest',
    isGuest: true,
    createdAt: Date.now(),
  };
}

export function defaultOnboarding(): OnboardingState {
  return { slidesSeen: false };
}

export function makeTask(partial: Partial<Task> & { title: string }): Task {
  return {
    id: uid('task'),
    title: partial.title,
    done: partial.done ?? false,
    date: partial.date,
    time: partial.time,
    startTime: partial.startTime,
    dueTime: partial.dueTime,
    startAt: partial.startAt,
    dueAt: partial.dueAt,
    dueDate: partial.dueDate,
    rawInput: partial.rawInput,
    createdAt: partial.createdAt ?? Date.now(),
    completedAt: partial.completedAt,
    order: partial.order ?? Date.now(),
    estimatePomos: partial.estimatePomos,
  };
}

export type { PomodoroSession, Settings, Task, Account, OnboardingState };