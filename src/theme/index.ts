import { Platform } from 'react-native';

/**
 * GrowTime 设计语言 v2
 * -------------------------------------------------------------------
 * 视觉基调：暖橙主色 + 柔和浅蓝底 + 大圆角 + 柔和多层阴影。
 * 关键点：
 *  - 主色是「番茄橙」#FF5E3A，用在番茄钟卡片和高亮元素上
 *  - 背景不是纯白，而是带一点冷调的 #F2F6FC，让白色卡片浮起来
 *  - 圆角很大（卡片 24~28），走亲和路线
 *  - 阴影是「多层叠加 + 低透明度」，不是单层黑影，这样才有质感
 */

export const palette = {
  light: {
    /** 页面底色 */
    bg: '#F2F6FC',
    /** 卡片 / 浮层 */
    surface: '#FFFFFF',
    /** 次级填充（输入框、占位块） */
    surfaceAlt: '#F8FCFF',
    /** 描边 */
    border: '#E2EDFA',
    /** 更浅的分隔线 */
    borderSoft: '#EDF3FB',

    /** 主文字 */
    text: '#0A1C2F',
    /** 次级文字 */
    textMuted: '#6A7E94',
    /** 弱化文字 */
    textFaint: '#9AAEC2',

    /** 品牌主色（番茄橙） */
    accent: '#FF5E3A',
    /** 主色浅底 */
    accentSoft: '#FFF3F0',
    /** 主色上的文字 */
    accentText: '#FFFFFF',
    /** 主色渐变起点 */
    accentFrom: '#FF7E5F',
    /** 主色渐变终点 */
    accentTo: '#FF5E3A',

    /** 进度环底轨 */
    ring: '#FFE3DB',
    /** 危险操作 */
    danger: '#FF4D2E',
    /** 任务小圆点 */
    dot: '#FF5E3A',

    /** 番茄钟卡片上的半透明叠加（用于徽章、图标底） */
    onAccent: 'rgba(255,255,255,0.22)',
    onAccentBorder: 'rgba(255,255,255,0.28)',
  },
  dark: {
    bg: '#0E1720',
    surface: '#16202B',
    surfaceAlt: '#1D2937',
    border: '#253243',
    borderSoft: '#1E2A38',

    text: '#F2F6FC',
    textMuted: '#9AAEC2',
    textFaint: '#6B7F94',

    accent: '#FF7E5F',
    accentSoft: '#33201C',
    accentText: '#1A0E0A',
    accentFrom: '#FF8E70',
    accentTo: '#FF6B48',

    ring: '#3A2A28',
    danger: '#FF7A66',
    dot: '#FF7E5F',

    onAccent: 'rgba(255,255,255,0.18)',
    onAccentBorder: 'rgba(255,255,255,0.22)',
  },
} as const;

export type ThemeName = keyof typeof palette;
export type Colors = (typeof palette)[ThemeName];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  /** 卡片默认圆角 */
  lg: 24,
  /** 番茄钟大卡片 */
  xl: 32,
  /** 胶囊 */
  pill: 999,
} as const;

/**
 * 阴影预设
 * 多层叠加是这个设计看起来「有质感」的关键：
 * 一层偏暖色的扩散阴影 + 一层中性紧贴阴影。
 */
export const shadow = {
  /** 普通卡片 */
  card: Platform.select({
    ios: {
      shadowColor: '#0A1C2F',
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: { boxShadow: '0 6px 16px -8px rgba(10,28,47,0.12)' },
  }) as object,
  /** 悬浮元素（FAB、浮层） */
  float: Platform.select({
    ios: {
      shadowColor: '#FF5E3A',
      shadowOpacity: 0.32,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: { boxShadow: '0 10px 24px -8px rgba(255,94,58,0.4)' },
  }) as object,
  /** 深色浮层气泡 */
  bubble: Platform.select({
    ios: {
      shadowColor: '#0A1C2F',
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 10 },
    default: { boxShadow: '0 12px 28px -10px rgba(10,28,47,0.3)' },
  }) as object,
} as const;

/** 计时器等宽数字字体，避免跳动时宽度抖动 */
export const font = {
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  }) as string,
};

export type { Colors as ThemeColors };