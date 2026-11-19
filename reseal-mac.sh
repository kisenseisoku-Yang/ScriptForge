#!/bin/bash
# ============================================================
# reseal-mac.sh — Mac 上重签「幕后 · 文字剧场」.app
# 使用 ad-hoc codesign（本地重签，不需要 Apple Developer 证书）
# ============================================================
# 用法：
#   1. 把本脚本放到 ScriptForge/ 项目根目录
#   2. unzip Muhou-Text-Theater-1.5.10-Mac-x64.zip  →  得到 幕后 · 文字剧场.app
#   3. ./reseal-mac.sh "幕后 · 文字剧场.app"
# 或：
#   ./reseal-mac.sh "/Applications/幕后 · 文字剧场.app"
# ============================================================

set -euo pipefail

APP="${1:-幕后 · 文字剧场.app}"

if [[ ! -d "$APP" ]]; then
  echo "❌ 找不到 app: $APP"
  echo "   用法: $0 path/to/Muhou-Text-Theater.app"
  exit 1
fi

if ! command -v codesign &>/dev/null; then
  echo "❌ codesign 不可用 — 请先安装 Xcode Command Line Tools"
  echo "   xcode-select --install"
  exit 1
fi

echo "========================================"
echo "  幕后 · 文字剧场 — Mac 重签脚本"
echo "========================================"
echo ""
echo "🎯 目标: $APP"
echo ""

# ---------- 第 1 步：清除 Gatekeeper 隔离 ----------
echo "[1/4] 清除 quarantine 隔离属性..."
if xattr -dr com.apple.quarantine "$APP" 2>/dev/null; then
  echo "      ✅ 已清除"
else
  echo "      (无隔离属性，跳过)"
fi

# ---------- 第 2 步：先签最深处（Helper apps 先签） ----------
echo "[2/4] 签名 Helper apps（GPU / Plugin / Renderer）..."
HELPERS=(
  "$APP/Contents/Frameworks/幕后 · 文字剧场 Helper.app"
  "$APP/Contents/Frameworks/幕后 · 文字剧场 Helper (GPU).app"
  "$APP/Contents/Frameworks/幕后 · 文字剧场 Helper (Plugin).app"
  "$APP/Contents/Frameworks/幕后 · 文字剧场 Helper (Renderer).app"
)
for helper in "${HELPERS[@]}"; do
  if [[ -d "$helper" ]]; then
    codesign --deep --force --sign - \
      --entitlements - --options runtime \
      "$helper" 2>&1 | sed 's/^/      /'
    echo "      ✅ $(basename "$helper")"
  else
    echo "      ⚠️  未找到 $(basename "$helper")"
  fi
done

# ---------- 第 3 步：签 Electron Framework ----------
echo "[3/4] 签名 Electron Framework..."
FW="$APP/Contents/Frameworks/Electron Framework.framework"
if [[ -d "$FW" ]]; then
  codesign --deep --force --sign - \
    --entitlements - --options runtime \
    "$FW" 2>&1 | sed 's/^/      /'
  echo "      ✅ Electron Framework"
else
  echo "      ❌ 没找到 Electron Framework — .app 结构有问题"
  exit 1
fi

# ---------- 第 4 步：签主 .app ----------
echo "[4/4] 签名主应用..."
codesign --deep --force --sign - \
  --entitlements - --options runtime \
  "$APP" 2>&1 | sed 's/^/      /'
echo "      ✅ 主应用签名完成"

# ---------- 验证 ----------
echo ""
echo "========================================"
echo "  验证签名"
echo "========================================"
if codesign --verify --deep --strict "$APP" 2>&1; then
  echo ""
  echo "✅ 签名验证通过！"
else
  echo ""
  echo "❌ 签名有问题，看上面报错"
  exit 1
fi

echo ""
echo "🎊 重签完成！可以直接双击运行："
echo "   $APP"
echo ""
echo "如需移入 Applications："
echo "   cp -R \"$APP\" /Applications/"
