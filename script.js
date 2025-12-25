console.log("🚨 JavaScript loaded!");

/* For Testing the javascript is working
document.getElementById("js-check").textContent = "JavaScript is working!";
*/

// === CONFIGURATION ===
const API_KEY = "73fbeb93-7586-4be1-9549-ef66f1e6151f";
const STOP_IDS = ["40_99610", "40_99603"];
const ALL_ROUTES = ["1 Line"];

let activeRoutes = new Set(ALL_ROUTES);

const REFRESH_INTERVAL = 60000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCountdown(arrivalTime) {
  const diffMs = arrivalTime - Date.now();
  const diffMins = Math.round(diffMs / 60000);
  return diffMins <= 0 ? "Arriving" : `${diffMins} min`;
}

function startCountdownUpdater() {
  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll(".arrival").forEach(arrivalDiv => {
      const etaDiv = arrivalDiv.querySelector(".eta");
      if (!etaDiv) return;

      const arrivalTime = parseInt(etaDiv.getAttribute("data-arrival-time"), 10);
      if (!arrivalTime) return;

      const diffMins = Math.round((arrivalTime - now) / 60000);
      etaDiv.textContent = diffMins <= 0 ? "Arriving" : `${diffMins} min`;
    });
  }, 1000);
}

function createToggleButton(label, active = true) {
  const btn = document.createElement("button");
  btn.className = "toggle-btn";
  if (active) btn.classList.add("active");
  btn.textContent = label;
  return btn;
}

function setupRouteFilters() {
  const container = document.getElementById("route-buttons");
  container.innerHTML = ""; // Clear existing buttons if any

  ALL_ROUTES.forEach(route => {
    const shortRoute = route.replace(/\s*Line$/i, "");
    const btn = createToggleButton(shortRoute);
    btn.dataset.route = route;

    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) {
        btn.classList.remove("active");
        activeRoutes.delete(route);
      } else {
        btn.classList.add("active");
        activeRoutes.add(route);
      }
      fetchAndDisplayStopsWithDataAttr();
    });

    container.appendChild(btn);
  });

  document.getElementById("show-all-routes").onclick = () => {
    activeRoutes = new Set(ALL_ROUTES);
    document.querySelectorAll("#route-buttons .toggle-btn").forEach(btn => btn.classList.add("active"));
    fetchAndDisplayStopsWithDataAttr();
  };

  document.getElementById("clear-all-routes").onclick = () => {
    activeRoutes.clear();
    document.querySelectorAll("#route-buttons .toggle-btn").forEach(btn => btn.classList.remove("active"));
    fetchAndDisplayStopsWithDataAttr();
  };
}

async function fetchAndDisplayStopsWithDataAttr() {
  const stopList = document.getElementById("stop-list");
  stopList.innerHTML = "";

  let allArrivals = [];

  for (const stopId of STOP_IDS) {
    try {
      const url = `https://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-stop/${stopId}.json?key=${API_KEY}`;
      const response = await fetch(url);
      if (!response.ok || response.status === 429) continue;

      const data = await response.json();
      const stopName = data.data.references?.stops?.find(s => s.id === stopId)?.name || "Unknown Stop";
      const arrivals = data.data.entry.arrivalsAndDepartures;

      arrivals.forEach(arrival => {
        const route = arrival.routeShortName;
        if (activeRoutes.has(route)) {
          allArrivals.push({
            stopName,
            route: arrival.routeShortName,
            headsign: arrival.tripHeadsign,
            arrivalTime: arrival.predictedArrivalTime || arrival.scheduledArrivalTime,
            platform: arrival.actualTrack || arrival.scheduledTrack || "",
            scheduledTime: arrival.scheduledArrivalTime,
            predictedTime: arrival.predictedArrivalTime,
          });
        }
      });
    } catch (error) {
      console.error("Error:", error);
    }
    await delay(500);
  }

  allArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);

  if (allArrivals.length === 0) {
    stopList.textContent = "No upcoming arrivals for selected routes.";
    return;
  }

  allArrivals.forEach(({ stopName, route, headsign, arrivalTime, platform, scheduledTime, predictedTime }) => {
    const arrivalDiv = document.createElement("div");
    arrivalDiv.className = "arrival";

    const routeDiv = document.createElement("div");
    routeDiv.className = "route-circle";
    const shortRoute = route.replace(/\s*Line$/i, "");
    routeDiv.textContent = shortRoute;

    const infoDiv = document.createElement("div");
    infoDiv.className = "info";

    const destDiv = document.createElement("div");
    destDiv.className = "destination";
    destDiv.textContent = headsign || "No destination";

    const stopDiv = document.createElement("div");
    stopDiv.className = "stop-name";
    stopDiv.textContent = stopName;

    // Determine status and early/late text
    let statusClass = "scheduled"; // default
    let earlyLateText = "";

    if (predictedTime) {
      const diffSeconds = (predictedTime - scheduledTime) / 1000;
      const diffMinutes = Math.round(diffSeconds / 60);

      if (diffSeconds < -60) {
        statusClass = "early";
        earlyLateText = `${Math.abs(diffMinutes)} min early`;
      } else if (Math.abs(diffSeconds) <= 60) {
        statusClass = "on-time";
        earlyLateText = `On time`;
      } else if (diffSeconds > 60) {
        statusClass = "late";
        earlyLateText = `${diffMinutes} min late`;
      }
    } else {
      earlyLateText = "Scheduled";
    }

    // Container for countdown and early/late text (stacked vertically)
    const etaContainer = document.createElement("div");
    etaContainer.style.display = "flex";
    etaContainer.style.flexDirection = "column";
    etaContainer.style.alignItems = "flex-end"; // aligns both lines to the right
    etaContainer.style.lineHeight = "1.2";

    const etaDiv = document.createElement("div");
    etaDiv.className = `eta ${statusClass}`;
    etaDiv.textContent = formatCountdown(predictedTime || scheduledTime);
    etaDiv.setAttribute("data-arrival-time", predictedTime || scheduledTime);

    const earlyLateDiv = document.createElement("div");
    earlyLateDiv.className = `early-late ${statusClass}`;
    earlyLateDiv.textContent = earlyLateText;

    etaContainer.appendChild(etaDiv);
    etaContainer.appendChild(earlyLateDiv);


    const platformDiv = document.createElement("div");
    platformDiv.className = "platform";
    if (platform) platformDiv.textContent = `Track ${platform}`;

    infoDiv.appendChild(destDiv);
    infoDiv.appendChild(stopDiv);
    infoDiv.appendChild(etaContainer);

    if (platform) infoDiv.appendChild(platformDiv);

    arrivalDiv.appendChild(routeDiv);
    arrivalDiv.appendChild(infoDiv);
    stopList.appendChild(arrivalDiv);
  });
}

// Initial boot
(async () => {
  setupRouteFilters();
  await fetchAndDisplayStopsWithDataAttr();
  startCountdownUpdater();
  setInterval(fetchAndDisplayStopsWithDataAttr, REFRESH_INTERVAL);
})();
