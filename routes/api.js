const express = require("express");
const router = express.Router();
const Restaurant = require("../models/Restaurant"); // Importez le modèle créé précédemment

// Middleware de gestion des erreurs (pour simplifier la logique des routes)
const handleError = (res, err) => {
  console.error(err);
  // Gestion correcte des erreurs HTTP [cite: 26]
  return res.status(500).json({
    message: "Erreur serveur interne",
    error: err.message,
  });
};

// ===================================
// 1. Routes CRUD /api/items
// ===================================

/**
 * GET /api/items
 * Renvoie tous les points (avec une limite raisonnable pour le front)[cite: 15].
 */
router.get("/items", async (req, res) => {
  try {
    // Limitation conseillée : Le jeu de données est très grand.
    // Vous pouvez ajuster cette limite ou ajouter une pagination/filtrage.
    const items = await Restaurant.find();
    res.status(200).json(items);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /api/items/:id
 * Renvoie un point spécifique[cite: 16, 19].
 */
router.get("/items/:id", async (req, res) => {
  try {
    const item = await Restaurant.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Point non trouvé" });
    }
    res.status(200).json(item);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /api/items
 * Ajoute un nouveau point[cite: 17, 20].
 */
router.post("/items", async (req, res) => {
  // Validation minimale des données requise[cite: 25].
  if (
    !req.body.name ||
    !req.body.cuisine ||
    !req.body.address ||
    !req.body.address.coord
  ) {
    return res
      .status(400)
      .json({ message: "Les champs Nom, Cuisine et Coordonnées sont requis." });
  }

  try {
    const newItem = new Restaurant(req.body);
    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * PUT /api/items/:id
 * Modifie un point existant[cite: 18, 21].
 */
router.put("/items/:id", async (req, res) => {
  try {
    const updatedItem = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // Renvoie le document mis à jour et lance les validations du schéma
    );
    if (!updatedItem) {
      return res.status(404).json({ message: "Point non trouvé" });
    }
    res.status(200).json(updatedItem);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * DELETE /api/items/:id
 * Supprime un point[cite: 23].
 */
router.delete("/items/:id", async (req, res) => {
  try {
    const deletedItem = await Restaurant.findByIdAndDelete(req.params.id);
    if (!deletedItem) {
      return res.status(404).json({ message: "Point non trouvé" });
    }
    res
      .status(200)
      .json({ message: "Point supprimé avec succès", item: deletedItem });
  } catch (err) {
    handleError(res, err);
  }
});

// ===================================
// 2. Routes d'Analyses Statistiques
// ===================================

/**
 * GET /api/stats/scores-by-cuisine
 * Exemple d'analyse : Score moyen par type de cuisine[cite: 70].
 */
router.get("/stats/scores-by-cuisine", async (req, res) => {
  try {
    const stats = await Restaurant.aggregate([
      // 1. Dérouler le tableau des grades
      { $unwind: "$grades" },
      // 2. Grouper par cuisine et calculer la moyenne du score
      {
        $group: {
          _id: "$cuisine",
          averageScore: { $avg: "$grades.score" },
          count: { $sum: 1 },
        },
      },
      // 3. Trier par score moyen décroissant
      { $sort: { averageScore: -1 } },
    ]);

    res.status(200).json(stats);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /api/stats/nearby-points
 * Exemple d'analyse : Recherche de points proches (requête géospatiale)[cite: 72].
 * Nécessite les paramètres de requête: ?lng=-73.856077&lat=40.848447&distance=1000
 */
router.get("/stats/nearby-points", async (req, res) => {
  const { lng, lat, distance = 400 } = req.query; // distance en mètres par défaut

  if (!lng || !lat) {
    return res
      .status(400)
      .json({ message: "Les paramètres 'lng' et 'lat' sont requis." });
  }

  try {
    const nearby = await Restaurant.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "dist.calculated", // Stocke la distance calculée ici
          maxDistance: parseInt(distance), // Distance maximale en mètres
          spherical: true, // Indique que la géométrie est sphérique (terre)
        },
      },
    ]);

    res.status(200).json(nearby);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
