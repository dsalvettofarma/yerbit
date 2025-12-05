// API Gateway para centralizar todas las funcionalidades de Nova
// Reemplaza las llamadas directas a Google Apps Script

import { sheets, withRetry } from "./_lib/google-sheets.js";

// IDs de las hojas de cálculo (migrados desde Apps Script)
const SPREADSHEET_IDS = {
  TOKENS: "1mCzYzEruqrgoEQvmz7l5qIA4v-fRVkSkScXW5swNvnM",
  ALERTAS: "1L1KvMg-rD3Lq90e5lMW-KZhg-dHOrsF-pa5SnlhZ-WI",
  FRAUDES: "12mgWvEzfvBi6eYqDmY_Jmpdb00lp4r1FWvERuVhM7gY",
  WHITELIST: "12mgWvEzfvBi6eYqDmY_Jmpdb00lp4r1FWvERuVhM7gY", // TODO: Crear nueva hoja de cálculo para whitelist
  INSPECTOR: "1SBniJctF3j2nMt4M1IQWFkvjsKhCqJ_h6kqEtcvGdsg",
};

const SHEET_NAMES = {
  SESSIONS: "Sessions",
  ALERTAS: "Alertas",
  LOG_EJECUCIONES: "Log Ejecuciones",
  CONFIG_ALERTAS: "ConfiguracionAlertas",
  FRAUDES: "Fraudes",
  WHITELIST: "Whitelist",
};

// Cache temporal para sesiones (igual que en auth.js)
const sessionCache = new Map();

/**
 * Genera una fecha en formato DD/MM/YYYY HH:MM en zona horaria UTC-3 (Uruguay/Brasil)
 */
function getUTC3Date() {
  const now = new Date();
  // Convertir a UTC y luego restar 3 horas para UTC-3
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const utcMinus3 = new Date(utcTime + -3 * 3600000);

  const day = String(utcMinus3.getDate()).padStart(2, "0");
  const month = String(utcMinus3.getMonth() + 1).padStart(2, "0");
  const year = utcMinus3.getFullYear();
  const hours = String(utcMinus3.getHours()).padStart(2, "0");
  const minutes = String(utcMinus3.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Verifica token de sesión para operaciones autenticadas
 */
async function verificarSesion(email, token) {
  const cacheKey = `${email}:${token}`;
  const cached = sessionCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < 8 * 60 * 60 * 1000) {
    return cached.data;
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.TOKENS,
      range: `${SHEET_NAMES.SESSIONS}!A:C`,
    });

    const rows = response.data.values || [];
    const now = new Date();

    for (let i = 1; i < rows.length; i++) {
      const [e, t, ts] = rows[i];
      if (e === email && t === token) {
        const tokenTime = new Date(ts);
        const diffHours = (now - tokenTime) / (1000 * 60 * 60);

        if (diffHours <= 8) {
          const sessionData = { valid: true, email, token, timestamp: ts };
          sessionCache.set(cacheKey, {
            data: sessionData,
            timestamp: Date.now(),
          });
          return sessionData;
        }
      }
    }

    return { valid: false };
  } catch (error) {
    console.error("Error verificando sesión:", error);
    return { valid: false };
  }
}

/**
 * MÓDULO: ALERTAS
 */
async function handleAlertas(action, params) {
  switch (action) {
    case "getConfig":
      return await getConfigAlertas();
    case "updateConfig":
      return await updateConfigAlertas(params);
    case "getAlertas":
      return await getAlertas();
    case "addAlert":
      return await addAlert(params);
    default:
      throw new Error(`Acción no válida para alertas: ${action}`);
  }
}

