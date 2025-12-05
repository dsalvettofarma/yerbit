// inspector.js (ES Module)

console.log("INSPECTOR: inspector.js cargado (inicio del archivo)");

// Temporalmente removidas las importaciones del apiService.js hasta que API Gateway esté completo
// import { getSheets, searchInSheet, getSheetData } from '../shared/apiService.js';

// Verificar que exista una sesión real antes de continuar
console.log(
  "INSPECTOR: Verificando si existe sesión en localStorage:",
  !!localStorage.getItem("session")
);

// No eliminar la sesión existente para usar los valores reales
// const sessionCheck = localStorage.getItem('session');
// console.log('INSPECTOR: Sesión existente verificada:', !!sessionCheck);

// Configuración migrada a API Gateway
const SPREADSHEET_ID = "1L1KvMg-rD3Lq90e5lMW-KZhg-dHOrsF-pa5SnlhZ-WI"; // ID por defecto
const NOMBRE_COLUMNA_FECHA_POR_DEFECTO = "Fecha";
const CACHE_EXPIRATION_MS = 60 * 60 * 1000;

// Configuración de paginación
const FILAS_POR_PAGINA = 500;
let paginaActual = 1;
let totalPaginas = 1;
let resultadosFiltrados = [];
const fechaCache = new Map(); // Caché para formateo de fechas

// Estado del módulo (no global)
let sessionInspector = null;
let selectHoja,
  btnRefrescarHojas,
  btnPrecargar,
  btnBuscar,
  inputValor,
  selectColumna,
  selectTipoMatch,
  inputFechaDesde,
  inputFechaHasta,
  btnLimpiarFiltroFechas,
  btnUltimoRegistro,
  btnPagosAnulados,
  btnPagosRechazados,
  tablaResultados,
  estadoElement,
  precargaTimerId,
  precargaDelayId,
  overlaySpinnerElement,
  overlayTextElement,
  selectCanalVenta,
  selectComercio;
let activeEventListeners = [];
let debounceTimer = null;
// --- Helper para añadir y rastrear Event Listeners ---
function _addManagedEventListener(element, type, handler, options = false) {
  if (element) {
    element.addEventListener(type, handler, options);
    activeEventListeners.push({ element, type, handler, options });
  } else {
    console.warn(
      `INSPECTOR: Intento de añadir listener a elemento nulo (tipo: ${type})`
    );
  }
}

// BIEN: SIEMPRE a tu API Gateway
const GATEWAY_URL = "/api/gateway";

async function _apiRequest(action, params = {}) {
  const maxRetries = 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`INSPECTOR: Reintento ${attempt}/${maxRetries}...`);
        _updateStatus(`⏳ Reintentando... (${attempt}/${maxRetries})`, false);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      console.log(`INSPECTOR: Llamando al API Gateway. Acción: ${action}`);

      const queryParams = new URLSearchParams({
        module: "inspector",
        action,
        ...params,
      }).toString();
      const url = `${GATEWAY_URL}?${queryParams}`;
      console.log("INSPECTOR: URL del API Gateway:", url);

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const contentType = (
        resp.headers.get("content-type") || ""
      ).toLowerCase();

      if (!resp.ok) {
        let errorText = await resp.text();
        if (contentType.includes("text/html")) {
          const stripped = errorText
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          errorText = `Respuesta HTML del servidor: ${stripped.slice(0, 300)}${stripped.length > 300 ? "..." : ""}`;
        } else {
          try {
            const j = JSON.parse(errorText);
            errorText = typeof j === "string" ? j : JSON.stringify(j);
          } catch (e) {
            // keep plain text
          }
        }

        console.error(`INSPECTOR: Error HTTP ${resp.status}:`, errorText);
        if (resp.status >= 500 && attempt < maxRetries) {
          lastError = new Error(
            `Error del servidor (${resp.status}). Reintentando...`
          );
          continue;
        }
        throw new Error(`HTTP ${resp.status}: ${errorText}`);
      }

      const rawText = await resp.text();
      let data;
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          console.warn(
            "INSPECTOR: Fallo al parsear JSON, responseText:",
            rawText.slice(0, 500)
          );
          throw new Error(
            "El API devolvió una respuesta no válida (no JSON). ¿Está corriendo el backend?"
          );
        }
      } else if (contentType.includes("text/html")) {
        const stripped = rawText
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        console.error(
          "INSPECTOR: Respuesta HTML inesperada del API:",
          stripped.slice(0, 500)
        );
        throw new Error(
          "El endpoint respondió HTML en lugar de JSON. Asegúrate de ejecutar el backend (p. ej. `npx vercel dev`)."
        );
      } else {
        console.error(
          "INSPECTOR: Respuesta inesperada del API (texto):",
          rawText.slice(0, 500)
        );
        throw new Error(
          "Respuesta inesperada del API: " + rawText.slice(0, 300)
        );
      }

      console.log(`INSPECTOR: Respuesta exitosa del API Gateway:`, data);
      return data;
    } catch (error) {
      lastError = error;
      const isNetworkError =
        error.name === "TypeError" ||
        error.message.includes("fetch") ||
        error.message.includes("network");
      if (isNetworkError && attempt < maxRetries) {
        console.warn(`INSPECTOR: Error de red, reintentando...`, error);
        continue;
      }
      if (attempt === maxRetries) {
        console.error(
          "INSPECTOR: Error en llamada a API Gateway (todos los intentos fallaron):",
          error
        );
        let userMessage = error.message;
        if (
          error.message.includes("504") ||
          error.message.toLowerCase().includes("timeout")
        ) {
          userMessage =
            "❌ Falló la conexión con Google Sheets o el API Gateway (timeout). Intenta recargar o precargar manualmente.";
        } else if (error.message.includes("503")) {
          userMessage =
            "⚠️ Servicio de Google Sheets temporalmente no disponible. Intenta recargar en unos segundos.";
        } else if (
          error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.name === "TypeError"
        ) {
          userMessage =
            "🔌 Error de conexión con el servidor o Google Sheets. Verifica la conexión e intenta recargar.";
        }
        _updateStatus(userMessage, true);
        throw error;
      }
    }
  }
  throw lastError;
}

