// SAIFO — Backend de la app de técnicos de campo.
//
// Que hace:
//  - doGet  -> devuelve los catalogos (listas cerradas) en JSON, leidos en vivo
//              de la pestana CATALOGOS del Google Sheet. Asi, si cambian una
//              lista en el Sheet, la app se actualiza sola, sin tocar codigo.
//  - doPost -> recibe un registro desde la app (instalacion, retiro, soporte
//              o recorrido), lo agrega como fila nueva en la pestana que
//              corresponde, y si viene una foto la sube a una carpeta de
//              Drive y guarda el link en la columna de foto.
//
// Instrucciones de despliegue: ver README.md en la raiz del proyecto.

// ID del Google Sheet "SAIFO — Formularios de campo (Instalaciones, Retiros, Soporte, Recorridos)"
var SPREADSHEET_ID = '16Pmkl36CBOtCAvPtpY1c-WGS0gVbjDa18u3FAndPw64';

// Nombre de la carpeta de Drive donde se guardan las fotos (se crea sola si no existe).
var FOTOS_FOLDER_NAME = 'SAIFO_Fotos_Campo';

// Pestañas válidas que la app puede escribir.
var HOJAS_VALIDAS = ['INSTALACIONES', 'RETIROS_BAJAS', 'SOPORTE', 'RECORRIDOS_VENTA'];

// Columnas de catálogo a exponer: letra de columna -> clave que usará la app.
var COLUMNAS_CATALOGO = {
B: 'TECNICOS',
C: 'ZONAS',
D: 'PLANES',
E: 'SI_NO',
F: 'TIPO_RETIRO',
G: 'MOTIVO_BAJA',
H: 'ESTADO_EQUIPO',
I: 'TIPO_FALLA',
J: 'RESULTADO_RECORRIDO',
K: 'MATERIAL_ENTREGADO',
L: 'EQUIPO_MODELO'
};

function doGet(e) {
try {
var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
var cat = ss.getSheetByName('CATALOGOS');
var catalogos = {};
for (var col in COLUMNAS_CATALOGO) {
var key = COLUMNAS_CATALOGO[col];
var range = cat.getRange(col + '2:' + col + '300');
var values = range.getValues()
.map(function (r) { return r[0]; })
.filter(function (v) { return v !== '' && v !== null; });
catalogos[key] = values;
}
return jsonOut({ ok: true, catalogos: catalogos });
} catch (err) {
return jsonOut({ ok: false, error: String(err) });
}
}

function doPost(e) {
var lock = LockService.getScriptLock();
try {
lock.waitLock(15000); // evita que dos envíos al mismo tiempo se pisen al agregar fila
} catch (lockErr) {
return jsonOut({ ok: false, error: 'El servidor está ocupado, intenta de nuevo en unos segundos.' });
}

try {
var body = JSON.parse(e.postData.contents);
var tipo = body.tipo;
var campos = body.campos || {};
var fotoBase64 = body.foto || null; // "data:image/jpeg;base64,...."

if (HOJAS_VALIDAS.indexOf(tipo) === -1) {
return jsonOut({ ok: false, error: 'Tipo de formulario no reconocido: ' + tipo });
}

var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
var sheet = ss.getSheetByName(tipo);
if (!sheet) {
return jsonOut({ ok: false, error: 'No existe la pestaña ' + tipo });
}

var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

// Si viene foto, subirla a Drive y guardar el link para ponerlo en la
// columna de foto que corresponda (distinto nombre según la hoja).
var fotoUrl = '';
if (fotoBase64) {
fotoUrl = guardarFoto(fotoBase64, tipo, campos);
}

var now = new Date();
var tz = ss.getSpreadsheetTimeZone();
var fila = headers.map(function (h) {
var hNorm = h.trim();
if (hNorm === 'Fecha') return Utilities.formatDate(now, tz, 'yyyy-MM-dd');
if (hNorm === 'Hora' || hNorm === 'Hora de reporte') {
return campos[hNorm] || Utilities.formatDate(now, tz, 'HH:mm');
}
if (hNorm === 'Foto tomada' || hNorm === 'Foto o video tomado') {
return fotoUrl ? fotoUrl : (campos[hNorm] || '');
}
return campos[hNorm] !== undefined ? campos[hNorm] : '';
});

sheet.appendRow(fila);

return jsonOut({ ok: true, fila: sheet.getLastRow() });
} catch (err) {
return jsonOut({ ok: false, error: String(err) });
} finally {
lock.releaseLock();
}
}

function guardarFoto(dataUrl, tipo, campos) {
try {
var match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
if (!match) return '';
var mime = match[1];
var base64 = match[2];
var bytes = Utilities.base64Decode(base64);
var ext = mime.indexOf('png') !== -1 ? 'png' : 'jpg';
var contrato = campos['N° de contrato / cliente'] || 'sin-contrato';
var nombre = tipo + '_' + contrato + '_' + new Date().getTime() + '.' + ext;
var blob = Utilities.newBlob(bytes, mime, nombre);

var folder = getOrCreateFolder(FOTOS_FOLDER_NAME);
var file = folder.createFile(blob);
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
return file.getUrl();
} catch (err) {
return 'ERROR_FOTO: ' + String(err);
}
}

function getOrCreateFolder(name) {
var it = DriveApp.getFoldersByName(name);
if (it.hasNext()) return it.next();
return DriveApp.createFolder(name);
}

function jsonOut(obj) {
return ContentService
.createTextOutput(JSON.stringify(obj))
.setMimeType(ContentService.MimeType.JSON);
}
