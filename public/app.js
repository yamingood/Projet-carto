window.allRestaurantData = [];
const API_URL = "http://localhost:3000/api/items";
const API_STATS_URL = "http://localhost:3000/api/stats/scores-by-cuisine";

// 1. Initialisation de la carte
const map = L.map("map").setView([40.7128, -74.006], 11); // Centré sur New York (approximativement)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);
const pointModal = new bootstrap.Modal(
  document.getElementById("point-modal"),
  {}
);

let markers = L.layerGroup().addTo(map);

// Fonction utilitaire pour le style dynamique
function getMarkerStyle(cuisine) {
  let color;
  switch (cuisine) {
    // Exemple de style dynamique par cuisine (à compléter avec plus de catégories)
    case "Bakery":
      color = "blue";
      break;
    case "Pizza":
      color = "red";
      break;
    case "Chinese":
      color = "green";
      break;
    default:
      color = "gray";
  }
  return {
    color: color,
    fillColor: color,
    fillOpacity: 0.6,
    radius: 8,
  };
}

function createStatsTableHTML(stats, isFullTable = false) {
  let tableHTML = `
        <table class="table table-sm table-striped">
            <thead class="table-dark">
                <tr>
                    <th>Cuisine</th>
                    <th>Score Moyen (plus bas = mieux)</th>
                    ${isFullTable ? "<th>Nombre d'évaluations</th>" : ""}
                </tr>
            </thead>
            <tbody>
    `;

  stats.forEach((stat) => {
    const formattedScore = stat.averageScore.toFixed(2);

    // Logique de couleur pour le score (Score plus bas = mieux)
    let colorClass = "text-dark";
    if (stat.averageScore < 7) {
      colorClass = "text-success fw-bold"; // Très bon score
    } else if (stat.averageScore < 15) {
      colorClass = "text-warning fw-bold"; // Score moyen
    } else {
      colorClass = "text-danger fw-bold"; // Mauvais score
    }

    tableHTML += `
            <tr>
                <td>${stat._id}</td>
                <td class="${colorClass}">${formattedScore}</td>
                ${isFullTable ? `<td>${stat.count}</td>` : ""}
            </tr>
        `;
  });

  tableHTML += "</tbody></table>";
  return tableHTML;
}

function populateCuisineFilter(data) {
  const cuisineSet = new Set();
  data.forEach((item) => {
    if (item.cuisine) {
      cuisineSet.add(item.cuisine);
    }
  });

  const filterSelect = document.getElementById("cuisine-filter");
  filterSelect.innerHTML = '<option value="">Toutes les cuisines</option>'; // Réinitialiser

  // Trier les cuisines par ordre alphabétique
  const sortedCuisines = Array.from(cuisineSet).sort();

  sortedCuisines.forEach((cuisine) => {
    const option = document.createElement("option");
    option.value = cuisine;
    option.textContent = cuisine;
    filterSelect.appendChild(option);
  });

  // Écouter l'événement de changement pour appliquer le filtre
  filterSelect.addEventListener("change", applyFilters);
}

function populateBorough(data) {
  const boroughSet = new Set();
  data.forEach((item) => {
    if (item.borough) {
      boroughSet.add(item.borough);
    }
  });

  const boroughFilterSelect = document.getElementById("borough-filter");
  boroughFilterSelect.innerHTML =
    '<option value="">Tous les quartiers</option>'; // Réinitialiser

  // Trier les quartiers par ordre alphabétique
  const sortedBoroughs = Array.from(boroughSet).sort();

  sortedBoroughs.forEach((borough) => {
    const option = document.createElement("option");
    option.value = borough;
    option.textContent = borough;
    boroughFilterSelect.appendChild(option);
  });

  // Écouter l'événement de changement pour appliquer le filtre
  boroughFilterSelect.addEventListener("change", applyFilters);
}

async function loadPoints() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Erreur de chargement des données API");

    const data = await response.json();

    // Stocker toutes les données chargées pour le filtrage
    window.allRestaurantData = data;

    populateCuisineFilter(data);

    populateBorough(data);

    // Rendu des points
    renderPoints(data);
  } catch (error) {
    console.error("Erreur lors du chargement des points:", error);
  }
}