// --- Funciones de UI y Utilidad (Adaptadas de tu script) ---
function _showOverlaySpinner() {
  //
  if (overlaySpinnerElement) overlaySpinnerElement.style.display = "flex";
}
function _hideOverlaySpinner() {
  if (overlaySpinnerElement) overlaySpinnerElement.style.display = "none";
  if (precargaTimerId) {
    // Limpiar el timer si se oculta el spinner
    clearInterval(precargaTimerId);
    precargaTimerId = null;
    console.log(
      "INSPECTOR: Timer de precarga detenido por _hideOverlaySpinner."
    );
  }
  if (overlayTextElement) overlayTextElement.textContent = ""; // Limpiar el texto
}
function _updateStatus(message, isError = false) {
  //
  if (!estadoElement) return;
  estadoElement.textContent = message;
  estadoElement.className = `mensaje-estado ${isError ? "error-message" : "info-message"}`;
  estadoElement.style.display = message ? "block" : "none";
}
function _capitalize(str) {
  //
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function _inicializarDragHeaders(
  headersOrdenados,
  headersOriginales,
  filasOriginales
) {
  setTimeout(() => {
    const headerRow = document.getElementById("results-header-row");
    if (!headerRow || headerRow.children.length < 2) return;

    Sortable.create(headerRow, {
      animation: 150,
      ghostClass: "drag-ghost",
      onEnd: () => {
        const nuevasPosiciones = Array.from(headerRow.children)
          .filter((th) => th.getAttribute("data-index") !== "-1")
          .map((th) => parseInt(th.getAttribute("data-index")));
        const nuevosHeaders = nuevasPosiciones.map((i) => headersOrdenados[i]);
        const nuevosIdxs = nuevosHeaders.map((h) =>
          headersOriginales.indexOf(h)
        );

        if (window.cacheData) window.cacheData.headersOrdenados = nuevosHeaders;
        _renderizarTabla(
          filasOriginales,
          nuevosHeaders,
          nuevosIdxs,
          headersOriginales
        );
      },
    });
  }, 50);
}

// TU FUNCIÓN DE AJUSTAR Y FORMATEAR FECHA (renombrada con _ y con caché)
function _ajustarYFormatear(fechaStr) {
  // Usar caché para evitar re-formatear las mismas fechas
  if (fechaCache.has(fechaStr)) {
    return fechaCache.get(fechaStr);
  }

  const resultado = _ajustarYFormatearSinCache(fechaStr);
  fechaCache.set(fechaStr, resultado);
  return resultado;
}

function _ajustarYFormatearSinCache(fechaStr) {
  if (!fechaStr && fechaStr !== 0) return ""; // Devuelve string vacío si no hay fecha, o 'N/A' si prefieres.
  let fecha = new Date(fechaStr);

  // Intento de parseo con regex si el new Date inicial falla
  if (isNaN(fecha.getTime()) && typeof fechaStr === "string") {
    const parts = fechaStr.match(
      /(\d{4})-(\d{2})-(\d{2})[T ]?(\d{2})?:?(\d{2})?:?(\d{2})?/
    );
    if (parts) {
      fecha = new Date(
        parseInt(parts[1], 10),
        parseInt(parts[2], 10) - 1,
        parseInt(parts[3], 10),
        parts[4] ? parseInt(parts[4], 10) : 0,
        parts[5] ? parseInt(parts[5], 10) : 0,
        parts[6] ? parseInt(parts[6], 10) : 0
      );
    }
  }

  // Intento de parsear números de serie de Excel si los anteriores fallaron o no aplicaron
  // (Esta lógica se añadió en la respuesta anterior, la integramos con tu función)
  if (isNaN(fecha.getTime())) {
    let sFechaStr = String(fechaStr).trim();
    if (/^(\d{5}|\d{5}\.\d+)$/.test(sFechaStr)) {
      try {
        const valorNumerico = parseFloat(sFechaStr);
        const offsetDiasExcel = 25569;
        const msPorDia = 24 * 60 * 60 * 1000;
        const timestamp = (valorNumerico - offsetDiasExcel) * msPorDia;
        fecha = new Date(timestamp);
        if (isNaN(fecha.getTime())) fecha = null;
      } catch (e) {
        fecha = null;
      }
    }
  }

  if (!fecha || isNaN(fecha.getTime())) {
    return fechaStr; // Devolver el string original si todos los parseos fallan
  }

  // AJUSTE DE -4 HORAS
  //fecha.setHours(fecha.getHours() - 4);

  // Opciones de formato para Uruguay
  const opciones = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    // timeZone: 'America/Montevideo' // Si se especifica, puede interactuar con el setHours.
    // Si el ajuste manual es para llevar a UYT, entonces no usar timeZone aquí.
    // O, si la fecha original ES UTC, no hagas setHours y usa timeZone: 'America/Montevideo'.
  };

  try {
    // Formatear a es-UY. Dado que ajustaste manualmente, toLocaleString usará esa hora "ajustada".
    return fecha.toLocaleString("es-UY", opciones);
  } catch (e) {
    console.error(
      "INSPECTOR: Error formateando fecha con es-UY:",
      e,
      "Fallback a formato ISO simplificado."
    );
    const pad = (num) => String(num).padStart(2, "0");
    return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())} ${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`;
  }
}

// --- Función para ordenar headers (puedes personalizar el orden si lo deseas) ---
function _ordenarHeaders(headers, sheetName) {
  if (!Array.isArray(headers)) return [];

  const prioridad = [
    "Id usuario",
    "Nombre",
    "Email de usuario",
    "Fecha",
    "Fecha Anulacion/Devolucion",
    "Estado",
    "Mensaje de respuesta",
  ];

  const ocultar = [
    "Id (Auth-conf)",
    "Ley que aplico",
    "Devolucion de impuesto",
    "Codigo de autorizacion",
    "Moneda",
    "Ticket",
    "Numero de de comercio",
    "Numero de terminal",
    "Ref. enviada al autorizador",
    "Ref. devuelta por el autorizador",
    "Proceso Aut.",
  ];

  // Filtrar las columnas a mostrar (no ocultas)
  const visibles = headers.filter((h) => !ocultar.includes(String(h)));
  // Ordenar: primero las prioritarias, luego el resto
  const principales = prioridad.filter((h) => visibles.includes(String(h)));
  const otros = visibles.filter((h) => !principales.includes(String(h)));
  const resultado = [...principales, ...otros];
  console.log(`INSPECTOR: Headers ordenados (prioridad+otros):`, resultado);
  return resultado;
}

// --- Inicialización multipágina clásica ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("INSPECTOR: DOMContentLoaded - inicializando módulo inspector");

  // Esperar un poco para asegurar que el dashboard-layout.js haya terminado
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    console.log("INSPECTOR: Iniciando en el dashboard");
    // Obtener referencias a los elementos del DOM
    selectHoja = document.getElementById("sheet");
    btnRefrescarHojas = document.getElementById("btnRefrescarHojas");
    btnPrecargar = document.getElementById("btnPrecargar");
    btnBuscar = document.getElementById("btnBuscar");
    inputValor = document.getElementById("value-input");

    // Debug: verificar que los elementos existen
    console.log("INSPECTOR: Verificando elementos del DOM:", {
      selectHoja: !!selectHoja,
      btnRefrescarHojas: !!btnRefrescarHojas,
      btnPrecargar: !!btnPrecargar,
      btnBuscar: !!btnBuscar,
      inputValor: !!inputValor,
    });
    selectColumna = document.getElementById("column");
    selectTipoMatch = document.getElementById("match-select");
    inputFechaDesde = document.getElementById("fecha-desde");
    inputFechaHasta = document.getElementById("fecha-hasta");
    btnLimpiarFiltroFechas = document.getElementById("btnLimpiarFiltroFechas");
    btnUltimoRegistro = document.getElementById("btnMostrarUltimo");
    btnPagosAnulados = document.getElementById("btnAnulados");
    btnPagosRechazados = document.getElementById("btnRechazados");
    tablaResultados = document.getElementById("results");
    estadoElement = document.getElementById("estado");
    overlaySpinnerElement = document.getElementById("overlay-spinner");
    overlayTextElement = document.getElementById("overlay-text");
    selectCanalVenta = document.getElementById("canal");
    selectComercio = document.getElementById("comercio");
    // Verificar que los elementos principales existen
    if (
      !selectHoja ||
      !btnPrecargar ||
      !btnBuscar ||
      !inputValor ||
      !tablaResultados ||
      !overlaySpinnerElement ||
      !overlayTextElement
    ) {
      console.error(
        "INSPECTOR: Faltan elementos cruciales del DOM. La sección no puede inicializarse."
      );
      if (estadoElement)
        estadoElement.textContent =
          "Error: Interfaz del inspector no cargada correctamente.";
      const mainContent = document.getElementById("main-content");
      if (mainContent)
        mainContent.innerHTML =
          '<p class="status-message error-message" style="padding:20px;">Error al cargar la interfaz del Inspector. Elementos no encontrados.</p>';
      return;
    }
    // Añadir Listeners usando el helper
    console.log("INSPECTOR: Agregando event listeners...");
    _addManagedEventListener(btnRefrescarHojas, "click", () => {
      console.log("INSPECTOR: Click en btnRefrescarHojas");
      // Refrescar solo headers/hojas (evitar precarga masiva accidental)
      _precargarHeaders(true);
    });
    _addManagedEventListener(btnPrecargar, "click", () => {
      console.log("INSPECTOR: Click en btnPrecargar");
      _precargar(false);
    });
    _addManagedEventListener(btnBuscar, "click", () => {
      console.log("INSPECTOR: Click en btnBuscar");
      _buscar();
    });
    _addManagedEventListener(inputValor, "keyup", (event) => {
      if (event.key === "Enter") {
        _buscar();
      }
    });
    if (btnLimpiarFiltroFechas) {
      _addManagedEventListener(btnLimpiarFiltroFechas, "click", () => {
        if (inputFechaDesde) inputFechaDesde.value = "";
        if (inputFechaHasta) inputFechaHasta.value = "";
        _buscar();
      });
    }
    if (btnUltimoRegistro)
      _addManagedEventListener(btnUltimoRegistro, "click", _mostrarUltimo);
    if (btnPagosAnulados)
      _addManagedEventListener(btnPagosAnulados, "click", _analizarAnulados);
    if (btnPagosRechazados)
      _addManagedEventListener(btnPagosRechazados, "click", _analizarErrores);
    if (selectHoja) {
      _addManagedEventListener(selectHoja, "change", () => {
        console.log(
          "INSPECTOR: Hoja seleccionada cambiada. Se recomienda precargar."
        );
        _updateStatus("Hoja cambiada. Por favor, precarga los datos.", false);
        if (tablaResultados && tablaResultados.tBodies[0])
          tablaResultados.tBodies[0].innerHTML = "";
      });
    }
    // Precarga automática ligera: wake-up del Gateway y carga de headers (no datos pesados)
    _updateStatus(
      "Selecciona una hoja. Precarga automática ligera en breve...",
      false
    );
    console.log(
      "INSPECTOR: Precarga automática (ligera) programada en 800ms..."
    );
    // Limpiar cualquier timeout previo
    if (typeof precargaDelayId !== "undefined" && precargaDelayId) {
      clearTimeout(precargaDelayId);
      precargaDelayId = null;
    }
    precargaDelayId = setTimeout(async () => {
      try {
        console.log("INSPECTOR: health-check (auto precarga ligera)...");
        await _apiRequest("ping");

        console.log("INSPECTOR: precarga de headers (auto)...");
        await _precargarHeaders();

        _updateStatus(
          "Headers cargados. Seleccioná una hoja y tocá 'Precargar'.",
          false
        );
      } catch (err) {
        console.warn("INSPECTOR: Precarga automática ligera falló:", err);
        _updateStatus("❌ No se pudo inicializar. Probá manualmente.", true);
      } finally {
        precargaDelayId = null;
      }
    }, 800);
  } catch (err) {
    console.error("INSPECTOR: Error en inicialización:", err);
    if (estadoElement)
      _updateStatus(
        "Error al inicializar el módulo: " + (err.message || err),
        true
      );
  }
});

// --- Funciones de Caché y Precarga ---
function _cacheExpirada() {
  //
  if (!window.cacheData || !window.cacheData.ts) return true;
  const expirada = Date.now() - window.cacheData.ts > CACHE_EXPIRATION_MS;
  if (expirada) console.log("INSPECTOR: Caché expirada.");
  return expirada;
}

// Precarga ligera: obtener lista de hojas y poblar el selector de hojas
async function _precargarHeaders(forzar = false) {
  _showOverlaySpinner();
  try {
    if (estadoElement)
      estadoElement.innerText = "Refrescando lista de hojas...";
    if (overlayTextElement)
      overlayTextElement.textContent = "Refrescando lista de hojas...";

    const dataHojas = await _apiRequest("getSheets");
    console.log("INSPECTOR: Respuesta de getSheets:", dataHojas);

    if (!selectHoja) {
      console.error(
        "INSPECTOR: selectHoja no encontrado al precargar headers."
      );
      _updateStatus("Error: selector de hojas no disponible.", true);
      return;
    }

    selectHoja.innerHTML =
      '<option value="">-- Selecciona una hoja --</option>';
    if (dataHojas && Array.isArray(dataHojas.sheets)) {
      dataHojas.sheets.forEach((nombreHoja) => {
        const option = document.createElement("option");
        option.value = nombreHoja;
        option.textContent = nombreHoja;
        selectHoja.appendChild(option);
      });
      if (selectHoja.options.length > 1 && !selectHoja.value) {
        selectHoja.selectedIndex = 1;
      }
      _updateStatus("Hojas cargadas. Seleccioná una hoja.", false);
    } else {
      console.error(
        "INSPECTOR: getSheets devolvió formato inesperado:",
        dataHojas
      );
      _updateStatus("No se recibieron hojas válidas del servidor.", true);
    }
  } catch (err) {
    console.error("INSPECTOR: Error en _precargarHeaders:", err);
    _updateStatus(
      "Error al cargar lista de hojas: " + (err.message || err),
      true
    );
  } finally {
    _hideOverlaySpinner();
  }
}

// Precarga completa en chunks para evitar timeouts (invocada manualmente)
async function _precargar(forzarRefrescoDeHojas = false) {
  const hoja = selectHoja ? selectHoja.value : null;
  if (!hoja) {
    _updateStatus("Seleccioná una hoja para precargar.", true);
    return;
  }

  _showOverlaySpinner();
  _updateStatus("Precargando datos…", false);

  try {
    // Obtener metadatos: headers y totalRows (sin contar header)
    const meta = await _apiRequest("getMeta", { sheet: hoja });
    if (
      !meta ||
      typeof meta.totalRows !== "number" ||
      !Array.isArray(meta.headers)
    ) {
      throw new Error("Respuesta inválida de getMeta");
    }

    const totalRows = meta.totalRows;
    if (totalRows === 0) {
      window.cacheData = {
        sheetName: hoja,
        headers: meta.headers,
        headersOrdenados: _ordenarHeaders(meta.headers, hoja),
        rows: [],
        ts: Date.now(),
      };
      _updateStatus(`Hoja '${hoja}' sin filas. Listo.`, false);
      return;
    }

    const chunkSize = 3000;
    const chunks = Math.ceil(totalRows / chunkSize);
    let allRows = [];

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize + 1; // start is 1-based data-row index (no header)
      const end = Math.min((i + 1) * chunkSize, totalRows);
      console.log(`INSPECTOR: Fetch chunk ${start}-${end} for sheet ${hoja}`);
      if (overlayTextElement)
        overlayTextElement.textContent = `Cargando filas ${start}-${end} de ${totalRows}...`;

      const data = await _apiRequest("getRange", {
        sheet: hoja,
        start,
        end,
      });

      if (!data || !Array.isArray(data.rows)) {
        throw new Error(`Respuesta inválida de getRange para ${start}-${end}`);
      }

      allRows = allRows.concat(data.rows);
    }

    const headers = meta.headers.slice();
    // Si algunas filas tienen más columnas que headers, completar nombres
    let maxCols = headers.length;
    allRows.forEach((r) => {
      if (r.length > maxCols) maxCols = r.length;
    });
    const headersCompletos = headers.slice();
    for (let i = headersCompletos.length; i < maxCols; i++) {
      headersCompletos[i] = `Columna ${i + 1}`;
    }

    const headersOrdenados = _ordenarHeaders(headersCompletos, hoja);

    window.cacheData = {
      sheetName: hoja,
      headers: headersCompletos,
      headersOrdenados: headersOrdenados,
      rows: allRows,
      ts: Date.now(),
    };

    if (selectColumna) {
      selectColumna.innerHTML =
        '<option value="__all__">Buscar en todo</option>';
      headersOrdenados.forEach((header) => {
        const option = document.createElement("option");
        option.value = header;
        option.textContent = _capitalize(header);
        selectColumna.appendChild(option);
      });
    }

    _updateStatus(`Precarga completa: ${allRows.length} filas.`, false);
  } catch (err) {
    console.error("INSPECTOR: Error precargando en chunks:", err);
    _updateStatus("Error precargando: " + (err.message || err), true);
    window.cacheData = null;
  } finally {
    _hideOverlaySpinner();
  }
} // Cierre de la función _precargar

// --- Cargar dinámicamente la librería SortableJS si no está cargada ---
function _cargarLibreriaSortable() {
  if (window.Sortable) return Promise.resolve();
  if (_cargarLibreriaSortable._promise) return _cargarLibreriaSortable._promise;
  _cargarLibreriaSortable._promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js";
    script.async = true;
    script.onload = () => {
      if (window.Sortable) {
        resolve();
      } else {
        reject(new Error("No se pudo cargar SortableJS."));
      }
    };
    script.onerror = () => reject(new Error("Error al cargar SortableJS."));
    document.head.appendChild(script);
  });
  return _cargarLibreriaSortable._promise;
}

// --- Renderizado de la tabla de resultados CON PAGINACIÓN ---
function _renderizarTabla(
  filas,
  headersOrdenadosParaMostrar,
  idxsDeOriginalesParaRenderizar,
  headersOriginalesCompletos,
  resetearPagina = true
) {
  if (!tablaResultados) {
    console.error(
      "INSPECTOR: Elemento de tabla #results no encontrado para renderizar."
    );
    _updateStatus("Error: No se puede mostrar la tabla de resultados.", true);
    return;
  }

  // Guardar resultados para paginación
  resultadosFiltrados = filas || [];
  totalPaginas = Math.ceil(resultadosFiltrados.length / FILAS_POR_PAGINA) || 1;

  if (resetearPagina) {
    paginaActual = 1;
  }

  // Validar página actual
  if (paginaActual > totalPaginas) {
    paginaActual = totalPaginas;
  }

  // Calcular índices de la página actual
  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  const fin = Math.min(inicio + FILAS_POR_PAGINA, resultadosFiltrados.length);
  const filasPagina = resultadosFiltrados.slice(inicio, fin);

  // Determinar el máximo de columnas presentes en los datos
  let maxCols = headersOriginalesCompletos.length;
  if (resultadosFiltrados.length > 0) {
    maxCols = Math.max(
      maxCols,
      ...resultadosFiltrados.slice(0, 100).map((f) => f.length)
    );
  }

  // Generar headers robustos: si faltan nombres, poner "Columna N"
  let headersRobustos = [];
  for (let i = 0; i < maxCols; i++) {
    headersRobustos[i] = headersOriginalesCompletos[i]
      ? headersOriginalesCompletos[i]
      : `Columna ${i + 1}`;
  }

  // Pre-calcular índice de usuario anulación (fuera del loop)
  const idxUsuarioAnulacion = headersRobustos.findIndex(
    (h) => h.toLowerCase() === "usuario anulación/devolución"
  );

  let cabeceraHtml = '<thead><tr id="results-header-row">';
  cabeceraHtml += `<th data-index="-1">#</th>`;
  headersRobustos.forEach((header, visibleIdx) => {
    cabeceraHtml += `<th data-index="${visibleIdx}">${_capitalize(header)}</th>`;
  });
  cabeceraHtml += "</tr></thead>";

  let cuerpoHtml = "<tbody>";

  if (filasPagina.length > 0) {
    filasPagina.forEach((fila, rowIndex) => {
      const numeroFila = inicio + rowIndex + 1;
      cuerpoHtml += "<tr>";
      cuerpoHtml += `<td class="col-index">${numeroFila}</td>`;
      for (let idx = 0; idx < maxCols; idx++) {
        const headerOriginalActual = headersRobustos[idx];
        let valor =
          fila[idx] !== undefined && fila[idx] !== null
            ? String(fila[idx])
            : "";
        if (
          typeof headerOriginalActual === "string" &&
          headerOriginalActual.toLowerCase().includes("fecha")
        ) {
          valor = _ajustarYFormatear(valor);
        }
        let claseCelda = "";
        // Estado y colores solo si el header es "Estado"
        if (
          headerOriginalActual &&
          headerOriginalActual.toLowerCase() === "estado"
        ) {
          const estadoLower = valor.toLowerCase();
          if (
            estadoLower.includes("rechazado") ||
            estadoLower.includes("error")
          ) {
            claseCelda = "estado-rechazado";
          } else if (
            estadoLower.includes("autorizado") ||
            estadoLower.includes("aprobado")
          ) {
            claseCelda = "estado-autorizado";
          } else if (estadoLower.includes("anulado")) {
            const valorUsuario =
              idxUsuarioAnulacion !== -1 && fila[idxUsuarioAnulacion]
                ? String(fila[idxUsuarioAnulacion]).toLowerCase()
                : "";
            if (valorUsuario.includes("system-api")) {
              claseCelda = "estado-anulado-auto";
              valor = "Anulado automático";
            } else {
              claseCelda = "estado-anulado";
            }
          }
        }
        cuerpoHtml += `<td class="${claseCelda}" title="${valor.replace(/"/g, "&quot;")}">${valor}</td>`;
      }
      cuerpoHtml += "</tr>";
    });
  } else {
    const colSpan = headersRobustos.length + 1 || 1;
    cuerpoHtml += `<tr><td colspan="${colSpan}" class="text-center mensaje-info">No se encontraron resultados para tu búsqueda.</td></tr>`;
  }

  cuerpoHtml += "</tbody>";
  tablaResultados.innerHTML = cabeceraHtml + cuerpoHtml;

  _renderizarPaginacion();

  const mensajeEstado =
    resultadosFiltrados.length > 0
      ? `Mostrando ${inicio + 1}-${fin} de ${resultadosFiltrados.length} resultados (Página ${paginaActual} de ${totalPaginas}).`
      : "No hay resultados.";
  _updateStatus(mensajeEstado);

  _cargarLibreriaSortable().then(() => {
    _inicializarDragHeaders(
      headersRobustos,
      headersOriginalesCompletos,
      resultadosFiltrados
    );
  });
}

