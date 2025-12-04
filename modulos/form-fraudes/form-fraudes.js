// ES Module para Registro de Fraudes
// TODO: Implementar autenticación real cuando esté lista
// import { requireSession } from '../shared/authService.js';
// import { getFraudes, addFraude } from '../shared/apiService.js';

// TODO: Validar sesión antes de cualquier lógica
// requireSession(['admin']);

function formatFechaUTC3(fechaIso) {
  if (!fechaIso) return "-";

  try {
    let date;

    // Intentar diferentes formatos de fecha
    if (fechaIso.includes("/")) {
      // Formato DD/MM/YYYY o MM/DD/YYYY - intentar parsear
      const parts = fechaIso.split(/[\/\s:]+/);
      if (parts.length >= 3) {
        // Asumir DD/MM/YYYY HH:MM
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Los meses en JS son 0-indexados
        const year = parseInt(parts[2]);
        const hour = parts[3] ? parseInt(parts[3]) : 0;
        const minute = parts[4] ? parseInt(parts[4]) : 0;

        date = new Date(year, month, day, hour, minute);
      } else {
        date = new Date(fechaIso);
      }
    } else {
      // Formato ISO o timestamp
      date = new Date(fechaIso);
    }

    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      console.warn("Fecha inválida:", fechaIso);
      return fechaIso; // Devolver el valor original si no se puede parsear
    }

    // Convertir a UTC-3 (Uruguay/Brasil - Zona horaria de América/Montevideo)
    // UTC-3 significa 3 horas detrás de UTC
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const utcMinus3 = new Date(utcTime + -3 * 3600000); // -3 horas en milisegundos

    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(utcMinus3.getDate())}/${pad(utcMinus3.getMonth() + 1)}/${utcMinus3.getFullYear()} ${pad(utcMinus3.getHours())}:${pad(utcMinus3.getMinutes())}`;
  } catch (error) {
    console.warn("Error parseando fecha:", fechaIso, error);
    return fechaIso;
  }
}

// Renderizar tabla (desktop) y cards (mobile)
function renderDataTable(data) {
  const tableBody = document.getElementById("fraudesTableBody");
  const mobileCards = document.getElementById("mobileCards");

  console.log("🎨 Renderizando tabla con", data ? data.length : 0, "items");

  if (!tableBody || !mobileCards) {
    console.error("❌ Containers no encontrados");
    return;
  }

  // Limpiar contenedores
  tableBody.innerHTML = "";
  mobileCards.innerHTML = "";

  if (!data || data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
          <i class="ti ti-inbox"></i>
          <div>No se encontraron resultados</div>
        </td>
      </tr>
    `;
    mobileCards.innerHTML = `
      <div class="table-empty">
        <i class="ti ti-inbox"></i>
        <div>No se encontraron resultados</div>
      </div>
    `;
    return;
  }

  console.log("✅ Renderizando", data.length, "registros");

  // Usar DocumentFragment para mejorar performance
  const tableFragment = document.createDocumentFragment();
  const cardsFragment = document.createDocumentFragment();

  // Renderizar tabla en lotes
  const batchSize = 50;
  let tableHTML = "";
  let cardsHTML = "";

  data.forEach((item, index) => {
    // Acumular HTML de tabla
    tableHTML += `
      <tr>
        <td>${item.nombre || "-"}</td>
        <td>${item.documento || "-"}</td>
        <td>${item.correo || "-"}</td>
        <td>${formatFechaUTC3(item.fecha)}</td>
        <td>${item.comentarios || "-"}</td>
      </tr>
    `;

    // Acumular HTML de cards
    cardsHTML += `
      <div class="mobile-card">
        <div class="mobile-card-header">
          <div class="mobile-card-avatar">${(item.nombre?.[0] || "").toUpperCase()}</div>
          <div>
            <div class="mobile-card-name">${item.nombre || "-"}</div>
            <div class="mobile-card-email">${item.correo || "-"}</div>
          </div>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">Documento</span>
          <span class="mobile-card-value">${item.documento || "-"}</span>
        </div>
        <div class="mobile-card-row">
          <span class="mobile-card-label">Fecha</span>
          <span class="mobile-card-value">${formatFechaUTC3(item.fecha)}</span>
        </div>
        ${
          item.comentarios
            ? `
          <div class="mobile-card-row">
            <span class="mobile-card-label">Comentarios</span>
            <span class="mobile-card-value">${item.comentarios}</span>
          </div>
        `
            : ""
        }
      </div>
    `;

    // Insertar en lotes para mantener la UI responsive
    if ((index + 1) % batchSize === 0 || index === data.length - 1) {
      const tempTable = document.createElement("tbody");
      tempTable.innerHTML = tableHTML;
      while (tempTable.firstChild) {
        tableFragment.appendChild(tempTable.firstChild);
      }

      const tempCards = document.createElement("div");
      tempCards.innerHTML = cardsHTML;
      while (tempCards.firstChild) {
        cardsFragment.appendChild(tempCards.firstChild);
      }

      tableHTML = "";
      cardsHTML = "";
    }
  });

  // Insertar todo de una vez
  tableBody.appendChild(tableFragment);
  mobileCards.appendChild(cardsFragment);
}

