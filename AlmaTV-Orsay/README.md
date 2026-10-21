# Alma TV 7.2 · Samsung Orsay

Aplicación local ES5 para **Samsung UN50J5200 (2015)**. Menú lateral claro, ilustración del propietario, logotipos locales, carrusel de aplicaciones, herramientas y reproductor de archivos propios. Smart Hub sigue siendo el sistema principal.

Proyecto: `FIGUREMANIA/AlmaTV-Orsay`, rama `alma-tv/orsay`. FIGUREMANIA se conserva. Los instaladores 7.0 y 7.1 anteriores están en `respaldo/`, sin recomprimir.

## Novedades de 7.2

- Textos revisados en español y teclado con **ñ, á, é, í, ó, ú, ü**. El instalador convierte HTML, CSS y JavaScript a representaciones seguras para el motor antiguo, manteniendo las tildes al mostrar texto. Los fuentes siguen siendo legibles en UTF-8. La vista previa de pruebas usa los bytes extraídos del ZIP real.
- Transiciones breves de página, foco, pulsación y apertura de cuadros. Acento gráfico al cambiar de página y barras animadas solo mientras se reproduce audio. No bloquean las teclas. **Ajustes → Animaciones** permite reducirlas.
- Fondo que cubre toda la pantalla; la calibración de escala/X/Y protege solo los controles. Se comprueba también el ajuste a 960×540 y 1920×1080.
- **Ajustes → Marco del salvapantallas**: blanco o sin marco. Esta preferencia no añade bordes al tema. El salvapantallas conserva el bloque móvil de hora, fecha, ciudad y clima, sin caja negra detrás de los datos.
- Carrusel con aproximadamente seis tarjetas visibles, más grandes, desplazable con izquierda/derecha. Los logotipos conservan el fondo de marca también en la cuadrícula.
- Encabezado según la aplicación seleccionada: WWE Raw en Netflix, «¡Bienvenido, IWC!» en YouTube, «La Última Palabra» y el texto de Fox solicitado para Prime Video, y mensajes para Disney+, Max, Apple TV y Xbox. Son textos personalizados del propietario; no se consulta un catálogo ni se confirma disponibilidad, suscripción o derecho de emisión.
- **Multimedia**: reproducción real de audio/video propios, lista guardada, pausa, anterior/siguiente, salto de 10 s y volumen. La muestra incluida es una composición original breve, marcada como prueba de sonido; no simula Spotify ni un catálogo musical.

## Compatibilidad de servicios

Netflix y YouTube se abren mediante sus aplicaciones nativas por DIAL, con una sola pulsación. No se añade un iframe de YouTube que se anuncie compatible sin probarlo. El propietario ya instaló versiones anteriores; las nuevas funciones se validan en Chromium y necesitan comprobación física.

Disney+ y Prime Video no tienen app nativa disponible en este Orsay según el propietario. Apple TV y Max no tienen integración nativa verificada. Sus tarjetas indican el estado y ofrecen usar la Xbox conectada a HDMI 2; consulta las apps oficiales disponibles para tu modelo de consola y región. Alma TV no añade DRM, cuentas o reproductores de esas plataformas.

**Xbox → HDMI 2** consulta la API de fuentes que exponga el firmware y selecciona el descriptor real HDMI 2. Si no existe, muestra SOURCE → HDMI 2. No adivina números de entrada, enciende la consola ni abre sus apps. «Smart Hub» sale normalmente del widget; no sustituye Home.

Spotify requiere su propio servicio, autenticación y un reproductor compatible. Este proyecto no se conecta a su catálogo ni implementa Spotify Connect. Multimedia reproduce tus archivos o enlaces directos, sin DRM. No convierte enlaces de YouTube/Spotify en descargas ni elude protección.

## Instalación Wi-Fi en la Mac

