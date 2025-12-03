// ES Module para Gestión de Whitelist (Clientes Fieles)
// TODO: Implementar autenticación real cuando esté lista
// import { requireSession } from '../shared/authService.js';
// import { getWhitelist, addWhitelist } from '../shared/apiService.js';

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
  const tableBody = document.getElementById("whitelistTableBody");
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
        <td colspan="8" class="table-empty">
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

  // Renderizar tabla
  data.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.nombre || "-"}</td>
      <td>${item.documento || "-"}</td>
      <td>${item.correo || "-"}</td>
      <td>${item.telefono || "-"}</td>
      <td>${item.direccion || "-"}</td>
      <td>${item.tarjetas || "-"}</td>
      <td>${formatFechaUTC3(item.fecha)}</td>
      <td>${item.comentarios || "-"}</td>
    `;
    tableBody.appendChild(row);
  });

  // Renderizar cards mobile
  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "mobile-card";
    card.innerHTML = `
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
      ${
        item.telefono
          ? `
      <div class="mobile-card-row">
        <span class="mobile-card-label">Teléfono</span>
        <span class="mobile-card-value">${item.telefono}</span>
      </div>
      `
          : ""
      }
      ${
        item.direccion
          ? `
      <div class="mobile-card-row">
        <span class="mobile-card-label">Dirección</span>
        <span class="mobile-card-value">${item.direccion}</span>
      </div>
      `
          : ""
      }
      ${
        item.tarjetas
          ? `
      <div class="mobile-card-row">
        <span class="mobile-card-label">Tarjetas</span>
        <span class="mobile-card-value">${item.tarjetas}</span>
      </div>
      `
          : ""
      }
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
    `;
    mobileCards.appendChild(card);
  });
}

function filtrarClientes(data, filtro) {
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
        .includes(filtro) ||
      String(item.telefono || "")
        .toLowerCase()
        .includes(filtro) ||
      String(item.direccion || "")
        .toLowerCase()
        .includes(filtro) ||
      String(item.tarjetas || "")
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

function ordenarClientes(data, orden) {
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
async function fetchClientes() {
  try {
    console.log("Fetching clientes from API Gateway...");
    const response = await fetch("/api/gateway?module=whitelist&action=list");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    console.log("API Gateway Response:", data);

    if (!data.success) {
      throw new Error(data.message || "Error al obtener datos");
    }

    const arrayData = data.data || [];
    if (arrayData.length === 0) return [];
    // Primera fila: headers, siguientes filas: datos
    // Nuevo orden: documento, correo, nombre, telefono, direccion, tarjeta1, tarjeta2, tarjeta3, tarjeta4, fecha, comentarios
    const clientes = arrayData.slice(1).map((row) => {
      // Combinar las tarjetas en un solo string separado por comas
      const tarjetas = [row[5], row[6], row[7], row[8]]
        .filter((t) => t && String(t).trim())
        .join(", ");

      return {
        documento: row[0] || "",
        correo: row[1] || "",
        nombre: row[2] || "",
        telefono: row[3] || "",
        direccion: row[4] || "",
        tarjetas: tarjetas || "",
        fecha: row[9] || "",
        comentarios: row[10] || "",
      };
    });

    console.log("Clientes procesados:", clientes.length);
    return clientes;
  } catch (e) {
    console.error("Error obteniendo datos del API Gateway:", e);
    return [];
  }
}

// --- PANEL DE ESTADÍSTICAS CON ACORDEÓN ---
function renderClientesStats(data) {
  const statTotal = document.getElementById("statTotal");
  const statLogueados = document.getElementById("statLogueados");
  const statNoLogueados = document.getElementById("statNoLogueados");
  const statsBadge = document.getElementById("statsBadge");
  const statsTimeline = document.getElementById("statsTimeline");

  if (!statTotal || !statsTimeline) return;

  let total = data.length;
  let logueados = 0,
    noLogueados = 0;
  const clientesPorMes = {};

  data.forEach((item) => {
    // En whitelist todos están logueados, pero contamos los que tienen tarjetas vs los que no
    const tieneTarjetas =
      item.tarjetas && String(item.tarjetas).trim().length > 0;
    if (tieneTarjetas) {
      logueados++; // Con tarjetas registradas
    } else {
      noLogueados++; // Sin tarjetas aún
    }
    // Agrupar por mes
    const d = item.fecha ? parseFecha(item.fecha) : null;
    if (d && !isNaN(d.getTime())) {
      const mesKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      clientesPorMes[mesKey] = (clientesPorMes[mesKey] || 0) + 1;
    }
  });

  // Actualizar valores
  statTotal.textContent = total;
  statLogueados.textContent = logueados;
  statNoLogueados.textContent = noLogueados;
  statsBadge.textContent = total;

  // Ordenar meses (descendente) y mostrar timeline
  const mesesOrdenados = Object.keys(clientesPorMes).sort((a, b) =>
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
        <span class="timeline-count">${clientesPorMes[mesKey]}</span>
      </div>
    `;
  });

  statsTimeline.innerHTML =
    htmlTimeline || `<div class="timeline-item"><span>Sin datos</span></div>`;
}