// Helper para logueado
function mostrarLogueado(item) {
  if (item.documento && (item.documento + "").toLowerCase() === "no logueado")
    return '<span style="color:#f4a236;font-weight:500;">No</span>';
  if (item.logueado === "Sí" || item.logueado === true) return "Sí";
  if (item.logueado === "No" || item.logueado === false) return "No";
  return "-";
}

function filtrarMiniCards(data, filtro) {
  filtro = (filtro || "").trim().toLowerCase();
  if (!filtro) return data;
  return data.filter(
    (item) =>
      String(item.documento || "")
        .toLowerCase()
        .includes(filtro) ||
      String(item.nombre || "")
        .toLowerCase()
        .includes(filtro) ||
      String(item.correo || "")
        .toLowerCase()
        .includes(filtro)
  );
}

/**
 * Parsea una fecha en diferentes formatos y devuelve un objeto Date válido
 * Maneja formatos: DD/MM/YYYY HH:MM, D/MM/YYYY HH:MM:SS, etc.
 */
function parseFecha(fechaStr) {
  if (!fechaStr) return new Date(0); // Fecha muy antigua para ordenamiento

  try {
    // Si es formato DD/MM/YYYY o D/MM/YYYY (con o sin hora)
    if (fechaStr.includes("/")) {
      const parts = fechaStr.split(/[\/\s:]+/);
      if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript usa meses 0-indexados
        const year = parseInt(parts[2]);
        const hour = parts[3] ? parseInt(parts[3]) : 0;
        const minute = parts[4] ? parseInt(parts[4]) : 0;
        const second = parts[5] ? parseInt(parts[5]) : 0;

        // Validar que los valores sean válidos
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year > 1900) {
          const date = new Date(year, month, day, hour, minute, second);
          return isNaN(date.getTime()) ? new Date(0) : date;
        }
      }
    }

    // Formato ISO o otros
    const date = new Date(fechaStr);
    return isNaN(date.getTime()) ? new Date(0) : date;
  } catch {
    return new Date(0);
  }
}

function ordenarMiniCards(data, orden) {
  if (orden === "fecha-asc") {
    return [...data].sort((a, b) => {
      const dateA = parseFecha(a.fecha);
      const dateB = parseFecha(b.fecha);
      return dateA - dateB;
    });
  } else if (orden === "fecha-desc") {
    return [...data].sort((a, b) => {
      const dateA = parseFecha(a.fecha);
      const dateB = parseFecha(b.fecha);

      // Debug: veamos las fechas que se están comparando
      console.log(
        `Comparando: "${a.fecha}" (${dateA.toISOString()}) vs "${b.fecha}" (${dateB.toISOString()})`
      );

      return dateB - dateA;
    });
  } else if (orden === "az") {
    return [...data].sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", "es", {
        sensitivity: "base",
      })
    );
  } else if (orden === "za") {
    return [...data].sort((a, b) =>
      (b.nombre || "").localeCompare(a.nombre || "", "es", {
        sensitivity: "base",
      })
    );
  }
  return data;
}