1. Descarga el ZIP del commit indicado en el chat y descomprímelo en Descargas. Revisa [las capturas](docs/comparacion.html).
2. Detén con Ctrl+C el servidor de instalación anterior. En Terminal, entra en `AlmaTV-Orsay` dentro de la nueva descarga.
3. Confirma la IP actual de la Mac. El valor usado antes fue `192.168.1.30`. Ejecuta:

   ```sh
   python3 preparar.py 192.168.1.30
   python3 servir.py --bind 192.168.1.30
   ```

4. Si el puerto 80 requiere permisos, repite solo el servidor con:

   ```sh
   sudo python3 servir.py --bind 192.168.1.30
   ```

5. Cuando decidas sincronizar: Samsung Apps → cuenta `develop` → Ajustes IP → IP de la Mac → Sincr. aplicac. → **Alma TV 7.2**.
6. Configura la IP real de la TV si cambió de `192.168.1.249`. Revisa calibración, animaciones y marco del salvapantallas. IDs distintos pueden tener almacenamiento separado; no se promete migración automática.

El paquete usa ID/cpname **AlmaTV72**, versión **7.2.0**. `widget.info` permanece en texto plano; `index.html` está en la raíz del ZIP. El servidor expone catálogo y ZIPs, sin publicar el código fuente. No abras puertos del router.

Se necesita Python **3.8 o posterior**, sin paquetes adicionales, para construir, instalar y compartir archivos. No hace falta Node ni FFmpeg en tu Mac para esas tareas. El puerto 80 puede cerrarse después de instalar; no es necesario para herramientas, audio de muestra o DIAL directo.

Algunos firmwares reemplazan los widgets de desarrollo al sincronizar. Conserva los instaladores y revisa el catálogo; no se garantiza coinstalación. No se ha sincronizado 7.2 desde esta nube.

## Clima y música de tu Mac

Crea una carpeta dedicada para los archivos que quieras compartir:

```sh
mkdir -p "$HOME/Music/AlmaTV"
```

Copia allí tus MP3 o MP4 propios desde Finder. En otra Terminal, desde la carpeta nueva del proyecto:

```sh
python3 puente.py --bind 192.168.1.30 --tv 192.168.1.249 --media-dir "$HOME/Music/AlmaTV"
```

- **Para clima**: en Ajustes confirma la IP de la Mac y activa **Puente local**. El salvapantallas consulta al entrar y renueva los datos mientras está visible; sin proveedor accesible muestra Sin datos. La ciudad inicial indicada por el propietario es Tuxtla Gutiérrez, Chiapas, México; no se presenta como una lectura GPS.
- **Para archivos**: abre **Multimedia → Archivos de la Mac**. Se añaden a la lista hasta 30 pistas o videos. Solo se comparten archivos de la carpeta elegida, sin subcarpetas ni enlaces simbólicos. El servidor admite solicitudes HTTP Range para poder adelantar o retroceder sin cargar todo el archivo en memoria.
- **Para enlaces**: Multimedia → Añadir enlace. Usa una URL directa a un archivo sin DRM. Las páginas de YouTube y Spotify no son archivos de audio/video y se rechazan con un mensaje claro.
- La Mac debe seguir despierta para servir sus archivos y actualizar el clima. Los archivos no se copian a la memoria del televisor. Solo se guardan nombre y dirección en Alma TV. Quitar una entrada de la lista no borra el archivo de la Mac.

MP3 y MP4 se decodifican y reproducen en las pruebas de navegador. La compatibilidad real de códec/resolución depende del firmware; prueba primero un MP3 o MP4 H.264/AAC sencillo en el televisor. M4A, WAV y WebM se comparten si los eliges, pero su reproducción depende del dispositivo y puede no estar disponible. No hay transcodificación automática ni reproducción de archivos protegidos.

La música puede continuar al cambiar de vista dentro de Alma TV; abrir una app nativa pausa el reproductor. Un video se pausa al abandonar su vista. No se promete reproducción en segundo plano cuando el sistema suspende o cierra el widget.

