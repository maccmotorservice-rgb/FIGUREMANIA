# Alma TV · Samsung Orsay

Aplicación ES5 local para Samsung **UN50J5200 (2015)**. Interfaz de 1280×720 con zona segura global, cinco vistas independientes, herramientas funcionales y lanzamientos nativos Netflix/YouTube por DIAL. Smart Hub sigue siendo el sistema principal.

Está en `FIGUREMANIA/AlmaTV-Orsay`, rama `alma-tv/orsay`. Los archivos de FIGUREMANIA se conservan. No se ha instalado nada en la TV desde la nube.

## Qué incluye

- Inicio cinematográfico compacto, Apps, Herramientas, Búsqueda y Ajustes.
- Netflix/YouTube: un OK envía un POST DIAL, sin doble confirmación. Timeout y errores visibles. Se conservan las rutas físicamente comprobadas por el propietario en versiones anteriores.
- Reloj, temporizador con pausa/reinicio, calendario mensual navegable, salvapantallas a pantalla completa, diagnóstico de ambos servicios DIAL.
- IP privada de TV y Mac editables con teclado en pantalla, calibración X/Y/escala guardada, movimiento reducido y restauración limitada a Alma TV.
- Búsqueda sobre apps, herramientas y hasta 12 enlaces personales; abre estos enlaces mediante el navegador Samsung. No hay historial ni catálogo de streaming simulado.
- Clima real de Open-Meteo mediante puente opcional. Ciudad inicial solicitada: **Tuxtla Gutiérrez, Chiapas, México**. Sin puente o ante error: «Sin datos».
- Prime Video queda «Por probar». No hay un lanzamiento nativo inventado.

## Arquitectura

`app/main.js`: estado de vista, matriz de foco por filas, acciones, pila de retorno, modales/editor, preferencias versionadas y adaptadores de plataforma. HTML/CSS/JS locales; **cero dependencias de ejecución** en la TV. `assets/media.js` declara una imagen local opcional del salvapantallas. La app no solicita red automáticamente al arrancar.

El intervalo de 1 segundo actualiza solo hora y valores; usa marcas de tiempo reales para el temporizador. El salvapantallas mueve el reloj cada 15 segundos y comparte la calibración de todas las pantallas. No hay vídeos, filtros pesados, animaciones continuas, CDN, React, módulos ni fetch en el widget.

`preparar.py` genera el ZIP reproducible y catálogo de instalación. `servir.py` publica únicamente esos archivos en la IP privada elegida. `puente.py` es opcional: HTTPS moderno para clima y relay DIAL restringido a las dos apps y la TV configurada. `diagnostico.py` permite verificar la TV desde la Mac, sin escanear redes.

## Instalación por Wi-Fi desde tu Mac

**Primero revisa las [capturas y comparación](docs/comparacion.html).** No hay sincronización automática. Revisa también [LIMITACIONES.md](LIMITACIONES.md) y [la lista de verificación física](docs/PRUEBA_TV.md).

1. Descarga y descomprime el instalador completo; abre Terminal en `AlmaTV-Orsay`. Se necesita Python 3.8 o posterior; no se necesitan Node ni paquetes Python para construir o instalar.
2. Comprueba las IP actuales en los ajustes normales de red de Mac/TV. Los valores anteriores son Mac `192.168.1.30`, TV `192.168.1.249`; no se descubren ni se asumen como actuales.
3. Tu ilustración de salvapantallas **ya está incluida sin modificar** (1672×941). Para sustituirla en el futuro, importa el JPG/PNG **antes del build**:

   ```sh
   python3 importar_salvapantallas.py "/ruta/a/tu/imagen.png"
   ```

   Conserva bytes y SHA-256 originales. Máximo 1920×1080 y 4 MB. Si no se ha importado un archivo, el salvapantallas muestra solo el reloj sobre fondo oscuro; no se sustituye tu imagen por otra.

4. Genera y valida los paquetes con la IP real de la Mac:

   ```sh
   python3 preparar.py 192.168.1.30
   ```

   Se generan `servidor/widgetlist.xml`, `servidor/Widget/AlmaTV70_7.0.0.zip` y `servidor/manifest.json`. El identificador `AlmaTV70` coincide con `cpname` dentro del ZIP, y `widget.info` permanece en texto plano. El respaldo original usa otro ID: `AlmaTV60`.

5. Inicia el servidor de instalación ligado a la IP de tu Mac:

   ```sh
   python3 servir.py --bind 192.168.1.30
   ```

   Si macOS responde con un error de permisos para el puerto 80, repite **solo el servidor** con:

   ```sh
   sudo python3 servir.py --bind 192.168.1.30
   ```

   Si el puerto ya está ocupado, detén tu servidor de instalación anterior con Ctrl+C. No mates procesos desconocidos. Permite Python en el cortafuegos macOS solo para la red de confianza si lo solicita. No abras puertos en el router.

6. Comprueba desde la Mac, en otra Terminal:

   ```sh
   curl --fail http://192.168.1.30/widgetlist.xml
   ```

7. **Solo cuando decidas instalar en la TV:** cuenta `develop` → Samsung Apps → Ajustes IP → IP de la Mac → Sincr. aplicac. → Alma TV 7.0. Revisa los widgets de desarrollo existentes antes de sincronizar: algunos firmwares pueden sustituir la lista sincronizada. No se ha verificado coinstalación en este firmware. Conserva tu versión físicamente conocida y sus archivos fuera de esta instalación.
8. En Alma TV, configura la IP real de la TV en Ajustes. Abre Diagnóstico antes de probar Netflix y YouTube. Al terminar la instalación, Ctrl+C detiene el servidor del puerto 80; **no hace falta dejarlo activo para usar las herramientas o DIAL directo**.

