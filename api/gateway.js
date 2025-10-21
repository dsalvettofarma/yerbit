// API Gateway para centralizar todas las funcionalidades de Nova
// Reemplaza las llamadas directas a Google Apps Script

import { sheets } from './_lib/google-sheets.js';

// IDs de las hojas de cálculo (migrados desde Apps Script)
const SPREADSHEET_IDS = {
  TOKENS: '1mCzYzEruqrgoEQvmz7l5qIA4v-fRVkSkScXW5swNvnM',
  ALERTAS: '1L1KvMg-rD3Lq90e5lMW-KZhg-dHOrsF-pa5SnlhZ-WI',
  FRAUDES: '12mgWvEzfvBi6eYqDmY_Jmpdb00lp4r1FWvERuVhM7gY',
  INSPECTOR: '1SBniJctF3j2nMt4M1IQWFkvjsKhCqJ_h6kqEtcvGdsg' 
};

const SHEET_NAMES = {
  SESSIONS: 'Sessions',
  ALERTAS: 'Alertas',
  LOG_EJECUCIONES: 'Log Ejecuciones',
  CONFIG_ALERTAS: 'ConfiguracionAlertas',
  FRAUDES: 'Fraudes'
};

// Cache temporal para sesiones (igual que en auth.js)
const sessionCache = new Map();

/**
 * Genera una fecha en formato DD/MM/YYYY HH:MM en zona horaria UTC-3 (Uruguay/Brasil)
 */
function getUTC3Date() {
  const now = new Date();
  // Convertir a UTC y luego restar 3 horas para UTC-3
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const utcMinus3 = new Date(utcTime + (-3 * 3600000));
  
  const day = String(utcMinus3.getDate()).padStart(2, '0');
  const month = String(utcMinus3.getMonth() + 1).padStart(2, '0');
  const year = utcMinus3.getFullYear();
  const hours = String(utcMinus3.getHours()).padStart(2, '0');
  const minutes = String(utcMinus3.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Verifica token de sesión para operaciones autenticadas
 */
async function verificarSesion(email, token) {
  const cacheKey = `${email}:${token}`;
  const cached = sessionCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < 8 * 60 * 60 * 1000) {
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
          sessionCache.set(cacheKey, { data: sessionData, timestamp: Date.now() });
          return sessionData;
        }
      }
    }
    
    return { valid: false };
  } catch (error) {
    console.error('Error verificando sesión:', error);
    return { valid: false };
  }
}

/**
 * MÓDULO: ALERTAS
 */
async function handleAlertas(action, params) {
  switch (action) {
    case 'getConfig':
      return await getConfigAlertas();
    case 'updateConfig':
      return await updateConfigAlertas(params);
    case 'getAlertas':
      return await getAlertas();
    case 'addAlert':
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
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error obteniendo configuración de alertas:', error);
    throw new Error('Error obteniendo configuración de alertas');
  }
}

async function updateConfigAlertas(params) {
  // Implementar actualización de configuración
  // Requiere más lógica específica basada en la estructura actual
  return { success: true, message: 'Configuración actualizada' };
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
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    throw new Error('Error obteniendo alertas');
  }
}

async function addAlert(params) {
  try {
    const { asunto, mensaje, fecha = getUTC3Date() } = params;
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.ALERTAS,
      range: `${SHEET_NAMES.ALERTAS}!A:C`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[asunto, mensaje, fecha]]
      }
    });

    return { success: true, message: 'Alerta agregada correctamente' };
  } catch (error) {
    console.error('Error agregando alerta:', error);
    throw new Error('Error agregando alerta');
  }
}

/**
 * MÓDULO: FRAUDES
 */
async function handleFraudes(action, params) {
  switch (action) {
    case 'list':
      return await getFraudes();
    case 'add':
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
    console.error('Error obteniendo fraudes:', error);
    throw new Error('Error obteniendo fraudes');
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
      const correoExistente = (data[i][1] || "").toString().trim().toLowerCase();
      
      if (documento === "No logueado") {
        if (correoExistente === correo.toLowerCase()) {
          yaExiste = true;
          break;
        }
      } else {
        if (docExistente === documento || correoExistente === correo.toLowerCase()) {
          yaExiste = true;
          break;
        }
      }
    }

    if (yaExiste) {
      return { 
        success: false, 
        message: "Ya existe un registro con ese documento o correo." 
      };
    }

    // Agregar nuevo registro con fecha en UTC-3
    const fecha = getUTC3Date();

    // Eliminar campo "apellido" y sanitizar todos los campos
    const sanitizeField = (field) => String(field || '').replace(/\r?\n|\r/g, ' ').trim();

    const documentoSanitized = sanitizeField(documento);
    const correoSanitized = sanitizeField(correo);
    const nombreSanitized = sanitizeField(nombre);
    const comentariosSanitized = sanitizeField(comentarios);
    const fechaSanitized = sanitizeField(fecha);
    const logueadoSanitized = sanitizeField(logueado);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_IDS.FRAUDES,
      range: `${SHEET_NAMES.FRAUDES}!A:F`, // Ajustar rango a 6 columnas
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          documentoSanitized,
          correoSanitized,
          nombreSanitized,
          comentariosSanitized,
          fechaSanitized,
          logueadoSanitized
        ]]
      }
    });

    return { success: true, message: "Registro agregado correctamente." };
  } catch (error) {
    console.error('Error agregando fraude:', error);
    throw new Error('Error agregando fraude');
  }
}

