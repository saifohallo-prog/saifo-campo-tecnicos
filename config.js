// ============================================================================
// CONFIGURACIÓN — lo único que hay que tocar para conectar la app al backend.
// ============================================================================
//
// 1. Despliega apps-script/Code.gs como Web App (ver README.md).
// 2. Pega aquí la URL que te da el despliegue (termina en /exec).
//
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJvsRzqdVCgDW4TIDcjywU9q3Sd5IswzgBxqeNgqRdqnbYe4ouqLUqwlC1HQLWW9Cu9g/exec";

// Catálogos de respaldo (se usan si todavía no se pudo descargar la versión
// en vivo del Sheet, por ejemplo la primera vez que se abre sin señal).
// Deben coincidir con la pestaña CATALOGOS del Google Sheet.
const CATALOGOS_RESPALDO = {
TECNICOS: ["Técnico 1 (completar nombre real)", "Técnico 2 (completar nombre real)", "Vendedor de ruta (beneficiario A)", "Otro / externo"],
ZONAS: ["D01", "D02", "D03", "D04", "D05"],
PLANES: ["HALLO Brisa (300/400 Mbps)", "HALLO Marea (500 Mbps)", "HALLO Ola (650 Mbps)", "HALLO Corriente (800 Mbps)"],
SI_NO: ["Sí", "No", "No aplica"],
TIPO_RETIRO: ["Corte temporal por falta de pago", "Retiro definitivo", "Suspensión a pedido del cliente", "Reconexión (retiro de corte)"],
MOTIVO_BAJA: ["Falta de pago", "Mudanza o cambio de domicilio", "Cambio a otro proveedor", "Insatisfacción con el servicio (velocidad/intermitencia)", "Insatisfacción con el precio", "Contrato duplicado o erróneo", "Fin de promoción, no renovó", "Otro (detallar en observaciones)"],
ESTADO_EQUIPO: ["Funcional", "Dañado", "No recuperado", "No aplica"],
TIPO_FALLA: ["Sin señal (caída total)", "Señal intermitente", "Velocidad baja", "Falla de equipo (ONU/router)", "Falla eléctrica / sin energía", "Cable o caja NAP dañada (corte físico)", "Configuración / Wi-Fi", "Falsa alarma", "Otro (detallar en observaciones)"],
RESULTADO_RECORRIDO: ["Alta nueva (vendió)", "Interesado, lo pensó", "No había puerto libre en la caja", "No había nadie en casa", "No le interesó", "Ya tiene otro proveedor", "Zona sin cobertura confirmada"],
MATERIAL_ENTREGADO: ["Volante impreso", "Explicación verbal de los planes", "Volante + explicación", "Ninguno"],
EQUIPO_MODELO: ["ONU 1FE (hasta 100 Mbps — revisar si el plan vendido supera esto)", "ONU 4GE (500 Mbps o más)", "Router WiFi 5", "Router WiFi 6", "Otro (completar modelo real de inventario)"]
};

