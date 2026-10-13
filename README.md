# GrowTime

极简番茄时钟 + 任务清单 App。Expo (React Native) 实现，界面全英文。

---

## 视觉风格

暖橙主色 + 柔和浅蓝底 + 大圆角 + 多层柔和阴影。

| Token | 值 | 用途 |
|---|---|---|
| `accent` | `#FF5E3A` | 番茄橙，主色 |
| `accentFrom → accentTo` | `#FF7E5F → #FF5E3A` | 番茄钟卡片 135° 渐变 |
| `bg` | `#F2F6FC` | 页面底色（冷调，让白卡片浮起来） |
| `border` | `#E2EDFA` | 卡片描边 |
| `accentSoft` | `#FFF3F0` | 主色浅底（AI 提示、标签） |
| `radius.lg / xl` | `24 / 32` | 卡片 / 大卡片圆角 |

改配色只需要动 `src/theme/index.ts`，所有页面都从这里取值。

**阴影是三层叠加不是单层**（`shadow.card / float / bubble`）——这是质感的关键，一张黑影会显得廉价。

番茄钟卡片右上/左下的两块光斑是「极光」效果。RN 没有 `::before/::after`，用绝对定位的 View 实现，见 `src/components/TimerCard.tsx`。

---

## 快速开始

```bash
npm install
npm run web        # 浏览器预览（最快看到效果）
npm run ios        # iOS 模拟器
npm run android    # Android 模拟器

npm run typecheck  # 类型检查
npm run test:ai    # AI 时间识别自测（21 个用例）
```

> Windows 上跑原生端需要 Android Studio / iOS 模拟器；只想看效果直接用 `npm run web`。

---

## 账号 / 密钥怎么填

**广告位、商品 ID、OAuth 等业务标识全部集中在 `src/config/credentials.ts`。**

AdMob 的 **App ID** 是唯一例外，它必须写在 `app.json` 的
`react-native-google-mobile-ads` 插件配置里（原生打包时读的是插件），
写两处只会产生不一致，所以 `credentials.ts` 里只留了指引注释。

目前多数仍是 `PLACEHOLDER_` 占位符。所有能力都做了降级处理：

| 能力 | 现在的表现 | 填了之后 |
|---|---|---|
| AdMob 广告 | Web 端不出广告；原生端开发包走测试广告 | 原生端出真实横幅 |
| 登录 | 按钮走本地模拟 | 接真实 OAuth / 短信 |
| 内购 | 点击后本地解锁 Premium | 走 Google Play / StoreKit |
| 云同步 | 入口置灰 | 接入后启用 |
| 微信登录 | 未展示 | 填 AppID 后接入 |

每个字段上方都写了**具体去哪里拿这个值**（要进哪个控制台、填什么格式）。

`isConfigured()` 用来判断某项是否还是占位符，未配置就自动降级 —— 所以缺账号不会导致崩溃或白屏。

---

## 广告（Google AdMob）

底部横幅出现在**前三个页面**（Timer / Tasks / Calendar）的内容区下方、底部导航之上。
**设置页不出广告**；**Premium 买断用户全局免广告**（对应设置页写的 "Removes every ad"）。

### 关键限制：AdMob 只在原生端可用

| 运行环境 | 广告 |
|---|---|
| iOS / Android 原生包（`expo prebuild` + 真机 / EAS Build） | ✅ 出广告 |
| Expo Go | ❌ 不支持原生模块 |
| Web（**也就是当前部署的 http://43.157.82.151/**） | ❌ 无实现 |

AdMob 没有 Web SDK（Web 要投广告得用 AdSense，是另一套东西）。
所以代码用**平台文件**做了隔离：

```
src/components/BannerAd.tsx         Web 端 → 恒返回 null
src/components/BannerAd.native.tsx  原生端 → 真实 <BannerAd>
```

Metro 按平台自动选择，因此原生 SDK 永远不会被打进 Web 包。
实测：Web 包 813 模块且 `RNGoogleMobileAds` 命中 0 次；iOS 包 1335 模块且命中 12 次。

### 开发期用测试广告位

`__DEV__` 下一律走 Google 官方测试广告位。**开发时点自己的正式广告 = 无效流量，会被 AdMob 封号**，这不是可选项。

### 还差两个值

| 值 | 位置 | 状态 |
|---|---|---|
| iOS 横幅广告位 | `credentials.ts` → `bannerUnitIdIos` | ✅ 已填 |
| **Android 横幅广告位** | `credentials.ts` → `bannerUnitIdAndroid` | ⚠️ 待填 |
| **AdMob App ID（iOS + Android）** | `app.json` → 插件配置 | ⚠️ 当前是 Google 测试 ID，上架前必须换 |

- 广告位 ID 是**分平台**的，iOS 的位不能给 Android 用，得在 AdMob 后台为 Android 应用另建一个横幅广告位。
- 某个平台没填广告位时，该平台**不展示广告**而不是崩溃。

未配置的 App ID 目前是测试值，能让开发包直接跑起来；**正式上架前务必替换**，否则等于用测试身份提交。

---

## 目录结构

