# Auditoría de la base y decisiones de implementación

Se leyeron completos el prompt, LEEME_PRIMERO, LEEME de la base, HTML/CSS/JS, config.xml, widget.info y preparar.py del ZIP adjunto. Se inspeccionaron los recursos y la imagen objetivo. La solicitud del chat de usar FIGUREMANIA en una rama prevalece sobre la sugerencia del documento de crear otro repositorio: todos los archivos nuevos están en AlmaTV-Orsay, rama alma-tv/orsay; el proyecto previo se conserva.

## Base 6.0 recibida

| Hallazgo en fuente | Efecto | Corrección comprobable |
|---|---|---|
| `draw()` mantiene las mismas tiras y `updateHero()` cambia el título | Inicio, Apps y Herramientas parecen la misma pantalla | Renderers distintos, rejillas y rutas con pila de retorno |
| CTA `#cta` es un div sin acción ni foco | Botón decorativo | Botón accionable abre Apps |
| `tick()` cada 15000 ms | Cuenta regresiva salta 15 s; no existe pausa | Intervalo 1 s, vencimiento por Date, pausa/reanudar/reinicio |
| `monthHTML()` depende siempre de new Date | No se pueden explorar meses | Mes seleccionado independiente, anterior/siguiente/hoy |
| `#overlay` y `#saver` quedan fuera de `#interface` | Calibración no cubre herramientas ni modales | Todas las capas dentro de `#safe` |
| `tvIp` hardcoded sin editor | Cambio de DHCP rompe DIAL | IPv4 privada editable, persistencia y diagnóstico por app |
| XHR sin timeout; GET de YouTube equivale a red | Espera indefinida y diagnóstico incompleto | Timeout 6 s, ambos servicios, códigos HTTP y estado no confirmado |
| Prime abre web como si fuera otra app | Confunde soporte nativo con web | «Por probar», sin POST ni web automático |
| Clima manda a Google | No hay medición meteorológica | Puente Open-Meteo opcional, observación y atribución, Sin datos al fallar |
| Escala permitida hasta 110 %, solo Y, guardado no informa fallos | Riesgo de overscan y pérdida silenciosa | 76–100 %, X/Y, presets y aviso de almacenamiento |
| Servidor `0.0.0.0` expone todo su directorio | Superficie innecesaria | Servidor ligado a IP privada, solo catálogo y Widget ZIP |
| Build sin validación ni determinismo | Fallos de instalación difíciles de detectar | ZIP reproducible, identidad única, validación XML/rutas/tamaños/CRC/SHA-256 |

No se reutilizan las imágenes de apps/hero del starter: el paquete no incluye evidencia individual de sus licencias. Se usan nombres de servicios en texto y una composición abstracta original en JPEG, generada para este proyecto (script conservado en tools/generar_hero.py). La captura del usuario permanece únicamente en documentación comparativa, nunca como fondo de la aplicación.

## Referencia CleanYourTV

Referencia: https://github.com/Gathin23/cleanyourtv. Se revisaron README, LICENSE MIT, themes/README, configuraciones aurora y six-columns y secciones de MainActivity.java relativas a foco, filas y movimiento reducido. El SHA consultado se registra en REFERENCIAS.md.

Ideas aplicadas: separación de configuración y vista; foco recordado al volver; límite de recursos; composición cinematográfica con dock compacto; estado honesto de integraciones; movimiento reducido. No se copia código Java, layouts, fuentes, iconos ni fondos. No hay ADB, APK, sustitución de HOME ni desactivación de paquetes en Orsay.

## Comparación visual

[Galería completa y comparación](comparacion.html). Se reduce la tipografía del hero de 47 px a 43 px antes de la calibración global, se conservan dos filas compactas, se evita un catálogo ficticio y se da a cada pantalla una composición propia. No se reproduce la fotografía promocional de la referencia ni sus logotipos.

Las capturas se generaron en Chromium a 1280×720, con presets de 3, 5 y 8 % por borde. Son una validación de software y composición; no certifican el WebKit ni el overscan físico del televisor.
