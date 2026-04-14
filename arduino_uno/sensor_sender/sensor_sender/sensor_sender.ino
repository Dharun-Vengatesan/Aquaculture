#include <SoftwareSerial.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define RX 10
#define TX 11
SoftwareSerial espSerial(RX, TX);

#define ONE_WIRE_BUS 2
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

#define PH_PIN A0
#define TURB_PIN A1

// ================= SETUP =================
void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);
  sensors.begin();

  Serial.println("UNO SENSOR SYSTEM STARTED");
}

// ================= FUNCTIONS =================
float readPH() {
  int val = analogRead(PH_PIN);
  float volt = val * (5.0 / 1023.0);
  return 7 + ((2.5 - volt) / 0.18);
}

float readTurb() {
  int val = analogRead(TURB_PIN);
  float volt = val * (5.0 / 1023.0);
  float turb = (4.2 - volt) * 1000;
  return turb < 0 ? 0 : turb;
}

// ================= LOOP =================
void loop() {

  sensors.requestTemperatures();

  float temp = sensors.getTempCByIndex(0);
  float ph = readPH();
  float turb = readTurb();

  // ✅ FIXED FORMAT (important)
  String data = String(temp, 2) + "," + String(ph, 2) + "," + String(turb, 0);

  Serial.println("Sending → " + data);
  espSerial.println(data);

  delay(2000);
}