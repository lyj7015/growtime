/**
 * Premium 购买弹层 + 权益动作的全局入口
 * ---------------------------------------------------------------------------
 * 为什么做成 Provider 而不是「设置页里的一块 UI」：
 *   1. 权益回调 setOnPremiumOwned 只有一个槽位。之前它挂在设置页的 useEffect 里，
 *      意味着只有进过设置页的人才拿得到「购买 / 补发交易」结果 —— 从首页、白噪音
 *      列表触发的购买会解锁失败。收到这里后全局只注册一次。
 *   2. 触发付费墙的地方变多了（锁定白噪音、锁定时长、首页引导行），
 *      每处都自己写一遍商品加载 + 购买 + 恢复，很快就会各自跑偏。
 *   3. App Store 审核要求「非消耗型购买必须有 Restore 入口」，
 *      恢复购买必须随处可见，而不是藏在设置页最下面。
 *
 * 对外只暴露两样东西：usePaywall() 与 <PremiumUpsellRow />。
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';
import { Button, Row } from './ui';
import { shadow, spacing } from '../theme';
import { useStore } from '../store';
import {
  loadPremiumProduct,
  purchasePremium,
  restorePremium,
  setOnPremiumOwned,
  type PremiumProductInfo,
} from '../services/purchases';
import {
  FALLBACK_PRICE,
  FREE_TIER_SUMMARY,
  PREMIUM_PERKS,
  TOTAL_SOUND_COUNT,
  paywallCopy,
  type PremiumFeatureId,
} from '../services/premium';

type StoreStatus = 'loading' | 'ready' | 'unavailable';
type Phase = 'idle' | 'buying' | 'restoring' | 'done';

type PaywallApi = {
  /** 是否已买断 */
  unlocked: boolean;
  /** 打开购买弹层。feature 决定标题与上下文文案 */
  show: (feature?: PremiumFeatureId, opts?: { soundLabel?: string }) => void;
  /** 商店返回的商品（含本地化价格）；null = 未就绪 */
  product: PremiumProductInfo | null;
  storeStatus: StoreStatus;
  /** 展示用价格，商店没返回时用兜底价 */
  priceLabel: string;
  buying: boolean;
  restoring: boolean;
  buy: () => Promise<void>;
  restore: () => Promise<void>;
  /** 主动触发一次商品加载（设置页挂载时用，顺带做权益检查） */
  ensureProduct: () => void;
};

