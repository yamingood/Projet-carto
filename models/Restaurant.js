const mongoose = require("mongoose");

const RestaurantSchema = new mongoose.Schema(
  {
    address: {
      coord: {
        type: {
          type: String,
          enum: ["Point"], // Doit être "Point" selon le standard GeoJSON
          required: true,
          default: "Point",
        },
        coordinates: {
          type: [Number], // Tableau [longitude, latitude]
          required: true,
        },
      },
      // J'ajoute ces champs souvent présents dans ce dataset (building, street, zipcode),
      // mais ils sont optionnels si votre base ne les a pas tous.
      building: String,
      street: String,
      zipcode: String,
    },
    borough: String,
    cuisine: String,
    grades: [
      {
        date: Date,
        grade: String,
        score: Number,
      },
    ],
    name: String,
    restaurant_id: String,
  },
  {
    // IMPORTANT : Force Mongoose à utiliser votre collection existante "restaurants"
    // au lieu de créer "restaurants" (au pluriel par défaut) qui serait vide.
    collection: "restaurants",
  }
);

// Création d'un index géospatial sur le champ de coordonnées.
// C'est OBLIGATOIRE pour pouvoir faire des recherches de type "$near" (bonus/analyse).
RestaurantSchema.index({ "address.coord": "2dsphere" });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
