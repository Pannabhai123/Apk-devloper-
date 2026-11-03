#!/bin/bash
# ============================================================
# Ronny AI — Lite APK build script
# Real APK build: javac -> d8 -> aapt2 -> zipalign -> apksigner
# ============================================================
set -e
cd "$(dirname "$0")"

# Toolchain paths (override via environment if needed)
TC="${TOOLCHAIN:-/home/user/.toolchain}"
JAVA="$TC/jdk8/linux-x86/bin/java"
JAVAC="$TC/jdk8/linux-x86/bin/javac"
KEYTOOL="$TC/jdk8/linux-x86/bin/keytool"
JAR="$TC/jdk8/linux-x86/bin/jar"
ANDROID_JAR="$TC/aj/android-30/android.jar"   # Java-8 bytecode (javac 8 compatible); app uses only APIs <= 30
D8_JAR="$TC/r8/buildtools/d8-master.jar"
AAPT2="$TC/vapt/extract/aapt2_64"
APKSIGNER="$TC/apks/lib/apksigner.jar"
ZIPALIGN="$TC/bt/linux-x86/bin/zipalign"

echo "[1/8] Cleaning..."
rm -rf build && mkdir -p build/classes build/dex

echo "[2/8] Compiling Java sources (target: Android API 26+)..."
find app/src/main/java -name "*.java" > build/sources.txt
"$JAVAC" -encoding UTF-8 -source 8 -target 8 -classpath "$ANDROID_JAR" \
  -d build/classes @build/sources.txt

echo "[3/8] DEXing with D8..."
"$JAVA" -cp "$D8_JAR" com.android.tools.r8.D8 \
  --lib "$ANDROID_JAR" --min-api 26 --output build/dex \
  $(find build/classes -name "*.class")

echo "[4/8] Compiling resources with AAPT2..."
"$AAPT2" compile --dir app/src/main/res -o build/res.zip

echo "[5/8] Linking APK (manifest + resources + assets)..."
"$AAPT2" link -o build/base.apk -I "$ANDROID_JAR" \
  --manifest app/src/main/AndroidManifest.xml \
  -R build/res.zip -A app/src/main/assets \
  --auto-add-overlay \
  --min-sdk-version 26 --target-sdk-version 31 \
  --version-code 2 --version-name 1.1

echo "[6/8] Adding classes.dex + zipalign..."
cp build/base.apk build/unsigned.apk
(cd build/dex && "$JAR" uf ../unsigned.apk classes.dex)
LD_LIBRARY_PATH="$TC/bt/linux-x86/lib64" "$ZIPALIGN" -f 4 build/unsigned.apk build/aligned.apk

echo "[7/8] Signing (v1+v2+v3)..."
KEYSTORE="ronny.keystore"   # persistent — future versions upgrade-in-place ke liye
if [ ! -f "$KEYSTORE" ]; then
  "$KEYTOOL" -genkeypair -keystore "$KEYSTORE" -alias ronny \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=Ronny AI, OU=Personal Assistant, O=Ronny, L=India"
fi
"$JAVA" -jar "$APKSIGNER" sign \
  --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out RonnyAI-lite.apk build/aligned.apk

echo "[8/8] Verifying..."
"$JAVA" -jar "$APKSIGNER" verify --print-certs RonnyAI-lite.apk | head -4
"$AAPT2" dump badging RonnyAI-lite.apk | head -4
echo ""
echo "✅ BUILD SUCCESS: $(pwd)/RonnyAI-lite.apk ($(du -h RonnyAI-lite.apk | cut -f1))"
