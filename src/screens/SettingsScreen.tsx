import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../components/ThemeProvider';
import { Button, Card, FadeIn, Label, Row, Segmented, Toggle } from '../components/ui';
import { PremiumPerkList, usePaywall } from '../components/Paywall';
import { useAmbience } from '../components/AmbienceProvider';
import { radius, spacing } from '../theme';
import { useStore } from '../store';
import { syncLive } from '../config/credentials';
import { PERMISSION_COPY, requestPermission } from '../services/permissions';
import { aiMatchSound } from '../services/ai';
import {
  FREE_SOUND_COUNT,
  FREE_TIER_SUMMARY,
  PRESET_MAX,
  PRESET_MIN,
  SOUNDS,
  TOTAL_SOUND_COUNT,
  isDurationsLocked,
  soundLabel,
} from '../services/premium';
import type { FeatureModule, SoundId } from '../types';

export function SettingsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, patchSettings, resetAll, patchOnboarding } = useStore();
  const s = state.settings;

  const premium = usePaywall();
  const { ensureProduct } = premium;

  const [notifState, setNotifState] = useState<string | null>(null);

  /**
   * 打开设置页时加载商品并做一次权益检查：
   * 重装 / 换设备的老用户进到这一页即可自动恢复解锁（不依赖手动 Restore）。
   */
  useEffect(() => {
    ensureProduct();
  }, [ensureProduct]);

  const setFeature = (k: FeatureModule, v: boolean) => {
    patchSettings({ features: { ...s.features, [k]: v } });
    if (k === 'pomodoro' && v) {
      // 首次开启番茄钟时，才到这一刻申请通知权限（分批申请）
      requestPermission('notifications').then(r => setNotifState(r));
    }
  };

  const durationsLocked = isDurationsLocked(s.premiumUnlocked);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + 140,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <FadeIn>
        <Text style={{ color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 }}>Settings</Text>
      </FadeIn>

      {/* 账号 */}
      <FadeIn delay={50}>
        <Card style={{ gap: spacing.md }}>
          <Label>Account</Label>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>
                {state.account.isGuest ? 'On this device' : state.account.email}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                {state.account.isGuest
                  ? `${state.tasks.length} task${state.tasks.length === 1 ? '' : 's'} stored locally. No account needed.`
                  : 'Signed in · syncing enabled'}
              </Text>
            </View>
          </Row>
          <SyncRow />
        </Card>
      </FadeIn>

      {/* 功能模块：按需开启，默认隐藏 */}
      <FadeIn delay={100}>
        <Card style={{ gap: spacing.md }}>
          <View>
            <Label>Features</Label>
            <Text style={{ color: c.textFaint, fontSize: 11.5, marginTop: 4, lineHeight: 16 }}>
              Turn on only what you use. The app stays quiet otherwise.
            </Text>
          </View>

          <FeatureToggle
            title="Pomodoro Timer"
            desc="Focus timer with break cycles"
            value={s.features.pomodoro}
            onChange={v => setFeature('pomodoro', v)}
            onFirstEnable={async () => {
              const r = await requestPermission('notifications');
              setNotifState(r);
            }}
          />
          <FeatureToggle
            title="Quadrant"
            desc="Priority matrix view — off by default"
            value={s.features.quadrant}
            onChange={v => setFeature('quadrant', v)}
          />
          <FeatureToggle
            title="Habit tracking"
            desc="Daily streaks — off by default"
            value={s.features.habit}
            onChange={v => setFeature('habit', v)}
          />

          {notifState === 'denied' ? (
            <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
              Notifications are off. You can enable them later in system settings — GrowTime won’t ask again.
            </Text>
          ) : null}
        </Card>
      </FadeIn>

      {/* 计时 */}
      <FadeIn delay={150}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Timer</Label>
            {durationsLocked ? <LockChip label="Premium" onPress={() => premium.show('durations')} /> : null}
          </Row>
          <View style={{ gap: spacing.md }}>
            <NumField
              label="Focus"
              value={s.presets.focus}
              onChange={v => patchSettings({ presets: { ...s.presets, focus: v } })}
              locked={durationsLocked}
              onLockedPress={() => premium.show('durations')}
            />
            <NumField
              label="Short break"
              value={s.presets.shortBreak}
              onChange={v => patchSettings({ presets: { ...s.presets, shortBreak: v } })}
              locked={durationsLocked}
              onLockedPress={() => premium.show('durations')}
            />
            <NumField
              label="Long break"
              value={s.presets.longBreak}
              onChange={v => patchSettings({ presets: { ...s.presets, longBreak: v } })}
              locked={durationsLocked}
              onLockedPress={() => premium.show('durations')}
            />
          </View>
          {durationsLocked ? (
            <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
              Free keeps the classic 25 / 5 / 15. Tap a locked row to set your own lengths — any
              value from {PRESET_MIN} to {PRESET_MAX} minutes. Your existing values keep working
              either way.
            </Text>
          ) : (
            <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
              Type any length from {PRESET_MIN} to {PRESET_MAX} minutes, or nudge by 5. These apply
              to your next session — the one running right now keeps its length.
            </Text>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 14 }}>Auto-start breaks</Text>
            <Toggle value={s.autoStartBreak} onChange={v => patchSettings({ autoStartBreak: v })} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: spacing.md, gap: 2 }}>
              <Text style={{ color: c.text, fontSize: 14 }}>Focus sound</Text>
              <Text style={{ color: c.textFaint, fontSize: 11, lineHeight: 15 }}>
                {s.soundEnabled
                  ? `Plays “${soundLabel(s.soundId)}” while a focus session is running.`
                  : 'Off — stays silent during focus.'}
              </Text>
            </View>
            <Toggle
              value={s.soundEnabled}
              onChange={v => patchSettings({ soundEnabled: v })}
              label="Focus sound"
            />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 14 }}>Haptics</Text>
            <Toggle value={s.hapticsEnabled} onChange={v => patchSettings({ hapticsEnabled: v })} />
          </Row>
        </Card>
      </FadeIn>

      {/* 外观 */}
      <FadeIn delay={200}>
        <Card style={{ gap: spacing.md }}>
          <Label>Appearance</Label>
          <Segmented
            value={s.themeMode}
            onChange={v => patchSettings({ themeMode: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Card>
      </FadeIn>

      {/* 白噪音 */}
      <FadeIn delay={250}>
        <SoundCard />
      </FadeIn>

      {/* Premium */}
      <FadeIn delay={300}>
        <PremiumCard />
      </FadeIn>

      {/* 危险区 */}
      <FadeIn delay={350}>
        <Card style={{ gap: spacing.md }}>
          <Label>Data</Label>
          <Text style={{ color: c.textMuted, fontSize: 12.5, lineHeight: 18 }}>
            {state.sessions.length} pomodoro session{state.sessions.length === 1 ? '' : 's'} recorded.
            Everything lives in local storage on this device.
          </Text>
          <Button
            label="Reset intro and data"
            variant="danger"
            onPress={() =>
              Alert.alert('Reset everything?', 'This clears all tasks, sessions and settings on this device, and shows the intro again.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAll();
                    patchOnboarding({ slidesSeen: false });
                  },
                },
              ])
            }
          />
        </Card>
      </FadeIn>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ *
 * 通用小组件
 * ------------------------------------------------------------------ */

