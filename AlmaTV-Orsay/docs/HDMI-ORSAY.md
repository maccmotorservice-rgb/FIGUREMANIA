> Estado actual 8.6.2: esta integración está retirada de la app para recuperar el arranque tras los cierres físicos de 8.6.0 y 8.6.1. Se conserva este documento como investigación; no describe una función activa de 8.6.2.

# HDMI 2 dentro de Alma TV: implementación 8.6.0

## Evidencia técnica encontrada

El proyecto oficial Samsung TOAST documenta `tvwindow` como picture-in-graphic
para Orsay. Su implementación usa SEF `Window` y las funciones `webapis.tv.window`:

- [Documentación oficial del proyecto](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/docs/toast.tvwindow.md).
- [Implementación específica Orsay](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/src/sectv-orsay/tvwindowProxy.js).
- [Prueba del propio proyecto que pregunta si HDMI se ve dentro de la ventana](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/cordova-test-runner/cordova-test-runner-src/www/spec/toast.tvwindow.js).
- [Apertura SEF en la plataforma oficial Orsay](https://github.com/Samsung/cordova-sectv-orsay/blob/master/cordova-js-src/plugin/SEF.js).

La tabla del documento cubre Orsay 2012–2014. No confirma por nombre el
UN50J5200 del propietario. La documentación web antigua de Samsung no fue
accesible desde este entorno (HTTP 403); sí se revisó el código oficial completo.

## Implementación

`app/hdmi.js` adapta la secuencia documentada, sin incorporar Cordova:

1. Detecta `Open/Execute/Close` en el objeto SEF y las funciones de ventana.
2. Abre `Window` y lee la fuente original real antes de modificar nada.
3. Selecciona código **32** (HDMI2) de la tabla oficial de Samsung.
4. Configura `setRect(rect, 0)`, llama a `SetPreviousSource` y `show(0)`.
5. Lee `getSource(0)` con reintentos limitados para confirmar HDMI 2.
6. Si falla, intenta restaurar la fuente original, ocultar y cerrar la ventana.

No se captura ni retransmite HDMI, no se usa un reproductor HTML5 para esa
entrada y no se dibuja una señal simulada. `confirmed` significa que la API
identifica HDMI 2; **no confirma que haya imagen ni que la consola esté encendida**.
Los mensajes de interfaz mantienen esa distinción.

Xbox abre la ventana nativa en una vista del reproductor. «Pantalla completa»
extiende esa misma fuente y oculta la interfaz; Volver reduce. Inicio utiliza
«En reproducción». Al navegar a otras secciones queda una ventana pequeña en
el espacio reservado. Abrir YouTube, un archivo propio, una app externa, un
diálogo, el salvapantallas o salir cierra el modo HDMI. La consola continúa su
funcionamiento independientemente de la previsualización.

Si no existe la API de ventana, se conserva la selección de entrada anterior
mediante descriptor real y, en su ausencia, la indicación SOURCE → HDMI 2.

## Comprobación

Pruebas con API Samsung simulada verifican la secuencia real, código de entrada,
rectángulos, ampliación/retorno, restauración de la fuente original, cancelación
de verificaciones pendientes y fallos de apertura, selección, geometría, show,
fuente desconocida y lectura de fuente distinta. Se conserva el control de volumen
nativo y se comprueba que cambiar de HDMI a YouTube o Netflix libera la ventana.

**Pendiente en la TV física:** imagen visible de la consola en el recuadro,
correspondencia del área nativa con el tema y funcionamiento a pantalla completa.
No se presenta el resultado simulado como imagen HDMI real.

## Licencia

Secuencia adaptada de Samsung Electronics (2015), Apache-2.0. Licencia incluida
en `app/assets/SAMSUNG-APACHE-2.0.txt`; modificaciones y gestión de ciclo de vida
para Alma TV (2026).


## Correcciones incluidas tras la prueba física de 8.5.1

El propietario confirmó que 8.5.1 seguía con volumen inoperante e imagen errática.
Su foto muestra un rectángulo vacío en Inicio y otro flotante con la imagen.
Por ello 8.6 retira el traslado flotante automático de YouTube: mantiene una sola
zona de reproducción, sin animaciones de escala en el video ni transición de
página cuando la sesión está activa. Al quedar fuera de vista se pausa y oculta;
al volver se continúa si la pausa fue automática. No se mantiene reproducción
invisible de YouTube al navegar por otras secciones. Los archivos propios conservan
su funcionamiento previo. El cambio reduce funcionalidad de navegación de YouTube
para priorizar un único espacio estable; aún debe verificarse en el hardware.

El módulo `tv-audio.js` adapta las llamadas documentadas en
[tvaudiocontrolProxy.js de Samsung](https://github.com/Samsung/cordova-plugin-toast/blob/89236a6c26cf497046941a309fb5e549faa84821/src/sectv-orsay/tvaudiocontrolProxy.js):
`Audio.GetVolume`, `SetUserMute`, `SetVolumeWithKey` (0 subir, 1 bajar).
Usa `AppCommon.RegisterKey` si está disponible. Si la inicialización falla,
intenta `AppCommon.UnregisterKey` para las tres teclas y conserva la cesión clásica.
No modifica el nivel al inicializar; cada pulsación aplica un paso y lee la respuesta.
La comprobación del amplificador y del sonido real requiere el control remoto físico.

Los saltos se configuran a 5, 10 o 30 segundos en Ajustes o con «Saltos» en el
reproductor. Se guardan en preferencias; izquierda/derecha en pantalla completa
usan el mismo valor. Se agrupan pulsaciones separadas por menos de 180 ms en una
sola búsqueda. YouTube conserva la API oficial: no se garantiza eliminar su
latencia de red o de decodificación.