El clima procede de Open-Meteo (CC BY 4.0), por HTTPS verificado en la Mac. Se indica la observación y localidad resuelta. El icono usa el código meteorológico y día/noche del proveedor. No se inventa una temperatura cuando falta conexión.

El puente meteorológico no cambia DIAL directo. **Conexión de aplicaciones** es el ajuste independiente para reenviar DIAL por la Mac, desactivado por defecto. Solo si lo necesitas, inicia el puente con `--allow-launch` y activa ese ajuste. El relay se limita a YouTube/Netflix y a la TV configurada, sin redirecciones.

El puente es HTTP dentro de tu Wi-Fi de confianza, no un servicio autenticado para internet. `--origin` permite añadir un origen exacto observado del widget; no uses comodines. Ctrl+C lo detiene. No expongas la carpeta multimedia mediante un túnel o port forwarding.

## Imagen y respaldo

El PNG original del propietario, 1672×941, sigue intacto; SHA-256 en `docs/IMAGEN_USUARIO.json`. No se descargan fondos publicitarios. Para sustituirlo:

```sh
python3 importar_salvapantallas.py "/ruta/a/imagen.png"
python3 preparar.py IP_DE_LA_MAC
```

El importador admite JPG/PNG hasta 1920×1080 y 4 MB, verifica integridad PNG y conserva la imagen anterior. No reencodifica tu ilustración.

Respaldos: `respaldo/version-7.1/`, `respaldo/version-7.0/` y base original 6.0 en `respaldo/servidor/`. `preparar.py` actualiza sus catálogos con la IP elegida y verifica los ZIP previos sin recomprimirlos.

Para ofrecer 7.1: `python3 servir.py --bind IP_MAC --rollback`. Para 7.0: `--rollback-7`. Para la base 6.0: `--rollback-6`. Usa sudo solo si el puerto 80 lo necesita. La sincronización siempre es manual; no se restablecen datos de Smart Hub.

## Control y desarrollo

Menú lateral: arriba/abajo seleccionan, Aceptar abre, derecha entra al contenido. Las cuatro flechas recorren tarjetas/listas; el carrusel se desplaza para mantener visible la selección. Volver restaura la vista anterior; Salir usa la API del sistema. Verde abre Inicio y amarillo Ajustes. Las animaciones no aplazan ninguna acción.

En preview: flechas, Enter, Backspace y Escape. En calibración: arriba/abajo eligen escala/X/Y, izquierda/derecha cambian valor, Aceptar pasa a presets, verde guarda y Volver cancela. El teclado en pantalla y la entrada física admiten español.

Para desarrollo: Node 22+, Python y Chrome/Chromium instalado.

```sh
npm ci --cache /tmp/figuremania-npm-cache
npm run preview
npm test
```