async function getConfigAlertas() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.ALERTAS,
      range: `${SHEET_NAMES.CONFIG_ALERTAS}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { data: [] };

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return { success: true, data };
  } catch (error) {
    console.error("Error obteniendo configuración de alertas:", error);
    throw new Error("Error obteniendo configuración de alertas");
  }
}

async function updateConfigAlertas(params) {
  // Implementar actualización de configuración
  // Requiere más lógica específica basada en la estructura actual
  return { success: true, message: "Configuración actualizada" };
}

async function getAlertas() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.ALERTAS,
      range: `${SHEET_NAMES.ALERTAS}!A:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { data: [] };

    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return { success: true, data };
  } catch (error) {
    console.error("Error obteniendo alertas:", error);
    throw new Error("Error obteniendo alertas");
  }
}

async function addAlert(params) {
  try {
    const { asunto, mensaje, fecha = getUTC3Date() } = params;

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.ALERTAS,
      range: `${SHEET_NAMES.ALERTAS}!A:C`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[asunto, mensaje, fecha]],
      },
    });

    return { success: true, message: "Alerta agregada correctamente" };
  } catch (error) {
    console.error("Error agregando alerta:", error);
    throw new Error("Error agregando alerta");
  }
}

/**
 * MÓDULO: FRAUDES
 */
async function handleFraudes(action, params) {
  switch (action) {
    case "list":
      return await getFraudes();
    case "add":
      return await addFraude(params);
    default:
      throw new Error(`Acción no válida para fraudes: ${action}`);
  }
}

async function getFraudes() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.FRAUDES,
      range: `${SHEET_NAMES.FRAUDES}!A:Z`,
    });

    return { success: true, data: response.data.values || [] };
  } catch (error) {
    console.error("Error obteniendo fraudes:", error);
    throw new Error("Error obteniendo fraudes");
  }
}

async function addFraude(params) {
  try {
    const {
      documento = "",
      correo = "",
      nombre = "",
      comentarios = "",
      logueado = "",
    } = params;

    // Verificar duplicados
    const existing = await getFraudes();
    const data = existing.data || [];

    let yaExiste = false;
    for (let i = 1; i < data.length; i++) {
      const docExistente = (data[i][0] || "").toString().trim();
      const correoExistente = (data[i][1] || "")
        .toString()
        .trim()
        .toLowerCase();

      if (documento === "No logueado") {
        if (correoExistente === correo.toLowerCase()) {
          yaExiste = true;
          break;
        }
      } else {
        if (
          docExistente === documento ||
          correoExistente === correo.toLowerCase()
        ) {
          yaExiste = true;
          break;
        }
      }
    }

    if (yaExiste) {
      return {
        success: false,
        message: "Ya existe un registro con ese documento o correo.",
      };
    }

    // Agregar nuevo registro con fecha en UTC-3
    const fecha = getUTC3Date();

    // Eliminar campo "apellido" y sanitizar todos los campos
    const sanitizeField = (field) =>
      String(field || "")
        .replace(/\r?\n|\r/g, " ")
        .trim();

    const documentoSanitized = sanitizeField(documento);
    const correoSanitized = sanitizeField(correo);
    const nombreSanitized = sanitizeField(nombre);
    const comentariosSanitized = sanitizeField(comentarios);
    const fechaSanitized = sanitizeField(fecha);
    const logueadoSanitized = sanitizeField(logueado);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.FRAUDES,
      range: `${SHEET_NAMES.FRAUDES}!A:F`, // Ajustar rango a 6 columnas
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            documentoSanitized,
            correoSanitized,
            nombreSanitized,
            comentariosSanitized,
            fechaSanitized,
            logueadoSanitized,
          ],
        ],
      },
    });

    return { success: true, message: "Registro agregado correctamente." };
  } catch (error) {
    console.error("Error agregando fraude:", error);
    throw new Error("Error agregando fraude");
  }
}

/**
 * MÓDULO: WHITELIST
 */
async function handleWhitelist(action, params) {
  switch (action) {
    case "list":
      return await getWhitelist();
    case "add":
      return await addWhitelist(params);
    default:
      throw new Error(`Acción no válida para whitelist: ${action}`);
  }
}

