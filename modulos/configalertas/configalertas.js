// ES Module para Configuración de Alertas
// import { requireSession } from '../shared/authService.js'; // Temporalmente deshabilitado
// import '../shared/layout.js';

// ⚠️ SESIÓN TEMPORAL PARA TESTING (REMOVER EN PRODUCCIÓN)
if (!localStorage.getItem('session')) {
    const fakeSession = {
        tmpToken: '550e8400-e29b-41d4-a716-446655440000', // UUID format para que se vea más realista
        email: 'dsalvetto@farmashop.com.uy', // Email más realista del dominio
        status: 'ok',
        rol: 'admin'
    };
    localStorage.setItem('session', JSON.stringify(fakeSession));
    localStorage.setItem('sessionTimestamp', Date.now().toString());
}

// Validar sesión antes de cualquier lógica
// const session = requireSession(); // Temporalmente deshabilitado
// if (!session) throw new Error('Sesión inválida.'); // Temporalmente deshabilitado

/** URL de Apps Script para operaciones con la config de alertas */
const SCRIPT_URL_CONFIG = 'https://script.google.com/macros/s/AKfycbyX9HH80G0wwR14PfcYiT1Qink6LujZO2vz0nTbBLABT2LyGrRspCI6rakRJ1acULfv/exec';

/** Array con todas las reglas (última carga) */
let reglas = [];

/** Almacén de referencias a elementos de la UI (DOM) */
const DOM = {};

/** Array para listeners activos (limpieza fácil en onLeave) */
let listenersActivos = [];

// --- 2. Utils para listeners y ModalStatus ---

/**
 * Agrega un eventListener y lo trackea para su eliminación segura.
 */
function addListener(el, type, fn, opts) {
  if (!el) return;
  el.addEventListener(type, fn, opts);
  listenersActivos.push({ el, type, fn, opts });
}

/**
 * Limpia todos los eventListeners agregados por este módulo.
 */
function limpiarListeners() {
  listenersActivos.forEach(({ el, type, fn, opts }) => {
    if (el) el.removeEventListener(type, fn, opts);
  });
  listenersActivos = [];
}

//helpers para mostrar/ocultar mensaje
  function mostrarModalStatusMsg(msg, tipo = 'info') {
  if (!DOM.modalReglaStatusMsg) return;
  DOM.modalReglaStatusMsg.textContent = msg;
  DOM.modalReglaStatusMsg.className = 'status-message' + (tipo ? ' ' + tipo + '-message' : '');
  DOM.modalReglaStatusMsg.classList.remove('hidden');
}
function ocultarModalStatusMsg() {
  if (DOM.modalReglaStatusMsg) DOM.modalReglaStatusMsg.classList.add('hidden');
}

/**
 * Muestra/oculta un spinner en el botón "Guardar"
 */
function mostrarLoadingOverlay(texto = "Cargando...") {
const overlay = document.getElementById('loadingOverlay');
const textDiv = document.getElementById('loadingOverlayText');
if (overlay) {
  if (textDiv) textDiv.textContent = texto;
  overlay.classList.remove('hidden');
}
}
function ocultarLoadingOverlay() {
const overlay = document.getElementById('loadingOverlay');
if (overlay) overlay.classList.add('hidden');
}


/** Realiza una petición fetch a Apps Script.
 * @param {string} action - Acción a ejecutar
 * @param {object} extraParams - Otros parámetros
 * @returns {Promise}
 */
