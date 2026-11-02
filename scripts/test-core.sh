#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT HUP INT TERM
javac -d "$DIR" "$ROOT/app/src/main/java/com/ronny/assistant/ReminderParser.java" "$ROOT/app/src/main/java/com/ronny/assistant/BoundSecret.java" "$ROOT/app/src/main/java/com/ronny/assistant/ProviderFallback.java" "$ROOT/app/src/main/java/com/ronny/assistant/Calculator.java" "$ROOT/app/src/main/java/com/ronny/assistant/WeatherCommand.java" "$ROOT/app/src/main/java/com/ronny/assistant/UnitConverter.java" "$ROOT/app/src/main/java/com/ronny/assistant/DocumentText.java" "$ROOT/tests/ReminderParserTest.java" "$ROOT/tests/BoundSecretTest.java" "$ROOT/tests/ProviderFallbackTest.java" "$ROOT/tests/CalculatorTest.java" "$ROOT/tests/WeatherCommandTest.java" "$ROOT/tests/UnitConverterTest.java" "$ROOT/tests/DocumentTextTest.java"
java -cp "$DIR" com.ronny.assistant.ReminderParserTest
java -cp "$DIR" com.ronny.assistant.BoundSecretTest
java -cp "$DIR" com.ronny.assistant.ProviderFallbackTest
java -cp "$DIR" com.ronny.assistant.CalculatorTest
java -cp "$DIR" com.ronny.assistant.WeatherCommandTest
java -cp "$DIR" com.ronny.assistant.UnitConverterTest
java -cp "$DIR" com.ronny.assistant.DocumentTextTest
if [ -n "${JSON_JAR:-}" ]; then
  javac -cp "$JSON_JAR" -d "$DIR" "$ROOT/app/src/main/java/com/ronny/assistant/WeatherClient.java" "$ROOT/tests/WeatherClientTest.java"
  java -cp "$DIR:$JSON_JAR" com.ronny.assistant.WeatherClientTest
else
  echo "WeatherClient tests skipped (set JSON_JAR to an org.json JAR)."
fi
