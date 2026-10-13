import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_SETTINGS,
  defaultOnboarding,
  makeGuestAccount,
  makeTask,
  uid,
} from '../utils';
import type {
  Account,
  DateKey,
  OnboardingState,
  PomodoroSession,
  Settings,
  Task,
} from '../types';

const KEY = 'growtime.state.v1';

export type StoreShape = {
  tasks: Task[];
  sessions: PomodoroSession[];
  settings: Settings;
  account: Account;
  onboarding: OnboardingState;
};

const initial: StoreShape = {
  tasks: [],
  sessions: [],
  settings: DEFAULT_SETTINGS,
  account: makeGuestAccount(),
  onboarding: defaultOnboarding(),
};

type Ctx = {
  state: StoreShape;
  ready: boolean;

  addTask: (t: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  moveTaskToDate: (id: string, date: DateKey) => void;

  addSession: (s: Omit<PomodoroSession, 'id'>) => PomodoroSession;

  patchSettings: (patch: Partial<Settings>) => void;
  setAccount: (a: Account) => void;
  patchOnboarding: (patch: Partial<OnboardingState>) => void;
  resetAll: () => Promise<void>;

  tasksOn: (date: DateKey) => Task[];
  statsOn: (date: DateKey) => { pomodoros: number; totalFocusMinutes: number };
  pomosByTask: () => Record<string, number>;
  setTasks: (t: Task[]) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreShape>(initial);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  // 读取本地数据
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && alive) {
          const parsed = JSON.parse(raw) as Partial<StoreShape>;
          setState(prev => ({
            ...prev,
            ...parsed,
            // 深层合并 settings，防止老版本缺字段
            settings: {
              ...DEFAULT_SETTINGS,
              ...(parsed.settings ?? {}),
              features: {
                ...DEFAULT_SETTINGS.features,
                ...(parsed.settings?.features ?? {}),
              },
              presets: {
                ...DEFAULT_SETTINGS.presets,
                ...(parsed.settings?.presets ?? {}),
              },
            },
            // 只取当前仍存在的字段：历史数据里可能残留已废弃的引导字段
            onboarding: { slidesSeen: parsed.onboarding?.slidesSeen ?? false },
            // 账号始终保证存在且字段完整
            account: { ...makeGuestAccount(), ...(parsed.account ?? {}) },
            tasks: parsed.tasks ?? [],
            sessions: parsed.sessions ?? [],
          }));
        }
      } catch (e) {
        // 本地数据损坏时保持初始态，不阻塞启动
        console.warn('[GrowTime] failed to load local state', e);
      } finally {
        if (alive) {
          hydrated.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 防抖持久化
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hydrated.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(e =>
        console.warn('[GrowTime] failed to persist state', e),
      );
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  const mutate = useCallback((fn: (prev: StoreShape) => StoreShape) => {
    setState(prev => fn(prev));
  }, []);

  const addTask = useCallback<Ctx['addTask']>(
    input => {
      const task = makeTask({ order: Date.now(), ...input });
      mutate(prev => ({ ...prev, tasks: [task, ...prev.tasks] }));
      return task;
    },
    [mutate],
  );

  const updateTask = useCallback<Ctx['updateTask']>(
    (id, patch) => {
      mutate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },
    [mutate],
  );

  const removeTask = useCallback<Ctx['removeTask']>(
    id => {
      mutate(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
    },
    [mutate],
  );

  const toggleTask = useCallback<Ctx['toggleTask']>(
    id => {
      mutate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t =>
          t.id === id
            ? {
                ...t,
                done: !t.done,
                completedAt: !t.done ? Date.now() : undefined,
              }
            : t,
        ),
      }));
    },
    [mutate],
  );

  const moveTaskToDate = useCallback<Ctx['moveTaskToDate']>(
    (id, date) => {
      mutate(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => (t.id === id ? { ...t, date } : t)),
      }));
    },
    [mutate],
  );

  const addSession = useCallback<Ctx['addSession']>(
    input => {
      const s: PomodoroSession = { id: uid('sess'), ...input };
      mutate(prev => ({ ...prev, sessions: [s, ...prev.sessions] }));
      return s;
    },
    [mutate],
  );

  const patchSettings = useCallback<Ctx['patchSettings']>(
    patch => {
      mutate(prev => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    },
    [mutate],
  );

  const setAccount = useCallback<Ctx['setAccount']>(
    account => {
      mutate(prev => ({ ...prev, account }));
    },
    [mutate],
  );

  const patchOnboarding = useCallback<Ctx['patchOnboarding']>(
    patch => {
      mutate(prev => ({ ...prev, onboarding: { ...prev.onboarding, ...patch } }));
    },
    [mutate],
  );

  const resetAll = useCallback(async () => {
    const fresh: StoreShape = {
      tasks: [],
      sessions: [],
      settings: DEFAULT_SETTINGS,
      account: makeGuestAccount(),
      onboarding: defaultOnboarding(),
    };
    setState(fresh);
    await AsyncStorage.removeItem(KEY);
  }, []);

  const setTasks = useCallback<Ctx['setTasks']>(
    tasks => mutate(prev => ({ ...prev, tasks })),
    [mutate],
  );

  const tasksOn = useCallback(
    (date: DateKey) =>
      state.tasks
        .filter(t => t.date === date)
        .slice()
        .sort((a, b) => {
          if (a.done !== b.done) return a.done ? 1 : -1;
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time) return -1;
          if (b.time) return 1;
          return a.order - b.order;
        }),
    [state.tasks],
  );

  const statsOn = useCallback(
    (date: DateKey) => {
      const list = state.sessions.filter(s => s.date === date && s.completed);
      return {
        pomodoros: list.length,
        totalFocusMinutes: list.reduce((sum, s) => sum + s.minutes, 0),
      };
    },
    [state.sessions],
  );

  /**
   * 每条任务已完成多少个番茄。
   * 任务卡片的 🍅 徽章要显示「已完成 / 预估」，所以这里按 taskId 聚合。
   */
  const pomosByTask = useCallback((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const s of state.sessions) {
      if (!s.taskId || !s.completed) continue;
      map[s.taskId] = (map[s.taskId] ?? 0) + 1;
    }
    return map;
  }, [state.sessions]);

  const value = useMemo<Ctx>(
    () => ({
      state,
      ready,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      moveTaskToDate,
      addSession,
      patchSettings,
      setAccount,
      patchOnboarding,
      resetAll,
      tasksOn,
      statsOn,
      pomosByTask,
      setTasks,
    }),
    [
      state,
      ready,
      addTask,
      updateTask,
      removeTask,
      toggleTask,
      moveTaskToDate,
      addSession,
      patchSettings,
      setAccount,
      patchOnboarding,
      resetAll,
      tasksOn,
      statsOn,
      pomosByTask,
      setTasks,
    ],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}