/**
 * 领域模型
 * 对应需求文档里 Hive 实体设计（Task / DailyRecord），在 RN 中改用
 * AsyncStorage 持久化，但字段语义保持一致，方便日后回迁或对齐后端。
 */

/** ISO 日期字符串，形如 2026-10-10。本地时区，不带时区后缀。 */
export type DateKey = string;

/** HH:mm 形如 09:30 */
export type ClockTime = string;

export type Task = {
  id: string;
  title: string;
  done: boolean;
  /** 归属日期；属于「收集箱」的任务为 undefined */
  date?: DateKey;
  /** AI 从自然语言里解析出来的时间，例如 "tomorrow 9am" → 2026-10-11 09:00 */
  time?: ClockTime;
  /**
   * 计划的启动时间（几点开始做）。
   * 与 time 的区别：time 是 AI 解析出的时间点，由快速输入框写入；
   * startTime 是用户在弹窗里明确设置的「开始时间」。日历卡片优先展示它。
   */
  startTime?: ClockTime;
  /** 截止时间（几点前必须做完）。可选，用于日历上的时间图标与逾期提示。 */
  dueTime?: ClockTime;
  /**
   * 计划启动的完整时间点（年月日时分秒，epoch 毫秒）。
   * 由任务填写弹窗写入；date/startTime 是它的「降维展示版」（归属日 + HH:mm），
   * 两者同时维护，旧数据只有后者也照常工作。
   */
  startAt?: number;
  /** 截止的完整时间点（年月日时分秒，epoch 毫秒），逾期判断优先用它 */
  dueAt?: number;
  /** 截止日期。截止与启动不同天时写入，卡片上用于展示「Oct 15 · 17:30」 */
  dueDate?: DateKey;
  /** 原始输入文本，保留以便用户看到「AI 理解成了什么」 */
  rawInput?: string;
  createdAt: number;
  completedAt?: number;
  /** 排序权重，手动拖动/创建顺序用；默认用 createdAt */
  order: number;
  /**
   * 计划投入的番茄数（预估），显示为卡片上的 🍅 N 徽章。
   * 只做展示，不参与任何强制逻辑 —— 用户填多少都行。
   */
  estimatePomos?: number;
};

/** 一次番茄钟会话 */
export type PomodoroSession = {
  id: string;
  /** 关联任务（可为空 = 自由专注） */
  taskId?: string;
  taskTitle?: string;
  /** 专注段开始时的日期，跨零点归属到开始那天 */
  date: DateKey;
  startedAt: number;
  /** 专注时长（分钟），完整走完才计入统计 */
  minutes: number;
  completed: boolean;
};

/** 每日汇总，支撑日历小圆点与当日汇总卡片 */
export type DailyRecord = {
  date: DateKey;
  pomodoros: number;
  totalFocusMinutes: number;
  taskIds: string[];
};

/** 番茄钟阶段 */
export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak';

export type TimerPreset = {
  focus: number;
  shortBreak: number;
  longBreak: number;
};

/** 功能模块按需开启（规格：默认隐藏，用到再在设置里开） */
export type FeatureModule = 'pomodoro' | 'quadrant' | 'habit';

export type FeatureFlags = Record<FeatureModule, boolean>;

/** 白噪音场景。免费 3 种，其余需 Premium 或激励广告解锁。 */
export type SoundId = 'rain' | 'library' | 'forest' | 'cafe' | 'ocean' | 'fireplace' | 'night' | 'cafe_street';

export type Sound = {
  id: SoundId;
  label: string;
  /** 免费用户可用 */
  free: boolean;
  /** 关联的专注场景，供本地 AI 做匹配推荐 */
  scene: string;
};

/** 账号。游客也有 id，但 isGuest=true 且没有 token。 */
export type Account = {
  id: string;
  /** null = 游客 */
  email: string | null;
  provider: 'guest' | 'email' | 'google' | 'apple' | 'phone' | 'wechat';
  isGuest: boolean;
  createdAt: number;
};

export type Settings = {
  themeMode: 'system' | 'light' | 'dark';
  /** 声音总开关：专注期间播放白噪音 */
  soundEnabled: boolean;
  /** 选定的白噪音（专注期间循环播放） */
  soundId: SoundId;
  hapticsEnabled: boolean;
  presets: TimerPreset;
  /** 每完成几个番茄进入长休息 */
  longBreakInterval: number;
  /** 走完一轮自动开始休息 */
  autoStartBreak: boolean;
  features: FeatureFlags;
  premiumUnlocked: boolean;
  /** 激励广告解锁到期时间戳 */
  rewardedUntil: number | null;
  /** 免打扰：番茄期间静音 */
  silentDuringFocus: boolean;
};

/** 启动引导进度 */
export type OnboardingState = {
  /** 是否已看完 / 跳过启动引导页 */
  slidesSeen: boolean;
};

export type RootState = {
  tasks: Task[];
  sessions: PomodoroSession[];
  settings: Settings;
  account: Account;
  onboarding: OnboardingState;
};