#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

avd_name="${SYDNEY_AVD_NAME:-Sydney_Pixel_8_API_35}"
device_id="${ANDROID_SERIAL:-emulator-5554}"
adb_bin="$ANDROID_HOME/platform-tools/adb"

flutter emulators --launch "$avd_name" || true

"$adb_bin" wait-for-device

while [ "$("$adb_bin" -s "$device_id" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
  sleep 2
done

flutter run -d "$device_id" \
  --dart-define=SYDNEY_USE_MOCKS=false \
  --dart-define=SYDNEY_GOOGLE_SERVER_CLIENT_ID=196727476983-mcou7vm9g1kar5nr9217sq3ljrbtv53g.apps.googleusercontent.com
