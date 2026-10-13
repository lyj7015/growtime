import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from './ThemeProvider';
import { MiniTomato, TomatoBob } from './Tomato';
import { radius, shadow, spacing } from '../theme';

/* ------------------------------ 文本 ------------------------------ */

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text style={[{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }, style]}>
      {children}
    </Text>
  );
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return <Text style={[{ color: c.textMuted, fontSize: 14, lineHeight: 20 }, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return (
    <Text
      style={[
        { color: c.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------ 容器 ------------------------------ */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: spacing.lg,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
  gap = spacing.sm,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** 胶囊小徽章，对应参考稿里的 date-pill / task-count */
export function Pill({
  children,
  icon,
  style,
}: {
  children: React.ReactNode;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: c.surface,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: 7,
          paddingHorizontal: 14,
        },
        shadow.card,
        style,
      ]}
    >
      {icon ? <Text style={{ color: c.accent, fontSize: 12 }}>{icon}</Text> : null}
      {typeof children === 'string' ? (
        <Text style={{ color: c.text, fontSize: 13, fontWeight: '800', letterSpacing: -0.2 }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * 区块标题（Today / Upcoming…）
 * 左边是主色圆形图标 + 大标题，右边可选计数胶囊 —— 对应参考稿的 Today 行。
 */
export function SectionHeader({
  icon,
  title,
  trailing,
  onTrailingPress,
}: {
  icon?: string;
  title: string;
  /** 右侧计数，如 "2/5" */
  trailing?: string;
  onTrailingPress?: () => void;
}) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md, paddingHorizontal: 2 }}>
      <Row gap={9}>
        {icon ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.accentText, fontSize: 13, fontWeight: '900' }}>✓</Text>
          </View>
        ) : null}
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{title}</Text>
      </Row>

      {trailing ? (
        <Pressable onPress={onTrailingPress} hitSlop={10}>
          <Pill icon="☰">
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>{trailing}</Text>
          </Pill>
        </Pressable>
      ) : null}
    </Row>
  );
}

/* ------------------------------ 按钮 ------------------------------ */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  compact,
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  icon?: string;
}) {
  const c = useTheme();
  const isPrimary = variant === 'primary';

  const bg = isPrimary
    ? c.accent
    : variant === 'secondary'
      ? c.surfaceAlt
      : variant === 'danger'
        ? c.accentSoft
        : 'transparent';
  const fg = isPrimary ? c.accentText : variant === 'danger' ? c.danger : variant === 'ghost' ? c.textMuted : c.text;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: compact ? 10 : 14,
          paddingHorizontal: compact ? spacing.lg : spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0,
          borderColor: variant === 'danger' ? 'transparent' : c.border,
        },
        isPrimary ? shadow.float : null,
        style,
      ]}
    >
      {icon ? <Text style={{ color: fg, fontSize: compact ? 13 : 15 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontSize: compact ? 13.5 : 15, fontWeight: '800', letterSpacing: -0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 圆形图标按钮 —— 番茄钟卡片上的 reset / skip 用这个 */
export function CircleButton({
  children,
  onPress,
  size = 44,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        },
        shadow.card,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ------------------------------ 开关 ------------------------------ */

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  /** 无障碍标签（读屏与自动化测试都靠它定位这个开关） */
  label?: string;
}) {
  const c = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
    >
      <Animated.View
        style={{
          width: 48,
          height: 29,
          borderRadius: 15,
          padding: 3,
          backgroundColor: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [c.surfaceAlt, c.accent],
          }),
          borderWidth: 1,
          borderColor: value ? 'transparent' : c.border,
        }}
      >
        <Animated.View
          style={{
            width: 21,
            height: 21,
            borderRadius: 11,
            backgroundColor: value ? c.accentText : c.surface,
            borderWidth: value ? 0 : 1,
            borderColor: c.border,
            transform: [
              { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 19] }) },
            ],
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

/** 分段选择器 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.surfaceAlt,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c.border,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: radius.pill,
              backgroundColor: on ? c.surface : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: on ? c.text : c.textMuted, fontWeight: on ? '800' : '600', fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------ 进度环 ------------------------------ */

