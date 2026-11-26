// ============================================================================
// SAIFO — Registro de campo (v2). Sin frameworks, para que cargue rápido en
// celulares de gama baja con internet débil.
// ============================================================================

const $app = document.getElementById("app");
const $titulo = document.getElementById("tituloTop");
const $btnAtras = document.getElementById("btnAtras");
const $estadoConexion = document.getElementById("estadoConexion");
const $pendientesBar = document.getElementById("pendientesBar");
const $pendientesTexto = document.getElementById("pendientesTexto");
const $btnSincronizar = document.getElementById("btnSincronizar");
const $toast = document.getElementById("toast");

const LS_DATOS = "saifo_datos_v2";
const LS_COLA_V1 = "saifo_cola_envios";

let datos = {
  catalogos: CATALOGOS_RESPALDO,
  naps: napsDesdeRutas(NAPS_POR_RUTA),
  contratos: [] // [[codigo, estado, codigoNap], ...]
};

// ---------------------------------------------------------------- Utilidades

function toast(msg, tipo) {
  $toast.textContent = msg;
  $toast.className = "toast" + (tipo ? " " + tipo : "");
  $toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { $toast.hidden = true; }, 3600);
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function napsDesdeRutas(texto) {
  const out = [];
  texto.split(",").forEach(par => {
    const [dr, n] = par.split(":");
    for (let i = 1; i <= Number(n); i++) out.push(dr + "N" + String(i).padStart(2, "0"));
  });
  return out;
}

// "500", "Ct500", "CT004-000500", "ct004f-00500" -> "CT004F-00500"
function normalizarContrato(texto) {
  const s = String(texto || "").toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(?:OT)?CT0*4F?-?(\d+)$/);
  if (!m) m = s.match(/^CT-?(\d+)$/);
  if (!m) m = s.match(/^(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!n || String(n).length > DIGITOS_CONTRATO) return null;
  return PREFIJO_CONTRATO + String(n).padStart(DIGITOS_CONTRATO, "0");
}

function numeroDeContrato(codigo) {
  return String(parseInt(codigo.slice(PREFIJO_CONTRATO.length), 10));
}

// ---------------------------------------------------------------- Cola sin señal (IndexedDB)

const db = (() => {
  let conexion = null;
  function abrir() {
    if (conexion) return Promise.resolve(conexion);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("saifo_campo", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cola", { keyPath: "id", autoIncrement: true });
      req.onsuccess = () => { conexion = req.result; resolve(conexion); };
      req.onerror = () => reject(req.error);
    });
  }
  function tx(modo, fn) {
    return abrir().then(d => new Promise((resolve, reject) => {
      const t = d.transaction("cola", modo);
      const store = t.objectStore("cola");
      let resultado;
      Promise.resolve(fn(store, r => { resultado = r; }));
      t.oncomplete = () => resolve(resultado);
      t.onerror = () => reject(t.error);
    }));
  }
  return {
    agregar: reg => tx("readwrite", s => s.add(reg)),
    borrar: id => tx("readwrite", s => s.delete(id)),
    listar: () => tx("readonly", (s, set) => { const r = s.getAll(); r.onsuccess = () => set(r.result); }),
    contar: () => tx("readonly", (s, set) => { const r = s.count(); r.onsuccess = () => set(r.result); })
  };
})();

async function migrarColaV1() {
  try {
    const vieja = JSON.parse(localStorage.getItem(LS_COLA_V1) || "[]");
    for (const r of vieja) {
      await db.agregar({ tipo: r.tipo, campos: r.campos, fotos: r.foto ? { "Foto": r.foto } : {}, creado: r.creado || Date.now() });
    }
    localStorage.removeItem(LS_COLA_V1);
  } catch (e) {}
}

