#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT HUP INT TERM
javac -d "$DIR" "$ROOT/app/src/main/java/com/ronny/assistant/ReminderParser.java" "$ROOT/tests/ReminderParserTest.java"
java -cp "$DIR" com.ronny.assistant.ReminderParserTest
