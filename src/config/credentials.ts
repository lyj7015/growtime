/**
 * GrowTime — 账号 / 平台标识集中配置
 * ---------------------------------------------------------------
 * 这个文件是全项目唯一允许写「密钥、App ID、商品 ID」的地方。
 *
 * 目前全部为占位符（PLACEHOLDER_*），功能代码读取它们并做可用性判断：
 * 只要还是占位符，对应的线上能力会自动降级为本地模拟 / 隐藏入口，
 * 不会因为缺账号而崩溃或报错。
 *
 * 填入真实值时：把 PLACEHOLDER_ 前缀去掉，并确保该能力已在 app.config.ts 同步配置。
 */

/** 判断一个配置项是否还是未填写的占位符 */
export function isConfigured(value: string | undefined | null): boolean {
  if (!value) return false;
  const v = value.trim();
  if (!v) return false;
  return !v.startsWith('PLACEHOLDER_') && !v.startsWith('YOUR_');
}

const cfg = {
  /** 应用信息 */
  app: {
    slug: 'growtime',
    name: 'GrowTime',
    /** 引导页与 AI 文案的语言：产品界面全英文 */
    locale: 'en' as const,
  },

  /**
   * 广告（Google AdMob）
   * -----------------------------------------------------------------
   * 获取途径：
   *  1. 打开 https://admob.google.com 登录 Google 账号
   *  2. 左下角「Add app」→ 选择 Android / iOS，分别填写包名与商店 ID
   *     Android 包名 = com.growtime.app（与 app.config.ts 的 android.package 一致）
   *  3. 创建完成后，在该 App 下的「App settings」页复制 App ID
   *  4. App ID 形如 ca-app-pub-3940256099942544~3347511713
   *
   * 说明：Google 官方测试广告位 ID 可直接用于开发调试，正式上架务必替换。
   */
  ads: {
    enabled: true,

    /**
     * AdMob App ID（app 级，形如 ca-app-pub-XXXX~YYYY，注意是波浪号）
     * ------------------------------------------------------------------
     * 这个值**不在这里填**，它在 `app.json` 的 react-native-google-mobile-ads
     * 插件配置里 —— 因为原生打包时读取的是插件配置，写两处只会产生不一致。
     *
     * 当前 app.json 里填的是 Google 官方测试 App ID，方便开发包直接跑起来；
     * 正式上架前必须替换成你自己的 App ID：
     *   AdMob 后台 → Apps → 选中应用 → App settings → App ID
     *
     * 与下面的广告位 ID（斜杠 /）不是一回事，别混淆。
     */
    /**
     * 横幅广告位 ID（平台相关，必须分平台各建一个，不能混用）
     * iOS 已填；Android 需在 AdMob 后台为 Android 应用另建横幅广告位后填入。
     * 未填写的那一侧会自动不展示广告，而不是崩掉。
     */
    bannerUnitIdIos: 'ca-app-pub-1048939483389167/2257761509',
    bannerUnitIdAndroid: 'PLACEHOLDER_ADMOB_BANNER_UNIT_ID_ANDROID',

    /**
     * 开发期使用的 Google 官方测试广告位。
     * 开发时点自己的正式广告 = 无效流量，可能导致 AdMob 封号，
     * 所以 __DEV__ 下一律走这两个测试位。
     */
    testBannerUnitIdIos: 'ca-app-pub-3940256099942544/2934735716',
    testBannerUnitIdAndroid: 'ca-app-pub-3940256099942544/6300978111',

    /**
     * 测试设备白名单（真机）
     * ------------------------------------------------------------------
     * 模拟器会被 SDK 自动识别为测试设备，**无需填写**；
     * 只有「真机 + 看正式广告位」时才需要把设备 ID 加进来 ——
     * 否则你自己点自己的广告会产生无效流量。
     *
     * 获取方式：真机跑一次带广告的包，看 Xcode 控制台 / Android logcat，
     *   日志里会打印一行形如
     *   <Google> To get test ads on this device, set:
     *     GADMobileAds.sharedInstance.requestConfiguration.testDeviceIdentifiers =
     *     @[ @"33f78d0f9c8d1b1a2b3c..." ];
     *   把引号里那串哈希复制到下面即可。
     *
     * 同时作用于广告请求（setRequestConfiguration）与 UMP 同意表单调试。
     * 留空 = 不启用白名单，行为与之前完全一致。
     */
    testDeviceIds: [] as readonly string[],

    /**
     * 横幅展示范围：前三个 Tab（首页 / 任务 / 日历）。
     * 设置页不出广告；Premium 买断用户全局免广告（见 SettingsScreen 的权益文案）。
     */
    bannerTabs: ['home', 'tasks', 'calendar'] as const,

    /** 激励广告（Android 启用；iOS 按规格关闭激励广告） */
    rewardedEnabledAndroid: true,
    rewardedEnabledIos: false,
    /** 激励广告每次展示后可解锁的时长（分钟），0 = 解锁当日全部高级白噪音 */
    rewardedUnlockMinutes: 60,
  },

  /**
   * 内购（Premium 一次性买断）
   * -----------------------------------------------------------------
   * 获取途径：
   *  1. Google Play Console →  Monetize setup → Products → Create product
   *     商品 ID 建议：growtime_premium_lifetime
   *  2. App Store Connect → In-App Purchases → Create，Product ID 需与上面保持一致
   *  3. 两个商店均设为「非消耗型 / 非订阅」，一次性买断 $9.99
   *
   * 注意：下面的 displayPrice 只影响「商店未返回价格时」的兜底文案，
   * 真实售价必须在 App Store Connect / Google Play Console 的商品里设置，
   * 且必须是商店提供的价位档位（$9.99 是美国区标准档）。
   */
  premium: {
    /**
     * 商品 ID（Android / iOS 保持一致）。
     * 已对接 iOS：App Store Connect 非消耗型商品
     *   com.luchentech.growtime.unlockpremium_vip
     * Android 侧若未在 Play Console 创建同名商品，purchasePremium() 会自然失败，
     * 不影响 iOS 流程。
     */
    productId: 'com.luchentech.growtime.unlockpremium_vip',
    /** 展示用价格文案，真实价格由商店返回的 localizedPrice 覆盖 */
    displayPrice: '$9.99',
    /** 购买成功后是否本地解锁（无账号时） */
    unlockLocallyWhenGuest: true,
  },

  /**
   * 账号体系
   * -----------------------------------------------------------------
   * 规格要求：支持邮箱 / Google / Apple / 手机号登录，且**必须允许游客先用**。
   * 游客数据存本地，用户想同步时再绑定账号 —— 这是降低流失的关键，不能改成强制登录。
   *
   * 接入方式（二选一）：
   *  A. 自建后端：把 apiBaseUrl 指向你的服务，由后端签发并校验 token
   *  B. 第三方托管（推荐，省后端）：Firebase Auth / Supabase Auth / Clerk
   *     把 provider 配置填到下方 authProviders，然后实现 authClient.ts 的适配
   *
   * 未配置时：登录页仍可展示（方便你先把 UI 走通），但点击会走本地游客流程，
   * 并在界面上明确提示「尚未接入账号服务」。
   */
  auth: {
    /** 自建后端地址，留空表示使用第三方托管或纯本地模式 */
    apiBaseUrl: 'PLACEHOLDER_API_BASE_URL',
    /** 是否开放「登录后同步」入口 */
    syncEnabled: true,
    /** 是否允许游客试用（规格强制要求为 true，勿关） */
    guestModeEnabled: true,
    /** 游客数据达到多少条任务后，才提示绑定账号 */
    guestNudgeTaskThreshold: 10,
    providers: {
      email: 'PLACEHOLDER_AUTH_EMAIL',
      google: 'PLACEHOLDER_AUTH_GOOGLE_CLIENT_ID',
      apple: 'PLACEHOLDER_AUTH_APPLE_SERVICE_ID',
      phone: 'PLACEHOLDER_AUTH_PHONE_SMS',
    } as Record<'email' | 'google' | 'apple' | 'phone', string>,
  },

  /**
   * 云同步（Premium 高级权益，MVP 可不开启）
   * -----------------------------------------------------------------
   * 规格：付费版可选云同步作为高级权益。
   * 关闭时，Premium 购买仍可用，只是同步入口置灰。
   */
  sync: {
    /** 关闭后前端不展示同步 UI */
    enabled: false,
    /** Node.js 后端地址 */
    baseUrl: 'PLACEHOLDER_SYNC_BASE_URL',
    /** 轮询间隔（毫秒） */
    pollIntervalMs: 60_000,
  },

  /**
   * AI（本地规则算法，不联网、不调用大模型）
   * -----------------------------------------------------------------
   * 规格明确要求保持轻量化本地 AI，因此这里**不需要任何 API Key**。
   * 仅当未来要接入真正的模型识别时，才需要填下面的 key。
   */
  ai: {
    /** 纯本地规则算法，不联网。规格强制要求，勿改为 true */
    localOnly: true,
    /** 可选：未来接入大模型时使用，留空则完全离线 */
    apiKey: 'PLACEHOLDER_AI_API_KEY',
    baseUrl: 'PLACEHOLDER_AI_BASE_URL',
    model: 'PLACEHOLDER_AI_MODEL',
  },

  /**
   * 微信登录（国内发布时需要；若仅海外发布可忽略）
   * 注意：微信开放平台 AppID 属于公开标识，不是密钥，但仍建议集中管理。
   */
  wechat: {
    appId: 'PLACEHOLDER_WECHAT_APP_ID',
    universalLink: 'PLACEHOLDER_WECHAT_UNIVERSAL_LINK',
  },
} as const;

export default cfg;

/**
 * 便捷导出：横幅广告是否真的可用。
 * 只要某一个平台的广告位 ID 填了，就认为广告能力已开通；
 * 具体某个平台能不能出广告，由 services/ads.ts 按当前平台判断。
 */
export const adsLive =
  isConfigured(cfg.ads.bannerUnitIdIos) || isConfigured(cfg.ads.bannerUnitIdAndroid);
/** 便捷导出：账号服务是否真的可用 */
export const authLive = isConfigured(cfg.auth.apiBaseUrl) || Object.values(cfg.auth.providers).some(isConfigured);
/** 便捷导出：内购是否真的可用 */
export const premiumLive = isConfigured(cfg.premium.productId);
/** 便捷导出：云同步是否真的可用 */
export const syncLive = cfg.sync.enabled && isConfigured(cfg.sync.baseUrl);