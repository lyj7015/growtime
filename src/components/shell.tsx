import React, { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { shadow, spacing } from '../theme';

/**
 * 主界面外壳
 * ------------------------------------------------------------------
 * 只负责两块 UI：
 *   1. 右下角「+」新建任务 FAB
 *   2. 底部 Tab 栏
 *
 * 这里原先还承载一套「3 步交互式新手引导」（useInteractiveTour /
 * TourOverlay / TourCompleteBanner，配合 CoachMark 浮层），已整体移除。
 */

/* ------------------------------------------------------------------ *
 * 右下角新建任务 FAB
 * 定位在「内容区」内部（App.tsx 把它放进 flex:1 的内容容器），
 * 因此只需相对内容区右下角定位即可，广告条 / 底部导航出现时会自然被顶上去，
 * 不需要再用硬编码的 insets 偏移量去猜底部高度。
 * ------------------------------------------------------------------ */

export function QuickAddFab({
  onPress,
  badge,
}: {
  onPress: () => void;
  badge?: number;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;

  const press = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          right: spacing.lg,
          bottom: insets.bottom + spacing.lg,
          transform: [{ scale }],
        },
        shadow.float,
      ]}
    >
      <Pressable
        onPress={press}
        style={({ pressed }) => ({
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ color: c.accentText, fontSize: 30, fontWeight: '300', marginTop: -2 }}>+</Text>
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 22,
              height: 22,
              paddingHorizontal: 6,
              borderRadius: 11,
              backgroundColor: c.danger,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: c.bg,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ *
 * 底部 Tab 栏
 * ------------------------------------------------------------------ */

export type TabKey = 'home' | 'tasks' | 'calendar' | 'settings';

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'home', label: 'Timer', icon: '◉' },
    { key: 'tasks', label: 'Tasks', icon: '✓' },
    { key: 'calendar', label: 'Calendar', icon: '▦' },
    { key: 'settings', label: 'Settings', icon: '⚙' },
  ];

  return (
    <View
      style={{
        paddingBottom: insets.bottom + spacing.sm,
        paddingTop: spacing.md,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        flexDirection: 'row',
      }}
    >
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 2 }}
          >
            <Text style={{ fontSize: 18, color: on ? c.accent : c.textFaint }}>{t.icon}</Text>
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: on ? '800' : '600',
                color: on ? c.accent : c.textFaint,
                letterSpacing: -0.1,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
