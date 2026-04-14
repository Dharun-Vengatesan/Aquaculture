#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SoftwareSerial.h>

#define RX D5
#define TX D6
SoftwareSerial unoSerial(RX, TX);

#define RELAY D1

// 🔴 CHANGE THESE
const char* ssid = "AquacultureNet";
const char* password = "nivi@2015";
const char* server = "http://192.168.54.228:3000"; // your PC IP

String buffer = "";

float temperature = 0, ph = 0, turbidity = 0;
String command = "OFF";

unsigned long lastSend = 0;
unsigned long lastControl = 0;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  unoSerial.begin(9600);

  pinMode(RELAY, OUTPUT);
  digitalWrite(RELAY, HIGH);

  Serial.println("\nESP8266 SYSTEM STARTED");

  connectWiFi();
}

// ================= WIFI CONNECT =================
void connectWiFi() {
  Serial.print("Connecting WiFi");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

// ================= LOOP =================
void loop() {

  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Reconnecting WiFi...");
    connectWiFi();
  }

  readUNO();

  // Send data every 5 sec
  if (millis() - lastSend > 5000) {
    sendToServer();
    lastSend = millis();
  }

  // Get control every 2 sec
  if (millis() - lastControl > 2000) {
    getControl();
    lastControl = millis();
  }
}

// ================= READ UNO =================
void readUNO() {

  while (unoSerial.available()) {
    char c = unoSerial.read();

    if (c == '\n') {
      Serial.println("\nReceived: " + buffer);
      parseData(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }
}

// ================= PARSE =================
void parseData(String data) {

  int p1 = data.indexOf(',');
  int p2 = data.indexOf(',', p1 + 1);

  if (p1 == -1 || p2 == -1) {
    Serial.println("❌ Invalid Data Format");
    return;
  }

  temperature = data.substring(0, p1).toFloat();
  ph = data.substring(p1 + 1, p2).toFloat();
  turbidity = data.substring(p2 + 1).toFloat();

  Serial.println("Parsed Values:");
  Serial.println("Temp: " + String(temperature));
  Serial.println("pH: " + String(ph));
  Serial.println("Turb: " + String(turbidity));
}

// ================= SEND TO SERVER =================
void sendToServer() {

  WiFiClient client;
  HTTPClient http;

  String url = String(server) + "/ingest";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"temperature\":" + String(temperature, 2) + ",";
  json += "\"ph\":" + String(ph, 2) + ",";
  json += "\"turbidity\":" + String(turbidity, 0);
  json += "}";

  Serial.println("\n📡 Sending to Server:");
  Serial.println(json);

  int code = http.POST(json);

  Serial.print("HTTP Code: ");
  Serial.println(code);

  if (code > 0) {
    Serial.println("✅ Data Sent Successfully");
  } else {
    Serial.println("❌ Failed to Send");
  }

  http.end();
}

// ================= GET CONTROL =================
void getControl() {

  WiFiClient client;
  HTTPClient http;

  String url = String(server) + "/control";
  http.begin(client, url);

  int code = http.GET();

  if (code > 0) {
    String response = http.getString();

    Serial.println("\n🎮 Control Response:");
    Serial.println(response);

    if (response.indexOf("ON") > 0) {
      digitalWrite(RELAY, LOW);   // ON
      command = "ON";
    } else {
      digitalWrite(RELAY, HIGH);  // OFF
      command = "OFF";
    }

    Serial.println("Relay State: " + command);
  } else {
    Serial.println("❌ Control Fetch Failed");
  }

  http.end();
}