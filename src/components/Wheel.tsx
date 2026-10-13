import React, { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { p2 } from '../utils';

/**
 * iOS 风格垂直滚轮选择列
 * -------------------------------------------------------------------
 * 纯 RN 实现（ScrollView snap + 上下渐隐遮罩 + 中央高光带），
 * 刻意不引入 @react-native-community/picker / datetimepicker 原生依赖。
 *
 * 滚动 → onScroll 实时换算行号 → 120ms 静止判定后提交，
 * 这套「滚动去抖」在 Web 与原生上行为一致（Web 没有 momentum 事件）。
 */

const ITEM_H = 38;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H; // 上下留白，让首尾项也能滚到正中

export function WheelColumn<T extends number>({
  items,
  selected,
  onSelect,
  width,
  label,
  format,
  haptics,
}: {
  items: T[];
  /** 当前值；null 表示尚未选择（滚轮停在第一项） */
  selected: T | null;
  onSelect: (v: T) => void;
  width: number;
  /** 列头小字，如 YEAR / HOUR */
  label: string;
  format?: (n: T) => string;
  /** 是否给每次换值触感反馈 */
  haptics?: boolean;
}) {
  const c = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const idxOf = (v: T | null) => Math.max(0, items.indexOf(v as T));
  const lastScrolled = useRef<T | null>(selected);
  lastScrolled.current = selected;

  // 外部值变化（清空 / 切月收拢天数 / 初次打开）→ 滚轮平滑对齐；用户正在拖时不抢
  useEffect(() => {
    if (dragging.current) return;
    if (selected === lastScrolled.current) return;
    lastScrolled.current = selected;
    scrollRef.current?.scrollTo({ y: idxOf(selected) * ITEM_H, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commitSoon = (y: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const v = items[idx];
      if (v !== selectedRef.current) {
        if (haptics) Haptics.selectionAsync().catch(() => {});
        onSelect(v);
      }
    }, 120);
  };

  const fmt = format ?? (n => p2(n));

  return (
    <View style={{ width, alignItems: 'center' }}>
      <Text
        style={{
          color: c.textFaint,
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>

      <View style={{ height: WHEEL_H, width: '100%' }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          contentContainerStyle={{ paddingVertical: PAD }}
          onScrollBeginDrag={() => {
            dragging.current = true;
          }}
          onScrollEndDrag={() => {
            dragging.current = false;
          }}
          scrollEventThrottle={16}
          onScroll={e => commitSoon(e.nativeEvent.contentOffset.y)}
        >
          {items.map(n => {
            const on = n === selected;
            return (
              <View key={n} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: on ? c.text : c.textFaint,
                    fontSize: on ? 17 : 15,
                    fontWeight: on ? '800' : '500',
                    fontVariant: ['tabular-nums'],
                    opacity: on ? 1 : 0.75,
                  }}
                >
                  {fmt(n)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* 上下渐隐：滚出视线的行淡出，模拟立体滚筒 */}
        <View pointerEvents="none" style={StyleSheetAbs.top}>
          <Fade color={c.bg} reverse={false} />
        </View>
        <View pointerEvents="none" style={StyleSheetAbs.bottom}>
          <Fade color={c.bg} reverse />
        </View>

        {/* 中央高光带：选中行落在这一档 */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 2,
            right: 2,
            top: PAD,
            height: ITEM_H,
            borderRadius: 10,
            backgroundColor: c.accentSoft,
            opacity: 0.55,
          }}
        />
      </View>
    </View>
  );
}

const StyleSheetAbs = {
  top: { position: 'absolute' as const, left: 0, right: 0, top: 0, height: 40 },
  bottom: { position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 40 },
};

/** 弹性渐隐条：reverse=false 时顶部实、底部透明；reverse 时反过来 */
function Fade({ color, reverse }: { color: string; reverse: boolean }) {
  return (
    <LinearGradient
      colors={reverse ? [withAlpha(color, 0), color] : [color, withAlpha(color, 0)]}
      style={{ flex: 1 }}
    />
  );
}

/** '#RRGGBB' → 带透明度的 rgba（hex 追加 alpha 在部分解析器上不稳，走 rgba 更保险） */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export { ITEM_H };