async function actualizarBarraPendientes() {
  let n = 0;
  try { n = await db.contar(); } catch (e) {}
  if (!n) {
    $pendientesBar.hidden = true;
  } else {
    $pendientesBar.hidden = false;
    $pendientesTexto.textContent = n === 1 ? "1 registro pendiente de enviar" : n + " registros pendientes de enviar";
  }
  return n;
}

function actualizarEstadoConexion() {
  $estadoConexion.hidden = navigator.onLine;
}
window.addEventListener("online", () => { actualizarEstadoConexion(); sincronizarCola(); });
window.addEventListener("offline", actualizarEstadoConexion);

// ---------------------------------------------------------------- Datos del Sheet

async function cargarDatos() {
  try {
    const cache = JSON.parse(localStorage.getItem(LS_DATOS) || "null");
    if (cache) datos = Object.assign(datos, cache);
  } catch (e) {}
  if (!navigator.onLine) return;
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    const d = await res.json();
    if (d.ok) {
      if (d.catalogos && Object.keys(d.catalogos).length) datos.catalogos = Object.assign({}, CATALOGOS_RESPALDO, d.catalogos);
      if (d.naps && d.naps.length) datos.naps = d.naps;
      if (d.contratos && d.contratos.length) datos.contratos = d.contratos;
      localStorage.setItem(LS_DATOS, JSON.stringify(datos));
    }
  } catch (e) {
    // sin conexión real: se sigue con lo guardado
  }
}

// ---------------------------------------------------------------- Navegación

function irAHome() {
  $btnAtras.hidden = true;
  $titulo.textContent = "SAIFO · Registro de campo";
  renderHome();
  window.scrollTo(0, 0);
}

function irAFormulario(tipoKey) {
  $btnAtras.hidden = false;
  const def = FORMULARIOS[tipoKey];
  $titulo.textContent = def.icono + " " + def.titulo;
  renderFormulario(tipoKey);
  window.scrollTo(0, 0);
}

$btnAtras.addEventListener("click", () => {
  if (confirmarSalida()) irAHome();
});
$btnSincronizar.addEventListener("click", () => sincronizarCola(true));

let formularioSucio = false;
function confirmarSalida() {
  if (!formularioSucio) return true;
  return window.confirm("¿Salir sin guardar? Se perderá lo que llenaste.");
}

// ---------------------------------------------------------------- Vista: Home

async function renderHome() {
  formularioSucio = false;
  $app.innerHTML = `
    <div class="home-grid">
      ${Object.keys(FORMULARIOS).map(key => {
        const f = FORMULARIOS[key];
        return `<button class="home-btn ${f.color}" data-tipo="${key}">
          <span class="icono">${f.icono}</span>
          <span>${f.titulo}</span>
        </button>`;
      }).join("")}
    </div>
    <p class="home-aviso" id="homeAviso">
      Toca el botón de la situación en la que estás. La ubicación se toma sola con el GPS del celular.
    </p>
  `;
  $app.querySelectorAll(".home-btn").forEach(btn => {
    btn.addEventListener("click", () => irAFormulario(btn.dataset.tipo));
  });
  const n = await actualizarBarraPendientes();
  if (n) {
    document.getElementById("homeAviso").insertAdjacentHTML("beforeend",
      `<br><strong>Tienes ${n} registro(s) guardados en el celular esperando señal.</strong>`);
  }
}

// ---------------------------------------------------------------- Vista: Formulario

function opcionesHtml(lista, valor, vacio) {
  return `<option value="">${vacio || "Selecciona..."}</option>` +
    lista.map(o => `<option value="${escHtml(o)}"${o === valor ? " selected" : ""}>${escHtml(o)}</option>`).join("");
}

