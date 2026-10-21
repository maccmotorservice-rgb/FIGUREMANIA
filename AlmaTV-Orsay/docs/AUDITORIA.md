# Auditoría de la base y decisiones de implementación

Se leyeron completos el prompt, LEEME_PRIMERO, LEEME de la base, HTML/CSS/JS, config.xml, widget.info y preparar.py del ZIP adjunto. Se inspeccionaron los recursos y la imagen objetivo. La solicitud del chat de usar FIGUREMANIA en una rama prevalece sobre la sugerencia del documento de crear otro repositorio: todos los archivos nuevos están en AlmaTV-Orsay, rama alma-tv/orsay; el proyecto previo se conserva.

## Base 6.0 recibida

| Hallazgo en fuente | Efecto | Corrección comprobable |
|---|---|---|
| `draw()` mantiene las mismas tiras y `updateHero()` cambia el título | Inicio, Apps y Herramientas parecen la misma pantalla | Renderers distintos, rejillas y rutas con pila de retorno |
| CTA `#cta` es un div sin acción ni foco | Botón decorativo | Botón accionable abre Apps |
| `tick()` cada 15000 ms | Cuenta regresiva salta 15 s; no existe pausa | Intervalo 1 s, vencimiento por Date, pausa/reanudar/reinicio |
| `monthHTML()` depende siempre de new Date | No se pueden explorar meses | Mes seleccionado independiente, anterior/siguiente/hoy |
| `#overlay` y `#saver` quedan fuera de `#interface` | Calibración no cubre herramientas ni modales | Todas las capas dentro de `#safe` |
| `tvIp` hardcoded sin editor | Cambio de DHCP rompe DIAL | IPv4 privada editable, persistencia y diagnóstico por app |
| XHR sin timeout; GET de YouTube equivale a red | Espera indefinida y diagnóstico incompleto | Timeout 6 s, ambos servicios, códigos HTTP y estado no confirmado |
| Prime abre web como si fuera otra app | Confunde soporte nativo con web | «Por probar», sin POST ni web automático |
| Clima manda a Google | No hay medición meteorológica | Puente Open-Meteo opcional, observación y atribución, Sin datos al fallar |
| Escala permitida hasta 110 %, solo Y, guardado no informa fallos | Riesgo de overscan y pérdida silenciosa | 76–100 %, X/Y, presets y aviso de almacenamiento |
| Servidor `0.0.0.0` expone todo su directorio | Superficie innecesaria | Servidor ligado a IP privada, solo catálogo y Widget ZIP |
| Build sin validación ni determinismo | Fallos de instalación difíciles de detectar | ZIP reproducible, identidad única, validación XML/rutas/tamaños/CRC/SHA-256 |

No se reutilizan las imágenes de apps/hero del starter: el paquete no incluye evidencia individual de sus licencias. Se usan nombres de servicios en texto y una composición abstracta original en JPEG, generada para este proyecto (script conservado en tools/generar_hero.py). La captura del usuario permanece únicamente en documentación comparativa, nunca como fondo de la aplicación.

## Referencia CleanYourTV

Referencia: https://github.com/Gathin23/cleanyourtv. Se revisaron README, LICENSE MIT, themes/README, configuraciones aurora y six-columns y secciones de MainActivity.java relativas a foco, filas y movimiento reducido. El SHA consultado se registra en REFERENCIAS.md.

Ideas aplicadas: separación de configuración y vista; foco recordado al volver; límite de recursos; composición cinematográfica con dock compacto; estado honesto de integraciones; movimiento reducido. No se copia código Java, layouts, fuentes, iconos ni fondos. No hay ADB, APK, sustitución de HOME ni desactivación de paquetes en Orsay.

## Comparación visual

[Galería completa y comparación](comparacion.html). Se reduce la tipografía del hero de 47 px a 43 px antes de la calibración global, se conservan dos filas compactas, se evita un catálogo ficticio y se da a cada pantalla una composición propia. No se reproduce la fotografía promocional de la referencia ni sus logotipos.

