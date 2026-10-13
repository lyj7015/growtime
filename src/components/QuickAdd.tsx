import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radius, shadow, spacing } from '../theme';
import { aiMatchSound, parseNaturalLanguage } from '../services/ai';
import { useStore } from '../store';
import type { DateKey, Task } from '../types';

const PLACEHOLDER = 'Add a task… try “Design review tomorrow at 9am”';

/**
 * 快速输入框
 * 规格要求：首页悬浮单行输入，回车直接保存，不要多余弹窗。
 * 同时它是「AI 智能时间识别」的核心卖点载体 —— 用户边打字边看到解析结果。
 */
export function QuickAdd({
  date,
  autoFocus,
  onSubmit,
  onChange,
  compact,
  inputRef,
}: {
  /** 归属日期，收集箱传 undefined */
  date?: DateKey;
  autoFocus?: boolean;
  /** 保存成功后回调，参数为新建的任务 */
  onSubmit?: (t: Task, parsedTitle: string) => void;
  /** 输入内容变化回调，供引导流程监听 */
  onChange?: (text: string) => void;
  compact?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
}) {
  const c = useTheme();
  const { addTask } = useStore();
  const [text, setText] = useState('');
  const localRef = useRef<TextInput>(null);
  const ref = inputRef ?? localRef;

  // 边打字边解析，实时展示 AI 的理解
  const parsed = useMemo(() => (text.trim() ? parseNaturalLanguage(text) : null), [text]);
  // 识别到时间、日期或番茄数中的任意一项就展示解析结果
  const showHint = Boolean(parsed && (parsed.matched || parsed.pomos) && text.trim().length > 2);
  const sound = useMemo(() => aiMatchSound(parsed?.title), [parsed?.title]);

  const submit = useCallback(() => {
    const raw = text.trim();
    if (!raw) return;
    const p = parseNaturalLanguage(raw);
    // 极端情况：整句都被解析成日期/时间/番茄数，没有留下可用标题。
    // 这时不要建一条空任务，直接忽略这次提交。
    if (!p.title.trim()) return;
    const t = addTask({
      title: p.title,
      date: date ?? p.date,
      time: p.time,
      rawInput: raw,
      estimatePomos: p.pomos,
    });
    setText('');
    onChange?.('');
    onSubmit?.(t, p.title);
  }, [text, date, addTask, onSubmit, onChange]);

  return (
    <View style={{ gap: spacing.sm }}>
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
            paddingLeft: spacing.lg,
            paddingRight: 5,
            height: compact ? 48 : 54,
          },
          shadow.card,
        ]}
      >
        <Text style={{ color: c.accent, fontSize: 17 }}>＋</Text>
        <TextInput
          ref={ref}
          value={text}
          onChangeText={v => {
            setText(v);
            onChange?.(v);
          }}
          onSubmitEditing={submit}
          returnKeyType="done"
          blurOnSubmit={false}
          autoFocus={autoFocus}
          placeholder={PLACEHOLDER}
          placeholderTextColor={c.textFaint}
          style={[
            { flex: 1, color: c.text, fontSize: 15, fontWeight: '600', paddingVertical: 0 },
            { outlineStyle: 'none' } as any,
          ]}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim()}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: text.trim() ? c.accent : c.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: text.trim() ? c.accentText : c.textFaint, fontSize: 19, fontWeight: '800' }}>
            ↑
          </Text>
        </Pressable>
      </View>

      {showHint && parsed ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: c.accentSoft,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ fontSize: 12 }}>✨</Text>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {describe(parsed.date, parsed.time, date)}
            {parsed.pomos ? ` · ${parsed.pomos} 🍅` : ''}
            {' · '}
            {sound.scene}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** 把解析结果说成人话，让用户确认 AI 理解对了 */
function describe(parsedDate: DateKey, time: string | undefined, targetDate?: DateKey): string {
  const d = new Date(parsedDate);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  let when = isToday ? 'Today' : `${M[d.getMonth()]} ${d.getDate()}`;
  if (time) when += ` at ${time}`;

  // 与归属日期不一致时明确提示，避免用户以为存错日期
  if (targetDate && parsedDate !== targetDate) when += ` · moving to ${M[d.getMonth()]} ${d.getDate()}`;
  return when;
}