/**
 * dashboard-layout.js
 * Módulo centralizado para la arquitectura del dashboard.
 * - Inyecta dinámicamente el Header y la Sidebar.
 * - Gestiona el renderizado condicional del menú según el rol del usuario.
 * - Controla la interactividad (toggle de sidebar, cambio de tema).
 * - Carga dinámicamente el contenido de cada módulo en el área principal.
 */

// === CONFIGURACIÓN DE DEMO (Roles y Menú) ===
const CURRENT_USER = {
  name: "Diego A.",
  role: "admin", // Cambiar a 'editor' o 'viewer' para probar
};

const MENU_ITEMS = [
  {
    id: "dashboard",
    text: "Dashboard",
    icon: "ti-home",
    roles: ["admin", "editor", "viewer"],
    href: "index.html",
  },
  {
    id: "inspector",
    text: "Inspector de Pagos",
    icon: "ti-search",
    roles: ["admin", "editor"],
    href: "inspector.html",
  },
  {
    id: "form-fraudes",
    text: "Form. Fraudes",
    icon: "ti-alert-triangle",
    roles: ["admin", "editor"],
    href: "form-fraudes.html",
  },
  {
    id: "form-whitelist",
    text: "Whitelist Clientes",
    icon: "ti-heart",
    roles: ["admin", "editor"],
    href: "form-whitelist.html",
  },
  {
    id: "alertas",
    text: "Monitor Alertas",
    icon: "ti-bell",
    roles: ["admin", "editor", "viewer"],
    href: "alertas.html",
  },
  {
    id: "config-alertas",
    text: "Config. Alertas",
    icon: "ti-settings-automation",
    roles: ["admin"],
    href: "config-alertas.html",
  },
  // === EJEMPLO DE ESQUELETO BASE ===
  // Copia y pega este bloque para agregar nuevos módulos
  {
    id: "html-base", // ID único para el módulo (usado internamente)
    text: "HTML Base", // Texto que aparece en el menú lateral
    icon: "ti-template", // Icono de Tabler Icons (busca en tabler-icons.io)
    roles: ["admin"], // Quién puede ver esto: 'admin', 'editor', 'viewer'
    href: "html-base.html", // El nombre EXACTO de tu archivo HTML
  },
];

/**
 * Genera el HTML para la barra de navegación lateral (Sidebar).
 * Filtra los ítems del menú basados en el rol del CURRENT_USER.
 * @returns {string} El string HTML de la sidebar.
 */
function createSidebarHTML() {
  const accessibleMenuItems = MENU_ITEMS.filter((item) =>
    item.roles.includes(CURRENT_USER.role)
  );

  const menuItemsHTML = accessibleMenuItems
    .map((item) => {
      // Determina si el ítem está activo comparando con la URL actual
      const currentPath = window.location.pathname;
      // Compara la ruta completa para módulos en subdirectorios
      const isActive = currentPath.endsWith(item.href);
      return `
            <li class="menu-item ${isActive ? "active" : ""}">
                <a href="${item.href || "#"}">
                    <div class="icon-container"><i class="ti ${
                      item.icon
                    }"></i></div>
                    <span class="menu-text">${item.text}</span>
                </a>
            </li>
        `;
    })
    .join("");

  return `
        <aside class="sidebar">
            <ul class="sidebar-menu">
                ${menuItemsHTML}
            </ul>
        </aside>
    `;
}

/**
 * Genera el HTML para la barra superior (Header).
 * @returns {string} El string HTML del header.
 */
function createHeaderHTML() {
  return `
        <header class="header">
            <div class="header-left">
                <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">
                    <i class="ti ti-menu-2"></i>
                </button>
                <div class="logo">
                    <i class="ti ti-chess"></i>
                    <span>YERBIT</span>
                </div>
            </div>
            <div class="header-right">
                <button class="theme-switch" id="themeSwitch" aria-label="Switch theme">
                    <i class="ti ti-sun"></i>
                </button>
                <a href="#" class="header-icon" aria-label="Notifications"><i class="ti ti-bell"></i></a>
                <a href="#" class="header-icon" aria-label="User profile"><i class="ti ti-user-circle"></i></a>
            </div>
        </header>
    `;
}