```
App.tsx                    流程编排：引导 → 登录 → 主界面
src/
  config/credentials.ts    ★ 所有账号/密钥集中在此
  types/index.ts           领域模型（对应原 Hive 的 Task / DailyRecord）
  utils/index.ts           日期、ID、格式化工具
  store/index.tsx          全局状态 + AsyncStorage 持久化
  services/
    ai.ts                  本地规则 AI（时间识别、提示、白噪音匹配）
    ads.ts                 广告可用性判断（平台/页面/Premium），不碰原生 SDK
    permissions.ts         分批权限申请
  hooks/useTimer.ts        番茄计时器
  components/
    ui.tsx                 基础组件（按钮、卡片、胶囊、勾选框、🍅徽章…）
    TaskCard.tsx           任务卡片（Home / Tasks / Calendar 三处共用）
    TimerCard.tsx          番茄钟渐变大卡片（视觉重心）
    BannerAd.tsx           底部横幅广告 Web 端空实现
    BannerAd.native.tsx    底部横幅广告原生端实现（AdMob）
    CoachMark.tsx          交互式引导浮层（镂空高亮）
    shell.tsx              FAB / Tab 栏 / 引导控制器
    QuickAdd.tsx           快速输入 + AI 实时解析提示
    ThemeProvider.tsx      明暗主题
  screens/                 五个页面
scripts/test-ai.ts         AI 逻辑自测
```

---

## 首次启动流程

严格按「1 分钟内让用户创建第一条任务」来设计：

1. **4 页滑动引导** — 只讲收益不讲功能名词（「Write it down. Never lose it.」），每页可跳过
2. **登录** — 「Continue as guest」放在最显眼位置。强制登录是海外工具最常见的流失原因，所以游客模式是硬约束
3. **交互式引导** — 预置 3 条示例任务，然后 3 步浮层教学。**没有「下一步」按钮**，必须亲手完成：
   - 第 1 步：高亮 `+` 按钮 → 必须真的点下去
   - 第 2 步：输入含时间的句子 → 必须真的输入数字，才会进入下一步
   - 第 3 步：勾选完成任务 → 必须真的点那个圈
4. **权限分批申请** — 不在首登一次性索要。走完闭环后才温和地问一次通知权限；日历权限留到用户真的要用时
5. **功能按需开启** — 四象限、习惯打卡默认隐藏，用户去设置里自己开

---

## 核心：自然语言时间识别

产品的差异化卖点，纯本地正则实现，不联网、不调大模型：

```
"Design review tomorrow at 9am 3 🍅"  →  标题 Design review · 明天 09:00 · 预估 3 🍅
"Call the studio today at 3:30pm"     →  标题 Call the studio · 今天 15:30
"Renew passport in 3 days"            →  标题 Renew passport · 3 天后
"Submit report next friday"           →  标题 Submit report · 下周五
"Review code 2 pomodoros"             →  标题 Review code · 预估 2 🍅
"明天 9 点开会"                        →  标题 开会 · 明天 09:00
```

输入框下方会实时显示 AI 的理解结果，用户能立刻确认解析对不对 —— 这一点比解析本身更重要。

番茄数只做展示，不参与强制逻辑。输入 `3 🍅` 后，卡片会出现浅橙胶囊徽章；完成了番茄后显示「已完成/预估」。

---

## 日历

- 日期下方用**颜色区分状态**：橙点 = 有未完成待办，浅灰点 = 全部完成，深灰点 = 仅有番茄记录
- 有未完成待办的日期格子带 `#FFF3F0` 浅橙底色，一眼能看出哪天排得满
- **点未来日期 → 弹层内直接加待办**，不用跳去 Tasks 页再手动选日期
- 过去日期只读，不允许事后补记

---

## 两个实现上值得注意的点

**计时用绝对时间戳，不用每秒递减。**
`deadline = 开始时刻 + 总时长`，剩余时间每次用 `deadline - now` 算。所以 App 切后台被系统暂停后，回来时剩余时间依然准确，不会漂移。

**白噪音匹配规则必须按「具体 → 宽泛」排序。**
`"Code review"` 既符合阅读规则也符合编码规则。如果阅读规则排在前面，就会匹配到错误的白噪音。`src/services/ai.ts` 里有注释标注了这个坑，对应测试用例也锁住了行为。

---

## 按需求文档的边界

严格不做的：任务提醒推送、重复任务、截止日期、独立日程事件、任务文件夹、分类标签、分享社交、排行榜。

代码里也没有对应的入口 —— 不是「暂时没做」而是「没设计」。

---

## 还没接的部分

诚实列出来，避免误以为已完成：

- **广告 / 内购 / 登录 / 云同步 / 微信** —— 全部是占位符 + 降级实现，需要真实账号
- **白噪音音频** —— 设置页能选场景，但没接 `expo-audio` 的音源文件
- **小组件** —— 需求文档里提到，未实现
- **日历权限** —— `permissions.ts` 留了接口，未接系统日历写入
- **四象限 / 习惯打卡** —— 只有开关，视图未实现（规格文档本身也说不做）