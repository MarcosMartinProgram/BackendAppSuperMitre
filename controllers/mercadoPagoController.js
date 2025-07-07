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

        const isProd = process.env.NODE_ENV === "production";
        // URLs para web y app
        const webUrls = isProd
          ? {
              success: "https://supermitre.com.ar/success",
              failure: "https://supermitre.com.ar/failure",
              pending: "https://supermitre.com.ar/pending"
            }
          : {
              success: "http://localhost:3000/success",
              failure: "http://localhost:3000/failure",
              pending: "http://localhost:3000/pending"
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
