const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const apiRoutes = require("./routes/api");

const app = express();
const port = 3000;

// Configuration de la base de données
const connectionDB = "mongodb://localhost:27017/first-db";

mongoose
  .connect(connectionDB) // Plus besoin des options pour Mongoose v6+
  .then(() => {
    console.log("Connexion à la base réussie.");
  })
  .catch((err) => {
    console.error("Erreur de connexion à la base:", err);
  });
// Middlewares
app.use("/api", apiRoutes);
app.use(express.json());
app.use(express.static("public"));

// --- C'est ici que nous importerons les routes plus tard ---
// const apiRoutes = require('./routes/api');
// app.use('/api', apiRoutes);

// Démarrage du serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
