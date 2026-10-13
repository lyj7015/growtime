/**
 * 底部横幅广告 —— Web 端空实现
 * ---------------------------------------------------------------------------
 * AdMob 只有 iOS / Android 原生 SDK，Web 没有任何对应实现
 * （Web 端要投广告得用 Google AdSense，那是另一套东西）。
 *
 * 所以这里恒返回 null：Web 部署版本布局与现在完全一致，不会出现空广告条。
 * 原生端由同目录的 BannerAd.native.tsx 接管，Metro 会自动按平台选择。
 */
import type { ReactElement } from 'react';

export function BannerAd(_props: { visible: boolean }): ReactElement | null {
  return null;
}
