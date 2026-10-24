# Alma TV 11.1.8 · Control con el tema de Alma y vista pulsable

El controlador de laptop y teléfono usa el fondo original, paneles oscuros translúcidos, selección azul tenue, reloj y perfil local. La barra inferior muestra cinco accesos completos y desplaza el resto. Los nombres de las secciones siguen disponibles para lectores de pantalla, teclado y tooltips. La guía, biblioteca, cola, importación, escenas y ajustes conservan sus operaciones.

Laptop abre Vista TV; teléfono abre Mando. Vista TV recibe el contenido de los menús de Alma y permite pulsar las apps y opciones que están en pantalla. La orden se valida contra la vista y los elementos activos del televisor, y ejecuta la misma acción que el selector. El teclado en pantalla también se puede pulsar y refleja el texto actual de los campos. El teclado del navegador también permite flechas, Aceptar y Volver. Requiere sincronizar el widget 11.1.8 y actualizar el puente; la vista no está disponible con un widget anterior.

«Mostrar contenido» activa una vista previa de YouTube silenciada en el navegador del controlador, con seguimiento aproximado de tiempo y estado mediante la API oficial. Es otra sesión del navegador de la laptop/teléfono: **no captura la pantalla de la TV, HDMI, Smart Hub ni aplicaciones externas**. Su disponibilidad depende del video, las políticas del reproductor y la conexión. La vista de menús funciona por separado de esa reproducción.

La vista de menús solo se entrega al propietario vinculado; se elimina del estado de invitados. El puente filtra el HTML recibido; la vista se muestra en un iframe sin permiso para scripts, con CSP y filtrado adicional. Las pulsaciones no aceptan código arbitrario ni selecciones de una vista anterior. La foto se lee de la caché local de la Mac y no se incluye en el repositorio o instalador público.

Los snapshots se obtienen solo cuando un controlador del propietario solicita Vista TV, con una autorización temporal que caduca a los diez segundos de dejar de renovarse. Se obtienen como máximo una vez por segundo elegible de polling. Se limitan sus tamaños y no incluyen objetos multimedia. El estilo se carga una vez en la vista del controlador; las actualizaciones sustituyen su contenido sin recargar el iframe. Las pantallas demasiado grandes pueden no estar disponibles en Vista TV; Mando y las herramientas web permanecen disponibles.

El trabajo sobre audio simultáneo continúa pendiente. Esta versión no certifica YouTube + MP3 simultáneos, ni incorpora la alternativa de pistas de audio del informe de investigación. El fondo original, los datos locales y el respaldo estable 11.0.3 permanecen preservados.

Validación: 97 pruebas de aplicación, 19 del controlador con puente real y 74 Python correctas. Tras incorporar la captura de menús bajo demanda se repitieron las dos pruebas de vista pulsable y vista previa, ambas correctas. ES5 y build verificados. Las APIs de TV/YouTube usadas por estas pruebas son simuladas; queda pendiente la validación física en el Samsung. Capturas en `docs/capturas/alma11-control-laptop.png` y `alma11-control-telefono.png`.

Instalador: `instaladores/AlmaTV-11.1.8-instalador.zip`. Actualizar en Mac, sincronizar aplicaciones en TV, comprobar 11.1.8 en Configuración y recargar el controlador. La Mac sigue encendida y conectada. La latencia, coste de los snapshots en Orsay y funcionamiento físico de pulsaciones y vista previa requieren la comprobación del propietario en su Samsung.

---

# Alma TV 11.1.7 · Carga explícita de MP3 y diagnóstico visible en Biblioteca

La ruta nueva de MP3 omitía load antes de play, a diferencia del reproductor normal. Ahora llama load explícitamente después de configurar el archivo. También tolera un rechazo del ajuste de volumen, como el reproductor normal, y sigue intentando reproducir: muestra un aviso para usar el volumen de la TV. Un rechazo del silencio independiente detiene el intento para evitar sonido simultáneo no controlado.

La música deja de quedarse cargando indefinidamente. Si no se confirma el inicio en 15 segundos, se pausa el intento y se muestran readyState y networkState; el video conserva su sesión y su política de sonido. Pausar, cerrar, terminar y fallar cancelan la espera. El estado de música aparece también arriba de Biblioteca, cerca del botón que la envía, en lugar de depender de entrar en Control.

