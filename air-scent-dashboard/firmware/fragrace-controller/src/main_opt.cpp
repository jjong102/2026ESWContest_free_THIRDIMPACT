#include <Arduino.h>

// 원본 main.cpp는 그대로 두고, 발향 제어만 다시 짠 펌웨어.
// 빌드: pio run -e uno_opt -t upload
//
// 기존 대시보드 명령 유지: ON133 / OFF000 / MODE / SYNC0-3
// 추가: M133 (미스트만), ALL0 (강제 끄기), POL0/POL1 (극성)

#define FAN_PIN 2
#define MIST1 3
#define MIST2 4
#define MIST3 5

static const uint8_t mistPins[3] = {MIST1, MIST2, MIST3};

// 원본은 LOW=ON 인데, HIGH로 꺼도 분무가 남아서 기본 극성을 뒤집음.
// POL0 = 원본(LOW=ON), POL1 = 최적화 기본(HIGH=ON)
static bool mistActiveHigh = true;

static unsigned long runTime[3] = {0, 0, 0};
static unsigned long maxTime = 0;
static unsigned long cycleStart = 0;
static unsigned long pauseStart = 0;
static bool inPause = false;

static bool fanIsOn = false;
static int fanMode = 1;

enum FanPulse : uint8_t { FAN_IDLE, FAN_PRESS };
static FanPulse fanPulse = FAN_IDLE;
static unsigned long fanPulseEnd = 0;
static unsigned long fanPulseMs = 0;
static const char *fanPulseDoneMsg = nullptr;

static char lineBuf[24];
static uint8_t lineLen = 0;

static void writeMist(uint8_t index, bool on) {
  const bool level = mistActiveHigh ? on : !on;
  digitalWrite(mistPins[index], level ? HIGH : LOW);
}

static void allMistOff() {
  maxTime = 0;
  inPause = false;
  for (uint8_t i = 0; i < 3; i++) {
    runTime[i] = 0;
    writeMist(i, false);
  }
}

static void applyMistOutputs() {
  if (maxTime == 0) {
    for (uint8_t i = 0; i < 3; i++) {
      writeMist(i, false);
    }
    return;
  }

  const unsigned long now = millis();

  if (inPause) {
    for (uint8_t i = 0; i < 3; i++) {
      writeMist(i, false);
    }
    if (now - pauseStart >= 1000) {
      inPause = false;
      cycleStart = now;
    }
    return;
  }

  const unsigned long elapsed = now - cycleStart;
  if (elapsed >= maxTime) {
    for (uint8_t i = 0; i < 3; i++) {
      writeMist(i, false);
    }
    inPause = true;
    pauseStart = now;
    return;
  }

  for (uint8_t i = 0; i < 3; i++) {
    writeMist(i, elapsed < runTime[i]);
  }
}

static void setMist(const char *digits) {
  maxTime = 0;
  inPause = false;

  for (uint8_t i = 0; i < 3; i++) {
    const char ch = digits[i];
    const unsigned long ms = (ch >= '0' && ch <= '9') ? (ch - '0') * 1000UL : 0;
    runTime[i] = ms;
    if (ms > maxTime) {
      maxTime = ms;
    }
  }

  cycleStart = millis();

  if (maxTime == 0) {
    allMistOff();
    Serial.println(F("MIST OFF"));
    return;
  }

  Serial.print(F("MIST "));
  Serial.print(digits[0]);
  Serial.print(digits[1]);
  Serial.print(digits[2]);
  Serial.print(F(" POL"));
  Serial.println(mistActiveHigh ? '1' : '0');
}

static void startFanPulse(unsigned long holdMs, const char *doneMsg) {
  digitalWrite(FAN_PIN, LOW);
  fanPulse = FAN_PRESS;
  fanPulseMs = holdMs;
  fanPulseEnd = millis() + holdMs;
  fanPulseDoneMsg = doneMsg;
}

static void updateFan() {
  if (fanPulse != FAN_PRESS) {
    return;
  }
  if ((long)(millis() - fanPulseEnd) < 0) {
    return;
  }
  digitalWrite(FAN_PIN, HIGH);
  fanPulse = FAN_IDLE;
  if (fanPulseDoneMsg) {
    Serial.println(fanPulseDoneMsg);
    fanPulseDoneMsg = nullptr;
  }
}

static void printFanMode(const __FlashStringHelper *prefix) {
  Serial.print(prefix);
  Serial.println(fanMode);
}

static bool isDigits3(const char *s) {
  return s[0] >= '0' && s[0] <= '9' && s[1] >= '0' && s[1] <= '9' &&
         s[2] >= '0' && s[2] <= '9' && s[3] == '\0';
}

