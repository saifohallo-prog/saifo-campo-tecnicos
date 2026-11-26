// SAIFO - Backend de la app de tecnicos de campo (version 2).
//
// doGet  -> devuelve catalogos, cajas NAP y contratos (para el buscador).
// doPost -> agrega el registro como fila nueva en la pestana que corresponde
//           y sube las fotos a la carpeta de Drive SAIFO_Fotos_Campo.
//
// Funciones para ejecutar a mano desde el editor (boton Ejecutar):
//  - configurarHojas    -> deja las pestanas con la estructura nueva (una vez).
//  - importarContratos  -> carga en la pestana CONTRATOS el CSV mas reciente
//                          de la carpeta de Drive SAIFO_Contratos_Odoo.

var SPREADSHEET_ID = '16Pmkl36CBOtCAvPtpY1c-WGS0gVbjDa18u3FAndPw64';
var FOTOS_FOLDER_NAME = 'SAIFO_Fotos_Campo';
var CONTRATOS_FOLDER_NAME = 'SAIFO_Contratos_Odoo';
var CONTRATOS_FOLDER_ID = '1QvHBA8fxPR7sgOwZKHUmJiLSKgypx-NY';
var PREFIJO_CONTRATO = 'CT004F-';

var ESTRUCTURA = {
  INSTALACIONES: ['Fecha', 'Hora', 'Técnico', 'N° de contrato', 'Nombre del cliente', 'Distrito', 'Ruta', 'NAP', 'Código NAP', 'Puerto usado', 'Plan contratado', 'Potencia óptica medida (dBm)', 'Dirección / referencia', 'Ubicación GPS (lat,long)', 'Foto router (serie)', 'Foto ONT (serie)', 'Foto equipos instalados', 'Observaciones'],
  RETIROS_BAJAS: ['Fecha', 'Hora', 'Técnico', 'N° de contrato', 'Tipo', 'Motivo de baja', 'Distrito', 'Ruta', 'NAP', 'Código NAP', 'Puerto liberado', 'N° de puerto liberado', 'Equipos retirados', 'Estado del equipo retirado', 'Dirección / referencia', 'Ubicación GPS (lat,long)', 'Foto ONT retirada', 'Foto router retirado', 'Foto equipo nuevo colocado', 'Observaciones'],
  SOPORTE: ['Fecha', 'Hora de reporte', 'Hora de atención', 'Técnico', 'N° de contrato', 'Tipo de falla reportada', 'Causa encontrada', 'Potencia óptica antes (dBm)', 'Potencia óptica después (dBm)', 'Equipo cambiado', 'Resuelto en sitio', 'Distrito', 'Ruta', 'NAP', 'Código NAP', 'Dirección / referencia', 'Ubicación GPS (lat,long)', 'Foto equipo retirado', 'Foto equipo nuevo colocado', 'Foto instalación final', 'Observaciones'],
  RECORRIDOS_VENTA: ['Fecha', 'Hora', 'Vendedor / técnico', 'Distrito', 'Ruta', 'NAP', 'Código NAP', 'Dirección / sector', 'Nombre del prospecto / referido', 'Celular', 'Resultado', 'Plan de interés', 'Próximo contacto', 'N° de contrato (si vendió)', 'Material entregado', 'Ubicación GPS (lat,long)', 'Foto', 'Observaciones']
};

