const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const OFFLINE_TIMEOUT_MS = 10_000;

// Simple in-memory state (no database).
const state = {
  sensors: [],
  control: "OFF",
  lastUpdated: null,
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function buildStatus() {
  const now = Date.now();
  const lastSeen = state.lastUpdated ? Date.parse(state.lastUpdated) : 0;
  const isConnected = lastSeen && now - lastSeen <= OFFLINE_TIMEOUT_MS;
  const deviceStatus = isConnected ? "online" : "offline";

  return {
    isConnected: Boolean(isConnected),
    deviceStatus,
    lastUpdated: state.lastUpdated,
  };
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const { temperature, ph, turbidity } = payload;
  if (
    typeof temperature !== "number" ||
    typeof ph !== "number" ||
    typeof turbidity !== "number"
  ) {
    return null;
  }

  return [
    { label: "Sensor 1", value: temperature },
    { label: "Sensor 2", value: ph },
    { label: "Sensor 3", value: turbidity },
  ];
}

function updateSensorData(payload) {
  const normalized = normalizePayload(payload);
  if (!normalized) {
    return false;
  }

  state.sensors = normalized;
  state.lastUpdated = new Date().toISOString();
  broadcastState();
  return true;
}

function broadcastState() {
  const message = JSON.stringify({
    type: "state_update",
    data: {
      sensors: state.sensors,
      control: state.control,
      status: buildStatus(),
    },
  });

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

// Frontend polling endpoint.
app.get("/data", (req, res) => {
  res.json({
    sensors: state.sensors,
    control: state.control,
    status: buildStatus(),
  });
});

// Device or frontend can update latest sensor values here.
app.post("/ingest", (req, res) => {
  const updated = updateSensorData(req.body);
  if (!updated) {
    return res.status(400).json({
      message:
        'Invalid payload. Expected: { "temperature": number, "ph": number, "turbidity": number }',
    });
  }

  return res.status(200).json({
    message: "Sensor data updated",
    sensors: state.sensors,
  });
});

// Simple ON/OFF control endpoint.
app.post("/control", (req, res) => {
  const { command } = req.body || {};

  if (!["ON", "OFF"].includes(command)) {
    return res
      .status(400)
      .json({ message: 'Invalid command. Use { "command": "ON" | "OFF" }' });
  }

  state.control = command;
  broadcastState();

  return res.status(200).json({
    message: `Command ${command} accepted`,
    control: state.control,
  });
});

// ESP8266 polls this endpoint every 2 seconds.
app.get("/control", (req, res) => {
  res.json({ command: state.control });
});

// Optional WebSocket ingestion (device can send JSON frames directly).
wss.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      type: "state_update",
      data: {
        sensors: state.sensors,
        control: state.control,
        status: buildStatus(),
      },
    })
  );

  socket.on("message", (raw) => {
    try {
      const payload = JSON.parse(raw.toString());
      if (payload?.type === "sensor_data") {
        const updated = updateSensorData(payload.data || {});
        if (!updated) {
          socket.send(
            JSON.stringify({
              type: "error",
              message:
                'Invalid sensor_data payload. Expected { temperature, ph, turbidity } numbers.',
            })
          );
        }
      } else if (payload?.type === "control" && ["ON", "OFF"].includes(payload.command)) {
        state.control = payload.command;
        broadcastState();
      } else {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Unknown WebSocket message type",
          })
        );
      }
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Invalid JSON message",
        })
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`IoT dashboard running on http://localhost:${PORT}`);
});
