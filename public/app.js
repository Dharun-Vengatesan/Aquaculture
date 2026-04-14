const statusBadge = document.getElementById("statusBadge");
const lastUpdatedText = document.getElementById("lastUpdated");
const sensorGrid = document.getElementById("sensorGrid");
const toggle = document.getElementById("controlToggle");
const controlMessage = document.getElementById("controlMessage");
const errorMessage = document.getElementById("errorMessage");

let pollTimer;

function setError(message = "") {
  if (!message) {
    errorMessage.classList.add("hidden");
    errorMessage.textContent = "";
    return;
  }

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function setStatus(deviceStatus, lastUpdated) {
  const isConnected = deviceStatus === "online";
  statusBadge.textContent = isConnected ? "Device Online" : "Device Offline";
  statusBadge.classList.toggle("connected", isConnected);
  statusBadge.classList.toggle("disconnected", !isConnected);

  if (lastUpdated) {
    const formatted = new Date(lastUpdated).toLocaleString();
    lastUpdatedText.textContent = `Last Updated Time: ${formatted}`;
  } else {
    lastUpdatedText.textContent = "No data received yet.";
  }
}

function renderSensorCards(sensors = []) {
  if (!Array.isArray(sensors) || sensors.length === 0) {
    sensorGrid.innerHTML = "<p class='muted'>Waiting for sensor data...</p>";
    return;
  }

  sensorGrid.innerHTML = sensors
    .map((sensor, index) => {
      const label = sensor?.label || `Sensor ${index + 1}`;
      const value = sensor?.value ?? "-";
      return `
        <article class="card">
          <p class="card-title">${label}</p>
          <p class="card-value">${value}</p>
        </article>
      `;
    })
    .join("");
}

async function fetchData() {
  try {
    const response = await fetch("/data");
    if (!response.ok) throw new Error("Could not fetch sensor data.");

    const payload = await response.json();
    renderSensorCards(payload.sensors);
    setStatus(payload.status?.deviceStatus, payload.status?.lastUpdated);

    const isOn = payload.control === "ON";
    toggle.checked = isOn;
    controlMessage.textContent = `Command: ${payload.control || "OFF"}`;

    if (payload.status?.deviceStatus !== "online") {
      setError("Device appears offline. Check power/network and try again.");
    } else {
      setError("");
    }
  } catch (error) {
    setError("Server unreachable. Please ensure the backend is running.");
    setStatus("offline", null);
  }
}

async function sendControl(command) {
  try {
    const response = await fetch("/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) throw new Error("Control command failed.");

    const payload = await response.json();
    controlMessage.textContent = `Command: ${payload.control}`;
    setError("");
  } catch (error) {
    setError("Failed to send control command.");
  }
}

function setupWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}`);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type !== "state_update") return;

      const payload = message.data || {};
      renderSensorCards(payload.sensors || []);
      setStatus(payload.status?.deviceStatus, payload.status?.lastUpdated);

      const isOn = payload.control === "ON";
      toggle.checked = isOn;
      controlMessage.textContent = `Command: ${payload.control || "OFF"}`;
    } catch (error) {
      setError("Received invalid WebSocket message.");
    }
  };

  ws.onerror = () => {
    // Polling still works, so this stays non-blocking.
    setError("WebSocket disconnected. Using 5-second auto-refresh only.");
  };
}

function start() {
  toggle.addEventListener("change", () => {
    sendControl(toggle.checked ? "ON" : "OFF");
  });

  setupWebSocket();
  fetchData();
  pollTimer = setInterval(fetchData, 5000);
}

window.addEventListener("beforeunload", () => {
  if (pollTimer) clearInterval(pollTimer);
});

start();
