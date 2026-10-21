# Validación de Alma TV 7.0

Entorno de ejecución: Linux de Codex Cloud, Node 24.19.0, npm 11.9.0, Python 3.12.14, Chromium 154 del sistema, Playwright 1.64.1. No se ejecutaron macOS, Python 3.8.9 ni el WebKit de la TV. Se comprobó además la gramática de todos los scripts Python con `ast.parse(feature_version=(3,8))`.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm ci --cache /tmp/figuremania-npm-cache --no-audit --no-fund` | Instalación congelada desde lockfile, correcta |
| `npm run check` | `node --check` y parseo **ECMAScript 5 estricto** de todos los JS de app, correctos |
| `npm run build` | ZIP y XML actual + respaldo 6.0, sin contactar TV |
| `npm run test:package` | **12 pruebas aprobadas**: identidad/rutas/widget.info/CRC/SHA, determinismo, respaldo byte a byte, IP privadas, servidor HTTP real, puente/rutas/CORS/opt-in, errores, proveedor/cache e importador de imagen |
| `npm run test:ui` | **11 pruebas aprobadas** en Chromium, sin errores JS |
| Configuración visual | Capturas 1280×720, presets 3 %, 5 %, 8 % por borde, bounds horizontales y verticales de paneles comprobados |
| Imagen de salvapantallas | PNG original 1672×941, bytes conservados y SHA-256 registrado en IMAGEN_USUARIO.json, carga real en navegador y reloj móvil comprobados |
| Consulta real Open-Meteo desde esta nube | Bloqueada por proxy: tunnel 403; no se presenta como éxito |
| Netflix/YouTube en TV física | **No ejecutado**; requiere Mac y autorización del propietario |
| Sincronización Orsay Wi-Fi | **No ejecutada**; paquete/servidor preparados y probados en loopback |

Las 11 pruebas UI verifican: vistas diferenciadas con códigos Samsung, pila RETURN y APIs Orsay; un POST por activación con deduplicación mientras está pendiente; Prime no confirmado; temporizador iniciar/pausar/reanudar/reiniciar/vencer; cambio de mes y reloj móvil; búsqueda/enlaces persistidos; IP inválidas y restauración con cancelar; calibración guardada/cancelada y geometría; GET de ambos DIAL y mensajes de fallo; clima solo con respuesta válida y Sin datos ante error; foco único en recorridos de todas las vistas; desplazamiento correcto hacia resultados fuera del área visible.

El tiempo simulado se instala antes de cargar la aplicación para controlar el intervalo real del temporizador. No se acelera mediante modificar su estado interno. DIAL, APIs Samsung y proveedor meteorológico son sustituidos únicamente en las pruebas: las respuestas de prueba no se incluyen en `app/` ni en el ZIP del widget. Se capturó también la versión original 6.0 con sus peticiones privadas bloqueadas en el navegador de pruebas.

Se ejercitó el autoarranque del servidor de pruebas sin un preview preexistente. Los servidores creados por tests se cierran al terminar. Se comprobó que el repositorio anterior no tiene modificaciones versionadas: solo existe la carpeta nueva AlmaTV-Orsay en la rama alma-tv/orsay.

No se reejecutan simulaciones del motor FIGUREMANIA ni pruebas Android, que no corresponden a este proyecto. La siguiente validación útil es física y está descrita en PRUEBA_TV.md, después de revisar las capturas.
