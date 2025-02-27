// routes/imagenAndroidRoutes.js
const express = require('express');
const router = express.Router();
const Configuracion = require('../models/ImagenAndroid');
const ImagenAndroid = require('../models/ImagenAndroid');

// Ruta para obtener el logo y el banner
const { Op } = require('sequelize');

router.get('/imagenes', async (req, res) => {
    try {
        const imagenes = await ImagenAndroid.findAll({
            where: {
                clave: { [Op.in]: ['logo', 'baner'] } // ✅ Ahora sí filtra correctamente
            }
        });

        const respuesta = {};
        imagenes.forEach(img => {
            respuesta[img.clave] = img.valor;
        });

        res.json(respuesta);
    } catch (error) {
        console.error('Error al obtener las imágenes:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});


module.exports = router;
