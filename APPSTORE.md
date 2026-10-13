# GrowTime — iOS 打包与上架说明

> 本文档记录 iOS 打包所需的全部配置、凭证清单与操作步骤。
> 打包走 **GitHub + EAS Build（Expo 云构建）**，本机（Windows）不需要 Xcode。

---

## 1. App Store Connect 应用信息

在 App Store Connect →「我的 App」→「新建 App」表单中填写以下内容：

| 字段 | 值 |
| --- | --- |
| 平台 | iOS |
| 名称 | 见下方 ⚠️ **注意** |
| 主要语言 | English (United States) |
| 套装 ID（Bundle ID） | `com.luchentech.growtime` |
| SKU | `growtime_pomodoro_01` |
| 用户访问权限 | 完全访问权限 |

### ⚠️ 名称长度必须修正

原始名称 `Growtime - Pomodoro Focus Timer` 共 **31 个字符**，
而 Apple 对 App 名称的硬性上限是 **30 个字符**（App 审核指南 2.3.7）。
直接填入会被 App Store Connect 拒绝。

合规替代方案（可任选，均已同步到本地候选清单）：

| 候选名称 | 长度 | 说明 |
| --- | --- | --- |
| `Growtime - Pomodoro Timer` | 25 | 推荐，简洁且保留核心关键词 |
| `Growtime Pomodoro Focus Timer` | 29 | 保留 "Focus"，无连字符 |
| `Growtime: Pomodoro Timer` | 24 | 冒号分隔 |
| `Growtime - Focus Timer` | 22 | 最短 |

> 补充建议：名称里没塞进去的 `Focus` / `Timer` 关键词，可放到 **副标题（Subtitle，上限 30 字符）**，
> 例如 `Focus timer & task planner`（26 字符）。名称与副标题都会被搜索索引。

### 与二进制包的关系

App Store 的「名称」字段**只存在于 App Store Connect**，不在 IPA 里。
IPA 内的显示名由 `app.json` 的 `ios.infoPlist.CFBundleDisplayName` 控制，
当前固定为 `GrowTime`（主屏图标名，需短，否则会被系统截断）。

---

## 2. 已完成的本地配置

| 文件 | 作用 |
| --- | --- |
| `app.json` | `ios.bundleIdentifier = com.luchentech.growtime`、`ios.buildNumber = 1`、版本 `1.0.0`、启动屏、AdMob 插件 |
| `eas.json` | EAS 构建档位：`preview`（Ad Hoc 真机）/ `production`（App Store） |
| `src/config/credentials.ts` | 账号 / 广告位 / 内购 ID 集中配置（`PLACEHOLDER_` 前缀未填项会自动降级） |

关键版本信息：

- 版本号 `CFBundleShortVersionString` = **1.0.0**
- 构建号 `CFBundleVersion` = **1**

---

## 3. 打包前必须替换的占位配置

以下项目前是 Google 官方**测试值**，正式上架前必须替换，否则广告不产生收益（且可能被审核质疑）：

| 位置 | 当前值 | 需要替换为 |
| --- | --- | --- |
| `app.json` → `react-native-google-mobile-ads.iosAppId` | `ca-app-pub-3940256099942544~1458002511` | AdMob 后台 iOS 应用的 **App ID**（含 `~`） |
| `src/config/credentials.ts` → `ads.bannerUnitIdIos` | `ca-app-pub-1048939483389167/2257761509` | ✅ 已是正式值 |
| `src/config/credentials.ts` → `premium.productId` | `PLACEHOLDER_PREMIUM_PRODUCT_ID` | App Store Connect 内购商品 ID |

> `ads.bannerUnitIdIos` 的发布者 ID 是 `1048939483389167`，
> 对应的 App ID 形如 `ca-app-pub-1048939483389167~XXXXXXXXXX`，
> 尾号需要去 AdMob 后台「App settings」复制。

---

## 4. 打包步骤（GitHub + EAS）

### 4.1 前置凭证

| 需要 | 从哪里拿 | 用途 |
| --- | --- | --- |
| Expo 账号 + Access Token | <https://expo.dev/settings/access-tokens> | EAS CLI 非交互登录（`EXPO_TOKEN`） |
| Apple Developer Program 会员 | <https://developer.apple.com/programs/> | **生成 IPA 的必要条件**，$99/年 |
| Apple Team ID | <https://developer.apple.com/account> → Membership | 签名归属团队 |

### 4.2 命令流程

```bash
# 1. 登录 EAS（二选一）
export EXPO_TOKEN=xxxxx          # 非交互（推荐）
npx eas-cli login                # 交互式，浏览器授权

# 2. 在 Expo 侧创建/关联项目，写入 extra.eas.projectId
npx eas-cli init

# 3. 构建 iOS 包
npx eas-cli build -p ios --profile production   # App Store 正式包
npx eas-cli build -p ios --profile preview      # Ad Hoc 真机测试包

# 4. 构建完成后下载 .ipa
npx eas-cli build:list
```

首次 `build` 时 EAS 会引导登录 Apple 账号并**自动创建**
Distribution 证书与 Provisioning Profile，无需手工折腾钥匙串。

### 4.3 上传 App Store

```bash
npx eas-cli submit -p ios --latest
```

---

## 5. 为什么不能在 Windows 本机直接出 IPA

iOS 应用必须由 **Xcode / macOS 工具链**编译并签名。本机是 Windows，
因此走 EAS Build 的 **macOS 云端构建机**，产物是一个可直接下载的 `.ipa`。

本机已完成并验证的部分：

- ✅ TypeScript 类型检查通过（`npx tsc --noEmit`）
- ✅ iOS 平台 JS 包导出成功（1335 modules，Hermes 字节码 3.3MB）
- ✅ AdMob 原生模块已正确进入 iOS 依赖图
- ✅ iOS 原生配置解析通过（bundle id / 构建号 / 启动屏 / URL Scheme）
