// utils/excelReader.js
const XLSX = require('xlsx');
const path = require('path');

/**
 * Lee un archivo Excel y devuelve todas las filas como objetos.
 * Cada objeto tiene las columnas como llaves.
 * 
 * @param {string} filePath - Ruta del archivo Excel.
 * @param {string} sheetName - Nombre de la hoja (tab).
 * @returns {Array<Object>} Lista de filas [{Columna1: valor, Columna2: valor, ...}]
 */
function getExcelData(filePath, sheetName) {
  const absolutePath = path.resolve(filePath);
  const workbook = XLSX.readFile(absolutePath);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`No se encontro la hoja "${sheetName}" en el archivo ${filePath}`);
  }

  // Convierte toda la hoja a JSON, con cada fila como objeto basado en el header
  const sheetData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (sheetData.length === 0) {
    throw new Error(`La hoja "${sheetName}" esta vacia`);
  }

  return sheetData;
}

module.exports = { getExcelData };