El aviso sobre FFmpeg es información general de conversión y no indica que un MP3 compatible necesite conversión. La ruta MP3 adicional continúa sirviendo el archivo original. El puente comprueba que la TV haya reportado la capacidad de música adicional antes de aceptar la orden: una TV anterior ya no la ignora silenciosamente.

El usuario confirmó 11.1.6 instalada y reproducción individual correcta. No contamos todavía con el estado del intento de música adicional en su TV. Estas diferencias de implementación son verificables; no se afirma haber determinado cuál ocasionó su fallo ni que el Samsung ya reproduzca ambos contenidos simultáneamente.

Validación: cinco pruebas de navegador para MP3 (incluyen carga explícita, rechazo de volumen y límite de espera), una prueba del panel con subida real del archivo y 72 Python correctas. ES5, build e integridad de widget/instalador verificados.

Instalador: `instaladores/AlmaTV-11.1.7-instalador.zip`. Actualizar la Mac y sincronizar la TV, comprobar 11.1.7 y recargar el controlador. Con el video de fondo activo, Biblioteca → Reproducir música sobre el fondo. Leer el estado sobre la biblioteca; si no inicia, esperar 15 segundos y copiar el diagnóstico de música. El respaldo estable 11.0.3 permanece intacto.

---

# Alma TV 11.1.6 · MP3 sobre el video de fondo

Biblioteca permite cargar archivos desde la laptop y añade «Reproducir música sobre el fondo» a los audios locales. La Mac sirve el archivo a un elemento HTML audio independiente; no se crea otro reproductor de YouTube. El video existente conserva su iframe, reproducción y posición. La música requiere un video abierto y no sustituye la selección principal ni modifica su cola.

Control incorpora Reproducir música, Pausar música, Silenciar música y Detener música. Mientras la música suena, el video queda silenciado. Al silenciar la música, pausarla, detenerla, terminar o fallar se restaura el sonido del video respetando Silencio general. Reactivar el sonido de la música vuelve a silenciar el video. El volumen web regula el nivel de reproducción; las teclas físicas siguen sin consumir eventos ni abrir módulos nativos. Cerrar o cambiar el video principal también cierra la música para evitar sesiones huérfanas.

Se admite música local cargada al puente o encontrada en Music/AlmaTV. La acción independiente solo la puede enviar el propietario; no admite enlaces arbitrarios, videos ni streams remotos. Los invitados conservan sus permisos de cola. La Mac debe permanecer encendida y conectada. La música adicional no entra automáticamente en repetición ni en la cola principal; se elige otro archivo desde Biblioteca.

El navegador de prueba decodifica un MP3 real y verifica alternancia de sonido, pausa/reanudación, navegación, salvapantallas, silencio general, error, fin y limpieza. Una prueba con el puente real carga el archivo desde el panel, lo reproduce con el video existente y comprueba los botones independientes. Las APIs del video están simuladas: el sonido y la combinación de decodificadores en el Samsung físico aún requieren validación.

Validación: 111 pruebas de navegador y 72 Python correctas; tras los últimos ajustes se repitieron seis pruebas de música/audio y la prueba de carga y control desde la laptop, todas correctas. ES5, build e integridad del widget/instalador verificados.

Instalador: `instaladores/AlmaTV-11.1.6-instalador.zip`. Actualizar Mac y TV, confirmar 11.1.6 y recargar el controlador. Reproducir primero un video como fondo; luego Biblioteca → cargar MP3 → Reproducir música sobre el fondo. Los controles separados están en Control → Música sobre el video de fondo. El respaldo estable 11.0.3 permanece intacto.

---

# Alma TV 11.1.5 · Retirar llamadas nativas compartidas por volumen y audio adicional

En 11.1.4 ambos desencadenantes reportados de salida llegan a releaseVolumeKeys: las teclas físicas lo llaman directamente; el inicio del segundo audio lo llama mediante scheduleVolumeRelease. Esa ruta abre AppCommon, desregistra teclas y cierra el objeto SEF, y se repite a los 500 ms. Es una causa candidata común para la regresión de cierre; no hay registro fatal del Samsung que confirme la llamada exacta que falla. Un fallo del plugin nativo no necesariamente produce una excepción JavaScript capturable.

