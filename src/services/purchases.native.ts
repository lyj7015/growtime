/**
 * iOS / Android 真实内购实现（expo-iap，OpenIAP 规范 / iOS 走 StoreKit 2）。
 * ------------------------------------------------------------------
 * Web 端由 purchases.ts 提供同名空实现，由 Metro 按平台解析。
 *
 * 核心时序（与官方 useIAP 保持一致）：
 *   1. 先挂 purchaseUpdatedListener / purchaseErrorListener —— 连接一建立，
 *      StoreKit 2 就会自动补发未决交易，监听器必须先就位；
 *   2. initConnection()；
 *   3. fetchProducts() 取商品（价格以商店返回为准）；
 *   4. requestPurchase() 发起系统购买弹窗 —— 它的返回值不代表最终状态，
 *      权威结果只来自监听器事件；
 *   5. 收到购买成功事件后 finishTransaction()（非消耗型 isConsumable=false）。
 *
 * 恢复购买是 App Store 审核硬性要求（非消耗型必须提供 Restore 入口）。
 */

import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type Purchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import cfg from '../config/credentials';

const PRODUCT_ID = cfg.premium.productId;

export type PremiumProductInfo = {
  id: string;
  /** 商店返回的本地化价格（例如 "$9.99"），以它为准展示 */
  displayPrice: string;
  title: string;
};

export type PurchaseOutcome =
  | { ok: true }
  | { ok: false; code: 'cancelled' | 'unavailable' | 'failed'; message: string };

/** 解锁回调：购买 / 恢复 / 未决交易补发成功时触发（可能晚于用户操作，例如补发） */
let onOwnedCb: () => void = () => {};

/** 注册「拿到 Premium 权益」回调，返回注销函数 */
export function setOnPremiumOwned(cb: () => void): () => void {
  onOwnedCb = cb;
  return () => {
    if (onOwnedCb === cb) onOwnedCb = () => {};
  };
}

// ---------------------------------------------------------------------------
// 连接与监听器（模块级单例）
// ---------------------------------------------------------------------------

let connected = false;
let connecting: Promise<boolean> | null = null;
let listenersReady = false;
/** 当前等待购买结果的 resolver（同一时刻只允许一笔进行中） */
let pendingBuy: ((o: PurchaseOutcome) => void) | null = null;

function handleVerifiedPurchase(p: Purchase) {
  if (p.productId !== PRODUCT_ID) return;
  // pending = 等待家长批准等场景，先不解锁；正式 purchased 才交付
  if (p.purchaseState === 'pending') return;
  onOwnedCb();
}

function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;

  // 购买成功 / 未决交易补发都会走这里
  purchaseUpdatedListener(purchase => {
    // 无论是不是我们的商品都及时 finish，避免 StoreKit 队列堆积、反复补发
    finishTransaction({ purchase, isConsumable: false }).catch(() => {});
    handleVerifiedPurchase(purchase);
    if (purchase.productId === PRODUCT_ID && purchase.purchaseState !== 'pending') {
      pendingBuy?.({ ok: true });
      pendingBuy = null;
    }
  });

  purchaseErrorListener(error => {
    // 没有进行中的购买请求时，错误可能来自后台补发等场景，静默
    if (!pendingBuy) return;
    const outcome = mapError(error);
    // 等待家长批准属于「进行中」而非失败，如实告知
    if (error.code === ErrorCode.Pending) {
      pendingBuy({
        ok: false,
        code: 'failed',
        message: 'Your purchase is pending approval. It will unlock automatically once approved.',
      });
    } else {
      pendingBuy(outcome);
    }
    pendingBuy = null;
  });
}

function ensureConnection(): Promise<boolean> {
  if (connected) return Promise.resolve(true);
  if (!connecting) {
    ensureListeners(); // 官方要求：监听器必须先于 initConnection 就位
    connecting = initConnection()
      .then(ok => {
        connected = true;
        return true;
      })
      .catch(e => {
        connecting = null; // 允许下次重试
        throw e;
      });
  }
  return connecting;
}

