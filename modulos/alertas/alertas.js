// n/alertas/alertas.js
// import { autoRequireSession } from '../shared/layout.js'; // Temporalmente deshabilitado

// autoRequireSession(); // Temporalmente deshabilitado

// IMPORTANTE: INSTRUCCIONES PARA HACER FUNCIONAR ESTE MÓDULO
/*
Para que este módulo funcione correctamente, debes:

1. Verificar que exista un registro en la hoja "Sessions" de la spreadsheet de tokens
   con la siguiente información:
   - Email: dsalvetto@farmashop.com.uy
   - Token: abc123456789
   - Timestamp: una fecha reciente (menos de 8 horas)

2. Si necesitas crear este registro, puedes hacerlo manualmente o usar
   el proceso normal de login para generar un token válido.

3. Una vez que tengas un registro válido en la hoja, este módulo funcionará
   porque está configurado para usar ese token específico.
*/
    // URL del script (puede ser una constante si no cambia)
    const SCRIPT_URL_MONITOR_ALERTAS = 'https://script.google.com/macros/s/AKfycbyX9HH80G0wwR14PfcYiT1Qink6LujZO2vz0nTbBLABT2LyGrRspCI6rakRJ1acULfv/exec'; //

    // Elementos del DOM para el modal de detalle
    let alertaModalElement, modalDetalleTituloElement, modalDetalleCuerpoElement, modalDetalleCerrarBtnElement;
    let modalDetalleDatosParseadosDiv; // Añadido para ser consistente con el HTML

    // Elementos del DOM para la lista de alertas positivas
    let listaAlertasContentElement, loadingAlertasElement, noAlertasElement, errorAlertasElement;

    // Elementos del DOM para la tabla de historial
    let cuerpoTablaHistorialElement, loadingHistorialRowElement, noHistorialRowElement, errorHistorialRowElement;
    let sheetLinkElement; // Para el enlace a la hoja de cálculo

    // Array para rastrear event listeners activos y poder removerlos en onLeave
    let activeEventListeners = [];

    // --- verificar cambios de alertas ---
    let intervaloVerificacionCambios = null;
    let ultimoResumenAlertas = null;
    // Contenedores para referencias al DOM. Se llenarán en inicializarModulo.
    let DOM = {};
    // --- Helper para añadir y rastrear Event Listeners ---
    function _addManagedEventListener(element, type, handler, options = false) {
        if (element) {
            element.addEventListener(type, handler, options);
            activeEventListeners.push({ element, type, handler, options });
        } else {
            console.warn(`ALERTAS: Intento de añadir listener a elemento nulo (tipo: ${type})`);
        }
    }

    // --- Función de Petición al Apps Script (appsScriptRequest) ---
    // Esta función es bastante similar a la que ya tienes.
    // Se asume que la sesión (tmpToken, email) se obtiene de localStorage.
    // La validación de sesión ahora es más responsabilidad de main.js antes de entrar a la sección.
    async function _appsScriptRequest(action, params = {}, method = 'GET') {
        console.log("ALERTAS: Preparando solicitud a Apps Script:", action, params, method);
        
        // Token especial para desarrollo que coincide con el token de prueba en patch_alertas.js
        const fakeSession = {
            email: 'dsalvetto@farmashop.com.uy',
            // Este token será aceptado por el parche verificarTmpToken
            token: '550e8400-e29b-41d4-a716-446655440000',
            tmpToken: '550e8400-e29b-41d4-a716-446655440000'
        };
        
        // En producción, usar esto:
        /*
        const sessionStr = localStorage.getItem('session');
        if (!sessionStr) {
            console.error('ALERTAS: Sesión no encontrada en localStorage.');
            window.location.href = '../login/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return Promise.reject(new Error('Sesión no encontrada. Por favor, inicia sesión de nuevo.'));
        }
        let session = JSON.parse(sessionStr);
        */
        
        // Usar la sesión de prueba directamente (reemplazar por la línea anterior en producción)
        const session = fakeSession;
        
        console.log("ALERTAS: Usando sesión:", session);

        const requestPayloadBase = {
            action: action,
            email: session.email,
            token: session.token,       // Para el gateway API
            tmpToken: session.tmpToken  // Para Apps Script directo
        };

        if (method.toUpperCase() === 'GET') {
            const queryParamsData = { ...requestPayloadBase, ...params };
            const queryParams = new URLSearchParams(queryParamsData);
            const fullUrl = `${SCRIPT_URL_MONITOR_ALERTAS}?${queryParams.toString()}`;
            console.log(`ALERTAS: Enviando GET. Acción: ${action}, URL:`, fullUrl);
            console.log(`ALERTAS: Datos completos:`, queryParamsData);
            return fetch(fullUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 
                    'Accept': 'text/plain, application/json'
                }
            })
            .then(response => {
                console.log(`ALERTAS: Respuesta recibida, status:`, response.status, response.statusText);
                if (!response.ok) {
                    console.error(`ALERTAS: Error HTTP ${response.status}: ${response.statusText}`);
                    throw new Error(`ALERTAS: Error HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text().then(text => {
                    console.log(`ALERTAS: Texto de respuesta (primeros 100 chars):`, text.substring(0, 100));
                    return text;
                });
            })
            .then(text => {
                try {
                    // Para texto que podría no ser JSON (prueba de diferentes formatos)
                    let data;
                    try {
                        data = JSON.parse(text);
                        console.log(`ALERTAS: Datos parseados como JSON correctamente:`, data);
                    } catch (e) {
                        console.log(`ALERTAS: El texto no es JSON válido, usándolo como está`);
                        return { success: true, data: text, mensaje: "Respuesta en texto plano" };
                    }
                    
                    // Procesamiento normal de JSON
                    if (data && data.success === false) {
                        console.error(`ALERTAS: Error Apps Script (GET "${action}"):`, data.error || "Error desconocido.");
                        throw new Error(data.error || "Error del servidor en respuesta.");
                    } else if (data && data.error && !data.success) {
                        console.error(`ALERTAS: Error Apps Script (GET "${action}"):`, data.error);
                        throw new Error(data.error);
                    } else {
                        console.log(`ALERTAS: Respuesta GET para "${action}" exitosa:`, data);
                        return data;
                    }
                } catch (parseError) {
                    console.error(`ALERTAS: Error al procesar respuesta GET para "${action}":`, parseError);
                    console.error(`ALERTAS: Texto de respuesta problematico:`, text);
                    throw new Error('Error al procesar respuesta del servidor: ' + parseError.message);
                }
            })
            .catch(error => {
                console.error(`ALERTAS: Error en GET para acción "${action}":`, error);
                throw error;
            });
        } else if (method.toUpperCase() === 'POST') {
            const postBody = { ...requestPayloadBase, ...params };
            console.log(`ALERTAS: Enviando POST. Acción: ${action}, Cuerpo (parcial):`, JSON.stringify(postBody).substring(0, 200) + "...");
            return fetch(SCRIPT_URL_MONITOR_ALERTAS, { //
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postBody)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => {
                        throw new Error(`ALERTAS: Error HTTP ${response.status}: ${response.statusText}`);
                    }).then(errData => {
                        throw new Error(errData.error || errData.message || `ALERTAS: Error HTTP ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success === false) {
                    console.error(`ALERTAS: Operación POST "${action}" falló en servidor:`, data.error || data.message);
                    throw new Error(data.error || data.message || "La operación POST de alertas falló.");
                }
                console.log(`ALERTAS: Respuesta POST para "${action}" exitosa:`, data);
                return data;
            })
            .catch(error => {
                console.error(`ALERTAS: Error en POST para acción "${action}":`, error);
                throw error;
            });
        } else {
            console.error(`ALERTAS: Método HTTP no soportado: ${method}`);
            return Promise.reject(new Error(`Método HTTP no soportado: ${method}`));
        }
    }

     /**
     * Esta función revisa si un elemento clave del HTML ya existe.
     * Si no, se espera un momento y vuelve a intentar.
     */
    const esperarDOM = (callback) => {
        // Revisa si un elemento clave del HTML de 'alertas' ya existe
        const idCritico = 'lista-alertas-content';
        if (document.getElementById(idCritico)) {
            // Si existe, llama a la función para inicializar todo
            callback();
        } else {
            // Si no existe, espera 100 milisegundos y vuelve a revisar
            setTimeout(() => esperarDOM(callback), 100);
        }
    };
    // --- Métodos del Ciclo de Vida del Módulo ---
    
            function inicializarModulo() {
    console.log("DOM para 'alertas' está listo. Inicializando...");
    
        // Obtener referencias a los elementos del DOM ahora que el HTML de la sección está cargado
        alertaModalElement = document.getElementById('alertaDetalleModal'); //
        modalDetalleTituloElement = document.getElementById('modalDetalleTitulo'); //
        modalDetalleCuerpoElement = document.getElementById('modalDetalleCuerpo'); //
        modalDetalleCerrarBtnElement = document.getElementById('modalDetalleCerrarBtn'); //
        modalDetalleDatosParseadosDiv = document.getElementById('modalDetalleDatosParseados'); //

        listaAlertasContentElement = document.getElementById('lista-alertas-content'); //
        loadingAlertasElement = document.getElementById('loading-alertas'); //
        noAlertasElement = document.getElementById('no-alertas'); //
        errorAlertasElement = document.getElementById('error-alertas'); //

        cuerpoTablaHistorialElement = document.getElementById('cuerpo-tabla-historial'); //
        loadingHistorialRowElement = document.getElementById('loading-historial-row'); //
        noHistorialRowElement = document.getElementById('no-historial-row'); //
        errorHistorialRowElement = document.getElementById('error-historial-row'); //
        sheetLinkElement = document.getElementById('sheet-link'); //

        // Verificar si los elementos principales existen para evitar errores
        if (!listaAlertasContentElement || !cuerpoTablaHistorialElement || !alertaModalElement) {
            console.error("ALERTAS: Faltan elementos cruciales del DOM. La sección no puede inicializarse correctamente.");
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                mainContent.innerHTML = `<p class="status-message error-message" style="padding:20px;">Error al cargar la interfaz del Monitor de Alertas. Faltan elementos.</p>`;
            }
            return;
        }

        // Inicializar componentes y cargar datos
        _inicializarModalDetalle();
        _cargarYFiltrarAlertas(); // Carga inicial de datos
        _iniciarAutoVerificacionAlertas(); //verificar si hay nuevas alertas cada 60s
    }


