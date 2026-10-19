# Validación de la primera versión

Ejecutado en este entorno con Node 24.19.0, npm 11.9.0 y Chromium del sistema:

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 27 pruebas del motor y almacenamiento, todas aprobadas |
| `npm run build` | TypeScript y build de Vite correctos |
| `npm run test:e2e` | 4 pruebas de navegador aprobadas |
| `npm run simulate` | 21 × 10 000 = 210 000 partidas, cero censuradas a 500 intercambios |
| Producción bajo `/FIGUREMANIA/` | Selección, entradas y primera tirada en Chromium, 5 cartas, sin errores JS ni recursos fallidos |
| Revisión visual | Capturas móvil 390 px y escritorio 1440 px, sin desbordamiento horizontal |

Las pruebas de navegador comprueban: crear figura; elegir dos rivales; entradas; completar una lucha con ganador; recuperar exactamente el estado después de recargar; historial con eventos; reglas y cartas en escritorio; cargar una imagen y editar bonos manteniéndolos al recargar; doble clic sin duplicar tirada. El estado aleatorio inicial del recorrido funcional se crea normalmente; las pruebas matemáticas y las simulaciones usan semillas o RNG inyectado.

Las pruebas del motor cubren límites, cinco costos, cartas bloqueadas, empates, iniciativa, fronteras 15/16 de reversal, los cinco éxitos de veinte, impulso, salud cero sin victoria, cuenta exacta 7300/7301, liberación, omitir cuenta, recuperación, abandono, revisiones duplicadas, RNG reproducible, guardado y restauración, fallos de almacenamiento, medios deduplicados y datos incompletos.

Se verificó una partida completa usando golpes rápidos sin reversals para ejercitar el circuito mínimo. Las ramas de reversal están verificadas por pruebas del motor; no se simuló una cámara física en CI. La carga de foto sí se probó como archivo. La reproducción de audio depende de compatibilidad y permisos del navegador y no se certifica en dispositivo físico.

Fuentes y recursos se empaquetan localmente. Se usó Chromium ya instalado después de que el CDN de descarga de Playwright devolviera 403; no se desactivaron verificaciones TLS ni se amplió la política de red.

No se ha publicado la app ni subido el código a GitHub. No se ejecutó ni verificó una migración remota de Supabase, un proveedor de reconocimiento o un proveedor IA. No hay video generado. El esquema y las interfaces son preparación documentada. El balance requiere pruebas humanas; ver `FINDINGS.md`.
