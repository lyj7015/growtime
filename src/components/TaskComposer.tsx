import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';
import { Button, Row } from './ui';
import { WheelColumn } from './Wheel';
import { radius, shadow, spacing } from '../theme';
import { useStore } from '../store';
import { p2, todayKey } from '../utils';
import type { DateKey, Task } from '../types';

/**
 * 任务填写弹窗
 * -------------------------------------------------------------------
 * 右下角「+」打开的完整录入表单。与首页的快速输入框（QuickAdd）分工不同：
 *   - QuickAdd    ：一句话 + 自然语言解析，追求「快」
 *   - TaskComposer：显式填标题 + 起始时间 + 截止时间，追求「准」
 *
 * 起始/截止都是完整的「年-月-日 时:分:秒」六列滑动滚轮（iOS 风格，纯 RN 实现，
 * 刻意不引入 @react-native-community/datetimepicker 原生依赖）。
 * 保存时：
 *   - startAt/dueAt 存 epoch 毫秒（完整精度）
 *   - date 写成起始时间的日期 → 日历按这天归置，任务立即出现在对应日期
 *   - startTime/dueTime 写 HH:mm 降维版，兼容旧展示逻辑
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 一个完整的日期时间（内部表示：月份 0-11，与 Date 一致） */
type DT = { y: number; m: number; d: number; h: number; min: number; s: number };

function nowDT(): DT {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate(), h: n.getHours(), min: n.getMinutes(), s: 0 };
}

function toEpoch(dt: DT): number {
  return new Date(dt.y, dt.m, dt.d, dt.h, dt.min, dt.s).getTime();
}