function marcarAlertaComoRevisada(uid) {
  return new Promise(async (resolve, reject) => {
    const sessionStr = localStorage.getItem('session');
    if (!sessionStr) {
      console.error('⚠️ Sesión no encontrada');
      return reject(new Error('Sesión no encontrada'));
    }

    let session;
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {
      console.error('⚠️ Sesión corrupta');
      return reject(new Error('Sesión corrupta'));
    }

    const params = new URLSearchParams({
      action: 'markAsReviewed',
      token: session.tmpToken,
      email: session.email,
      uid: uid
    });

    const fullUrl = `${SCRIPT_URL_MONITOR_ALERTAS}?${params.toString()}`;
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const data = JSON.parse(text);

      if (data && data.success) {
        console.log('✅ Respuesta del servidor:', data);
        resolve(data);
      } else {
        console.error('❌ Error del servidor:', data.message || data.error || 'Error desconocido');
        reject(new Error(data.message || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error de red al contactar el servidor:', error);
      reject(error);
    }
  });
}

// La PARTE 2 contendrá las funciones:
// _inicializarModalDetalle, _abrirModalDetalle, _cerrarModalDetalle,
// _crearElementoAlerta, _cargarYFiltrarAlertas
// ... (fin de la IIFE se cerrará en la última parte)
   // --- Funciones del Modal de Detalle ---
    function _inicializarModalDetalle() {
        // Los elementos del modal ya se obtienen en onEnter()
        if (!alertaModalElement || !modalDetalleCerrarBtnElement) {
            console.error("ALERTAS: Elementos del modal de detalle no están disponibles para inicializar listeners.");
            return;
        }
        _addManagedEventListener(modalDetalleCerrarBtnElement, 'click', _cerrarModalDetalle);
        _addManagedEventListener(alertaModalElement, 'click', (event) => {
            window.cargarYFiltrarAlertas = async function cargarYFiltrarAlertas() {
                _cerrarModalDetalle();
            }
        });
        // Listener para la tecla ESC se añade/remueve en onEnter/onLeave para el documento
    }

    function _escKeyHandlerModal(event) {
        if (event.key === 'Escape' && alertaModalElement && !alertaModalElement.classList.contains('hidden')) { //
            _cerrarModalDetalle();
        }
    }

    function _abrirModalDetalle(titulo, cuerpoEmail, motivoDisparo = '', alerta = {}) {
    if (!alertaModalElement || !modalDetalleTituloElement || !modalDetalleCuerpoElement) return;

    modalDetalleTituloElement.textContent = titulo || "Detalle de Alerta";

    // Box para motivo de disparo (si existe)
    let motivoHtml = '';
    if (motivoDisparo) {
        motivoHtml = `<div class="motivo-alerta-modal">
            <i class="ti ti-info-circle"></i> <strong>Motivo:</strong> ${motivoDisparo}
        </div>`;
    }

    // Box para datos parseados (si existen)
    let datosParseadosHtml = '';
    if (alerta["Datos Parseados"] || alerta["Descripción"]) {
        datosParseadosHtml = `
          <div class="datos-parseados">
            <strong>Datos detectados:</strong><br>
            <pre>${alerta["Datos Parseados"] || alerta["Descripción"]}</pre>
          </div>
          <hr>
        `;
    }

    // Limpieza y resaltado del cuerpo del mail
    let contenidoHtmlProcesado = cuerpoEmail || "Cuerpo del email no disponible.";

    const bloquesAOcultar = [ 
        /(?:\[Farmashop]\s*)?Diego Salvetto[\s\S]*?https:\/\/tienda\.farmashop\.com\.uy\/skin-club/gi,
        /\[https:\/\/www\.farmashop\.com\.uy\/signatures\/_data\/ad-1\.gif\]<\S+>/gi,
        /AVISO DE CONFIDENCIALIDAD:[\s\S]*?El contenido del presente mensaje es privado, estrictamente confidencial y exclusivo para sus destinatarios, pudiendo contener información protegida por normas legales y\/o secreto profesional\. Bajo ninguna circunstancia su contenido puede ser transmitido o revelado a terceros ni divulgado en forma alguna\. En consecuencia, de haberlo recibido por error, solicitamos contactar al remitente de inmediato y eliminarlo de su sistema. No deberá divulgar, distribuir o copiar su contenido\.\./gi, 
        /\[Farmashop\]\s*<< Antes >> de imprimir este mensaje[\s\S]*?gran impacto\./gi,
        /_{10,}\s*$/gm,
        /De: Farmashop <ecommerce@farmashop\.com\.uy>[\s\S]*?<ktettamanti@farmashop\.(?:com\.uy|uy)>/gi,
        /Para: [\s\S]*? E-commerce interno [\s\S]*? ; [\s\S]*? Karina Tettamanti [\s\S]*?  /gi,
    ];
    bloquesAOcultar.forEach((regex) => {
        contenidoHtmlProcesado = contenidoHtmlProcesado.replace(regex, "");
    });
    contenidoHtmlProcesado = contenidoHtmlProcesado.replace(/\n\s*\n{2,}/g, '\n\n').trim();

    const textosAResaltar = ["documento", "usuario", "Información de envío", "Tarjeta:", "Método de envío", "Perfume", "Total general   $"];
    textosAResaltar.forEach(texto => {
        if (texto && typeof texto === 'string' && texto.trim() !== '') {
            const textoEscapado = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regexResaltar = new RegExp(`(${textoEscapado})`, 'gi');
            contenidoHtmlProcesado = contenidoHtmlProcesado.replace(regexResaltar, '<span class="texto-destacado-modal">$1</span>');
        }
    });

    // Seteás el HTML armado de una sola vez
    modalDetalleCuerpoElement.innerHTML = motivoHtml + datosParseadosHtml + `<pre>${contenidoHtmlProcesado}</pre>`;

    if (modalDetalleDatosParseadosDiv) {
        modalDetalleDatosParseadosDiv.innerHTML = '';
        modalDetalleDatosParseadosDiv.style.display = 'none';
    }

    alertaModalElement.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}


    function _cerrarModalDetalle() {
        if (!alertaModalElement) return;
        alertaModalElement.classList.add('hidden'); //
        document.body.style.overflow = 'auto';
    }

    // --- Funciones de Renderizado y Carga de Alertas ---
    function _crearElementoAlerta(alerta, headers, headerMap) {
        const alertaDiv = document.createElement('div');
        alertaDiv.className = 'alerta-item';

        const getVal = (keyNormalizada) => {
            const headerReal = headerMap[keyNormalizada.toLowerCase().trim()];
            return (headerReal && alerta[headerReal] !== undefined && alerta[headerReal] !== null) ? alerta[headerReal] : '';
        };

        const uid = getVal('UID'); //
        if (!uid) {
            console.warn("ALERTAS: Alerta sin UID, no se puede crear elemento:", alerta);
            return null;
        }
        alertaDiv.dataset.uid = uid;

        let asunto = getVal('Asunto') || 'Asunto no disponible'; //
        asunto = asunto.replace(/^(rv: ?|re: ?|fw: ?|fwd: ?)/i, '').trim();

        const fechaOriginal = getVal('Timestamp'); //
        const fechaFormateada = fechaOriginal ?
            new Date(fechaOriginal).toLocaleString('es-UY', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) : 'Fecha desconocida';

        let revisado = getVal('Revisado'); //
        
        // Construir HTML del elemento
        alertaDiv.innerHTML = `
            <div class="alerta-header">
                <span class="alerta-fecha">${fechaFormateada}</span>
                <span class="alerta-estado ${String(revisado).toLowerCase() === 'sí' ? 'revisado' : 'pendiente'}">
                    ${String(revisado).toLowerCase() === 'sí' ? 'Revisado' : 'Pendiente'}
                </span>
            </div>
            <div class="alerta-body">
                <div class="alerta-asunto">${asunto}</div>
            </div>
        `;
        
        // Añadir evento de click para abrir detalle
        alertaDiv.addEventListener('click', () => {
             const cuerpo = getVal('Cuerpo') || getVal('Body') || '';
             const motivo = getVal('Detalles_Disparo') || '';
             _abrirModalDetalle(asunto, cuerpo, motivo, alerta);
        });

        return alertaDiv;
    }

    async function _cargarYFiltrarAlertas() {
        // Verificación de seguridad de elementos DOM
        if (!listaAlertasContentElement || !loadingAlertasElement || !noAlertasElement || !errorAlertasElement || 
            !cuerpoTablaHistorialElement || !loadingHistorialRowElement || !noHistorialRowElement || !errorHistorialRowElement) {
            console.error("ALERTAS: Faltan elementos del DOM. Reintentando obtener referencias...");
            // Intento de recuperación de referencias
            listaAlertasContentElement = document.getElementById('lista-alertas-content');
            loadingAlertasElement = document.getElementById('loading-alertas');
            noAlertasElement = document.getElementById('no-alertas');
            errorAlertasElement = document.getElementById('error-alertas');
            cuerpoTablaHistorialElement = document.getElementById('cuerpo-tabla-historial');
            loadingHistorialRowElement = document.getElementById('loading-historial-row');
            noHistorialRowElement = document.getElementById('no-historial-row');
            errorHistorialRowElement = document.getElementById('error-historial-row');
            
            if (!listaAlertasContentElement) {
                console.error("ALERTAS: Imposible recuperar referencias DOM. Abortando.");
                return;
            }
        }

        // Mostrar estados de carga
        if (loadingAlertasElement) loadingAlertasElement.classList.remove('hidden');
        if (noAlertasElement) noAlertasElement.classList.add('hidden');
        if (errorAlertasElement) errorAlertasElement.classList.add('hidden');

        if (loadingHistorialRowElement) loadingHistorialRowElement.classList.remove('hidden');
        if (noHistorialRowElement) noHistorialRowElement.classList.add('hidden');
        if (errorHistorialRowElement) errorHistorialRowElement.classList.add('hidden');
        
        // Limpiar tabla
        if (cuerpoTablaHistorialElement) {
            cuerpoTablaHistorialElement.querySelectorAll('tr:not(#loading-historial-row):not(#no-historial-row):not(#error-historial-row)').forEach(row => row.remove());
        }
        
        // Limpiar lista de alertas
        if (listaAlertasContentElement) {
            listaAlertasContentElement.innerHTML = '';
        }

        try {
            console.log('ALERTAS: Solicitando datos a Apps Script...');
            const response = await _appsScriptRequest('getAlertData', {}, 'GET');
            console.log('ALERTAS: Datos recibidos en _cargarYFiltrarAlertas:', response);

            // Ocultar loaders
            if (loadingAlertasElement) loadingAlertasElement.classList.add('hidden');
            if (loadingHistorialRowElement) loadingHistorialRowElement.classList.add('hidden');

            if (response && response.success && response.data && Array.isArray(response.data)) {
                const todasLasAlertas = response.data;
                const headers = response.headers || [];
                console.log(`ALERTAS: Procesando ${todasLasAlertas.length} alertas.`);

                // Mapeo de headers más robusto
                const headerMap = {};
                if (Array.isArray(headers)) {
                    headers.forEach(h => { 
                        if (typeof h === 'string') { 
                            headerMap[h.toLowerCase().trim()] = h; 
                        } 
                    });
                }
                console.log('ALERTAS: Header Map:', headerMap);

                // Definir claves
                const ESTADO_KEY = headerMap['estado'] || 'Estado';
                const REVISADO_KEY = headerMap['revisado'] || 'Revisado';
                const TIMESTAMP_KEY = headerMap['timestamp'] || 'Timestamp';
                
                // Filtrar alertas positivas no revisadas
                const alertasPositivasNoRevisadas = todasLasAlertas.filter(alerta => {
                    const estadoActual = alerta[ESTADO_KEY] ? String(alerta[ESTADO_KEY]).toLowerCase() : "";
                    const revisadoActual = alerta[REVISADO_KEY] ? String(alerta[REVISADO_KEY]).toLowerCase() : "";
                    return estadoActual === 'positivo' && revisadoActual !== 'sí';
                }).sort((a, b) => (new Date(b[TIMESTAMP_KEY]) || 0) - (new Date(a[TIMESTAMP_KEY]) || 0));

                console.log(`ALERTAS: ${alertasPositivasNoRevisadas.length} alertas positivas no revisadas encontradas.`);

                if (alertasPositivasNoRevisadas.length > 0) {
                    alertasPositivasNoRevisadas.forEach(alertaF => {
                        const el = _crearElementoAlerta(alertaF, headers, headerMap);
                        if (el && listaAlertasContentElement) listaAlertasContentElement.appendChild(el);
                    });
                } else {
                    if (noAlertasElement) noAlertasElement.classList.remove('hidden');
                }

                // Renderizar historial
                const historialOrdenado = [...todasLasAlertas].sort((a, b) => (new Date(b[TIMESTAMP_KEY]) || 0) - (new Date(a[TIMESTAMP_KEY]) || 0));
                
                if (historialOrdenado.length > 0) {
                    historialOrdenado.forEach((item, index) => {
                        if (!cuerpoTablaHistorialElement) return;
                        const fila = cuerpoTablaHistorialElement.insertRow();
                        
                        const getVal = (key) => item[key] !== undefined ? item[key] : 'N/A';
                        
                        const estadoVal = getVal(ESTADO_KEY);
                        const revisadoVal = getVal(REVISADO_KEY);
                        const timestampVal = getVal(TIMESTAMP_KEY);
                        const asuntoVal = item['Asunto'] || item[headerMap['asunto']] || '';
                        const detallesVal = item['Detalles_Disparo'] || item[headerMap['detalles_disparo']] || 'No hay detalles disponibles.';

                        const estadoHistClase = String(estadoVal).toLowerCase().replace(/[^a-z0-9-_]/g, '') || 'desconocido';
                        const revisadoHistClase = String(revisadoVal).toLowerCase() === 'sí' ? 'si' : 'no';
                        
                        const estadoTitle = estadoVal === 'Positivo' ? 'La alerta coincidió con una regla y requiere atención.' : 'El email fue procesado pero no cumplió las condiciones.';

                        fila.insertCell().innerHTML = `<div class="col-index">${index + 1}</div>`;
                        fila.insertCell().innerHTML = `<div class="col-timestamp">${timestampVal ? new Date(timestampVal).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'medium' }) : 'N/A'}</div>`;
                        fila.insertCell().innerHTML = `<div class="col-asunto" title="${asuntoVal}">${String(asuntoVal).substring(0, 50)}${String(asuntoVal).length > 50 ? '...' : ''}</div>`;
                        fila.insertCell().innerHTML = `<div class="col-condicion estado-${estadoHistClase}" title="${estadoTitle}">${estadoVal}</div>`;
                        fila.insertCell().innerHTML = `<div class="col-revisado revisado-${revisadoHistClase}">${revisadoVal || 'No'}</div>`;
                        
                        fila.insertCell().innerHTML = `
                        <div class="col-razon" title="${detallesVal}">
                            <i class="ti ti-info-circle info-disparo-icon" tabindex="0" aria-label="Ver motivo de disparo"></i> 
                        </div>
                        `;
                    });
                } else {
                    if (noHistorialRowElement) noHistorialRowElement.classList.remove('hidden');
                }
            } else {
                const errorMsg = (response && response.error) || 'Formato de datos incorrecto o fallo del servidor.';
                console.warn('ALERTAS: Respuesta inesperada:', response);
                
                if (noAlertasElement) noAlertasElement.classList.remove('hidden');
                if (noHistorialRowElement) noHistorialRowElement.classList.remove('hidden');
                
                if (errorAlertasElement) {
                    errorAlertasElement.textContent = `Error: ${errorMsg}`;
                    errorAlertasElement.classList.remove('hidden');
                }
                
                if (errorHistorialRowElement) {
                    const errHistCell = errorHistorialRowElement.querySelector('td');
                    if(errHistCell) errHistCell.textContent = `Error: ${errorMsg}`;
                    errorHistorialRowElement.classList.remove('hidden');
                }
            }
        } catch (error) {
            console.error('ALERTAS: Error CRÍTICO en _cargarYFiltrarAlertas:', error);
            
            // Asegurar que se oculten los loaders en caso de error
            if (loadingAlertasElement) loadingAlertasElement.classList.add('hidden');
            if (loadingHistorialRowElement) loadingHistorialRowElement.classList.add('hidden');
            
            if (errorAlertasElement) {
                errorAlertasElement.textContent = `Error: ${error.message}`;
                errorAlertasElement.classList.remove('hidden');
            }
            
            if (errorHistorialRowElement) {
                const errHistCell = errorHistorialRowElement.querySelector('td');
                if(errHistCell) errHistCell.textContent = `Error: ${error.message}`;
                errorHistorialRowElement.classList.remove('hidden');
            }
        }
    }



// --- Modificamos el botón en _crearElementoAlerta para usar la nueva función ---




// --- Auto-verificador de nuevas alertas para recargar dinámicamente el monitor ---


function estadoResumenAlertas(alertas) {
  if (!Array.isArray(alertas)) return '';
  return alertas.map(a => `${a.UID || a.uid || ''}-${(a.Revisado || a.revisado || '').toLowerCase()}`).join(';');
}

let paginaActual = 1;
const TAM_PAGINA = 50;
let totalAlertas = 0;

// Llamada para cargar la página
async function cargarHistorialPagina(pagina) {
    const offset = (pagina - 1) * TAM_PAGINA;
    // Usa el método ya existente para pedir datos (usá limit/offset)
    const params = { action: 'getAlertData', limit: TAM_PAGINA, offset: offset };
    // Si usás JSONP, agregá params así; si usás fetch, en body/query
    const response = await _appsScriptRequest('getAlertData', params, 'GET');
    console.log('Respuesta:', response);
    console.log('Total devuelto:', response.total);
    // Mostrar la tabla
    renderizarHistorial(response.data);
    // Guardá el total para mostrar controles
    totalAlertas = response.total;
    paginaActual = pagina;
    actualizarControlesPaginado();
    
}

function actualizarControlesPaginado() {
    const totalPaginas = Math.ceil(totalAlertas / TAM_PAGINA);
    document.getElementById('pagina-actual').textContent = paginaActual;
    document.getElementById('total-paginas').textContent = totalPaginas;
    document.getElementById('btn-prev').disabled = (paginaActual <= 1);
    document.getElementById('btn-next').disabled = (paginaActual >= totalPaginas);
}
// Genera el HTML del paginado
function renderizarPaginado(paginaActual, totalPaginas) {
    const contenedor = document.getElementById('historial-paginado-container');
    contenedor.innerHTML = `
        <button id="btn-prev">Anterior</button>
        <span>Página <span id="pagina-actual">${paginaActual}</span> de <span id="total-paginas">${totalPaginas}</span></span>
        <button id="btn-next">Siguiente</button>
    `;

    // Agregá los listeners DESPUÉS de agregar el HTML
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (paginaActual > 1) cargarHistorialPagina(paginaActual - 1);
    });
    document.getElementById('btn-next').addEventListener('click', () => {
        if (paginaActual < totalPaginas) cargarHistorialPagina(paginaActual + 1);
    });
}