// --- Renderizar controles de paginación ---
function _renderizarPaginacion() {
  if (!paginacionContainer) {
    paginacionContainer = document.getElementById("paginacion-controls");
    if (!paginacionContainer) {
      // Crear contenedor si no existe
      const resultsDiv = document.getElementById("results-container");
      if (resultsDiv) {
        paginacionContainer = document.createElement("div");
        paginacionContainer.id = "paginacion-controls";
        paginacionContainer.className = "paginacion-controls";
        resultsDiv.appendChild(paginacionContainer);
      } else {
        return;
      }
    }
  }

  if (totalPaginas <= 1) {
    paginacionContainer.innerHTML = "";
    return;
  }

  let html = '<div class="paginacion-wrapper">';

  // Botón anterior
  html += `<button class="btn-paginacion" ${paginaActual === 1 ? "disabled" : ""} onclick="window.inspector_cambiarPagina(${paginaActual - 1})">
        ← Anterior
    </button>`;

  // Indicador de página
  html += `<span class="paginacion-info">Página ${paginaActual} de ${totalPaginas}</span>`;

  // Botón siguiente
  html += `<button class="btn-paginacion" ${paginaActual === totalPaginas ? "disabled" : ""} onclick="window.inspector_cambiarPagina(${paginaActual + 1})">
        Siguiente →
    </button>`;

  html += "</div>";
  paginacionContainer.innerHTML = html;
}

