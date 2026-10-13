import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';
import { MiniTomato } from '../components/Tomato';
import { Button, Card, FadeIn, Label, Row } from '../components/ui';
import { TaskCard } from '../components/TaskCard';
import { QuickAdd } from '../components/QuickAdd';
import { radius, shadow, spacing } from '../theme';
import { useStore } from '../store';
import { aiDailyReview } from '../services/ai';
import { isSameMonth, monthGrid, todayKey } from '../utils';
import type { DateKey, Task } from '../types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarScreen({ onStartPomodoro }: { onStartPomodoro: (t: Task) => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, tasksOn, statsOn, toggleTask } = useStore();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [picked, setPicked] = useState<DateKey | null>(null);

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  // 预计算每个日期的标记，避免渲染时反复遍历
  // 一次性给网格里每一天打好标记，避免渲染时反复遍历全量数据
  const marks = useMemo(() => {
    const map: Record<
      string,
      {
        hasTask: boolean;
        hasOpenTask: boolean;
        openCount: number;
        hasPomo: boolean;
        /** 有明确时间安排（启动时间 / 截止时间）的任务数，决定是否显示时钟图标 */
        scheduledCount: number;
        /** 当天最早的安排时刻，用于无障碍标签与后续扩展 */
        firstTime?: string;
      }
    > = {};
    for (const k of grid) {
      const onDay = state.tasks.filter(t => t.date === k);
      const open = onDay.filter(t => !t.done);
      const scheduled = onDay.filter(t => t.startTime || t.time || t.dueTime);
      const upcomingTimes = scheduled
        .filter(t => !t.done)
        .map(t => t.startTime ?? t.time ?? t.dueTime ?? '')
        .filter(Boolean)
        .sort();
      map[k] = {
        hasTask: onDay.length > 0,
        hasOpenTask: open.length > 0,
        openCount: open.length,
        hasPomo: state.sessions.some(s => s.date === k && s.completed),
        scheduledCount: scheduled.length,
        firstTime: upcomingTimes[0],
      };
    }
    return map;
  }, [grid, state.tasks, state.sessions]);

  const shift = (delta: number) => {
    setCursor(prev => {
      const d = new Date(prev.y, prev.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
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
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }}>
              Calendar
            </Text>
            <Pressable onPress={() => setPicked(todayKey())} hitSlop={8}>
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>Today</Text>
            </Pressable>
          </Row>
        </FadeIn>

        <FadeIn delay={60}>
          <Card style={{ gap: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable onPress={() => shift(-1)} hitSlop={12}>
                <Text style={{ color: c.textMuted, fontSize: 20, paddingHorizontal: 6 }}>‹</Text>
              </Pressable>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
                {new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Pressable onPress={() => shift(1)} hitSlop={12}>
                <Text style={{ color: c.textMuted, fontSize: 20, paddingHorizontal: 6 }}>›</Text>
              </Pressable>
            </Row>

            <Row>
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: c.textFaint, fontSize: 11, fontWeight: '700' }}>{w}</Text>
                </View>
              ))}
            </Row>

            {/* 6 行 × 7 列，格子只做轻量标记，不渲染复杂动画 */}
            {Array.from({ length: 6 }).map((_, row) => (
              <Row key={row} gap={0}>
                {grid.slice(row * 7, row * 7 + 7).map(key => {
                  const inMonth = isSameMonth(key, cursor.y, cursor.m);
                  const isToday = key === todayKey();
                  const m = marks[key];
                  const has = m.hasTask || m.hasPomo;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setPicked(key)}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}
                      accessibilityLabel={
                        m.firstTime ? `${key}, first scheduled at ${m.firstTime}` : undefined
                      }
                    >
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isToday
                            ? c.accent
                            : m.hasOpenTask
                              ? c.accentSoft
                              : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: isToday
                              ? c.accentText
                              : inMonth
                                ? c.text
                                : c.textFaint,
                            fontSize: 14,
                            fontWeight: isToday ? '800' : '600',
                          }}
                        >
                          {Number(key.split('-')[2])}
                        </Text>
                      </View>

                      {/* 标记行：左边是「有具体时间安排」的时钟图标，右边是待办圆点。
                          ◷ 图标 = 这一天有填了启动时间/截止时间的任务（通常由右下角 + 弹窗创建）。 */}
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 3,
                          height: 12,
                          marginTop: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {m.scheduledCount > 0 ? <ScheduleMark active={isToday} /> : null}

                        {/* 待办标识：橙色 = 该日有未完成待办，实心 = 全部已完成，仅有番茄记录时显示一颗迷你番茄。 */}
                        {m.hasOpenTask ? (
                          <Dot color={isToday ? c.accentText : c.accent} size={5} />
                        ) : m.hasTask ? (
                          <Dot color={isToday ? c.accentText : c.textFaint} size={4} />
                        ) : m.scheduledCount === 0 && m.hasPomo ? (
                          <MiniTomato size={9} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </Row>
            ))}

            <Row gap={spacing.lg} style={{ justifyContent: 'center', paddingTop: 2 }}>
              <Row gap={5}>
                <ScheduleMark active={false} />
                <Text style={{ color: c.textFaint, fontSize: 11 }}>Scheduled</Text>
              </Row>
              <Legend color={c.accent} label="Open tasks" size={5} />
              <Row gap={5}>
                <MiniTomato size={10} />
                <Text style={{ color: c.textFaint, fontSize: 11 }}>Pomodoros</Text>
              </Row>
            </Row>
          </Card>
        </FadeIn>

        {/* 当日概览：不跳多层页面，直接在下方展示 */}
        {picked ? <DaySummary date={picked} onStart={onStartPomodoro} onToggle={toggleTask} /> : null}
      </ScrollView>

      {/* 移动端用底部弹层，避免多层页面跳转 */}
      <DaySheet
        date={picked}
        onClose={() => setPicked(null)}
        onStart={onStartPomodoro}
        onToggle={toggleTask}
      />
    </View>
  );
}

