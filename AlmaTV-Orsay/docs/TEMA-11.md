# Alma TV 11.0

Respaldo local anterior: `backup/alma-tv-pre-11`, commit `ac36516e74f9869ed27e6ef927302de9d57462c6`. Conserva widget 10.3.0 y control 10.3.6. El ZIP anterior del widget mantiene SHA-256 `5f57974f7545de56f36f6ec7c0f0a057620b321926d823cfaacf9d9d86ef3241`. La rama de respaldo conserva ese commit.

Nuevo tema: dock de logos sin títulos; abajo abre biblioteca, Atrás vuelve al dock. Arriba sube a la barra superior. El botón Pantalla completa de esa barra abre el contenido actual. TV en vivo incorpora vista previa izquierda y categorías a la derecha; al elegir un canal se muestra en esa vista previa. Reproducir en el inicio conserva la sesión y la convierte en fondo. Favoritos, categorías manuales y listas siguen disponibles. La imagen original y las claves de preferencias se conservan. Controles rápidos pendientes por decisión del usuario.

Validación local: 92 pruebas de interfaz y 61 Python pasaron; check ES5 y build correctos. El instalador y el widget 11.0 pasan CRC y su manifiesto SHA-256 coincide. Imagen de fondo comparada byte a byte con el respaldo. Las pruebas de reproducción usan MP4 local real y API Samsung/YouTube simuladas; no prueban decodificación HLS en firmware físico. No se instaló en la TV.

Capturas: `capturas/alma11-inicio.png`, `capturas/alma11-tv-categorias.png`, `capturas/alma11-tv-preview.png` (la vista previa usa un video de prueba con barras). Las capturas históricas se conservan.

Instalador: `instaladores/AlmaTV-11.0.1-instalador.zip`. Para generarlo: `npm run build` y `python3 crear_instalador.py` desde AlmaTV-Orsay. El identificador estable AlmaTV86 permite actualizar conservando los datos, sujeto a comprobarlo en la TV. Antes de instalar, respaldar la configuración local del puente y mantener el instalador anterior.

## Corrección 11.0.1

Logos originales locales para Navegador, biblioteca y ALMA LIVE, con fuentes SVG y PNG compatibles con Orsay. Se elimina el acceso de la barra que salía a Smart Hub. Las categorías/listas internas usan el título Alma TV en vivo. Flecha arriba lleva a la barra; izquierda/derecha no cambian de fila. Flecha abajo vuelve al contenido; desde el dock abre la biblioteca. Las opciones de la barra muestran una etiqueta al enfocarse, conservando las tarjetas de apps sin títulos.

El arranque se ejecuta después del HTML, sin esperar al evento load de todas las imágenes. Una prueba retiene deliberadamente una imagen y comprueba que el foco y sendReadyEvent ya están activos; otra llamada a init no duplica el arranque. Esto demuestra la eliminación de esa espera en navegador, no un tiempo de inicio garantizado en el televisor físico. No se cambia la imagen original ni los motores de reproducción.

Ajustes finales del tema: dock más bajo, sin texto de instrucciones; selector de halo azul rey tenue sin borde blanco; marca del producto solo en Ajustes. Perfil circular junto al reloj. El instalador ofrece elegir JPG/PNG en la Mac y conserva los bytes originales; solo modifica el ZIP local, actualiza su manifiesto y guarda una copia privada local para actualizaciones posteriores. La foto personal no se publica en el repositorio ni en el instalador genérico.

Validación final de 11.0.1: 97 pruebas de interfaz y 63 de Python pasaron. Incluyen el arranque antes de cargar imágenes, flechas, seis tarjetas completas, halo, perfil local, reproducción y salvapantallas. ES5, build, CRC de paquetes y SHA-256 correctos. Apariencia y tiempo real de arranque quedan por comprobar en el Samsung físico.

El dock tiene seis tarjetas completas por ventana visible; el desplazamiento se alinea a tarjetas enteras y evita mostrar una séptima parcialmente. La cuadrícula conserva sus cuatro columnas (dentro del máximo de seis solicitado). Los elementos restantes siguen disponibles lateralmente y en la biblioteca.