/** 「Premium」小锁胶囊：把「这项属于付费权益」明确写在标签旁边 */
function LockChip({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        backgroundColor: c.accentSoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 10 }}>🔒</Text>
      <Text style={{ color: c.accent, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SyncRow() {
  const c = useTheme();
  const { patchSettings } = useStore();
  if (!syncLive) {
    return (
      <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
        Cloud sync is a paid-tier extra and isn’t enabled in this build. Local data works fully offline.
      </Text>
    );
  }
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text style={{ color: c.text, fontSize: 14 }}>Cloud sync</Text>
      <Toggle value={false} onChange={() => patchSettings({})} />
    </Row>
  );
}

function FeatureToggle({
  title,
  desc,
  value,
  onChange,
  onFirstEnable,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onFirstEnable?: () => void;
}) {
  const c = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={{ color: c.text, fontSize: 14.5, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: c.textFaint, fontSize: 11.5, marginTop: 1 }}>{desc}</Text>
      </View>
      <Toggle
        value={value}
        onChange={v => {
          if (v && onFirstEnable) onFirstEnable();
          onChange(v);
        }}
      />
    </Row>
  );
}

/**
 * 时长输入行
 * ---------------------------------------------------------------------------
 * 免费用户看到锁定态：值照常显示，但改不了，点一下走购买弹层。
 * 锁定态刻意不用 disabled 输入框 —— 灰掉的输入框点不动，用户会以为 app 坏了。
 *
 * Premium 用户可以自由填 1–180 之间的任意整数：
 *   · 数字键盘直填。只允许合法值即时生效，越界值在失焦时「收拢」回区间，
 *     而不是静默丢弃 —— 否则用户看着框里写着 300、实际存的还是 25，
 *     回到首页才发现设置没生效。
 *   · −5 / +5 走微调，省得为了加五分钟唤起键盘。
 * 改动只影响下一段计时：正在跑的那一段保持开始时的长度（见 hooks/useTimer）。
 */