function mapError(e: unknown): PurchaseOutcome {
  const code = (e as { code?: ErrorCode | string })?.code;
  const message = (e as { message?: string })?.message ?? 'Purchase failed.';
  if (code === ErrorCode.UserCancelled) {
    return { ok: false, code: 'cancelled', message: 'Purchase cancelled.' };
  }
  if (code === ErrorCode.AlreadyOwned || code === ErrorCode.DuplicatePurchase) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'You already own Premium. Use Restore to unlock it on this device.',
    };
  }
  if (
    code === ErrorCode.NetworkError ||
    code === ErrorCode.ServiceTimeout ||
    code === ErrorCode.RemoteError
  ) {
    return {
      ok: false,
      code: 'failed',
      message: 'Could not reach the App Store. Check your connection and try again.',
    };
  }
  return { ok: false, code: 'failed', message };
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/** 查询 Premium 商品；返回 null 表示商店不可达 / 商品未就绪（例如未签 Paid Apps 协议） */
export async function loadPremiumProduct(): Promise<PremiumProductInfo | null> {
  try {
    await ensureConnection();
    const products = await fetchProducts({ skus: [PRODUCT_ID], type: 'in-app' });
    const list = (products ?? []) as Product[];
    const p = list.find(x => x.id === PRODUCT_ID);
    if (!p) return null;
    // 顺带做一次权益检查：重装 / 换设备后打开设置页即可自动恢复
    void checkExistingEntitlement();
    return {
      id: p.id,
      displayPrice: p.displayPrice || cfg.premium.displayPrice,
      title: p.title || p.displayName || 'GrowTime Premium',
    };
  } catch {
    return null;
  }
}

async function checkExistingEntitlement() {
  try {
    const owned = await getAvailablePurchases();
    if ((owned ?? []).some(x => x.productId === PRODUCT_ID)) onOwnedCb();
  } catch {
    // 权益查询失败不影响主流程，用户仍可手动 Restore
  }
}

/** 发起真实购买。结果以监听器事件为准（requestPurchase 的返回值不可靠） */
export async function purchasePremium(): Promise<PurchaseOutcome> {
  if (pendingBuy) {
    return { ok: false, code: 'failed', message: 'Another purchase is already in progress.' };
  }
  try {
    await ensureConnection();
    const outcome = await new Promise<PurchaseOutcome>(resolve => {
      pendingBuy = resolve;
      // 兜底超时：StoreKit 卡死时不至于永久转圈
      setTimeout(() => {
        if (pendingBuy === resolve) {
          pendingBuy = null;
          resolve({
            ok: false,
            code: 'failed',
            message: 'The purchase is taking too long. Check back in a moment.',
          });
        }
      }, 120_000);
      const request =
        Platform.OS === 'ios'
          ? { apple: { sku: PRODUCT_ID } }
          : { google: { skus: [PRODUCT_ID] } };
      // 6.x 返回 Purchase | Purchase[] | null，但官方明确「以事件为最终状态」；
      // 这里吞掉返回值，成功统一由 purchaseUpdatedListener 交付
      requestPurchase({ request, type: 'in-app' }).catch(e => {
        if (pendingBuy === resolve) {
          pendingBuy = null;
          resolve(mapError(e));
        }
      });
    });
    return outcome;
  } catch (e) {
    return mapError(e);
  }
}

/** 恢复购买（App Store 审核硬性要求） */
export async function restorePremium(): Promise<PurchaseOutcome> {
  try {
    await ensureConnection();
    await restorePurchases(); // iOS: 与 App Store 同步
    const owned = await getAvailablePurchases();
    if ((owned ?? []).some(x => x.productId === PRODUCT_ID)) {
      onOwnedCb();
      return { ok: true };
    }
    return {
      ok: false,
      code: 'unavailable',
      message: 'No previous Premium purchase was found on this Apple ID.',
    };
  } catch (e) {
    return mapError(e);
  }
}
