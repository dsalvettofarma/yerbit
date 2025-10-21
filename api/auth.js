import { sheets } from './_lib/google-sheets.js';
import { randomUUID } from 'crypto';

// IDs de tus hojas de cálculo
const SPREADSHEET_ID = '1mCzYzEruqrgoEQvmz7l5qIA4v-fRVkSkScXW5swNvnM'; // ID único para Auth

// Configuración
const MAX_INTENTOS = 5;

// Helper para enviar respuestas
const sendResponse = (res, statusCode, body) => {
  res.status(statusCode).json(body);
};

// Cache en memoria simple (solo mientras la función esté activa)
const memoryCache = {};

// Helper para guardar datos temporalmente
const setCache = (key, value, expirationSeconds = 300) => {
  const expiration = Date.now() + (expirationSeconds * 1000);
  memoryCache[key] = { value, expiration };
};

// Helper para obtener datos del cache
const getCache = (key) => {
  const item = memoryCache[key];
  if (!item) return null;
  if (Date.now() > item.expiration) {
    delete memoryCache[key];
    return null;
  }
  return item.value;
};

// Helper para eliminar del cache
const delCache = (key) => {
  delete memoryCache[key];
};

// Helper para buscar un usuario
async function buscarUsuario(email) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Usuarios!A:D', // Asume que las columnas son Email, Password, Rol, Nombre
    });
    const rows = response.data.values;
    if (!rows) return null;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase().trim() === email) {
        return {
          email: rows[i][0],
          password: rows[i][1],
          rol: rows[i][2],
          nombre: rows[i][3],
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error en buscarUsuario:', error);
    return null;
  }
}

// Helper para registrar un intento
async function registrarIntento(email, estado) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Logs!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), email, estado]],
      },
    });
  } catch (error) {
    console.error('Error en registrarIntento:', error);
  }
}

// --- Handler Principal ---
export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return sendResponse(res, 200, {});
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { status: 'error', message: 'Método no permitido' });
  }

  const { action, email: rawEmail, pass, code, token } = req.body;
  const email = (rawEmail || '').toLowerCase().trim();

  console.log('=== INICIO DE PETICIÓN ===');
  console.log('Action:', action);
  console.log('Email:', email);
  console.log('Variables de entorno presentes:', {
    GOOGLE_PROJECT_ID: !!process.env.GOOGLE_PROJECT_ID,
    GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY
  });

  try {
    // Test de conexión a Google Sheets
    console.log('Probando conexión a Google Sheets...');
    const testResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    console.log('✅ Conexión a Google Sheets exitosa');

    if (action === 'login') {
      // --- Lógica de Login (Sistema Passwordless) ---
      console.log('Iniciando proceso de login para:', email);
      
      const lastCodeTime = getCache(`last_code_time_${email}`);
      if (lastCodeTime && Date.now() - lastCodeTime < 10000) {
        console.log('Rate limit aplicado para:', email);
        return sendResponse(res, 429, { status: 'error', message: 'Espera unos segundos antes de solicitar otro código.' });
      }

      console.log('Buscando usuario en Google Sheets...');
      const user = await buscarUsuario(email);
      if (!user) {
        console.log('Usuario no encontrado:', email);
        await registrarIntento(email, 'usuario_no_encontrado');
        return sendResponse(res, 404, { status: 'error', message: 'Usuario no encontrado' });
      }

      console.log('Usuario encontrado:', { email: user.email, nombre: user.nombre, rol: user.rol });

      const tmpToken = randomUUID();
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      console.log('Guardando datos en memoria...');
      // Guardar en memoria (cache) por 5 minutos
      setCache(`tmp_token_${email}`, tmpToken, 300);
      setCache(`code_${email}`, verificationCode, 300);
      setCache(`user_data_${email}`, JSON.stringify(user), 300);
      setCache(`last_code_time_${email}`, Date.now(), 10);

      // Aquí iría la lógica para enviar el email.
      // Por ahora, lo devolvemos en la respuesta para pruebas.
      console.log(`Código para ${email}: ${verificationCode}`);

      await registrarIntento(email, 'codigo_enviado');
      console.log('✅ Login exitoso, código generado');
      
      // EN PRODUCCIÓN, NO ENVÍES EL CÓDIGO EN LA RESPUESTA
      return sendResponse(res, 200, { 
        status: 'ok', 
        message: `Código de verificación enviado a ${email}`,
        tmpToken,
        _test_code: verificationCode // Solo para pruebas
      });

    } else if (action === 'verify-code') {
      // --- Lógica de Verificación de Código ---
      const savedToken = getCache(`tmp_token_${email}`);
      if (!savedToken) {
        return sendResponse(res, 401, { status: 'error', message: 'Sesión inválida o expirada' });
      }

      const savedCode = getCache(`code_${email}`);
      if (!savedCode || savedCode !== code) {
        return sendResponse(res, 401, { status: 'error', message: 'Código incorrecto o vencido' });
      }

      const userData = getCache(`user_data_${email}`);
      if (!userData) {
        return sendResponse(res, 404, { status: 'error', message: 'Datos de usuario no encontrados' });
      }

      const user = JSON.parse(userData);
      
      // Limpiar tokens de un solo uso
      delCache(`tmp_token_${email}`);
      delCache(`code_${email}`);
      delCache(`user_data_${email}`);

      // Generar token de sesión final
      const sessionToken = randomUUID();

      // Guardar sesión en cache por 8 horas (28800 segundos)
      const sessionData = {
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        permisos: [], // Agregar lógica de permisos si es necesario
        loginTime: new Date().toISOString()
      };
      setCache(`session_${email}_${sessionToken}`, JSON.stringify(sessionData), 28800);

      await registrarIntento(email, 'login_exitoso');

      return sendResponse(res, 200, { 
        status: 'ok',
        message: 'Login exitoso',
        user: {
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          permisos: [] // Agregar lógica de permisos si es necesario
        },
        token: sessionToken
      });

    } else if (action === 'validate-token') {
      // --- Lógica de Validación de Token ---
      console.log('Validando token para:', email);
      
      if (!email || !token) {
        return sendResponse(res, 400, { 
          success: false, 
          message: 'Email y token son requeridos' 
        });
      }

      // Validar que el token esté en el cache de sesiones activas
      const sessionData = getCache(`session_${email}_${token}`);
      if (!sessionData) {
        console.log('Token no encontrado en cache para:', email);
        return sendResponse(res, 401, { 
          success: false, 
          valid: false,
          message: 'Token inválido o expirado' 
        });
      }

      // También validar que no haya expirado (redundante, pero útil)
      try {
        const session = JSON.parse(sessionData);
        console.log('✅ Token válido para:', email);
        return sendResponse(res, 200, { 
          success: true, 
          valid: true,
          user: session 
        });
      } catch (e) {
        console.error('Error parseando session data:', e);
        return sendResponse(res, 500, { 
          success: false, 
          valid: false,
          message: 'Error interno' 
        });
      }

    } else {
      return sendResponse(res, 400, { status: 'error', message: 'Acción no válida' });
    }
  } catch (error) {
    console.error('❌ ERROR COMPLETO:', error);
    console.error('Stack trace:', error.stack);
    console.error('Message:', error.message);
    
    // Información específica del error
    if (error.code) console.error('Error code:', error.code);
    if (error.response) console.error('API Response:', error.response.data);
    
    return sendResponse(res, 500, { 
      status: 'error', 
      message: 'Error interno del servidor',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
