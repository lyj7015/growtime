import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palette, type Colors, type ThemeName } from '../theme';
import { useStore } from '../store';

const ThemeCtx = createContext<{ c: Colors; mode: ThemeName; isDark: boolean }>({
  c: palette.light,
  mode: 'light',
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const scheme = useColorScheme();
  const pref = state.settings.themeMode;

  const value = useMemo(() => {
    const isDark = pref === 'system' ? scheme === 'dark' : pref === 'dark';
    const mode: ThemeName = isDark ? 'dark' : 'light';
    return { c: palette[mode], mode, isDark };
  }, [pref, scheme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/**
 * 取当前配色。
 * 返回值直接就是 Colors，所以可以写 `const c = useTheme()` 然后 c.text / c.accent。
 */
export function useTheme(): Colors {
  return useContext(ThemeCtx).c;
}

/** 需要知道当前明暗状态时用这个（例如给 StatusBar 选样式） */
export function useThemeMode(): { c: Colors; mode: ThemeName; isDark: boolean } {
  return useContext(ThemeCtx);
}