async function onEnter() {
  const form = document.getElementById("whitelist-form");
  const mensaje = document.getElementById("mensaje");
  const btn = form.querySelector(".btn-primario");
  const btnText = btn.querySelector(".btn-text");
  const btnSpinner = btn.querySelector(".btn-spinner");

  // Obtener referencias ANTES de definir funciones que las usan
  const ordenarSelect = document.getElementById("ordenarWhitelist");
  const buscador = document.getElementById("buscadorWhitelist");

  console.log("🔍 Elementos obtenidos:", {
    ordenarSelect: !!ordenarSelect,
    buscador: !!buscador,
    buscadorValue: buscador ? buscador.value : "NO ENCONTRADO",
  });

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
  let clientes = await fetchClientes();
  renderClientesStats(clientes);

  let ordenActual = "fecha-desc";
  function renderFiltradoYOrdenado() {
    const filtro = buscador ? buscador.value : "";
    console.log(
      "🔍 Filtrando con:",
      filtro,
      "| Total clientes:",
      clientes.length
    );
    const filtradas = filtrarClientes(clientes, filtro);
    console.log("📊 Resultados filtrados:", filtradas.length);
    const ordenadas = ordenarClientes(filtradas, ordenActual);
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

    // Validar duplicados por documento o correo
    const doc = String(form.documento.value || "")
      .trim()
      .toLowerCase();
    const correo = String(form.correo.value || "")
      .trim()
      .toLowerCase();

    const existe = clientes.some(
      (p) =>
        (p.documento && String(p.documento).toLowerCase() === doc) ||
        (p.correo && String(p.correo).toLowerCase() === correo)
    );

    if (existe) {
      mensaje.textContent =
        "❌ El documento o correo ya existe en la whitelist.";
      mensaje.style.color = "#ff5555";
      mensaje.style.display = "block";
      setTimeout(() => {
        mensaje.style.display = "none";
        mensaje.textContent = "✅ ¡Cliente agregado con éxito!";
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
        "direccion",
        "telefono",
        "tarjetas",
        "comentarios",
      ];
      for (const fieldName of requiredFields) {
        if (!form[fieldName]) {
          console.error(`Campo faltante: ${fieldName}`);
          throw new Error(`Campo del formulario no encontrado: ${fieldName}`);
        }
      }

      // Procesar tarjetas: separar por comas y enviar cada una
      const tarjetasInput = (form.tarjetas.value || "").trim();
      const tarjetasArray = tarjetasInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .slice(0, 4); // Máximo 4 tarjetas

      // Enviar datos a través del API Gateway
      const formData = {
        documento: form.documento.value || "",
        correo: form.correo.value || "",
        nombre: form.nombre.value || "",
        telefono: form.telefono.value || "",
        direccion: form.direccion.value || "",
        tarjeta1: tarjetasArray[0] || "",
        tarjeta2: tarjetasArray[1] || "",
        tarjeta3: tarjetasArray[2] || "",
        tarjeta4: tarjetasArray[3] || "",
        comentarios: form.comentarios.value || "",
      };

      console.log("Enviando al API Gateway:", formData);
      const response = await fetch("/api/gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: "whitelist",
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
      mensaje.textContent = "✅ ¡Cliente agregado con éxito!";
      mensaje.style.color = "#00cc99";
      mensaje.style.display = "block";
      form.reset();

      // Refrescar datos después de enviar
      clientes = await fetchClientes();
      renderClientesStats(clientes);
      renderFiltradoYOrdenado();

      setTimeout(() => {
        mensaje.style.display = "none";
        btn.disabled = false;
        btnText.style.display = "inline";
        btnSpinner.style.display = "none";
      }, 3000);
    } catch (error) {
      console.error("Error agregando cliente a whitelist:", error);
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

function onLeave() {
  // Limpieza si es necesario
}

export { onEnter, onLeave };

// Inicializar el módulo cuando el DOM esté completamente listo
function initModule() {
  console.log("🔍 Intentando inicializar módulo whitelist...");
  const buscador = document.getElementById("buscadorWhitelist");
  if (buscador) {
    console.log("✅ Buscador encontrado, inicializando módulo");
    onEnter();
  } else {
    console.log("⏳ Buscador aún no disponible, esperando...");
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