async function getWhitelist() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_IDS.WHITELIST,
      range: `${SHEET_NAMES.WHITELIST}!A:K`, // A-K = 11 columnas
    });

    return { success: true, data: response.data.values || [] };
  } catch (error) {
    console.error("Error obteniendo whitelist:", error);
    throw new Error("Error obteniendo whitelist");
  }
}

async function addWhitelist(params) {
  try {
    const {
      documento = "",
      correo = "",
      nombre = "",
      telefono = "",
      direccion = "",
      tarjeta1 = "",
      tarjeta2 = "",
      tarjeta3 = "",
      tarjeta4 = "",
      comentarios = "",
    } = params;

    // Verificar duplicados por documento o correo
    const existing = await getWhitelist();
    const data = existing.data || [];

    let yaExiste = false;
    for (let i = 1; i < data.length; i++) {
      const docExistente = (data[i][0] || "").toString().trim();
      const correoExistente = (data[i][1] || "")
        .toString()
        .trim()
        .toLowerCase();

      if (
        docExistente === documento ||
        correoExistente === correo.toLowerCase()
      ) {
        yaExiste = true;
        break;
      }
    }

    if (yaExiste) {
      return {
        success: false,
        message:
          "Ya existe un cliente con ese documento o correo en la whitelist.",
      };
    }

    // Agregar nuevo registro con fecha en UTC-3
    const fecha = getUTC3Date();

    // Sanitizar todos los campos
    const sanitizeField = (field) =>
      String(field || "")
        .replace(/\r?\n|\r/g, " ")
        .trim();

    const documentoSanitized = sanitizeField(documento);
    const correoSanitized = sanitizeField(correo);
    const nombreSanitized = sanitizeField(nombre);
    const telefonoSanitized = sanitizeField(telefono);
    const direccionSanitized = sanitizeField(direccion);
    const tarjeta1Sanitized = sanitizeField(tarjeta1);
    const tarjeta2Sanitized = sanitizeField(tarjeta2);
    const tarjeta3Sanitized = sanitizeField(tarjeta3);
    const tarjeta4Sanitized = sanitizeField(tarjeta4);
    const fechaSanitized = sanitizeField(fecha);
    const comentariosSanitized = sanitizeField(comentarios);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.WHITELIST,
      range: `${SHEET_NAMES.WHITELIST}!A:K`, // A-K = 11 columnas
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            documentoSanitized,
            correoSanitized,
            nombreSanitized,
            telefonoSanitized,
            direccionSanitized,
            tarjeta1Sanitized,
            tarjeta2Sanitized,
            tarjeta3Sanitized,
            tarjeta4Sanitized,
            fechaSanitized,
            comentariosSanitized,
          ],
        ],
      },
    });

    return {
      success: true,
      message: "Cliente agregado a la whitelist correctamente.",
    };
  } catch (error) {
    console.error("Error agregando a whitelist:", error);
    throw new Error("Error agregando a whitelist");
  }
}

/**
 * MÓDULO: INSPECTOR
 */
async function handleInspector(action, params) {
  switch (action) {
    case "ping":
      // Respuesta rápida para comprobar que el gateway responde (no toca Google Sheets)
      return { success: true, message: "pong" };
    case "getSheets":
      return await getSheets(params.spreadsheetId);
    case "getMeta":
      return await getMeta(params);
    case "getRange":
      return await getRange(params);
    case "search":
      return await searchInSheet(params);
    case "getData":
      return await getSheetData(params);
    default:
      throw new Error(`Acción no válida para inspector: ${action}`);
  }
}

