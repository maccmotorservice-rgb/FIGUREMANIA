# Alma TV · Guía web 10.3.1

El control de celular/laptop ahora separa **Guía de TV** (categorías, favoritos, búsqueda y reproducción) de **Importar canales** (listas M3U, búsqueda para organizar, categorías manuales, eliminación y restauración). La guía pagina 20 canales, conserva las categorías que asignaste y muestra el estado confirmado del televisor. No inventa programas u horarios: las listas importadas no incluyen una guía XMLTV.

Esta actualización modifica únicamente `hub_panel.html` en la Mac. **El widget Samsung sigue en 10.3.0 y no necesita sincronizarse de nuevo.** Requiere tener instalado el puente 10.3.0 con favoritos/categorías. El actualizador comprueba ese requisito y conserva la primera página anterior como `hub_panel.antes-guia.html`. No reinicia el puente y no modifica listas, favoritos, medios, imágenes ni sesiones.

Descomprime `instaladores/AlmaTV-Control-10.3.1.zip` y ejecuta `python3 actualizar_control_mac.py` dentro de la carpeta extraída; no uses sudo. Después recarga `http://192.168.1.30:8088/control` en la laptop o celular. El servidor lee la página actualizada en cada apertura. Puedes cerrar Terminal. Para generar el paquete pequeño: `python3 crear_actualizacion_control.py`.

Validación de esta actualización: 50 pruebas Python y 11 pruebas del panel completas pasaron; se volvió a comprobar la guía tras los ajustes finales de paginación, teclado y diseño adaptable. Pruebas del panel con puente HTTP real y navegador en laptop/celular, filtros independientes, categorías manuales, paginación, búsqueda, selección real de canal hacia el receptor Samsung simulado, controles de volumen/YouTube anteriores y actualización local sin tocar datos o widget. Capturas de pruebas: [guía en laptop](docs/capturas/44-guia-TV-laptop-prueba.png), [guía en celular](docs/capturas/45-guia-TV-celular-prueba.png) y [importación y búsqueda separadas](docs/capturas/46-importar-buscar-canales-celular.png).

## Alma TV 10.3.0 · Favoritos a tu manera


En **TV en vivo**, pulsa ☆ Favorito para guardar un canal sin clasificar. **Organizar** permite asignar manualmente Deportes, Entretenimiento, Películas, Series, Documentales, Noticias o Streaming, o eliminarlo. Entra en **★ Favoritos → Categorías** para consultar cada sección. No se clasifica ningún canal automáticamente.

En el control web `http://192.168.1.30:8088/control` → **TV en vivo**, puedes marcar favoritos, asignar categorías y crear categorías propias (hasta 30). **Eliminar canal** lo oculta aunque vuelvas a actualizar su lista; **Canales eliminados → Restaurar canal** lo recupera. Los favoritos se mantienen disponibles al cambiar el filtro de importación, dentro del límite de 504 señales del catálogo.

Los cambios desde la TV se guardan localmente incluso sin la Mac y se sincronizan al reconectarla. Las órdenes de favoritos son absolutas e idempotentes: reenviar una petición no invierte la selección. Los favoritos antiguos de la TV se migran sin categorías. Las listas anteriores se conservan.

**Aplicaciones**, exclusivamente, usa filas de hasta cuatro tarjetas e incorpora **TV en vivo**. Inicio mantiene su carrusel y distribución. Al salir de TV Samsung se libera su indicador nativo, para que el volumen de YouTube vuelva a funcionar. YouTube informa su motor explícitamente al panel. El volumen de una señal HLS nativa sigue dependiendo del control Samsung; este cambio recupera los controles independientes al volver a YouTube o archivos propios.

Los fallos de descarga de listas muestran el motivo disponible; una lista leída sin coincidencias informa del filtro, en lugar de anunciar una importación de cero canales. Continúa el límite de espera de 60 segundos por señal.

## Listas M3U (10.2.0)


