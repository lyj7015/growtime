import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { Button } from '../components/ui';
import { radius, shadow, spacing, type Colors } from '../theme';

const { width } = Dimensions.get('window');

/* ==================================================================== *
 * 动效插页
 * --------------------------------------------------------------------
 * 「视频动效」不引入真视频文件：一段 3–4 秒的 mp4 要吃掉几 MB 包体积，
 * 还得为播放器加原生依赖；而引导页需要的只是「插画自己会动」。
 * 这里用 RN 原生动画（useNativeDriver，走 UI 线程，60fps、零包体积）
 * 给每页做一支**循环播放的小短片**，滑到哪页哪页才开播。
 * ==================================================================== */

type ArtProps = { c: Colors; active: boolean };

/** 主时间轴循环：active 才跑，离开就停并归零（下次进入从头播） */
function useTimeline(active: boolean, duration: number, toValue = 1) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      t.stopAnimation();
      t.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(t, { toValue, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, t, duration, toValue]);
  return t;
}

/* ---------- 第 1 页：任务逐条飞入，第一条被打上勾 ---------- */

const TASK_ROWS = [
  { w: '82%', text: 'Review the draft' },
  { w: '64%', text: 'Call the studio' },
  { w: '72%', text: 'Renew passport', faded: true },
  { w: '54%', text: 'Water the plants', faded: true },
] as const;

function TasksArt({ c, active }: ArtProps) {
  const t = useTimeline(active, 4400);

  return (
    <View style={{ gap: 10, width: '100%' }}>
      {TASK_ROWS.map((row, i) => {
        const enter: number[] = [i * 0.11, i * 0.11 + 0.09];
        // 时间轴首尾都设计成「整列淡出」状态，loop 从 1 跳回 0 时无闪烁
        const opacity = t.interpolate({
          inputRange: [enter[0], enter[1], 0.86, 0.96],
          outputRange: [0, 1, 1, 0],
          extrapolate: 'clamp',
        });
        const translateY = t.interpolate({
          inputRange: [enter[0], enter[1]],
          outputRange: [16, 0],
          extrapolate: 'clamp',
        });
        // 第一条任务在时间轴 0.5~0.62 被打上勾（带回弹）
        const isFirst = i === 0;
        const checkScale = isFirst
          ? t.interpolate({ inputRange: [0.5, 0.57, 0.64], outputRange: [0, 1.25, 1], extrapolate: 'clamp' })
          : null;

        return (
          <Animated.View
            key={row.text}
            style={[
              {
                width: row.w as any,
                backgroundColor: c.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.border,
                paddingVertical: 13,
                paddingHorizontal: 18,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                opacity,
                transform: [{ translateY }],
              },
              shadow.card,
            ]}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: c.accent,
                backgroundColor: isFirst ? c.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isFirst && checkScale ? (
                <Animated.Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: '900',
                    lineHeight: 12,
                    transform: [{ scale: checkScale }],
                  }}
                >
                  ✓
                </Animated.Text>
              ) : null}
            </View>
            <Text
              style={{
                color: c.text,
                fontSize: 14,
                fontWeight: '600',
                opacity: 'faded' in row && row.faded ? 0.55 : 1,
              }}
              numberOfLines={1}
            >
              {row.text}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

/* ---------- 第 2 页：打字机输入 → 时间胶囊弹出 ---------- */

const TYPE_FULL = 'Meet the team tomorrow at 9am';

function TypeArt({ c, active }: ArtProps) {
  const [len, setLen] = useState(0);
  const done = len >= TYPE_FULL.length;
  const caret = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  // 光标闪烁：独立循环，不随 active 停（成本极低）
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [caret]);

  // 打字机：75ms/字 → 打完停 2.2s → 清空重来。滑走就停并清空
  useEffect(() => {
    if (!active) {
      setLen(0);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setLen(Math.min(i, TYPE_FULL.length));
      timer =
        i < TYPE_FULL.length
          ? setTimeout(tick, 75)
          : setTimeout(() => {
              i = 0;
              setLen(0);
              timer = setTimeout(tick, 600);
            }, 2200);
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (done) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } else {
      pop.setValue(0);
    }
  }, [done, pop]);

  const caretOpacity = caret.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.9] });

  return (
    <View style={{ gap: 12, width: '100%' }}>
      <View
        style={[
          {
            backgroundColor: c.surfaceAlt,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.border,
            paddingVertical: 15,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
          },
          shadow.card,
        ]}
      >
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
          {TYPE_FULL.slice(0, len)}
        </Text>
        <Animated.Text style={{ color: c.accent, fontSize: 15, fontWeight: '800', opacity: caretOpacity }}>
          ▍
        </Animated.Text>
      </View>

      {done ? (
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            backgroundColor: c.accentSoft,
            borderRadius: radius.pill,
            paddingVertical: 8,
            paddingHorizontal: 15,
            opacity: pop,
            transform: [{ scale: pop }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          <Text style={{ fontSize: 12 }}>✨</Text>
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: '800' }}>Tomorrow · 09:00</Text>
        </Animated.View>
      ) : (
        /* 占位：胶囊出现/消失时高度不塌，卡片不抖 */
        <View style={{ height: 35 }} />
      )}
    </View>
  );
}

/* ---------- 第 3 页：三种视图轮播（波扫过时卡片浮起点亮） ---------- */