export function TimerDial({
  progress,
  size = 240,
  children,
  trackWidth = 10,
}: {
  /** 0~1 */
  progress: number;
  size?: number;
  children?: React.ReactNode;
  trackWidth?: number;
}) {
  const c = useTheme();
  const r = (size - trackWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ring} strokeWidth={trackWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.accent}
          strokeWidth={trackWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ * clamped} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ------------------------------ 勾选框 ------------------------------ */

/**
 * 圆角方形复选框（不是圆形）
 * 未完成：淡蓝描边 + 白底
 * 已完成：主色填充 + 白色对勾
 */
export function CheckCircle({
  done,
  onPress,
  size = 26,
  locked,
}: {
  done: boolean;
  onPress?: () => void;
  size?: number;
  locked?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      hitSlop={10}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.36,
        borderWidth: 2,
        borderColor: done ? c.accent : '#CFDEEF',
        backgroundColor: done ? c.accent : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? (
        <Text style={{ color: '#FFFFFF', fontSize: size * 0.56, fontWeight: '900', lineHeight: size * 0.72 }}>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

/* ------------------------------ 番茄徽章 ------------------------------ */

/**
 * 🍅 N 胶囊徽章
 * 对应参考设计里任务卡片上的浅橙圆角标签：番茄图标 + 预估数量。
 * 传入 done / total 时显示「已完成 / 预估」，例如 3🍅 / 5🍅。
 */
export function PomoBadge({
  estimate,
  completed,
  size = 'md',
}: {
  /** 预估番茄数；没有则不渲染 */
  estimate?: number;
  /** 已实际完成的番茄数 */
  completed?: number;
  size?: 'sm' | 'md';
}) {
  const c = useTheme();
  if (!estimate) return null;

  const small = size === 'sm';
  const both = completed !== undefined && completed !== estimate;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: c.accentSoft,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: '#FFD9CE',
        paddingVertical: small ? 3 : 4,
        paddingHorizontal: small ? 7 : 9,
      }}
    >
      <MiniTomato size={small ? 10 : 12} />
      <Text style={{ color: c.accent, fontSize: small ? 10.5 : 11.5, fontWeight: '800' }}>
        {completed !== undefined ? completed : estimate}
      </Text>
      {both ? (
        <>
          <Text style={{ color: c.textFaint, fontSize: small ? 10 : 11, fontWeight: '700' }}>/</Text>
          <Text style={{ color: c.textFaint, fontSize: small ? 10 : 11, fontWeight: '700' }}>{estimate}</Text>
        </>
      ) : null}
    </View>
  );
}

/** 时钟 + 时间的元信息 */
export function TimeMeta({ time }: { time: string }) {
  const c = useTheme();
  return (
    <Row gap={4}>
      <Text style={{ color: c.accent, fontSize: 11 }}>◷</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>{time}</Text>
    </Row>
  );
}

/* ------------------------------ 空状态 ------------------------------ */

export function EmptyState({
  icon,
  title,
  hint,
  tomato,
}: {
  icon: string;
  title: string;
  hint?: string;
  /** 传入则用一颗上下浮动的迷你番茄代替字符图标 */
  tomato?: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs }}>
      {tomato ? (
        <View style={{ marginBottom: 6 }}>
          <TomatoBob size={38} />
        </View>
      ) : (
        <Text style={{ fontSize: 30, opacity: 0.5 }}>{icon}</Text>
      )}
      <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '700' }}>{title}</Text>
      {hint ? (
        <Text style={{ color: c.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------ 虚线添加按钮 ------------------------------ */

/** 对应参考稿里那个虚线圆角的 "Add new task" */
export function DashedAddButton({ label, onPress, icon = '＋' }: { label: string; onPress?: () => void; icon?: string }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: pressed ? c.surface : c.surfaceAlt,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#BED4E8',
        paddingVertical: 16,
        paddingHorizontal: spacing.lg,
      })}
    >
      <Text style={{ color: c.accent, fontSize: 18, fontWeight: '800' }}>{icon}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------ 淡入 ------------------------------ */

export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={[
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}