async function getSheets(spreadsheetId = SPREADSHEET_IDS.INSPECTOR) {
  // Handler robusto para obtener nombres de hojas
  if (!spreadsheetId) {
    console.error("getSheets: spreadsheetId undefined or empty");
    return { success: false, message: "Spreadsheet ID no definido" };
  }

  try {
    console.log(
      `getSheets: solicitando metadata del spreadsheetId=${spreadsheetId}`
    );
    const response = await withRetry(() =>
      sheets.spreadsheets.get({ spreadsheetId })
    );

    if (!response || !response.data || !Array.isArray(response.data.sheets)) {
      console.error(
        "getSheets: respuesta inesperada de Google Sheets:",
        response && response.data
      );
      return { success: false, message: "Respuesta inválida de Google Sheets" };
    }

    // Extraer solo los nombres de las hojas para mantener compatibilidad con el frontend
    const sheetNames = response.data.sheets.map(
      (sheet) => sheet.properties.title || ""
    );

    console.log(
      `📋 Hojas obtenidas (${sheetNames.length}): ${sheetNames.join(", ")}`
    );

    // Devolver en el formato que espera el frontend
    return { success: true, sheets: sheetNames };
  } catch (error) {
    // Mejor logging y devolver objeto de error en lugar de lanzar excepción genérica
    console.error(
      "❌ getSheets - Error obteniendo hojas para spreadsheetId=",
      spreadsheetId,
      error
    );

    // Distinción de errores comunes
    const msg = error && error.message ? error.message : String(error);
    // Si es un error de permisos o credenciales, incluir pista útil
    if (
      msg.includes("permission") ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("forbidden")
    ) {
      console.error(
        "getSheets: posible problema de permisos/credenciales. Verificar GOOGLE_CLIENT_EMAIL y que la cuenta tenga acceso al spreadsheet."
      );
    }

    return {
      success: false,
      message: "Error obteniendo hojas del spreadsheet",
      detail: msg,
    };
  }
}

