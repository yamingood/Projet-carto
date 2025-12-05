/**
 * Application Web Cartographique M2 MIAGE
 * Gestion complète : CRUD, Filtres, Stats, Clustering, Heatmap, Proximité, Graphiques
 */

// ==========================================
// 1. CONSTANTES & CONFIGURATION
// ==========================================
const API_URL = "http://localhost:3000/api/items";
const API_STATS_URL = "http://localhost:3000/api/stats/scores-by-cuisine";
const API_NEARBY_URL = "http://localhost:3000/api/stats/nearby-points";

const SCORE_COLORS = {
  "0-5": "#198754", // Vert
  "6-10": "#ffc107", // Jaune
  "11-15": "#fd7e14", // Orange
  "16-20": "#dc3545", // Rouge
  "21+": "#212529", // Noir
};

// ==========================================
// 2. ÉTAT GLOBAL
// ==========================================
let allRestaurantData = [];
let currentLegend = null;
let tempMarker = null;

// Modes avancés
let searchModeActive = false;
let heatmapActive = false;
let heatLayer = null;
let nearbyCircle = null;

// Instances Chart.js (pour pouvoir les détruire/mettre à jour)
let chartsInstances = {
  cuisine: null,
  borough: null,
};

// Initialisation Carte
const map = L.map("map").setView([40.7128, -74.006], 11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Layers
const markersLayer = L.markerClusterGroup({
  chunkedLoading: true,
  disableClusteringAtZoom: 16,
}).addTo(map);

const nearbyMarkersLayer = L.layerGroup().addTo(map);

// Modales Bootstrap
let pointModal;
let chartsModal;

// ==========================================
// 3. UTILITAIRES
// ==========================================

function getRecentScore(grades) {
  if (grades && grades.length > 0) return grades[0].score;
  return 999;
}

function getMarkerStyle(item) {
  const score = getRecentScore(item.grades);
  let color;
  if (score <= 5) color = SCORE_COLORS["0-5"];
  else if (score <= 10) color = SCORE_COLORS["6-10"];
  else if (score <= 15) color = SCORE_COLORS["11-15"];
  else if (score <= 20) color = SCORE_COLORS["16-20"];
  else color = SCORE_COLORS["21+"];

  return {
    color: color,
    fillColor: color,
    fillOpacity: 0.8,
    radius: 8,
    weight: 1,
    color: "#fff",
  };
}

function updateLegend() {
  if (currentLegend) map.removeControl(currentLegend);
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create(
      "div",
      "info legend bg-white p-2 border rounded shadow-sm"
    );
    div.innerHTML = '<h6 class="fw-bold mb-2">Note d\'inspection</h6>';
    const categories = {
      "0 - 5 (Excellent)": SCORE_COLORS["0-5"],
      "6 - 10 (Bon)": SCORE_COLORS["6-10"],
      "11 - 15 (Moyen)": SCORE_COLORS["11-15"],
      "16 - 20 (Mauvais)": SCORE_COLORS["16-20"],
      "21+ / Inconnu": SCORE_COLORS["21+"],
    };
    for (const label in categories) {
      div.innerHTML += `<div class="d-flex align-items-center mb-1"><i style="background:${categories[label]}; width: 15px; height: 15px; display: inline-block; margin-right: 8px; border-radius: 50%;"></i><small>${label}</small></div>`;
    }
    return div;
  };
  legend.addTo(map);
  currentLegend = legend;
}

// ==========================================
// 4. CHARGEMENT API
// ==========================================

async function loadPoints() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Erreur API");
    const data = await response.json();
    window.allRestaurantData = data;

    populateSelectFilter(data, "cuisine", "cuisine-filter");
    populateSelectFilter(data, "borough", "borough-filter");

    if (heatmapActive) updateHeatmapData(data);
    else renderPoints(data);

    updateCharts(data);
  } catch (error) {
    console.error("Erreur loadPoints:", error);
  }
}

function renderPoints(data) {
  if (heatmapActive) return;
  markersLayer.clearLayers();
  updateLegend();

  const markersToAdd = [];
  data.forEach((item) => {
    if (item.address?.coord?.coordinates) {
      const [lng, lat] = item.address.coord.coordinates;
      const score = getRecentScore(item.grades);
      const marker = L.circleMarker([lat, lng], getMarkerStyle(item));
      marker.itemData = item;

      const popupContent = `
                <div class="text-center">
                    <strong>${item.name}</strong><br>
                    <span class="badge bg-secondary">${item.cuisine}</span><br>
                    <small>${item.borough}</small><br>
                    <strong>Note: ${score === 999 ? "N/A" : score}</strong><br>
                    <div class="mt-2 btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="handleEdit('${
                          item._id
                        }')">✏️</button>
                        <button class="btn btn-danger" onclick="handleDelete('${
                          item._id
                        }')">🗑️</button>
                    </div>
                </div>`;
      marker.bindPopup(popupContent);
      markersToAdd.push(marker);
    }
  });
  markersLayer.addLayers(markersToAdd);
}

