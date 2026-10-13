/**
 * 底部横幅广告 —— 原生端实现（iOS / Android）
 * ---------------------------------------------------------------------------
 * 对应同目录的 BannerAd.tsx（Web 端空实现）。
 * Metro 按平台解析：原生端优先取 .native.tsx，Web 取 .tsx，
 * 这样原生 SDK 永远不会被打进 Web 包。
 *
 * 关键约束：**必须等 initAds() 走完「同意 → ATT → initialize」才挂载广告组件**。
 * Google 明确要求同意流程早于 SDK 初始化，而广告组件一挂载就会发起请求，
 * 所以这里用 ready 状态把首次请求卡在后面。
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BannerAd as AdmobBanner, BannerAdSize } from 'react-native-google-mobile-ads';

import { initAds } from '../services/adInit';
import { bannerUnitId } from '../services/ads';
import { useTheme } from './ThemeProvider';

export function BannerAd({ visible }: { visible: boolean }) {
  const c = useTheme();
  const unitId = bannerUnitId();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void initAds().then(r => {
      // 同意未通过或初始化失败时 r.initialized 为 false，继续不挂载广告
      if (alive) setReady(r.initialized);
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  // 不满足展示条件时渲染 null，布局里不占任何高度
  if (!visible || !unitId || !ready) return null;

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
        paddingVertical: 6,
      }}
    >
      <AdmobBanner
        unitId={unitId}
        // 锚定自适应横幅：自动匹配设备宽度，底部横幅的标准做法
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => {
          /* 无填充 / 网络异常时不打断用户，静默保持空位 */
        }}
      />
    </View>
  );
}