// Obtener datos reales desde API Gateway
async function fetchPersonas() {
  try {
    console.log("Fetching personas from API Gateway...");
    const response = await fetch("/api/gateway?module=fraudes&action=list");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    console.log("API Gateway Response:", data);

    if (!data.success) {
      throw new Error(data.message || "Error al obtener datos");
    }

    const arrayData = data.data || [];
    if (arrayData.length === 0) return [];
    // Primera fila: headers, siguientes filas: datos
    // Nuevo orden: documento, correo, nombre, comentarios, fecha, logueado
    const personas = arrayData.slice(1).map((row) => ({
      documento: row[0] || "",
      correo: row[1] || "",
      nombre: row[2] || "",
      comentarios: row[3] || "",
      fecha: row[4] || "",
      logueado: row[5] || "",
    }));

    console.log("Personas procesadas:", personas.length);
    return personas;
  } catch (e) {
    console.error("Error obteniendo datos del API Gateway:", e);
    return [];
  }
}
// --- PANEL DE ESTADÍSTICAS CON ACORDEÓN ---
function renderBloqueadosStats(data) {
  const statTotal = document.getElementById("statTotal");
  const statLogueados = document.getElementById("statLogueados");
  const statNoLogueados = document.getElementById("statNoLogueados");
  const statsBadge = document.getElementById("statsBadge");
  const statsTimeline = document.getElementById("statsTimeline");

  if (!statTotal || !statsTimeline) return;

  let total = data.length;
  let logueados = 0,
    noLogueados = 0;
  const bloqueadosPorMes = {};

  data.forEach((item) => {
    let esNoLogueado =
      String(item.documento || "")
        .trim()
        .toLowerCase() === "no logueado" ||
      !item.documento ||
      !/^\d+$/g.test(item.documento);
    if (esNoLogueado) {
      noLogueados++;
    } else {
      logueados++;
    }
    // Agrupar por mes
    const d = item.fecha ? parseFecha(item.fecha) : null;
    if (d && !isNaN(d.getTime())) {
      const mesKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      bloqueadosPorMes[mesKey] = (bloqueadosPorMes[mesKey] || 0) + 1;
    }
  });

  // Actualizar valores
  statTotal.textContent = total;
  statLogueados.textContent = logueados;
  statNoLogueados.textContent = noLogueados;
  statsBadge.textContent = total;

  // Ordenar meses (descendente) y mostrar timeline
  const mesesOrdenados = Object.keys(bloqueadosPorMes).sort((a, b) =>
    b.localeCompare(a)
  );

  let htmlTimeline = "";
  mesesOrdenados.slice(0, 12).forEach((mesKey) => {
    const [anio, mes] = mesKey.split("-");
    const labelMes = new Date(anio, mes - 1).toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
    htmlTimeline += `
      <div class="timeline-item">
        <span class="timeline-month">${labelMes}</span>
        <span class="timeline-count">${bloqueadosPorMes[mesKey]}</span>
      </div>
    `;
  });

  statsTimeline.innerHTML =
    htmlTimeline || `<div class="timeline-item"><span>Sin datos</span></div>`;
}