/**
 * MÓDULO: INSPECTOR
 */
async function handleInspector(action, params) {
  switch (action) {
    case 'getSheets':
      return await getSheets(params.spreadsheetId);
    case 'search':
      return await searchInSheet(params);
    case 'getData':
      return await getSheetData(params);
    default:
      throw new Error(`Acción no válida para inspector: ${action}`);
  }
}

async function getSheets(spreadsheetId = SPREADSHEET_IDS.INSPECTOR) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });

    // Extraer solo los nombres de las hojas para mantener compatibilidad con el frontend
    const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);

    // Devolver en el formato que espera el frontend
    return { sheets: sheetNames };
  } catch (error) {
    console.error('Error obteniendo hojas:', error);
    throw new Error('Error obteniendo hojas del spreadsheet');
  }
}

async function searchInSheet(params) {
  try {
    const { spreadsheetId = SPREADSHEET_IDS.INSPECTOR, sheet, column, value, matchType = 'contains' } = params;

    // Obtener metadatos de la hoja para saber la última columna
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetInfo = sheetMeta.data.sheets.find(s => s.properties.title === sheet);
    if (!sheetInfo) throw new Error(`Hoja '${sheet}' no encontrada`);
    const lastColIndex = sheetInfo.properties.gridProperties.columnCount;
    // Convertir índice a letra de columna (A, B, ..., Z, AA, AB, ...)
    function colIdxToLetter(idx) {
      let letter = '';
      while (idx > 0) {
        let rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
      }
      return letter;
    }
    const lastColLetter = colIdxToLetter(lastColIndex);
    const range = `${sheet}!A:${lastColLetter}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) return { headers: [], results: [] };

    const headers = rows[0];
    let results = [];

    if (column === 'todos' && value === '__all__') {
      // Devolver todos los datos como matriz de arrays (no objetos)
      results = rows.slice(1);
    } else {
      // Búsqueda específica
      const columnIndex = headers.indexOf(column);
      if (columnIndex === -1) {
        throw new Error(`Columna '${column}' no encontrada`);
      }

      results = rows.slice(1).filter(row => {
        const cellValue = (row[columnIndex] || '').toString().toLowerCase();
        const searchValue = value.toLowerCase();
        
        switch (matchType) {
          case 'exact':
            return cellValue === searchValue;
          case 'starts':
            return cellValue.startsWith(searchValue);
          case 'ends':
            return cellValue.endsWith(searchValue);
          case 'contains':
          default:
            return cellValue.includes(searchValue);
        }
      });
    }

    // Devolver en el formato que espera el frontend: { headers: [], results: [] }
    return { headers, results };
  } catch (error) {
    console.error('Error en búsqueda:', error);
    throw new Error('Error en búsqueda');
  }
}

async function getSheetData(params) {
  try {
    const { spreadsheetId = SPREADSHEET_IDS.INSPECTOR, sheet, range = 'A:Z' } = params;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet}!${range}`,
    });

    return { success: true, data: response.data.values || [] };
  } catch (error) {
    console.error('Error obteniendo datos de hoja:', error);
    throw new Error('Error obteniendo datos de hoja');
  }
}

/**
 * HANDLER PRINCIPAL
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { module, action, ...params } = req.method === 'GET' ? req.query : req.body;
    
    if (!module || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requieren parámetros module y action' 
      });
    }

    // Verificar autenticación para módulos que lo requieren
    const authRequiredModules = ['alertas'];
    if (authRequiredModules.includes(module)) {
      const { email, token } = params;
      if (!email || !token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Se requiere autenticación (email y token)' 
        });
      }

      const session = await verificarSesion(email, token);
      if (!session.valid) {
        return res.status(401).json({ 
          success: false, 
          message: 'Sesión inválida o expirada' 
        });
      }
    }

    let result;
    
    switch (module) {
      case 'alertas':
        result = await handleAlertas(action, params);
        break;
      case 'fraudes':
        result = await handleFraudes(action, params);
        break;
      case 'inspector':
        result = await handleInspector(action, params);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: `Módulo no válido: ${module}` 
        });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error en API Gateway:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error interno del servidor' 
    });
  }
}