/**
 * Inicializa los listeners de eventos para la interactividad del layout.
 * - Toggle de la Sidebar.
 * - Cambio de tema (Dark/Light).
 */
function initializeEventListeners() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const themeSwitch = document.getElementById("themeSwitch");
  const container = document.querySelector(".dashboard-container");
  const body = document.body;
  const themeIcon = themeSwitch.querySelector("i");

  // 1. Listener para el toggle de la sidebar
  if (sidebarToggle && container) {
    sidebarToggle.addEventListener("click", () => {
      container.classList.toggle("collapsed");
    });
  }

  // 2. Listener para el cambio de tema
  if (themeSwitch && body) {
    // Cargar tema guardado
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
      body.classList.add("light-theme");
      document.documentElement.setAttribute("data-coreui-theme", "light");
      themeIcon.classList.replace("ti-moon", "ti-sun");
    } else {
      document.documentElement.setAttribute("data-coreui-theme", "dark");
      themeIcon.classList.replace("ti-sun", "ti-moon");
    }

    themeSwitch.addEventListener("click", () => {
      body.classList.toggle("light-theme");
      const isLight = body.classList.contains("light-theme");
      localStorage.setItem("theme", isLight ? "light" : "dark");

      // Actualizar data-coreui-theme para módulos que lo usen
      document.documentElement.setAttribute(
        "data-coreui-theme",
        isLight ? "light" : "dark"
      );

      // Cambiar icono
      if (isLight) {
        themeIcon.classList.replace("ti-moon", "ti-sun");
      } else {
        themeIcon.classList.replace("ti-sun", "ti-moon");
      }
    });
  }
}

/**
 * Función principal de inicialización del dashboard.
 * Se asegura de que el DOM esté cargado, luego inyecta el layout
 * y activa los listeners.
 */
function initializeDashboard() {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".dashboard-container");
    if (!container) {
      console.error(
        'Error: Contenedor principal ".dashboard-container" no encontrado.'
      );
      return;
    }

    // Inyectar el layout HTML
    const headerHTML = createHeaderHTML();
    const sidebarHTML = createSidebarHTML();

    // Insertar el HTML en el contenedor
    // Usamos un div temporal para no afectar el mainContent existente
    const layoutWrapper = document.createElement("div");
    layoutWrapper.innerHTML = headerHTML + sidebarHTML;

    while (layoutWrapper.firstChild) {
      container.insertBefore(
        layoutWrapper.firstChild,
        container.querySelector("main")
      );
    }

    // Adjuntar los listeners de eventos
    initializeEventListeners();

    // Cargar el contenido del módulo en el área principal
    loadModuleContent();
  });
}

/**
 * Carga el contenido específico del módulo en el área principal (mainContent).
 * Busca un div con id="module-content" y lo inserta en mainContent.
 * Si no existe, mantiene el contenido por defecto.
 */
function loadModuleContent() {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  // Detecta la ruta del archivo actual (incluyendo subdirectorios)
  const currentPath = window.location.pathname;
  const currentFile = currentPath.split("/").pop();

  // Si es index.html, no hace falta cargar nada (ya está el contenido)
  if (currentFile === "index.html") return;

  // IMPORTANTE: Si el contenido del módulo ya existe en el mainContent,
  // no hace falta hacer fetch porque causaría que se pierdan los event listeners
  const existingModuleContent = mainContent.querySelector("#module-content");
  if (existingModuleContent && existingModuleContent.children.length > 0) {
    console.log("✅ Contenido del módulo ya presente, no se hace fetch");
    return;
  }

  // Carga el HTML del módulo y lo inserta en mainContent
  console.log("🔄 Cargando contenido del módulo desde:", currentPath);
  fetch(currentPath)
    .then((response) => response.text())
    .then((html) => {
      // Extrae el contenido del div con id="module-content"
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const moduleContent = tempDiv.querySelector("#module-content");
      if (moduleContent) {
        mainContent.innerHTML = moduleContent.innerHTML;
        console.log("✅ Contenido del módulo cargado desde fetch");
      }
    })
    .catch((err) => {
      console.error("Error al cargar el módulo:", err);
      mainContent.innerHTML = "<p>Error al cargar el módulo.</p>";
    });
}

// --- Punto de Entrada ---
initializeDashboard();
