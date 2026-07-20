-- Migración: Agregar columnas de facturación electrónica AFIP a la tabla tickets
-- Ejecutar en MySQL: mysql -u cacmarcos -p cacmarcos_supermitre < migrate-afip-columns.js
-- O copiar y pegar en phpMyAdmin de Alwaysdata

ALTER TABLE `tickets`
  ADD COLUMN `cae` VARCHAR(14) DEFAULT NULL COMMENT 'CAE - Código de Autorización Electrónico' AFTER `estado`,
  ADD COLUMN `vencimiento_cae` VARCHAR(8) DEFAULT NULL COMMENT 'Fecha vencimiento CAE (YYYYMMDD)' AFTER `cae`,
  ADD COLUMN `tipo_comprobante_afip` INT DEFAULT NULL COMMENT 'Tipo comprobante AFIP: 1=FactA, 6=FactB, 11=FactC' AFTER `vencimiento_cae`,
  ADD COLUMN `numero_comprobante_afip` INT DEFAULT NULL COMMENT 'Número comprobante autorizado por AFIP' AFTER `tipo_comprobante_afip`,
  ADD COLUMN `qr_afip_url` TEXT DEFAULT NULL COMMENT 'URL del QR verificable ARCA' AFTER `numero_comprobante_afip`;