function toKey(dt: DT): DateKey {
  return `${dt.y}-${p2(dt.m + 1)}-${p2(dt.d)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** 折叠态的单行摘要，如 "Oct 14 · 09:30" / "Oct 14 · 09:30:05" / "Mar 3, 2027 · 14:00" */
function fmtDT(dt: DT): string {
  const nowY = new Date().getFullYear();
  const date = `${MONTHS[dt.m]} ${dt.d}${dt.y !== nowY ? `, ${dt.y}` : ''}`;
  const time = dt.s > 0 ? `${p2(dt.h)}:${p2(dt.min)}:${p2(dt.s)}` : `${p2(dt.h)}:${p2(dt.min)}`;
  return `${date} · ${time}`;
}

export function TaskComposer({
  visible,
  date,
  onClose,
  onCreated,
}: {
  visible: boolean;
  /** 归属日期兜底：用户没设起始时间时，任务落到这一天 */
  date?: DateKey;
  onClose: () => void;
  onCreated?: (t: Task) => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, addTask } = useStore();

  const fallback = date ?? todayKey();

  const [title, setTitle] = useState('');
  const [start, setStart] = useState<DT | null>(null);
  const [due, setDue] = useState<DT | null>(null);

  // 每次打开都从干净状态开始，避免上次的残留内容让人误存
  useEffect(() => {
    if (visible) {
      setTitle('');
      setStart(null);
      setDue(null);
    }
  }, [visible]);

  const trimmed = title.trim();

  /** 截止不晚于起始 —— 常见误操作，直接拦住 */
  const invalidRange = useMemo(() => {
    if (!start || !due) return false;
    return toEpoch(due) <= toEpoch(start);
  }, [start, due]);

  const canSubmit = trimmed.length > 0 && !invalidRange;

  const submit = () => {
    if (!canSubmit) return;
    const startKey = start ? toKey(start) : undefined;
    const dueKey = due ? toKey(due) : undefined;
    const t = addTask({
      title: trimmed,
      // 归属日跟着起始时间走 —— 日历按这天显示这条任务
      date: startKey ?? fallback,
      startTime: start ? `${p2(start.h)}:${p2(start.min)}` : undefined,
      // 只填了起始时间时把 time 也写上，让任务卡片与日历共用同一套展示逻辑
      time: start ? `${p2(start.h)}:${p2(start.min)}` : undefined,
      startAt: start ? toEpoch(start) : undefined,
      dueTime: due ? `${p2(due.h)}:${p2(due.min)}` : undefined,
      dueAt: due ? toEpoch(due) : undefined,
      dueDate: dueKey && dueKey !== startKey ? dueKey : undefined,
    });
    if (state.settings.hapticsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    onCreated?.(t);
    onClose();
  };

  // 起始时间定了归属日；没定就用打开弹窗时的兜底日
  const placementKey = start ? toKey(start) : fallback;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable onPress={onClose} style={{ flex: 1 }} />

        <View
          style={[
            {
              backgroundColor: c.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.md,
              maxHeight: '88%',
            },
            shadow.bubble,
          ]}
        >
          <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: c.border }} />

          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>
              New task
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: c.textMuted, fontSize: 13.5, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </Row>

          {/* 归属日预览：随起始时间联动，明确告诉用户任务会落在日历哪一天 */}
          <Row gap={6}>
            <Text style={{ color: c.accent, fontSize: 11 }}>▦</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>
              Shows on {fmtFull(placementKey)} in Calendar
            </Text>
          </Row>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 480 }}
          >
            <View style={{ gap: spacing.md }}>
              {/* 标题 */}
              <Field label="What are you working on?">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Finish the project outline"
                  placeholderTextColor={c.textFaint}
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  autoFocus
                  style={[
                    {
                      color: c.text,
                      fontSize: 15.5,
                      fontWeight: '600',
                      paddingVertical: 13,
                      paddingHorizontal: spacing.md,
                      backgroundColor: c.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: c.border,
                    },
                    { outlineStyle: 'none' } as any,
                  ]}
                />
              </Field>

              <DTField
                icon="◷"
                label="Start"
                hint="Date & time to begin"
                value={start}
                onChange={setStart}
                accentColor={c.accent}
              />

              <DTField
                icon="⚑"
                label="Deadline"
                hint="Date & time to finish by"
                value={due}
                onChange={setDue}
                accentColor={c.danger}
              />

              {invalidRange ? (
                <Text style={{ color: c.danger, fontSize: 12, fontWeight: '700', paddingHorizontal: 2 }}>
                  Deadline must be later than the start time.
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <Button label="Add task" onPress={submit} disabled={!canSubmit} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * 表单字段外壳
 * ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', paddingHorizontal: 2 }}>{label}</Text>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 日期时间字段：年 / 月 / 日 / 时 / 分 / 秒 六段 ChipRow 选择
 * ------------------------------------------------------------------ */

const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOUR_ITEMS = Array.from({ length: 24 }, (_, i) => i);
const MIN_ITEMS = Array.from({ length: 12 }, (_, i) => i * 5);
const SEC_ITEMS = Array.from({ length: 12 }, (_, i) => i * 5);

function DTField({
  icon,
  label,
  hint,
  value,
  onChange,
  accentColor,
}: {
  icon: string;
  label: string;
  hint: string;
  value: DT | null;
  onChange: (v: DT | null) => void;
  accentColor: string;
}) {
  const c = useTheme();
  const { state } = useStore();
  const haptics = state.settings.hapticsEnabled;
  const [open, setOpen] = useState(false);

  // 年份范围：去年到后年 —— 计划任务几乎不会超出这个窗
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2];
  }, []);

  // 天数列随年/月变化（2 月 28/29、大小月）
  const dayItems = useMemo(
    () =>
      Array.from(
        { length: daysInMonth(value?.y ?? new Date().getFullYear(), value?.m ?? new Date().getMonth()) },
        (_, i) => i + 1,
      ),
    [value?.y, value?.m],
  );

  const patch = (p: Partial<DT>) => {
    const base: DT = { ...(value ?? nowDT()), ...p };
    // 月/年变化后日可能越界（如 1月31日 → 2月），收拢到当月最后一天
    base.d = Math.min(base.d, daysInMonth(base.y, base.m));
    onChange(base);
  };

  const setNow = () => {
    const n = new Date();
    onChange({ y: n.getFullYear(), m: n.getMonth(), d: n.getDate(), h: n.getHours(), min: n.getMinutes(), s: 0 });
  };

  const plusThirty = () => {
    const base = value ?? nowDT();
    const t = new Date(toEpoch(base) + 30 * 60_000);
    onChange({ y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), h: t.getHours(), min: t.getMinutes(), s: base.s });
  };

  const tomorrow = () => {
    const base = value ?? nowDT();
    const t = new Date(toEpoch(base) + 86400_000);
    onChange({ ...base, y: t.getFullYear(), m: t.getMonth(), d: t.getDate() });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={7}>
          <Text style={{ color: accentColor, fontSize: 12 }}>{icon}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800' }}>{label}</Text>
        </Row>
        <Text style={{ color: c.textFaint, fontSize: 11 }}>{hint}</Text>
      </Row>

      <View
        style={{
          backgroundColor: c.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: open ? accentColor : c.border,
          overflow: 'hidden',
        }}
      >
        {/* 收起态：一个摘要胶囊（日期 + 时间），点开六列滚轮 */}
        <Pressable
          onPress={() => {
            const next = !open;
            setOpen(next);
            // 展开时若无值，先落到「现在」，保证滚轮位置与真实值一致（对齐 iOS 习惯）
            if (next && !value) onChange(nowDT());
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text
            style={{
              color: value ? c.text : c.textFaint,
              fontSize: value ? 17 : 14.5,
              fontWeight: value ? '800' : '600',
              letterSpacing: value ? -0.3 : 0,
              fontVariant: ['tabular-nums'],
            }}
          >
            {value ? fmtDT(value) : 'Not set'}
          </Text>

          <Row gap={spacing.md}>
            {value ? (
              <Pressable
                onPress={() => onChange(null)}
                hitSlop={10}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.surfaceAlt,
                }}
              >
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800' }}>✕</Text>
              </Pressable>
            ) : null}
            <Text style={{ color: c.textFaint, fontSize: 13 }}>{open ? '▲' : '▼'}</Text>
          </Row>
        </Pressable>

        {open ? (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md }}>
            {/* 快捷设置 */}
            <Row gap={spacing.sm}>
              <QuickChip label="Now" onPress={setNow} accent={accentColor} />
              <QuickChip label="+30 min" onPress={plusThirty} accent={accentColor} />
              <QuickChip label="Tomorrow" onPress={tomorrow} accent={accentColor} />
              <QuickChip
                label="Clear"
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                accent={accentColor}
              />
            </Row>

            {/* 六列滑动滚轮：年 / 月 / 日 / 时 / 分 / 秒 */}
            <Row style={{ justifyContent: 'space-between' }}>
              <WheelColumn
                label="YEAR"
                width={60}
                items={years}
                selected={value?.y ?? null}
                onSelect={n => patch({ y: n })}
                format={n => `${n}`}
                haptics={haptics}
              />
              <WheelColumn
                label="MONTH"
                width={48}
                items={MONTH_ITEMS}
                selected={value ? value.m + 1 : null}
                onSelect={n => patch({ m: n - 1 })}
                haptics={haptics}
              />
              <WheelColumn
                label="DAY"
                width={48}
                items={dayItems}
                selected={value?.d ?? null}
                onSelect={n => patch({ d: n })}
                haptics={haptics}
              />
              <WheelColumn
                label="HOUR"
                width={48}
                items={HOUR_ITEMS}
                selected={value?.h ?? null}
                onSelect={n => patch({ h: n })}
                haptics={haptics}
              />
              <WheelColumn
                label="MIN"
                width={48}
                items={MIN_ITEMS}
                selected={value?.min ?? null}
                onSelect={n => patch({ min: n })}
                haptics={haptics}
              />
              <WheelColumn
                label="SEC"
                width={48}
                items={SEC_ITEMS}
                selected={value?.s ?? null}
                onSelect={n => patch({ s: n })}
                haptics={haptics}
              />
            </Row>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QuickChip({ label, onPress, accent }: { label: string; onPress: () => void; accent: string }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: radius.pill,
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: accent, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
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
