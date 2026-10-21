# Alma TV 7.1 · Samsung Orsay

Widget ES5 para Samsung **UN50J5200 (2015)**, diseñado a 1280×720. Tema claro, menú lateral, logotipos locales de apps y la ilustración elegida por el propietario como fondo y salvapantallas. Smart Hub sigue siendo el sistema principal.

Proyecto en `FIGUREMANIA/AlmaTV-Orsay`, rama `alma-tv/orsay`. La aplicación anterior de FIGUREMANIA se conserva. El instalador 7.0 que el propietario instaló y probó se conserva byte a byte en `respaldo/version-7.0/`.

## Cambios de 7.1

- Menú lateral vertical con iconos locales, tarjetas compactas y paneles claros; sin desenfoque, ampliación animada del foco ni fondos publicitarios inventados.
- PNG locales de los logotipos Netflix, YouTube, Prime Video, Disney+, Apple TV, Max y Xbox, con fuentes y licencias incluidas. Ver `docs/LOGOTIPOS.md`.
- Inicio utiliza tu ilustración; no lee búsquedas privadas ni historial de servicios. «Tus accesos guardados» contiene solo enlaces que tú agregas.
- El foco solo actualiza los dos elementos afectados. Textos de hora/estado no se reescriben si no cambian. Las pruebas observan cero mutaciones de DOM en reposo con hora fija y ninguna reconstrucción de tarjetas al mover el foco. Esto no equivale a una medición de velocidad en el televisor.
- Salvapantallas sin recuadro negro: hora, fecha completa, ciudad configurada y clima con icono se mueven juntos cada 15 s. Ciudad inicial: **Tuxtla Gutiérrez, Chiapas, México**; no es una lectura GPS. Sin proveedor accesible aparece «Sin datos».
- **Xbox → HDMI 2**: detecta `webapis.tv.window`, consulta las entradas y selecciona el descriptor real HDMI 2. No utiliza números de fuente adivinados. Si el firmware no ofrece esa API, explica cómo usar **SOURCE → HDMI 2**. Cambio físico pendiente de verificar; no enciende la consola ni abre una app de Xbox.

## Apps y compatibilidad

Netflix/YouTube conservan los POST DIAL a `/ws/app/Netflix` y `/YouTube` en puerto 8080, con una sola pulsación y errores visibles. DIAL directo es independiente del puente meteorológico.

El propietario informa que su TV no tiene apps nativas Disney+ ni Prime Video. Alma TV no añade el reproductor, DRM ni soporte que falta en Orsay. Apple TV/Max tampoco tienen una integración nativa verificada. Esas tarjetas muestran el estado y ofrecen ir a la Xbox conectada a HDMI 2; puedes usar las apps oficiales disponibles para tu modelo de consola y región, desde su propio menú. No hay inicio remoto de Disney/Prime en la consola ni reproducción web simulada.

«TV / Smart Hub» llama a la salida normal del widget; no promete sintonizar directamente TV en vivo. El navegador usa `Common.API.Widget.runWebBrowser`; su compatibilidad con sitios modernos es limitada.

## Descargar y preparar en la Mac

Primero revisa [capturas y comparación](docs/comparacion.html). No se ha sincronizado esta actualización automáticamente.

1. Descarga el ZIP de la rama/commit indicado en el chat y descomprímelo en Descargas.
2. Abre Terminal en la carpeta `AlmaTV-Orsay` de esa descarga. Python **3.8 o posterior** basta para construir y servir; no necesita Node ni paquetes Python.
3. Confirma la IP actual de la Mac. El valor usado antes fue `192.168.1.30`. Después ejecuta:

   ```sh
   python3 preparar.py 192.168.1.30
   python3 servir.py --bind 192.168.1.30
   ```

4. Si macOS pide permisos para puerto 80, repite solo el servidor con:

   ```sh
   sudo python3 servir.py --bind 192.168.1.30
   ```

   Detén antes el servidor anterior con Ctrl+C en su Terminal. No finalices procesos desconocidos. No abras puertos del router.
5. En otra Terminal puedes comprobar el catálogo con `curl --fail http://192.168.1.30/widgetlist.xml`.
6. Después de revisar el diseño y decidir instalar: Samsung Apps → cuenta `develop` → Ajustes IP → IP de la Mac → Sincr. aplicac. → **Alma TV 7.1**.
7. En Ajustes de Alma TV configura la IP real de la TV si cambió de `192.168.1.249`; comprueba DIAL y calibra el marco. IDs de widget distintos pueden tener almacenamiento separado; no se garantiza migración automática de preferencias.

El paquete generado usa `cpname` e ID **AlmaTV71**, versión **7.1.0**; `widget.info` sigue siendo texto plano. El ZIP contiene `index.html` en su raíz. El servidor expone solo catálogo y ZIPs. Al terminar la sincronización, Ctrl+C detiene el puerto 80; no hace falta mantenerlo para las herramientas o DIAL directo.

Algunos firmwares reemplazan la lista de widgets de desarrollo al sincronizar. Revisa tus widgets anteriores y conserva sus instaladores; no se promete coinstalación.

## Clima del salvapantallas y puente opcional

Para datos reales, ejecuta este archivo de la **versión nueva** en otra Terminal y deja la Mac despierta:

```sh
python3 puente.py --bind 192.168.1.30 --tv 192.168.1.249
```

