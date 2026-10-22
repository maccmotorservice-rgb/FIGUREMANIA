> 8.6.3 conserva el arranque de recuperación y cambia solo la presentación de YouTube: una zona sin ventana flotante y salvapantallas con imagen oculta sin pausa. El resultado de imagen y audio necesita prueba física. Los módulos nativos HDMI/Audio continúan retirados.

> Recuperación 8.6.2: el widget vuelve al código de 8.5.1. Los apartados de 8.6 describen cambios retirados temporalmente. La imagen errática y el volumen siguen pendientes; no se declara resuelto el arranque hasta comprobarlo en la TV.

# YouTube integrado experimental · Alma TV 8.2

## Resultado de la investigación

Existe una integración oficial: **YouTube IFrame Player API**. Permite insertar
el reproductor y enviar play/pause/seek por su API, sin abrir la aplicación nativa.
No convierte un enlace watch en una URL MP4 para el reproductor HTML5 de Alma TV.

Se revisaron los ejemplos oficiales de `youtube/api-samples`, revisión
`07263305b59a7c3275bc7e925f9ce6cabf774022`, especialmente
[player/player_control.js](https://github.com/youtube/api-samples/blob/07263305b59a7c3275bc7e925f9ce6cabf774022/player/player_control.js),
[player/index.html](https://github.com/youtube/api-samples/blob/07263305b59a7c3275bc7e925f9ce6cabf774022/player/index.html)
y `player/demo.js`. El código de Alma TV se escribió para esta integración; no se
copió el código de esos ejemplos.

Referencias del proveedor:

- [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [Parámetros del reproductor](https://developers.google.com/youtube/player_parameters)
- [Requisitos de reproductores integrados](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [Dispositivos compatibles](https://support.google.com/youtube/answer/6098135?hl=es)

En este entorno el proxy devolvió 403 al acceder a la documentación actual y a
`youtube.com/embed`. Los ejemplos oficiales sí se pudieron descargar de GitHub.
No se ha comprobado una reproducción real de YouTube desde la nube ni la
compatibilidad del Samsung UN50J5200: requiere prueba en el televisor. Que la
app nativa funcione no demuestra que el reproductor web actual lo haga.

## Implementación

- Multimedia → **YouTube en línea** guarda un enlace individual. Se aceptan watch,
  youtu.be, Shorts, live y embed con ID válido de 11 caracteres. Las listas sin un
  vídeo individual no se aceptan. Los dominios similares no se consideran YouTube.
- El enlace también se reconoce en **Añadir enlace**, conservando el nombre que
  el usuario escribió. Los archivos propios siguen en su lista independiente.
- La Mac sirve `/youtube/player` con un ID y sesión validados. Esa página carga
  **directamente desde YouTube** la API y el reproductor oficial. La Mac no extrae,
  descarga, recodifica ni retransmite los vídeos. La TV necesita acceso HTTPS a
  YouTube y compatibilidad con su JavaScript y formatos actuales.
- El documento HTTP de la Mac aporta un origen real. Se usa Referrer-Policy origin
  y el parámetro origin corresponde a ese documento. No se falsifican cabeceras.
  Esto no garantiza que YouTube acepte todos los entornos: el error 153 se muestra.
- Se conservan controles y funciones del proveedor. No se ocultan anuncios,
  branding ni opciones del reproductor. El área visible es mayor de 200×200.
- Los controles de Alma TV envían comandos a la API. Pantalla completa amplía el
  mismo iframe: no lo mueve de padre ni lo recarga. Volver lo reduce.
- En 8.6 se usa una sola zona en Inicio o Multimedia. Al salir de esa zona se
  pausa y al volver se reanuda si la pausa fue automática. El salvapantallas es
  la excepción solicitada: conserva el mismo iframe y la reproducción, ocultando
  la imagen para dejar solo audio con reloj y clima. No extrae audio ni recarga
  el vídeo. Este comportamiento requiere comprobación física en Orsay.
  Abrir una app nativa, ocultar el documento, calibrar o iniciar un archivo propio
  detiene YouTube. Los diálogos lo pausan temporalmente.
- Un vídeo privado, eliminado o con embedding desactivado puede fallar aunque
  otro funcione. Los errores 2, 5, 100, 101, 150 y 153 tienen explicación visible.
  Si el proveedor bloquea autoplay se indica que requiere interacción.
- Si el puente es antiguo, falta internet o no carga la API, se muestra un error
  tras 25 segundos, con Reintentar, Volver y la alternativa explícita de app nativa.
  No se cambia a la app nativa automáticamente ni se presenta un fallo como éxito.

## Puente automático

Actualizar tanto el widget como el puente. `configurar_puente_mac.py` copia también
`youtube_player.html` a Application Support y reinicia el LaunchAgent del usuario.
La Mac debe permanecer encendida y despierta. No se necesita una cuenta de API ni
una clave de YouTube para insertar un vídeo público que permita embedding.

## Verificación y prueba física

Las pruebas de interfaz interceptan la API con una **respuesta simulada**. Comprueban
el enrutamiento, origen/sesión de postMessage, controles, errores, persistencia,
pausa de archivos propios y cierre del iframe. No prueban DRM, anuncios, edad,
acceso regional, certificados ni reproducción real del proveedor. La captura
`26-youtube-integrado-api-simulada.png` lleva un aviso visible de simulación.

En la TV: abrir Multimedia, pegar un enlace público y abrirlo. Esperar «YouTube
está listo» y pulsar Reproducir. Comprobar vídeo, audio, pausa, salto, pantalla
completa y Volver. Si falla, anotar el mensaje y código exactos; conservar el
acceso nativo. Solo después de esta prueba se puede afirmar compatibilidad de
esta integración con el firmware de este televisor.

## 8.3: pegar enlaces desde la Mac

Abrir **http://192.168.1.30:8088/enlaces** en Safari o Chrome de la Mac. Pegar uno
o varios enlaces, uno por línea, y pulsar Guardar enlaces. El nombre es opcional
para un solo enlace. Se pueden quitar entradas desde la misma página.

La TV consulta la lista al entrar en Multimedia y cada 15 segundos mientras
esa vista esté abierta, sin interrumpir al escribir en un diálogo. **Enlaces de
la Mac** permite actualizar al momento. Si no cambia el contenido no se reconstruye
la lista. Los enlaces escritos antes desde la TV se conservan por separado.

Se necesita una actualización inicial al widget y al puente 8.3. Después, añadir,
renombrar o quitar enlaces no requiere reinstalar, sincronizar Samsung Apps ni
editar el código. La compatibilidad del reproductor oficial con Orsay sigue siendo
experimental: administrar la lista no garantiza que un vídeo pueda reproducirse.

La lista se guarda en `~/Library/Application Support/AlmaTV/youtube-links.json`,
fuera de Descargas y del ZIP. El asistente del puente copia los nuevos archivos
sin borrar esa lista, que sobrevive a reinicios y actualizaciones. Se admiten 50
vídeos; las entradas duplicadas no se repiten. Una operación con algún enlace
inválido no guarda parcialmente el resto ni sobrescribe una lista corrupta.

El panel y sus peticiones se sirven desde la misma dirección del puente. Las
mutaciones requieren el origen y Host del propio puente, JSON y un token de sesión;
la TV solo consulta la lista. Se evita incrustar el panel en otros sitios. Los
nombres se muestran como texto, sin interpretar HTML. No se descargan vídeos ni
se abre el router. Sigue siendo un servicio para la LAN de confianza.

Las pruebas del panel usan un servidor HTTP local real, guardan y eliminan enlaces,
recargan la página y verifican que el widget recibe los cambios sin modificar su
ZIP. La reproducción de YouTube en esas pruebas continúa usando la API simulada.

## Puente: corrección de inicio y diagnóstico «inicio-2»

El propietario informa que la TV muestra «YouTube está listo. Pulsa Reproducir»,
pero el área queda negra al pulsar tanto con el ejemplo como con un enlace propio.
Esto confirma el callback onReady en su TV; no confirma reproducción ni demuestra
por sí solo que el firmware sea incompatible.

Esta corrección cambia **solo el puente**. El widget y ZIP 8.3.1 son idénticos.
Actualizar el puente con configurar_puente_mac.py y volver a abrir el vídeo en la
TV carga la página nueva, sin sincronizar Samsung Apps ni reinstalar el widget.

- Las órdenes válidas confirman su recepción. Si el vídeo sigue sin iniciar,
  después de 12 segundos se muestra YT-INICIO con el estado y tiempo que reporta
  la API. onReady se describe como API lista, no como reproducción confirmada.
- Si el estado es -1, se usa loadVideoById explícito; cuando ya está preparado,
  se conserva playVideo. No se fuerza silencio ni se simula reproducción.
- Se establecen dimensiones en píxeles con setSize para motores antiguos, además
  de los estilos del iframe. El proveedor conserva todos sus controles.
- Cuando el padre esperado es opaco «null», se reconocen las representaciones
  locales antiguas file://, file:/// y cadena vacía, manteniendo el requisito de
  ventana padre exacta y token de sesión. Orígenes HTTP distintos, otras ventanas
  y sesiones incorrectas continúan rechazándose.
- YT-ORIGEN, YT-FUENTE, YT-ORDEN y YT-ACTIVACION distinguen controles rechazados,
  excepciones y bloqueo de activación. No se relajan controles para otros orígenes.
- /youtube/prueba carga una prueba directa con botones y teclado en el mismo
  documento que llama a la API. Sirve para comparar la Mac con la ruta del widget;
  no añade un extractor, proxy multimedia ni conversión de vídeo.
- El panel /enlaces incorpora Estado del reproductor. Los últimos informes de
  Alma TV y de la prueba directa se conservan por separado en memoria, con hora,
  estado, segundos y dimensiones. Se muestra primero el de Alma TV. Los informes
  no contienen URLs, títulos, cookies o token de sesión. El endpoint solo admite
  escritura desde el origen/Host del puente, con JSON pequeño y formato de sesión válido.

Las pruebas de origen, recepción, carga explícita, watchdog, activación directa
son simulaciones de la API. La prueba del endpoint y panel usa HTTP real local.
La corrección requiere comprobar de nuevo en la TV; no se afirma que el vídeo
real ya funcione. Si el contador avanza y sigue negro, puede ser un problema de
representación/composición distinto de una orden perdida. Si no avanza, se
necesita el mensaje y código para distinguir bloqueo, carga y compatibilidad.

## 8.4.0: proporciones e Inicio

La ventana se centra en 16:9 tanto en el widget como en la plantilla del puente.
Inicio conserva el iframe y la sesión en «En reproducción». Se recorta el área
visible al desplazar la página; completamente fuera de vista se pausa y al
reaparecer continúa. Las demás vistas cierran YouTube. Las pruebas automatizadas
comprueban geometría, identidad del iframe y pausa/continuación con API simulada.
El propietario confirmó reproducción real antes de este cambio; la nueva
geometría todavía debe comprobarse en el televisor.


## 8.5.0: ventana persistente y selección desde Inicio

El propietario informó que 8.4 reproducía en un cuadro pequeño y desaparecía al
navegar. Las pruebas anteriores de contenedor 16:9 no verificaban dimensiones
explícitas del iframe oficial ni continuidad entre todas las secciones.
Ahora se envían medidas numéricas validadas por postMessage al documento del
puente, además de establecer width/height y estilos en ambas capas. Se conserva
la API oficial y el mismo iframe al ampliar, reducir y navegar.
El video ocupa el ancho disponible; Inicio enfoca «En reproducción» automáticamente.
Cuando el área grande sale de vista se usa una ventana fija 416×234 (16:9), sin
pausar ni recargar. En otras secciones se reserva espacio bajo el contenido para
esa ventana. Inicio ofrece «Elegir video de YouTube» con la lista de la Mac y
opción de pegar un enlace desde la TV. La lista se actualiza sin reinstalar.
Las pruebas verifican ambos iframes, sesión/estado al navegar, salida desde
pantalla completa, ausencia de solapamiento con el contenido en las otras vistas
y selección desde Inicio. La API se simula; el aspecto en Orsay requiere comprobación
física tras instalar 8.5.0 y actualizar el puente.


## 8.5.1: superficie de video fuera de las escalas del tema

El propietario informó audio/reproducción con imagen negra y varios rectángulos
superpuestos en 8.5.0. No se ha demostrado la causa exacta en el firmware. El
widget colocaba el iframe bajo el escenario escalado por CSS y recalculaba sus
dimensiones con cada mensaje de estado/animación.
La superficie persistente ahora cuelga directamente de body, sin ancestros con
transformaciones. Se usan coordenadas reales del área visible; se rechazan
medidas no finitas o fuera de la pantalla. Las dos capas de iframe conservan
medidas explícitas, pero setSize y postMessage de tamaño solo se repiten cuando
cambian las dimensiones (o cuando la API termina de inicializarse). Inicio
mantiene su espacio y el video conserva su origen y su sesión.
Se prueba la coincidencia del video con «En reproducción» a 1280×720 y 1920×1080,
ausencia de ancestros transformados y ausencia de reajustes tras 50 avisos de
animación con el mismo tamaño. La API está simulada: la imagen real en Samsung
Orsay sigue pendiente de comprobación por el propietario.


La misma corrección libera Vol+/Vol-/Mute al sistema Orsay con
Common.API.Plugin.unregistKey y los valores reales de TVKeyValue, si existen.
Nunca se cancelan esas teclas: mute 27 deja de tratarse como Escape/salir.
Se prueba la cesión y el no bloqueo con API Samsung simulada; el volumen y el
OSD reales deben comprobarse con el control remoto del televisor.
No se añade vista previa HDMI: el proyecto solo tiene una ruta verificada por
código para seleccionar un descriptor de fuente, no evidencia de captura o
composición HDMI dentro de un widget en el UN50J5200.


## 8.6.0: corrección tras el informe físico de 8.5.1

8.5.1 no resolvió la imagen ni el volumen en el televisor. La foto muestra dos
áreas: un espacio negro en Inicio y otra ventana flotante sobre el menú. Se retira
la ventana flotante automática de YouTube. Hay una única zona, sin animaciones
sobre ella, y los controles caben junto a la imagen en 720p. Fuera de esa zona
visible se pausa; solo una pausa automática se reanuda al volver. La imagen física
no se declara resuelta por las pruebas simuladas.

Los saltos ahora permiten 5, 10 o 30 segundos, con búsqueda agrupada por ráfagas
de pulsaciones. Los controles de pantalla completa respetan la preferencia.
Ver [HDMI-ORSAY.md](HDMI-ORSAY.md) para la investigación oficial de Window, la
prueba nativa de HDMI 2 y el nuevo control Audio del televisor.
