#!/bin/bash
# Finder 더블클릭 시 PATH가 짧을 수 있음
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null)" || true
fi

cd "$(dirname "$0")" || exit 1

# 격리 속성 제거 시도(막힐 때 다음 클릭이 쉬워짐)
xattr -d com.apple.quarantine "$0" 2>/dev/null || true

echo "Markdown Notion Preview — 개발 서버 시작 (준비되면 브라우저가 열립니다)"
echo ""

if ! command -v npm >/dev/null 2>&1; then
  echo "npm 을 찾을 수 없습니다."
  osascript -e 'display alert "npm 을 찾을 수 없습니다" message "Node.js(https://nodejs.org/) 설치 후 다시 더블클릭하세요." as critical' 2>/dev/null || true
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "npm install 실행 중..."
  npm install || {
    osascript -e 'display alert "npm install 실패" message "터미널에 표시된 오류를 확인하세요." as critical' 2>/dev/null || true
    exit 1
  }
  echo ""
fi

echo "종료하려면 이 창에서 Control+C"
echo ""

# Vite --open : 서버 준비 후 기본 브라우저로 올바른 포트/URL 자동 오픈
exec npm run dev -- --open