// --- Cambiar página ---
function _cambiarPagina(nuevaPagina) {
  if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
  paginaActual = nuevaPagina;

  // Re-renderizar con la página actual (no resetear)
  if (!window.cacheData || !window.cacheData.headers) return;

  const headersOriginales = window.cacheData.headers;
  const headersOrdenados =
    window.cacheData.headersOrdenados || headersOriginales;
  const idxsDeOriginales = headersOrdenados.map((h) =>
    headersOriginales.indexOf(h)
  );

  _renderizarTabla(
    resultadosFiltrados,
    headersOrdenados,
    idxsDeOriginales,
    headersOriginales,
    false
  );
}

// Exponer la función globalmente para onclick
window.inspector_cambiarPagina = _cambiarPagina;

// La Parte 3 contendrá _buscar, _mostrarUltimo, _analizarAnulados, _analizarErrores,
// y el cierre de la IIFE.
// --- Funciones de Búsqueda y Filtrado ---
function _buscar() {
  //
  clearTimeout(debounceTimer); // Limpiar el debounce si la búsqueda se activa manualmente
  if (
    !window.cacheData ||
    !window.cacheData.rows ||
    !window.cacheData.headers
  ) {
    //
    if (_cacheExpirada()) {
      //
      _updateStatus(
        "La caché de datos ha expirado. Por favor, precarga la hoja nuevamente.",
        true
      );
    } else {
      _updateStatus(
        'No hay datos precargados. Por favor, selecciona una hoja y haz clic en "Precargar hoja".',
        true
      );
    }
    if (tablaResultados && tablaResultados.tBodies[0])
      tablaResultados.tBodies[0].innerHTML = ""; // Limpiar tabla
    return;
  }

  const valorTexto = inputValor ? inputValor.value.toLowerCase().trim() : ""; //
  const columnaTexto = selectColumna ? selectColumna.value : "__all__"; //
  const tipoMatchTexto = selectTipoMatch ? selectTipoMatch.value : "contains"; //
  const fechaDesdeStr = inputFechaDesde ? inputFechaDesde.value : ""; //
  const fechaHastaStr = inputFechaHasta ? inputFechaHasta.value : ""; //
  const canalSeleccionado = selectCanalVenta ? selectCanalVenta.value : ""; //
  const comercioSeleccionado = selectComercio ? selectComercio.value : ""; //

  let resultados = window.cacheData.rows; //

  // 1. Filtrar por fecha
  if (fechaDesdeStr || fechaHastaStr) {
    let fechaDesde = null,
      fechaHasta = null;
    if (fechaDesdeStr) {
      fechaDesde = new Date(fechaDesdeStr + " 00:00:00");
      fechaDesde.setHours(fechaDesde.getHours() + 4); // SOLO AJUSTE EN DESDE
    }
    if (fechaHastaStr) {
      fechaHasta = new Date(fechaHastaStr + " 23:59:59");
      fechaHasta.setHours(fechaHasta.getHours() + 4); // AJUSTE EN HASTA TAMBIÉN
    }

    const idxColumnaFecha = window.cacheData.headers.indexOf(
      NOMBRE_COLUMNA_FECHA_POR_DEFECTO
    );

    if (idxColumnaFecha !== -1) {
      resultados = resultados.filter((row) => {
        let valorCeldaFecha = row[idxColumnaFecha];
        let fechaCelda;
        if (!valorCeldaFecha) return false;
        try {
          if (/^\d{5}(\.\d+)?$/.test(String(valorCeldaFecha).trim())) {
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            fechaCelda = new Date(
              excelEpoch.getTime() +
                parseFloat(valorCeldaFecha) * 24 * 60 * 60 * 1000
            );
            fechaCelda.setHours(fechaCelda.getHours() - 4); // Ajuste a UY
          } else {
            fechaCelda = new Date(valorCeldaFecha);
          }
          if (isNaN(fechaCelda.getTime())) return false;

          let pasaDesde = true,
            pasaHasta = true;
          if (fechaDesde && fechaCelda < fechaDesde) pasaDesde = false;
          if (fechaHasta && fechaCelda > fechaHasta) pasaHasta = false;
          return pasaDesde && pasaHasta;
        } catch (e) {
          return false;
        }
      });
    } else {
      _updateStatus(
        `Advertencia: Columna de fecha por defecto '${NOMBRE_COLUMNA_FECHA_POR_DEFECTO}' no encontrada. Filtro de fecha no aplicado.`,
        false
      );
    }
  }

  // 2. Filtrar por texto
  if (!valorTexto && columnaTexto === "__all__") {
    _updateStatus(
      "Escribí algo en el campo de valor para buscar en todo.",
      true
    );
    return;
  }

  if (valorTexto) {
    if (columnaTexto === "__all__") {
      resultados = resultados.filter((row) =>
        row.some((cell) => String(cell).toLowerCase().includes(valorTexto))
      );
    } else {
      const idxColumnaTexto = window.cacheData.headers.indexOf(columnaTexto);
      if (idxColumnaTexto !== -1) {
        resultados = resultados.filter((row) => {
          const valorCelda = String(row[idxColumnaTexto]).toLowerCase();
          return tipoMatchTexto === "exacta"
            ? valorCelda === valorTexto
            : valorCelda.includes(valorTexto);
        });
      }
    }
  }

  // 4. Filtrar por Comercio (si se seleccionó uno)
  if (canalSeleccionado) {
    // Ajustá el nombre de columna exactamente igual a como está en la hoja
    const idxColumnaComercio = window.cacheData.headers.findIndex(
      (h) => h.trim().toLowerCase() === "comercio"
    );
    if (idxColumnaComercio !== -1) {
      resultados = resultados.filter(
        (row) =>
          String(row[idxColumnaComercio]).trim().toUpperCase() ===
          canalSeleccionado.toUpperCase()
      );
    }
  }

  // Obtener los índices de las columnas ordenadas para renderizar en ese orden
  const idxsDeOriginalesParaRenderizar = window.cacheData.headersOrdenados.map(
    (h) => window.cacheData.headers.indexOf(h)
  ); //

  _renderizarTabla(
    resultados,
    window.cacheData.headersOrdenados,
    idxsDeOriginalesParaRenderizar,
    window.cacheData.headers
  ); //
}

