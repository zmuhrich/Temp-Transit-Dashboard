
console.log(" ZACHS script.js loaded");

// ================= CONFIG =================
const API_KEY = "73fbeb93-7586-4be1-9549-ef66f1e6151f";
const REFRESH_INTERVAL = 60000;

// Default active routes list
let activeSelections = []; // Each item: {agencyId, routeId, shortName, direction, stopId, stopName}
let ALL_AGENCIES = [
  {id: "1", name: "Metro Transit"},
  {id: "40", name: "Community Transit"},
  {id: "29", name: "Pierce Transit"},
  {id: "3", name: "Sound Transit"},
  {id: "44", name: "Everett Transit"},
  {id: "45", name: "King County Water Taxi"},
  {id: "46", name: "Kitsap Transit"},
  {id: "47", name: "Seattle Streetcar"},
  {id: "48", name: "Vashon Island Ferry"}
];

let ALL_ROUTES = [];
let selectedAgency = null;

// ================= UTIL =================
function formatCountdown(arrivalTime) {
  const diff = Math.round((arrivalTime - Date.now()) / 60000);
  return diff <= 0 ? "Arriving" : `${diff} min`;
}

function clearPanel(panelId) {
  const el = document.getElementById(panelId);
  if (el) el.innerHTML = "";
}

