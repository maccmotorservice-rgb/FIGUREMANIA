# Investigación: Samsung UN50J5200, video de fondo y música independiente

Fecha de consulta: 23 de octubre de 2026 (America/Guatemala).

## Resultado

Se encontró una vía documentada para Orsay: un único contenido audiovisual, servido por la Mac, con el video y dos pistas de audio seleccionables. La pista 0 contendría el audio original y la pista 1 la música. El cambio de pista se realizaría en el reproductor nativo de Orsay mediante `SetStreamID`, con tipo de audio 1. Evita depender de dos reproductores independientes reproduciendo a la vez.

**Estado: alternativa técnicamente fundamentada, no solución confirmada en la TV física.** La existencia de la API de Orsay no certifica todas las combinaciones de contenedor, códec y firmware del UN50J5200. No se ejecutó esa API en el televisor durante esta investigación. Tampoco se comprobó Web Audio en ese firmware. La aplicación y los instaladores no se modifican por este informe.

## Equipo y observaciones disponibles

- El proyecto identifica el equipo como Samsung UN50J5200 y usa la plataforma Orsay. No se verificó una etiqueta física, sufijo regional ni versión de firmware nueva durante esta investigación.
- El propietario confirma que YouTube solo funciona y que el MP3 solo funciona.
- Al iniciar el MP3 adicional, se oye aproximadamente un segundo y ambos se interrumpen con imagen negra. Reproducir de nuevo el video recupera YouTube.
- Dos lecturas del puente mostraron el mismo tiempo de YouTube, 6060.76708984375 s, y estado de presentación «Preparado». Esa etiqueta agrupa varios estados numéricos; no demuestra si era buffering, cued, sin iniciar o finalizado. Las lecturas no incluyeron antigüedad del estado ni avance del reloj del MP3.
- El informe «music_state: Reproduciendo» no prueba sonido real ni avance continuo. En la implementación actual la etiqueta puede conservarse si el motor nativo interrumpe el audio sin entregar el evento esperado.

Estos hechos son compatibles con una interrupción entre sesiones multimedia. No demuestran por sí solos una prohibición universal de todo audio simultáneo en ese hardware.

## Fuentes consultadas y alcance de cada una

### 1. Samsung: selección de pistas de audio en Orsay

https://github.com/Samsung/cordova-plugin-toast/issues/59#issuecomment-321730548

Respuesta de Woosik Park (`pwsses`), identificado por GitHub como **CONTRIBUTOR** del repositorio de Samsung, publicada el 11 de agosto de 2017. Explica:

> “Tizen and Orsay platform has API which change audio track.”

Para Orsay indica `SetStreamID`, primer parámetro de tipo de audio **1**, segundo parámetro índice de pista. El ejemplo escrito en el comentario contiene erratas de puntuación; no se ejecutó literalmente. Es evidencia específica de Orsay, no una especificación certificada para el firmware particular del UN50J5200.

### 2. Samsung: integración del reproductor Orsay

https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/src/sectv-orsay/mediaProxy.js#L389

`createSEF(id)` selecciona la fuente multimedia y obtiene `SEF.get('Player')`. El código también usa `currentMediaInfo` para el estado corriente. Esto documenta la integración nativa usada como referencia por Alma, pero no prueba por sí solo que cualquier implementación HTML/Web Audio sea imposible.

### 3. Samsung: objetos SEF por nombre

https://github.com/Samsung/cordova-sectv-orsay/blob/a893ea389f99adecd6df2062e6156cd7286c0ad3/cordova-js-src/plugin/SEF.js

`SEF.get(name)` conserva objetos por nombre y llama `Close()`/`Open()` al obtener el módulo. Importante para comprender la gestión de recursos; no es una tabla de capacidades de hardware.

### 4. FFmpeg: selección de flujos y captura en macOS

https://github.com/FFmpeg/FFmpeg/blob/master/doc/ffmpeg.texi

La opción `-map` permite construir una salida con el video de una entrada y audio de otras. Se puede producir un archivo con un video y varias pistas de audio.

https://github.com/FFmpeg/FFmpeg/blob/master/doc/indevs.texi

