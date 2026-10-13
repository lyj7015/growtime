/**
 * Web 端购买空实现。
 * ------------------------------------------------------------------
 * 真实实现在 purchases.native.ts（expo-iap），由 Metro 按平台解析：
 * Web 无 App Store / Google Play 商店，购买能力视为不可用。
 */

export type PremiumProductInfo = {
  id: string;
  displayPrice: string;
  title: string;
};

export type PurchaseOutcome =
  | { ok: true }
  | { ok: false; code: 'cancelled' | 'unavailable' | 'failed'; message: string };

/** Web 端永远触发不了；签名与原生版一致便于调用方无差别使用 */
export function setOnPremiumOwned(_cb: () => void): () => void {
  return () => {};
}

export async function loadPremiumProduct(): Promise<PremiumProductInfo | null> {
  return null;
}

export async function purchasePremium(): Promise<PurchaseOutcome> {
  return {
    ok: false,
    code: 'unavailable',
    message: 'Purchases are only available in the mobile app.',
  };
}

export async function restorePremium(): Promise<PurchaseOutcome> {
  return {
    ok: false,
    code: 'unavailable',
    message: 'Purchases are only available in the mobile app.',
  };
}
