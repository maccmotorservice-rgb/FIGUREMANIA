# Compatibilidad y límites

| Función | Implementación | Evidencia / pendiente |
|---|---|---|
| HTML/CSS/JS local 1280×720 | ES5, posiciones/fila inline-block, transform prefijado | Parseo ES5 y Chromium; WebKit físico pendiente |
| Netflix/YouTube nativos | POST `/ws/app/Netflix` y `/YouTube`, 8080 | Rutas físicamente confirmadas por el propietario antes; esta versión solo probada con transportes de prueba |
| Estado DIAL | GET individual, HTTP + state XML | Flujo, fallos y timeout probados; comprobación desde Mac pendiente |
| Navegador Samsung | `Common.API.Widget.runWebBrowser` | Llamada probada con API de prueba; propietario la había confirmado antes; los servicios web modernos pueden rechazar este navegador |
| EXIT/ready | sendExitEvent/sendReadyEvent | Integración probada con stub; comportamiento físico pendiente |
| Prime Video | Estado «Por probar» | Sin acceso nativo confirmado; no se anuncia funcional |
| Herramientas locales | Date, temporizador, calendario | Pruebas reales del comportamiento en Chromium, incluidos tiempo y persistencia |
| Salvapantallas personalizado | JPG/PNG local + reloj móvil | Imagen original 1672×941 incorporada sin modificar; carga y movimiento de reloj comprobados en Chromium |
| Calibración | Escala 76–100 %, X/Y, presets | Geometría y capturas 3/5/8 % por borde; ajuste físico pendiente |
| Clima | Open-Meteo vía Mac | Parser, cache, HTTP, errores y UI probados con respuestas de prueba. Consulta al proveedor desde nube bloqueada con 403 del proxy; validar en Mac |
| Instalación Wi-Fi | HTTP 80 + XML/ZIP Orsay | Integridad, identidad y servicio HTTP probados; sincronización física pendiente de decisión del usuario |
| Python en Mac | stdlib, sintaxis 3.8 compatible | Ejecutado en Python disponible en nube; no se ejecutó macOS 3.8.9 real |
| Almacenamiento | Clave `alma.orsay.v7` localStorage | Reutiliza guardados de esta versión; no importa datos privados de Netflix ni de otras apps |
| Smart Hub / Home | Sistema Samsung intacto | Alma TV es un widget; no sustituye HOME ni limpia paquetes Android |

Las IP privadas solo tienen sentido en la red local del propietario; no se envían comandos desde la nube. Los tests interceptan esas rutas antes de cualquier petición. Un PID, un puerto abierto o un HTTP simulado no son evidencia de que una app se abrió físicamente.

El reloj depende de la hora del televisor. El temporizador sigue funcionando al cambiar de vista dentro de Alma TV; se pierde al cerrar el widget. No hay tareas en segundo plano mientras Netflix/YouTube usan el sistema. El clima necesita la Mac despierta y conectada; la app no implementa TLS moderno dentro de Orsay.

El estado del encabezado es DIAL, no una lectura de la interfaz Wi-Fi. No se dibuja un icono que asegure señal Wi-Fi ni acceso a internet sin evidencia. No se usan plugins Samsung desconocidos para inventar ese dato.

La ilustración de salvapantallas se recibió finalmente como PNG dentro de un ZIP. Se conserva exactamente, con SHA-256 registrado en docs/IMAGEN_USUARIO.json; no se genera una imitación ni se presume permiso de redistribución pública. El arte y los nombres se mantienen para el uso del propietario; revisa derechos antes de publicar un paquete públicamente.

Los servidores son HTTP dentro de la LAN: no los expongas mediante port forwarding, túneles ni redes públicas. El puente solo permite YouTube/Netflix a una TV fija, rechaza redirecciones DIAL y POST requiere `--allow-launch`. No usa root, firmware, menú de servicio, ADB ni cambios de sistema. No realiza limpieza de Smart Hub.
