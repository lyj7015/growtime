import React, { createContext, useContext } from 'react';
import { useTimer } from './useTimer';
import type { useTimer as useTimerType } from './useTimer';

/**
 * 计时器必须是**全局唯一实例**。
 *
 * 之前 HomeScreen 和 App 各自调用了 useTimer()，结果是两套独立状态：
 * 从 Tasks / Calendar 点「Start Pomodoro」时更新的是 App 里的那套，
 * 而首页渲染的是另一套 —— 计时器看起来根本没反应。
 * 用 Context 收敛成单例后，任何入口启动的计时，首页都能立刻看到。
 */

type TimerApi = ReturnType<typeof useTimerType>;

const TimerCtx = createContext<TimerApi | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useTimer();
  return <TimerCtx.Provider value={timer}>{children}</TimerCtx.Provider>;
}

/** 必须在 TimerProvider 内部使用 */
export function useTimerContext(): TimerApi {
  const ctx = useContext(TimerCtx);
  if (!ctx) throw new Error('useTimerContext must be used inside <TimerProvider>');
  return ctx;
}