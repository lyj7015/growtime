import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StoreProvider, useStore } from './src/store';
import { ThemeProvider, useTheme, useThemeMode } from './src/components/ThemeProvider';
import { PaywallProvider } from './src/components/Paywall';
import { AmbienceProvider } from './src/components/AmbienceProvider';
import { QuickAddFab, TabBar, type TabKey } from './src/components/shell';
import { TaskComposer } from './src/components/TaskComposer';
import { Button } from './src/components/ui';
import { spacing } from './src/theme';
import { OnboardingSlides } from './src/screens/OnboardingSlides';
import { HomeScreen } from './src/screens/HomeScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useTimerContext, TimerProvider } from './src/hooks/TimerProvider';
import { PERMISSION_COPY, requestPermission } from './src/services/permissions';
import { shouldShowBanner } from './src/services/ads';
// Web 端解析到 BannerAd.tsx（空实现），原生端解析到 BannerAd.native.tsx（真实 AdMob）
import { BannerAd } from './src/components/BannerAd';
// 广告生命周期（同意 → ATT → 初始化）：原生端是真实流程，Web 端是空实现
import { initAds } from './src/services/adInit';
import type { Task } from './src/types';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider>
            {/* Premium 权益与购买弹层收敛为全局单例：
                锁定项弹层、设置页购买按钮、启动时的权益检查都走这里 */}
            <PaywallProvider>
              {/* 计时器收敛为全局单例：Tasks / Calendar 启动的计时，首页能立刻看到 */}
              <TimerProvider>
                {/* 白噪音调度：需要读计时器状态，故放在 TimerProvider 内 */}
                <AmbienceProvider>
                  <Root />
                </AmbienceProvider>
              </TimerProvider>
            </PaywallProvider>
          </ThemeProvider>
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const { c, isDark } = useThemeMode();
  const { state, ready, patchOnboarding } = useStore();

  const [tab, setTab] = useState<TabKey>('home');
  const [composerOpen, setComposerOpen] = useState(false);
  const [permPrompt, setPermPrompt] = useState<{ title: string; body: string; action: string } | null>(null);

  const timer = useTimerContext();
  const { onboarding } = state;

  /**
   * 底部横幅广告是否展示：
   * 只有前三个 Tab 出广告（设置页不出），Premium 买断用户全局免广告。
   * Web 端 shouldShowBanner 恒为 false，因此线上 Web 版布局与之前完全一致。
   */
  const showBanner = shouldShowBanner(tab, state.settings.premiumUnlocked);

  /**
   * 第一次进入「会出广告的页面」时启动广告生命周期。
   * 这一步会依次完成：请求配置 → UMP 同意（EEA 用户弹同意表单）→ ATT 授权 → SDK 初始化。
   *
   * 为什么放在这里而不是冷启动瞬间：
   *  1. 此刻用户已进入主界面，ATT 弹窗出现得更自然（Apple 不建议冷启动就弹）
   *  2. 从没进过这三个 Tab 的用户不承担这部分启动开销
   *  3. initAds() 内部幂等，Tab 来回切不会重复走流程
   */
  useEffect(() => {
    if (showBanner) void initAds();
  }, [showBanner]);

  /**
   * 首次进入主界面后，温和地提一次通知权限。
   * 原先这个时机挂在「新手引导走完」那一刻，引导移除后改挂在首次进入主界面，
   * 语义等价：都是用户刚要开始正常使用 app 的时刻。
   * permAsked 保证本次会话只尝试一次；已授权 / 已拒绝时 requestPermission
   * 不会返回 undetermined，所以也不会再弹层打扰。
   */
  const permAsked = useRef(false);
  useEffect(() => {
    if (!ready || !onboarding.slidesSeen || permAsked.current) return;
    permAsked.current = true;
    const id = setTimeout(async () => {
      const r = await requestPermission('notifications');
      if (r === 'undetermined') setPermPrompt(PERMISSION_COPY.notifications);
    }, 2600);
    return () => clearTimeout(id);
  }, [ready, onboarding.slidesSeen]);

  /** 从 Tasks / Calendar 启动番茄：切回首页并开始计时 */
  const startWithTask = useCallback(
    (t: Task) => {
      if (!state.settings.features.pomodoro) return;
      timer.start(t);
      setTab('home');
    },
    [state.settings.features.pomodoro, timer],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  // 启动引导页（4 页幻灯片）→ 主界面。
  // 登录环节与 3 步交互式引导已移除，看完 / 跳过幻灯片即直接进入主界面。
  if (!onboarding.slidesSeen) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <OnboardingSlides
          onSkip={() => patchOnboarding({ slidesSeen: true })}
          onDone={() => patchOnboarding({ slidesSeen: true })}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* 内容区：屏幕 + 悬浮 FAB。
          FAB 放在内容区里，广告条 / 底部导航出现时会自动被顶上去 */}
      <View style={{ flex: 1 }}>
        {tab === 'home' ? (
          <HomeScreen onOpenTasks={() => setTab('tasks')} />
        ) : tab === 'tasks' ? (
          <TasksScreen onStartPomodoro={startWithTask} />
        ) : tab === 'calendar' ? (
          <CalendarScreen onStartPomodoro={startWithTask} />
        ) : (
          <SettingsScreen />
        )}

        <QuickAddFab
          onPress={() => setComposerOpen(true)}
          badge={state.tasks.filter(t => !t.done && t.date === undefined).length || undefined}
        />
      </View>

      {/* 底部横幅广告：前三个页面底部，不展示时高度为 0 */}
      <BannerAd visible={showBanner} />

      <TabBar active={tab} onChange={setTab} />

      {/* 右下角「+」打开的任务填写弹窗：标题 + 启动时间 + 截止时间 */}
      <TaskComposer visible={composerOpen} onClose={() => setComposerOpen(false)} />

      {permPrompt ? (
        <PermissionSheet
          copy={permPrompt}
          onDismiss={() => setPermPrompt(null)}
          onAllow={async () => {
            await requestPermission('notifications');
            setPermPrompt(null);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * 权限申请弹层
 * 先讲清楚为什么需要，再给按钮 —— 不做「首登一次性索要所有权限」。
 */
function PermissionSheet({
  copy,
  onAllow,
  onDismiss,
}: {
  copy: { title: string; body: string; action: string };
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const { c } = useThemeMode();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }]}>
      <Pressable style={{ flex: 1 }} onPress={onDismiss} />
      <View
        style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.md,
        }}
      >
        <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{copy.title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 14.5, lineHeight: 21 }}>{copy.body}</Text>
        <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 17 }}>
          We only ask when you turn on something that needs it. Everything else works without permission.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="Not now" variant="secondary" onPress={onDismiss} style={{ flex: 1 }} />
          <Button label={copy.action} onPress={onAllow} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}
