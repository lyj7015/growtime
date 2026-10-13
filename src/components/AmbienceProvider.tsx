/**
 * 白噪音调度器
 * ---------------------------------------------------------------------------
 * 全 App 只有这一处决定「现在该不该有声音」。规则按优先级从上到下：
 *
 *   1. 设置里的 Sound 总开关关掉 → 一律不播
 *   2. 设置页正在试听某一段 → 播它（试听音量）
 *   3. 专注计时正在走（phase=focus 且 running）→ 播用户选定的白噪音（背景音量）
 *   4. 其余情况（休息中、暂停、空闲）→ 停
 *
 * 为什么要把规则收敛到一个 effect：
 *   之前的实现里，设置页点一下播一次、计时器又开始播一次，两个调用方各说各话 ——
 *   结果就是「暂停计时器声音还在响」「切了声音又被计时器改回去」这类问题。
 *   现在调用方只表达意图（试听哪个 / 选哪个），播与不播由这里统一推导。
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useStore } from '../store';
import { useTimerContext } from '../hooks/TimerProvider';
import {
  PREVIEW_VOLUME,
  SESSION_VOLUME,
  initAmbience,
  pauseSound,
  playSound,
  releaseSound,
} from '../services/ambience';
import type { SoundId } from '../types';

type AmbienceApi = {
  /** 此刻应该有声音吗（用于界面上的 ♪ 指示） */
  playing: SoundId | null;
  /** 正在试听（设置页点开的那段），用于显示「Playing · tap to stop」 */
  previewing: boolean;
  /** 设置页试听开关：再点一次同一段即停 */
  togglePreview: (id: SoundId) => void;
  stopPreview: () => void;
};

const AmbienceCtx = createContext<AmbienceApi | null>(null);

export function AmbienceProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const timer = useTimerContext();

  const [previewId, setPreviewId] = useState<SoundId | null>(null);
  const [appActive, setAppActive] = useState(true);

  const { soundEnabled, soundId } = state.settings;

  // 回到前台时音频会被系统打断过，需要重新评估一次
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      setAppActive(s === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    initAmbience();
    return () => releaseSound();
  }, []);

  const sessionRunning = timer.phase === 'focus' && timer.status === 'running';

  const target: SoundId | null = !soundEnabled
    ? null
    : previewId ?? (sessionRunning ? soundId : null);

  /** 试听时用更大的音量，其余按背景音处理 */
  const volume = previewId ? PREVIEW_VOLUME : SESSION_VOLUME;

  useEffect(() => {
    if (!appActive || !target) {
      pauseSound();
      return;
    }
    playSound(target, volume);
  }, [target, volume, appActive]);

  const api = useMemo<AmbienceApi>(
    () => ({
      playing: appActive && target ? target : null,
      previewing: previewId !== null,
      togglePreview: id => setPreviewId(prev => (prev === id ? null : id)),
      stopPreview: () => setPreviewId(null),
    }),
    [appActive, target, previewId],
  );

  return <AmbienceCtx.Provider value={api}>{children}</AmbienceCtx.Provider>;
}

export function useAmbience(): AmbienceApi {
  const ctx = useContext(AmbienceCtx);
  if (!ctx) throw new Error('useAmbience must be used inside <AmbienceProvider>');
  return ctx;
}
