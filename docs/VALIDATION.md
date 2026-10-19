# Validación · edición retro v0.2

Ejecutado en este entorno con Node 24.19.0, npm 11.9.0 y Chromium del sistema:

| Comprobación                    | Resultado                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                      | 33 pruebas del motor, almacenamiento y roster, todas aprobadas                                                                                    |
| `npm run build`                 | TypeScript y build de Vite correctos                                                                                                              |
| `npm run test:e2e`              | 9 pruebas de navegador aprobadas                                                                                                                  |
| `npm run simulate`              | 21 × 10 000 = 210 000 partidas, cero censuradas a 500 intercambios                                                                                |
| Producción bajo `/FIGUREMANIA/` | Selección, entradas y primera tirada en Chromium, 5 cartas, sin errores JS ni recursos fallidos                                                   |
| Revisión visual                 | Capturas móvil 390 px y escritorio 1440 px; pruebas de inicio, selección y catálogo a 320, 390, 768, 1024 y 1440 px sin desbordamiento horizontal |

Las pruebas de navegador comprueban: crear figura; elegir dos rivales; entradas; completar una lucha con ganador; recuperar exactamente el estado después de recargar; historial con eventos; reglas y cartas en escritorio; cargar una imagen y editar bonos manteniéndolos al recargar; doble clic sin duplicar tirada. El estado aleatorio inicial del recorrido funcional se crea normalmente; las pruebas matemáticas y las simulaciones usan semillas o RNG inyectado.

Las pruebas del motor cubren límites, cinco costos, cartas bloqueadas, empates, iniciativa, fronteras 15/16 de reversal, los cinco éxitos de veinte, impulso, salud cero sin victoria, cuenta exacta 7300/7301, liberación, omitir cuenta, recuperación, abandono, revisiones duplicadas, RNG reproducible, guardado y restauración, fallos de almacenamiento, medios deduplicados y datos incompletos.

Se verificó una partida completa usando golpes rápidos sin reversals para ejercitar el circuito mínimo. Las ramas de reversal están verificadas por pruebas del motor; no se simuló una cámara física en CI. La carga de foto sí se probó como archivo. La reproducción de audio depende de compatibilidad y permisos del navegador y no se certifica en dispositivo físico.

Fuentes y recursos se empaquetan localmente. Se usó Chromium ya instalado después de que el CDN de descarga de Playwright devolviera 403; no se desactivaron verificaciones TLS ni se amplió la política de red.

El código se ha subido a la rama main de GitHub por solicitud del propietario. La primera versión fue publicada mediante GitHub Pages; cada actualización se verifica en Actions. No se ejecutó ni verificó una migración remota de Supabase, un proveedor de reconocimiento o un proveedor IA. No hay video generado. El esquema y las interfaces son preparación documentada. El balance requiere pruebas humanas; ver `FINDINGS.md`.

## Comprobaciones añadidas para v0.2

El catálogo tiene 107 IDs únicos en cuatro divisiones. Se verifican alias de Piper, versiones distintas de Rey, búsquedas sin tildes, filtros y plantillas jugables con 80 provisional. Registrar una edición crea una copia independiente. La compatibilidad con guardados v1 se comprueba sin migraciones ni borrado.

En Chromium se verifican catálogo completo, división femenil de 25 entradas, registro de Rhea con edición y valoración personalizadas, conservación de las figuras anteriores, búsqueda de Piper y búsqueda vacía. También selección independiente de Rhea y Stone Cold, bloqueo de entrada sin confirmar ambos lados, guardado/restauración de una lucha con plantillas, navegación por roster sin cambiar una partida existente y navegación por teclado que salta al contendiente ocupado por el rival.

La nueva tipografía Orbitron se empaqueta junto a Barlow, sin peticiones a servicios de fuentes. El motor y balance permanecen intactos; la simulación existente no se presenta como una nueva ejecución.
