# Projet Cartographique Restaurants – M2 MIAGE (Yamin GOUDOU & Rama CALIXTE)

Application web cartographique permettant de visualiser et d’analyser des restaurants sur une carte interactive.

Fonctionnalités principales :

- Affichage des restaurants sur une carte (**Leaflet** + clustering).
- Filtre par **type de cuisine** et **intervalle de score d’inspection**.
- **Heatmap** en fonction des scores.
- Mode **proximité** (restaurants autour d’un point cliqué sur la carte).
- **Tableau** listant les restaurants filtrés.
- **Statistiques** et graphiques (Chart.js) par type de cuisine.
- Gestion des données via une API REST (CRUD).

---

## 1. Prérequis

- **Node.js** (version moderne recommandée, ≥ 18.x).
- **npm** (installé avec Node).
- **MongoDB** en local ou accessible via une URL.

Le projet utilise les librairies suivantes côté backend :

- `express`
- `mongoose`
- `cors`

Et côté frontend :

- **Leaflet** (+ `leaflet.markercluster`, `leaflet.heat`)
- **Bootstrap 5**
- **Chart.js**

---

