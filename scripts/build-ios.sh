#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# GrowTime — iOS 打包脚本（凭证已初始化后使用）
#
# 本机是 Windows，无法直接编译 iOS；脚本把代码交给 EAS 的 macOS 构建机，
# 产物是一个可直接下载安装的 .ipa 文件。
#
# 前置：只需成功跑过一次 scripts/setup-ios-credentials.sh，
#       证书与描述文件已存在 Expo 云端，之后本脚本可全自动运行。
#
# 用法（Git Bash）：
#   bash scripts/build-ios.sh preview     # Ad Hoc 真机测试包（默认）
#   bash scripts/build-ios.sh production  # App Store 正式包
#   bash scripts/build-ios.sh preview wait  # 额外等待构建完成并打印产物地址
#
# 三个已踩过的坑（改动前务必先读）：
#   1. 不要加 --refresh-ad-hoc-provisioning-profile —— 它需要 App Store
#      Connect API Key（.p8）才能刷新设备列表，没有会直接报错。
#      新增测试设备请用 eas device:create（交互式）后再构建。
#   2. 必须给 eas build 显式加 --no-wait。它自带的等待轮询在受限网络下会挂住
#      （即使云端早已 FINISHED 也不返回，日志停在 "Waiting for build to complete."）；
#      而 --non-interactive 模式下它还会隐式进入等待，把本脚本的自建轮询顶掉。
#      本脚本的 wait 模式统一改为自行轮询 build:list，稳定得多。
#   3. 代理必须保留。直连能通小请求（api.expo.dev 返回 200），但项目包上传会
#      卡在约 840KB 处再无流量。详见下方「代理处理」段的实测结论。
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
PROFILE="${1:-preview}"
DO_WAIT="${2:-}"

# --- 定位 node / eas-cli（与 setup-ios-credentials.sh 一致）-----------------
NODE_BIN=""
for cand in "D:/nvm4w/nodejs/node.exe" \
            "C:/Program Files/nodejs/node.exe" \
            "$(command -v node 2>/dev/null || true)"; do
  if [ -n "$cand" ] && [ -x "$cand" ]; then NODE_BIN="$cand"; break; fi
done
[ -z "$NODE_BIN" ] && { echo "!! 找不到 Node.js"; exit 1; }

EAS_RUN="C:/Users/Administrator/.eas-cli/node_modules/eas-cli/bin/run"
if [ -f "$EAS_RUN" ]; then
  EAS=("$NODE_BIN" "$EAS_RUN")
else
  EAS=("npx" "--yes" "eas-cli@latest")
fi

export EAS_BUILD_NO_EXPO_GO_WARNING=true
# 跳过自动指纹计算：本项目的 app.json 没有 runtimeVersion（也未用 expo-updates），
# 指纹只用于 EAS Update 的运行时兼容判定，跳过不影响构建产物。
# 不跳过时这一步在 Windows 上会明显拖慢（实测数分钟，日志提示 taking longer than expected）。
export EAS_SKIP_AUTO_FINGERPRINT=1

# --- 代理处理 --------------------------------------------------------------
# 结论：本机**必须保留**沙箱注入的 http_proxy/https_proxy（指向本地 sandbox-cli）。
# 实测直连 api.expo.dev 虽然能返回 200，但 eas 的项目包上传在直连路径下会停滞
# ——累计只写出约 840KB 就再无流量，socket 保持 Established 而进程 CPU 增量恒为 0，
# 云端始终收不到包。走代理则是已验证可用的路径（成功产出过构建记录）。
# 若某天代理本身不可用，可用 EAS_NO_PROXY=1 强制直连再试。
if [ "${EAS_NO_PROXY:-0}" = "1" ]; then
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy 2>/dev/null || true
  echo "==> 已强制绕过本地代理（EAS_NO_PROXY=1）"
else
  echo "==> 使用系统代理设置（如需强制直连请设 EAS_NO_PROXY=1）"
fi

echo "==> 1/3 校验 Expo 身份"
"${EAS[@]}" whoami

echo "==> 2/3 触发 iOS 云端构建（profile=$PROFILE）"
# 用 tee 落一份到临时文件：既保留可解析的完整输出，又能实时看到上传/构建进度。
# 原先的 $(...) 全量捕获会把输出压到命令结束才显示，卡住时无从判断进度。
BUILD_TMP=$(mktemp 2>/dev/null || echo ".tmp-eas-build.$$")
set +e
"${EAS[@]}" build -p ios --profile "$PROFILE" --non-interactive --no-wait 2>&1 | tee "$BUILD_TMP"
BUILD_RC=${PIPESTATUS[0]}
set -e
BUILD_OUT=$(cat "$BUILD_TMP")
# 清理临时文件。沙箱会拦截这次的 rm（SAFE_DELETE_INVALID_PATH），
# 若不加 || true，set -e 会让脚本在这里直接退出 —— 构建明明已经触发成功，
# 却拿不到 build ID、也不会进轮询，看起来像「打包失败」。
{ rm -f "$BUILD_TMP" && :; } 2>/dev/null || true
if [ $BUILD_RC -ne 0 ]; then
  echo "!! 构建触发失败（exit $BUILD_RC）"
  exit $BUILD_RC
fi

# 从 “See logs: .../builds/<uuid>” 里取出构建 ID
BUILD_ID=$(printf '%s\n' "$BUILD_OUT" | grep -oE 'builds/[0-9a-fA-F-]{36}' | head -1 | cut -d/ -f2 || true)

echo "==> 3/3 最近构建记录"
"${EAS[@]}" build:list --platform ios --limit 3 --non-interactive

# --- 可选：等待构建完成（自建轮询，不用 eas --wait）-------------------------
if [ "$DO_WAIT" = "wait" ]; then
  if [ -z "${BUILD_ID:-}" ]; then
    echo "!! 没能从输出里解析出构建 ID，跳过等待；请手动查看上面的链接"
    exit 0
  fi
  echo ""
  echo "==> 等待构建 $BUILD_ID 完成（每 20 秒轮询一次，Ctrl+C 可随时退出，不影响云端构建）"

  for i in $(seq 1 60); do
    LIST=$(  "${EAS[@]}" build:list --platform ios --limit 1 --non-interactive --json 2>/dev/null || true )
    STATUS=$( printf '%s' "$LIST" | tr -d '\n' | grep -oE '"status"[[:space:]]*:[[:space:]]*"[A-Z]+"' | head -1 | grep -oE '[A-Z]+$' || true )
    URL=$(    printf '%s' "$LIST" | tr -d '\n' | grep -oE 'https://expo\.dev/artifacts/eas/[A-Za-z0-9_-]+\.ipa' | head -1 || true )
    ERR=$(    printf '%s' "$LIST" | tr -d '\n' | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]{0,200}"' | head -1 || true )

    printf '    [%02d] status=%s\n' "$i" "${STATUS:-unknown}"

    case "${STATUS:-}" in
      FINISHED)
        echo ""
        echo "√ 构建完成"
        [ -n "${URL:-}" ] && echo "  产物地址: $URL"
        echo "  下载示例: curl -L -o builds/GrowTime.ipa '$URL'"
        exit 0
        ;;
      ERRORED|CANCELED)
        echo ""
        echo "!! 构建以 $STATUS 结束"
        [ -n "${ERR:-}" ] && echo "  $ERR"
        exit 1
        ;;
    esac
    sleep 20
  done
  echo "!! 等待超时（约 20 分钟），云端可能仍在构建，请到 expo.dev 查看"
  exit 1
fi