// ============================================================================
// DEFINICIÓN DE LOS 4 FORMULARIOS
// Cada campo: { key, label, type, cat?, required? }
// type: "text" | "number" | "textarea" | "select" | "contrato"
// ============================================================================
const FORMULARIOS = {
INSTALACIONES: {
titulo: "Instalación",
color: "verde",
icono: "🔌",
hoja: "INSTALACIONES",
campos: [
{ key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
{ key: "N° de contrato / cliente", label: "N° de contrato / cliente", type: "text", required: true },
{ key: "Nombre del cliente", label: "Nombre del cliente", type: "text", required: true },
{ key: "Zona", label: "Zona", type: "select", cat: "ZONAS", required: true },
{ key: "Caja NAP (ID)", label: "Caja NAP (ID)", type: "text", required: true },
{ key: "Puerto usado", label: "Puerto usado", type: "text" },
{ key: "Plan contratado", label: "Plan contratado", type: "select", cat: "PLANES", required: true },
{ key: "Equipo instalado (modelo)", label: "Equipo instalado (modelo)", type: "select", cat: "EQUIPO_MODELO", required: true },
{ key: "Potencia óptica medida (dBm)", label: "Potencia óptica medida (dBm)", type: "number" },
{ key: "Velocidad de prueba — bajada (Mbps)", label: "Velocidad bajada (Mbps)", type: "number" },
{ key: "Velocidad de prueba — subida (Mbps)", label: "Velocidad subida (Mbps)", type: "number" },
{ key: "Dirección / referencia", label: "Dirección / referencia", type: "text" },
{ key: "Observaciones", label: "Observaciones", type: "textarea" }
],
foto: { key: "Foto tomada", label: "Foto del equipo instalado (ONU / router)" }
},

RETIROS_BAJAS: {
titulo: "Retiro / Baja",
color: "rojo",
icono: "🧰",
hoja: "RETIROS_BAJAS",
campos: [
{ key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
{ key: "N° de contrato / cliente", label: "N° de contrato / cliente", type: "text", required: true },
{ key: "Tipo", label: "Tipo", type: "select", cat: "TIPO_RETIRO", required: true },
{ key: "Motivo de baja", label: "Motivo de baja", type: "select", cat: "MOTIVO_BAJA", required: true },
{ key: "Equipo retirado", label: "¿Se retiró el equipo?", type: "select", cat: "SI_NO" },
{ key: "Estado del equipo retirado", label: "Estado del equipo retirado", type: "select", cat: "ESTADO_EQUIPO" },
{ key: "Zona", label: "Zona", type: "select", cat: "ZONAS", required: true },
{ key: "Caja NAP (ID)", label: "Caja NAP (ID)", type: "text" },
{ key: "Puerto liberado", label: "¿Puerto liberado?", type: "select", cat: "SI_NO" },
{ key: "Dirección / referencia", label: "Dirección / referencia", type: "text" },
{ key: "Observaciones", label: "Observaciones", type: "textarea" }
],
foto: { key: "Foto tomada", label: "Foto del equipo retirado" }
},

SOPORTE: {
titulo: "Soporte / Avería",
color: "amarillo",
icono: "🛠️",
hoja: "SOPORTE",
campos: [
{ key: "Técnico", label: "Técnico", type: "select", cat: "TECNICOS", required: true },
{ key: "N° de contrato / cliente", label: "N° de contrato / cliente", type: "text", required: true },
{ key: "Hora de reporte", label: "Hora de reporte", type: "text", placeholder: "HH:MM" },
{ key: "Tipo de falla reportada", label: "Tipo de falla reportada", type: "select", cat: "TIPO_FALLA", required: true },
{ key: "Causa encontrada", label: "Causa encontrada", type: "select", cat: "TIPO_FALLA", required: true },
{ key: "Potencia óptica antes (dBm)", label: "Potencia óptica antes (dBm)", type: "number" },
{ key: "Potencia óptica después (dBm)", label: "Potencia óptica después (dBm)", type: "number" },
{ key: "Equipo cambiado", label: "¿Se cambió equipo?", type: "select", cat: "SI_NO" },
{ key: "Modelo del equipo nuevo", label: "Modelo del equipo nuevo", type: "select", cat: "EQUIPO_MODELO" },
{ key: "Resuelto en sitio", label: "¿Resuelto en sitio?", type: "select", cat: "SI_NO", required: true },
{ key: "Zona", label: "Zona", type: "select", cat: "ZONAS", required: true },
{ key: "Caja NAP (ID)", label: "Caja NAP (ID)", type: "text" },
{ key: "Dirección / referencia", label: "Dirección / referencia", type: "text" },
{ key: "Observaciones", label: "Observaciones", type: "textarea" }
],
foto: { key: "Foto tomada", label: "Foto del equipo (ONU / router) cambiado o revisado" }
},

RECORRIDOS_VENTA: {
titulo: "Recorrido de venta",
color: "azul",
icono: "🚶",
hoja: "RECORRIDOS_VENTA",
campos: [
{ key: "Vendedor / técnico", label: "Vendedor / técnico", type: "select", cat: "TECNICOS", required: true },
{ key: "Zona", label: "Zona", type: "select", cat: "ZONAS", required: true },
{ key: "Caja NAP visitada", label: "Caja NAP visitada", type: "text", required: true },
{ key: "Dirección / sector", label: "Dirección / sector", type: "text" },
{ key: "Resultado", label: "Resultado", type: "select", cat: "RESULTADO_RECORRIDO", required: true },
{ key: "N° de contrato generado (si vendió)", label: "N° de contrato generado (si vendió)", type: "text" },
{ key: "Material entregado", label: "Material entregado", type: "select", cat: "MATERIAL_ENTREGADO" },
{ key: "Observaciones", label: "Observaciones", type: "textarea" }
],
foto: { key: "Foto o video tomado", label: "Foto de la caja NAP o de la vivienda" }
}
};