static void handleCommand(char *cmd) {
  Serial.print(F("입력값: ["));
  Serial.print(cmd);
  Serial.println(']');

  if (strcmp(cmd, "ALL0") == 0 || strcmp(cmd, "M000") == 0) {
    allMistOff();
    applyMistOutputs();
    Serial.println(F("MIST OFF"));
    return;
  }

  if (cmd[0] == 'M' && isDigits3(cmd + 1)) {
    setMist(cmd + 1);
    return;
  }

  if (strcmp(cmd, "POL0") == 0 || strcmp(cmd, "POL1") == 0) {
    mistActiveHigh = (cmd[3] == '1');
    applyMistOutputs();
    Serial.print(F("POL"));
    Serial.println(mistActiveHigh ? '1' : '0');
    return;
  }

  if (strcmp(cmd, "FANON") == 0) {
    startFanPulse(200, nullptr);
    fanIsOn = true;
    printFanMode(F("FAN ON / MODE "));
    return;
  }

  if (strcmp(cmd, "FANOFF") == 0) {
    startFanPulse(2500, "FAN OFF");
    fanIsOn = false;
    return;
  }

  if (strncmp(cmd, "ON", 2) == 0 && isDigits3(cmd + 2)) {
    if (!fanIsOn) {
      startFanPulse(200, nullptr);
      fanIsOn = true;
      printFanMode(F("FAN ON / MODE "));
    } else {
      Serial.println(F("FAN 이미 ON 상태"));
    }
    setMist(cmd + 2);
    return;
  }

  if (strncmp(cmd, "OFF", 3) == 0 && isDigits3(cmd + 3)) {
    if (fanIsOn) {
      startFanPulse(2500, "FAN OFF");
      fanIsOn = false;
    } else {
      Serial.println(F("FAN 이미 OFF 상태"));
    }
    setMist(cmd + 3);
    return;
  }

  if (strcmp(cmd, "MODE") == 0) {
    if (!fanIsOn) {
      Serial.println(F("FAN OFF 상태라 MODE 불가"));
      return;
    }
    startFanPulse(200, nullptr);
    fanMode++;
    if (fanMode > 3) {
      fanMode = 1;
    }
    printFanMode(F("FAN MODE "));
    return;
  }

  if (strncmp(cmd, "SYNC", 4) == 0 && cmd[4] >= '0' && cmd[4] <= '3' &&
      cmd[5] == '\0') {
    const int n = cmd[4] - '0';
    if (n == 0) {
      if (fanIsOn) {
        startFanPulse(2500, "FAN OFF");
      } else {
        Serial.println(F("FAN OFF"));
      }
      fanIsOn = false;
      return;
    }
    if (!fanIsOn) {
      startFanPulse(200, nullptr);
    }
    fanIsOn = true;
    fanMode = n;
    printFanMode(F("FAN ON / MODE "));
    return;
  }

  if (strcmp(cmd, "STAT") == 0) {
    Serial.print(F("FAN "));
    Serial.print(fanIsOn ? F("ON") : F("OFF"));
    Serial.print(F(" MODE "));
    Serial.print(fanMode);
    Serial.print(F(" MIST "));
    Serial.print(runTime[0] / 1000);
    Serial.print(runTime[1] / 1000);
    Serial.print(runTime[2] / 1000);
    Serial.print(F(" POL"));
    Serial.println(mistActiveHigh ? '1' : '0');
    return;
  }

  Serial.println(F("명령어 오류"));
}

static void pollSerial() {
  while (Serial.available()) {
    const char ch = (char)Serial.read();
    if (ch == '\r') {
      continue;
    }
    if (ch == '\n') {
      lineBuf[lineLen] = '\0';
      if (lineLen > 0) {
        for (uint8_t i = 0; i < lineLen; i++) {
          if (lineBuf[i] >= 'a' && lineBuf[i] <= 'z') {
            lineBuf[i] = (char)(lineBuf[i] - 32);
          }
        }
        handleCommand(lineBuf);
      }
      lineLen = 0;
      continue;
    }
    if (lineLen + 1U < sizeof(lineBuf)) {
      lineBuf[lineLen++] = ch;
    }
  }
}

void setup() {
  Serial.begin(9600);

  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, HIGH);

  for (uint8_t i = 0; i < 3; i++) {
    pinMode(mistPins[i], OUTPUT);
  }
  allMistOff();

  Serial.println(F("READY OPT"));
  Serial.println(F("M133 / ALL0 / POL0 / POL1 / ON133 / OFF000 / MODE / SYNC0-3"));
}

void loop() {
  pollSerial();
  updateFan();
  applyMistOutputs();
}
