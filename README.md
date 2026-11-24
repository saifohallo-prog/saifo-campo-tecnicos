# SAIFO — App de registro de campo

App web (funciona como app instalable en el celular, sin pasar por Play Store) para que los técnicos registren **instalaciones, retiros/bajas, soporte y recorridos de venta**, con **GPS automático** y **foto del equipo (ONU/router)**. Todo se guarda directo en el mismo Google Sheet de formularios de campo (pestañas INSTALACIONES, RETIROS_BAJAS, SOPORTE, RECORRIDOS_VENTA).

No necesita instalación de nada en el celular del técnico más que abrir un link (y opcionalmente "Agregar a pantalla de inicio"). Funciona con señal débil: si no hay internet en el momento, el registro queda guardado en el celular y se envía solo apenas vuelve la señal.

## Estado de este repositorio

- Backend (Apps Script) ya desplegado y conectado en `config.js`.
- Sitio publicado con GitHub Pages (Settings → Pages).

## Cómo queda armado

```
index.html     ← pantalla de la app (los 4 botones + los formularios)
styles.css     ← estilos
app.js         ← toda la lógica (GPS, foto, cola sin conexión, envío)
config.js      ← ÚNICO archivo que hay que editar: la URL del backend
manifest.json  ← hace que el navegador pueda "instalar" la app
sw.js          ← deja la app disponible sin señal
icons/         ← ícono de la app
apps-script/
  Code.gs      ← el backend: hay que pegarlo en Google Apps Script (paso 1 abajo)
```

## Paso 1 — Conectar el backend (Google Apps Script)

El backend es lo que escribe cada registro en el Google Sheet. Se despliega **gratis**, directo desde el propio Sheet, en 5 minutos:

1. Abre el Google Sheet **"SAIFO — Formularios de campo"** (el que ya está en tu Drive).
2. Menú **Extensiones → Apps Script**.
3. Borra el contenido de `Code.gs` que aparece por defecto y pega todo el contenido del archivo [`apps-script/Code.gs`](apps-script/Code.gs) de esta carpeta.
4. Guarda (ícono de disco o Ctrl+S).
5. Arriba a la derecha, botón **Implementar → Nueva implementación**.
6. En "Seleccionar tipo", el ícono de engranaje → **Aplicación web**.
7. Configuración:
   - **Ejecutar como:** Yo (tu cuenta)
   - **Quién tiene acceso:** Cualquier usuario
8. **Implementar**. La primera vez te va a pedir autorizar permisos (es tu propio script accediendo a tu propio Sheet y Drive) — acepta.
9. Copia la **URL de la aplicación web** que te entrega (termina en `/exec`).

Esa pestaña del Sheet llamada `CATALOGOS` es la que alimenta los menús desplegables de la app — si agregas un técnico nuevo o un modelo de equipo ahí, la app lo ve solo, sin que haya que tocar código.

> Cada vez que edites `Code.gs` después de hoy (por ejemplo, para agregar una hoja nueva), tienes que volver a **Implementar → Gestionar implementaciones → ✏️ → Nueva versión → Implementar**, para que el cambio se publique.

## Paso 2 — Conectar la app al backend

Abre `config.js` y reemplaza esta línea con la URL que copiaste en el paso 1:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/TU_ID/exec";
```

## Paso 3 — Subir a GitHub y publicar con GitHub Pages (gratis)

1. Crea un repositorio nuevo en GitHub (puede ser privado o público), por ejemplo `saifo-campo-tecnicos`.
2. Sube todos los archivos de esta carpeta (`index.html`, `app.js`, etc.) a la raíz del repositorio — arrastrándolos en la web de GitHub, o por línea de comandos:
   ```bash
   cd app-tecnicos
   git init
   git add .
   git commit -m "App de registro de campo"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/saifo-campo-tecnicos.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. En un par de minutos GitHub te da el link público, algo como:
   `https://TU-USUARIO.github.io/saifo-campo-tecnicos/`

Ese es el link que compartes con los técnicos (por WhatsApp, por ejemplo). Como usa HTTPS, el GPS y la cámara del celular funcionan sin problema.

## Paso 4 — Instalar en el celular del técnico (opcional pero recomendado)

1. Abrir el link en Chrome (Android).
2. Menú (⋮) → **Agregar a pantalla de inicio** / **Instalar app**.
3. Queda un ícono como cualquier otra app — no necesita Play Store.

## Cómo la usa el técnico

1. Abre la app → ve 4 botones grandes: **Instalación · Retiro/Baja · Soporte · Recorrido de venta**.
2. Toca el que corresponde a su situación.
3. Llena los campos (los que tienen lista desplegable ya traen las opciones cerradas del Sheet).
4. Toca **"Usar mi ubicación actual"** — toma el GPS del celular automáticamente, no hay que copiar nada de Google Maps.
5. Si aplica, toca **"Tomar foto"** del equipo (ONU/router) — abre la cámara directo.
6. Toca **"Guardar registro"**. Si hay señal, se envía al instante; si no, queda guardado y se envía solo apenas vuelva la señal (se ve un aviso arriba con cuántos registros están pendientes).

## Dónde queda cada cosa en el Sheet

- Cada registro se agrega como una fila nueva en la pestaña que corresponde (`INSTALACIONES`, `RETIROS_BAJAS`, `SOPORTE` o `RECORRIDOS_VENTA`), respetando el mismo encabezado que ya tenía el archivo.
- La foto no se pega dentro de la celda: se sube a una carpeta de Drive llamada **"SAIFO_Fotos_Campo"** (se crea sola la primera vez) y en la columna de foto queda el link para abrirla.
- La columna "Ubicación GPS (lat,long)" queda lista para usarse igual que antes en Google My Maps (Importar → esta hoja → columna de ubicación).

## Límites a tener en cuenta

- Apps Script tiene cuotas gratuitas generosas para una pyme (decenas de miles de llamadas al día) — no debería ser un problema con el volumen de SAIFO.
- Las fotos se comprimen en el celular antes de enviarse (lado ancho máx. 1280 px) para que pesen poco y se suban rápido incluso con señal débil.
- Si dos técnicos envían exactamente al mismo segundo, el backend usa un bloqueo corto para que no se pisen las filas.