En Mac selecciona el navegador instalado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
```

El runner utiliza `.preview/app`, extraído del ZIP real, y un servidor local con solicitudes Range. Las pruebas nunca contactan la TV. Fuentes legibles en UTF-8; distribución HTML/CSS/JS segura para el motor antiguo; sin dependencias de ejecución ni CDN en el widget.

Consulta [LIMITACIONES.md](LIMITACIONES.md), [VALIDACION.md](docs/VALIDACION.md), [RENDIMIENTO.md](docs/RENDIMIENTO.md), [LOGOTIPOS.md](docs/LOGOTIPOS.md) y [PRUEBA_TV.md](docs/PRUEBA_TV.md). La lentitud general del televisor no se repara borrando componentes desde este widget: reinicia completamente primero y revisa solo apps opcionales desde menús oficiales con el propietario.

### Reproductor 7.2.1 y puente sin Terminal

El reproductor ampliado ofrece **Pantalla completa**. Aceptar pausa/reanuda,
izquierda/derecha buscan diez segundos y Volver reduce el vídeo sin detenerlo.
La imagen respeta su proporción (puede mostrar bandas). Al navegar a Inicio o
Apps continúa el audio; abrir una app nativa o cambiar HDMI pausa la reproducción.

En la Mac, detén primero el puente manual con Ctrl+C. Ejecuta sin sudo:

```sh
python3 configurar_puente_mac.py --bind 192.168.1.30 --tv 192.168.1.249
```

Instala un LaunchAgent del usuario, copia el puente a Application Support y
arranca al iniciar sesión, sin Terminal abierta. No evita el reposo de la Mac.
Necesita Python instalado; no eliminar esa instalación. Registros en
`~/Library/Logs/AlmaTV`. Si cambia la IP, ejecuta de nuevo con la nueva dirección.
Para desactivarlo: `python3 configurar_puente_mac.py --remove`.
El funcionamiento de launchd y pantalla completa en Orsay requiere prueba física.

### Alma TV 8.0.0

Identificador independiente `AlmaTV80`, nombre en Samsung Apps **Alma TV 8** y
marca visible **alma tv 8**. Distinguir esta instalación de Alma TV 7.2, que se
conserva. Incluye reproductor ampliado, botón Pantalla completa y reproducción
entre vistas de Alma TV; no continúa al salir de la aplicación o lanzar otra app.
El vídeo activo se oculta con visibility al navegar, sin display:none para evitar
la suspensión en motores antiguos. Comprobar reproducción y códecs en la TV real.

Inicio sustituye los accesos guardados por En reproducción, sin botones. Al
reproducir muestra un vídeo amplio o el título de la música. El Inicio permite
desplazarse y conserva el encabezado promocional. Los controles siguen en Multimedia.
Los enlaces guardados siguen disponibles desde Buscar y la vista de enlaces.

### 8.1: Inicio desplazable

El Inicio conserva el encabezado al reproducir. Arriba/abajo recorren el
encabezado, apps, zona de reproducción sin botones y herramientas. La imagen
se recorta al área visible al desplazarse, sin superponer la cabecera o el pie.

Los iconos de navegación y tarjetas de herramientas/ajustes usan PNG locales,
sin depender de glifos de la fuente del televisor. Multimedia tiene icono de
reproducción propio. Los logotipos originales de las apps se conservan.

### 8.2: YouTube integrado (experimental)

Multimedia permite guardar enlaces de vídeos individuales de YouTube y abrir
el reproductor oficial dentro de Alma TV mediante el puente Mac actualizado.
Controles, pantalla completa, errores claros y acceso nativo conservado.
La compatibilidad real con Orsay queda pendiente de prueba física; no se afirma
que cualquier vídeo funcione. YouTube se detiene al salir de su vista.
Ver [investigación, límites y prueba física](docs/YOUTUBE.md).

### 8.3: enlaces desde la Mac, sin reinstalar por cada vídeo

Abrir `http://192.168.1.30:8088/enlaces` en el navegador de la Mac para pegar,
nombrar y quitar vídeos. En la TV: Multimedia → Enlaces de la Mac; la lista también
se actualiza al entrar y cada 15 segundos mientras Multimedia está abierta.
Una actualización inicial instala el panel y el soporte del widget; las siguientes
ediciones de la lista no requieren instalar nada. Se conservan los enlaces de la TV.
El puente automático mantiene la lista en Application Support, separada del código.
El reproductor de YouTube sigue siendo experimental en Orsay. Ver docs/YOUTUBE.md.

### 8.3.1: identidad de instalación independiente

El propietario informa que el icono 8.3 ejecuta la interfaz 8.2. El ZIP 8.3
contiene el código correcto, pero ambas versiones usaban cpname AlmaTV80.
La 8.3.1 usa **AlmaTV83**, nombre **Alma TV 8.3.1** y número visible dentro.
Se instala por separado para aislar la actualización de la identidad anterior.
El instalador envía no-store e ignora validadores antiguos de caché.
La lista de la Mac se conserva; las preferencias locales de la TV pueden estar
separadas por identificador. Conservar la app anterior hasta verificar la nueva.
