# Presupuesto de recursos y diagnóstico de rendimiento

Objetivos para Orsay: JS ES5 sin librerías; paquete de widget <1 MB sin imagen personalizada; <5 MB con ella; un solo hero JPEG 1152×302; salvapantallas <=1920×1080, <=4 MB comprimidos. No se precarga el salvapantallas antes de abrirlo. Los dos fondos no se multiplican por imágenes de catálogo. Las tarjetas usan nombres en texto y colores locales.

Memoria de imágenes decodificadas: hero hasta 1.33 MiB (1152×302×4); salvapantallas Full HD hasta 7.91 MiB (1920×1080×4). Presupuesto conjunto de bitmaps <10 MiB, sin contar superficies/compositor, DOM y motor WebKit. Es un cálculo, **no una medición de RAM física en la TV**. La pintura compartida de capas o buffers puede consumir más. Una imagen visible más grande no se acepta silenciosamente: el importador la rechaza y pide reducirla.

Intervalo único a 1 s; no hay recarga de página por reloj, CSS Grid, filtros, vídeo, red en bucle ni animaciones continuas. El foco usa un escalado 1.025 y borde. El ajuste Movimiento reducido desactiva transiciones. Las peticiones tienen timeout de 6 s; red fallida no bloquea el hilo con XHR síncrono.

Para revisar en Chromium: DevTools → Performance, grabar 30 s navegando y 30 s en reposo. DevTools → Memory, tomar snapshot antes/después de abrir/cerrar 20 veces herramientas y modales. Verificar que no crezca el número de intervalos y que requests finalizados se eliminen. Network debe mostrar solo archivos locales al iniciar. Clima y DIAL solo se piden al activar sus acciones. En dispositivo: observar latencia entre tecla y foco, congelamientos y volver a abrir después de uso de Netflix; registrar fotos y secuencia si falla.

Si el televisor tarda al abrir la imagen: prueba un JPG baseline 1280×720 optimizado desde tu Mac, conservando el original; no desactives verificaciones TLS ni ajustes del sistema. No hay prueba automática que sustituya una sesión prolongada en el WebKit físico.

## Cambios medidos en el software 7.1

Se eliminan ampliación del foco, transiciones de escala, sombras de tarjeta y desenfoques. `htmlIfChanged` escribe en DOM solo si cambia el contenido; el movimiento del grupo del salvapantallas se actualiza una vez por posición de 15 s. Prueba con hora fija: cero mutaciones de DOM en reposo; mover foco no reconstruye `#view` ni las tarjetas. No es una medición de latencia, GPU o memoria del dispositivo.

Los logotipos se rasterizan antes de empaquetar a PNG de 180×100, no durante la ejecución. Los pequeños sprites de navegación y clima son locales. El hero y salvapantallas reutilizan el mismo PNG del usuario; no se descarga publicidad ni se duplica el archivo de fondo.
