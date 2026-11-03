#!/bin/bash
# ============================================================
# Ronny AI — Toolchain fetch script (reproducible APK builds)
# Sab kuch GitHub/PyPI se — koi Google/Maven access nahi chahiye.
# Toolchain components:
#   - JDK 8 (javac/jar/keytool): MIPS/prebuilts-jdk-jdk8 (AOSP prebuilt)
#   - D8 dexer: LineageOS/android_prebuilts_r8 (d8-master.jar)
#   - AAPT2: VindroidH prebuilt binaries
#   - apksigner: FeilongTest/ApkSigner (lib/apksigner.jar)
#   - android.jar (API 30, Java-8 bytecode): Reginer/aosp-android-jar
#   - zipalign: LineageOS/android_prebuilts_build-tools
# ============================================================
set -e
TC="${TOOLCHAIN:-/home/user/.toolchain}"
mkdir -p "$TC" && cd "$TC"

if [ ! -f jdk8/linux-x86/bin/javac ]; then
  echo "[1/6] Fetching JDK 8 (AOSP prebuilt)..."
  rm -rf jdk8
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/MIPS/prebuilts-jdk-jdk8 jdk8
  (cd jdk8 && git sparse-checkout set linux-x86)
fi

if [ ! -f r8/buildtools/d8-master.jar ]; then
  echo "[2/6] Fetching D8 dexer..."
  rm -rf r8
  git clone --depth 1 https://github.com/LineageOS/android_prebuilts_r8 r8
fi

if [ ! -f vapt/extract/aapt2_64 ]; then
  echo "[3/6] Fetching AAPT2..."
  rm -rf vapt
  git clone --depth 1 https://github.com/VindroidH/prebuilt-binaries-aapt-aapt_64-aapt2-aapt2_64-windows-linux-macosx vapt
  mkdir -p vapt/extract
  (cd vapt/linux && unzip -o aapt2_64.zip -d ../extract/ && unzip -o aapt_64.zip -d ../extract/)
  chmod +x vapt/extract/*
fi

if [ ! -f apks/lib/apksigner.jar ]; then
  echo "[4/6] Fetching apksigner..."
  rm -rf apks
  git clone --depth 1 https://github.com/FeilongTest/ApkSigner apks
fi

if [ ! -f aj/android-30/android.jar ]; then
  echo "[5/6] Fetching android.jar (API 30)..."
  rm -rf aj
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/Reginer/aosp-android-jar aj
  (cd aj && git sparse-checkout set android-30)
fi

if [ ! -f bt/linux-x86/bin/zipalign ]; then
  echo "[6/6] Fetching zipalign..."
  rm -rf bt
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/LineageOS/android_prebuilts_build-tools bt
  (cd bt && git sparse-checkout set --no-cone \
    '/linux-x86/bin/zipalign' '/linux-x86/lib64/libc++.so')
  chmod +x bt/linux-x86/bin/zipalign
fi

echo "✅ Toolchain ready at $TC"