11.1.5 elimina esos callbacks de reproducción, volumen web, foco y pulsaciones. Las teclas físicas retornan sin consumir el evento ni llamar plugins. Solo se solicita la cesión clásica una vez al iniciar la aplicación, sin abrir AppCommon. Se retira también la creación automática del objeto SEF añadida en 11.1.4. La sesión YouTube adicional y sus controles se conservan, para aislar esta variable de la prueba.

Una prueba instrumenta Open, Execute, Close y la ruta SEF de liberación, y exige cero llamadas al pulsar Vol+/Vol−/Silencio, iniciar los dos reproductores, ajustar el nivel y recuperar foco. Comprueba además que los eventos físicos no se cancelen y que no haya nuevas solicitudes de desregistro durante esos recorridos. Son pruebas simuladas: el cierre, el volumen físico, el sonido simultáneo y el encimado de imagen todavía requieren comprobación en el Samsung real.

Validación: 108 pruebas de navegador, 71 Python, ES5, build e integridad del widget y del instalador correctos.

Instalador: `instaladores/AlmaTV-11.1.5-instalador.zip`. Actualizar la Mac, sincronizar en la TV, confirmar 11.1.5 y recargar el controlador. Probar primero el volumen físico con un solo video, después el audio adicional. La versión estable 11.0.3 y su respaldo siguen intactos.

---

# Alma TV 11.1.4 · Liberación de teclas Samsung y nivel del audio adicional

Se conecta la liberación de Vol+, Vol− y Silencio por AppCommon.UnregisterKey, además de Common.API.Plugin. La ruta AppCommon ahora crea su objeto SEF cuando todavía no existe; no abre Audio ni registra teclas. Se intenta también cuando falta la API clásica o falla su carga.

El audio adicional recibe el volumen y el silencio actuales antes de crearse, los aplica al recibir Ready, al empezar y una vez más a los 500 ms. El último intento se cancela al cerrar o reemplazar la sesión. Se conservan las preferencias de silencio del usuario. El estado informa tiempo, volumen y silencio reportados por YouTube: no afirma que haya sonido real por recibir estado 1.

El propietario observó arranque intermitente, imágenes superpuestas y ausencia de sonido en 11.1.3. Los cambios de 11.1.4 corrigen omisiones concretas, pero la liberación física de teclas, la mezcla audible y la composición de imagen en Samsung siguen pendientes de validación en su televisor. No se afirma haber solucionado el encimado ni compatibilidad con dos decodificadores.

Validación: ES5, build e integridad de widget/instalador correctos; 71 pruebas Python. La regresión verificó 107 escenarios de navegador; la prueba nueva de nivel antes de cargar pasó al ajustar su espera hasta la carga efectiva del reproductor. Se validan llamadas y estados simulados, no sonido físico.

Instalador: `instaladores/AlmaTV-11.1.4-instalador.zip`. Actualizar la Mac, sincronizar en la TV y recargar el control web. Probar primero Vol+/Vol− del control físico con un solo video. La versión estable 11.0.3 y la recuperación local permanecen intactas.

---

# Alma TV 11.1.3 · Volumen y API compartida para el audio experimental

Las teclas físicas Vol+, Vol− y Silencio quedan a cargo de Samsung. Se retira la activación del mezclador nativo desde Configuración y se liberan las teclas después de iniciar reproducción o ajustar el audio web. El deslizador web envía el valor final también cuando el navegador solo entrega `change`; cada orden aplica explícitamente el volumen solicitado a YouTube.

El audio adicional usa ahora la API de YouTube ya cargada por el video principal, dentro del mismo documento del puente. Se elimina la segunda carga exterior de la API que quedaba esperando Ready. Conserva pausa, reproducción y cierre independientes, autenticación de mensajes por origen, token y sesión, y recuperación del sonido principal ante un error. La reproducción simultánea y las teclas físicas requieren validación en el Samsung real; las pruebas de navegador no confirman compatibilidad del hardware.

Validación: ES5 y build correctos; 71 pruebas Python y la regresión de navegador completas sin errores. Las pruebas incluyen volumen web en ambas direcciones, teclas físicas sin captura y control independiente del audio adicional.

Instalador: `instaladores/AlmaTV-11.1.3-instalador.zip`. Actualizar la Mac, sincronizar en la TV y recargar el control web. La versión estable 11.0.3 y su recuperación permanecen intactas.

---