async function searchInSheet(params) {
  const startTime = Date.now();
  try {
    const {
      spreadsheetId = SPREADSHEET_IDS.INSPECTOR,
      sheet,
      column,
      value,
      matchType = "contains",
    } = params;

    console.log(`🔍 Iniciando búsqueda en hoja: ${sheet}`);

    // Obtener metadatos de la hoja con retry
    const sheetMeta = await withRetry(() =>
      sheets.spreadsheets.get({ spreadsheetId })
    );

    const sheetInfo = sheetMeta.data.sheets.find(
      (s) => s.properties.title === sheet
    );
    if (!sheetInfo) throw new Error(`Hoja '${sheet}' no encontrada`);

    const rowCount = sheetInfo.properties.gridProperties.rowCount || 1000;
    const lastColIndex = sheetInfo.properties.gridProperties.columnCount;

    // Convertir índice a letra de columna (A, B, ..., Z, AA, AB, ...)
    function colIdxToLetter(idx) {
      let letter = "";
      while (idx > 0) {
        let rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    }
    const lastColLetter = colIdxToLetter(lastColIndex);

    console.log(`📊 Hoja tiene ${rowCount} filas y ${lastColIndex} columnas`);

    // Para hojas muy grandes (>10k filas), usar chunking
    const CHUNK_SIZE = 10000;
    let rows = [];

    if (rowCount > CHUNK_SIZE) {
      console.log(`⚡ Hoja grande detectada, usando chunking...`);
      const numChunks = Math.ceil(rowCount / CHUNK_SIZE);

      for (let i = 0; i < numChunks; i++) {
        const startRow = i * CHUNK_SIZE + 1;
        const endRow = Math.min((i + 1) * CHUNK_SIZE, rowCount);
        const range = `${sheet}!A${startRow}:${lastColLetter}${endRow}`;

        console.log(`📦 Cargando chunk ${i + 1}/${numChunks}: ${range}`);

        const chunkResponse = await withRetry(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
          })
        );

        if (chunkResponse.data.values) {
          rows = rows.concat(chunkResponse.data.values);
        }
      }

      // Si es el primer chunk, obtener headers separadamente
      const headerResponse = await withRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheet}!A1:${lastColLetter}1`,
        })
      );

      if (headerResponse.data.values && headerResponse.data.values[0]) {
        rows.unshift(headerResponse.data.values[0]);
      }
    } else {
      // Hoja pequeña, obtener todo de una vez
      const range = `${sheet}!A:${lastColLetter}`;
      console.log(`📄 Hoja normal, cargando todo: ${range}`);

      const response = await withRetry(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        })
      );

      rows = response.data.values || [];
    }

    if (rows.length < 2) {
      console.log(`⚠️ No hay datos suficientes en la hoja`);
      return { headers: [], results: [] };
    }

    const headers = rows[0];
    let results = [];

    if (column === "todos" && value === "__all__") {
      // Devolver todos los datos como matriz de arrays (no objetos)
      results = rows.slice(1);
      console.log(`✅ Retornando ${results.length} filas completas`);
    } else {
      // Búsqueda específica
      const columnIndex = headers.indexOf(column);
      if (columnIndex === -1) {
        throw new Error(`Columna '${column}' no encontrada`);
      }

      console.log(
        `🔎 Filtrando por columna: ${column} (índice ${columnIndex})`
      );

      results = rows.slice(1).filter((row) => {
        const cellValue = (row[columnIndex] || "").toString().toLowerCase();
        const searchValue = value.toLowerCase();

        switch (matchType) {
          case "exact":
            return cellValue === searchValue;
          case "starts":
            return cellValue.startsWith(searchValue);
          case "ends":
            return cellValue.endsWith(searchValue);
          case "contains":
          default:
            return cellValue.includes(searchValue);
        }
      });

      console.log(`✅ Encontradas ${results.length} filas que coinciden`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Búsqueda completada en ${elapsed}s`);

    // Devolver en el formato que espera el frontend: { headers: [], results: [] }
    return { headers, results };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ Error en búsqueda después de ${elapsed}s:`, error);

    // Proporcionar mensaje de error más útil
    if (error.code === 504 || error.message.includes("timeout")) {
      throw new Error(
        "La hoja es muy grande y tardó demasiado. Intenta filtrar por fecha o refresca la página."
      );
    } else if (error.code === 503) {
      throw new Error(
        "Servicio temporalmente no disponible. Por favor, intenta de nuevo en unos segundos."
      );
    } else {
      throw new Error(`Error en búsqueda: ${error.message}`);
    }
  }
}

async function getSheetData(params) {
  try {
    const {
      spreadsheetId = SPREADSHEET_IDS.INSPECTOR,
      sheet,
      range = "A:Z",
    } = params;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet}!${range}`,
    });

    return { success: true, data: response.data.values || [] };
  } catch (error) {
    console.error("Error obteniendo datos de hoja:", error);
    throw new Error("Error obteniendo datos de hoja");
  }
}

// Obtener metadatos: headers (fila 1) y totalRows (sin contar header)
async function getMeta(params) {
  const { sheet, spreadsheetId = SPREADSHEET_IDS.INSPECTOR } = params || {};
  if (!sheet) {
    console.error("getMeta: falta parámetro 'sheet'");
    return { success: false, message: "Parámetro 'sheet' requerido" };
  }

  try {
    // Obtener metadata de la hoja para conocer columnas y filas
    const metaResponse = await withRetry(() =>
      sheets.spreadsheets.get({ spreadsheetId })
    );

    if (
      !metaResponse ||
      !metaResponse.data ||
      !Array.isArray(metaResponse.data.sheets)
    ) {
      console.error(
        "getMeta: respuesta inválida de spreadsheets.get",
        metaResponse && metaResponse.data
      );
      return { success: false, message: "Respuesta inválida de Google Sheets" };
    }

    const sheetInfo = metaResponse.data.sheets.find(
      (s) => s.properties.title === sheet
    );
    if (!sheetInfo) {
      console.error(
        `getMeta: Hoja '${sheet}' no encontrada en spreadsheet ${spreadsheetId}`
      );
      return { success: false, message: `Hoja '${sheet}' no encontrada` };
    }

    const lastColIndex = sheetInfo.properties.gridProperties.columnCount || 26;
    const rowCount = sheetInfo.properties.gridProperties.rowCount || 0;

    // Convertir índice de columna a letra (A, B, ..., Z, AA, AB...)
    function colIdxToLetter(idx) {
      let letter = "";
      while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    }

    const lastColLetter = colIdxToLetter(lastColIndex);

    // Obtener solo la fila de headers
    const headerRange = `${sheet}!A1:${lastColLetter}1`;
    const headerResp = await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId, range: headerRange })
    );

    const headers =
      (headerResp &&
        headerResp.data &&
        headerResp.data.values &&
        headerResp.data.values[0]) ||
      [];

    // totalRows: número de filas de datos (sin contar header)
    const totalRows = Math.max(0, rowCount - 1);

    return { success: true, headers, totalRows };
  } catch (error) {
    console.error("getMeta - Error obteniendo metadata:", error);
    return {
      success: false,
      message: "Error obteniendo metadata de la hoja",
      detail: error && error.message,
    };
  }
}