function campoHtml(c) {
  const req = c.required ? '<span class="req"> *</span>' : "";
  const base = `data-key="${escHtml(c.key)}"`;
  let control = "";
  if (c.type === "select") {
    control = `<select ${base}>${opcionesHtml(datos.catalogos[c.cat] || CATALOGOS_RESPALDO[c.cat] || [])}</select>`;
  } else if (c.type === "puerto") {
    const puertos = Array.from({ length: PUERTOS_POR_NAP }, (_, i) => String(i + 1));
    control = `<select ${base}>${opcionesHtml(puertos)}</select>`;
  } else if (c.type === "textarea") {
    control = `<textarea ${base}></textarea>`;
  } else if (c.type === "contrato") {
    control = `
      <div class="contrato-box" data-contrato="${escHtml(c.key)}">
        <input type="text" class="contrato-input" placeholder="Escribe el número, ej. 500" autocomplete="off" inputmode="text">
        <input type="hidden" ${base}>
        <div class="contrato-resultados" hidden></div>
        <div class="contrato-elegido" hidden></div>
      </div>`;
  } else if (c.type === "nap") {
    control = `
      <div class="nap-grid" data-nap="1">
        <div><span class="mini">Distrito</span><select data-nivel="Distrito"></select></div>
        <div><span class="mini">Ruta</span><select data-nivel="Ruta" disabled></select></div>
        <div><span class="mini">NAP</span><select data-nivel="NAP" disabled></select></div>
      </div>
      <input type="hidden" ${base}>`;
  } else {
    const t = { number: "number", tel: "tel", date: "date", time: "time" }[c.type] || "text";
    const extra = c.type === "number" ? ' inputmode="decimal" step="any"' : "";
    control = `<input type="${t}" ${base}${c.placeholder ? ` placeholder="${escHtml(c.placeholder)}"` : ""}${extra}>`;
  }
  return `<div class="campo" data-campo="${escHtml(c.key)}"><label>${escHtml(c.label)}${req}</label>${control}</div>`;
}

function fotoHtml(f, i) {
  const req = f.required ? '<span class="req"> *</span>' : "";
  return `
    <div class="campo" data-campo="${escHtml(f.key)}">
      <label>${escHtml(f.label)}${req}</label>
      <div class="foto-box" data-foto="${i}">
        <div class="foto-botones">
          <button type="button" class="btn-foto" data-accion="tomar">📷 Tomar foto</button>
          <button type="button" class="btn-foto secundario" data-accion="galeria">🖼️ Galería</button>
          <button type="button" class="btn-foto secundario" data-accion="quitar" hidden>Quitar</button>
        </div>
        <input type="file" accept="image/*" capture="environment" data-input="camara" hidden>
        <input type="file" accept="image/*" data-input="galeria" hidden>
      </div>
    </div>`;
}

