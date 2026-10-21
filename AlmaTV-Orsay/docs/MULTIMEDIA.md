# Reproductor propio y pruebas de contenido

`app/player.js` usa elementos HTML5 persistentes de audio/video, fuera del renderizado de rutas. Reproducir, pausar, detener, anterior/siguiente, salto y volumen controlan esos elementos reales; el estado Reproduciendo depende de su evento nativo `playing`, no de un contador simulado. La muestra incluida es un MP3 original de 12 s, no un catálogo de Spotify.

El audio puede continuar en otras vistas de Alma TV. Al abrir Netflix/YouTube o salir se pausa; los videos se pausan al abandonar su vista. Sin codecs o conexión, se muestra error explícito. No se garantiza reproducción de fondo cuando Orsay suspende el widget.

`puente.py --media-dir CARPETA` enumera un máximo de 100 archivos directos con extensiones permitidas, sin subdirectorios ni symlinks. La UI guarda hasta 30 entradas propias, más la muestra original. Los identificadores son hashes del nombre, no rutas recibidas del cliente. Solo se sirven archivos que pertenezcan a la carpeta configurada. El servidor transmite en bloques de 64 KiB y soporta 206/Content-Range; rechaza intervalos inválidos y rutas externas.

`preview.py` comparte el mismo transmisor Range del puente: un servidor estático sin Range podía reproducir MP3 pero impedía adelantar correctamente. La corrección se prueba decodificando un MP3 real y observando su posición después del salto, sin modificar el estado interno del reproductor.

El MP3 de prueba se compuso para este proyecto y se codificó con FFmpeg a partir de una síntesis simple de notas; no utiliza grabaciones ajenas. El archivo MP4 de `tests/fixtures/` es un patrón original generado para comprobar decodificación H.264 y no se incluye en el widget ni en la lista del usuario. Las capturas de ese patrón llevan el nombre de prueba explícito.

YouTube conserva su lanzamiento nativo; no se presume soporte de su iframe actual en WebKit antiguo. Los enlaces a páginas de YouTube y Spotify se rechazan como fuentes multimedia directas. No hay extracción de audio, eliminación de DRM, acceso a cuentas ni catálogo remoto fingido.

Para comprobarlo en la TV: reproduce primero la muestra MP3, pausa/reanuda y salta 10 s; luego importa un MP3 y un MP4 H.264/AAC propios desde la Mac. La decodificación en Chromium no certifica el soporte del firmware físico.
