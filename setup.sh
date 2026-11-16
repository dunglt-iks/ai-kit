#!/usr/bin/env bash
# ai-kit — cài / cập nhật kit cho một repo, một lệnh.
#
#   cd <repo của bạn>
#   git clone --depth 1 -b v2 https://github.com/dunglt-iks/ai-kit .ai-kit && bash .ai-kit/setup.sh
#
# Việc làm: kiểm Node / npm / git → cài thư viện của kit → (repo chưa nhúng) xem trước kit init, hỏi rồi áp dụng
# → (tuỳ chọn) thêm lệnh tắt `kit` vào shell → in việc tiếp theo. Chạy lại được; đồng đội mới clone repo chạy cùng lệnh.
#
# Tuỳ chọn:
#   --update      lấy kit theo kitRef trong ai-kit.yml, cài lại thư viện, chạy lại kit init (nâng cấp)
#   --yes, -y     không hỏi: áp dụng kit init, không thêm lệnh tắt (dùng cho CI / máy tự động)
#   --alias       thêm lệnh tắt `kit` không cần hỏi     --no-alias   không thêm
#   --root <dir>  repo đích (mặc định: thư mục đang đứng)
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$PWD"
YES=0
UPDATE=0
ALIAS=ask

while [ $# -gt 0 ]; do
  case "$1" in
    --update) UPDATE=1 ;;
    -y | --yes) YES=1 ;;
    --alias) ALIAS=yes ;;
    --no-alias) ALIAS=no ;;
    --root) ROOT="$2"; shift ;;
    -h | --help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "setup.sh: không hiểu tuỳ chọn '$1' (--help để xem)" >&2; exit 2 ;;
  esac
  shift
done
[ "$YES" = 1 ] && [ "$ALIAS" = ask ] && ALIAS=no
ROOT="$(cd "$ROOT" && pwd -P)"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
warn() { printf '  ⚠ %s\n' "$*"; }
die() { printf '  ✘ %s\n' "$*" >&2; exit 1; }
ask() { # ask "câu hỏi" mặc-định(y|n) → 0 = có
  local d="$2" a
  [ "$YES" = 1 ] && { [ "$d" = y ]; return; }
  [ -t 0 ] || { [ "$d" = y ]; return; }
  read -r -p "  $1 [$([ "$d" = y ] && echo Y/n || echo y/N)] " a || true
  a="${a:-$d}"
  [[ "$a" =~ ^[YyCc] ]]
}
kit() { node "$KIT/cli/bin/kit.mjs" "$@"; }

# 1. Môi trường
step "Kiểm môi trường"
command -v node >/dev/null || die "Chưa có Node.js (cần ≥ 20): https://nodejs.org"
major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 20 ] || die "Node $(node -v) — cần ≥ 20"
command -v npm >/dev/null || die "Chưa có npm"
command -v git >/dev/null || die "Chưa có git"
ok "Node $(node -v), npm $(npm -v), git"

# 2. Repo đích
step "Repo đích: $ROOT"
if [ -e "$ROOT/.ai-kit" ] && [ "$(cd "$ROOT/.ai-kit" && pwd -P)" = "$KIT" ]; then
  ok "kit nằm ở .ai-kit/"
else
  warn "kit không nằm ở $ROOT/.ai-kit (đang ở $KIT). Vỏ lệnh Claude Code và CI tìm kit ở .ai-kit/ của repo."
  ask "Vẫn tiếp tục với repo này?" n || die "Dừng. Chạy lệnh ở gốc repo của bạn, kit đặt ở .ai-kit/ (hoặc --root <dir>)."
fi
CONFIG=""
[ -f "$ROOT/ai-kit.yml" ] && CONFIG="$ROOT/ai-kit.yml"

# 3. Nâng cấp theo kitRef
if [ "$UPDATE" = 1 ]; then
  step "Cập nhật kit theo kitRef"
  ref="$( [ -n "$CONFIG" ] && sed -n 's/^kitRef:[[:space:]]*\([^[:space:]#]*\).*/\1/p' "$CONFIG" | head -1 || true)"
  ref="${ref:-v2}"
  if git -C "$KIT" rev-parse --git-dir >/dev/null 2>&1 && git -C "$KIT" remote get-url origin >/dev/null 2>&1; then
    git -C "$KIT" fetch --depth 1 origin "refs/tags/$ref:refs/tags/$ref" 2>/dev/null || git -C "$KIT" fetch --depth 1 origin "$ref"
    git -C "$KIT" -c advice.detachedHead=false checkout -q "$ref" 2>/dev/null || git -C "$KIT" checkout -q FETCH_HEAD
    ok "kit ở $ref ($(git -C "$KIT" rev-parse --short HEAD))"
  else
    warn "$KIT không phải bản clone git — tải lại kit bản $ref rồi chạy lại setup.sh"
  fi