function Dot({ color, size = 4 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/**
 * 「这一天有具体时间安排」的图标。
 * 用带底色的圆角小徽章而不是裸字形 —— 裸字形在浅蓝底上几乎看不见，
 * 加个 accentSoft 底之后才能在 12px 的尺寸下依然可辨。
 */
function ScheduleMark({ active }: { active: boolean }) {
  const c = useTheme();
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? 'rgba(255,255,255,0.3)' : c.accentSoft,
        borderWidth: 1,
        borderColor: active ? 'rgba(255,255,255,0.45)' : '#FFD9CE',
      }}
    >
      <Text
        style={{
          fontSize: 8,
          lineHeight: 10,
          fontWeight: '800',
          color: active ? c.accentText : c.accent,
        }}
      >
        ◷
      </Text>
    </View>
  );
}

function Legend({ color, label, size }: { color: string; label: string; size?: number }) {
  const c = useTheme();
  return (
    <Row gap={5}>
      <Dot color={color} size={size} />
      <Text style={{ color: c.textFaint, fontSize: 11 }}>{label}</Text>
    </Row>
  );
}

function DaySummary({
  date,
  onStart,
  onToggle,
}: {
  date: DateKey;
  onStart: (t: Task) => void;
  onToggle: (id: string) => void;
}) {
  const c = useTheme();
  const { tasksOn, statsOn } = useStore();
  const tasks = tasksOn(date);
  const stats = statsOn(date);
  const review = aiDailyReview(date, stats.pomodoros, stats.totalFocusMinutes);

  return (
    <FadeIn>
      <Card style={{ gap: spacing.md }}>
        <Label>{fmtFull(date)}</Label>
        <Row gap={spacing.lg}>
          <View>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{stats.pomodoros}</Text>
            <Text style={{ color: c.textFaint, fontSize: 11 }}>Number of pomos</Text>
          </View>
          <View>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{stats.totalFocusMinutes}</Text>
            <Text style={{ color: c.textFaint, fontSize: 11 }}>Total focus minutes</Text>
          </View>
        </Row>
        {review ? (
          <Text style={{ color: c.textMuted, fontSize: 12, fontStyle: 'italic' }}>{review}</Text>
        ) : null}
        {tasks.slice(0, 3).map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onToggle={() => onToggle(t.id)}
            onStart={() => onStart(t)}
            compact
          />
        ))}
      </Card>
    </FadeIn>
  );
}

/**
 * 当日详情弹层
 * 未来日期可以直接在这里加待办 —— 这是「日历 → 规划」的主路径，
 * 不该逼用户先跳到 Tasks 页再手动选日期。
 */
function DaySheet({
  date,
  onClose,
  onStart,
  onToggle,
}: {
  date: DateKey | null;
  onClose: () => void;
  onStart: (t: Task) => void;
  onToggle: (id: string) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { tasksOn, statsOn, pomosByTask } = useStore();
  if (!date) return null;

  const tasks = tasksOn(date);
  const stats = statsOn(date);
  const review = aiDailyReview(date, stats.pomodoros, stats.totalFocusMinutes);
  const pomCount = pomosByTask();
  const isPast = date < todayKey();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,20,30,0.45)' }} />
      <View
        style={[
          {
            backgroundColor: c.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            gap: spacing.md,
            maxHeight: '82%',
          },
          shadow.bubble,
        ]}
      >
        <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: c.border }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
            {fmtFull(date)}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: c.textMuted, fontSize: 13.5, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </Row>

        <Row gap={spacing.xl}>
          <View>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{stats.pomodoros}</Text>
            <Text style={{ color: c.textFaint, fontSize: 11 }}>Number of pomos</Text>
          </View>
          <View>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{stats.totalFocusMinutes}</Text>
            <Text style={{ color: c.textFaint, fontSize: 11 }}>Total focus minutes</Text>
          </View>
        </Row>

        {review ? (
          <Text style={{ color: c.textMuted, fontSize: 12.5, fontStyle: 'italic', lineHeight: 18 }}>{review}</Text>
        ) : null}

        <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tasks.length === 0 ? (
            <Text style={{ color: c.textFaint, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg }}>
              {isPast ? 'Nothing was planned for this day.' : 'Nothing planned yet. Add the first one below.'}
            </Text>
          ) : (
            <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
              {tasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  completedPomos={pomCount[t.id]}
                  onToggle={() => onToggle(t.id)}
                  onStart={() => onStart(t)}
                  compact
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* 未来日期可直接添加；已过去的日期只读，不允许事后补记 */}
        {isPast ? (
          <Text style={{ color: c.textFaint, fontSize: 11.5, textAlign: 'center' }}>
            Past days are read-only.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700', paddingHorizontal: 2 }}>
              Add to this day
            </Text>
            <QuickAdd date={date} compact />
          </View>
        )}

        <Button label="Close" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

function fmtFull(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}