async function onEnter() {
  // layout is rendered in fraudes.html via renderLayout, no need to call loadLayout here
  const form = document.getElementById("fraude-form");
  const mensaje = document.getElementById("mensaje");
  const btn = form.querySelector(".btn-primario");
  const btnText = btn.querySelector(".btn-text");
  const btnSpinner = btn.querySelector(".btn-spinner");
  const noLogueadoCheckbox = document.getElementById("no_logueado");
  const documentoInput = document.getElementById("documento");

  // Obtener referencias ANTES de definir funciones que las usan
  const ordenarSelect = document.getElementById("ordenarMiniCards");
  const buscador = document.getElementById("buscadorFraude");

  console.log("🔍 Elementos obtenidos:", {
    ordenarSelect: !!ordenarSelect,
    buscador: !!buscador,
    buscadorValue: buscador ? buscador.value : "NO ENCONTRADO",
  });

  // Lógica para autocompletar documento cuando marca "No logueado"
  if (noLogueadoCheckbox && documentoInput) {
    function updateDocumentoField() {
      if (noLogueadoCheckbox.checked) {
        documentoInput.value = "No logueado";
        documentoInput.readOnly = true;
        documentoInput.classList.add("readonly-doc");
      } else {
        documentoInput.value = "";
        documentoInput.readOnly = false;
        documentoInput.classList.remove("readonly-doc");
      }
    }
    noLogueadoCheckbox.addEventListener("change", updateDocumentoField);
    updateDocumentoField(); // Inicializar
  }

  // Inicializar acordeón de estadísticas
  const statsToggle = document.getElementById("statsToggle");
  const statsContent = document.getElementById("statsContent");

  if (statsToggle && statsContent) {
    statsToggle.addEventListener("click", () => {
      statsToggle.classList.toggle("active");
      statsContent.classList.toggle("open");
    });
  }

  // Obtener datos reales
  let personas = await fetchPersonas();
  renderBloqueadosStats(personas);

  let ordenActual = "fecha-desc";
  function renderFiltradoYOrdenado() {
    const filtro = buscador ? buscador.value : "";
    console.log(
      "🔍 Filtrando con:",
      filtro,
      "| Total personas:",
      personas.length
    );
    const filtradas = filtrarMiniCards(personas, filtro);
    console.log("📊 Resultados filtrados:", filtradas.length);
    const ordenadas = ordenarMiniCards(filtradas, ordenActual);
    renderDataTable(ordenadas);
  }
  renderFiltradoYOrdenado();
  if (ordenarSelect) {
    ordenarSelect.value = ordenActual;
    ordenarSelect.addEventListener("change", () => {
      ordenActual = ordenarSelect.value;
      renderFiltradoYOrdenado();
    });
  }
  if (buscador) {
    console.log("✅ Agregando evento input al buscador");
    buscador.addEventListener("input", (e) => {
      console.log("🔍 Buscador input event:", e.target.value);
      renderFiltradoYOrdenado();
    });
  } else {
    console.error("❌ Buscador no encontrado en el DOM");
  }

  // Envío del formulario
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    btn.disabled = true;
    btnText.style.display = "none";
    btnSpinner.style.display = "inline-flex";

    // Validar duplicados
    const doc = String(form.documento.value || "")
      .trim()
      .toLowerCase();
    const correo = String(form.correo.value || "")
      .trim()
      .toLowerCase();
    let existe = false;
    if (doc === "no logueado") {
      // Solo validar duplicado por correo
      existe = personas.some(
        (p) => p.correo && String(p.correo).toLowerCase() === correo
      );
    } else {
      // Validar duplicado por documento o correo
      existe = personas.some(
        (p) =>
          (p.documento && String(p.documento).toLowerCase() === doc) ||
          (p.correo && String(p.correo).toLowerCase() === correo)
      );
    }
    if (existe) {
      mensaje.textContent = "❌ El documento o correo ya existe. No se agregó.";
      mensaje.style.color = "#ff5555";
      mensaje.style.display = "block";
      setTimeout(() => {
        mensaje.style.display = "none";
        mensaje.textContent = "✅ ¡Reporte enviado con éxito!";
        mensaje.style.color = "#00cc99";
        btn.disabled = false;
        btnText.style.display = "inline";
        btnSpinner.style.display = "none";
      }, 3000);
      return;
    }

    try {
      // Verificar que el formulario y sus campos existan
      if (!form) {
        throw new Error("Formulario no encontrado");
      }

      // Verificar campos específicos
      const requiredFields = [
        "documento",
        "correo",
        "nombre",
        "comentarios",
        "no_logueado",
      ];
      for (const fieldName of requiredFields) {
        if (!form[fieldName]) {
          console.error(`Campo faltante: ${fieldName}`);
          throw new Error(`Campo del formulario no encontrado: ${fieldName}`);
        }
      }

      // Enviar datos a través del API Gateway
      const formData = {
        documento: form.documento.value || "",
        correo: form.correo.value || "",
        nombre: form.nombre.value || "",
        comentarios: form.comentarios.value || "",
        logueado: form.no_logueado.checked ? "No" : "Sí",
      };

      console.log("Enviando al API Gateway:", formData);
      const response = await fetch("/api/gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: "fraudes",
          action: "add",
          ...formData,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Error al enviar datos");
      }

      // Éxito
      mensaje.textContent = "✅ ¡Reporte enviado con éxito!";
      mensaje.style.color = "#00cc99";
      mensaje.style.display = "block";
      form.reset();

      // Refrescar datos después de enviar
      personas = await fetchPersonas();
      renderBloqueadosStats(personas);
      renderFiltradoYOrdenado();

      setTimeout(() => {
        mensaje.style.display = "none";
        btn.disabled = false;
        btnText.style.display = "inline";
        btnSpinner.style.display = "none";
      }, 3000);
    } catch (error) {
      console.error("Error enviando fraude:", error);
      mensaje.textContent = "❌ Error: " + error.message;
      mensaje.style.color = "#ff5555";
      mensaje.style.display = "block";

      setTimeout(() => {
        mensaje.style.display = "none";
        btn.disabled = false;
        btnText.style.display = "inline";
        btnSpinner.style.display = "none";
      }, 3000);
    }
  });
}

