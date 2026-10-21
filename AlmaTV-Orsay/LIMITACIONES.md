# Compatibilidad y límites · 7.1

| Función | Evidencia y límites |
|---|---|
| Tema claro, menú lateral, navegación | Probados en Chromium 1280×720 con 3/5/8 % de zona segura; nuevo diseño pendiente de comprobar en WebKit físico |
| Netflix/YouTube nativos | Mismas rutas DIAL del proyecto anterior; el propietario instaló 7.0 y comunicó mejora. En nube se prueban solicitudes y errores con respuestas de prueba, sin contactar su TV |
| Disney+ / Prime Video | El propietario informa que faltan en su Orsay; este widget no añade soporte nativo, DRM ni reproductores. Usar app oficial de una Xbox u otro dispositivo compatible si está disponible para su modelo/región |
| Apple TV / Max | Logotipos y ficha de compatibilidad; ninguna integración nativa verificada. No son reproductores funcionales |
| Xbox · HDMI 2 | Detección de API `webapis.tv.window`, enumeración y elección del descriptor HDMI 2; probado con API de prueba. Falta validar en firmware real. Si no existe la API, muestra SOURCE → HDMI 2. No envía números de fuente adivinados, no enciende Xbox ni abre sus apps |
| TV / Smart Hub | Sale del widget con la API existente; no promete sintonizar directamente TV en vivo |
| Navegador | Usa `Common.API.Widget.runWebBrowser`, previamente confirmado por el propietario; sitios actuales pueden rechazar el WebKit antiguo |
| Clima | Open-Meteo por puente Mac; datos, código WMO y día/noche reales cuando están disponibles, con observación y atribución. Sin proveedor muestra Sin datos. Consulta real en nube recibió 403 del proxy; probar desde Mac |
| Ubicación del salvapantallas | Ciudad configurada por el usuario, Tuxtla Gutiérrez, Chiapas, México. No se presenta como localización GPS |
| Salvapantallas | PNG original intacto; hora, fecha completa, ciudad e icono de clima se mueven como grupo sin recuadro negro; probado en Chromium |
| Rendimiento | Sin escrituras repetidas de textos invariables en reposo y sin reconstruir tarjetas al mover foco; no equivale a medir CPU/FPS/RAM de la TV ni a acelerar todo Smart Hub |
| Temporizador | Sigue al cambiar de vista dentro del widget; no se ejecuta en segundo plano después de salir o al usar otra app |
| Instalación Wi-Fi | ZIP, XML, identidad, servidor y rollback probados localmente; sincronización 7.1 física pendiente de decisión del usuario |
| Python macOS | Sintaxis 3.8 compatible, stdlib; ejecutado en Linux Python 3.12.14. El propietario ya construyó y sirvió la versión 7.0 en su Mac |
| Almacenamiento | Conserva la clave `alma.orsay.v7`; distintos IDs de widget pueden tener almacenamiento separado. Comprobar calibración e IP al instalar 7.1 |

No hay acceso al historial privado de Netflix, búsquedas de otros servicios o anuncios personalizados. Inicio usa la imagen del propietario y muestra solo sus enlaces. No se generan temperaturas, películas ni progresos de reproducción ficticios.

El encabezado indica disponibilidad DIAL, no intensidad Wi-Fi ni acceso a internet. No se muestran RAM libre, limpieza o estado de consola inventados.

Los logotipos son identificadores locales con sus fuentes y licencias incluidas; no prueban compatibilidad ni afiliación. No se copia código de CleanYourTV. Su limpieza Android/ADB no sirve para este Samsung Orsay.

El puente es HTTP para LAN de confianza, no un servicio para internet. Relay DIAL es independiente de clima y está desactivado por defecto. No se abren puertos del router ni se ejecutan comandos en la TV desde la nube.

No se eliminan componentes de Samsung, se cambia firmware, se usa un menú de servicio ni se restablece Smart Hub. Antes de desinstalar apps opcionales mediante menús oficiales hay que acordar cuáles con el propietario.