// --- Funciones de Análisis Específico ---
function _mostrarUltimo() {
  if (
    !window.cacheData ||
    !window.cacheData.rows ||
    window.cacheData.rows.length === 0
  ) {
    _updateStatus(
      "No hay datos precargados para mostrar el último registro.",
      true
    );
    return;
  }

  const idxFecha = window.cacheData.headers.indexOf(
    NOMBRE_COLUMNA_FECHA_POR_DEFECTO
  );
  if (idxFecha === -1) {
    _updateStatus(
      `Columna de fecha '${NOMBRE_COLUMNA_FECHA_POR_DEFECTO}' no encontrada.`,
      true
    );
    return;
  }

  const ultimo = window.cacheData.rows.reduce((latest, current) => {
    const f1 = new Date(latest[idxFecha]);
    const f2 = new Date(current[idxFecha]);
    return !isNaN(f2) && f2 > f1 ? current : latest;
  });

  const headers = window.cacheData.headers;
  const headersOrdenados = window.cacheData.headersOrdenados;
  const idxs = headersOrdenados.map((h) => headers.indexOf(h));

  _renderizarTabla([ultimo], headersOrdenados, idxs, headers);

  const textoFecha = _ajustarYFormatear(ultimo[idxFecha]);
  _updateStatus(`Mostrando el último registro registrado: ${textoFecha}`);
}