const PaywallCtx = createContext<PaywallApi | null>(null);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { state, patchSettings, ready } = useStore();
  const unlocked = state.settings.premiumUnlocked;

  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<PremiumFeatureId>('general');
  const [soundName, setSoundName] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('idle');
  const [product, setProduct] = useState<PremiumProductInfo | null>(null);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>('loading');

  // 闭包安全：回调里要用到最新的 patchSettings / 弹层开合状态
  const patchRef = useRef(patchSettings);
  patchRef.current = patchSettings;
  const openRef = useRef(false);
  openRef.current = visible;

  /**
   * 唯一注册点：购买成功 / 恢复成功 / StoreKit 补发未决交易都会走这里。
   * 解锁动作只做一件事 —— 把权益写进本地设置，广告与锁定态随之全面放开。
   */
  useEffect(() => {
    const off = setOnPremiumOwned(() => {
      patchRef.current({ premiumUnlocked: true });
      setPhase(p => (openRef.current && (p === 'buying' || p === 'restoring') ? 'done' : p));
    });
    return off;
  }, []);

  /** 商品只加载一次；商店不可达时下一次调用可重试 */
  const inflight = useRef<Promise<void> | null>(null);
  const ensureProduct = useCallback(() => {
    if (!inflight.current) {
      inflight.current = loadPremiumProduct()
        .then(p => {
          setProduct(p);
          setStoreStatus(p ? 'ready' : 'unavailable');
          // 加载失败允许下次重试（例如刚打开 app 时网络还没起来）
          if (!p) inflight.current = null;
        })
        .catch(() => {
          setStoreStatus('unavailable');
          inflight.current = null;
        });
    }
    return inflight.current;
  }, []);

  /**
   * 启动时做一次权益检查：重装 / 换设备的老用户不必进设置页，
   * 也不该先看到广告再手动恢复。
   * 必须等 store ready —— 否则 hydrate 会把刚写进去的 premiumUnlocked 覆盖回 false。
   */
  useEffect(() => {
    if (!ready) return;
    ensureProduct();
  }, [ready, ensureProduct]);

  const show = useCallback<PaywallApi['show']>(
    (feature = 'general', opts) => {
      if (unlocked) return; // 已买断的人不该再看到付费墙
      setReason(feature);
      setSoundName(opts?.soundLabel);
      setPhase('idle');
      setVisible(true);
      ensureProduct();
    },
    [unlocked, ensureProduct],
  );

  const buy = useCallback(async () => {
    if (phase === 'buying') return;
    setPhase('buying');
    try {
      const outcome = await purchasePremium();
      if (outcome.ok) return; // 成功走权益回调 → 切到 done 态
      setPhase('idle');
      if (outcome.code !== 'cancelled') Alert.alert('Purchase failed', outcome.message);
    } catch (e) {
      setPhase('idle');
      Alert.alert('Purchase failed', (e as Error)?.message ?? 'Something went wrong.');
    }
  }, [phase]);

  const restore = useCallback(async () => {
    if (phase === 'restoring') return;
    setPhase('restoring');
    try {
      const outcome = await restorePremium();
      if (outcome.ok) return; // 同上，回调统一处理
      setPhase('idle');
      Alert.alert('Nothing to restore', outcome.message);
    } catch (e) {
      setPhase('idle');
      Alert.alert('Nothing to restore', (e as Error)?.message ?? 'Something went wrong.');
    }
  }, [phase]);

  const api = useMemo<PaywallApi>(
    () => ({
      unlocked,
      show,
      product,
      storeStatus,
      priceLabel: product?.displayPrice ?? FALLBACK_PRICE,
      buying: phase === 'buying',
      restoring: phase === 'restoring',
      buy,
      restore,
      ensureProduct,
    }),
    [unlocked, show, product, storeStatus, phase, buy, restore, ensureProduct],
  );

  const copy = paywallCopy(reason, { soundLabel: soundName });
  const busy = phase === 'buying' || phase === 'restoring';

  return (
    <PaywallCtx.Provider value={api}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => (busy ? null : setVisible(false))}
      >
        <Pressable
          onPress={() => (busy ? null : setVisible(false))}
          style={{ flex: 1, backgroundColor: 'rgba(10,20,30,0.45)' }}
        />
        <View
          style={[
            {
              backgroundColor: c.bg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.md,
            },
            shadow.bubble,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.border,
            }}
          />

          {phase === 'done' ? (
            <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: c.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: c.accentText, fontSize: 26, fontWeight: '900' }}>✓</Text>
                </View>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}>
                  Premium unlocked
                </Text>
                <Text
                  style={{
                    color: c.textMuted,
                    fontSize: 13,
                    lineHeight: 19,
                    textAlign: 'center',
                    paddingHorizontal: spacing.md,
                  }}
                >
                  Thank you for supporting GrowTime. Ads are gone everywhere and all{' '}
                  {TOTAL_SOUND_COUNT} focus sounds are open.
                </Text>
              </View>
              <Button label="Done" onPress={() => setVisible(false)} />
            </View>
          ) : (
            <>
              <Row gap={spacing.md}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 17 }}>🔒</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>
                    {copy.title}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>
                    {copy.context}
                  </Text>
                </View>
              </Row>

              <PremiumPerkList unlocked={false} />

              <View style={{ gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '800' }}>
                  One-time purchase · {api.priceLabel}
                </Text>
                <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16 }}>
                  {FREE_TIER_SUMMARY}
                </Text>
              </View>

              {storeStatus === 'unavailable' ? (
                <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17 }}>
                  {Platform.OS === 'web'
                    ? 'Purchases are only available in the iPhone app. Everything else works here too.'
                    : 'The App Store could not be reached right now. Check your connection and reopen this screen.'}
                </Text>
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <Button
                  label={
                    storeStatus === 'loading'
                      ? 'Loading…'
                      : phase === 'buying'
                        ? 'Processing…'
                        : storeStatus === 'unavailable'
                          ? 'Unavailable'
                          : `Unlock · ${api.priceLabel}`
                  }
                  onPress={buy}
                  disabled={busy || storeStatus !== 'ready'}
                />
                {/* App Store 审核硬性要求：非消耗型购买必须随处可恢复 */}
                <Button
                  label={phase === 'restoring' ? 'Restoring…' : 'Restore purchases'}
                  variant="secondary"
                  compact
                  onPress={restore}
                  disabled={busy || storeStatus === 'loading'}
                />
                <Button
                  label="Not now"
                  variant="ghost"
                  compact
                  onPress={() => setVisible(false)}
                  disabled={busy}
                />
              </View>
            </>
          )}
        </View>
      </Modal>
    </PaywallCtx.Provider>
  );
}

export function usePaywall(): PaywallApi {
  const ctx = useContext(PaywallCtx);
  if (!ctx) throw new Error('usePaywall must be used inside <PaywallProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ *
 * 权益清单
 * 设置页与购买弹层共用同一份渲染，避免「弹层里写的」和「设置页写的」不一致。
 * ------------------------------------------------------------------ */

export function PremiumPerkList({ unlocked }: { unlocked: boolean }) {
  const c = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {PREMIUM_PERKS.map(p => (
        <Row key={p.id} gap={spacing.md} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: c.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: '900' }}>{p.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 }}>
              {p.title}
            </Text>
            <Text style={{ color: c.textFaint, fontSize: 11.5, lineHeight: 16, marginTop: 1 }}>
              {p.detail}
            </Text>
          </View>
          <Text style={{ color: unlocked ? c.accent : c.textFaint, fontSize: 14, marginTop: 4 }}>
            {unlocked ? '✓' : '🔒'}
          </Text>
        </Row>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * 主页上的轻量引导行
 * 免费用户可见：一行字说清买它能得到什么，点开就是购买弹层。
 * 不做横幅、不遮挡内容 —— 用户正在计时的时候不该被打断。
 * ------------------------------------------------------------------ */

export function PremiumUpsellRow({ feature = 'general' }: { feature?: PremiumFeatureId }) {
  const c = useTheme();
  const { unlocked, show } = usePaywall();
  if (unlocked) return null;

  return (
    <Pressable
      onPress={() => show(feature)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ fontSize: 12 }}>✨</Text>
      <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '700', flex: 1, lineHeight: 18 }}>
        Premium — ad-free, all {TOTAL_SOUND_COUNT} sounds, custom focus lengths
      </Text>
      <Text style={{ color: c.accent, fontSize: 14, fontWeight: '800' }}>›</Text>
    </Pressable>
  );
}
