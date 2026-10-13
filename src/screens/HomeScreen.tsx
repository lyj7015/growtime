import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { Card, FadeIn, Label, Pill, Row, SectionHeader } from '../components/ui';
import { PremiumUpsellRow } from '../components/Paywall';
import { TaskCard } from '../components/TaskCard';
import { TimerActionButton, TimerCard } from '../components/TimerCard';
import { QuickAdd } from '../components/QuickAdd';
import { spacing } from '../theme';
import { useStore } from '../store';
import { useTimerContext } from '../hooks/TimerProvider';
import { useAmbience } from '../components/AmbienceProvider';
import { soundLabel } from '../services/premium';
import { MiniTomato } from '../components/Tomato';
import { aiDailyReview, aiTaskTip } from '../services/ai';
import { useRotatingMotivation } from '../services/motivation';
import { formatClock, todayKey } from '../utils';
import type { Task } from '../types';

export function HomeScreen({ onOpenTasks }: { onOpenTasks: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, tasksOn, statsOn, toggleTask, pomosByTask } = useStore();
  const timer = useTimerContext();
  const ambience = useAmbience();

  const today = todayKey();
  const tasks = useMemo(() => tasksOn(today), [tasksOn, today]);
  const stats = useMemo(() => statsOn(today), [statsOn, today]);
  const pomCount = useMemo(() => pomosByTask(), [pomosByTask]);
  const done = tasks.filter(t => t.done).length;

  const pomodoroOn = state.settings.features.pomodoro;

  const tip = useMemo(() => aiTaskTip(tasks.length, done), [tasks.length, done]);
  const review = useMemo(
    () => aiDailyReview(today, stats.pomodoros, stats.totalFocusMinutes),
    [today, stats],
  );

  // 番茄钟卡片上的激励语：每 3 秒换一句，按计时状态调整三类语句的比重
  const quote = useRotatingMotivation(timer.status, 3000, pomodoroOn);

  const startWith = (t: Task) => {
    if (!pomodoroOn) return;
    timer.start(t);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        // 底部导航与广告条现在是正常流（不再悬浮覆盖内容），
        // 这里只需为右下角 FAB（58pt）留出余量即可
        paddingBottom: insets.bottom + 100,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 顶部：标题 + 日期胶囊 */}
      <FadeIn>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={9}>
            <Text style={{ color: c.accent, fontSize: 22 }}>◷</Text>
            <Text style={{ color: c.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.7 }}>
              GrowTime
            </Text>
          </Row>
          <Pill icon="▦">{shortDate()}</Pill>
        </Row>
      </FadeIn>

      {/* 今日统计：放在标题正下方，进门第一眼就看到今天的进度 */}
      {pomodoroOn ? (
        <FadeIn delay={60}>
          <Row gap={spacing.md}>
            <StatTile label="Pomodoros" value={`${stats.pomodoros}`} icon={<MiniTomato size={14} />} />
            <StatTile label="Focus time" value={fmtMinutes(stats.totalFocusMinutes)} icon="◷" />
          </Row>
        </FadeIn>
      ) : null}

      {/* 番茄钟 */}
      {pomodoroOn ? (
        <FadeIn delay={110}>
          <TimerCard
            statusLabel={timer.label}
            modeIcon={timer.isBreak ? '☕' : '◉'}
            timeText={formatClock(timer.remaining)}
            taskTitle={timer.task?.title ?? 'Free focus'}
            progress={timer.progress}
            quote={quote}
            soundLabel={ambience.playing ? soundLabel(ambience.playing) : null}
          >
            <Row gap={spacing.lg} style={{ justifyContent: 'center' }}>
              <TimerActionButton icon="↺" onPress={timer.reset} />
              {timer.status === 'running' ? (
                <TimerActionButton variant="primary" icon="❚❚" label="Pause" onPress={timer.pause} />
              ) : timer.status === 'paused' ? (
                <TimerActionButton variant="primary" icon="▶" label="Resume" onPress={timer.resume} />
              ) : (
                <TimerActionButton
                  variant="primary"
                  icon="▶"
                  label="Start"
                  onPress={() => timer.start(timer.task)}
                />
              )}
              <TimerActionButton icon="⏭" onPress={timer.skip} />
            </Row>
          </TimerCard>
        </FadeIn>
      ) : null}

      {/* AI 小字提示 */}
      {tip || review ? (
        <FadeIn delay={160}>
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingHorizontal: spacing.xs }}
          >
            <Text style={{ fontSize: 12, marginTop: 1 }}>✨</Text>
            <Text style={{ color: c.textMuted, fontSize: 12.5, lineHeight: 18, flex: 1, fontStyle: 'italic' }}>
              {review ?? tip}
            </Text>
          </View>
        </FadeIn>
      ) : null}

      {/* Premium 引导行：仅免费用户可见，一行字说清买它能得到什么，点开即购买弹层 */}
      <FadeIn delay={190}>
        <PremiumUpsellRow />
      </FadeIn>

      {/* 今日任务 */}
      <FadeIn delay={210}>
        <SectionHeader
          icon="check"
          title="Today"
          trailing={`${done}/${tasks.length}`}
          onTrailingPress={onOpenTasks}
        />

        {tasks.length === 0 ? (
          <Card>
            <Text style={{ color: c.textFaint, fontSize: 13.5, textAlign: 'center', paddingVertical: spacing.md }}>
              Nothing planned yet. Add your first task below.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {tasks.slice(0, 4).map(t => (
              <TaskCard
                key={t.id}
                task={t}
                completedPomos={pomCount[t.id]}
                onToggle={() => toggleTask(t.id)}
                onStart={pomodoroOn ? () => startWith(t) : undefined}
              />
            ))}
          </View>
        )}

        {tasks.length > 4 ? (
          <Pressable onPress={onOpenTasks} style={{ paddingTop: spacing.md }}>
            <Text style={{ color: c.textFaint, fontSize: 12.5, textAlign: 'center' }}>
              +{tasks.length - 4} more
            </Text>
          </Pressable>
        ) : null}
      </FadeIn>

      {/* 快速输入：放到任务列表下方 */}
      <FadeIn delay={260}>
        <QuickAdd date={today} />
      </FadeIn>
    </ScrollView>
  );
}


function StatTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const c = useTheme();
  return (
    <Card style={{ flex: 1, gap: 2, padding: spacing.md }}>
      <Row gap={6}>
        {typeof icon === 'string' ? (
          <Text style={{ color: c.accent, fontSize: 12 }}>{icon}</Text>
        ) : (
          icon
        )}
        <Label>{label}</Label>
      </Row>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
    </Card>
  );
}

function fmtMinutes(m: number) {
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h ${rest}m` : `${rest}m`;
}

function shortDate() {
  return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
