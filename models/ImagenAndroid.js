const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Asegúrate de que la configuración de Sequelize está en este archivo

const ImagenAndroid = sequelize.define('ImagenAndroid', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    clave: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    valor: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'configuracion',
    timestamps: false
});

module.exports = ImagenAndroid;
