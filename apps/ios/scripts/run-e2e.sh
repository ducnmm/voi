#!/usr/bin/env bash
# Seed the local API (if needed) and run iOS XCUITests.
# CI: SKIP_DOCKER=1 SKIP_API_START=1 E2E_SUITE=smoke bash apps/ios/scripts/run-e2e.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

SIMULATOR="${SIMULATOR:-iPhone 17}"
E2E_SUITE="${E2E_SUITE:-full}"
export DATABASE_URL="${DATABASE_URL:-postgresql://voi:voi@localhost:55487/voi_dev?schema=public}"
export API_PORT="${API_PORT:-43187}"
export JWT_SECRET="${JWT_SECRET:-replace-with-a-long-random-secret}"
export RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-2000}"
API_BASE="${VOI_API_BASE_URL:-http://127.0.0.1:${API_PORT}/v1}"
export VOI_API_BASE_URL="$API_BASE"
API_PID=""

cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "${SKIP_DOCKER:-}" != "1" ]]; then
  echo "==> Starting Postgres"
  docker compose up -d postgres
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U voi -d voi_dev >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

echo "==> Migrating + seeding"
pnpm db:generate
pnpm db:deploy
pnpm db:seed

if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
  echo "==> API already running"
elif [[ "${SKIP_API_START:-}" == "1" ]]; then
  echo "API is not running and SKIP_API_START=1" >&2
  exit 1
else
  echo "==> Starting API"
  if [[ ! -f apps/api/dist/server.js ]]; then
    pnpm --filter @voi/api build
  fi
  pnpm --filter @voi/api start >/tmp/voi-api-e2e.log 2>&1 &
  API_PID=$!
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

if ! curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
  echo "API failed to start. Last log:"
  tail -n 80 /tmp/voi-api-e2e.log || true
  exit 1
fi

echo "==> Generating Xcode project"
(cd apps/ios && xcodegen generate)

if ! xcrun simctl list devices available | grep -q "$SIMULATOR"; then
  if xcrun simctl list devices available | grep -q "iPhone 16"; then
    SIMULATOR="iPhone 16"
  elif xcrun simctl list devices available | grep -q "iPhone 15"; then
    SIMULATOR="iPhone 15"
  fi
fi
DESTINATION="${DESTINATION:-platform=iOS Simulator,name=${SIMULATOR}}"

echo "==> Booting simulator ${SIMULATOR}"
xcrun simctl boot "$SIMULATOR" >/dev/null 2>&1 || true
defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false || true

echo "==> Running XCUITests (${E2E_SUITE})"
# Bash 3.2 + `set -u` treats an empty "${arr[@]}" as unbound, so do not
# pass an empty ONLY_TESTING array on the full suite.
XCODEBUILD=(
  xcodebuild test
  -project apps/ios/Voi.xcodeproj
  -scheme Voi
  -destination "$DESTINATION"
  -parallel-testing-enabled NO
  CODE_SIGNING_ALLOWED=NO
  CODE_SIGNING_REQUIRED=NO
  CODE_SIGN_IDENTITY=-
  VOI_API_BASE_URL="$API_BASE"
)
if [[ "$E2E_SUITE" == "smoke" ]]; then
  XCODEBUILD+=(
    -only-testing:VoiUITests/OnboardingAndAuthUITests
    -only-testing:VoiUITests/SessionsFeedUITests/testFeedShowsSeedSession
    -only-testing:VoiUITests/SessionsFeedUITests/testHomeCreateButtonOpensForm
    -only-testing:VoiUITests/SessionsFeedUITests/testMessagesListsGroupAndSessionChats
    -only-testing:VoiUITests/CreateSessionUITests/testCreateSessionFromProfile
    -only-testing:VoiUITests/InviteAlertsPeopleUITests/testInviteLookupFromAlerts
    -only-testing:VoiUITests/PlayerSessionUITests/testNonHostSeesJoinOnly
  )
fi
"${XCODEBUILD[@]}"