# Alma TV 11.1.2 · Control de audio experimental y reproducción en Inicio

El control web incorpora Reproducir audio experimental, Pausar audio experimental y Detener audio adicional. Estos botones controlan solo la segunda sesión; el principal conserva su reproducción y permanece silenciado hasta detener el audio adicional. Reproducir permite reintentar el último enlace si la sesión falló. Una pausa solicitada durante la carga impide el inicio automático hasta pulsar Reproducir.

Se cambia la secuencia de inicialización: el segundo YT.Player se construye vacío, sin videoId. Después de Ready se ocultan su superficie y su iframe exterior, y solo entonces se envía loadVideoById. Así se evita cargar una señal en el recuadro de inicialización. Este cambio responde al recuadro y fondo negro observados en el Samsung; la solución de reproducción simultánea sigue pendiente de comprobación física y no se da por confirmada con pruebas simuladas.

Reproducir en Inicio está disponible para el contenido actual, para enviar enlaces de YouTube y por cada canal de la guía. El contenido actual conserva su sesión; se reduce pantalla completa y vuelve al menú. En la guía, la orden selecciona directamente el canal y abre Inicio, sin pasar por la pantalla de Alma Live. Las órdenes de selección pendientes se reemplazan por la última para evitar que una selección anterior vuelva a abrir el reproductor.

Validación: regresión de 107 pruebas de interfaz y 71 Python; tras ajustar la ocultación final se repitieron seis pruebas de audio y dos del control web, todas correctas. Incluyen pausa/reanudación independiente, iframe vacío hasta Ready, ocultación antes de cargar, prioridad de sonido y reproducción de canales en Inicio desde celular. ES5, build y paquetes verificados.

Instalador: `instaladores/AlmaTV-11.1.2-instalador.zip`. Requiere actualizar la Mac, sincronizar aplicaciones en la TV, comprobar 11.1.2 experimental en Configuración y recargar la página del control. La 11.0.3 estable y su recuperación local permanecen intactas.

---

# Alma TV 11.1.1 · Corrección del arranque del audio adicional

La 11.1.0 podía iniciar el segundo iframe fuera de pantalla, dentro de la capa escalada del menú, y ocultar su superficie antes de recibir Ready. La corrección lo mueve al body, sin transformación, con un área de 384×240 y dentro del viewport. El principal se mantiene por encima y conserva la única imagen visible. Al iniciar el audio adicional se vuelve a Inicio sin cambiar el video principal. El segundo iframe permanece renderizable y no recibe una orden prematura de ocultarse.

Esto corrige un problema de inicialización del código. Se reproduce en una prueba que no entrega Ready si el iframe nace fuera del viewport, escalado o demasiado pequeño. El rendimiento y la reproducción simultánea reales todavía deben comprobarse en el Samsung físico; no se afirma compatibilidad física por pasar pruebas simuladas.

El error de tiempo de espera ahora muestra el último paso: conexión al puente, carga de la API o creación del reproductor. El puente marca únicamente la sesión adicional para esos mensajes; la sesión principal conserva su configuración anterior.

Validación final: 105 pruebas de interfaz y 70 de Python pasaron, además de ES5, build y verificación de integridad de widget/instalador. La rama y el instalador estable 11.0.3 siguen intactos. Se conserva la recuperación local verificada antes de instalar el experimento.

Instalar `instaladores/AlmaTV-11.1.1-instalador.zip` en la Mac y sincronizar aplicaciones de usuario en la TV. Comprobar Configuración → 11.1.1 experimental antes de repetir la prueba: primer YouTube como video de fondo; segundo enlace en «Audio en segundo plano · experimental».

---

# Alma TV 11.1.0 · Prueba experimental de audio dual

La versión estable sigue siendo 11.0.3, commit `4e1f373a80a8d257d5968188526eca56cca2f4d1`, en `alma-tv/11.0` y `backup/alma-tv-11.0.3`. Esta prueba vive exclusivamente en `alma-tv/experimental-audio-dual` y no sustituye la rama estable.

La prueba está apagada al abrir la app. Primero reproduce un YouTube como fondo. En el control web, envía otro enlace y selecciona «Audio en segundo plano · experimental». Antes de crear el segundo reproductor, la TV debe confirmar que el principal está silenciado. La imagen del principal continúa; solo se oye el adicional. El volumen y Silencio regulan el audio adicional. Detener audio adicional cierra esa sesión y recupera el audio normal del principal. Detener todo, cambiar el video principal o abrir una app nativa libera el segundo reproductor. Navegar y abrir el salvapantallas conservan la sesión.

