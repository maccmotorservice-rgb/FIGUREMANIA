# Logotipos e iconos locales

Se incorporan las formas reales de marca para identificar accesos, no para indicar compatibilidad ni afiliación.

- Netflix, YouTube, Apple TV y Xbox: vectores de `simple-icons@11.15.0`, paquete npm con licencia CC0 incluida en `licencias/SIMPLE-ICONS-CC0.md`.
- Prime Video, Disney+ y Max: `homarr-labs/dashboard-icons`, archivos `svg/prime-video.svg`, `svg/disney-plus.svg`, `svg/max.svg`. Apache 2.0; copyright 2024 Bjorn Lammers, Meier Lukas, Thomas Camlong y Homarr Labs. Licencia completa incluida en `licencias/DASHBOARD-ICONS-APACHE-2.0.txt`.
- Los SVG fuente se conservan en `app/assets/logos/source/`. Se rasterizan a PNG pequeños para no exigir SVG al WebKit de la TV. Se recortan márgenes y se adapta el relleno a blanco en algunas marcas para contraste; no se recrean los signos ni se usa generación de imágenes para imitarlos. Script: `tools/render_logos.cjs`.
- Los archivos PNG se cargan localmente; no hay conexión con los proveedores para dibujar iconos. Las licencias también se incluyen en el widget, `app/assets/logos/LICENCIAS.txt`.
- Los iconos de navegación y clima son trazos originales de este proyecto; no se copian iconos de Apple ni de la captura de referencia.
- Las marcas siguen perteneciendo a sus titulares. La licencia de una reproducción gráfica no añade servicios, cuentas, reproductores ni autorización de marca.