function _iniciarAutoVerificacionAlertas() {
    intervaloVerificacionCambios = setInterval(async () => {
        try {
            const sessionStr = localStorage.getItem('session');
            if (!sessionStr) return;
            const session = JSON.parse(sessionStr);
            if (!session.tmpToken || !session.email) return;

            // Usar fetch en vez de JSONP/script
            const params = {
                action: 'getAlertData',
                email: session.email,
                token: session.tmpToken
            };
            const queryParams = new URLSearchParams(params);
            const fullUrl = `${SCRIPT_URL_MONITOR_ALERTAS}?${queryParams.toString()}`;
            const response = await fetch(fullUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                headers: { 'Accept': 'text/plain' }
            });
            if (!response.ok) return;
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.warn('⚠️ Error al parsear respuesta del auto-verificador:', e);
                return;
            }
            if (!data || !data.data) return;
            const resumenActual = estadoResumenAlertas(data.data);
            if (ultimoResumenAlertas === null) {
                ultimoResumenAlertas = resumenActual;
            } else if (resumenActual !== ultimoResumenAlertas) {
                console.log('🔁 Cambio detectado en alertas (cantidad o revisados). Refrescando...');
                ultimoResumenAlertas = resumenActual;
                _cargarYFiltrarAlertas();
            }
        } catch (e) {
            console.warn('⚠️ Error interno al verificar nuevas alertas:', e);
        }
    }, 60000); // cada 60 segundos
}

// ... (existing code)

function _detenerAutoVerificacionAlertas() {
  if (intervaloVerificacionCambios) {
    clearInterval(intervaloVerificacionCambios);
    intervaloVerificacionCambios = null;
  }
}

// Exponer para debugging manual
window.debugAlertas = _cargarYFiltrarAlertas;

// Inicialización robusta para módulos
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarModulo);
} else {
    // Si el DOM ya está listo (común en scripts tipo module), ejecutar directamente
    inicializarModulo();
}