La segunda sesión usa otro iframe oficial, token y receptor de mensajes independientes. No descarga ni extrae audio. Aunque solo se oiga el audio, YouTube puede seguir procesando el video: la capacidad real de Samsung Orsay para dos sesiones requiere una prueba física. Un fallo informado o el fin del segundo video cierra la prueba y restaura el audio del principal. Si no se confirma el silencio en cinco segundos, no se abre el segundo. No se guarda una preferencia que vuelva a activarlo al reiniciar.

## Respaldo y recuperación

Antes de tocar el puente, el instalador experimental descarga y verifica el instalador estable 11.0.3 (SHA-256 `fa00f93c5c3ab7e5fb7d7087d2c580fbf871f7f5ebe76a69d3acf02027098576`) en `~/Library/Application Support/AlmaTV/rollback`. Si no logra verificarlo, no instala el experimento. La copia local permite recuperar sin depender de que la app experimental responda.

Para volver a la estable desde Terminal de la Mac:

```sh
python3 "$HOME/Library/Application Support/AlmaTV/rollback/restaurar_estable_mac.py"
```

Se abre el instalador original de 11.0.3. Elige instalar/actualizar y vuelve a sincronizar aplicaciones de usuario en la TV con la IP mostrada. También puedes abrir de nuevo el instalador experimental y elegir «Restaurar versión estable 11.0.3». La restauración recupera puente y widget, conserva los archivos de datos y permite mantener la foto de perfil. La reinstalación y decodificación en firmware físico quedan pendientes de confirmar.

## Validación

Pasaron 104 pruebas de interfaz y 69 Python, ES5 y build. Se verificaron dos sesiones independientes, silencio confirmado antes de arrancar, control de volumen, aislamiento de mensajes, errores, restauración del audio, cierre de ambos, propietario exclusivo y conservación de la cola/video principal. Se descargó y verificó el respaldo real de 11.0.3; la recuperación se ensayó con paquetes y ejecución simulada del instalador. Las pruebas Samsung/YouTube son simuladas y no prueban rendimiento ni reproducción dual física.

Instalador de prueba: `instaladores/AlmaTV-11.1.0-instalador.zip`.

---

# Alma TV 11.0.3 · Apps y navegación simplificadas

La cuadrícula se abre sin título ni subtítulo. Reloj, Temporizador, Calendario, Clima y Salvapantallas son tarjetas de apps con iconos originales inspirados en la estética de Apple; Conexión y Multimedia también conservan acceso como apps. Alma Live tiene un icono propio de TV, sin usar el logo de Apple ni lanzar la TV nativa.

El dock muestra cinco apps completas por ventana. Desde la primera fila de la cuadrícula, Arriba vuelve al dock; desde las filas inferiores, Arriba primero recorre las filas. Atrás también permite volver. La barra superior contiene solo Inicio, Buscar, Apps, Pantalla completa, Salvapantallas y Configuración. Navegar entre las utilidades no cierra la sesión de reproducción.

Se conservan el halo azul tenue, la imagen original, el perfil local y las listas activas/favoritos independientes del control 11.0.2. El instalador permite mantener la foto anterior cancelando la selección. Validación: 99 pruebas de interfaz y 66 Python pasaron; ES5, build e integridad del instalador correctos. Las API Samsung/YouTube se simulan; el firmware físico queda por comprobar.

Instalador: `instaladores/AlmaTV-11.0.3-instalador.zip`. Capturas locales: `docs/capturas/alma11-03-apps.png` y `docs/capturas/alma11-03-inicio.png`. Tras instalar en la Mac, sincronizar aplicaciones de usuario en la TV.

---

# Control 11.0.2 · Listas activas y favoritos independientes

En Importar y organizar canales → Mis listas M3U, cada lista tiene Activar lista / Desactivar lista. Desactivar excluye sus canales normales de la guía y del catálogo enviado a la TV; conserva la lista descargada, favoritos y categorías. Los favoritos siguen disponibles aunque todas sus listas de origen estén desactivadas. Reactivar no descarga de nuevo. Actualizar una lista desactivada conserva ese estado. No se detiene la reproducción actual. Las listas anteriores se migran como activas.