function renderFormulario(tipoKey) {
  const def = FORMULARIOS[tipoKey];
  let gps = null;
  const fotos = {}; // key -> dataUrl
  formularioSucio = false;

  $app.innerHTML = `
    <div class="form-header">
      <span class="icono">${def.icono}</span>
      <h2>${def.titulo}</h2>
    </div>
    <form id="formulario" novalidate>
      ${def.campos.map(campoHtml).join("")}

      <div class="campo">
        <label>Ubicación GPS<span class="req"> *</span></label>
        <div class="gps-box">
          <div id="gpsEstado" class="gps-estado"><span class="punto"></span><span>Aún no se ha tomado la ubicación</span></div>
          <button type="button" id="btnGps" class="btn-gps">📍 Usar mi ubicación actual</button>
        </div>
      </div>

      ${(def.fotos || []).length ? `<h3 class="seccion">Fotos</h3>` : ""}
      ${(def.fotos || []).map(fotoHtml).join("")}
    </form>
    <div class="enviar-bar">
      <button id="btnEnviar" class="btn-enviar">Guardar registro</button>
    </div>
  `;

  const form = document.getElementById("formulario");
  const limpiarFalta = e => { const c = e.target.closest(".campo"); if (c) c.classList.remove("falta"); };
  form.addEventListener("input", e => { formularioSucio = true; limpiarFalta(e); });
  form.addEventListener("change", e => { formularioSucio = true; limpiarFalta(e); aplicarCondiciones(def); });

  form.querySelectorAll(".contrato-box").forEach(box => iniciarBuscadorContrato(box, def));
  form.querySelectorAll("[data-nap]").forEach(grid => iniciarCascadaNap(grid));
  iniciarGps();
  iniciarFotos(def, fotos);
  aplicarCondiciones(def);

  // --- GPS ---
  function iniciarGps() {
    const $btnGps = document.getElementById("btnGps");
    const $gpsEstado = document.getElementById("gpsEstado");
    const tomar = () => {
      if (!navigator.geolocation) {
        $gpsEstado.className = "gps-estado error";
        $gpsEstado.innerHTML = `<span class="punto"></span><span>Este celular no permite GPS.</span>`;
        return;
      }
      $btnGps.disabled = true;
      $btnGps.textContent = "Obteniendo ubicación...";
      navigator.geolocation.getCurrentPosition(
        pos => {
          gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          $gpsEstado.className = "gps-estado ok";
          $gpsEstado.innerHTML = `<span class="punto"></span><span>Ubicación tomada: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} (±${Math.round(pos.coords.accuracy)} m)</span>`;
          $btnGps.disabled = false;
          $btnGps.textContent = "📍 Actualizar ubicación";
        },
        err => {
          $gpsEstado.className = "gps-estado error";
          $gpsEstado.innerHTML = `<span class="punto"></span><span>No se pudo obtener la ubicación (${escHtml(err.message)}). Revisa que el GPS esté activado y vuelve a intentar.</span>`;
          $btnGps.disabled = false;
          $btnGps.textContent = "📍 Reintentar";
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    };
    $btnGps.addEventListener("click", tomar);
    tomar(); // se intenta sola al abrir el formulario
  }

  // --- Enviar ---
  document.getElementById("btnEnviar").addEventListener("click", async () => {
    const faltan = [];
    const campos = {};

    def.campos.forEach(c => {
      if (!campoVisible(def, c)) return;
      if (c.type === "nap") {
        const grid = form.querySelector(`[data-campo="${CSS.escape(c.key)}"] [data-nap]`);
        const v = valoresNap(grid);
        campos["Distrito"] = v.Distrito;
        campos["Ruta"] = v.Ruta;
        campos["NAP"] = v.NAP;
        campos["Código NAP"] = v.codigo;
        if (c.required && !v.codigo) faltan.push(c.label);
        return;
      }
      const el = form.querySelector(`[data-key="${CSS.escape(c.key)}"]`);
      const valor = (el.value || "").trim();
      campos[c.key] = valor;
      if (c.required && !valor) faltan.push(c.label);
    });
    campos["Ubicación GPS (lat,long)"] = gps ? `${gps.lat},${gps.lng}` : "";
    if (!gps) faltan.push("Ubicación GPS");

    (def.fotos || []).forEach(f => {
      if (!campoVisible(def, f)) return;
      if (f.required && !fotos[f.key]) faltan.push("Foto: " + f.label.split("—")[0].trim());
    });

    if (faltan.length) {
      marcarFaltantes(def, faltan);
      toast("Falta completar: " + faltan.join(", "), "error");
      return;
    }

    const fotosEnviar = {};
    (def.fotos || []).forEach(f => { if (campoVisible(def, f) && fotos[f.key]) fotosEnviar[f.key] = fotos[f.key]; });

    const $btnEnviar = document.getElementById("btnEnviar");
    $btnEnviar.disabled = true;
    $btnEnviar.textContent = "Guardando...";

    try {
      await db.agregar({ tipo: def.hoja, campos: campos, fotos: fotosEnviar, creado: Date.now() });
    } catch (e) {
      toast("No se pudo guardar en el celular: " + e.message, "error");
      $btnEnviar.disabled = false;
      $btnEnviar.textContent = "Guardar registro";
      return;
    }
    formularioSucio = false;
    $btnEnviar.textContent = "Enviando...";
    const ok = await sincronizarCola();
    if (ok) {
      toast("Registro enviado ✓", "ok");
    } else {
      toast("Sin señal: el registro quedó guardado en el celular y se enviará solo cuando haya conexión.", "");
    }
    irAHome();
  });
}

// ---------------------------------------------------------------- Condiciones (mostrar/ocultar)

function valorCampo(key) {
  const el = document.querySelector(`#formulario [data-key="${CSS.escape(key)}"]`);
  return el ? el.value : "";
}

function campoVisible(def, c) {
  if (c.si) return c.si.en.indexOf(valorCampo(c.si.key)) !== -1;
  if (c.siContiene) {
    const v = valorCampo(c.siContiene.key);
    return c.siContiene.texto.some(t => v.indexOf(t) !== -1);
  }
  return true;
}

function aplicarCondiciones(def) {
  def.campos.concat(def.fotos || []).forEach(c => {
    const nodo = document.querySelector(`#formulario [data-campo="${CSS.escape(c.key)}"]`);
    if (nodo) nodo.hidden = !campoVisible(def, c);
  });
}

function marcarFaltantes(def, faltan) {
  document.querySelectorAll("#formulario .campo.falta").forEach(n => n.classList.remove("falta"));
  let primero = null;
  def.campos.concat(def.fotos || []).forEach(c => {
    const etiqueta = c.label.split("—")[0].trim();
    if (faltan.indexOf(c.label) !== -1 || faltan.indexOf("Foto: " + etiqueta) !== -1) {
      const nodo = document.querySelector(`#formulario [data-campo="${CSS.escape(c.key)}"]`);
      if (nodo) { nodo.classList.add("falta"); if (!primero) primero = nodo; }
    }
  });
  if (faltan.indexOf("Ubicación GPS") !== -1) {
    const g = document.getElementById("gpsEstado").closest(".campo");
    g.classList.add("falta");
    if (!primero) primero = g;
  }
  if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------------------------------------------------------------- Buscador de contrato

function iniciarBuscadorContrato(box, def) {
  const $input = box.querySelector(".contrato-input");
  const $valor = box.querySelector('input[type="hidden"]');
  const $res = box.querySelector(".contrato-resultados");
  const $elegido = box.querySelector(".contrato-elegido");
  const key = box.dataset.contrato;
  const campoDef = def.campos.find(c => c.key === key);
  const indice = new Map(datos.contratos.map(c => [c[0], c]));

  function elegir(codigo, info) {
    $valor.value = codigo;
    $input.hidden = true;
    $res.hidden = true;
    $elegido.hidden = false;
    const estado = info ? info[1] : "No está en la lista";
    const nap = info && info[2] ? " · NAP " + info[2] : "";
    $elegido.innerHTML = `
      <div><strong>${escHtml(codigo)}</strong><br><span class="mini">${escHtml(estado)}${escHtml(nap)}</span></div>
      <button type="button" class="btn-mini">Cambiar</button>`;
    $elegido.querySelector("button").addEventListener("click", () => {
      $valor.value = "";
      $elegido.hidden = true;
      $input.hidden = false;
      $input.value = "";
      $input.focus();
    });
    if (info && info[2]) {
      const grid = document.querySelector("#formulario [data-nap]");
      if (grid && !valoresNap(grid).codigo) fijarNap(grid, info[2]);
    }
    $valor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buscar() {
    const texto = $input.value.trim();
    if (!texto) { $res.hidden = true; return; }
    const normal = normalizarContrato(texto);
    const digitos = normal ? numeroDeContrato(normal) : "";
    const items = [];
    if (normal && indice.has(normal)) items.push(indice.get(normal));
    if (digitos) {
      for (const c of datos.contratos) {
        if (items.length >= 8) break;
        if (c[0] !== normal && numeroDeContrato(c[0]).indexOf(digitos) === 0) items.push(c);
      }
    }
    let html = items.map(c => `
      <button type="button" class="contrato-op" data-codigo="${escHtml(c[0])}">
        <strong>${escHtml(c[0])}</strong>
        <span class="mini">${escHtml(c[1])}${c[2] ? " · NAP " + escHtml(c[2]) : ""}</span>
      </button>`).join("");
    if (normal && !indice.has(normal)) {
      const aviso = campoDef && campoDef.permitirNuevo ? "contrato nuevo, aún no está en la lista" : "no está en la lista — verifica el número";
      html = `
        <button type="button" class="contrato-op nuevo" data-codigo="${escHtml(normal)}" data-nuevo="1">
          <strong>Usar ${escHtml(normal)}</strong>
          <span class="mini">${aviso}</span>
        </button>` + html;
    }
    if (!html) html = `<div class="contrato-vacio">Escribe solo el número del contrato (ej. 500)</div>`;
    $res.innerHTML = html;
    $res.hidden = false;
    $res.querySelectorAll(".contrato-op").forEach(b => {
      b.addEventListener("click", () => elegir(b.dataset.codigo, indice.get(b.dataset.codigo) || null));
    });
  }

  $input.addEventListener("input", buscar);
  $input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const primero = $res.querySelector(".contrato-op");
      if (primero) primero.click();
    }
  });
}

// ---------------------------------------------------------------- Distrito → Ruta → NAP

function arbolNaps() {
  const arbol = {};
  datos.naps.forEach(cod => {
    const m = String(cod).match(/^(D\d+)(R\d+)(N\d+)$/);
    if (!m) return;
    arbol[m[1]] = arbol[m[1]] || {};
    arbol[m[1]][m[2]] = arbol[m[1]][m[2]] || [];
    arbol[m[1]][m[2]].push(m[3]);
  });
  return arbol;
}

function iniciarCascadaNap(grid) {
  const arbol = arbolNaps();
  const $d = grid.querySelector('[data-nivel="Distrito"]');
  const $r = grid.querySelector('[data-nivel="Ruta"]');
  const $n = grid.querySelector('[data-nivel="NAP"]');
  const $valor = grid.parentNode.querySelector('input[type="hidden"]');
  $d.innerHTML = opcionesHtml(Object.keys(arbol).sort(), "", "Elegir");
  $r.innerHTML = opcionesHtml([], "", "—");
  $n.innerHTML = opcionesHtml([], "", "—");

  function actualizarValor() {
    $valor.value = valoresNap(grid).codigo;
  }
  $d.addEventListener("change", () => {
    const rutas = $d.value ? Object.keys(arbol[$d.value]).sort() : [];
    $r.innerHTML = opcionesHtml(rutas, "", "Elegir");
    $r.disabled = !$d.value;
    $n.innerHTML = opcionesHtml([], "", "—");
    $n.disabled = true;
    actualizarValor();
  });
  $r.addEventListener("change", () => {
    const naps = $d.value && $r.value ? arbol[$d.value][$r.value].slice().sort() : [];
    $n.innerHTML = opcionesHtml(naps, "", "Elegir");
    $n.disabled = !$r.value;
    actualizarValor();
  });
  $n.addEventListener("change", actualizarValor);
}

function valoresNap(grid) {
  const d = grid.querySelector('[data-nivel="Distrito"]').value;
  const r = grid.querySelector('[data-nivel="Ruta"]').value;
  const n = grid.querySelector('[data-nivel="NAP"]').value;
  return { Distrito: d, Ruta: r, NAP: n, codigo: d && r && n ? d + r + n : "" };
}

function fijarNap(grid, codigo) {
  const m = String(codigo).match(/^(D\d+)(R\d+)(N\d+)$/);
  if (!m) return;
  const $d = grid.querySelector('[data-nivel="Distrito"]');
  const $r = grid.querySelector('[data-nivel="Ruta"]');
  const $n = grid.querySelector('[data-nivel="NAP"]');
  $d.value = m[1];
  $d.dispatchEvent(new Event("change"));
  $r.value = m[2];
  $r.dispatchEvent(new Event("change"));
  $n.value = m[3];
  $n.dispatchEvent(new Event("change"));
}

// ---------------------------------------------------------------- Fotos

function iniciarFotos(def, fotos) {
  (def.fotos || []).forEach((f, i) => {
    const box = document.querySelector(`#formulario [data-foto="${i}"]`);
    const $tomar = box.querySelector('[data-accion="tomar"]');
    const $galeria = box.querySelector('[data-accion="galeria"]');
    const $quitar = box.querySelector('[data-accion="quitar"]');
    const $inCam = box.querySelector('[data-input="camara"]');
    const $inGal = box.querySelector('[data-input="galeria"]');

    const cargar = input => {
      const file = input.files[0];
      if (!file) return;
      $tomar.textContent = "Procesando...";
      comprimirImagen(file, 1280, 0.7).then(dataUrl => {
        fotos[f.key] = dataUrl;
        let $img = box.querySelector("img");
        if (!$img) {
          $img = document.createElement("img");
          box.insertBefore($img, box.firstChild);
        }
        $img.src = dataUrl;
        $tomar.textContent = "📷 Cambiar foto";
        $quitar.hidden = false;
        box.closest(".campo").classList.remove("falta");
        formularioSucio = true;
      }).catch(() => {
        $tomar.textContent = "📷 Tomar foto";
        toast("No se pudo leer la foto, intenta de nuevo.", "error");
      });
    };
    $tomar.addEventListener("click", () => $inCam.click());
    $galeria.addEventListener("click", () => $inGal.click());
    $inCam.addEventListener("change", () => cargar($inCam));
    $inGal.addEventListener("change", () => cargar($inGal));
    $quitar.addEventListener("click", () => {
      delete fotos[f.key];
      $inCam.value = "";
      $inGal.value = "";
      const $img = box.querySelector("img");
      if ($img) $img.remove();
      $tomar.textContent = "📷 Tomar foto";
      $quitar.hidden = true;
    });
  });
}

function comprimirImagen(file, maxLado, calidad) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) {
          height = Math.round(height * (maxLado / width));
          width = maxLado;
        } else if (height > maxLado) {
          width = Math.round(width * (maxLado / height));
          height = maxLado;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- Envío

async function enviarUno(registro) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    // text/plain evita el preflight OPTIONS, que Apps Script no responde.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ tipo: registro.tipo, campos: registro.campos, fotos: registro.fotos })
  });
  return res.json();
}