Desde `http://192.168.1.30:8088/control`, abre **TV en vivo → Mis listas M3U**, pega una URL pública (por ejemplo `https://iptv-org.github.io/iptv/index.m3u`) y pulsa **Importar lista**. Después usa **Actualizar lista** para renovar sus enlaces sin reinstalar Alma TV. Hasta ocho listas, 16 MB y 50 000 entradas por lista. Las importaciones fallidas conservan los canales anteriores.

El filtro inicial es `mx` (México), obtenido de `tvg-country` o del sufijo de país en `tvg-id`. Deja el país vacío para todos. Puedes filtrar por nombre o categoría y pulsar **Enviar selección a la TV**. Se envían hasta 500 canales, además de los cuatro originales; el panel informa de coincidencias y truncamiento. La web muestra 30 canales por página y la TV 12 para reducir el trabajo del navegador antiguo. Los cambios no reinician el canal que esté sonando.

La Mac importa las listas y sincroniza el catálogo mientras Alma TV está abierta. Una vez recibido, se guarda en la TV y sus enlaces se reproducen directamente, incluso con la Mac apagada. Para usar el control web o actualizar la selección necesitas la Mac encendida. No se descargan logotipos ni miles de imágenes. No todas las señales de una lista son compatibles, están disponibles o permiten verse desde tu región.

La carga de señales nativas y HTML5 espera **60 segundos** antes de mostrar un fallo por tiempo de espera. Los errores explícitos de la señal pueden mostrarse antes. Se conserva el receptor Samsung HLS de 10.1.1, cuya reproducción confirmó el propietario. La importación y sincronización se verifican en pruebas locales; los canales y el firmware físico necesitan comprobación en la TV.

## Base técnica de Samsung Orsay

Aplicación ES5 para Samsung UN50J5200, con puente local en una Mac. El proyecto anterior FIGUREMANIA se conserva. Identificador estable `AlmaTV86`; versión interna **10.3.0**.

## Corrección de carga 10.1.1

