// ============================================================================
// SAIFO — Registro de campo. Lógica de la app (sin frameworks, para que
// cargue rápido en celulares de gama baja con internet débil).
// ============================================================================

const $app = document.getElementById("app");
const $titulo = document.getElementById("tituloTop");
const $btnAtras = document.getElementById("btnAtras");
const $estadoConexion = document.getElementById("estadoConexion");
const $pendientesBar = document.getElementById("pendientesBar");
const $pendientesTexto = document.getElementById("pendientesTexto");
const $btnSincronizar = document.getElementById("btnSincronizar");
const $toast = document.getElementById("toast");

const LS_COLA = "saifo_cola_envios";
const LS_CATALOGOS = "saifo_catalogos_cache";

let catalogosActuales = CATALOGOS_RESPALDO;

// ---------------------------------------------------------------- Utilidades

function toast(msg, tipo) {
$toast.textContent = msg;
$toast.className = "toast" + (tipo ? " " + tipo : "");
$toast.hidden = false;
clearTimeout(toast._t);
toast._t = setTimeout(() => { $toast.hidden = true; }, 3200);
}

function leerCola() {
try { return JSON.parse(localStorage.getItem(LS_COLA)) || []; }
catch (e) { return []; }
}
function guardarCola(cola) {
localStorage.setItem(LS_COLA, JSON.stringify(cola));
actualizarBarraPendientes();
}
function actualizarBarraPendientes() {
const cola = leerCola();
if (cola.length === 0) {
$pendientesBar.hidden = true;
} else {
$pendientesBar.hidden = false;
$pendientesTexto.textContent = cola.length === 1
? "1 registro pendiente de enviar"
: cola.length + " registros pendientes de enviar";
}
}

function actualizarEstadoConexion() {
$estadoConexion.hidden = navigator.onLine;
}
window.addEventListener("online", () => { actualizarEstadoConexion(); sincronizarCola(); });
window.addEventListener("offline", actualizarEstadoConexion);

// ---------------------------------------------------------------- Catálogos