let sincronizando = false;
async function sincronizarCola(mostrarError) {
  if (sincronizando) return false;
  if (!navigator.onLine) { actualizarEstadoConexion(); return false; }
  sincronizando = true;
  let huboExito = false;
  try {
    const cola = await db.listar();
    cola.sort((a, b) => a.creado - b.creado);
    for (const registro of cola) {
      let resultado;
      try {
        resultado = await enviarUno(registro);
      } catch (e) {
        resultado = { ok: false, error: String(e) };
      }
      if (resultado && resultado.ok) {
        await db.borrar(registro.id);
        huboExito = true;
      } else {
        if (mostrarError) toast("No se pudo enviar: " + (resultado && resultado.error ? resultado.error : "sin conexión con el servidor."), "error");
        break; // reintenta más tarde, sin perder el orden
      }
    }
  } catch (e) {
    if (mostrarError) toast("Error al leer los pendientes: " + e.message, "error");
  } finally {
    sincronizando = false;
    actualizarBarraPendientes();
  }
  return huboExito;
}

// ---------------------------------------------------------------- Arranque

(async function iniciar() {
  actualizarEstadoConexion();
  await migrarColaV1();
  await cargarDatos();
  irAHome();
  sincronizarCola();
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  setInterval(() => { if (navigator.onLine) sincronizarCola(); }, 60000);
})();