Las capturas se generaron en Chromium a 1280×720, con presets de 3, 5 y 8 % por borde. Son una validación de software y composición; no certifican el WebKit ni el overscan físico del televisor.

## Revisión 7.1 solicitada tras la instalación física de 7.0

El propietario informó que la mejora visual era positiva, pero la lentitud se observa en toda la TV. Se diferencia esa limitación de la carga propia del widget: no se intentan operaciones de limpieza Android ni borrados del sistema. El primer paso recomendado es un reinicio completo; después, revisión de apps opcionales con el propietario.

Nueva referencia del chat: menú lateral y varias filas; la petición posterior de tema claro prevalece sobre el fondo oscuro de la captura. Se conserva la composición, pero se usa la ilustración del propietario como fondo sin publicidad ni historial fingido. Se añaden logotipos locales con licencias verificables y estados para servicios no nativos.

En 7.0, `tick()` reescribía la hora y los seis valores de Inicio cada segundo incluso sin cambios. También reescribía el estado DIAL y movía estilos del reloj sin cambiar de posición. 7.1 añade caché por nodo y posición; una prueba MutationObserver con hora fija comprueba cero mutaciones en reposo. El foco solo cambia sus dos nodos y no escala tarjetas ni consulta todos los elementos `.focus` en cada tecla. No se anuncia una medición de rendimiento físico.

Xbox es una selección de entrada, no una app Orsay: consulta fuentes por API detectada y pasa el descriptor HDMI 2 intacto al selector. No hay números mágicos de fuente ni emulación de mando por la red. Si no está disponible se indica usar SOURCE. La documentación Samsung consultada desde nube fue bloqueada con HTTP 403; por ello la detección y las pruebas de transportes no se presentan como confirmación de soporte en este firmware.

Clima y Relay DIAL se separan para que activar el clima no desvíe los lanzamientos directos a un puente cuyos POST estén deshabilitados. El nuevo salvapantallas conserva la imagen exacta y agrupa hora, fecha con año, ciudad configurada y clima sin caja negra.

El instalador 7.0 instalado por el propietario se conserva sin recomprimir. El paquete nuevo utiliza ID AlmaTV71 y versión 7.1.0; no se reemplaza automáticamente nada en el televisor.

## Revisión 7.2: idioma, encuadre, movimiento y multimedia

Se revisan textos y etiquetas, se añaden tildes/ñ al teclado y se utiliza un campo de texto real para admitir entrada física y composición de caracteres. El empaquetado exporta escapes Unicode en JS y referencias de caracteres en HTML/CSS para evitar depender de la interpretación de archivos UTF-8 del motor antiguo; las pruebas cargan exactamente los bytes del ZIP.

Los fondos se separan de la capa calibrada. El lienzo lógico 1280×720 se adapta al tamaño real de la ventana, mientras la calibración conserva los controles dentro de la zona segura. El marco blanco es una preferencia exclusiva del salvapantallas; puede desactivarse sin alterar escala/X/Y ni añadir márgenes al tema.

Se añaden transiciones cortas y no bloqueantes de página/foco/pulsación, un acento gráfico de entrada y barras de reproducción ligadas al estado real del audio. Animaciones reducidas desactiva estos efectos. No se añaden videos decorativos ni fondos animados continuos.

El carrusel mantiene alrededor de seis tarjetas grandes visibles y desplaza la selección. Se igualan los fondos de marca en Inicio y cuadrícula. Los encabezados editoriales los solicita el propietario; no se afirma acceso a catálogos, disponibilidad o suscripciones.

El reproductor propio controla audio/video reales y comparte archivos de una carpeta elegida en la Mac. La búsqueda por segmentos se implementa en el puente y en el servidor de preview, no se sustituye por un cambio artificial del contador. La compatibilidad física de codecs sigue pendiente. Spotify/YouTube no se incrustan como si sus reproductores modernos fueran compatibles.