// ==========================================
// 5. FILTRES
// ==========================================

function populateSelectFilter(data, key, elementId) {
  const uniqueValues = new Set();
  data.forEach((item) => {
    if (item[key]) uniqueValues.add(item[key]);
  });
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">Tout afficher</option>`;
  Array.from(uniqueValues)
    .sort()
    .forEach((val) => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    });
}

function applyFilters() {
  if (!window.allRestaurantData) return;

  const cuisineVal = document.getElementById("cuisine-filter").value;
  const boroughVal = document.getElementById("borough-filter").value;
  const scoreVal = document.getElementById("score-filter").value;

  let filtered = window.allRestaurantData;

  if (cuisineVal) filtered = filtered.filter((i) => i.cuisine === cuisineVal);
  if (boroughVal) filtered = filtered.filter((i) => i.borough === boroughVal);
  if (scoreVal) {
    const [min, max] = scoreVal.split("-").map(Number);
    filtered = filtered.filter((i) => {
      const s = getRecentScore(i.grades);
      return s !== 999 && s >= min && s <= max;
    });
  }

  if (heatmapActive) updateHeatmapData(filtered);
  else renderPoints(filtered);

  updateCharts(filtered);
}

// ==========================================
// 6. CRUD
// ==========================================

function openAddForm(lng, lat, existingItem = null) {
  document.getElementById("point-lng").value = lng;
  document.getElementById("point-lat").value = lat;
  document.getElementById("coords-display").textContent = `${parseFloat(
    lat
  ).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
  const title = document.getElementById("modal-title");
  const btn = document.getElementById("submit-btn");

  if (existingItem) {
    title.textContent = "Modifier";
    btn.textContent = "Mettre à jour";
    document.getElementById("point-id").value = existingItem._id;
    document.getElementById("point-name").value = existingItem.name;
    document.getElementById("point-cuisine").value = existingItem.cuisine;
    document.getElementById("point-borough").value = existingItem.borough || "";
  } else {
    title.textContent = "Ajouter";
    btn.textContent = "Ajouter";
    document.getElementById("point-id").value = "";
    document.getElementById("point-form").reset();
  }
  pointModal.show();
}

async function submitPoint(data, id, method) {
  const url = id ? `${API_URL}/${id}` : API_URL;
  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.ok) {
      alert("Opération réussie !");
      closeModal();
      loadPoints();
    } else {
      alert("Erreur serveur.");
    }
  } catch (err) {
    alert("Erreur connexion.");
  }
}

async function handleDelete(id) {
  if (!confirm("Supprimer ?")) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (res.ok) loadPoints();
  } catch (err) {
    console.error(err);
  }
}

function handleEdit(id) {
  let targetItem = null;
  markersLayer.eachLayer((layer) => {
    if (layer.itemData && layer.itemData._id === id)
      targetItem = layer.itemData;
  });
  if (!targetItem) {
    nearbyMarkersLayer.eachLayer((layer) => {
      if (layer.options.itemData && layer.options.itemData._id === id)
        targetItem = layer.options.itemData;
    });
  }
  if (targetItem) {
    const [lng, lat] = targetItem.address.coord.coordinates;
    openAddForm(lng, lat, targetItem);
  } else {
    alert("Données introuvables");
  }
}

function closeModal() {
  pointModal.hide();
  document.getElementById("point-form").reset();
  if (tempMarker) map.removeLayer(tempMarker);
}

// ==========================================
// 7. STATISTIQUES (TABLEAU)
// ==========================================

function createStatsTable(stats, full = false) {
  let html = `<table class="table table-sm table-striped table-hover"><thead class="table-dark"><tr><th>Cuisine</th><th>Note Moyenne</th>${
    full ? "<th>Qté</th>" : ""
  }</tr></thead><tbody>`;
  stats.forEach((s) => {
    const score = s.averageScore.toFixed(2);
    let colorClass =
      s.averageScore < 7
        ? "text-success fw-bold"
        : s.averageScore < 15
        ? "text-warning fw-bold"
        : "text-danger fw-bold";
    html += `<tr><td>${s._id}</td><td class="${colorClass}">${score}</td>${
      full ? `<td>${s.count}</td>` : ""
    }</tr>`;
  });
  return html + "</tbody></table>";
}

async function displayStatistics() {
  const topDiv = document.getElementById("top-stats-container");
  const fullDiv = document.getElementById("full-stats-container");
  try {
    const res = await fetch(API_STATS_URL);
    if (!res.ok) throw new Error("Erreur Stats");
    let stats = await res.json();
    stats.sort((a, b) => a.averageScore - b.averageScore);
    if (topDiv) topDiv.innerHTML = createStatsTable(stats.slice(0, 5), false);
    if (fullDiv) fullDiv.innerHTML = createStatsTable(stats, true);
  } catch (err) {}
}

// ==========================================
// 8. 📊 GRAPHIQUES DYNAMIQUES (CHART.JS)
// ==========================================

function openChartsModal() {
  chartsModal.show();
}

/**
 * Calcule les données et met à jour les graphiques Chart.js
 * @param {Array} data Les données filtrées des restaurants
 */
function updateCharts(data) {
  // --- GRAPHIQUE 1 : TOP CUISINES (BAR) ---
  const cuisineCounts = {};
  data.forEach((item) => {
    if (item.cuisine)
      cuisineCounts[item.cuisine] = (cuisineCounts[item.cuisine] || 0) + 1;
  });

  const sortedCuisines = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const cuisineLabels = sortedCuisines.map((c) => c[0]);
  const cuisineValues = sortedCuisines.map((c) => c[1]);

  const ctxCuisine = document.getElementById("cuisineChart");
  if (ctxCuisine) {
    if (chartsInstances.cuisine) chartsInstances.cuisine.destroy();
    chartsInstances.cuisine = new Chart(ctxCuisine, {
      type: "bar",
      data: {
        labels: cuisineLabels,
        datasets: [
          {
            label: "Nombre de restaurants",
            data: cuisineValues,
            backgroundColor: "rgba(54, 162, 235, 0.6)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: {
          title: {
            display: true,
            text: "Top 10 Cuisines (Sélection actuelle)",
          },
        },
      },
    });
  }

  // --- GRAPHIQUE 2 : DOUGHNUT (QUARTIERS OU CUISINES) ---
  const selectedBorough = document.getElementById("borough-filter").value;
  const ctxBorough = document.getElementById("boroughChart");

  if (ctxBorough) {
    if (chartsInstances.borough) chartsInstances.borough.destroy();

    let dLabels = [];
    let dValues = [];
    let dTitle = "";

    if (selectedBorough) {
      dTitle = `Répartition des Cuisines (${selectedBorough})`;

      dLabels = cuisineLabels;
      dValues = cuisineValues;
    } else {
      dTitle = "Répartition par Quartier";
      const boroughCounts = {};
      data.forEach((item) => {
        if (item.borough)
          boroughCounts[item.borough] = (boroughCounts[item.borough] || 0) + 1;
      });

      const sortedBoroughs = Object.entries(boroughCounts).sort(
        (a, b) => b[1] - a[1]
      );
      dLabels = sortedBoroughs.map((b) => b[0]);
      dValues = sortedBoroughs.map((b) => b[1]);
    }

    chartsInstances.borough = new Chart(ctxBorough, {
      type: "doughnut",
      data: {
        labels: dLabels,
        datasets: [
          {
            label: "Nombre de restaurants",
            data: dValues,
            backgroundColor: [
              "#FF6384",
              "#36A2EB",
              "#FFCE56",
              "#4BC0C0",
              "#9966FF",
              "#FF9F40",
              "#E7E9ED",
              "#76A346",
              "#FDB45C",
              "#949FB1",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          title: { display: true, text: dTitle },
        },
      },
    });
  }
}

// ==========================================
// 9. MODES AVANCÉS
// ==========================================

function toggleHeatmap() {
  heatmapActive = !heatmapActive;
  const btn = document.getElementById("heatmap-btn");
  if (heatmapActive) {
    if (btn) btn.className = "btn btn-danger text-white";
    markersLayer.clearLayers();
    updateHeatmapData(window.allRestaurantData);
  } else {
    if (btn) btn.className = "btn btn-outline-danger";
    if (heatLayer) map.removeLayer(heatLayer);
    applyFilters();
  }
}

function updateHeatmapData(data) {
  if (!heatmapActive) return;
  if (heatLayer) map.removeLayer(heatLayer);
  const heatPoints = data
    .filter((i) => i.address?.coord?.coordinates)
    .map((i) => [
      i.address.coord.coordinates[1],
      i.address.coord.coordinates[0],
      0.5,
    ]);

  if (L.heatLayer)
    heatLayer = L.heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
    }).addTo(map);
}

function toggleNearbyMode() {
  searchModeActive = !searchModeActive;
  const btn = document.getElementById("nearby-btn");
  if (searchModeActive) {
    if (btn) {
      btn.className = "btn btn-info text-white";
      btn.innerHTML = "❌ Annuler";
    }
    if (heatmapActive) toggleHeatmap();
    alert("Cliquez sur la carte pour trouver les restaurants à 1km.");
  } else {
    if (btn) {
      btn.className = "btn btn-outline-info";
      btn.innerHTML = "🎯 Proximité (1km)";
    }
    nearbyMarkersLayer.clearLayers();
    if (nearbyCircle) map.removeLayer(nearbyCircle);
    applyFilters();
  }
}

async function performNearbySearch(lat, lng) {
  const radiusMeters = 1000;
  nearbyMarkersLayer.clearLayers();
  if (nearbyCircle) map.removeLayer(nearbyCircle);
  markersLayer.clearLayers();

  nearbyCircle = L.circle([lat, lng], {
    color: "#0dcaf0",
    fillColor: "#0dcaf0",
    fillOpacity: 0.1,
    radius: radiusMeters,
  }).addTo(map);
  map.flyTo([lat, lng], 14);

  L.marker([lat, lng])
    .addTo(nearbyMarkersLayer)
    .bindPopup("<b>📍 Centre de recherche</b>")
    .openPopup();

  try {
    const res = await fetch(
      `${API_NEARBY_URL}?lng=${lng}&lat=${lat}&distance=${radiusMeters}`
    );
    const points = await res.json();

    let newCount = 0;
    points.forEach((p) => {
      const exists = window.allRestaurantData.find(
        (local) => local._id === p._id
      );
      if (!exists) {
        window.allRestaurantData.push(p);
        newCount++;
      }

      const [plng, plat] = p.address.coord.coordinates;
      const dist = p.dist.calculated.toFixed(0);

      const m = L.circleMarker([plat, plng], getMarkerStyle(p)).addTo(
        nearbyMarkersLayer
      );

      m.options.itemData = p;
      m.bindPopup(
        `<strong>${p.name}</strong><br><span class="badge bg-secondary">${p.cuisine}</span><br>Distance: <b>${dist} m</b>`
      );
    });
    const topStats = document.getElementById("top-stats-container");
    if (topStats)
      topStats.innerHTML = `<div class="alert alert-info">🎯 <strong>${points.length}</strong> trouvés.</div>`;
  } catch (err) {
    console.error(err);
  }
}

async function handleMapClick(e) {
  const { lat, lng } = e.latlng;
  if (searchModeActive) {
    performNearbySearch(lat, lng);
    return;
  }
  if (heatmapActive) return;
  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(
      `Position choisie<br><button class="btn btn-sm btn-success mt-1" onclick="openAddForm('${lng}', '${lat}')">Ajouter ici</button>`
    )
    .openPopup();
}

// ==========================================
// 10. INITIALISATION DOM
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // Modales
  const modalEl = document.getElementById("point-modal");
  if (modalEl)
    pointModal = new bootstrap.Modal(modalEl, { backdrop: "static" });

  const chartsEl = document.getElementById("charts-modal");
  if (chartsEl) chartsModal = new bootstrap.Modal(chartsEl, {});

  // Filtres
  const cuisineF = document.getElementById("cuisine-filter");
  if (cuisineF) cuisineF.addEventListener("change", applyFilters);
  const boroughF = document.getElementById("borough-filter");
  if (boroughF) boroughF.addEventListener("change", applyFilters);
  const scoreF = document.getElementById("score-filter");
  if (scoreF) scoreF.addEventListener("change", applyFilters);

  // Carte
  map.on("click", handleMapClick);

  // Formulaire
  const form = document.getElementById("point-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("point-id").value;
      const lng = parseFloat(document.getElementById("point-lng").value);
      const lat = parseFloat(document.getElementById("point-lat").value);
      const payload = {
        name: document.getElementById("point-name").value,
        cuisine: document.getElementById("point-cuisine").value,
        borough: document.getElementById("point-borough").value,
        address: { coord: { type: "Point", coordinates: [lng, lat] } },
        grades: [],
      };
      submitPoint(payload, id, id ? "PUT" : "POST");
    });
  }

  // Lancement
  loadPoints();
  displayStatistics();
});
