# Volumen HLS procesado: resultado de investigación

Se ejecutó una prueba local de 8 segundos con FFmpeg de Linux, libzmq, un video H.264 de pruebas y un tono sintético. El filtro `volume@alma` recibió órdenes dinámicas mediante `azmq`: volumen 0.25 a los 2 segundos, silencio a los 4 y volumen 1 a los 6. Las tres órdenes devolvieron `0 Success`; se mantuvo un único proceso. El video se copió con `-c:v copy`; solo se codificó el audio a AAC, con salida HLS.

Se decodificó la salida HLS y se midió RMS en ventanas alejadas de cada cambio: -21.08 dBFS original, -33.12 al 25 %, silencio y -21.08 restaurado. La diferencia de -12.04 dB coincide con una ganancia de 0.25. El resultado JSON y el script de reproducción acompañan este informe. Ejecutar el script desde AlmaTV-Orsay; usa el puerto local 5555, genera archivos en /tmp/alma-volume-proof y requiere FFmpeg con azmq más libzmq. No usa canales reales, internet ni la TV.

## Alcance y siguientes requisitos

Esta prueba demuestra regulación dinámica en la salida del procesador sin reiniciar el proceso. **No demuestra funcionamiento en la Mac del usuario ni en el Samsung, ni latencia audible de los controles.** El buffer HLS de la TV puede retrasar el efecto del volumen. Se debe comprobar `ffmpeg -filters` en la Mac, en particular `azmq` y `volume`, y la disponibilidad de libzmq. No se debe asumir que cualquier instalación de FFmpeg los incluya.

Una integración necesitaría una sesión de procesamiento por canal, un endpoint HLS local con segmentos, limpieza y control de procesos, selector de pista de entrada, un transporte local para órdenes y pruebas prolongadas. El selector de SAP del modo procesado tendría que operar sobre la entrada en la Mac: no asumir que la salida AAC expone las pistas originales. Esta investigación todavía no implementa ese modo ni cambia la ruta de reproducción directa.

La Mac debe permanecer despierta y servir la señal. Si se apaga, el modo procesado dejaría de reproducir; los canales directos existentes conservarían su independencia. Se debe conservar una salida directa de recuperación. El video copiado evita una recodificación en esta prueba, pero fuentes incompatibles podrían exigir otra conversión. No se ha medido consumo de CPU ni retraso en el equipo del usuario. No se ejecuta ninguna API de volumen global Samsung.
