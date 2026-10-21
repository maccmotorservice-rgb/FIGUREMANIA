# Validación de Alma TV 7.2

Ejecutado en Codex Cloud Linux: Node 24.19.0, npm 11.9.0, Python 3.12.14, Chromium 154 y Playwright 1.64.1. Se comprueba además gramática Python 3.8. El propietario construyó e instaló versiones anteriores en su Mac y TV; **7.2 necesita comprobación física**.

| Comprobación | Resultado |
|---|---|
| Sintaxis JS | `node --check` y parseo ES5 estricto de todos los JS de app: correctos |
| Sintaxis Python | Gramática 3.8 para scripts de instalación, preview, puente y tests: correcta |
| Tests de interfaz/reproducción | **25 aprobados** |
| Tests de empaquetado/servidor | **18 aprobados** |
| Idioma | Tildes y ñ en textos y entrada física; recursos HTML/CSS/JS de distribución ASCII seguros que mantienen los caracteres al mostrarlos |
| Encuadre | Fondo cubre 1280×720, 1920×1080 y 960×540; escala/X/Y siguen protegiendo los controles |
| Marco | Opción exclusiva del salvapantallas, persistente, sin alterar el fondo del tema; ambas variantes capturadas |
| Movimiento | Transición de página, foco y confirmación; movimiento reducido; acciones y teclas no esperan el fin de la animación |
| Carrusel | Tarjetas grandes, desplazamiento horizontal con foco visible y encabezados personalizados; colores de marca en Inicio/cuadrícula |
| Audio | MP3 real: decodificación, avance de currentTime, pausa, salto, parada y continuidad entre vistas; al abrir YouTube se pausa |
| Video | MP4 H.264 real: decodificación y pausa; no se simula su progreso |
| Biblioteca de la Mac | HTTP real, tipos, nombres con tildes, respuestas 206/Content-Range, rechazo de intervalos inválidos y rutas/symlinks externos |
| Respaldos | 7.0 y 7.1 conservados sin recomprimir; base 6.0 preservada |
| TV física / códecs / HDMI 2 | Pendientes; pruebas de navegador no certifican el firmware |

Las pruebas usan `.preview/app` extraído del ZIP generado: se comprueban los mismos bytes seguros que recibe la TV. `preview.py` y el puente comparten el transmisor HTTP Range. Se diagnosticó que un servidor estático sin Range podía decodificar MP3 pero reiniciaba la posición al adelantar; el test exige un salto real de reproducción después de corregir el servidor, sin reemplazarlo por un contador.

Las 25 pruebas de navegador incluyen los 15 recorridos anteriores (navegación, DIAL, temporizador, calendario, persistencia, calibración, errores, foco, Xbox, clima y reposo) y los nuevos recorridos de pantalla completa, marco, animaciones, entrada en español, carrusel/encabezados, audio, lista multimedia, video pausa al abrir app nativa y degradación explícita cuando el firmware no ofrece reproducción HTML5. Los screenshots esperan imágenes cargadas y capturan el estado final de las transiciones, sin modificar el movimiento de la aplicación en uso normal.

Las 18 pruebas Python incluyen identidad, formatos Orsay, reproducibilidad, recursos y rutas, respaldos, IPv4 privada, servidor instalador, puente/CORS/errores/caché, importador de imagen, codificación de español y streaming de archivos con rangos. No se exponen rutas arbitrarias de la Mac.

Las respuestas DIAL, API de fuentes HDMI y proveedor meteorológico son de prueba únicamente dentro de los tests. No se contacta la TV desde esta nube. La muestra MP3 sí es audio real original; el MP4 de patrón está solo en tests, fuera del widget. No hay un catálogo musical de demostración que se presente como Spotify.

Clima real desde nube: el proxy bloqueó previamente al proveedor con 403; debe comprobarse en Mac. La selección HDMI 2 sigue dependiendo de la API que exponga el firmware. Los mensajes editoriales de plataformas son textos solicitados por el propietario, no evidencia de derechos, programación o suscripciones.