var CATALOGOS_INICIALES = {
  TECNICOS: ['Roling Lindao - Técnico', 'Paul Cabrera - Vendedor'],
  PLANES: ['HALLO Brisa (300/400 Mbps)', 'HALLO Marea (500 Mbps)', 'HALLO Ola (650 Mbps)', 'HALLO Corriente (800 Mbps)'],
  SI_NO: ['Sí', 'No'],
  TIPO_RETIRO: ['Corte temporal por falta de pago', 'Retiro definitivo', 'Suspensión a pedido del cliente', 'Reconexión (retiro de corte)'],
  MOTIVO_BAJA: ['Falta de pago', 'Mudanza o cambio de domicilio', 'Cambio a otro proveedor', 'Insatisfacción con el servicio (velocidad/intermitencia)', 'Insatisfacción con el precio', 'Contrato duplicado o erróneo', 'Fin de promoción, no renovó', 'Otro (detallar en observaciones)'],
  EQUIPOS_RETIRADOS: ['ONT y router', 'Solo ONT', 'Solo router', 'Ninguno (no se recuperó)'],
  ESTADO_EQUIPO: ['Funcional', 'Dañado', 'No recuperado', 'No aplica'],
  TIPO_FALLA: ['Sin señal (caída total)', 'Señal intermitente', 'Velocidad baja', 'Falla de equipo (ONT/router)', 'Falla eléctrica / sin energía', 'Cable o caja NAP dañada (corte físico)', 'Configuración / Wi-Fi', 'Falsa alarma', 'Otro (detallar en observaciones)'],
  EQUIPO_CAMBIADO: ['No se cambió', 'ONT', 'Router', 'ONT y router'],
  RESULTADO_RECORRIDO: ['Venta cerrada (contrato generado)', 'Interesado - dar seguimiento', 'Referido - dar seguimiento', 'No había puerto libre en la caja', 'No había nadie en casa', 'No le interesó', 'Ya tiene otro proveedor', 'Zona sin cobertura confirmada'],
  MATERIAL_ENTREGADO: ['Volante impreso', 'Explicación verbal de los planes', 'Volante + explicación', 'Ninguno']
};

// Cajas NAP por ruta, segun el ERP: distrito+ruta : cantidad de cajas.
var NAPS_POR_RUTA = 'D01R01:8,D01R02:11,D01R03:3,D01R04:1,D02R01:4,D02R02:3,D02R03:5,D03R01:5,D03R02:18,D03R03:8,D04R01:3,D04R02:2,D04R03:11,D04R04:1,D05R01:8,D05R02:3,D05R03:1';

function abrir() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// ------------------------------------------------------------------ GET

function doGet(e) {
  try {
    var ss = abrir();
    return jsonOut({
      ok: true,
      catalogos: leerCatalogos(ss),
      naps: leerNaps(ss),
      contratos: leerContratos(ss)
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function leerCatalogos(ss) {
  var sh = ss.getSheetByName('CATALOGOS');
  var datos = sh.getDataRange().getValues();
  var out = {};
  var encabezado = datos[0];
  for (var c = 0; c < encabezado.length; c++) {
    var key = String(encabezado[c]).trim();
    if (!key || key.indexOf(' ') !== -1) continue;
    var vals = [];
    for (var r = 1; r < datos.length; r++) {
      var v = datos[r][c];
      if (v !== '' && v !== null) vals.push(String(v));
    }
    out[key] = vals;
  }
  return out;
}

function leerNaps(ss) {
  var sh = ss.getSheetByName('NAPS');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v; });
}

// Devuelve [[codigo, estado, codigoNap], ...]
function leerContratos(ss) {
  var sh = ss.getSheetByName('CONTRATOS');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .filter(function (r) { return r[0]; })
    .map(function (r) { return [String(r[0]), String(r[1]), String(r[2])]; });
}

// ------------------------------------------------------------------ POST

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return jsonOut({ ok: false, error: 'El servidor está ocupado, intenta de nuevo en unos segundos.' });
  }

  try {
    var body = JSON.parse(e.postData.contents);
    var tipo = body.tipo;
    var campos = body.campos || {};
    var fotos = body.fotos || {};
    if (body.foto) fotos['Foto'] = body.foto;

    if (!ESTRUCTURA[tipo]) {
      return jsonOut({ ok: false, error: 'Tipo de formulario no reconocido: ' + tipo });
    }

    var ss = abrir();
    var sheet = ss.getSheetByName(tipo);
    if (!sheet) {
      return jsonOut({ ok: false, error: 'No existe la pestaña ' + tipo });
    }

    var contrato = campos['N° de contrato'] || campos['N° de contrato (si vendió)'] || 'sin-contrato';
    for (var nombreFoto in fotos) {
      if (fotos[nombreFoto]) {
        campos[nombreFoto] = guardarFoto(fotos[nombreFoto], tipo, contrato, nombreFoto);
      }
    }

    var tz = 'America/Guayaquil';
    var now = new Date();
    campos['Fecha'] = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    if (tipo === 'SOPORTE') {
      campos['Hora de atención'] = Utilities.formatDate(now, tz, 'HH:mm');
    } else {
      campos['Hora'] = Utilities.formatDate(now, tz, 'HH:mm');
    }

    // Si llega un campo que no tiene columna, se agrega la columna al final.
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (h) { return String(h).trim(); });
    for (var k in campos) {
      if (headers.indexOf(k) === -1) {
        headers.push(k);
        sheet.getRange(1, headers.length).setValue(k);
      }
    }

    var fila = headers.map(function (h) {
      return campos[h] !== undefined ? campos[h] : '';
    });
    sheet.appendRow(fila);

    if (tipo === 'INSTALACIONES' && campos['N° de contrato']) {
      registrarContratoNuevo(ss, campos['N° de contrato'], campos['Código NAP'] || '');
    }

    return jsonOut({ ok: true, fila: sheet.getLastRow() });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Si el contrato de una instalacion no estaba en la lista, se agrega
// para que aparezca en el buscador de retiros y soporte.
function registrarContratoNuevo(ss, codigo, nap) {
  var sh = ss.getSheetByName('CONTRATOS');
  if (!sh) return;
  var existentes = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < existentes.length; i++) {
    if (String(existentes[i][0]) === codigo) return;
  }
  sh.appendRow([codigo, 'Instalado (registrado en campo)', nap, '', 'App de campo']);
}