function NumField({
  label,
  value,
  onChange,
  locked,
  onLockedPress,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  locked?: boolean;
  onLockedPress?: () => void;
}) {
  const c = useTheme();
  const { state } = useStore();
  const hapticsOn = state.settings.hapticsEnabled;

  const [text, setText] = useState(`${value}`);
  /** 正在输入时不被外部值改动打断（例如自己刚触发的那次 onChange） */
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setText(`${value}`);
  }, [value]);

  const buzz = () => {
    if (hapticsOn) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  /** 写回区间内的值；越界时收拢到边界，而不是丢弃 */
  const commit = (n: number) => {
    const clamped = Math.min(PRESET_MAX, Math.max(PRESET_MIN, Math.round(n)));
    if (clamped !== value) onChange(clamped);
    setText(`${clamped}`);
  };

  const step = (delta: number) => {
    buzz();
    commit(value + delta);
  };

  if (locked) {
    return (
      <Pressable
        onPress={onLockedPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, locked. Unlock Premium to change.`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.surfaceAlt,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: 11,
          borderWidth: 1,
          borderColor: c.border,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{label}</Text>
        <Row gap={6}>
          <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '700' }}>{value} min</Text>
          <Text style={{ fontSize: 10 }}>🔒</Text>
        </Row>
      </Pressable>
    );
  }

  return (
    <Row style={{ justifyContent: 'space-between' }} gap={spacing.sm}>
      <Text style={{ color: c.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Row gap={spacing.sm}>
        <StepButton label="−5" disabled={value <= PRESET_MIN} onPress={() => step(-5)} />
        <TextInput
          value={text}
          onChangeText={t => {
            const digits = t.replace(/[^0-9]/g, '').slice(0, 3);
            setText(digits);
            const n = parseInt(digits, 10);
            if (!Number.isNaN(n) && n >= PRESET_MIN && n <= PRESET_MAX) onChange(n);
          }}
          onFocus={() => {
            editing.current = true;
          }}
          onBlur={() => {
            editing.current = false;
            const n = parseInt(text, 10);
            if (Number.isNaN(n)) setText(`${value}`);
            else commit(n);
          }}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          accessibilityLabel={`${label} length in minutes`}
          style={[
            {
              width: 62,
              backgroundColor: c.surfaceAlt,
              borderRadius: radius.sm,
              paddingVertical: 9,
              color: c.text,
              fontSize: 15,
              fontWeight: '700',
              textAlign: 'center',
              borderWidth: 1,
              borderColor: c.border,
            },
            { outlineStyle: 'none' } as any,
          ]}
        />
        <StepButton label="+5" disabled={value >= PRESET_MAX} onPress={() => step(5)} />
      </Row>
      <Text style={{ color: c.textFaint, fontSize: 11, width: 20, textAlign: 'right' }}>min</Text>
    </Row>
  );
}

/** −5 / +5 微调按钮 */
function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label.startsWith('+') ? 'Increase by 5 minutes' : 'Decrease by 5 minutes'}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 42,
        height: 38,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: c.accent, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * 白噪音
 * ------------------------------------------------------------------ */

function SoundCard() {
  const c = useTheme();
  const { state, patchSettings } = useStore();
  const premium = usePaywall();
  const ambience = useAmbience();
  const unlocked = state.settings.premiumUnlocked;

  const selected = state.settings.soundId;
  const suggestion = aiMatchSound(selected);
  const lockedCount = TOTAL_SOUND_COUNT - FREE_SOUND_COUNT;
  const playing = ambience.playing;

  // 离开设置页就停止试听（回到首页只保留「专注中自动播放」这一条规则）。
  // 注意用 ref 承接：依赖里直接放 ambience 会让清理函数在每次重渲染时都跑一遍，
  // 结果就是「刚点开就被自己停掉」。
  const stopPreviewRef = useRef(ambience.stopPreview);
  stopPreviewRef.current = ambience.stopPreview;
  useEffect(() => () => stopPreviewRef.current(), []);

  const onPick = (id: SoundId) => {
    // 声音总开关关着时点音效，显然是想要听 —— 顺手打开，而不是让点击没反应
    if (!state.settings.soundEnabled) patchSettings({ soundEnabled: true, soundId: id });
    else if (id !== selected) patchSettings({ soundId: id });

    // 试听：再点一次同一段即停
    ambience.togglePreview(id);
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={spacing.sm}>
          <Label>White noise</Label>
          {playing ? (
            <Text style={{ color: c.accent, fontSize: 11, fontWeight: '700' }}>
              ♪ playing
            </Text>
          ) : null}
        </Row>
        {!unlocked ? <LockChip label={`${lockedCount} locked`} onPress={() => premium.show('sounds')} /> : null}
      </Row>

      <Row gap={spacing.sm} style={{ flexWrap: 'wrap' }}>
        {SOUNDS.map(s => {
          const locked = !s.free && !unlocked;
          const on = playing === s.id;
          const chosen = selected === s.id && !playing;
          return (
            <Pressable
              key={s.id}
              // 锁定的不放任「点了没反应」—— 直接打开购买弹层，并说明是哪一个被锁了
              onPress={() =>
                locked ? premium.show('sounds', { soundLabel: s.label }) : onPick(s.id)
              }
              accessibilityRole="button"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: chosen || on }}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 13,
                borderRadius: 999,
                backgroundColor: on ? c.accent : c.surfaceAlt,
                borderWidth: on || locked ? 0 : 1,
                borderColor: chosen ? c.accent : c.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: on ? c.accentText : locked ? c.textFaint : c.textMuted,
                  fontSize: 12.5,
                  fontWeight: '600',
                }}
              >
                {on ? '♪ ' : ''}
                {s.label}
                {locked ? ' 🔒' : ''}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
        {playing
          ? `Playing “${SOUNDS.find(s => s.id === playing)?.label}”. Tap it again to stop — this one plays through your focus sessions.`
          : `Tap a sound to hear it. Your pick plays automatically through every focus session.${
              unlocked ? '' : ` ${FREE_SOUND_COUNT} of ${TOTAL_SOUND_COUNT} are free.`
            }`}
      </Text>

      <Text style={{ color: c.textMuted, fontSize: 11.5 }}>
        Suggested scene: {suggestion.scene} · matched locally, nothing leaves your device.
      </Text>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Premium 卡片
 * 免费：权益清单（逐条列出买它能得到什么）+ 购买 + 恢复
 * 已购：权益清单打勾 + 恢复入口（App Store 要求非消耗型随时可恢复）
 * ------------------------------------------------------------------ */

function PremiumCard() {
  const c = useTheme();
  const { state } = useStore();
  const { unlocked, storeStatus, priceLabel, buying, restoring, buy, restore } = usePaywall();

  return (
    <Card
      style={{
        gap: spacing.md,
        backgroundColor: unlocked ? c.surface : c.accentSoft,
        borderColor: unlocked ? c.border : 'transparent',
      }}
    >
      <View>
        <Text style={{ color: unlocked ? c.text : c.accent, fontSize: 17, fontWeight: '800' }}>
          {unlocked ? 'Premium active' : 'Go Premium'}
        </Text>
        <Text
          style={{
            color: unlocked ? c.textMuted : c.accent,
            fontSize: 12.5,
            marginTop: 3,
            lineHeight: 18,
          }}
        >
          {unlocked
            ? 'Thank you — ads are gone and every sound is open.'
            : `One-time purchase · ${priceLabel}. No subscription, nothing to cancel.`}
        </Text>
      </View>

      <PremiumPerkList unlocked={unlocked} />

      {!unlocked ? (
        <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>{FREE_TIER_SUMMARY}</Text>
      ) : null}

      {!unlocked && storeStatus === 'unavailable' ? (
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17 }}>
          Purchases are unavailable right now — the App Store could not be reached or the product is
          not configured yet. Open this page again later.
        </Text>
      ) : null}

      {!unlocked ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label={
              storeStatus === 'loading'
                ? 'Loading…'
                : storeStatus === 'unavailable'
                  ? 'Unavailable'
                  : buying
                    ? 'Processing…'
                    : `Unlock · ${priceLabel}`
            }
            onPress={buy}
            disabled={buying || storeStatus !== 'ready'}
          />
          {/* App Store 审核要求：非消耗型购买必须提供恢复入口 */}
          <Button
            label={restoring ? 'Restoring…' : 'Restore purchases'}
            variant="secondary"
            onPress={restore}
            disabled={restoring || storeStatus === 'loading'}
            compact
          />
        </View>
      ) : (
        <Button
          label={restoring ? 'Restoring…' : 'Restore purchases'}
          variant="secondary"
          onPress={restore}
          disabled={restoring}
          compact
        />
      )}
    </Card>
  );
}