function _analizarAnulados() {
  if (
    !window.cacheData ||
    !window.cacheData.rows ||
    !window.cacheData.headers
  ) {
    _updateStatus(
      "Es necesario precargar una hoja para analizar Pagos anulados.",
      true
    );
    return;
  }

  const idxEstado = window.cacheData.headers.indexOf("Estado");
  const idxComercio = window.cacheData.headers.indexOf("Comercio");

  if (idxEstado === -1 || idxComercio === -1) {
    _updateStatus(
      'Faltan columnas ("Estado", "Comercio") para análisis de anulados.',
      true
    );
    return;
  }

  const anulados = window.cacheData.rows.filter((row) =>
    String(row[idxEstado]).toLowerCase().includes("anulado")
  );

  if (anulados.length === 0) {
    _renderizarTabla([], ["Comercio", "Cantidad Anulados"], [], []);
    _updateStatus("No se encontraron pagos anulados en los datos precargados.");
    return;
  }

  const resumen = anulados.reduce((acc, row) => {
    const comercio = row[idxComercio] || "Desconocido";
    acc[comercio] = (acc[comercio] || 0) + 1;
    return acc;
  }, {});

  const filasResumen = Object.entries(resumen).map(([comercio, cantidad]) => [
    comercio,
    cantidad,
  ]);
  _renderizarTabla(
    filasResumen,
    ["Comercio", "Cantidad Anulados"],
    [0, 1],
    ["Comercio", "Cantidad Anulados"]
  );
  _updateStatus(`Análisis de ${anulados.length} pagos anulados completado.`);
}