// Fonction pour rendre les points (isolée pour être réutilisée par le filtre)
function renderPoints(data) {
  // 1. Supprimer les marqueurs existants (méthode L.layerGroup)
  markers.clearLayers();

  data.forEach((item) => {
    // Vérification de la présence des coordonnées
    if (item.address && item.address.coord && item.address.coord.coordinates) {
      // 2. Déstructuration : [lng, lat] de MongoDB
      var [lng, lat] = item.address.coord.coordinates;

      // 3. Création du marqueur : [lat, lng] pour Leaflet, avec styleMap (styleMap est getMarkerStyle dans notre code)
      var marker = L.circleMarker([lat, lng], getMarkerStyle(item.cuisine));

      // Stocker les données pour l'édition/suppression
      marker.itemData = item;

      // Logique de survol (MouseOver/MouseOut) :
      marker.on("mouseover", function () {
        this.setRadius(15);
        this.setStyle({ weight: 4, opacity: 1 });
        this.bindPopup(
          `<b>${item.name}</b><br/>Cuisine: ${item.cuisine}<br/>Borough: ${item.borough}`
        ).openPopup();
      });

      marker.on("mouseout", function () {
        this.setRadius(8); // Revenir à la taille par défaut
        this.setStyle(getMarkerStyle(item.cuisine));
      });

      // Événement clic pour les popups (qui contiennent les boutons Editer/Supprimer)
      marker.on("click", function () {
        this.bindPopup(
          `<b>${item.name}</b><br>
                    Cuisine: ${item.cuisine}<br>
                    Borough: ${item.borough}<br>
                    <button onclick="handleEdit('${item._id}')">✏️ Modifier</button>
                    <button onclick="handleDelete('${item._id}')">🗑️ Supprimer</button>`
        ).openPopup();
      });

      marker.addTo(markers); // Ajout au groupe de calques
    } else {
      console.warn(
        `Point ${item.name || item._id} ignoré : Coordonnées manquantes.`
      );
    }
  });
}

// 3. Gestion des Interactions (CRUD)

// Fonction d'exemple pour la suppression (appelé depuis le Popup)
async function handleDelete(id) {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce point ?")) return;

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      alert("Point supprimé avec succès !");
      loadPoints(); // Rafraîchir la carte
    } else {
      alert("Erreur lors de la suppression.");
    }
  } catch (error) {
    console.error("Erreur DELETE:", error);
  }
}

// Fonction pour l'ajout (sélection de position par clic sur la carte)
let tempMarker = null;
map.on("click", function (e) {
  const { lat, lng } = e.latlng;

  // Supprimer le marqueur temporaire précédent
  if (tempMarker) map.removeLayer(tempMarker);

  // Créer un nouveau marqueur temporaire
  tempMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup(
      `
            Position sélectionnée: Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(
        4
      )}<br>
            <button onclick="openAddForm('${lng}', '${lat}')">Ajouter un point ici</button>
        `
    )
    .openPopup();
});

// Variable pour stocker temporairement les coordonnées sélectionnées
let currentLng = null;
let currentLat = null;

// Fonction de simulation pour ouvrir/remplir un formulaire (vous devrez créer le HTML)
function openAddForm(lng, lat, existingItem = null) {
  const modalTitle = document.getElementById("modal-title");
  const submitBtn = document.getElementById("submit-btn");
  const coordsDisplay = document.getElementById("coords-display");

  // Remplir les champs cachés pour les coordonnées
  document.getElementById("point-lng").value = lng;
  document.getElementById("point-lat").value = lat;

  if (existingItem) {
    // --- Mode ÉDITION (PUT) ---
    modalTitle.textContent = "Modifier le Restaurant : " + existingItem.name;
    submitBtn.textContent = "Modifier";
    document.getElementById("point-id").value = existingItem._id;

    // Remplir les données existantes
    document.getElementById("point-name").value = existingItem.name;
    document.getElementById("point-cuisine").value = existingItem.cuisine;
    document.getElementById("point-borough").value =
      existingItem.borough || "Unknown";
  } else {
    // --- Mode AJOUT (POST) ---
    modalTitle.textContent = "Ajouter un nouveau restaurant";
    submitBtn.textContent = "Ajouter";
    document.getElementById("point-id").value = ""; // Assurez-vous que l'ID est vide

    // Vider les champs pour un nouvel ajout
    document.getElementById("point-form").reset();
  }

  // Afficher les coordonnées sélectionnées
  coordsDisplay.textContent = `Lat: ${parseFloat(lat).toFixed(
    4
  )}, Lng: ${parseFloat(lng).toFixed(4)}`;

  openModal();
}

// Fonction pour envoyer les données à l'API (POST ou PUT)
async function submitPoint(data, id = null, method) {
  const url = id ? `${API_URL}/${id}` : API_URL;

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert(`Point ${method === "POST" ? "ajouté" : "modifié"} avec succès !`);
      loadPoints(); // Rafraîchir la carte après succès
      // Enlever le marqueur temporaire après l'ajout
      if (tempMarker) map.removeLayer(tempMarker);
    } else {
      const errorData = await response.json();
      alert(
        `Erreur (${response.status}) : ${
          errorData.message || "La requête a échoué"
        }`
      );
    }
  } catch (error) {
    console.error(`Erreur ${method}:`, error);
    alert("Erreur de connexion au serveur.");
  }
}