La primera importación aún descarga la lista completa del proveedor. Para conexiones lentas se amplía la espera de conexión/cabeceras de 12 a 60 segundos solo en las importaciones, dentro del presupuesto de tres minutos. Se conservan la comprobación TLS, el bloqueo de destinos privados, los puertos personalizados y la lista anterior ante fallos. Esto no garantiza la respuesta ni la disponibilidad del proveedor.

Instalador ligero: `instaladores/AlmaTV-Control-11.0.2.zip`; ejecutar `python3 actualizar_control_mac.py` en la Mac, sin sudo, y recargar /control. Actualiza exclusivamente los módulos del puente y el panel, con respaldo y restauración ante fallo. No modifica datos ni el widget 11.0.1 y no requiere sincronizar aplicaciones en la TV.

Validación: 66 pruebas Python y 13 pruebas web con puente HTTP real pasaron; las API Samsung y las señales se simulan. Incluye desactivar/reactivar, favorito y categoría independientes, continuidad del reproductor, actualización de lista inactiva, persistencia y timeout sin pérdida de datos.

---

# Alma TV 11.0.1 · Navegación y arranque

Inicio con una sola fila inferior de apps y un máximo de seis visibles completas, logotipos sin títulos y selector con colores de marca conservados. Abajo abre la biblioteca completa; Volver regresa al dock. Las utilidades siguen disponibles en la biblioteca y en la barra superior. Arriba desde el dock sube a la barra superior; izquierda/derecha se mantienen en la fila actual. Pantalla completa se abre desde su botón en la barra o el reproductor; Volver la reduce.

TV en vivo tiene una vista previa 16:9 a la izquierda y categorías en dos columnas a la derecha, sin anuncios. Todos los canales y favoritos conservan sus filtros, organización y paginación. Elegir un canal lo reproduce en la vista previa. «Reproducir en el inicio» vuelve al dock usando la misma sesión como fondo; no inicia una segunda reproducción. La barra superior sigue visible al navegar con contenido. El salvapantallas conserva su comportamiento anterior.

La fila inferior queda más cerca del borde inferior y se retira la leyenda de teclas. El foco usa un halo azul rey tenue, sin marco blanco. La marca Alma TV se muestra solo en Ajustes. El reloj incorpora un perfil circular: el instalador permite elegir un JPG/PNG local y lo incorpora a la copia del widget en la Mac, sin subir la foto al repositorio. La foto anterior se conserva para futuras actualizaciones.

La imagen local existente (`app/assets/salvapantallas.png`) se conserva byte por byte y vuelve al detener el video. No se cambian las preferencias ni las claves del almacenamiento local. No se añaden controles rápidos. Navegador, biblioteca y TV en vivo usan logotipos propios; «ALMA LIVE» identifica las listas y canales internos. El acceso que salía a Smart Hub se retiró de la barra. Las opciones de la barra muestran su nombre al enfocarlas. El menú se inicializa al terminar su HTML, sin esperar al evento de carga de imágenes, y la inicialización está protegida contra llamadas duplicadas. La mejora de tiempo en firmware físico sigue pendiente de medición.

Respaldo anterior: rama local `backup/alma-tv-pre-11`, commit `ac36516e74f9869ed27e6ef927302de9d57462c6` (widget 10.3.0 y control 10.3.6). Los instaladores previos se conservan. Desarrollo 11.0 en `alma-tv/11.0`; sin instalar en la TV.

Validación local: `npm ci`, `npm run check`, `npm run build`, `npm run test:package`, `npm run test:ui`. Las pruebas Samsung/YouTube simulan sus API; el transporte real local usa MP4 de prueba. Es necesario verificar decodificación HLS, capas del reproductor y navegación en el Samsung físico antes de dar por validada la instalación en TV.

---

# Alma TV · Control 10.3.6: listas grandes y lentas

La importación admite hasta **64 MB y 200 000 entradas por lista**, con **tres minutos de descarga**; el panel espera hasta cuatro minutos para recibir el resultado. Tamaño, tiempo total y falta de datos del proveedor muestran errores separados. Una importación fallida mantiene la lista anterior. Se comprueba que una descarga de más de un minuto aún puede completarse. La corrección pasó 61 pruebas Python y tres pruebas de importación/guía con puente HTTP real; no se descargó la cuenta del usuario. Estos límites son de la Mac: no cambian el catálogo máximo de 504 entradas del widget ni su espera de 60 segundos por señal.

