import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

// Verificar que las variables de entorno estén presentes
if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error('❌ Variables de entorno faltantes:');
  console.error('GOOGLE_PROJECT_ID:', !!process.env.GOOGLE_PROJECT_ID);
  console.error('GOOGLE_CLIENT_EMAIL:', !!process.env.GOOGLE_CLIENT_EMAIL);
  console.error('GOOGLE_PRIVATE_KEY:', !!process.env.GOOGLE_PRIVATE_KEY);
  throw new Error('Variables de entorno de Google no configuradas correctamente');
}

// Procesamiento más robusto de la clave privada
let privateKey = process.env.GOOGLE_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('GOOGLE_PRIVATE_KEY no está definida');
}

// Diferentes formas de procesar la clave privada según cómo esté almacenada
if (privateKey.includes('\\n')) {
  // Si contiene \\n literal, reemplazar por saltos de línea reales
  privateKey = privateKey.replace(/\\n/g, '\n');
} else if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN')) {
  // Si es una línea continua, agregar saltos de línea manualmente
  privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                       .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
                       .replace(/(.{64})/g, '$1\n')
                       .replace(/\n\n/g, '\n');
}

console.log('🔑 Longitud de clave privada procesada:', privateKey.length);

// Las credenciales se cargan automáticamente desde las variables de entorno de Vercel
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: privateKey,
  },
});

const sheets = google.sheets({ version: 'v4', auth });

export { sheets, auth };