// Permite pegar un bloque de texto y autocompletar los campos del formulario
function autocompletarDesdeTexto(texto) {
  // Extraer campos usando regex y heurísticas
  const getCampo = (label, multiLine = false) => {
    const regex = new RegExp(label + ": ?([\s\S]*?)(?:\n|$)", "i");
    const match = texto.match(regex);
    if (!match) return "";
    let val = match[1].trim();
    if (multiLine && val.includes("\n")) val = val.split("\n")[0].trim();
    return val;
  };

  // Nombre completo
  const nombre = getCampo("Nombre");
  // Documento: primer número válido
  let documento = getCampo("Cedula");
  let docMatch = documento.match(/\d+/g);
  documento = docMatch && docMatch.length > 0 ? docMatch[0] : documento;
  if (
    !documento ||
    documento === "0" ||
    documento.toLowerCase().includes("no tiene") ||
    documento.toLowerCase().includes("sin") ||
    documento.length < 3
  ) {
    documento = "No logueado";
  }
  // Correo
  let correo = getCampo("Correo");
  // Comentarios: sumar dirección y otros datos
  let comentarios = "";
  const direccion = getCampo("Dirección de envío", true);
  if (direccion) comentarios += "Dirección: " + direccion;
  // Sumar importe, pedido, etc. si quieres
  const pedido = getCampo("Nro. Pedido");
  if (pedido) comentarios += (comentarios ? " | " : "") + "Pedido: " + pedido;
  const importe = getCampo("Importe");
  if (importe)
    comentarios += (comentarios ? " | " : "") + "Importe: " + importe;
  // Puedes sumar más campos si lo deseas

  // Completar campos en el form (asumiendo ids: documento, correo, nombre, comentarios)
  if (document.getElementById("documento"))
    document.getElementById("documento").value = documento;
  if (document.getElementById("correo"))
    document.getElementById("correo").value = correo;
  if (document.getElementById("nombre"))
    document.getElementById("nombre").value = nombre;
  if (document.getElementById("comentarios"))
    document.getElementById("comentarios").value = comentarios;

  // Aviso si falta correo
  if (!correo) alert("Falta completar el correo.");
}

// Puedes agregar un botón o evento para usar esta función:
// Ejemplo: <button onclick="autocompletarDesdeTexto(document.getElementById('pegar-texto').value)">Pegar y autocompletar</button>
// Y un textarea: <textarea id="pegar-texto"></textarea>
function onLeave() {
  // Por ahora nada, pero podés limpiar eventos o timers si agregás más lógica
}

export { onEnter, onLeave };

// Inicializar el módulo cuando el DOM esté completamente listo
// Esperamos un poco para que el layout manager termine de cargar el contenido
function initModule() {
  console.log("🔍 Intentando inicializar módulo form-fraudes...");
  const buscador = document.getElementById("buscadorFraude");
  if (buscador) {
    console.log("✅ Buscador encontrado, inicializando módulo");
    onEnter();
  } else {
    console.log("⏳ Buscador aún no disponible, esperando...");
    // Reintentar después de un breve delay
    setTimeout(initModule, 100);
  }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 DOMContentLoaded disparado");
    setTimeout(initModule, 50);
  });
} else {
  console.log("📄 DOM ya listo");
  setTimeout(initModule, 50);
}
