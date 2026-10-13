/**
 * 广告配置解析层
 * ---------------------------------------------------------------------------
 * 这一层只做「判断 + 取值」，**不 require 原生模块**，因此 Web 端也能安全引入。
 * 真正的原生 SDK 调用收敛在 components/BannerAd.native.tsx 里。
 *
 * 平台差异：
 *  - iOS / Android：走 react-native-google-mobile-ads（需要 development build 或正式包，
 *    Expo Go 与 Web 都不支持原生广告 SDK）
 *  - Web：本项目当前以 Web 形式部署，AdMob 无 Web 实现，一律不出广告
 */
import { Platform } from 'react-native';
import cfg, { isConfigured } from '../config/credentials';

/** 广告只可能在原生端出现 */
export function adsPlatformSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** 是否处于开发模式（RN 全局量，Web 构建里也可能不存在） */
function isDev(): boolean {
  try {
    return typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  } catch {
    return false;
  }
}

/**
 * 取当前平台应使用的横幅广告位 ID。
 *  - 开发期：一律用 Google 官方测试广告位，避免误点正式广告造成无效流量
 *  - 正式期：取对应平台的广告位；该平台没填则返回 null（不展示，而不是崩溃）
 */
export function bannerUnitId(): string | null {
  if (!adsPlatformSupported()) return null;
  if (!cfg.ads.enabled) return null;

  const ads = cfg.ads;
  if (isDev()) {
    return Platform.OS === 'ios' ? ads.testBannerUnitIdIos : ads.testBannerUnitIdAndroid;
  }

  const real = Platform.OS === 'ios' ? ads.bannerUnitIdIos : ads.bannerUnitIdAndroid;
  return isConfigured(real) ? real : null;
}

/** 指定 Tab 是否属于允许展示横幅的页面 */
export function bannerAllowedOnTab(tab: string): boolean {
  return (cfg.ads.bannerTabs as readonly string[]).includes(tab);
}

/**
 * ATT（App Tracking Transparency）授权状态。
 * iOS 14.5 以下系统不支持，会返回 granted；其他平台一律 unavailable。
 */
export type TrackingState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * 广告初始化结果。
 * UI 层靠它判断「现在能不能真的去拉广告」——
 * 关键约束：只有 initialized === true 时才允许挂载广告组件，
 * 因为 Google 要求同意流程与请求配置都必须早于 SDK 初始化完成。
 */
export type AdsInitResult = {
  /** SDK 是否完成初始化；false 时不应挂载任何广告组件 */
  initialized: boolean;
  /** UMP 同意结论；false 表示该地区/用户不允许请求广告 */
  canRequestAds: boolean;
  tracking: TrackingState;
  /** UMP 返回的同意状态原文，便于排查（NOT_REQUIRED / OBTAINED / REQUIRED / error） */
  consentStatus: string;
  error?: string;
};

/**
 * 综合判断此刻是否应该展示横幅。
 * @param tab            当前 Tab
 * @param premiumUnlocked 用户是否已买断 Premium（买断后全局免广告）
 */
export function shouldShowBanner(
  tab: string,
  premiumUnlocked: boolean,
): boolean {
  if (!adsPlatformSupported()) return false;
  if (!cfg.ads.enabled) return false;
  // Premium 权益明确写了 "Removes every ad"，这里必须尊重
  if (premiumUnlocked) return false;
  if (!bannerAllowedOnTab(tab)) return false;
  return bannerUnitId() !== null;
}
