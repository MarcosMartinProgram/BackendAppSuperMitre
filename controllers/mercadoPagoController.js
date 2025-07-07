//controllers/mercadoPagoController.js
const mercadopago = require("mercadopago").MercadoPagoConfig;
const { Preference } = require("mercadopago");
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

// Configurar Mercado Pago con la nueva versión del SDK
const client = new mercadopago({
    accessToken: MP_ACCESS_TOKEN
});

const crearPreferencia = async (req, res) => {
    try {
        const { carrito, plataforma } = req.body;

        let items = carrito.map(item => ({
            title: item.nombre,
            unit_price: Number(item.precio),
            quantity: item.cantidad,
            currency_id: "ARS"
        }));

        // URLs para web y app
        const webUrls = {
            success: "https://tusitio.com/success",
            failure: "https://tusitio.com/failure",
            pending: "https://tusitio.com/pending"
        };
        const appUrls = {
            success: "supermitreapp://congrats",
            failure: "supermitreapp://failure",
            pending: "supermitreapp://pending"
        };

        let preference = {
            items,
            back_urls: plataforma === "app" ? appUrls : webUrls,
            auto_return: "approved"
        };

        // Crear la preferencia con la nueva configuración
        const preferenceClient = new Preference(client);
        const response = await preferenceClient.create({ body: preference });

        res.json({ id: response.id });
    } catch (error) {
        console.error("Error al crear la preferencia:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { crearPreferencia };
