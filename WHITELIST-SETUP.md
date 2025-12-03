# 📋 Configuración del Módulo Whitelist - Clientes Fieles

## 🎯 Estructura del Google Spreadsheet

### Crear Nueva Hoja de Cálculo

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea una nueva hoja de cálculo
3. Nómbrala: **"Yerbit - Whitelist Clientes Fieles"**

### Headers (Primera fila - A1:K1)

Copia exactamente estos headers en la primera fila:

| A         | B      | C      | D        | E         | F         | G         | H         | I         | J     | K           |
| --------- | ------ | ------ | -------- | --------- | --------- | --------- | --------- | --------- | ----- | ----------- |
| Documento | Correo | Nombre | Teléfono | Dirección | Tarjeta 1 | Tarjeta 2 | Tarjeta 3 | Tarjeta 4 | Fecha | Comentarios |

### Ejemplo de Datos (Fila 2)

```
12345678 | juan@email.com | Juan Pérez | 099 123 456 | Av. Italia 1234, Apto 501 | 1234 | 5678 |  |  | 03/12/2025 15:30 | Cliente VIP desde 2020
```

## ⚙️ Configuración del Código

### 1. Obtener el ID del Spreadsheet

El ID está en la URL de tu hoja:

```
https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit
```

### 2. Actualizar `api/gateway.js`

Línea 11:

```javascript
WHITELIST: 'PEGA_TU_SPREADSHEET_ID_AQUI',
```

### 3. Actualizar `form-whitelist.html`

Línea 39:

```html
href="https://docs.google.com/spreadsheets/d/TU_SPREADSHEET_ID/edit?usp=sharing"
```

## 🔐 Permisos de la Hoja

1. Haz clic en **"Compartir"** en tu Google Sheet
2. En "Acceso general" → Selecciona **"Cualquier persona con el enlace"**
3. Permiso: **"Editor"** (necesario para que la API pueda escribir)
4. Haz clic en **"Copiar enlace"**

## 🎨 Características del Módulo

### Campos del Formulario

- ✅ **Documento**: CI del cliente (obligatorio)
- ✅ **Correo**: Email del cliente (obligatorio)
- ✅ **Nombre**: Nombre completo (obligatorio)
- ✅ **Teléfono**: Número de contacto (opcional)
- ✅ **Dirección**: Dirección de envío confiable (obligatorio)
- ✅ **Tarjetas**: Hasta 4 tarjetas separadas por coma (opcional)
- ✅ **Comentarios**: Información adicional (opcional)

### Lógica de Tarjetas

**Input del usuario:**

```
1234, 5678, 9012
```

**Se guarda en Google Sheets:**

- Columna F (Tarjeta 1): `1234`
- Columna G (Tarjeta 2): `5678`
- Columna H (Tarjeta 3): `9012`
- Columna I (Tarjeta 4): _(vacío)_

**Se muestra en la tabla:**

```
1234, 5678, 9012
```

### Estadísticas

- **Total clientes**: Todos los registros en la whitelist
- **Con tarjetas**: Clientes que tienen al menos 1 tarjeta registrada
- **Sin tarjetas**: Clientes sin tarjetas aún

### Búsqueda

El buscador filtra por:

- Documento
- Correo
- Nombre
- Teléfono
- Dirección
- Tarjetas

## 🚀 Uso del Módulo

### Agregar Cliente

1. Completa el formulario con los datos del cliente
2. Si tiene múltiples tarjetas, sepáralas con comas: `1234, 5678`
3. Haz clic en **"Agregar"**
4. El sistema valida duplicados por documento o correo

### Validaciones

- ❌ No se pueden agregar documentos o correos duplicados
- ✅ Todos los clientes están "logueados" (son clientes fieles)
- ✅ Máximo 4 tarjetas por cliente
- ✅ Fecha automática en UTC-3

## 🎯 Diferencias con Fraudes

| Característica         | Fraudes    | Whitelist       |
| ---------------------- | ---------- | --------------- |
| Tipo de usuario        | Bloqueados | Clientes fieles |
| Checkbox "No logueado" | ✅ Sí      | ❌ No           |
| Campo Dirección        | ❌ No      | ✅ Sí           |
| Campo Teléfono         | ❌ No      | ✅ Sí           |
| Campo Tarjetas         | ❌ No      | ✅ Sí (hasta 4) |
| Color tema             | 🔵 Azul    | 🟢 Verde        |
| Icono principal        | ⚠️ Alert   | ❤️ Corazón      |

## 📊 Estructura de Datos en Google Sheets

```
A: Documento (ej: 12345678)
B: Correo (ej: cliente@email.com)
C: Nombre (ej: Juan Pérez)
D: Teléfono (ej: 099 123 456)
E: Dirección (ej: Av. Italia 1234, Apto 501)
F: Tarjeta 1 (ej: 1234)
G: Tarjeta 2 (ej: 5678)
H: Tarjeta 3 (ej: 9012)
I: Tarjeta 4 (vacío o ej: 3456)
J: Fecha (ej: 03/12/2025 15:30)
K: Comentarios (ej: Cliente VIP desde 2020)
```

## 🧪 Testing

1. Abre `form-whitelist.html` en el navegador
2. Verifica que el acordeón de estadísticas funcione
3. Agrega un cliente de prueba con 2-3 tarjetas
4. Verifica que aparezca en la tabla
5. Prueba el buscador con diferentes campos
6. Verifica en Google Sheets que los datos se guardaron correctamente

## 🐛 Troubleshooting

**Error: "Error obteniendo whitelist"**

- Verifica que el ID del spreadsheet sea correcto
- Verifica que los permisos sean "Editor" para "Cualquier persona con el enlace"

**Las tarjetas no se separan correctamente:**

- Asegúrate de usar comas `,` para separar
- No uses punto y coma `;` u otros separadores

**No aparecen datos en la tabla:**

- Abre la consola del navegador (F12)
- Busca errores en la pestaña "Console"
- Verifica que el nombre de la hoja sea exactamente `Whitelist`

---

✅ **Módulo listo para usar!** Una vez configurado el Spreadsheet, el sistema estará completamente operativo.
