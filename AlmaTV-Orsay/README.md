# Alma TV 9 · Samsung Orsay

Aplicación ES5 para Samsung UN50J5200, con puente local en una Mac. El proyecto anterior FIGUREMANIA se conserva. Identificador estable `AlmaTV86`; versión interna **9.0.0**.

## Instalar y actualizar

El paquete `instaladores/AlmaTV-9.0.0-instalador.zip` contiene el widget, los archivos del puente y `Instalar Alma TV.app`. Descomprime y abre el asistente en macOS: instala el puente al iniciar sesión y publica el instalador Wi-Fi durante diez minutos. Sincroniza aplicaciones en la TV usando la IP de la Mac. El asistente requiere Python 3.8 o posterior y todavía no tiene firma ni notarización de Apple; su ejecución física en macOS está pendiente de validación. Incluye recuperación del widget 8.7.0.

Alternativa en Terminal, dentro de la carpeta descomprimida:

```sh
python3 configurar_puente_mac.py --bind 192.168.1.30 --tv 192.168.1.249
sudo python3 servir.py --bind 192.168.1.30
```

Si otro instalador ocupa el puerto 80, detén ese instalador con Control+C antes. Tras sincronizar puedes detener el instalador; el puente queda en segundo plano. La Mac debe permanecer encendida y despierta. No abras puertos del router.

## Control desde el celular

Abre **http://192.168.1.30:8088/control** en la misma red Wi-Fi. El PIN y el QR aparecen en **Ajustes → Conectar celular** y en Dispositivos desde la Mac. El propietario controla reproducción; los invitados solamente añaden elementos a la cola. Se pueden revocar los dispositivos vinculados.

- Reproducir ahora, pausa, continuar, detener, anterior/siguiente y saltos de 5, 10 o 30 segundos.
- Volumen de **Alma TV**, independiente del volumen general de la televisión: bajar, subir y silenciar. Guarda el nivel al cambiar de archivo y entre aperturas. Utiliza HTML5 para archivos y las API oficiales para YouTube/Dailymotion; depende de que el motor del televisor exponga esas funciones.
- Enlaces de YouTube y Dailymotion, video o solo audio. La reproducción automática se solicita únicamente al pulsar Reproducir ahora. El proveedor puede impedir la reproducción o exigir interacción.
- Cola, favoritos, listas con nombre, orden, mezcla y repetición. Biblioteca de `~/Music/AlmaTV` y archivos subidos desde el panel.
- MP3/M4A/WAV y MP4/M4V propios, radios mediante URL directa y podcasts RSS con archivos de audio. No reproduce páginas web de plataformas como archivos multimedia.
- Fotos JPG/PNG, escenas de fotos y tarjetas de texto/precios, música de fondo y horarios semanales según la hora de la Mac. No renderiza PDF o PowerPoint; exporta sus páginas a imágenes.
- Varias pantallas registradas por IP, con colas y órdenes independientes. Cada TV necesita Alma TV abierta y compatibilidad verificada.

`/enlaces` conserva el panel anterior. Las nuevas funciones se encuentran en `/control`. La posición de los archivos propios se guarda para continuar después; los servicios en línea mantienen sus propias restricciones.

## Archivos y límites

El puente guarda biblioteca, listas, sesiones y escenas en `~/Library/Application Support/AlmaTV/hub/hub.json`, y las subidas en la carpeta `uploads` junto a ese archivo. Haz copia de esos datos y de `~/Music/AlmaTV`. Quitar una entrada de la biblioteca no borra el archivo original. Las subidas tienen un límite de 250 MB por archivo; fotos, 16 MB. Las fotos se ajustan con `sips` en macOS para reducir carga en la TV.

Conversión opcional de videos subidos a MP4 H.264/AAC: requiere FFmpeg instalado en la Mac. No se instala automáticamente. Las URL de radio y podcast deben ser públicas y directas; se rechazan direcciones privadas y redirecciones. La biblioteca del proveedor, DRM, región y códecs pueden impedir reproducir un contenido.

## Compatibilidad y pruebas

El propietario confirmó anteriormente reproducción de YouTube por enlaces y de archivos propios en esta TV. **Las funciones nuevas de 9.0 necesitan validación física**. Las pruebas automatizadas usan Chromium, puente HTTP real y archivos multimedia reales; las API de YouTube y Dailymotion se simulan. Una simulación no demuestra que Dailymotion decodifique en el firmware Samsung.

No se añade Spotify: no hay un receptor Spotify Connect verificado para este Orsay. Tampoco se añade soporte DRM para Disney+, Prime Video o Max. Xbox conserva el acceso existente a HDMI 2; no se promete previsualización HDMI dentro del reproductor. El control de volumen del celular no depende del módulo opcional de volumen del control remoto.

## Desarrollo

```sh
npm ci
npm test
python3 crear_instalador.py
```

Python ≥3.8, Node ≥22 para pruebas. La app no requiere Node en la TV ni en la Mac. `preparar.py` construye un ZIP reproducible y valida los recursos; `.preview/app` se extrae del mismo paquete. `crear_instalador.py` incluye el paquete actual y el respaldo 8.7 sin recomprimirlo internamente. El QR se genera localmente; licencia en `app/assets/QR-LICENSE.txt`.

Para distribuir comercialmente faltan firma/notarización, pruebas de hardware por modelo, licencias de contenidos y servicios de cuentas/pagos si se necesitan. Este repositorio implementa un sistema local; no simula esos servicios. Consulta el historial en [docs/HISTORIAL-HASTA-8.7.md](docs/HISTORIAL-HASTA-8.7.md).