La sección AVFoundation documenta captura en macOS y selección de entradas de video/audio. Sirve como base para investigar una futura captura de YouTube reproducido en la Mac; no demuestra que esa integración, su rendimiento ni la recuperación del audio original ya funcionen en este proyecto.

### 5. Howler: Web Audio y fallback

https://github.com/goldfire/howler.js/blob/master/README.md

Documenta dos rutas distintas: Web Audio y fallback HTML5 Audio. Incorporar la biblioteca no crea soporte Web Audio donde el navegador no lo tenga; volver a HTML5 Audio nos devolvería a la ruta que está fallando. No se encontró aquí una certificación para el UN50J5200.

## Acceso documental incompleto

El portal `developer.samsung.com` (tablas de motor web, modelos y AVPlay) y la página de soporte de producto en `www.samsung.com` devolvieron 403 desde la conexión de investigación. Se intentó también la consulta autorizada fuera del sandbox y persistió el bloqueo del túnel. No se presentan esas páginas como fuentes leídas. Los repositorios públicos de Samsung sí fueron accesibles.

Las búsquedas públicas realizadas no encontraron evidencia fiable de `AudioContext` o `webkitAudioContext` en el firmware de este modelo. **No encontrarla no equivale a demostrar que no exista.** Tampoco debe extrapolarse el soporte de Samsung Internet móvil o de televisores Tizen recientes.

## Demostración realizada fuera de la TV

Se generó `UN50J5200-demostracion-dos-pistas.mp4` con material de prueba del repositorio y un tono sintético. No contiene un video de YouTube ni música personal del propietario.

`ffprobe` confirmó:

- un flujo de video H.264 Constrained Baseline, nivel 3.1, 1280 × 720;
- dos flujos de audio AAC-LC, estéreo, 48 kHz;
- duración de 4 segundos.

La primera pista es un tono de prueba; la segunda procede del MP3 de prueba del proyecto. Los detalles se guardan en `UN50J5200-demostracion-ffprobe.json`. Esto demuestra la preparación del contenedor, no su reproducción ni cambio de pista en el Samsung.

## Qué conserva y qué cambia esta alternativa

Para un **video local preparado en la Mac**, imagen y audios pueden viajar en un solo archivo y el botón de música puede seleccionar una de sus pistas. No es necesario reproducir dos contenidos independientes en la TV. El MP3 se convertiría a AAC al preparar ese archivo; la carga inicial del MP3 seguiría realizándose desde la laptop.

Para **YouTube directo dentro del iframe oficial de la TV**, esta API no añade una pista MP3 externa. Ese reproductor no da a Alma una operación para insertar nuestra música en el contenido de YouTube.

Conservar YouTube como origen exigiría producir la señal en la Mac —por ejemplo, reproducirlo y capturarlo allí— y servir la señal resultante a la TV. Esa integración no está implementada ni validada: depende de permisos de captura, capacidad de la Mac, transporte y latencia. Para recuperar el audio original también haría falta capturarlo o disponer del archivo original, no solo capturar la pantalla.

En un archivo preparado, todas las pistas comparten la línea de tiempo del video. Cambiar de pista no equivale a pausar y reanudar la canción con un reloj independiente. Añadir otra canción durante la reproducción requeriría preparar otra salida o un productor de señal en vivo.

## Verificación necesaria antes de llamarlo solución del modelo

1. Abrir el archivo de demostración con un reproductor nativo controlado por Alma, no con dos elementos HTML.
2. Comprobar cuántas pistas de audio informa el módulo y los resultados reales de seleccionar los índices 0 y 1 con tipo 1.
3. Confirmar en la TV que cambia el sonido, la imagen sigue visible, el tiempo avanza y el control físico conserva volumen.
4. Repetir con el fondo local deseado y la música del usuario.
5. Investigar por separado captura/transmisión desde la Mac si se exige YouTube directo. No usar el éxito de un archivo local para afirmar que esa parte ya está resuelta.

## Conclusión operativa

La opción con mejor respaldo encontrado es **un único reproductor nativo y pistas de audio dentro de su contenido**. Es una base documentada para un rediseño; no una corrección verificada del modo actual YouTube + MP3 independiente. No hay evidencia suficiente para prometer esa combinación exacta en el UN50J5200 sin comprobar capacidades y reproducción en el hardware.
