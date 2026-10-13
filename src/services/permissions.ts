import { Platform } from 'react-native';

/**
 * 分批权限申请
 * ------------------------------------------------------------------
 * 规格明确要求：**不要首登一次性索要所有权限**。
 * 做法是「用到对应功能时再申请」，这里把每类权限的申请时机固化下来。
 *
 * 注意：expo-notifications 未安装时会优雅降级 —— 开发环境直接放行，
 * 生产环境返回 denied，由调用方决定是否提示用户去系统设置开启。
 */

export type PermissionKind = 'notifications' | 'calendar';

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

let notifiedGranted = false;

/** 读取当前权限状态 */
export async function checkPermission(kind: PermissionKind): Promise<PermissionState> {
  try {
    if (kind === 'notifications') {
      let mod: any = null;
      try {
        // expo-notifications 是可选依赖，没装就用降级逻辑
        mod = require('expo-notifications');
      } catch {
        return 'unavailable';
      }
      const { status } = await mod.getPermissionsAsync();
      return normalize(status);
    }

    // 日历权限走系统层：Expo 没有统一 API，用原生模块查询
    if (Platform.OS === 'ios') {
      const { NativeModules } = require('react-native');
      const cal = NativeModules?.EXCalendar?.requestPermissions?.();
      if (!cal) return 'unavailable';
      const s = await cal;
      return normalize(s);
    }
    // Android 日历权限属于危险权限，需原生申请；此处未接入时视为不可用
    return 'unavailable';
  } catch {
    return 'denied';
  }
}

/**
 * 按需申请权限
 * 关键：**只在用户真正用到该功能的那一刻调用**，不要在首登时全要一遍。
 */
export async function requestPermission(kind: PermissionKind): Promise<PermissionState> {
  try {
    if (kind === 'notifications') {
      let mod: any = null;
      try {
        mod = require('expo-notifications');
      } catch {
        // 未安装模块：开发环境视为已授权，保证流程能走通
        if (__DEV__) {
          notifiedGranted = true;
          return 'granted';
        }
        return 'unavailable';
      }
      const current = await mod.getPermissionsAsync();
      if (current.granted) return 'granted';

      // 分批策略：已经拒绝过就不再反复弹窗打扰，改为引导去系统设置
      if (current.canAskAgain === false) return 'denied';

      const asked = await mod.requestPermissionsAsync();
      return normalize(asked.status);
    }

    const state = await checkPermission(kind);
    return state;
  } catch (e) {
    console.warn(`[GrowTime] permission request failed: ${kind}`, e);
    return 'denied';
  }
}

/** 通知是否已就绪 */
export function notificationsReady() {
  return notifiedGranted;
}

function normalize(status: any): PermissionState {
  switch (status) {
    case 'granted':
    case 'allow':
      return 'granted';
    case 'denied':
    case 'blocked':
      return 'denied';
    case 'undetermined':
      return 'undetermined';
    default:
      return 'undetermined';
  }
}

/** 权限说明文案，弹窗前先讲清楚为什么需要，降低拒绝率 */
export const PERMISSION_COPY: Record<PermissionKind, { title: string; body: string; action: string }> = {
  notifications: {
    title: 'Stay on track',
    body: 'GrowTime can remind you when a task is due, so nothing slips through.',
    action: 'Allow reminders',
  },
  calendar: {
    title: 'See your schedule',
    body: 'Calendar access lets GrowTime place your tasks on the real calendar.',
    action: 'Allow calendar',
  },
};