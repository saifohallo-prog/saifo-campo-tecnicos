// ============================================================================
// CONFIGURACIÓN — URL del backend y definición de los 4 formularios.
// ============================================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJvsRzqdVCgDW4TIDcjywU9q3Sd5IswzgBxqeNgqRdqnbYe4ouqLUqwlC1HQLWW9Cu9g/exec";

// Formato de los contratos en Odoo: CT004F-00500
const PREFIJO_CONTRATO = "CT004F-";
const DIGITOS_CONTRATO = 5;

// Respaldo por si la app abre sin señal la primera vez (después usa lo que
// descarga del Google Sheet: pestañas CATALOGOS, NAPS y CONTRATOS).
const CATALOGOS_RESPALDO = {
  TECNICOS: ["Roling Lindao - Técnico", "Paul Cabrera - Vendedor"],
  PLANES: ["HALLO Brisa (300/400 Mbps)", "HALLO Marea (500 Mbps)", "HALLO Ola (650 Mbps)", "HALLO Corriente (800 Mbps)"],
  SI_NO: ["Sí", "No"],
  TIPO_RETIRO: ["Corte temporal por falta de pago", "Retiro definitivo", "Suspensión a pedido del cliente", "Reconexión (retiro de corte)"],
  MOTIVO_BAJA: ["Falta de pago", "Mudanza o cambio de domicilio", "Cambio a otro proveedor", "Insatisfacción con el servicio (velocidad/intermitencia)", "Insatisfacción con el precio", "Contrato duplicado o erróneo", "Fin de promoción, no renovó", "Otro (detallar en observaciones)"],
  EQUIPOS_RETIRADOS: ["ONT y router", "Solo ONT", "Solo router", "Ninguno (no se recuperó)"],
  ESTADO_EQUIPO: ["Funcional", "Dañado", "No recuperado", "No aplica"],
  TIPO_FALLA: ["Sin señal (caída total)", "Señal intermitente", "Velocidad baja", "Falla de equipo (ONT/router)", "Falla eléctrica / sin energía", "Cable o caja NAP dañada (corte físico)", "Configuración / Wi-Fi", "Falsa alarma", "Otro (detallar en observaciones)"],
  EQUIPO_CAMBIADO: ["No se cambió", "ONT", "Router", "ONT y router"],
  RESULTADO_RECORRIDO: ["Venta cerrada (contrato generado)", "Interesado - dar seguimiento", "Referido - dar seguimiento", "No había puerto libre en la caja", "No había nadie en casa", "No le interesó", "Ya tiene otro proveedor", "Zona sin cobertura confirmada"],
  MATERIAL_ENTREGADO: ["Volante impreso", "Explicación verbal de los planes", "Volante + explicación", "Ninguno"]
};

// Cajas NAP por ruta (distrito+ruta : cantidad de cajas), según el ERP.
const NAPS_POR_RUTA = "D01R01:8,D01R02:11,D01R03:3,D01R04:1,D02R01:4,D02R02:3,D02R03:5,D03R01:5,D03R02:18,D03R03:8,D04R01:3,D04R02:2,D04R03:11,D04R04:1,D05R01:8,D05R02:3,D05R03:1";
const PUERTOS_POR_NAP = 16;