function _analizarErrores() {
  console.log("INSPECTOR: _analizarErrores llamado");
  if (
    !window.cacheData ||
    !window.cacheData.rows ||
    !window.cacheData.headers
  ) {
    console.warn(
      "INSPECTOR: No hay datos precargados en window.cacheData:",
      window.cacheData
    );
    _updateStatus(
      "Es necesario precargar una hoja para analizar Pagos rechazados.",
      true
    );
    return;
  }

  const headers = window.cacheData.headers;
  // Normalizador: quita tildes, pasa a minúsculas y quita espacios
  const normalizar = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Diccionario de variantes aceptadas
  const variantes = {
    estado: ["estado"],
    msg: ["mensaje de respuesta", "mensaje respuesta", "mensaje"],
    autorizador: ["autorizador"],
    comercio: ["comercio"],
  };

  // Busca el índice de la primera coincidencia de variante
  function buscarIdx(variantes) {
    for (let i = 0; i < headers.length; i++) {
      const hNorm = normalizar(headers[i]);
      if (variantes.some((v) => hNorm === normalizar(v))) return i;
    }
    return -1;
  }

  const idxEstado = buscarIdx(variantes.estado);
  const idxMsg = buscarIdx(variantes.msg);
  const idxAutorizador = buscarIdx(variantes.autorizador);
  const idxComercio = buscarIdx(variantes.comercio);
  console.log("INSPECTOR: Índices de columnas para análisis de rechazados:", {
    idxEstado,
    idxMsg,
    idxAutorizador,
    idxComercio,
  });

  if (
    idxEstado === -1 ||
    idxMsg === -1 ||
    idxAutorizador === -1 ||
    idxComercio === -1
  ) {
    console.error(
      "INSPECTOR: Faltan columnas requeridas para el análisis de rechazados.",
      { idxEstado, idxMsg, idxAutorizador, idxComercio, headers }
    );
    _updateStatus(
      'Faltan columnas requeridas ("Estado", "Mensaje de respuesta", "Autorizador", "Comercio") para el análisis.',
      true
    );
    return;
  }

  const rechazados = window.cacheData.rows.filter((row) => {
    const estado = String(row[idxEstado] ?? "").toLowerCase();
    return estado.includes("rechazado");
  });
  console.log(
    "INSPECTOR: Cantidad de pagos rechazados encontrados:",
    rechazados.length
  );

  if (rechazados.length === 0) {
    console.info(
      "INSPECTOR: No se encontraron pagos rechazados en los datos precargados."
    );
    _renderizarTabla(
      [],
      ["Mensaje de Respuesta", "Autorizador", "Web", "App", "Total"],
      [],
      []
    );
    _updateStatus("No se encontraron pagos rechazados.");
    return;
  }

  const resumen = {};

  rechazados.forEach((row) => {
    const msg = row[idxMsg] || "Error desconocido";
    const autorizador = row[idxAutorizador] || "N/A";
    const comercio = (row[idxComercio] || "").toUpperCase();
    const key = `${msg}|${autorizador}`;
    if (!resumen[key]) {
      resumen[key] = { msg, autorizador, web: 0, app: 0 };
    }
    if (comercio.includes("APP")) {
      resumen[key].app++;
    } else {
      resumen[key].web++;
    }
  });
  console.log("INSPECTOR: Resumen de pagos rechazados:", resumen);

  const filasResumen = Object.values(resumen)
    .map((data) => [
      data.msg,
      data.autorizador,
      data.web,
      data.app,
      data.web + data.app,
    ])
    .sort((a, b) => b[4] - a[4]); // ordenado por total descendente

  _renderizarTabla(
    filasResumen,
    ["Mensaje de Respuesta", "Autorizador", "Web", "App", "Total"],
    [0, 1, 2, 3, 4],
    ["Mensaje de Respuesta", "Autorizador", "Web", "App", "Total"]
  );

  _updateStatus(
    `Análisis de ${rechazados.length} pagos rechazados completado.`
  );
  console.log("INSPECTOR: Análisis de pagos rechazados completado.");
}

// Si necesitas exponer helpers para otros módulos:
// export { _cargarLibreriaSortable };
