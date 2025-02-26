const express = require('express');
const router = express.Router();
const Configuracion = require('../models/ImagenAndroid');
const ImagenAndroid = require('../models/ImagenAndroid');

// Ruta para obtener el logo y el banner
router.get('/imagenes', async (req, res) => {
    try {
        const imagenes = await ImagenAndroid.findAll({
            where: {
                clave: ['logo', 'baner']
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