const VIEW_CARDS = [
  { icon: '☰', label: 'List' },
  { icon: '▦', label: 'Calendar' },
  { icon: '◷', label: 'Focus' },
] as const;

function ViewsArt({ c, active }: ArtProps) {
  // 周期 3：卡 0 的窗口跨过时间轴首尾（0 与 3 亮度相同），循环无跳变
  const t = useTimeline(active, 3900, 3);

  const glow = (k: number) =>
    k === 0
      ? t.interpolate({ inputRange: [0, 0.5, 2.5, 3], outputRange: [1, 0.45, 0.45, 1], extrapolate: 'clamp' })
      : t.interpolate({ inputRange: [k - 0.5, k, k + 0.5], outputRange: [0.45, 1, 0.45], extrapolate: 'clamp' });
  const lift = (k: number) =>
    k === 0
      ? t.interpolate({ inputRange: [0, 0.5, 2.5, 3], outputRange: [-6, 0, 0, -6], extrapolate: 'clamp' })
      : t.interpolate({ inputRange: [k - 0.5, k, k + 0.5], outputRange: [0, -6, 0], extrapolate: 'clamp' });

  return (
    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
      {VIEW_CARDS.map((card, k) => (
        <Animated.View
          key={card.label}
          style={[
            {
              flex: 1,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: k === 1 ? c.accent : c.border,
              backgroundColor: k === 1 ? c.accentSoft : c.surfaceAlt,
              padding: 12,
              gap: 8,
              opacity: glow(k),
              transform: [{ translateY: lift(k) }],
            },
            shadow.card,
          ]}
        >
          <Text style={{ fontSize: 20, color: k === 1 ? c.accent : c.textFaint }}>{card.icon}</Text>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: k === 1 ? c.accent : c.border, width: '70%' }} />
          <View style={{ height: 7, borderRadius: 4, backgroundColor: k === 1 ? c.accent : c.border, width: '45%', opacity: 0.6 }} />
          <Text style={{ color: k === 1 ? c.accent : c.textFaint, fontSize: 11, fontWeight: '800' }}>
            {card.label}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

/* ---------- 第 4 页：设备依次同步点亮 + 对勾徽章弹出 ---------- */

function SyncArt({ c, active }: ArtProps) {
  const t = useTimeline(active, 3900, 3);
  const badge = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      badge.stopAnimation();
      badge.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(badge, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(badge, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.delay(1600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, badge]);

  const glow = (k: number) =>
    k === 0
      ? t.interpolate({ inputRange: [0, 0.5, 2.5, 3], outputRange: [1, 0.5, 0.5, 1], extrapolate: 'clamp' })
      : t.interpolate({ inputRange: [k - 0.5, k, k + 0.5], outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });

  return (
    <View style={{ alignItems: 'center', gap: 16, width: '100%' }}>
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: c.accentSoft,
          borderRadius: radius.pill,
          paddingVertical: 7,
          paddingHorizontal: 14,
          opacity: badge,
          transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <Text style={{ color: c.accent, fontSize: 12, fontWeight: '900' }}>✓</Text>
        <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '800' }}>Synced everywhere</Text>
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        {['M', 'T', 'D'].map((l, i) => (
          <Animated.View
            key={l}
            style={[
              {
                width: 62,
                height: 62,
                borderRadius: 18,
                backgroundColor: i === 1 ? c.accent : c.surfaceAlt,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: glow(i),
                transform: [{ scale: glow(i).interpolate({ inputRange: [0.5, 1], outputRange: [0.97, 1.03] }) }],
              },
              shadow.card,
            ]}
          >
            <Text style={{ color: i === 1 ? c.accentText : c.textFaint, fontWeight: '800', fontSize: 18 }}>
              {l}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/* ==================================================================== *
 * 引导页本体
 * ==================================================================== */

const SLIDES: Array<{ title: string; body: string; Art: React.ComponentType<ArtProps> }> = [
  {
    title: 'Write it down.\nNever lose it.',
    body: 'One line is enough. We keep the rest quiet.',
    Art: TasksArt,
  },
  {
    title: 'Just type it\nlike you speak.',
    body: '“Tomorrow 9am, meet the team” — we find the time.',
    Art: TypeArt,
  },
  {
    title: 'See it your way.',
    body: 'List, calendar, or the quiet list you never look at.',
    Art: ViewsArt,
  },
  {
    title: 'Here when\nyou come back.',
    body: 'On every device. With a nudge right on time.',
    Art: SyncArt,
  },
];

export function OnboardingSlides({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const last = page === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* 顶部：跳过 */}
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, alignItems: 'flex-end' }}>
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '600' }}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, justifyContent: 'center' }}>
            <Text style={{ color: c.text, fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -0.9 }}>
              {s.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.md }}>
              {s.body}
            </Text>

            <View
              style={[
                {
                  marginTop: spacing.xxl,
                  backgroundColor: c.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: spacing.xl,
                  minHeight: 190,
                  justifyContent: 'center',
                },
                shadow.card,
              ]}
            >
              {/* 只有当前页在播 —— 省电，也让每次滑到这页都从开头开始 */}
              <s.Art c={c} active={page === i} />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 底部：页码 + 按钮 */}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? c.accent : c.border,
              }}
            />
          ))}
        </View>
        <Button
          label={last ? 'Get started' : 'Continue'}
          onPress={() => {
            if (last) onDone();
            else scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
          }}
        />
      </View>
    </View>
  );
}