// Obtener rango de filas: start..end (ambos inclusive). Devuelve rows como arrays.
async function getRange(params) {
  const {
    sheet,
    start,
    end,
    spreadsheetId = SPREADSHEET_IDS.INSPECTOR,
  } = params || {};
  if (!sheet) {
    console.error("getRange: falta parámetro 'sheet'");
    return { success: false, message: "Parámetro 'sheet' requerido" };
  }
  if (typeof start === "undefined" || typeof end === "undefined") {
    console.error("getRange: faltan 'start' o 'end'");
    return { success: false, message: "Parámetros 'start' y 'end' requeridos" };
  }

  try {
    // Necesitamos conocer la última columna para construir el rango
    const metaResponse = await withRetry(() =>
      sheets.spreadsheets.get({ spreadsheetId })
    );

    const sheetInfo = metaResponse.data.sheets.find(
      (s) => s.properties.title === sheet
    );
    if (!sheetInfo) {
      console.error(
        `getRange: Hoja '${sheet}' no encontrada en spreadsheet ${spreadsheetId}`
      );
      return { success: false, message: `Hoja '${sheet}' no encontrada` };
    }

    const lastColIndex = sheetInfo.properties.gridProperties.columnCount || 26;

    function colIdxToLetter(idx) {
      let letter = "";
      while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    }

    const lastColLetter = colIdxToLetter(lastColIndex);
    const range = `${sheet}!A${start}:${lastColLetter}${end}`;

    console.log(
      `getRange: solicitando rango ${range} en spreadsheet ${spreadsheetId}`
    );

    const resp = await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId, range })
    );

    const rows = resp && resp.data && resp.data.values ? resp.data.values : [];
    return { success: true, rows };
  } catch (error) {
    console.error("getRange - Error obteniendo rango:", error);
    return {
      success: false,
      message: "Error obteniendo rango de la hoja",
      detail: error && error.message,
    };
  }
}

/**
 * HANDLER PRINCIPAL
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    const { module, action, ...params } =
      req.method === "GET" ? req.query : req.body;

    if (!module || !action) {
      return res.status(400).json({
        success: false,
        message: "Se requieren parámetros module y action",
      });
    }

    // Verificar autenticación para módulos que lo requieren
    const authRequiredModules = ["alertas"];
    if (authRequiredModules.includes(module)) {
      const { email, token } = params;
      if (!email || !token) {
        return res.status(401).json({
          success: false,
          message: "Se requiere autenticación (email y token)",
        });
      }

      const session = await verificarSesion(email, token);
      if (!session.valid) {
        return res.status(401).json({
          success: false,
          message: "Sesión inválida o expirada",
        });
      }
    }

    let result;

    switch (module) {
      case "alertas":
        result = await handleAlertas(action, params);
        break;
      case "fraudes":
        result = await handleFraudes(action, params);
        break;
      case "whitelist":
        result = await handleWhitelist(action, params);
        break;
      case "inspector":
        result = await handleInspector(action, params);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Módulo no válido: ${module}`,
        });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error en API Gateway:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error interno del servidor",
    });
  }
}