fi

# 4. Thư viện của kit
step "Thư viện của kit"
if [ "$UPDATE" = 1 ] || ! node -e "require.resolve('yaml', { paths: [process.argv[1]] })" "$KIT" 2>/dev/null; then
  (cd "$KIT" && npm ci --omit=dev --no-audit --no-fund --loglevel=error)
  ok "đã cài (npm ci trong $KIT)"
else
  ok "đã có"
fi

# 5. Nhúng kit vào repo
if [ -n "$CONFIG" ] && [ "$UPDATE" = 0 ]; then
  step "Repo đã nhúng kit ($(basename "$CONFIG")) — kiểm tra"
  kit doctor --root "$ROOT" | sed 's/^/  /' || warn "doctor báo lỗi — xem trên, rồi chạy: bash .ai-kit/setup.sh --update"
else
  step "Xem trước kit init"
  kit init --dry-run --root "$ROOT" | sed -n '/(--dry-run/q;p' | sed 's/^/  /'
  if ask "Áp dụng kit init vào $ROOT?" y; then
    step "kit init"
    kit init --root "$ROOT" | sed '/^Tiếp theo:/,$d' | sed 's/^/  /' || die "kit init báo lỗi — xem trên"
  else
    warn "Chưa áp dụng. Chạy lại: bash .ai-kit/setup.sh"
  fi
fi

# 6. Lệnh tắt `kit`: tìm .ai-kit/ từ thư mục hiện tại trở lên, dùng được cho mọi repo có kit
step "Lệnh tắt kit trên terminal"
case "${SHELL:-}" in
  */zsh) RC="$HOME/.zshrc" ;;
  */bash) RC="$HOME/.bashrc"; [ "$(uname)" = Darwin ] && RC="$HOME/.bash_profile" ;;
  *) RC="" ;;
esac
MARK="# ai-kit: lệnh kit"
if [ -n "$RC" ] && [ -f "$RC" ] && grep -qF "$MARK" "$RC"; then
  ok "đã có trong $RC"
elif [ "$ALIAS" = no ] || [ -z "$RC" ]; then
  warn "không thêm. Gõ đầy đủ: node .ai-kit/cli/bin/kit.mjs <lệnh>"
elif [ "$ALIAS" = yes ] || ask "Thêm lệnh tắt \`kit\` vào $RC?" y; then
  cat >>"$RC" <<'RC_EOF'

# ai-kit: lệnh kit — chạy .ai-kit/ gần nhất tính từ thư mục hiện tại trở lên (thêm bởi .ai-kit/setup.sh)
kit() {
  local d="$PWD"
  while [ "$d" != "/" ] && [ ! -e "$d/.ai-kit/cli/bin/kit.mjs" ]; do d="$(dirname "$d")"; done
  [ -e "$d/.ai-kit/cli/bin/kit.mjs" ] || { echo "kit: không thấy .ai-kit/ từ $PWD trở lên" >&2; return 1; }
  node "$d/.ai-kit/cli/bin/kit.mjs" --root "$d" "$@"
}
RC_EOF
  ok "đã thêm vào $RC — mở terminal mới (hoặc: source $RC) để dùng"
else
  warn "không thêm. Gõ đầy đủ: node .ai-kit/cli/bin/kit.mjs <lệnh>"
fi

# 7. Việc tiếp theo
step "Xong. Việc tiếp theo"
if [ -z "$CONFIG" ] || [ "$UPDATE" = 1 ]; then
  cat <<EOF
  1. Mở Claude Code ở $ROOT, chạy /kit-adopt — AI đề xuất giá trị ai-kit.yml theo repo, chỉ chỗ hướng dẫn của repo
     mâu thuẫn với kit; duyệt xong thì commit: ai-kit.yml, .claude/, CLAUDE.md / AGENTS.md, .gitignore
  2. Làm việc: /spec → /prototype → kit approve → /testcase → kit approve --testcase → /e2e-script → /dev → /ship
  3. CI (tuỳ dự án): thêm bước uses: dunglt-iks/ai-kit/actions/e2e@<kitRef> — xem .ai-kit/docs/04-ci-workflow.md
EOF
else
  echo "  Dùng /spec, /dev… trong Claude Code, hoặc kit <lệnh> trên terminal (kit --help)."
fi
