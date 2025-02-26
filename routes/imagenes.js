// routes/imagenes.js
const express = require("express");
const router = express.Router();
const db = require("../config/database"); // Conexión a MySQL

router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT tipo, url FROM imagenes"); 
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener imágenes" });
    }
});

module.exports = router;
