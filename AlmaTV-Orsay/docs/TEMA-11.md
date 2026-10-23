# Alma TV 11.0

Respaldo local anterior: `backup/alma-tv-pre-11`, commit `ac36516e74f9869ed27e6ef927302de9d57462c6`. Conserva widget 10.3.0 y control 10.3.6. El ZIP anterior del widget mantiene SHA-256 `5f57974f7545de56f36f6ec7c0f0a057620b321926d823cfaacf9d9d86ef3241`. La rama de respaldo conserva ese commit.

Nuevo tema: dock de logos sin títulos; abajo abre biblioteca, Atrás vuelve al dock. Arriba abre el contenido actual a pantalla completa. TV en vivo incorpora vista previa izquierda y categorías a la derecha; al elegir un canal se muestra en esa vista previa. Reproducir en el inicio conserva la sesión y la convierte en fondo. Favoritos, categorías manuales y listas siguen disponibles. La imagen original y las claves de preferencias se conservan. Controles rápidos pendientes por decisión del usuario.

Validación local: 92 pruebas de interfaz y 61 Python pasaron; check ES5 y build correctos. El instalador y el widget 11.0 pasan CRC y su manifiesto SHA-256 coincide. Imagen de fondo comparada byte a byte con el respaldo. Las pruebas de reproducción usan MP4 local real y API Samsung/YouTube simuladas; no prueban decodificación HLS en firmware físico. No se instaló en la TV.

Capturas: `capturas/alma11-inicio.png`, `capturas/alma11-tv-categorias.png`, `capturas/alma11-tv-preview.png` (la vista previa usa un video de prueba con barras). Las capturas históricas se conservan.

Instalador: `instaladores/AlmaTV-11.0.0-instalador.zip`. Para generarlo: `npm run build` y `python3 crear_instalador.py` desde AlmaTV-Orsay. El identificador estable AlmaTV86 permite actualizar conservando los datos, sujeto a comprobarlo en la TV. Antes de instalar, respaldar la configuración local del puente y mantener el instalador anterior.
