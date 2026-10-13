#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# GrowTime — iOS 凭证初始化（交互式，只需成功运行一次）
#
# 为什么必须交互式：
#   EAS 在非交互模式下不会登录 Apple 去新建证书/描述文件，只会复用云端已有的。
#   本项目包名 com.luchentech.growtime 是全新的，所以必须先跑这一次交互构建，
#   把 Ad Hoc 描述文件建好并保存到 Expo 云端；之后再构建即可全自动。
#
# 用法（Git Bash）：
#   bash scripts/setup-ios-credentials.sh
#
# 会提示登录 Apple 开发者账号：
#   Apple ID  -> 你的 Apple ID 邮箱
#   Password  -> Apple ID 的登录密码（不是专用密码）
#   验证码     -> iPhone / Mac 上弹出的 6 位数字
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

# --- 1. 定位 node（你的终端用的是 nvm4w 的系统版，与托管版不是同一套）--------
NODE_BIN=""
for cand in "D:/nvm4w/nodejs/node.exe" \
            "C:/Program Files/nodejs/node.exe" \
            "$(command -v node 2>/dev/null || true)"; do
  if [ -n "$cand" ] && [ -x "$cand" ]; then NODE_BIN="$cand"; break; fi
done
if [ -z "$NODE_BIN" ]; then
  echo "!! 找不到 Node.js，请先安装后重试"
  exit 1
fi

# --- 2. 定位 eas-cli：优先用项目外的本地安装，彻底绕开 npx 下载 -------------
EAS_RUN="C:/Users/Administrator/.eas-cli/node_modules/eas-cli/bin/run"
if [ -f "$EAS_RUN" ]; then
  EAS_CMD=("$NODE_BIN" "$EAS_RUN")
  EAS_SRC="本地安装（快）"
else
  EAS_CMD=("npx" "--yes" "eas-cli@latest")
  EAS_SRC="npx（首次会下载，较慢）"
fi

# --- 3. 只注入团队信息 ------------------------------------------------------
if [ -f secrets/asc.env ]; then
  TEAM_ID=$(grep -E '^export EXPO_APPLE_TEAM_ID=' secrets/asc.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  TEAM_TYPE=$(grep -E '^export EXPO_APPLE_TEAM_TYPE=' secrets/asc.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
  export EXPO_APPLE_TEAM_ID="${TEAM_ID:-GXH4U3C682}"
  export EXPO_APPLE_TEAM_TYPE="${TEAM_TYPE:-INDIVIDUAL}"
fi

# --- 4. 关键：清掉 Apple 凭据，强制走交互式登录 -----------------------------
# 否则 EAS 会拿 asc.env 里那个可疑的密码去试，失败后不会回退到手动输入
unset EXPO_APPLE_ID || true
unset EXPO_APPLE_PASSWORD || true
unset EXPO_APPLE_APP_SPECIFIC_PASSWORD || true
unset EXPO_ASC_API_KEY_PATH || true

export EAS_BUILD_NO_EXPO_GO_WARNING=true

echo "=================================================="
echo " GrowTime iOS 凭证初始化（交互式，仅需一次）"
echo "=================================================="
echo ""
echo "node       : $NODE_BIN"
echo "eas-cli    : $EAS_SRC"
echo "Apple Team : ${EXPO_APPLE_TEAM_ID} (${EXPO_APPLE_TEAM_TYPE})"

echo -n "EAS 账号   : "
"${EAS_CMD[@]}" whoami 2>&1 | tail -1 || echo "未登录"

echo ""
echo "即将开始交互式构建，请在提示时输入 Apple ID 与密码。"
echo ""

# 首次初始化必须交互，因此不能带 --refresh-ad-hoc-provisioning-profile
# （该标志仅限非交互模式，用于把新登记的设备刷进描述文件）
"${EAS_CMD[@]}" build \
  -p ios \
  --profile preview \
  --clear-cache

echo ""
echo "=================================================="
echo " 构建已结束。下载地址见上方输出，或运行："
echo "   \"$NODE_BIN\" \"$EAS_RUN\" build:list --platform ios --limit 1"
echo "=================================================="
