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
        revisado = revisado ? String(revisado).toLowerCase() === 'sí' : false; //
        const estadoAlerta = String(getVal('Estado')).toLowerCase(); //
        const cuerpoEmail = getVal('Cuerpo'); //

        alertaDiv.innerHTML = `
            <div class="alerta-contenido">
                <p class="alerta-asunto-display" title="${asunto}">${asunto}</p>
                <p class="alerta-fecha-display">${fechaFormateada}</p>
            </div>
            <div class="alerta-acciones">
                ${(!revisado && estadoAlerta === 'positivo' && uid) ? //
                    `<button class="btn-marcar-revisado" data-uid="${uid}" title="Marcar como Revisado">
                        <i class="fas fa-check-circle"></i> Marcar como Revisado
                      </button>` :
                    (revisado ? '<span class="revisado-texto"><i class="fas fa-check"></i> Revisado</span>' : '')}
            </div>`;

        const contenidoDiv = alertaDiv.querySelector('.alerta-contenido');
        if (contenidoDiv) {
            contenidoDiv.style.cursor = 'pointer';
            _addManagedEventListener(contenidoDiv, 'click', () => {
                _abrirModalDetalle(asunto, cuerpoEmail, alerta.Detalles_Disparo || '');
            });
        }

const btnMarcar = alertaDiv.querySelector('.btn-marcar-revisado');
if (btnMarcar) {
  _addManagedEventListener(btnMarcar, 'click', async (event) => {
    event.stopPropagation();
    const uidParaMarcar = btnMarcar.dataset.uid;
    
    // Guardar estado original del botón
    const originalHTML = btnMarcar.innerHTML;
    const originalDisabled = btnMarcar.disabled;
    
    try {
      btnMarcar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marcando...';
      btnMarcar.disabled = true;
      
      const resultado = await marcarAlertaComoRevisada(uidParaMarcar);
      
      if (resultado && resultado.success) {
        alertaDiv.classList.add('alerta-desvaneciendo');
        setTimeout(() => {
          alertaDiv.remove();
          if (listaAlertasContentElement && !listaAlertasContentElement.querySelector('.alerta-item')) {
            if (noAlertasElement) noAlertasElement.classList.remove('hidden');
          }
          _cargarYFiltrarAlertas(); // Recargar datos
        }, 500);
      } else {
        throw new Error(resultado.error || resultado.message || "La operación no fue exitosa");
      }
    } catch (error) {
      console.error('Error al marcar como revisado:', error);
      btnMarcar.innerHTML = originalHTML;
      btnMarcar.disabled = originalDisabled;
      alert(`Error al marcar la alerta: ${error.message}`);
    }
  });
  }
        return alertaDiv;
        }

    // La PARTE 3 contendrá _cargarYFiltrarAlertas y el cierre de la IIFE.
    async function _cargarYFiltrarAlertas() {
        if (!listaAlertasContentElement || !loadingAlertasElement || !noAlertasElement || !errorAlertasElement || //
            !cuerpoTablaHistorialElement || !loadingHistorialRowElement || !noHistorialRowElement || !errorHistorialRowElement) { //
            console.error("ALERTAS: Faltan elementos del DOM para cargar y filtrar alertas.");
            return;
        }

        loadingAlertasElement.classList.remove('hidden'); //
        noAlertasElement.classList.add('hidden'); //
        errorAlertasElement.classList.add('hidden'); //
    // Eliminar llamada recursiva incorrecta
        // ...existing code...
        loadingHistorialRowElement.classList.remove('hidden'); //
        noHistorialRowElement.classList.add('hidden'); //
        errorHistorialRowElement.classList.add('hidden'); //
        cuerpoTablaHistorialElement.querySelectorAll('tr:not(#loading-historial-row):not(#no-historial-row):not(#error-historial-row)').forEach(row => row.remove()); //

        try {
            const response = await _appsScriptRequest('getAlertData', {}, 'GET'); //
            loadingAlertasElement.classList.add('hidden'); //
            loadingHistorialRowElement.classList.add('hidden'); //

            if (response && response.success && response.data && Array.isArray(response.data) && response.headers && Array.isArray(response.headers)) { //
                const todasLasAlertas = response.data; //
                const headers = response.headers; //
                const headerMap = {};
                headers.forEach(h => { if (typeof h === 'string') { headerMap[h.toLowerCase().trim()] = h; } });

                const ESTADO_KEY_NORMALIZED = 'estado'; const REVISADO_KEY_NORMALIZED = 'revisado';
                const TIMESTAMP_KEY_NORMALIZED = 'timestamp'; const ASUNTO_KEY_NORMALIZED = 'asunto';
                const essentialNormalizedKeys = [ESTADO_KEY_NORMALIZED, REVISADO_KEY_NORMALIZED, TIMESTAMP_KEY_NORMALIZED, 'uid', 'cuerpo', ASUNTO_KEY_NORMALIZED]; //
                if (essentialNormalizedKeys.some(k => !headerMap[k])) {
                    throw new Error(`Columnas esenciales (${essentialNormalizedKeys.filter(k=>!headerMap[k]).join(', ')}) no encontradas. Headers: ${JSON.stringify(headers)}`);
                }
                const ESTADO_KEY = headerMap[ESTADO_KEY_NORMALIZED]; const REVISADO_KEY = headerMap[REVISADO_KEY_NORMALIZED];
                const TIMESTAMP_KEY = headerMap[TIMESTAMP_KEY_NORMALIZED];

                const alertasPositivasNoRevisadas = todasLasAlertas.filter(alerta => { //
                    const estadoActual = alerta[ESTADO_KEY] ? String(alerta[ESTADO_KEY]).toLowerCase() : ""; //
                    const revisadoActual = alerta[REVISADO_KEY] ? String(alerta[REVISADO_KEY]).toLowerCase() : ""; //
                    return estadoActual === 'positivo' && revisadoActual !== 'sí'; //
                }).sort((a, b) => (new Date(b[TIMESTAMP_KEY]) || 0) - (new Date(a[TIMESTAMP_KEY]) || 0)); //

                if (alertasPositivasNoRevisadas.length > 0) {
                    alertasPositivasNoRevisadas.forEach(alertaF => {
                        const el = _crearElementoAlerta(alertaF, headers, headerMap);
                        if (el) listaAlertasContentElement.appendChild(el); //
                    });
                } else {
                    noAlertasElement.classList.remove('hidden'); //
                }

                const historialOrdenado = [...todasLasAlertas].sort((a, b) => (new Date(b[TIMESTAMP_KEY]) || 0) - (new Date(a[TIMESTAMP_KEY]) || 0)); //
                if (historialOrdenado.length > 0) {
                    historialOrdenado.forEach((item, index) => {
                        const fila = cuerpoTablaHistorialElement.insertRow(); //
                        const getValHist = (kNorm) => headerMap[kNorm.toLowerCase().trim()] && item[headerMap[kNorm.toLowerCase().trim()]] !== undefined ? item[headerMap[kNorm.toLowerCase().trim()]] : 'N/A';
                        const estadoHistClase = String(getValHist(ESTADO_KEY_NORMALIZED)).toLowerCase().replace(/[^a-z0-9-_]/g, '') || 'desconocido'; //
                        const revisadoHistClase = String(getValHist(REVISADO_KEY_NORMALIZED)).toLowerCase() === 'sí' ? 'si' : 'no'; //
                        const asuntoCompleto = item.Asunto || '';
                        // --- MEJORA: Añadir tooltip y texto informativo ---
                        const estadoTitle = item.Estado === 'Positivo' ? 'La alerta coincidió con una regla y requiere atención.' : 'El email fue procesado pero no cumplió las condiciones.';
                        const detallesDisparo = item.Detalles_Disparo || 'No hay detalles disponibles.';
                        fila.insertCell().innerHTML = `<div class="col-index">${index + 1}</div>`;
                    fila.insertCell().innerHTML = `<div class="col-timestamp">${item.Timestamp ? new Date(item.Timestamp).toLocaleString('es-UY', { dateStyle: 'short', timeStyle: 'medium' }) : 'N/A'}</div>`;
                    fila.insertCell().innerHTML = `<div class="col-asunto" title="${asuntoCompleto}">${String(asuntoCompleto).substring(0, 50)}${String(asuntoCompleto).length > 50 ? '...' : ''}</div>`;
                    fila.insertCell().innerHTML = `<div class="col-condicion estado-${estadoHistClase}" title="${estadoTitle}">${item.Estado || 'N/A'}</div>`;
                    fila.insertCell().innerHTML = `<div class="col-revisado revisado-${revisadoHistClase}">${item.Revisado || 'No'}</div>`;
                    
                    const detalles = item.Detalles_Disparo || 'No hay detalles disponibles.';
                    // En la función que arma cada fila del historial
                    fila.insertCell().innerHTML = `
                    <div class="col-razon" title="${detalles}">
                        <i class="ti ti-info-circle info-disparo-icon" tabindex="0" aria-label="Ver motivo de disparo"></i> 
                        <span class="texto-motivo">${detalles}</span>
                    </div>
                    `;

                    
                });
                } else {
                    noHistorialRowElement.classList.remove('hidden'); //
                }
            } else {
                const errorMsg = (response && response.error) || 'Formato de datos incorrecto o fallo del servidor.';
                console.warn('ALERTAS: Respuesta de getAlertData sin formato esperado o success:false.', response);
                noAlertasElement.classList.remove('hidden'); //
                noHistorialRowElement.classList.remove('hidden'); //
                errorAlertasElement.textContent = `Error: ${errorMsg}`; errorAlertasElement.classList.remove('hidden'); //
                const errHistCell = errorHistorialRowElement ? errorHistorialRowElement.querySelector('td') : null; //
                if(errHistCell) errHistCell.textContent = `Error: ${errorMsg}`;
                errorHistorialRowElement.classList.remove('hidden'); //
            }
        } catch (error) {
            console.error('ALERTAS: Catch general en _cargarYFiltrarAlertas:', error);
            loadingAlertasElement.classList.add('hidden'); errorAlertasElement.textContent = `Error: ${error.message}`; errorAlertasElement.classList.remove('hidden'); //
            loadingHistorialRowElement.classList.add('hidden'); //
            const errHistCell = errorHistorialRowElement ? errorHistorialRowElement.querySelector('td') : null; //
            if(errHistCell) errHistCell.textContent = `Error: ${error.message}`;
            errorHistorialRowElement.classList.remove('hidden'); //
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

function _detenerAutoVerificacionAlertas() {
  if (intervaloVerificacionCambios) {
    clearInterval(intervaloVerificacionCambios);
    intervaloVerificacionCambios = null;
  }
}

document.addEventListener('DOMContentLoaded', inicializarModulo);