La descarga de listas M3U admite puertos personalizados HTTP/HTTPS (1–65535), incluidos 8880 y 25461, y conserva los parámetros del enlace `get.php`. El puerto se aplica tanto a la conexión como a la cabecera Host; HTTPS mantiene SNI y validación del certificado del proveedor. Cada salto de redirección vuelve a validar el destino público. Se siguen rechazando direcciones privadas, puertos inválidos y credenciales insertadas antes del dominio. La opción se activa solo para importar/actualizar listas; otras fuentes del puente mantienen su validación anterior. Las pruebas usan credenciales ficticias; no se contactaron las cuentas facilitadas por el usuario. Pasaron 59 pruebas Python. En el panel pasaron 11 pruebas y se repitió correctamente la prueba de transporte MP4 tras corregir la espera del catálogo inicial en su fixture.

El lector acepta listas de canales que comienzan directamente con `#EXTINF:-1` o `#EXTINF:0`, aunque no tengan cabecera inicial `#EXTM3U`. Se conserva el rechazo de manifiestos HLS y documentos HTML. El archivo público TELEVISION2 de PABLOPOM/m3u se procesó como referencia: 270 canales aceptados y 14 entradas omitidas al consultar el archivo, sin probar las señales. El mensaje de filtro sin coincidencias aclara que la guía completa sigue disponible. Pasaron las diez pruebas de IPTV y cuatro del actualizador para esta corrección.

En **Guía de TV → Lista de canales**, **Todas las listas** es la opción inicial. El selector también permite elegir una lista importada o los cuatro canales incluidos; se combinan lista, categoría, favoritos y búsqueda sin cambiar los filtros de importación ni interrumpir la reproducción. Una señal presente en dos listas aparece en ambas y comparte su favorito/categoría. Los eliminados siguen ocultos.

La guía consulta en la Mac los canales de todas las listas guardadas, incluso si quedaron fuera del catálogo limitado del widget. Los resultados llegan en páginas de 20; el catálogo enviado a la TV sigue teniendo como máximo 504 entradas. Al seleccionar una señal que aún no está en la TV, el puente la incorpora al catálogo antes de enviar la orden de reproducción. Cambiar de lista solo filtra la guía; no publica ni descarga de nuevo una lista. La página abre otra vez en Todas las listas al recargar.

**No hace falta sincronizar la TV:** el widget sigue en 10.3.0. Esta actualización copia el panel y tres módulos del puente en la Mac y reinicia únicamente su LaunchAgent. Conserva `iptv.json`, `hub.json`, favoritos, categorías, sesiones, medios y configuración. Los archivos anteriores se respaldan y un fallo al reemplazar módulos restaura los ya reemplazados.

Descomprime `instaladores/AlmaTV-Control-10.3.6.zip` y ejecuta `python3 actualizar_control_mac.py` sin sudo. Tras el reinicio del puente espera unos segundos y recarga `http://192.168.1.30:8088/control`. Puedes cerrar Terminal. Requiere tener el puente 10.3.0 instalado con inicio automático. `python3 crear_actualizacion_control.py` genera el paquete para el control y los módulos necesarios.

Las categorías siguen siendo manuales y se pueden asignar desde la propia guía. Se mantiene la separación de **Importar canales** para gestionar listas, búsqueda, eliminación y restauración. No se inventan horarios de programas: las M3U no incluyen una guía XMLTV. Capturas locales de prueba: [selector de lista en celular](docs/capturas/49-guia-selector-listas-celular-prueba.png) y [lista y categoría en laptop](docs/capturas/50-guia-selector-listas-laptop-prueba.png).

Validación: pasaron 52 pruebas Python y 91 pruebas de interfaz en la ejecución completa. Después se comprobaron nueve pruebas de IPTV y cuatro del actualizador, incluidas restauración ante fallo y reinicio exclusivo del puente; se repitieron las dos pruebas de guía/listas tras los ajustes finales. Las API Samsung/YouTube se simulan; la selección se transmite por el puente HTTP real, y el firmware físico queda pendiente de confirmar.

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