function fetchAppScript(action, extraParams = {}) {
  return new Promise(async (resolve, reject) => {
    const sessionStr = localStorage.getItem('session');
    if (!sessionStr) return reject(new Error('Sesión no encontrada.'));
    
    let session;
    try {
      session = JSON.parse(sessionStr);
    } catch (e) {
      return reject(new Error('Error al parsear la sesión.'));
    }
    
    if (!session.tmpToken || !session.email)
      return reject(new Error('Token/email faltante en sesión.'));

    const params = Object.assign(
      {
        action,
        email: session.email,
        token: session.tmpToken,
      },
      extraParams
    );
    
    const url = SCRIPT_URL_CONFIG + '?' + new URLSearchParams(params).toString();

    try {
      const response = await fetch(url, {
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

      if (data && (data.success === false || (data.error && !data.success))) {
        reject(new Error(data.error || 'Error en respuesta del servidor.'));
      } else {
        resolve(data);
      }
    } catch (error) {
      console.error('Error al contactar Apps Script:', error);
      reject(new Error('Error de red al contactar Apps Script.'));
    }
  });
}

/**
 * Guarda (crea o edita) una regla vía JSONP.
 * @param {Object} ruleData - Los datos de la regla.
 * @param {boolean} isNew - true = crear, false = editar.
 * @returns {Promise}
 */
const action = isNew ? 'addConfigRule' : 'editConfigRule';
return fetchAppScript(action, { ruleData: JSON.stringify(ruleData) });


/**
 * Elimina una regla (por _rowNumber).
 */
return fetchAppScript('deleteConfigRule', { rowNumber: rowNumber });


// --- 4. Inicialización de referencias DOM ---

/**
 * Obtiene y guarda todas las referencias de elementos relevantes.
 * Devuelve true si todos los elementos críticos fueron encontrados, de lo contrario false.
 */
function getDOMRefs() {
// Contenedores y mensajes de reglas
DOM.listaReglasActivasContent = document.getElementById('lista-reglas-activas-content');
DOM.noReglasActivas = document.getElementById('no-reglas-activas');
DOM.errorReglasActivas = document.getElementById('errorReglasActivas');
    
DOM.listaReglasInactivasContent = document.getElementById('lista-reglas-inactivas-content');
DOM.noReglasInactivas = document.getElementById('no-reglas-inactivas');
DOM.errorReglasInactivas = document.getElementById('errorReglasInactivas');

    // Toolbar
    DOM.btnAnadirNuevaRegla = document.getElementById('btnAnadirNuevaRegla');
    DOM.btnRefrescarConfig = document.getElementById('btnRefrescarConfig');
    
    // Modal principal
    DOM.reglaModal = document.getElementById('reglaModal');
    DOM.modalReglaTitulo = document.getElementById('modalReglaTitulo');
    DOM.formRegla = document.getElementById('formRegla');
    DOM.ruleRowNumber = document.getElementById('ruleRowNumber');
    DOM.ruleOriginalIndex = document.getElementById('ruleOriginalIndex');
    DOM.ruleAsunto = document.getElementById('ruleAsunto');
    DOM.ruleTipoCondicion = document.getElementById('ruleTipoCondicion');
    DOM.valorCondicionContainer = document.getElementById('valorCondicionContainer');
    DOM.valorCondicionInputArea = document.getElementById('valorCondicionInputArea');
    DOM.ruleValorCondicionSimple = document.getElementById('ruleValorCondicionSimple');
    DOM.multiCondicionalInputs = document.getElementById('multiCondicionalInputs');
    DOM.multiActivarInput = document.getElementById('multiActivarInput');
    DOM.btnAddActivarKeyword = document.getElementById('btnAddActivarKeyword');
    DOM.activarKeywordsList = document.getElementById('activarKeywordsList');
    DOM.multiExcluirInput = document.getElementById('multiExcluirInput');
    DOM.btnAddExcluirKeyword = document.getElementById('btnAddExcluirKeyword');
    DOM.excluirKeywordsList = document.getElementById('excluirKeywordsList');
    DOM.ruleActiva = document.getElementById('ruleActiva');
    DOM.ruleNotas = document.getElementById('ruleNotas');
    DOM.btnCancelarRegla = document.getElementById('btnCancelarRegla');
    DOM.btnGuardarRegla = document.getElementById('btnGuardarRegla');
    DOM.modalReglaCerrarBtn = document.getElementById('modalReglaCerrarBtn');
    DOM.valorCondicionHelpText = document.getElementById('valorCondicionHelpText');

    // Modal info de condición
    DOM.infoTipoCondicionModal = document.getElementById('infoTipoCondicionModal');
    DOM.modalInfoCerrarBtn = document.getElementById('modalInfoCerrarBtn');
    DOM.btnInfoTipoCondicion = document.getElementById('btnInfoTipoCondicion');
    
    // Verificación de elementos críticos
    const criticalElements = [
        DOM.listaReglasActivasContent, DOM.noReglasActivas, DOM.errorReglasActivas,
        DOM.listaReglasInactivasContent, DOM.noReglasInactivas, DOM.errorReglasInactivas
    ];
    
    return !criticalElements.some(el => !el);
}

// --- 5. Renderizado de cards de reglas ---

function renderizarTarjetaRegla(regla, idx) {
const card = document.createElement('div');
card.className = 'regla-item-card';
card.dataset.ruleIndex = idx;
const asunto = regla.Asunto || 'N/A';
let notas = regla.Notas || 'Sin notas.';
    
const tipoCond = regla.TipoCondicion || 'N/A';
const activa = String(regla.Activa).trim().toLowerCase() === 'sí';

    // Usamos la clase CSS en lugar de un estilo en línea
    if (!activa) {
        card.classList.add('inactiva');
    }

    card.innerHTML = `
      <h3 class="notas-regla" title="${regla.Notas || ''}">${notas}</h3>
      <p class="asunto-regla" title="${regla.Asunto || ''}">${asunto}</p>
      
      <div class="info-regla">
          <p><strong>Tipo:</strong> ${tipoCond}</p>
          <p><strong>Estado:</strong> <span class="estado-regla activa-${activa ? 'si' : 'no'}">${activa ? 'Activa' : 'Inactiva'}</span></p>
      </div>
      <div class="regla-acciones">
          <button class="btn btn-secondary btn-small btn-editar-regla" data-index="${idx}"><i class="ti ti-edit"></i> Editar</button>
          <button class="btn btn-danger btn-small btn-eliminar-regla" data-index="${idx}"><i class="ti ti-trash"></i> Eliminar</button>
      </div>
    `;
    card.querySelector('.btn-editar-regla').addEventListener('click', () => abrirModalRegla(idx));
    card.querySelector('.btn-eliminar-regla').addEventListener('click', () => confirmarEliminarRegla(idx));
    return card;
}

function refrescarListaReglas() {
mostrarLoadingOverlay("Actualizando reglas...");

// Limpiar contenedores y ocultar mensajes
DOM.listaReglasActivasContent.innerHTML = '';
DOM.listaReglasInactivasContent.innerHTML = '';
DOM.noReglasActivas.classList.add('hidden');
DOM.noReglasInactivas.classList.add('hidden');
DOM.errorReglasActivas.classList.add('hidden');
DOM.errorReglasInactivas.classList.add('hidden');

fetchAppScript('getConfigData')
  .then(res => {
    if (res && res.data && Array.isArray(res.data) && !res.error) {
      reglas = res.data;
      const reglasActivas = reglas.filter(r => String(r.Activa).trim().toLowerCase() === 'sí');
      const reglasInactivas = reglas.filter(r => String(r.Activa).trim().toLowerCase() !== 'sí');

      // Renderizar reglas activas
      if (reglasActivas.length === 0) {
        DOM.noReglasActivas.classList.remove('hidden');
      } else {
        reglasActivas.forEach(regla => {
          const originalIndex = reglas.findIndex(r => r._rowNumber === regla._rowNumber);
          DOM.listaReglasActivasContent.appendChild(renderizarTarjetaRegla(regla, originalIndex));
        });
      }

      // Renderizar reglas inactivas
      if (reglasInactivas.length === 0) {
        DOM.noReglasInactivas.classList.remove('hidden');
      } else {
        reglasInactivas.forEach(regla => {
          const originalIndex = reglas.findIndex(r => r._rowNumber === regla._rowNumber);
          DOM.listaReglasInactivasContent.appendChild(renderizarTarjetaRegla(regla, originalIndex));
        });
      }
    } else {
      throw new Error(res.error || res.message || 'Error de formato/configuración');
    }
    ocultarLoadingOverlay();
  })
  .catch(err => {
    DOM.errorReglasActivas.textContent = 'Error al cargar reglas: ' + (err.message || err);
    DOM.errorReglasInactivas.textContent = 'Error al cargar reglas: ' + (err.message || err);
    DOM.errorReglasActivas.classList.remove('hidden');
    DOM.errorReglasInactivas.classList.remove('hidden');
    ocultarLoadingOverlay();
  });
}

function abrirModalRegla(idx = null) {
    if (idx !== null && reglas[idx]) {
        // --- Editando una regla existente ---
        const regla = reglas[idx];
        DOM.modalReglaTitulo.textContent = 'Editar Regla';
        DOM.ruleRowNumber.value = regla._rowNumber;
        DOM.ruleOriginalIndex.value = idx;
        DOM.ruleNotas.value = regla.Notas || '';
        DOM.ruleAsunto.value = regla.Asunto || '';
        DOM.ruleActiva.value = String(regla.Activa).trim().toLowerCase() === 'sí' ? 'Sí' : 'No';
        DOM.ruleTipoCondicion.value = regla.TipoCondicion || 'SiemprePositivo';

        actualizarVisibilidadValorCondicion(); // Llama a esto antes de poblar los valores

        if (regla.TipoCondicion === 'MultiCondicional') {
            try {
                const valorParsed = JSON.parse(regla.ValorCondicion);
                poblarMultiCondicional(valorParsed);
            } catch (e) {
                console.error("Error al parsear ValorCondicion para MultiCondicional:", e);
                limpiarInputsMultiCondicional();
            }
        } else {
            DOM.ruleValorCondicionSimple.value = regla.ValorCondicion || '';
        }

    } else {
        // --- Creando una nueva regla ---
        DOM.modalReglaTitulo.textContent = 'Añadir Nueva Regla';
        DOM.formRegla.reset(); // Limpia el formulario
        DOM.ruleRowNumber.value = '';
        DOM.ruleOriginalIndex.value = '';
        limpiarInputsMultiCondicional();
        actualizarVisibilidadValorCondicion();
    }
    
    document.body.style.overflow = 'hidden';
    DOM.reglaModal.classList.remove('hidden');
  }


/**
 * Cierra el modal de regla, limpia scroll lock.
 */
function cerrarModalRegla() {
  if (DOM.reglaModal) DOM.reglaModal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// --- Helpers para UI de condición dinámica y keywords ---

/**
 * Muestra el campo adecuado para el tipo de condición seleccionado.
 */
function actualizarVisibilidadValorCondicion() {
const tipo = DOM.ruleTipoCondicion.value;
    
// Oculta el contenedor principal y limpia el texto de ayuda
DOM.valorCondicionContainer.classList.add('hidden');
if (DOM.valorCondicionHelpText) DOM.valorCondicionHelpText.textContent = '';

// Oculta las áreas de input específicas
if (DOM.multiCondicionalInputs) DOM.multiCondicionalInputs.classList.add('hidden');
if (DOM.ruleValorCondicionSimple) {
  DOM.ruleValorCondicionSimple.classList.add('hidden');
  DOM.ruleValorCondicionSimple.disabled = true;
}
    
if (tipo === 'SiemprePositivo') {
    DOM.valorCondicionContainer.classList.add('hidden'); // No se necesita valor
} else {
    DOM.valorCondicionContainer.classList.remove('hidden'); // Mostrar contenedor para los demás
    if (tipo === 'PalabraClaveEnCuerpo' || tipo === 'ExcluirSKU') {
        if (DOM.ruleValorCondicionSimple) {
            DOM.ruleValorCondicionSimple.classList.remove('hidden');
            DOM.ruleValorCondicionSimple.disabled = false;
            DOM.ruleValorCondicionSimple.placeholder =
            tipo === 'ExcluirSKU'? 'SKUs a excluir, separados por coma': 'Palabras clave separadas por coma';
        }
        if (DOM.valorCondicionHelpText) DOM.valorCondicionHelpText.textContent = "Introduzca los valores separados por coma (ej: valor1,valor2).";
    } else if (tipo === 'MultiCondicional') {
        if (DOM.multiCondicionalInputs) DOM.multiCondicionalInputs.classList.remove('hidden');
        if (DOM.valorCondicionHelpText) DOM.valorCondicionHelpText.textContent = "Agregue palabras/frases para activar la alerta y/o para excluirla si se activó.";
    }
}
  }


/**
 * Limpia los campos de palabras de activar/excluir en el multi condicional.
 */
function limpiarInputsMultiCondicional() {
if (DOM.activarKeywordsList) DOM.activarKeywordsList.innerHTML = '';
if (DOM.excluirKeywordsList) DOM.excluirKeywordsList.innerHTML = '';
if (DOM.multiActivarInput) DOM.multiActivarInput.value = '';
if (DOM.multiExcluirInput) DOM.multiExcluirInput.value = '';
}

/**
 * Pone las keywords cargadas en el modal para edición de MultiCondicional.
 */
function poblarMultiCondicional(obj) {
limpiarInputsMultiCondicional();
if (obj && Array.isArray(obj.activar)) {
  obj.activar.forEach(kw => {
    if (DOM.multiActivarInput) {
        DOM.multiActivarInput.value = kw;
        anadirKeywordMulti(DOM.multiActivarInput, DOM.activarKeywordsList);
    }
  });
}
if (obj && Array.isArray(obj.excluir)) {
  obj.excluir.forEach(kw => {
    if (DOM.multiExcluirInput) {
        DOM.multiExcluirInput.value = kw;
        anadirKeywordMulti(DOM.multiExcluirInput, DOM.excluirKeywordsList);
    }
  });
}
}

/**
 * Añade una keyword a la lista visual y limpia el input.
 */
function anadirKeywordMulti(inputEl, listEl) {
if (!inputEl || !listEl) return;
const kw = inputEl.value.trim();
if (kw) {
  const existing = Array.from(listEl.querySelectorAll('.keyword-tag > span')).map(span => span.textContent.trim().toLowerCase());
  if (!existing.includes(kw.toLowerCase())) {
    const tag = document.createElement('span');
    tag.className = 'keyword-tag';
    tag.innerHTML = `<span>${kw}</span> <i class="ti ti-x remove-keyword" title="Quitar"></i>`;
    tag.querySelector('.remove-keyword').addEventListener('click', e => e.target.closest('.keyword-tag').remove());
    listEl.appendChild(tag);
  }
  inputEl.value = '';
}
inputEl.focus();
}

// --- 6. Listeners y ciclo de vida del módulo ---

/**
 * Registra todos los listeners necesarios del módulo y del modal.
 * Se invoca en onEnter.
 */
function registrarListeners() {
      addListener(DOM.btnAnadirNuevaRegla, 'click', () => abrirModalRegla());
      addListener(DOM.btnRefrescarConfig, 'click', refrescarListaReglas);
      addListener(DOM.modalReglaCerrarBtn, 'click', cerrarModalRegla);
      addListener(DOM.btnCancelarRegla, 'click', cerrarModalRegla);
      addListener(DOM.reglaModal, 'click', e => { if (e.target === DOM.reglaModal) cerrarModalRegla(); });
      addListener(document, 'keydown', e => {
          if (e.key === 'Escape') {
              if (DOM.reglaModal && !DOM.reglaModal.classList.contains('hidden')) cerrarModalRegla();
              if (DOM.infoTipoCondicionModal && !DOM.infoTipoCondicionModal.classList.contains('hidden')) {
                  DOM.infoTipoCondicionModal.classList.add('hidden');
                  if (DOM.reglaModal.classList.contains('hidden')) document.body.style.overflow = 'auto';
              }
          }
      });
      addListener(DOM.btnInfoTipoCondicion, 'click', () => {
          if (DOM.infoTipoCondicionModal) {
              DOM.infoTipoCondicionModal.classList.remove('hidden');
              document.body.style.overflow = 'hidden';
          }
      });
      addListener(DOM.modalInfoCerrarBtn, 'click', () => {
           if (DOM.infoTipoCondicionModal) {
              DOM.infoTipoCondicionModal.classList.add('hidden');
              if (DOM.reglaModal.classList.contains('hidden')) document.body.style.overflow = 'auto';
          }
      });
      addListener(DOM.infoTipoCondicionModal, 'click', e => {
          if (e.target === DOM.infoTipoCondicionModal) {
              DOM.infoTipoCondicionModal.classList.add('hidden');
              if (DOM.reglaModal.classList.contains('hidden')) document.body.style.overflow = 'auto';
          }
      });
      addListener(DOM.ruleTipoCondicion, 'change', actualizarVisibilidadValorCondicion);
      addListener(DOM.btnAddActivarKeyword, 'click', () => anadirKeywordMulti(DOM.multiActivarInput, DOM.activarKeywordsList));
      addListener(DOM.multiActivarInput, 'keypress', e => { if (e.key === 'Enter') { e.preventDefault(); anadirKeywordMulti(DOM.multiActivarInput, DOM.activarKeywordsList); } });
      addListener(DOM.btnAddExcluirKeyword, 'click', () => anadirKeywordMulti(DOM.multiExcluirInput, DOM.excluirKeywordsList));
      addListener(DOM.multiExcluirInput, 'keypress', e => { if (e.key === 'Enter') { e.preventDefault(); anadirKeywordMulti(DOM.multiExcluirInput, DOM.excluirKeywordsList); } });
      addListener(DOM.formRegla, 'submit', manejarGuardadoRegla);
  }

/**
 * onEnter: ciclo de vida para cuando se ingresa a la sección/config.
 */
function onEnter() {
mostrarLoadingOverlay("Cargando sección...");

// Se define una función que espera a que el DOM esté listo.
const waitForDom = (callback) => {
    // La función getDOMRefs ahora devuelve true si tuvo éxito.
    if (getDOMRefs()) {
        callback();
    } else {
        // Si falla (porque el HTML no está listo), espera 50ms y vuelve a intentar.
        setTimeout(() => waitForDom(callback), 50);
    }
};

// Se llama a la función de espera.
waitForDom(() => {
    // Este código solo se ejecuta cuando waitForDom confirma que todo está listo.
    registrarListeners();
    refrescarListaReglas();
});
}

/**
 * onLeave: limpia listeners y contenido cuando se sale de la sección.
 */
function onLeave() {
limpiarListeners();
if (DOM.reglaModal && !DOM.reglaModal.classList.contains('hidden')) cerrarModalRegla();
if (DOM.infoTipoCondicionModal && !DOM.infoTipoCondicionModal.classList.contains('hidden')) DOM.infoTipoCondicionModal.classList.add('hidden');
if (DOM.listaReglasActivasContent) DOM.listaReglasActivasContent.innerHTML = '';
if (DOM.listaReglasInactivasContent) DOM.listaReglasInactivasContent.innerHTML = '';
reglas = [];
}

// --- 7. Guardado/Edición y eliminación de reglas ---

/**
 * Handler de submit del modal: procesa validaciones y guarda regla.
 */
function manejarGuardadoRegla(e) {
e.preventDefault();
if (!DOM.btnGuardarRegla || !DOM.formRegla) {
  // No hay modal status msg, usamos la alerta global
  mostrarAlertaGlobal('Error interno de la UI al guardar.', 'error');
  return;
}
    
const isNew = !DOM.ruleRowNumber.value;
mostrarLoadingOverlay(isNew ? 'Creando regla...' : 'Guardando cambios...');

const ruleData = {
    Asunto: DOM.ruleAsunto.value.trim(),
    TipoCondicion: DOM.ruleTipoCondicion.value,
    Activa: DOM.ruleActiva.value,
    Notas: DOM.ruleNotas.value.trim(),
  };
if (!isNew) ruleData._rowNumber = parseInt(DOM.ruleRowNumber.value, 10);

if (ruleData.TipoCondicion === 'MultiCondicional') {
    const activarKws = Array.from(DOM.activarKeywordsList.querySelectorAll('.keyword-tag > span')).map(span => span.textContent.trim()).filter(Boolean);
    const excluirKws = Array.from(DOM.excluirKeywordsList.querySelectorAll('.keyword-tag > span')).map(span => span.textContent.trim()).filter(Boolean);
    ruleData.ValorCondicion = JSON.stringify({ activar: activarKws, excluir: excluirKws });
} else if (ruleData.TipoCondicion === 'PalabraClaveEnCuerpo' || ruleData.TipoCondicion === 'ExcluirSKU') {
    ruleData.ValorCondicion = DOM.ruleValorCondicionSimple.value.trim();
} else {
    ruleData.ValorCondicion = '';
}

if (!ruleData.Asunto || !ruleData.Notas) {
  ocultarLoadingOverlay();
  // No hay modal status msg, usamos alerta global
  mostrarAlertaGlobal('Los campos "Descripción" y "Asunto" son obligatorios.', 'error');
  return;
}

fetchAppScript(isNew ? 'addConfigRule' : 'editConfigRule', { ruleData: JSON.stringify(ruleData) })
  .then(res => {
    mostrarAlertaGlobal(res.message || 'Operación completada con éxito.', res.success ? 'success' : 'error');
    cerrarModalRegla();
    refrescarListaReglas(); 
  })
  .catch(err => {
    ocultarLoadingOverlay();
    mostrarAlertaGlobal('Error al guardar la regla: ' + err.message, 'error');
  });
}

/**
 * Confirma y elimina una regla.
 */
function confirmarEliminarRegla(idx) {
if (idx === undefined || !reglas[idx]) {
  mostrarAlertaGlobal('No se pudo identificar la regla a eliminar.', 'error');
  return;
}
const regla = reglas[idx];
const rowNum = regla._rowNumber;
if (!rowNum) {
  mostrarAlertaGlobal('La regla seleccionada no tiene número de fila para eliminarla.', 'error');
  return;
}

const modalConfirmacion = document.getElementById('modalConfirmacion');
const modalConfirmacionMsg = document.getElementById('modalConfirmacionMsg');
const btnConfirmar = document.getElementById('btnModalConfirmar');
const btnCancelar = document.getElementById('btnModalCancelar');

if (!modalConfirmacion || !modalConfirmacionMsg || !btnConfirmar || !btnCancelar) {
      console.error("No se encontraron los elementos del modal de confirmación");
      // Fallback a un confirm nativo si el modal no funciona (no recomendado en producción)
      if (confirm(`¿Seguro que querés eliminar la regla para el asunto "${regla.Asunto}"?`)) {
          // Lógica de eliminación...
      }
      return;
}

modalConfirmacionMsg.innerHTML = `¿Seguro que querés eliminar la regla para el asunto <b>"${regla.Asunto}"</b>?`;
modalConfirmacion.classList.remove('hidden');

const onConfirm = () => {
    modalConfirmacion.classList.add('hidden');
    const tarjeta = document.querySelector(`.regla-item-card[data-rule-index="${idx}"]`);
    if (tarjeta) tarjeta.querySelectorAll('button').forEach(b => (b.disabled = true));
    mostrarLoadingOverlay('Eliminando regla...');

    fetchAppScript('deleteConfigRule', { rowNumber: rowNum })
        .then(res => {
            mostrarAlertaGlobal(res.message || 'Regla eliminada.', res.success ? 'success' : 'error');
            setTimeout(refrescarListaReglas, 1200); 
        })
        .catch(err => {
            mostrarAlertaGlobal('Error al eliminar la regla: ' + err.message, 'error');
            if (tarjeta) tarjeta.querySelectorAll('button').forEach(b => (b.disabled = false));
             ocultarLoadingOverlay();
        });
    
    btnConfirmar.removeEventListener('click', onConfirm);
    btnCancelar.removeEventListener('click', onCancel);
};
    
const onCancel = () => {
    modalConfirmacion.classList.add('hidden');
    btnConfirmar.removeEventListener('click', onConfirm);
    btnCancelar.removeEventListener('click', onCancel);
};

btnConfirmar.addEventListener('click', onConfirm, { once: true });
btnCancelar.addEventListener('click', onCancel, { once: true });
}

// Muestra un banner tipo carrito (exito/error), se oculta luego de 3-5s
function mostrarAlertaGlobal(msg, tipo='success', duracion=3800) {
const div = document.getElementById('alertaGlobalMsg');
if (!div) return;
div.textContent = msg;
div.className = 'alerta-global-msg'; // Reset
div.classList.add(tipo); // 'success' o 'error'
div.classList.remove('hidden');

// Clear any existing timer
if (div._ocultarTO) clearTimeout(div._ocultarTO);

div._ocultarTO = setTimeout(() => { 
    div.classList.add('hidden'); 
}, duracion);
}


// --- 8. Registro global en dashboardModules ---
if (!window.dashboardModules) window.dashboardModules = {};
window.dashboardModules.configalertas = { onEnter, onLeave };

// Inicialización automática si la página se carga directamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onEnter);
} else {
  onEnter();
}