En Alma TV → Ajustes, configura IP de la Mac y activa **Puente local**. No hace falta activar **Relay DIAL** para usar clima. En Clima → Actualizar puedes verificar la localidad resuelta. El salvapantallas consulta al entrar y renueva datos con antigüedad superior a 10 minutos mientras está visible; si falla informa Sin datos. No fabrica condiciones a partir de la hora.

Proveedor: Open-Meteo, datos CC BY 4.0, `geocoding-api.open-meteo.com` y `api.open-meteo.com` por HTTPS verificado. Muestra hora de observación y ciudad resuelta. El icono usa código WMO y día/noche cuando el proveedor los entrega; si no hay datos, se usa un icono genérico con el estado explícito. La búsqueda geográfica usa el nombre anterior a la primera coma; revisa el resultado.

El puente meteorológico puede estar activo y Netflix/YouTube seguir por DIAL directo. **Relay DIAL** es otro ajuste, desactivado por defecto. Úsalo solo si necesitas pasar DIAL por la Mac, por ejemplo ante un bloqueo CORS; exige iniciar el puente explícitamente con:

```sh
python3 puente.py --bind 192.168.1.30 --tv 192.168.1.249 --allow-launch
```

El relay solo permite las dos apps a la TV configurada y rechaza redirecciones. El puente acepta origen nulo de widgets y orígenes locales de preview; `--origin` permite añadir un origen exacto observado. No uses comodines. Es HTTP para tu Wi-Fi de confianza, no un servicio autenticado para internet. Ctrl+C lo detiene. El clima deja de actualizarse sin la Mac.

## Imagen y salvapantallas

La imagen original del propietario, PNG 1672×941, ya está incluida **sin modificar sus bytes**. Su SHA-256 está en `docs/IMAGEN_USUARIO.json`. Inicio y salvapantallas usan el mismo archivo; no hay descargas de imágenes en uso normal.

Para sustituirla en el futuro:

```sh
python3 importar_salvapantallas.py "/ruta/a/imagen.png"
python3 preparar.py IP_DE_LA_MAC
```

Admite JPG/PNG de hasta 1920×1080 y 4 MB, comprueba estructura y CRC PNG, preserva la imagen anterior antes de reemplazarla. No reencodifica el archivo elegido.

## Respaldo y rollback

- `respaldo/version-7.0/Widget/AlmaTV70_7.0.0.zip`: versión instalada por el propietario, SHA-256 `8de13daa70f719364c5e6a5cb966f53c73366b9b8e29424a9a9a35c47a24e9c3`, conservada sin recomprimir.
- `respaldo/ALMA_TV_CODEX_STARTER_original.zip`: adjunto original completo.
- `respaldo/servidor/Widget/AlmaTV60_6.0.0.zip`: app 6.0 original, archivos internos sin modificar; no se afirma validación física de esa base.

`preparar.py` actualiza la IP de todos los catálogos sin modificar el ZIP 7.0 de respaldo. Para ofrecer la versión instalada 7.0: detén el servidor actual y ejecuta `python3 servir.py --bind IP_MAC --rollback`. Para ofrecer la base 6.0: `--rollback-6`. Usa sudo solo si el puerto 80 lo exige. La sincronización es siempre manual y debe revisarse antes en la TV.

No se recibió una versión 3.x. Nunca restablezcas Smart Hub ni borres sus datos para probar una versión de Alma TV.

## Control remoto

En el menú lateral: arriba/abajo cambian la opción; OK abre; derecha entra al contenido. Desde la primera tarjeta de una fila, izquierda vuelve al menú. En el contenido: las cuatro flechas recorren filas y columnas; RETURN restaura la vista y el foco anterior; EXIT pide la salida normal del sistema. Verde abre Inicio; amarillo Ajustes.

Códigos reales: izquierda 4, derecha 5, arriba 29460, abajo 29461, OK 29443, RETURN 88, EXIT 45, verde 20, amarillo 21. En preview: flechas, Enter, Backspace y Escape. En calibración arriba/abajo eligen escala/X/Y, izquierda/derecha cambian valor, OK pasa a presets, verde guarda, RETURN cancela. Edición de IP/ciudad/enlaces con teclado en pantalla.

## Lentitud general de la TV

La optimización de este widget no libera RAM ni repara la lentitud de todo el sistema. Primer paso reversible: apagar normalmente, desconectar de corriente un minuto y volver a encender. Revisa después espacio y apps opcionales desde menús oficiales Samsung. Antes de desinstalar, confirma con el propietario cuáles no utiliza. No se borra nada desde Alma TV. No se usa root, ADB, menú de servicio, firmware ni restablecimiento de Smart Hub. No se cambian ajustes de sistema automáticamente.

## Desarrollo y validación

La TV no usa dependencias de ejecución: ES5, archivos locales, XHR asíncrono con timeout. En la Mac para desarrollo se requiere Node 22+ y un Chrome instalado; para instalar en la TV solo Python.

```sh
npm ci --cache /tmp/figuremania-npm-cache
npm run preview
```

En otra Terminal: `npm test`. El runner inicia su preview si falta y no contacta una TV. En Mac:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
```

Consulta [LIMITACIONES.md](LIMITACIONES.md), [VALIDACION.md](docs/VALIDACION.md), [RENDIMIENTO.md](docs/RENDIMIENTO.md) y [PRUEBA_TV.md](docs/PRUEBA_TV.md). Las nuevas funciones necesitan comprobarse físicamente en el WebKit del televisor; Chromium no certifica compatibilidad de hardware.
