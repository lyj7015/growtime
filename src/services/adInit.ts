/**
 * 广告 SDK 生命周期 —— Web 端空实现
 * ---------------------------------------------------------------------------
 * AdMob 只有 iOS / Android 原生 SDK，Web 没有对应实现（Web 要投广告得用
 * Google AdSense，是另一套东西）。所以这里一律返回「未初始化」，
 * 调用方据此不会挂载任何广告组件，Web 部署版本布局与之前完全一致。
 *
 * 原生端由同目录的 adInit.native.ts 接管，Metro 会自动按平台选择。
 */
import type { AdsInitResult } from './ads';

const NOT_APPLICABLE: AdsInitResult = {
  initialized: false,
  canRequestAds: false,
  tracking: 'unavailable',
  consentStatus: 'not-applicable',
};

/** Web 端没有任何需要初始化的东西 */
export function initAds(): Promise<AdsInitResult> {
  return Promise.resolve(NOT_APPLICABLE);
}

/** Web 端恒为未就绪 */
export function adsInitialized(): boolean {
  return false;
}
