# ESP8266 IoT Dashboard (Beginner Friendly)

This project is a complete plug-and-play IoT system:

- ESP8266 sends sensor data to a Node.js server
- Node.js stores latest values and control command in memory
- Browser dashboard shows live values, device status, and lets you toggle ON/OFF

If you are a beginner, follow the steps in order and you can get it running quickly.

## 1) Project Overview

Tech stack:

- Backend: Node.js + Express
- Frontend: HTML + CSS + JavaScript
- Device: ESP8266 (Arduino IDE)

Main features:

- Receives `temperature`, `ph`, and `turbidity` from ESP8266
- Converts them into generic cards (`Sensor 1`, `Sensor 2`, `Sensor 3`)
- Shows device `online/offline` (offline if no data for 10 seconds)
- Toggle switch sends ON/OFF command
- ESP8266 polls command and controls relay/motor

## 2) Folder Structure

```text
Aquaculture/
├─ server.js
├─ package.json
├─ README.md
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
└─ esp8266/
   └─ esp8266_iot_client.ino
```

## 3) How to Run the Server

Open terminal in project root, then:

```bash
npm install
npm start
```

You should see:

```text
IoT dashboard running on http://localhost:3000
```

Open browser:

```text
http://localhost:3000
```

## 4) How to Find Your PC IP Address (Windows)

Your ESP8266 must call your PC using IP address, not `localhost`.

1. Open Command Prompt
2. Run:

   ```bash
   ipconfig
   ```

3. Find your active adapter (usually Wi-Fi), then note:
   - `IPv4 Address` (example: `192.168.1.50`)

You will use this IP in ESP8266 code.

## 5) Configure ESP8266 WiFi + Server IP

Open `esp8266/esp8266_iot_client.ino` and edit:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SERVER_IP` (your PC IPv4 from `ipconfig`)

Example:

```cpp
const char* WIFI_SSID = "MyHomeWiFi";
const char* WIFI_PASSWORD = "mypassword123";
const char* SERVER_IP = "192.168.1.50";
```

## 6) Upload Code to ESP8266 (Arduino IDE)

1. Install Arduino IDE
2. Install ESP8266 board package (Boards Manager)
3. Select board: **NodeMCU 1.0 (ESP-12E Module)** (or your ESP8266 model)
4. Select correct COM port
5. Open `esp8266_iot_client.ino`
6. Click **Upload**
7. Open **Serial Monitor** at **115200 baud**

## 7) Data Flow (How It Works)

1. ESP8266 sends sensor data every 5 seconds:
   - `POST http://<PC-IP>:3000/ingest`
2. Server updates:
   - `sensors`
   - `lastUpdated`
   - device status (`online/offline`)
3. Frontend fetches `GET /data` every 5 seconds and updates cards/status
4. User toggles switch in dashboard:
   - `POST /control` with `ON` or `OFF`
5. ESP8266 polls every 2 seconds:
   - `GET /control`
   - Applies command to relay pin

## 8) API Explanation

### `GET /data`

Returns latest dashboard state.

Example response:

```json
{
  "sensors": [
    { "label": "Sensor 1", "value": 28.5 },
    { "label": "Sensor 2", "value": 7.2 },
    { "label": "Sensor 3", "value": 800 }
  ],
  "control": "OFF",
  "status": {
    "isConnected": true,
    "deviceStatus": "online",
    "lastUpdated": "2026-04-14T14:00:00.000Z"
  }
}
```

### `POST /ingest`

ESP8266 sends sensor JSON:

```json
{
  "temperature": 28.5,
  "ph": 7.2,
  "turbidity": 800
}
```

Backend converts it to generic format:

```json
[
  { "label": "Sensor 1", "value": 28.5 },
  { "label": "Sensor 2", "value": 7.2 },
  { "label": "Sensor 3", "value": 800 }
]
```

### `GET /control`

ESP8266 polls this endpoint every 2 seconds.

```json
{
  "command": "ON"
}
```

### `POST /control`

Dashboard sends ON/OFF command.

Request body:

```json
{
  "command": "OFF"
}
```

## 9) Troubleshooting

### A) ESP cannot connect to server (localhost issue)

- `localhost` means "same device"
- ESP8266 is a different device, so use `SERVER_IP = "<your PC IPv4>"`

### B) ESP and PC are on different networks

- Make sure both are on the same Wi-Fi network
- If not, requests will fail

### C) Windows firewall blocks requests

- Allow Node.js through firewall
- Or allow port `3000` in Windows Defender Firewall

### D) Wrong JSON format

- `POST /ingest` requires numbers:
  - `temperature`
  - `ph`
  - `turbidity`
- If types are wrong/missing, backend returns `400`

### E) Relay behavior inverted

- Some relay modules are active-low
- If ON/OFF looks reversed, swap `HIGH` and `LOW` in `applyRelayCommand()`

## 10) Example Serial Output

```text
ESP8266 IoT Client booting...
[RELAY] Default state OFF
=== WiFi Setup ===
Connecting to: MyHomeWiFi
WiFi connected!
ESP IP address: 192.168.1.99
[INGEST] URL: http://192.168.1.50:3000/ingest
[INGEST] Payload: {"temperature":28.50,"ph":7.20,"turbidity":800}
[INGEST] HTTP code: 200
[INGEST] Response: {"message":"Sensor data updated","sensors":[...]}
[CONTROL] URL: http://192.168.1.50:3000/control
[CONTROL] HTTP code: 200
[CONTROL] Response: {"command":"ON"}
[RELAY] ON -> motor/relay activated
```

## Quick Test Checklist

1. Start server (`npm start`)
2. Upload ESP8266 sketch with correct SSID/password/IP
3. Open dashboard in browser (`http://localhost:3000`)
4. Confirm:
   - Sensor cards update
   - Device status shows online
   - Last updated time changes
   - Toggle switch changes relay state