// Fonction pour gérer l'édition (appelée depuis le Popup)
function handleEdit(id) {
  // Trouver les données du point à partir du LayerGroup
  let itemToEdit = null;
  markers.eachLayer((layer) => {
    if (layer.itemData && layer.itemData._id === id) {
      itemToEdit = layer.itemData;
    }
  });

  if (itemToEdit) {
    const [lng, lat] = itemToEdit.address.coord.coordinates;
    openAddForm(lng, lat, itemToEdit);
  } else {
    alert("Données du point à éditer introuvables.");
  }
}

// Fonction pour appliquer tous les filtres actifs
function applyFilters() {
  // Récupération des deux valeurs de filtre (la valeur du <select> est un string)
  const selectedCuisine = document.getElementById("cuisine-filter").value;
  const selectedBorough = document.getElementById("borough-filter").value;

  if (!window.allRestaurantData) return;

  let filteredData = window.allRestaurantData;

  // 1. Filtre par Cuisine (conserve la logique existante)
  if (selectedCuisine) {
    filteredData = filteredData.filter(
      (item) => item.cuisine === selectedCuisine
    );
  }

  // 2. Filtre par Quartier (Borough)
  if (selectedBorough) {
    // Vérifie si une valeur a été sélectionnée (différent de la chaîne vide "")
    filteredData = filteredData.filter(
      (item) => item.borough === selectedBorough
    );
  }
  renderPoints(filteredData);
}

async function displayStatistics() {
  const topStatsContainer = document.getElementById("top-stats-container");
  const fullStatsContainer = document.getElementById("full-stats-container");

  topStatsContainer.innerHTML = "<p>Chargement en cours...</p>";
  fullStatsContainer.innerHTML = ""; // Vider le conteneur du collapse

  try {
    const response = await fetch(API_STATS_URL);
    if (!response.ok) throw new Error("Erreur de chargement des statistiques");

    let stats = await response.json();

    // 🚨 CRITÈRE : Tri par score moyen (croissant, car 2 est meilleur que 20)
    stats.sort((a, b) => a.averageScore - b.averageScore);

    // 🚨 CRITÈRE : Afficher seulement les 5 meilleurs
    const top5Stats = stats.slice(0, 5);

    // Générer le HTML pour le Top 5
    topStatsContainer.innerHTML = createStatsTableHTML(top5Stats, false);

    // Générer le HTML pour le tableau complet (dans le Collapse)
    fullStatsContainer.innerHTML = createStatsTableHTML(stats, true);
  } catch (error) {
    console.error("Erreur lors de l'affichage des statistiques:", error);
    topStatsContainer.innerHTML = `<p class="text-danger">Erreur: Impossible de charger les analyses (${error.message}).</p>`;
  }
}
const style = document.createElement("style");
style.innerHTML = `
    #stats-output table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    #stats-output th, #stats-output td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    #stats-output th { background-color: #f2f2f2; }
`;
document.head.appendChild(style);

function openModal() {
  pointModal.show();
}

function closeModal() {
  // Utiliser la méthode hide() de Bootstrap
  pointModal.hide();
  document.getElementById("point-form").reset();
  // Supprimer le marqueur temporaire si la modale est fermée
  if (tempMarker) map.removeLayer(tempMarker);
}

document.addEventListener("DOMContentLoaded", () => {
  // Écouteur pour le formulaire de soumission
  document
    .getElementById("point-form")
    .addEventListener("submit", function (e) {
      e.preventDefault(); // Empêcher l'envoi classique du formulaire

      // Récupérer les valeurs des champs
      const id = document.getElementById("point-id").value;
      const lng = parseFloat(document.getElementById("point-lng").value);
      const lat = parseFloat(document.getElementById("point-lat").value);

      // Construire l'objet de données
      const data = {
        name: document.getElementById("point-name").value,
        cuisine: document.getElementById("point-cuisine").value,
        borough: document.getElementById("point-borough").value,
        address: {
          coord: {
            type: "Point",
            coordinates: [lng, lat], // [lng, lat]
          },
        },
        // Le champ grades est nécessaire pour ne pas générer d'erreur de validation MongoDB
        grades: [],
      };

      // Déterminer la méthode (PUT si ID présent, POST sinon)
      const method = id ? "PUT" : "POST";

      // Appel à la fonction qui envoie la requête à l'API
      submitPoint(data, id, method);

      closeModal();
    });
});

loadPoints();
displayStatistics();