// ============================================================================
// FORMULARIOS
// Tipos de campo:
//   select (cat), text, number, tel, date, time, textarea,
//   contrato  -> buscador de contrato (normaliza 500 / Ct500 / CT004-000500)
//   nap       -> Distrito → Ruta → NAP en cascada (llena 4 columnas)
//   puerto    -> lista 1..16
// "si": el campo solo aparece (y solo es obligatorio) si otro campo tiene
//       alguno de esos valores. "siContiene": si el valor contiene ese texto.
// ============================================================================
const FORMULARIOS = {
  INSTALACIONES: {
    titulo: "Instalación",
    color: "verde",
    icono: "🔌",
    hoja: "INSTALACIONES",
    campos: [
      { key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
      { key: "N° de contrato", label: "N° de contrato", type: "contrato", required: true, permitirNuevo: true },
      { key: "Nombre del cliente", label: "Nombre del cliente", type: "text", required: true },
      { key: "NAP", label: "Caja NAP", type: "nap", required: true },
      { key: "Puerto usado", label: "Puerto usado", type: "puerto", required: true },
      { key: "Plan contratado", label: "Plan contratado", type: "select", cat: "PLANES", required: true },
      { key: "Potencia óptica medida (dBm)", label: "Potencia óptica medida (dBm)", type: "number", placeholder: "Ej. -19.5" },
      { key: "Dirección / referencia", label: "Dirección / referencia", type: "text", required: true },
      { key: "Observaciones", label: "Observaciones", type: "textarea" }
    ],
    fotos: [
      { key: "Foto router (serie)", label: "Router — que se vea la serie y las características (etiqueta)", required: true },
      { key: "Foto ONT (serie)", label: "ONT — que se vea la serie y las características (etiqueta)", required: true },
      { key: "Foto equipos instalados", label: "Equipos instalados — cómo quedaron colocados", required: true }
    ]
  },

  RETIROS_BAJAS: {
    titulo: "Retiro / Baja",
    color: "rojo",
    icono: "🧰",
    hoja: "RETIROS_BAJAS",
    campos: [
      { key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
      { key: "N° de contrato", label: "N° de contrato", type: "contrato", required: true },
      { key: "Tipo", label: "Tipo", type: "select", cat: "TIPO_RETIRO", required: true },
      { key: "Motivo de baja", label: "Motivo de baja", type: "select", cat: "MOTIVO_BAJA", required: true },
      { key: "NAP", label: "Caja NAP", type: "nap", required: true },
      { key: "Puerto liberado", label: "¿Se liberó el puerto?", type: "select", cat: "SI_NO", required: true },
      { key: "N° de puerto liberado", label: "N° de puerto liberado", type: "puerto", required: true, si: { key: "Puerto liberado", en: ["Sí"] } },
      { key: "Equipos retirados", label: "Equipos retirados", type: "select", cat: "EQUIPOS_RETIRADOS", required: true },
      { key: "Estado del equipo retirado", label: "Estado del equipo retirado", type: "select", cat: "ESTADO_EQUIPO", required: true, si: { key: "Equipos retirados", en: ["ONT y router", "Solo ONT", "Solo router"] } },
      { key: "Dirección / referencia", label: "Dirección / referencia", type: "text" },
      { key: "Observaciones", label: "Observaciones", type: "textarea" }
    ],
    fotos: [
      { key: "Foto ONT retirada", label: "ONT retirada — que se vea la serie", required: true, si: { key: "Equipos retirados", en: ["ONT y router", "Solo ONT"] } },
      { key: "Foto router retirado", label: "Router retirado — que se vea la serie", required: true, si: { key: "Equipos retirados", en: ["ONT y router", "Solo router"] } },
      { key: "Foto equipo nuevo colocado", label: "Equipo nuevo colocado (solo si se reemplazó un equipo) — que se vea la serie" }
    ]
  },

  SOPORTE: {
    titulo: "Soporte / Avería",
    color: "amarillo",
    icono: "🛠️",
    hoja: "SOPORTE",
    campos: [
      { key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
      { key: "N° de contrato", label: "N° de contrato", type: "contrato", required: true },
      { key: "Hora de reporte", label: "Hora en que el cliente reportó la falla", type: "time" },
      { key: "Tipo de falla reportada", label: "Tipo de falla reportada", type: "select", cat: "TIPO_FALLA", required: true },
      { key: "Causa encontrada", label: "Causa encontrada", type: "select", cat: "TIPO_FALLA", required: true },
      { key: "Potencia óptica antes (dBm)", label: "Potencia óptica antes (dBm)", type: "number", placeholder: "Ej. -25.1" },
      { key: "Potencia óptica después (dBm)", label: "Potencia óptica después (dBm)", type: "number", placeholder: "Ej. -19.8" },
      { key: "Equipo cambiado", label: "¿Se cambió algún equipo?", type: "select", cat: "EQUIPO_CAMBIADO", required: true },
      { key: "Resuelto en sitio", label: "¿Resuelto en sitio?", type: "select", cat: "SI_NO", required: true },
      { key: "NAP", label: "Caja NAP", type: "nap", required: true },
      { key: "Dirección / referencia", label: "Dirección / referencia", type: "text" },
      { key: "Observaciones", label: "Observaciones", type: "textarea" }
    ],
    fotos: [
      { key: "Foto equipo retirado", label: "Equipo que se retira — que se vea la serie", required: true, si: { key: "Equipo cambiado", en: ["ONT", "Router", "ONT y router"] } },
      { key: "Foto equipo nuevo colocado", label: "Equipo nuevo que se coloca — que se vea la serie", required: true, si: { key: "Equipo cambiado", en: ["ONT", "Router", "ONT y router"] } },
      { key: "Foto instalación final", label: "Cómo quedó la instalación (opcional)" }
    ]
  },

  RECORRIDOS_VENTA: {
    titulo: "Recorrido de venta",
    color: "azul",
    icono: "🚶",
    hoja: "RECORRIDOS_VENTA",
    campos: [
      { key: "Vendedor / técnico", label: "Vendedor / técnico", type: "select", cat: "TECNICOS", required: true },
      { key: "NAP", label: "Caja NAP de la zona", type: "nap", required: true },
      { key: "Dirección / sector", label: "Dirección / sector", type: "text", required: true },
      { key: "Resultado", label: "Resultado de la visita", type: "select", cat: "RESULTADO_RECORRIDO", required: true },
      { key: "Nombre del prospecto / referido", label: "Nombre del interesado o referido", type: "text", required: true, siContiene: { key: "Resultado", texto: ["seguimiento", "Venta"] } },
      { key: "Celular", label: "Celular", type: "tel", placeholder: "09XXXXXXXX", required: true, siContiene: { key: "Resultado", texto: ["seguimiento", "Venta"] } },
      { key: "Plan de interés", label: "Plan de interés", type: "select", cat: "PLANES", siContiene: { key: "Resultado", texto: ["seguimiento", "Venta"] } },
      { key: "Próximo contacto", label: "Fecha del próximo contacto", type: "date", required: true, siContiene: { key: "Resultado", texto: ["seguimiento"] } },
      { key: "N° de contrato (si vendió)", label: "N° de contrato generado", type: "contrato", permitirNuevo: true, siContiene: { key: "Resultado", texto: ["Venta"] } },
      { key: "Material entregado", label: "Material entregado", type: "select", cat: "MATERIAL_ENTREGADO" },
      { key: "Observaciones", label: "Observaciones", type: "textarea" }
    ],
    fotos: [
      { key: "Foto", label: "Foto de la caja NAP o de la vivienda (opcional)" }
    ]
  }
};