async function cargarCatalogos() {
const cache = localStorage.getItem(LS_CATALOGOS);
if (cache) {
try { catalogosActuales = JSON.parse(cache); } catch (e) {}
}
if (!navigator.onLine || !APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PEGA_AQUI") !== -1) return;
try {
const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
const data = await res.json();
if (data.ok && data.catalogos) {
catalogosActuales = data.catalogos;
localStorage.setItem(LS_CATALOGOS, JSON.stringify(data.catalogos));
}
} catch (e) {
// sin conexion real o CORS: se sigue con el respaldo/cache, sin molestar al tecnico
}
}

// ---------------------------------------------------------------- Router

function irAHome() {
$btnAtras.hidden = true;
$titulo.textContent = "SAIFO · Registro de campo";
renderHome();
}

function irAFormulario(tipoKey) {
$btnAtras.hidden = false;
const def = FORMULARIOS[tipoKey];
$titulo.textContent = def.icono + " " + def.titulo;
renderFormulario(tipoKey);
}

$btnAtras.addEventListener("click", irAHome);
$btnSincronizar.addEventListener("click", () => sincronizarCola(true));

// ---------------------------------------------------------------- Vista: Home

function renderHome() {
const cola = leerCola();
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
<p class="home-aviso">
Toca el botón de la situación en la que estás. La ubicación se toma sola con el GPS del celular.
${cola.length ? "Tienes " + cola.length + " registro(s) guardados en el celular esperando señal." : ""}
</p>
`;
$app.querySelectorAll(".home-btn").forEach(btn => {
btn.addEventListener("click", () => irAFormulario(btn.dataset.tipo));
});
}

// ---------------------------------------------------------------- Vista: Formulario

function renderFormulario(tipoKey) {
const def = FORMULARIOS[tipoKey];
let gps = null; // { lat, lng }
let fotoDataUrl = null;

const camposHtml = def.campos.map(c => {
const req = c.required ? '<span class="req"> *</span>' : "";
if (c.type === "select") {
const opciones = (catalogosActuales[c.cat] || CATALOGOS_RESPALDO[c.cat] || []);
return `
<div class="campo">
<label>${c.label}${req}</label>
<select data-key="${c.key}" ${c.required ? "required" : ""}>
<option value="">Selecciona...</option>
${opciones.map(o => `<option value="${escHtml(o)}">${escHtml(o)}</option>`).join("")}
</select>
</div>`;
}
if (c.type === "textarea") {
return `
<div class="campo">
<label>${c.label}${req}</label>
<textarea data-key="${c.key}" ${c.required ? "required" : ""}></textarea>
</div>`;
}
const inputType = c.type === "number" ? "number" : "text";
return `
<div class="campo">
<label>${c.label}${req}</label>
<input type="${inputType}" data-key="${c.key}" ${c.placeholder ? `placeholder="${c.placeholder}"` : ""} ${c.required ? "required" : ""} inputmode="${c.type === "number" ? "decimal" : "text"}">
</div>`;
}).join("");

$app.innerHTML = `
<div class="form-header">
<span class="icono">${def.icono}</span>
<h2>${def.titulo}</h2>
</div>
<form id="formulario">
${camposHtml}

<div class="campo">
<label>Ubicación GPS</label>
<div class="gps-box">
<div id="gpsEstado" class="gps-estado"><span class="punto"></span><span>Aún no se ha tomado la ubicación</span></div>
<button type="button" id="btnGps" class="btn-gps">📍 Usar mi ubicación actual</button>
</div>
</div>

${def.foto ? `
<div class="campo">
<label>${def.foto.label}</label>
<div class="foto-box" id="fotoBox">
<div class="foto-botones">
<button type="button" id="btnFotoCamara" class="btn-foto">📷 Tomar foto</button>
<button type="button" id="btnFotoQuitar" class="btn-foto secundario" hidden>Quitar</button>
</div>
<input type="file" id="inputFoto" accept="image/*" capture="environment" hidden>
</div>
</div>` : ""}
</form>
<div class="enviar-bar">
<button id="btnEnviar" class="btn-enviar">Guardar registro</button>
</div>
`;

// --- GPS ---
const $btnGps = document.getElementById("btnGps");
const $gpsEstado = document.getElementById("gpsEstado");
$btnGps.addEventListener("click", () => {
if (!navigator.geolocation) {
$gpsEstado.className = "gps-estado error";
$gpsEstado.innerHTML = `<span class="punto"></span><span>Este dispositivo no permite GPS. Pega lat,long manualmente si lo necesitas.</span>`;
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
$gpsEstado.innerHTML = `<span class="punto"></span><span>No se pudo obtener la ubicación (${err.message}). Revisa que el GPS esté activado.</span>`;
$btnGps.disabled = false;
$btnGps.textContent = "📍 Reintentar";
},
{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
);
});

// --- Foto ---
if (def.foto) {
const $inputFoto = document.getElementById("inputFoto");
const $btnFotoCamara = document.getElementById("btnFotoCamara");
const $btnFotoQuitar = document.getElementById("btnFotoQuitar");
const $fotoBox = document.getElementById("fotoBox");

$btnFotoCamara.addEventListener("click", () => $inputFoto.click());
$inputFoto.addEventListener("change", () => {
const file = $inputFoto.files[0];
if (!file) return;
comprimirImagen(file, 1280, 0.72).then(dataUrl => {
fotoDataUrl = dataUrl;
let $img = $fotoBox.querySelector("img");
if (!$img) {
$img = document.createElement("img");
$fotoBox.insertBefore($img, $fotoBox.firstChild);
}
$img.src = dataUrl;
$btnFotoCamara.textContent = "📷 Cambiar foto";
$btnFotoQuitar.hidden = false;
});
});
$btnFotoQuitar.addEventListener("click", () => {
fotoDataUrl = null;
$inputFoto.value = "";
const $img = $fotoBox.querySelector("img");
if ($img) $img.remove();
$btnFotoCamara.textContent = "📷 Tomar foto";
$btnFotoQuitar.hidden = true;
});
}

// --- Enviar ---
document.getElementById("btnEnviar").addEventListener("click", async () => {
const form = document.getElementById("formulario");
if (!form.checkValidity()) {
form.reportValidity();
return;
}
const campos = {};
def.campos.forEach(c => {
campos[c.key] = form.querySelector(`[data-key="${CSS.escape(c.key)}"]`).value.trim();
});
campos["Ubicación GPS (lat,long)"] = gps ? `${gps.lat},${gps.lng}` : "";

const registro = {
tipo: def.hoja,
campos: campos,
foto: fotoDataUrl,
creado: Date.now()
};

const $btnEnviar = document.getElementById("btnEnviar");
$btnEnviar.disabled = true;
$btnEnviar.textContent = "Guardando...";

const cola = leerCola();
cola.push(registro);
guardarCola(cola);

const ok = await sincronizarCola();
if (ok) {
toast("Registro enviado ✓", "ok");
} else {
toast("Sin señal: el registro quedó guardado en el celular y se enviará solo cuando haya conexión.", "");
}
irAHome();
});
}

function escHtml(s) {
return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

// ---------------------------------------------------------------- Envío / cola

async function enviarUno(registro) {
if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PEGA_AQUI") !== -1) {
return { ok: false, error: "La app todavía no está conectada al Google Sheet (falta configurar APPS_SCRIPT_URL en config.js)." };
}
const res = await fetch(APPS_SCRIPT_URL, {
method: "POST",
// text/plain evita que el navegador mande un preflight OPTIONS, que
// Apps Script no responde. Es la forma que funciona en la práctica.
headers: { "Content-Type": "text/plain;charset=utf-8" },
body: JSON.stringify({ tipo: registro.tipo, campos: registro.campos, foto: registro.foto })
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
let cola = leerCola();
while (cola.length > 0) {
const registro = cola[0];
let resultado;
try {
resultado = await enviarUno(registro);
} catch (e) {
resultado = { ok: false, error: String(e) };
}
if (resultado && resultado.ok) {
cola.shift();
guardarCola(cola);
huboExito = true;
} else {
if (mostrarError) toast("No se pudo enviar: " + (resultado && resultado.error ? resultado.error : "sin conexión con el servidor."), "error");
break; // se detiene y reintenta más tarde, sin perder el orden
}
}
} finally {
sincronizando = false;
}
return huboExito;
}

// ---------------------------------------------------------------- Arranque

(async function iniciar() {
actualizarEstadoConexion();
actualizarBarraPendientes();
await cargarCatalogos();
irAHome();
sincronizarCola();
if (navigator.serviceWorker) {
navigator.serviceWorker.register("sw.js").catch(() => {});
}
setInterval(() => { if (navigator.onLine) sincronizarCola(); }, 60000);
})();