Al seleccionar HLS, se usa el Player nativo de Samsung Orsay: SEF `Window` → fuente multimedia 43, SEF `Player`, `InitPlayer(url|COMPONENT=HLS|)`, `StartPlayback(0)`. La secuencia y los eventos corresponden al código oficial [mediaProxy.js](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/src/sectv-orsay/mediaProxy.js), [MediaPluginHLS.js](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/src/sectv-orsay/MediaPluginHLS.js) y [SEF.js](https://github.com/Samsung/cordova-sectv-orsay/blob/a893ea389f99adecd6df2062e6156cd7286c0ad3/cordova-js-src/plugin/SEF.js). La integración es propia y no incluye Cordova.

Los objetos se crean únicamente al elegir una señal HLS. No se instancian al arrancar Alma TV, con YouTube ni con los archivos propios. Se detienen y cierran al cambiar de reproducción o salir, y se restaura la entrada anterior. La imagen nativa utiliza una zona transparente de la interfaz y conserva su proporción. El salvapantallas cubre la imagen sin detener su audio.

La espera de inicio/buffering tiene límite de 20 segundos. Los eventos nativos de conexión, señal inexistente y error de decodificación se muestran en pantalla en vez de dejar «Cargando» indefinidamente. Si no existe Player nativo, solo se intenta HTML5 cuando el firmware declara soporte HLS; ese intento también tiene límite de espera. El volumen de estas señales se ajusta con el control Samsung: el panel desactiva sus controles de volumen para este motor, sin fingir un volumen independiente.

Pruebas de protocolo con API Samsung simulada: apertura diferida, fuente 43, preparación HLS, evento RenderingStart del protocolo, ubicación/pantalla completa, cobertura en salvapantallas, errores, límite de espera, cierre y regreso a archivos MP4. **No prueban la decodificación en el televisor físico ni la disponibilidad de los cuatro canales.**

## TV en vivo · catálogo piloto

TV en vivo aparece en Inicio, en la barra lateral y en el control web. El widget incluye cuatro candidatos de emisoras públicas mexicanas: Capital 21, Canal Once, Canal 10 Chiapas y Canal 22. Cada uno conserva su web institucional y URL de señal en [tv_channels.json](tv_channels.json). Las referencias se contrastaron con los registros públicos de [iptv-org/iptv](https://github.com/iptv-org/iptv/blob/master/streams/mx.m3u) e [iptv-org/database](https://github.com/iptv-org/database/blob/master/data/channels.csv) el 22 de octubre de 2026. No se incluyen listas de canales de pago.

**Disponibilidad y decodificación HLS pendientes de verificar en la TV.** El entorno de desarrollo rechaza con 403 las conexiones a los servidores de las emisoras, por lo que el catálogo no constituye una lista de señales comprobadas. Se muestran como pruebas pendientes en TV, sin inventar programación ni disponibilidad. Horarios, región, certificados TLS y códecs del firmware pueden impedir una señal.

El televisor abre el enlace directamente con su Player HLS nativo (o HTML5 si lo declara compatible), con favoritos persistentes, vista de Multimedia, fondo de Inicio, reintento y pantalla completa. No se guardan posiciones ni se permite buscar dentro de una señal en vivo. Las pruebas de transporte usan MP4 de prueba en lugar de HLS: El transporte MP4 de estas pruebas no demuestra compatibilidad HLS en el Samsung. Estas pruebas comprueban navegación y conexión directa, no la decodificación de las señales públicas reales.

**Después de instalar, seleccionar canales con el control Samsung no requiere la Mac.** La TV necesita internet y soporte del formato. El panel del celular/laptop, YouTube integrado, archivos alojados en la Mac y clima por el puente conservan su dependencia de la Mac encendida. No se ha añadido una adaptación de canales que se active automáticamente.

## Anotaciones de interfaz y volumen

Inicio elimina el bloque «En reproducción» y el título «Herramientas». Las seis utilidades caben en la vista inicial; Aplicaciones se recorre lateralmente con logotipos centrados y colores de marca estables al seleccionar. «Conexión» mantiene su icono y refleja el último intercambio con el puente, sin inferir Wi-Fi a partir de Netflix/YouTube.

El control muestra el nivel solicitado guardado por la TV y, por separado, el reportado por el reproductor. Una lectura inesperada de 100 no sustituye el nivel solicitado después de recargar el panel. El firmware puede vincular el volumen del reproductor al volumen general: esta actualización no garantiza un volumen de hardware independiente ni amplificación adicional.

El ajuste «Abrir al encender» explica cómo comprobar si el Smart Hub ofrece iniciar la última aplicación. No se encontró una API verificada para hacer que un widget de usuario arranque al encender este modelo. **No se ha activado el inicio automático ni modificado el firmware.** Hace falta comprobar las opciones normales de la TV física.

## Inicio automático de vídeos (10.0.5)

«Reproducir ahora» transmite la intención al abrir la sesión oficial. YouTube ejecuta la orden al estar listo, sin depender de una segunda orden desde el menú. El autoplay nativo del SDK permanece desactivado: se conserva la secuencia load/play después de ready, antes de volumen. Al reutilizar la sesión, cada enlace carga su vídeo. Si la primera orden queda sin iniciar, hay una única recuperación a los 1,5 segundos, cancelada por pausa, error o bloqueo explícito del proveedor. El fin de vídeo no avanza la cola antes de que esa selección haya empezado a reproducirse.

Pruebas nuevas: tres ciclos de vídeo → Xbox/HDMI 2 → Inicio → Reproducir ahora, incluso descartando la orden play del menú; recuperación de una primera orden ignorada; respeto de la pausa explícita. HDMI y API de YouTube simulados: hace falta confirmar el recorrido en la TV física. Una restricción del proveedor se comunica como bloqueo, no como reproducción confirmada.

## Estabilidad del fondo

Se reprodujo con temporizadores simulados una retirada del fondo al agotarse el watchdog mientras YouTube seguía en estado activo. Ahora la espera y el buffering mantienen la sesión y la superficie; el diagnóstico de arranque fallido permanece para vídeos que no llegaron a iniciar. Las notificaciones de visibilidad transitoria no destruyen el iframe; salir, abrir una app nativa y cerrar Alma TV mantienen su limpieza explícita. Se evitan escrituras repetidas en la superficie y la creación de sondas de vídeo en cada consulta de progreso.

Prueba prolongada: tres minutos de temporizadores simulados, 48 cambios de menú, 12 cambios de volumen, visibilidad transitoria y salvapantallas, sin pausas ni recargas. En reposo, la superficie recibe cero mutaciones de atributos durante los dos primeros minutos simulados. Esto verifica el controlador en Chromium; el firmware y la decodificación de YouTube necesitan confirmación en la TV.

## Volumen y fin de reproducción

El volumen solo aplica órdenes al reproductor activo; el nivel del inactivo se recuerda sin tocar su decodificador. El puente conserva únicamente la orden absoluta de volumen más reciente por TV. YouTube evita `unMute` y `setVolume` redundantes y confirma el final antes de retirar el fondo o avanzar la cola. El 100 % se verifica como 100 en YouTube y 1.0 en HTML5; no amplifica por encima del volumen base de la TV. Pruebas con MP4 real y API de YouTube simulada; requiere confirmación en el firmware físico.

## Tema 10

Interfaz inspirada en las referencias del propietario: ilustración original a pantalla completa, menú lateral translúcido y carrusel inferior con logotipos reales. El control de celular y Mac comparte el tema y la misma imagen. El PNG original del salvapantallas se conserva sin modificar.

En Inicio y al navegar por las secciones, un vídeo propio o de YouTube ocupa el fondo detrás del menú. Multimedia muestra la sesión activa en un área 16:9 con controles, sin tener que elegir de nuevo el vídeo. Inicio y Multimedia ofrecen un botón de pantalla completa; Volver reduce el vídeo. El foco desplaza Inicio para mostrar los controles inferiores. Los títulos de vídeo se reservan para Multimedia. Ambas presentaciones utilizan la misma sesión, sin crear una segunda reproducción. Al detener se recupera la ilustración. Música y modo solo audio mantienen la imagen de fondo; el salvapantallas conserva reloj, clima, ubicación, marco opcional y audio sin imagen del vídeo.

Las animaciones y transiciones están desactivadas, también al cargar preferencias antiguas. No se utiliza desenfoque. La geometría del vídeo se calcula en píxeles del viewport, fuera de la escala de los controles, para conservar proporciones y permitir navegación.

Vistas de prueba en navegador: [Inicio](docs/capturas/30-alma10-inicio.png), [fondo con MP4 real de prueba](docs/capturas/31-alma10-video-fondo-MP4-prueba.png), [control en celular](docs/capturas/32-alma10-control-celular.png) y [control en Mac](docs/capturas/33-alma10-control-mac.png). No son fotografías de la TV.

Corrección 10.1.1: [Multimedia con MP4 real de prueba](docs/capturas/34-alma10-1-multimedia-MP4-prueba.png) y [botones visibles de Inicio](docs/capturas/35-alma10-1-controles-inicio.png). Se comprueba el desplazamiento con códigos del control Samsung, pantalla completa desde Inicio y continuidad de la misma sesión al pasar por Inicio, Aplicaciones, Ajustes y Multimedia. Las pruebas de YouTube emplean su API simulada.

## Instalar y actualizar

El paquete `instaladores/AlmaTV-10.3.0-instalador.zip` contiene el widget, los archivos del puente y `Instalar Alma TV.app`. Descomprime y abre el asistente en macOS: instala el puente al iniciar sesión y publica el instalador Wi-Fi durante diez minutos. Sincroniza aplicaciones en la TV usando la IP de la Mac. El asistente requiere Python 3.8 o posterior y todavía no tiene firma ni notarización de Apple; su ejecución física en macOS está pendiente de validación. Incluye recuperación del widget 8.7.0.

Alternativa en Terminal, dentro de la carpeta descomprimida:

```sh
python3 configurar_puente_mac.py --bind 192.168.1.30 --tv 192.168.1.249
sudo python3 servir.py --bind 192.168.1.30
```

Si otro instalador ocupa el puerto 80, detén ese instalador con Control+C antes. Tras sincronizar puedes detener el instalador; el puente queda en segundo plano. La Mac debe permanecer encendida y despierta. No abras puertos del router.

## Control desde el celular

Abre **http://192.168.1.30:8088/control** en la misma red Wi-Fi. El PIN y el QR aparecen en **Ajustes → Conectar celular** y en Dispositivos desde la Mac. El propietario controla reproducción; los invitados solamente añaden elementos a la cola. Se pueden revocar los dispositivos vinculados.

- Menús de la TV en el celular con los mismos iconos, acceso directo a cada sección, flechas, Aceptar, Volver y pantalla completa. El panel muestra el menú y el foco confirmados por la TV. Las pulsaciones se envían en orden; el sondeo se acelera brevemente después de una orden y vuelve a reposo aunque el panel siga abierto. Controla Alma TV; al salir a Smart Hub, HDMI o una app nativa no controla sus menús.
- Reproducir ahora, pausa, continuar, detener, anterior/siguiente y saltos de 5, 10 o 30 segundos.
- [Deslizador vertical de volumen](docs/capturas/36-control-volumen-barras.png) con diez barras, porcentaje y control por arrastre, similar al brillo del iPhone. Envía el nivel absoluto de 0 a 100 y agrupa los movimientos rápidos para no saturar la TV. Conserva los botones Vol−, Vol+ y Silencio.
- Volumen de **Alma TV**, independiente del volumen general de la televisión: bajar, subir y silenciar. Guarda el nivel al cambiar de archivo y entre aperturas. Utiliza HTML5 para archivos y las API oficiales para YouTube/Dailymotion; depende de que el motor del televisor exponga esas funciones.
- Enlaces de YouTube y Dailymotion, video o solo audio. La reproducción automática se solicita únicamente al pulsar Reproducir ahora, tanto en `/enlaces` como en `/control`. YouTube recupera el arranque de 8.7: autoplay del SDK desactivado y orden play/loadVideoById después de ready. El arranque no envía órdenes de volumen o unMute. Para servicios en línea, el volumen se modifica al usar sus botones desde el celular; al cambiar de enlace se conserva la sesión del proveedor. El nivel automático al abrir se mantiene para archivos propios. Dailymotion tiene una página independiente, sin SDK ni avisos de YouTube. Dailymotion carga el vídeo con autoplay al recibir la orden, en lugar de enviar solamente play a una API todavía sin vídeo preparado. Los enlaces guardados permanecen manuales. Al enviar un segundo enlace del mismo proveedor se reutiliza la sesión ya lista: no se descarga de nuevo el SDK ni se destruye el iframe; también se permite repetir el mismo vídeo. El proveedor puede impedir la reproducción o exigir interacción.
- Cola, favoritos, listas con nombre, orden, mezcla y repetición. Biblioteca de `~/Music/AlmaTV` y archivos subidos desde el panel.
- MP3/M4A/WAV y MP4/M4V propios, radios mediante URL directa y podcasts RSS con archivos de audio. No reproduce páginas web de plataformas como archivos multimedia.
- Fotos JPG/PNG, escenas de fotos y tarjetas de texto/precios, música de fondo y horarios semanales según la hora de la Mac. No renderiza PDF o PowerPoint; exporta sus páginas a imágenes.
- Varias pantallas registradas por IP, con colas y órdenes independientes. Cada TV necesita Alma TV abierta y compatibilidad verificada.

`/enlaces` conserva el panel anterior. Las nuevas funciones se encuentran en `/control`. La posición de los archivos propios se guarda para continuar después; los servicios en línea mantienen sus propias restricciones.

## Archivos y límites

El puente guarda biblioteca, listas, sesiones y escenas en `~/Library/Application Support/AlmaTV/hub/hub.json`, y las subidas en la carpeta `uploads` junto a ese archivo. Haz copia de esos datos y de `~/Music/AlmaTV`. Quitar una entrada de la biblioteca no borra el archivo original. Las subidas tienen un límite de 250 MB por archivo; fotos, 16 MB. Las fotos se ajustan con `sips` en macOS para reducir carga en la TV.

Conversión opcional de videos subidos a MP4 H.264/AAC: requiere FFmpeg instalado en la Mac. No se instala automáticamente. Las URL de radio y podcast deben ser públicas y directas; se rechazan direcciones privadas y redirecciones. La biblioteca del proveedor, DRM, región y códecs pueden impedir reproducir un contenido.

## Compatibilidad y pruebas

El propietario confirmó anteriormente reproducción de YouTube por enlaces y de archivos propios en esta TV. **El propietario confirmó la reproducción de YouTube en 9.1.2; el tema y las capas de vídeo de 10.1.1 necesitan validación física**. Las pruebas automatizadas usan Chromium, puente HTTP real y archivos multimedia reales; las API de YouTube y Dailymotion se simulan. Una simulación no demuestra que Dailymotion decodifique en el firmware Samsung.

No se añade Spotify: no hay un receptor Spotify Connect verificado para este Orsay. Tampoco se añade soporte DRM para Disney+, Prime Video o Max. Xbox conserva el acceso existente a HDMI 2; no se promete previsualización HDMI dentro del reproductor. El control de volumen del celular no depende del módulo opcional de volumen del control remoto.

## Desarrollo

```sh
npm ci
npm test
python3 crear_instalador.py
```

Python ≥3.8, Node ≥22 para pruebas. La app no requiere Node en la TV ni en la Mac. `preparar.py` construye un ZIP reproducible y valida los recursos; `.preview/app` se extrae del mismo paquete. `crear_instalador.py` incluye el paquete actual y el respaldo 8.7 sin recomprimirlo internamente. El QR se genera localmente; licencia en `app/assets/QR-LICENSE.txt`.

Para distribuir comercialmente faltan firma/notarización, pruebas de hardware por modelo, licencias de contenidos y servicios de cuentas/pagos si se necesitan. Este repositorio implementa un sistema local; no simula esos servicios. Consulta el historial en [docs/HISTORIAL-HASTA-8.7.md](docs/HISTORIAL-HASTA-8.7.md).

Validación 10.2.0: 46 pruebas Python; 85 pruebas previas de interfaz y una prueba nueva de importación/sincronización/caché M3U. La prueba nueva utiliza una lista y señales simuladas; no confirma disponibilidad de emisoras. El lector también procesó la lista global pública de iptv-org (10 623 señales únicas aceptadas, 172 identificadas como México en el momento de la consulta).


Validación 10.3.0: 48 pruebas Python y 89 pruebas de interfaz completas pasaron. Las pruebas específicas comprueban clasificación manual, categorías propias, eliminación/restauración, persistencia tras refrescar listas, cambios TV↔panel y trabajo sin puente. Se reproduce el paso Samsung HLS→YouTube y se verifica que el deslizador del panel vuelve a habilitarse y envía 25 % y 80 % al SDK simulado. Las API Samsung/YouTube se simulan; falta confirmar físicamente la versión 10.3.0 en el televisor. Capturas de pruebas locales: [Aplicaciones, cuatro por fila](docs/capturas/41-apps-cuatro-por-fila.png), [favoritos clasificados](docs/capturas/42-favoritos-categorias-TV-prueba.png) y [categoría propia desde el celular](docs/capturas/43-favoritos-celular-prueba.png).