// ================= ARRIVALS =================
async function fetchAndDisplayStops() {
  const list = document.getElementById("stop-list");
  if (!list) return;

  list.innerHTML = "Loading…";

  if (!activeSelections.length) {
    list.innerHTML = "No Route Selected";
    return;
  }

  let allArrivals = [];

  for (const sel of activeSelections) {
    try {
      const url = `https://api.pugetsound.onebusaway.org/api/where/arrivals-and-departures-for-stop/${sel.stopId}.json?key=${API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const arrivals = data.data.entry.arrivalsAndDepartures || [];

      const filtered = arrivals.filter(a => a.routeId === sel.routeId && a.tripHeadsign === sel.direction);
      filtered.forEach(a => {
        allArrivals.push({
          route: sel.shortName,
          direction: sel.direction,
          stop: sel.stopName,
          scheduledTime: a.predictedArrivalTime || a.scheduledArrivalTime,
          status: a.status || "scheduled"
        });
      });
    } catch (err) {
      console.error("Error fetching stop arrivals:", err);
    }
  }

  allArrivals.sort((a,b) => a.scheduledTime - b.scheduledTime);

  if (!allArrivals.length) {
    list.innerHTML = "No Upcoming arrivals for selected routes.";
    return;
  }

  // Render arrivals
  list.innerHTML = "";
  allArrivals.forEach(a => {
    const row = document.createElement("div");
    row.className = "arrival-row";

    const routeEl = document.createElement("div");
    routeEl.className = "arrival-route";
    routeEl.textContent = a.route;

    const directionEl = document.createElement("div");
    directionEl.className = "arrival-direction";
    directionEl.textContent = a.direction;

    const stopEl = document.createElement("div");
    stopEl.className = "arrival-stop";
    stopEl.textContent = a.stop;

    const etaEl = document.createElement("div");
    etaEl.className = "arrival-eta";
    etaEl.textContent = formatCountdown(a.scheduledTime);

    // Color based on status
    switch(a.status.toLowerCase()) {
      case "on time": etaEl.style.color = "green"; break;
      case "late": etaEl.style.color = "purple"; break;
      case "early": etaEl.style.color = "red"; break;
      default: etaEl.style.color = "grey";
    }

    row.append(routeEl, directionEl, stopEl, etaEl);
    list.appendChild(row);
  });
}

// ================= SETTINGS =================
function openSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  if (!panel) return;
  panel.innerHTML = "<h3>Select Agency → Route → Direction → Stop</h3>";

  // Agency selection
  ALL_AGENCIES.forEach(agency => {
    const row = document.createElement("div");
    const rb = document.createElement("input");
    rb.type = "radio";
    rb.name = "agency";
    rb.value = agency.id;
    rb.checked = selectedAgency === agency.id;
    rb.id = `agency-${agency.id}`;

    rb.onclick = async () => {
      selectedAgency = agency.id;
      await fetchRoutes(selectedAgency);
      clearPanel("route-tree");
      clearPanel("stop-list");
    };

    const label = document.createElement("label");
    label.htmlFor = rb.id;
    label.textContent = agency.name;

    row.append(rb, label);
    panel.appendChild(row);
  });

  const treeContainer = document.createElement("div");
  treeContainer.id = "route-tree";
  treeContainer.style.maxHeight = "300px";
  treeContainer.style.overflowY = "auto";
  panel.appendChild(treeContainer);

  panel.style.display = "block";
}

async function fetchRoutes(agencyId) {
  const tree = document.getElementById("route-tree");
  if (!tree) return;
  tree.innerHTML = "Loading routes…";

  try {
    const url = `https://api.pugetsound.onebusaway.org/api/where/routes-for-agency/${agencyId}.json?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch routes: ${res.status}`);
    const data = await res.json();
    const routes = data.data.list || [];

    ALL_ROUTES = routes.map(r => ({
      routeId: r.id,
      shortName: r.shortName,
      directionNames: r.directionNames?.length ? r.directionNames : ["Outbound", "Inbound"]
    })).sort((a,b) => {
      const nA = parseInt(a.shortName);
      const nB = parseInt(b.shortName);
      if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
      if (!isNaN(nA)) return -1;
      if (!isNaN(nB)) return 1;
      return a.shortName.localeCompare(b.shortName);
    });

    renderRouteTree();
  } catch(err) {
    console.error(err);
    tree.innerHTML = "Failed to load routes";
  }
}

function renderRouteTree() {
  const tree = document.getElementById("route-tree");
  if (!tree) return;
  tree.innerHTML = "";

  ALL_ROUTES.forEach(route => {
    const routeDiv = document.createElement("div");
    routeDiv.className = "tree-route";
    routeDiv.textContent = route.shortName;
    routeDiv.style.cursor = "pointer";

    const dirDiv = document.createElement("div");
    dirDiv.style.display = "none";
    dirDiv.style.marginLeft = "15px";

    route.directionNames.forEach(dir => {
      const dirBtn = document.createElement("button");
      dirBtn.textContent = dir;
      dirBtn.onclick = async () => selectDirection(route, dir);
      dirDiv.appendChild(dirBtn);
    });

    routeDiv.onclick = () => {
      dirDiv.style.display = dirDiv.style.display === "none" ? "block" : "none";
    };

    tree.appendChild(routeDiv);
    tree.appendChild(dirDiv);
  });
}

async function selectDirection(route, direction) {
  // Prompt stop selection
  const stopContainer = document.getElementById("stop-selection");
  if (!stopContainer) return;
  stopContainer.innerHTML = "Loading stops…";

  try {
    const url = `https://api.pugetsound.onebusaway.org/api/where/stops-for-route/${route.routeId}.json?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch stops: ${res.status}`);
    const data = await res.json();
    const stops = data.data.list || [];

    stopContainer.innerHTML = "<h4>Select Stop</h4>";

    stops.forEach(s => {
      const btn = document.createElement("button");
      btn.textContent = s.name;
      btn.onclick = () => {
        // Add selection if not already added
        const exists = activeSelections.some(sel =>
          sel.routeId === route.routeId && sel.direction === direction && sel.stopId === s.id
        );
        if (!exists) {
          activeSelections.push({
            agencyId: selectedAgency,
            routeId: route.routeId,
            shortName: route.shortName,
            direction: direction,
            stopId: s.id,
            stopName: s.name
          });
        }
        fetchAndDisplayStops();
      };
      stopContainer.appendChild(btn);
    });
  } catch(err) {
    console.error(err);
    stopContainer.innerHTML = "Failed to load stops";
  }
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  const gear = document.getElementById("settings-gear");
  if (gear) {
    gear.onclick = openSettingsPanel;
  }

  fetchAndDisplayStops();
  setInterval(fetchAndDisplayStops, REFRESH_INTERVAL);
});
