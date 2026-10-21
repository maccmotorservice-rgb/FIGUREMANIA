# Validación de Alma TV 7.1

Ejecutado en Linux Codex Cloud: Node 24.19.0, npm 11.9.0, Python 3.12.14, Chromium 154, Playwright 1.64.1. Todos los scripts Python se comprueban también con gramática 3.8. El propietario ya construyó, sirvió e instaló 7.0 en su Mac/TV y comunicó que la TV en general sigue siendo lenta; no se presenta 7.1 como reparación del sistema.

| Comprobación | Resultado |
|---|---|
| `npm run check` | `node --check` y parser ES5 estricto de todos los JS de app: correctos |
| `npm run build` | Paquete AlmaTV71 7.1.0 y catálogos de respaldo, sin contactar TV |
| `npm run test:package` | **13 pruebas aprobadas** |
| `npm run test:ui` | **15 pruebas aprobadas**, sin errores JS |
| Navegación y composición | Menú lateral, tema claro, vistas distintas, 1280×720, zonas seguras 3/5/8 %, foco y scroll |
| Rendimiento del widget | Con hora fija, cero mutaciones DOM en reposo; mover foco no reconstruye tarjetas; sin medición física de FPS/RAM |
| Salvapantallas | PNG original 1672×941, SHA-256 intacto; hora, fecha con año, ciudad y clima se mueven juntos; fondo del bloque transparente |
| Logotipos | PNG locales a partir de fuentes vectoriales conservadas; licencias incluidas; las capturas esperan a que las imágenes estén cargadas |
| Xbox / HDMI 2 | API de prueba enumera HDMI1, AV2 y HDMI2; se elige solo HDMI2; fallos por API ausente o fuente no encontrada no se presentan como éxito |
| Clima | Códigos WMO y día/noche del proveedor; Sin datos ante fallo. Puente del clima no desvía DIAL directo |
| Respaldo 7.0 | ZIP exacto SHA-256 `8de13daa70f719364c5e6a5cb966f53c73366b9b8e29424a9a9a35c47a24e9c3`; regenerar catálogo no modifica sus bytes |
| Clima real desde nube | Consulta previa a proveedor bloqueada por proxy 403; validar desde Mac |
| API Samsung/documentación desde nube | Consulta a documentación bloqueada 403; detección de funciones en runtime y pruebas no prueban soporte del firmware |
| Instalación y HDMI 2 físicos de 7.1 | **No ejecutados**; validación en Mac/TV pendiente del propietario |

Las 15 pruebas UI cubren los 11 recorridos previos (vistas, DIAL, temporizador, calendario/reloj móvil, búsqueda/enlaces, IP/restauración, calibración, diagnóstico/error, clima, foco y scroll), más selección HDMI 2 con degradación explícita, mutaciones en reposo/foco, salvapantallas con datos completos e icono, e independencia de puente meteorológico y DIAL directo.

Las 13 pruebas Python cubren identidad/rutas/widget.info/CRC/SHA y determinismo, rechazo de paquetes inválidos, respaldo 6.0 exacto, respaldo 7.0 instalado exacto y catálogos reconfigurables, IPv4 privada, servidor instalador HTTP real, puente HTTP/CORS/rutas/opt-in/errores, parser/cache de proveedor, rechazo de redirecciones e importación/preservación/rechazo de imágenes.

Los tests DIAL, fuentes HDMI, APIs Samsung y proveedor usan sustituciones **solo en tests**. No hay datos de prueba en el widget. La captura `17-salvapantallas-clima-respuesta-de-prueba` contiene deliberadamente un proveedor de prueba y no demuestra una temperatura real. La captura normal de salvapantallas muestra Sin datos cuando no hay puente.

La simulación temporal se instala antes de cargar los intervalos de la app; el test no modifica el estado interno del temporizador. El preview se inicia si falta y sus procesos se cierran al terminar. La versión 7.0 de respaldo y las imágenes anteriores se preservan para comparación. No se ejecutan pruebas del motor FIGUREMANIA porque no se ha modificado ese proyecto.
