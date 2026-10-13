/**
 * 广告 SDK 生命周期 —— 原生端（iOS / Android）
 * ---------------------------------------------------------------------------
 * 这个文件的职责：把「同意 → 授权 → 初始化」三步按 Google 官方要求的**顺序**跑完，
 * 并且只跑一次。UI 层只依赖它的结论（AdsInitResult.initialized）。
 *
 * 官方顺序（顺序错了会违规或被 SDK 拒绝）：
 *   1. setRequestConfiguration   —— 请求级配置必须早于 initialize
 *   2. UMP 同意（gatherConsent） —— EEA / 英国 / 瑞士用户会弹同意表单
 *   3. ATT 授权（iOS 14.5+）     —— 拿 IDFA 的前提
 *   4. mobileAds().initialize()  —— 只有拿到同意结论才初始化
 *
 * 为什么不能反过来：SDK 在 initialize 时可能**立刻预拉广告**，
 * 如果在同意之前初始化，就可能已经发出了不该发的请求。
 *
 * Web 端由同目录的 adInit.ts 接管（Metro 按平台解析），那边是空实现。
 */
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
  PermissionStatus,
} from 'expo-tracking-transparency';

import cfg from '../config/credentials';
import type { AdsInitResult, TrackingState } from './ads';

/** 白名单为空时返回 undefined，避免把空数组传给原生层 */
function testDevices(): string[] | undefined {
  const ids = cfg.ads.testDeviceIds;
  return ids.length > 0 ? [...ids] : undefined;
}

function mapTracking(status: string): TrackingState {
  if (status === PermissionStatus.GRANTED) return 'granted';
  if (status === PermissionStatus.DENIED) return 'denied';
  if (status === PermissionStatus.UNDETERMINED) return 'undetermined';
  return 'unavailable';
}

/**
 * 第 3 步：ATT 授权。
 * 只在「系统从未问过」时弹框 —— 已拒绝过就不再骚扰（重复调用也不会再弹）。
 * Android / Web / iOS 14.5 以下：该 API 直接返回 granted，无副作用。
 */
async function ensureTracking(): Promise<TrackingState> {
  try {
    const current = await getTrackingPermissionsAsync();
    if (current.status === PermissionStatus.UNDETERMINED) {
      const asked = await requestTrackingPermissionsAsync();
      return mapTracking(asked.status);
    }
    return mapTracking(current.status);
  } catch {
    return 'unavailable';
  }
}

/** 第 2 步：UMP 同意 */
async function gatherConsent(): Promise<{ canRequestAds: boolean; status: string }> {
  const devs = testDevices();
  try {
    // 非 EEA 地区 isConsentFormAvailable 为 false，不会弹任何表单，直接返回 NOT_REQUIRED
    const info = await AdsConsent.gatherConsent(devs ? { testDeviceIdentifiers: devs } : {});
    return { canRequestAds: info.canRequestAds, status: info.status };
  } catch {
    // UMP 拿不到结论时（网络异常、后台尚未配置同意表单）**放行**：
    // 宁可保住广告收入，也不要让一次瞬时失败把所有用户都变成无广告版本。
    // 若你更希望严格合规（拿不到同意就不出广告），把这里改成 false 即可。
    return { canRequestAds: true, status: 'error' };
  }
}

async function run(): Promise<AdsInitResult> {
  const devs = testDevices();

  // 第 1 步：请求级配置（测试设备白名单等），必须早于 initialize
  if (devs) {
    try {
      await mobileAds().setRequestConfiguration({ testDeviceIdentifiers: devs });
    } catch {
      // 配置失败不阻断后续流程，最多是测试设备白名单没生效
    }
  }

  const consent = await gatherConsent();
  const tracking = await ensureTracking();

  if (!consent.canRequestAds) {
    // 用户或地区明确不允许请求广告：不初始化，UI 层也不会挂载横幅
    return { initialized: false, canRequestAds: false, tracking, consentStatus: consent.status };
  }

  // 第 4 步：初始化。SDK 会在这里预拉广告，所以必须放在同意之后
  try {
    await mobileAds().initialize();
    return { initialized: true, canRequestAds: true, tracking, consentStatus: consent.status };
  } catch (e) {
    return {
      initialized: false,
      canRequestAds: true,
      tracking,
      consentStatus: consent.status,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 同一时刻只会有一轮流程在跑；成功后永久复用结果 */
let inflight: Promise<AdsInitResult> | null = null;
/** 最近一次成功的结论，供同步查询使用 */
let resolved: AdsInitResult | null = null;

/**
 * 初始化广告 SDK。可安全重复调用（幂等）。
 *
 * 失败时会**丢弃缓存**，因此下次调用可以重试（例如网络恢复后再进入首页）。
 * 但「用户明确不同意」这种正常结论会保留，避免反复弹同意表单。
 */
export function initAds(): Promise<AdsInitResult> {
  if (!inflight) {
    inflight = run().then(r => {
      // 只有异常类失败才清缓存重试；canRequestAds=false 是正常结论，保持缓存
      if (r.error) inflight = null;
      else resolved = r;
      return r;
    });
  }
  return inflight;
}

/** 广告 SDK 是否已经就绪（同步查询，不触发初始化） */
export function adsInitialized(): boolean {
  return resolved?.initialized === true;
}
