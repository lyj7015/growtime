import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { CheckCircle, PomoBadge, Row } from './ui';
import { TomatoBurst } from './Tomato';
import { radius, shadow, spacing } from '../theme';
import { todayKey } from '../utils';
import type { Task } from '../types';

/**
 * 任务卡片
 * -------------------------------------------------------------------
 * 首页、Tasks 页、Calendar 弹层三处共用，保证视觉与交互完全一致。
 * 结构对应参考设计：
 *   [圆角方形复选框]  标题                  [优先级点]
 *                     ◷ 时间  [🍅 N 预估]   [▶ 启动番茄]
 */
export function TaskCard({
  task,
  completedPomos,
  onToggle,
  onStart,
  showDate,
  compact,
}: {
  task: Task;
  /** 该任务已完成的番茄数，来自 session 统计 */
  completedPomos?: number;
  onToggle?: () => void;
  /** 传入则显示「启动番茄」按钮 */
  onStart?: () => void;
  showDate?: boolean;
  compact?: boolean;
}) {
  const c = useTheme();
  // 完成瞬间触发一次番茄迸发（只在 false→true 的跳变时，取消完成不放礼花）
  const [burst, setBurst] = useState(0);
  const prevDone = useRef(task.done);
  useEffect(() => {
    if (task.done && !prevDone.current) setBurst(k => k + 1);
    prevDone.current = task.done;
  }, [task.done]);

  // 展示优先级：startAt（完整时间点，含秒）→ startTime（用户显式设置）→ time（AI 解析）
  const startAtStr = task.startAt ? fmtEpochClock(task.startAt) : (task.startTime ?? task.time);
  const dueStr = task.dueAt ? fmtEpochClock(task.dueAt) : task.dueTime;
  // 截止日与归属日不同天时，在时间前补上短日期，如 "Oct 15 · 17:30"
  const dueDateStr = task.dueDate && task.dueDate !== task.date ? fmtDate(task.dueDate) : undefined;
  const overdue = !task.done && isOverdue(task);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: compact ? spacing.md - 2 : spacing.md,
        },
        shadow.card,
      ]}
    >
      <View style={{ position: 'relative' }}>
        <CheckCircle done={task.done} onPress={onToggle} size={compact ? 24 : 26} />
        <TomatoBurst trigger={burst} />
      </View>

      <Pressable onPress={onToggle} style={{ flex: 1 }} hitSlop={4}>
        <TaskTitle title={task.title} done={task.done} compact={compact} />

        {startAtStr || dueStr || task.estimatePomos || showDate ? (
          <Row gap={10} style={{ marginTop: 5, flexWrap: 'wrap' }}>
            {startAtStr ? (
              <Row gap={4}>
                <Text style={{ color: c.accent, fontSize: 11 }}>◷</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>{startAtStr}</Text>
              </Row>
            ) : null}

            {/* 截止时间：逾期未完成时整条转为警示色；跨天时带上短日期 */}
            {dueStr ? (
              <Row gap={4}>
                <Text style={{ color: overdue ? c.danger : c.textFaint, fontSize: 11 }}>⚑</Text>
                <Text
                  style={{
                    color: overdue ? c.danger : c.textMuted,
                    fontSize: 12,
                    fontWeight: overdue ? '800' : '700',
                  }}
                >
                  {dueDateStr ? `${dueDateStr} · ${dueStr}` : dueStr}
                </Text>
              </Row>
            ) : null}

            {showDate && task.date ? (
              <Row gap={4}>
                <Text style={{ color: c.textFaint, fontSize: 11 }}>▦</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>
                  {fmtDate(task.date)}
                </Text>
              </Row>
            ) : null}
            <PomoBadge estimate={task.estimatePomos} completed={completedPomos} size={compact ? 'sm' : 'md'} />
          </Row>
        ) : null}
      </Pressable>

      {/* 已完成的任务右侧显示灰色圆点，未完成显示番茄色 */}
      {task.done ? (
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: c.textFaint,
            opacity: 0.5,
          }}
        />
      ) : onStart ? (
        <Pressable onPress={onStart} hitSlop={10}>
          <Text style={{ color: c.accent, fontSize: 15 }}>▶</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 标题：已完成加删除线并弱化 */
function TaskTitle({ title, done, compact }: { title: string; done: boolean; compact?: boolean }) {
  const c = useTheme();
  return (
    <Text
      style={{
        color: done ? c.textFaint : c.text,
        fontSize: compact ? 15 : 16,
        fontWeight: '700',
        letterSpacing: -0.3,
        lineHeight: compact ? 20 : 22,
        textDecorationLine: done ? 'line-through' : 'none',
      }}
      numberOfLines={2}
    >
      {title}
    </Text>
  );
}

function fmtDate(key: string) {
  const [, m, d] = key.split('-').map(Number);
  const now = new Date();
  const today = todayKey();
  if (key === today) return 'Today';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${M[m - 1]} ${d}`;
}

/**
 * epoch 毫秒 → "HH:mm" 或 "HH:mm:ss"（秒非 0 时才带秒，避免视觉噪音）
 */
function fmtEpochClock(epoch: number): string {
  const d = new Date(epoch);
  const base = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return d.getSeconds() > 0 ? `${base}:${p2(d.getSeconds())}` : base;
}

function p2(n: number): string {
  return `${n}`.padStart(2, '0');
}

/**
 * 是否已逾期。
 * 有 dueAt（完整时间点）直接和当前时刻比；否则退回「日期 + HH:mm」的旧逻辑。
 * 用本地时间比较，不能用 UTC，否则跨零点会误判。
 */
function isOverdue(task: Task): boolean {
  if (task.dueAt != null) return task.dueAt < Date.now();
  if (!task.dueTime) return false;
  const today = todayKey();
  if (!task.date || task.date < today) return true;
  if (task.date > today) return false;
  const now = new Date();
  const cur = `${now.getHours()}`.padStart(2, '0') + ':' + `${now.getMinutes()}`.padStart(2, '0');
  return cur > task.dueTime;
}