No se puede alcanzar tu red privada desde esta nube. Un éxito HTTP de prueba en Chromium no certifica un lanzamiento físico.

## Clima y puente opcional

Para clima actual, deja la Mac encendida y ejecuta (sin sudo):

```sh
python3 puente.py --bind 192.168.1.30 --tv 192.168.1.249
```

En Alma TV → Ajustes: confirma la IP de la Mac y activa Puente local. En Clima → Actualizar. El puente consulta exclusivamente `geocoding-api.open-meteo.com` y `api.open-meteo.com` por HTTPS verificado. Open-Meteo, CC BY 4.0; hora de observación y localidad resuelta visibles. La búsqueda usa el nombre de ciudad antes de la primera coma; comprueba que la localidad resuelta sea la correcta. Cache de 10 minutos; ante error no se presenta la última cifra como actual. No hay claves API.

Con Puente local activado, el diagnóstico y los lanzamientos también pasan por la Mac. Por defecto **los POST DIAL del puente están deshabilitados**. Para autorizar que tus pulsaciones abran Netflix/YouTube a través del puente, reinícialo explícitamente con:

```sh
python3 puente.py --bind 192.168.1.30 --tv 192.168.1.249 --allow-launch
```

Sin puente, los lanzamientos siguen usando DIAL directo, como en las versiones comprobadas por el propietario. Si el WebKit bloquea CORS, usa el puente. `HTTP 0` no demuestra que la TV esté desconectada.

El puente acepta origen nulo de widgets locales y orígenes de preview locales. Si el firmware usa otro origen, añádelo exactamente con `--origin 'ORIGEN_OBSERVADO'`, nunca `*`. No se ejecuta como servicio persistente ni exige modificar firmware. Solo debe usarse en tu Wi-Fi de confianza: HTTP local y CORS no equivalen a autenticación. Ctrl+C lo detiene. Al detenerlo se pierde clima actualizado y relay; puedes desactivar Puente local para volver a DIAL directo.

## Respaldo y rollback

- `respaldo/ALMA_TV_CODEX_STARTER_original.zip` conserva exactamente el adjunto recibido.
- `respaldo/servidor/Widget/AlmaTV60_6.0.0.zip` conserva cada archivo de su `app/` sin modificar; el catálogo separado usa `AlmaTV60`.
- Este respaldo **no se ha probado físicamente aquí**, ni reemplaza una copia de una versión 3.x que sepas que funciona. No se recibió el código de esa versión.
- Para ofrecer la base 6.0 original: detén el servidor actual, ejecuta `python3 servir.py --bind IP_MAC --rollback` (sudo solo si macOS lo requiere para puerto 80) y sincroniza manualmente, después de revisar el catálogo. El ID separado evita sobrescribir sus archivos por compartir cpname; el comportamiento de coinstalación depende del firmware.
- Ante pantalla congelada, usa EXIT/RETURN; si no responde, vuelve al Smart Hub mediante el control normal. No restablezcas Smart Hub ni borres datos para depurar Alma TV.
- En futuras versiones: preserva el paquete instalado, coordina `config.xml`, package.json, ID y versión; reconstruye catálogo y ZIP. Cierra/reabre el widget después de sincronizar para evitar caché. No reutilices el mismo ID para una copia que quieras conservar.

## Control remoto y preview

| Acción | Samsung real | Teclado de preview |
|---|---:|---|
| Izquierda / derecha | 4 / 5 | ← / → |
| Arriba / abajo | 29460 / 29461 | ↑ / ↓ |
| Abrir | 29443 | Enter |
| Volver | 88 | Backspace |
| Salir | 45 | Escape |
| Inicio / guardar calibración | 20 (verde) | botones o `Alma.key(20)` en consola |
| Ajustes | 21 (amarillo) | botones o `Alma.key(21)` en consola |

RETURN restaura la vista y el foco anterior; en Inicio conserva la interfaz. EXIT llama `sendExitEvent`; en navegador de escritorio solo avisa. Calibración: arriba/abajo eligen escala/X/Y, izquierda/derecha cambian el valor, OK pasa a presets y verde guarda. RETURN cancela. Los editores incluyen teclado en pantalla, borrar, guardar y cancelar; también aceptan teclado físico.

Para desarrollo local (Node 22+, Python y Chromium/Chrome):

```sh
npm ci --cache /tmp/figuremania-npm-cache
npm run preview
```

Preview es local a 1280×720 y no emula APIs de Samsung. No expongas el servidor de desarrollo a internet. En otra Terminal ejecuta:

```sh
npm test
```

Las pruebas arrancan su propio preview si falta, usan Chromium de `/usr/bin/chromium` y nunca contactan una TV. En Mac selecciona tu Chrome instalado, por ejemplo:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
```

El test DIAL y el meteorológico usan respuestas explícitas de prueba; esas respuestas no están en la aplicación. La sintaxis de todos los JS de la app se comprueba estrictamente como ES5. Las pruebas Python usan solo stdlib y comprueban el instalador y puente HTTP reales en loopback. Consulta [VALIDACION.md](docs/VALIDACION.md), [AUDITORIA.md](docs/AUDITORIA.md), [compatibilidad](LIMITACIONES.md) y [presupuesto de rendimiento](docs/RENDIMIENTO.md).