function guardarFoto(dataUrl, tipo, contrato, etiqueta) {
  try {
    var match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) return '';
    var mime = match[1];
    var bytes = Utilities.base64Decode(match[2]);
    var ext = mime.indexOf('png') !== -1 ? 'png' : 'jpg';
    var limpio = String(etiqueta).replace(/[^A-Za-z0-9]+/g, '_');
    var nombre = tipo + '_' + contrato + '_' + limpio + '_' + new Date().getTime() + '.' + ext;
    var blob = Utilities.newBlob(bytes, mime, nombre);
    var file = getOrCreateFolder(FOTOS_FOLDER_NAME).createFile(blob);
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

// ------------------------------------------------------------------ CONFIGURACION (ejecutar a mano)

function configurarHojas() {
  var ss = abrir();

  for (var nombre in ESTRUCTURA) {
    var sh = ss.getSheetByName(nombre);
    if (sh && sh.getLastRow() > 2) {
      // Tiene datos reales: se guarda como version anterior, no se borra nada.
      sh.setName(nombre + ' (v1)');
      sh = null;
    }
    if (!sh) sh = ss.insertSheet(nombre);
    sh.clear();
    var h = ESTRUCTURA[nombre];
    sh.getRange(1, 1, 1, h.length).setValues([h])
      .setFontWeight('bold').setBackground('#0f3d57').setFontColor('#ffffff').setWrap(true);
    sh.setFrozenRows(1);
    if (sh.getMaxColumns() > h.length) {
      sh.deleteColumns(h.length + 1, sh.getMaxColumns() - h.length);
    }
  }

  var cat = ss.getSheetByName('CATALOGOS') || ss.insertSheet('CATALOGOS');
  cat.clear();
  var claves = Object.keys(CATALOGOS_INICIALES);
  var max = 0;
  claves.forEach(function (k) { max = Math.max(max, CATALOGOS_INICIALES[k].length); });
  var tabla = [claves];
  for (var r = 0; r < max; r++) {
    tabla.push(claves.map(function (k) { return CATALOGOS_INICIALES[k][r] || ''; }));
  }
  cat.getRange(1, 1, tabla.length, claves.length).setValues(tabla);
  cat.getRange(1, 1, 1, claves.length).setFontWeight('bold').setBackground('#0f3d57').setFontColor('#ffffff');
  cat.setFrozenRows(1);

  var naps = ss.getSheetByName('NAPS') || ss.insertSheet('NAPS');
  naps.clear();
  var filas = [['Código NAP', 'Distrito', 'Ruta', 'NAP', 'Puertos']];
  NAPS_POR_RUTA.split(',').forEach(function (par) {
    var partes = par.split(':');
    var dr = partes[0];
    for (var n = 1; n <= Number(partes[1]); n++) {
      var nn = 'N' + (n < 10 ? '0' + n : n);
      filas.push([dr + nn, dr.substr(0, 3), dr.substr(3, 3), nn, 16]);
    }
  });
  naps.getRange(1, 1, filas.length, 5).setValues(filas);
  naps.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f3d57').setFontColor('#ffffff');
  naps.setFrozenRows(1);

  var con = ss.getSheetByName('CONTRATOS') || ss.insertSheet('CONTRATOS');
  if (con.getLastRow() === 0) {
    con.getRange(1, 1, 1, 5).setValues([['Contrato', 'Estado', 'Código NAP', 'Fecha activación', 'Origen']])
      .setFontWeight('bold').setBackground('#0f3d57').setFontColor('#ffffff');
    con.setFrozenRows(1);
  }

  var leeme = ss.getSheetByName('LEEME');
  if (leeme) {
    leeme.clear();
    leeme.getRange(1, 1, 8, 1).setValues([
      ['Formularios de campo - SAIFO (HALLO La Libertad) - version 2'],
      ['Los datos se registran desde la app: https://saifohallo-prog.github.io/saifo-campo-tecnicos/'],
      ['INSTALACIONES, RETIROS_BAJAS, SOPORTE y RECORRIDOS_VENTA: una fila por registro enviado desde la app. Las fotos quedan en la carpeta de Drive SAIFO_Fotos_Campo y aquí queda el link.'],
      ['CATALOGOS: listas de los menús (técnicos, planes, motivos...). Si agregas un técnico aquí, aparece solo en la app.'],
      ['NAPS: cajas NAP por distrito y ruta. Si se instala una caja nueva, agrégala como fila nueva.'],
      ['CONTRATOS: lista para el buscador de contratos. Para actualizarla: exporta los contratos de Odoo en CSV, súbelo a la carpeta de Drive SAIFO_Contratos_Odoo y ejecuta importarContratos en Extensiones > Apps Script.'],
      ['Las instalaciones con un contrato que no estaba en la lista se agregan solas a CONTRATOS.'],
      ['Las pestañas que terminan en (v1) son la estructura anterior, si tenían datos.']
    ]);
    leeme.getRange(1, 1).setFontWeight('bold').setFontSize(14);
    leeme.setColumnWidth(1, 900);
    leeme.getRange(1, 1, 8, 1).setWrap(true);
  }

  importarContratos();
}

// Lee el CSV mas reciente de la carpeta SAIFO_Contratos_Odoo (exportacion de
// Odoo con columnas code, stage_id, box_id, service_activation_date) y
// actualiza la pestana CONTRATOS. Conserva los contratos registrados en campo.
function importarContratos() {
  var ss = abrir();
  var con = ss.getSheetByName('CONTRATOS');
  var carpeta;
  try { carpeta = DriveApp.getFolderById(CONTRATOS_FOLDER_ID); } catch (e) { carpeta = getOrCreateFolder(CONTRATOS_FOLDER_NAME); }
  var archivos = carpeta.getFiles();
  var masReciente = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (!/\.csv$/i.test(f.getName()) && f.getMimeType() !== 'text/csv') continue;
    if (!masReciente || f.getLastUpdated() > masReciente.getLastUpdated()) masReciente = f;
  }
  if (!masReciente) {
    Logger.log('No hay ningún CSV en la carpeta ' + CONTRATOS_FOLDER_NAME);
    return;
  }

  var texto = masReciente.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
  var filas = Utilities.parseCsv(texto);
  var enc = filas[0].map(function (x) { return String(x).trim(); });
  var iCode = enc.indexOf('code');
  var iEstado = enc.indexOf('stage_id');
  var iBox = enc.indexOf('box_id');
  var iFecha = enc.indexOf('service_activation_date');
  if (iCode === -1) throw new Error('El CSV no tiene la columna "code".');

  var vistos = {};
  var salida = [];
  for (var r = 1; r < filas.length; r++) {
    var code = String(filas[r][iCode] || '').trim();
    if (code.indexOf(PREFIJO_CONTRATO) !== 0 || vistos[code]) continue;
    vistos[code] = true;
    var box = iBox !== -1 ? String(filas[r][iBox] || '').replace('OLTSAIFO_', '').trim() : '';
    salida.push([
      code,
      iEstado !== -1 ? filas[r][iEstado] : '',
      box,
      iFecha !== -1 ? filas[r][iFecha] : '',
      'Odoo (' + masReciente.getName() + ')'
    ]);
  }

  if (con.getLastRow() > 1) {
    var previos = con.getRange(2, 1, con.getLastRow() - 1, 5).getValues();
    previos.forEach(function (p) {
      if (p[4] === 'App de campo' && !vistos[p[0]]) salida.push(p);
    });
    con.getRange(2, 1, con.getLastRow() - 1, 5).clearContent();
  }
  salida.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  if (salida.length) con.getRange(2, 1, salida.length, 5).setValues(salida);
  Logger.log('Contratos cargados: ' + salida.length + ' desde ' + masReciente.getName());
}
