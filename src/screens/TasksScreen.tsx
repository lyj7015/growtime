import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import {
  Card,
  CheckCircle,
  EmptyState,
  FadeIn,
  Label,
  PomoBadge,
  Row,
  Segmented,
  TimeMeta,
} from '../components/ui';
import { QuickAdd } from '../components/QuickAdd';
import { radius, spacing } from '../theme';
import { useStore } from '../store';
import { todayKey } from '../utils';
import type { Task } from '../types';

type Filter = 'today' | 'all' | 'completed';

export function TasksScreen({
  onStartPomodoro,
}: {
  onStartPomodoro: (t: Task) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, toggleTask, removeTask, tasksOn, pomosByTask } = useStore();
  const [filter, setFilter] = useState<Filter>('today');

  const today = todayKey();
  const todayTasks = useMemo(() => tasksOn(today), [tasksOn, today]);
  const pomCount = useMemo(() => pomosByTask(), [pomosByTask]);

  const list = useMemo(() => {
    if (filter === 'today') return todayTasks;
    if (filter === 'completed') {
      return state.tasks
        .filter(t => t.done)
        .slice()
        .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
    }
    return state.tasks
      .slice()
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return b.createdAt - a.createdAt;
      });
  }, [filter, state.tasks, todayTasks]);

  const pomodoroOn = state.settings.features.pomodoro;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        // 底部导航与广告条现在是正常流（不再悬浮覆盖内容），
        // 这里只需为右下角 FAB（58pt）留出余量即可
        paddingBottom: insets.bottom + 100,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn>
        <Text style={{ color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }}>Tasks</Text>
      </FadeIn>

      <FadeIn delay={50}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'all', label: 'All' },
            { value: 'completed', label: 'Completed' },
          ]}
        />
      </FadeIn>

      {filter === 'today' ? (
        <FadeIn delay={90}>
          <QuickAdd date={today} compact />
        </FadeIn>
      ) : null}

      <FadeIn delay={130}>
        {list.length === 0 ? (
          <Card>
            <EmptyState
              icon="✓"
              tomato={filter !== 'completed'}
              title={filter === 'completed' ? 'Nothing completed yet' : 'No tasks here'}
              hint={
                filter === 'today'
                  ? 'Add one above — you only need a single line.'
                  : filter === 'all'
                    ? 'Tasks you create will show up here.'
                    : 'Finish a task and it will land here.'
              }
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {list.map(t => (
              <SwipeableTask
                key={t.id}
                task={t}
                showDate={filter !== 'today'}
                canStart={pomodoroOn && !t.done}
                completedPomos={pomCount[t.id]}
                onToggle={() => toggleTask(t.id)}
                onDelete={() => removeTask(t.id)}
                onStart={() => onStartPomodoro(t)}
              />
            ))}
          </View>
        )}
      </FadeIn>
    </ScrollView>
  );
}

/**
 * 可滑动删除的任务行
 * 左滑露出删除按钮，松手超过阈值或点击删除即移除。
 */
function SwipeableTask({
  task,
  onToggle,
  onDelete,
  onStart,
  showDate,
  canStart,
  completedPomos,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onStart: () => void;
  showDate: boolean;
  canStart: boolean;
  completedPomos?: number;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const tx = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const close = () => {
    open.current = false;
    Animated.spring(tx, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_e, g) => {
          const base = open.current ? -84 : 0;
          const next = base + g.dx;
          // 只允许左滑，右滑关闭
          tx.setValue(Math.min(0, Math.max(-96, next)));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -46) {
            open.current = true;
            Animated.spring(tx, { toValue: -84, useNativeDriver: true, friction: 8 }).start();
          } else {
            close();
          }
        },
        onPanResponderTerminate: () => close(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View>
      {/* 底层删除按钮 */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 88,
          borderRadius: radius.lg,
          backgroundColor: c.danger,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          onPress={onDelete}
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View {...responder.panHandlers} style={{ transform: [{ translateX: tx }] }}>
        <Card style={{ paddingVertical: spacing.md }}>
          <Row gap={spacing.md}>
            <CheckCircle done={task.done} onPress={onToggle} />
            <Pressable onPress={onToggle} style={{ flex: 1 }} hitSlop={4}>
              <Text
                style={{
                  color: task.done ? c.textFaint : c.text,
                  fontSize: 16,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                  textDecorationLine: task.done ? 'line-through' : 'none',
                }}
                numberOfLines={2}
              >
                {task.title}
              </Text>
              <Row gap={10} style={{ marginTop: 5, flexWrap: 'wrap' }}>
                {task.time ? <TimeMeta time={task.time} /> : null}
                {showDate && task.date ? (
                  <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>
                    {fmtDate(task.date)}
                  </Text>
                ) : null}
                <PomoBadge estimate={task.estimatePomos} completed={completedPomos} />
              </Row>
            </Pressable>
            {canStart ? (
              <Pressable
                onPress={onStart}
                hitSlop={8}
                style={({ pressed }) => ({
                  backgroundColor: c.accentSoft,
                  borderRadius: radius.pill,
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: c.accent, fontSize: 12, fontWeight: '800' }}>▶ Pomodoro</Text>
              </Pressable>
            ) : null}
          </Row>
        </Card>
      </Animated.View>
    </View>
  );
}

function fmtDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const today = todayKey();
  if (key === today) return 'Today';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const p = (n: number) => `${n}`.padStart(2, '0');
  if (key === `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`) return 'Tomorrow';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${M[m - 1]} ${d}`;
}