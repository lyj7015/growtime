import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import type { Task, TimerPhase } from '../types';

/**
 * 番茄计时器
 * 用「绝对结束时间戳」而不是「每秒递减」来计时 —— 这样即使 App 被切到后台、
 * JS 被系统暂停，回来时剩余时间依然准确。
 */

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type TimerState = {
  phase: TimerPhase;
  status: TimerStatus;
  /** 剩余秒数 */
  remaining: number;
  /** 本段总秒数 */
  total: number;
  /** 当前绑定的任务 */
  task: Task | null;
  /** 已完成番茄数（本轮内） */
  completedCount: number;
};

const PHASE_LABEL: Record<TimerPhase, string> = {
  focus: 'Focus',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export function useTimer() {
  const { state, addSession } = useStore();
  const { settings } = state;

  const [phase, setPhase] = useState<TimerPhase>('focus');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [remaining, setRemaining] = useState(settings.presets.focus * 60);
  const [task, setTask] = useState<Task | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  /** 本段开始时的绝对时间戳 */
  const deadlineRef = useRef<number>(0);
  /** 暂停时已累积的秒数 */
  const pausedRef = useRef<number>(0);
  /** 本段计划时长（秒），用于进度环 */
  const totalRef = useRef<number>(settings.presets.focus * 60);
  /** 记录本段的任务 id，结束时要写进 session */
  const sessionTaskRef = useRef<Task | null>(null);
  /** 结束回调只触发一次 */
  const firedRef = useRef(false);

  const phaseMinutes =
    phase === 'focus'
      ? settings.presets.focus
      : phase === 'shortBreak'
        ? settings.presets.shortBreak
        : settings.presets.longBreak;

  const label = PHASE_LABEL[phase];

  const buzz = useCallback(
    (kind: 'light' | 'success' | 'warning') => {
      if (!settings.hapticsEnabled) return;
      if (kind === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (kind === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [settings.hapticsEnabled],
  );

  /** 把配置里的时长同步进当前段（设置页改了时长立即生效） */
  useEffect(() => {
    if (status === 'idle' || status === 'finished') {
      const sec = phaseMinutes * 60;
      totalRef.current = sec;
      setRemaining(sec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseMinutes, phase, status]);

  /** 本段结束时推进到下一阶段 */
  const advance = useCallback(
    (finishedPhase: TimerPhase, doneTask: Task | null) => {
      if (finishedPhase === 'focus') {
        // 记录本次专注
        addSession({
          taskId: doneTask?.id,
          taskTitle: doneTask?.title,
          date: (doneTask?.date ?? undefined) || todayOf(),
          startedAt: Date.now() - totalRef.current * 1000,
          minutes: Math.round(totalRef.current / 60),
          completed: true,
        });
        const next = completedCount + 1;
        setCompletedCount(next);
        buzz('success');

        const goLong = next % Math.max(1, settings.longBreakInterval) === 0;
        const nextPhase: TimerPhase = goLong ? 'longBreak' : 'shortBreak';
        const sec = (goLong ? settings.presets.longBreak : settings.presets.shortBreak) * 60;
        setPhase(nextPhase);
        totalRef.current = sec;
        setRemaining(sec);
        setStatus(settings.autoStartBreak ? 'running' : 'finished');
        if (settings.autoStartBreak) deadlineRef.current = Date.now() + sec * 1000;
      } else {
        buzz('success');
        setPhase('focus');
        const sec = settings.presets.focus * 60;
        totalRef.current = sec;
        setRemaining(sec);
        setStatus(settings.autoStartBreak ? 'running' : 'finished');
        if (settings.autoStartBreak) deadlineRef.current = Date.now() + sec * 1000;
      }
    },
    [addSession, buzz, completedCount, settings.autoStartBreak, settings.longBreakInterval, settings.presets],
  );

  // 主心跳
  useEffect(() => {
    if (status !== 'running') return;
    firedRef.current = false;

    const tick = () => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        advance(phase, sessionTaskRef.current);
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [status, phase, advance]);

  // 回到前台立即校正一次，避免后台被节流导致的显示滞后
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && status === 'running') {
        const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0 && !firedRef.current) {
          firedRef.current = true;
          advance(phase, sessionTaskRef.current);
        }
      }
    });
    return () => sub.remove();
  }, [status, phase, advance]);

  const start = useCallback(
    (bindTask?: Task | null, targetPhase?: TimerPhase) => {
      if (targetPhase && targetPhase !== phase) setPhase(targetPhase);
      const p = targetPhase ?? phase;
      const sec =
        p === 'focus'
          ? settings.presets.focus * 60
          : p === 'shortBreak'
            ? settings.presets.shortBreak * 60
            : settings.presets.longBreak * 60;
      totalRef.current = sec;
      const t = bindTask ?? null;
      setTask(t);
      sessionTaskRef.current = t;
      pausedRef.current = sec;
      setRemaining(sec);
      setStatus('running');
      deadlineRef.current = Date.now() + sec * 1000;
      firedRef.current = false;
      buzz('light');
    },
    [phase, settings.presets, buzz],
  );

  const pause = useCallback(() => {
    setStatus(prev => {
      if (prev !== 'running') return prev;
      pausedRef.current = remaining;
      return 'paused';
    });
    buzz('light');
  }, [remaining, buzz]);

  const resume = useCallback(() => {
    setStatus(prev => {
      if (prev !== 'paused') return prev;
      deadlineRef.current = Date.now() + pausedRef.current * 1000;
      return 'running';
    });
    buzz('light');
  }, [buzz]);

  const reset = useCallback(() => {
    const sec = phaseMinutes * 60;
    setStatus('idle');
    setRemaining(sec);
    totalRef.current = sec;
    pausedRef.current = sec;
    sessionTaskRef.current = null;
    setTask(null);
  }, [phaseMinutes]);

  /** 跳过：不记录专注，直接进入休息段 */
  const skip = useCallback(() => {
    buzz('warning');
    if (phase === 'focus') {
      const next = completedCount + 1;
      setCompletedCount(next);
      const goLong = next % Math.max(1, settings.longBreakInterval) === 0;
      const p: TimerPhase = goLong ? 'longBreak' : 'shortBreak';
      const sec = (goLong ? settings.presets.longBreak : settings.presets.shortBreak) * 60;
      setPhase(p);
      totalRef.current = sec;
      setRemaining(sec);
      setStatus('finished');
      sessionTaskRef.current = null;
      setTask(null);
    } else {
      const sec = settings.presets.focus * 60;
      setPhase('focus');
      totalRef.current = sec;
      setRemaining(sec);
      setStatus('finished');
    }
  }, [phase, completedCount, settings, buzz]);

  const progress = totalRef.current > 0 ? 1 - remaining / totalRef.current : 0;

  return {
    phase,
    label,
    status,
    remaining,
    total: totalRef.current,
    progress,
    task,
    completedCount,
    start,
    pause,
    resume,
    reset,
    skip,
    isBreak: phase !== 'focus',
  };
}

function todayOf(): string {
  const d = new Date();
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}