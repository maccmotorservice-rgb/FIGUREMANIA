# FIGUREMANIA · Primer asalto

Juego de lucha libre para dos personas con figuras físicas y un dispositivo compartido. React + TypeScript + Vite. Motor matemático independiente; todas las decisiones y tiradas se guardan en el navegador.

## Ejecutar

Requiere Node.js 22 o 24 y npm. Desde la raíz del repositorio:

```sh
npm ci --cache /tmp/figuremania-npm-cache
npm run dev -- --host 0.0.0.0 --port 5173
```

Abre el servidor Vite en tu navegador local. En este entorno en la nube, la aplicación se valida por solicitudes internas; los enlaces localhost no son enlaces públicos.

```sh
npm test             # pruebas del motor y persistencia
npm run build        # TypeScript y compilación estática
npm run simulate     # 21 escenarios × 10 000 partidas, sobrescribe informes reproducibles
npm run test:e2e     # flujo de navegador móvil y escritorio
```

Las pruebas de navegador usan `/usr/bin/chromium` en este entorno. Para otro equipo, configura `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con la ruta a Chromium/Chrome instalado. No hace falta descargar otro navegador aquí.

## Circuito jugable

1. Nueva lucha → elige dos figuras distintas de la colección.
2. Entradas: cada figura presenta su edición y su imagen. El audio opcional se reproduce con un toque tras activar el sonido.
3. Tira ambos d20. El total incluye `floor(valoración / 10)`; los empates repiten sin recursos.
4. El atacante paga una de sus cinco cartas. El defensor elige recibir o arriesgar reversal.
5. Tras un golpe original conectado, el atacante decide si intenta cuenta. Una sola tirada 1–10000 resuelve el resultado.
6. La victoria abre el resumen; historial conserva el registro. Abandonar/reiniciar pide confirmación.

Colección permite crear, editar y borrar figuras, sus cinco nombres de movimiento, bonos, foto (cámara o archivo) y audio aportado por el usuario. Incluye cuatro demos marcadas como ficticias, entre ellas Rey con 93 y 84. Las ilustraciones de luchadores son SVG originales, no fotografías oficiales.

Ajustes ofrece audio, movimiento reducido y exportación/importación de respaldo. Los archivos se guardan como data URL con deduplicación en el almacenamiento local; límites 3 MB por foto y 2 MB por audio. La cuota total depende del navegador: si se llena se informa y la transición no se aplica. Para colecciones grandes conviene un futuro adaptador IndexedDB y blobs. No borrar almacenamiento sin respaldo. No hay sincronización entre dispositivos. Evita usar varias pestañas simultáneas: esta versión está diseñada para un dispositivo y una pestaña.

## Motor y guardado

`src/core/engine.ts` centraliza el balance, límites, fórmula de cuenta, revisión y RNG. `transition` es pura salvo las marcas de tiempo; acepta un RNG inyectado. El RNG por defecto es LCG uint32 reproducible y su estado se persiste con el combate. No es criptográfico y no sirve para competición con premios. Cada acción lleva la revisión esperada: revisiones antiguas y acciones fuera de fase se rechazan. La UI escribe primero en localStorage y después actualiza pantalla; conserva dados y fase tras recargar. Las figuras del combate son instantáneas: editar o borrar la colección no altera una lucha iniciada.

`src/core/storage.ts` define `StorageAdapter`, con implementación local y versión de datos. `supabase/schema.sql` prepara perfiles, figuras, partidas y eventos con RLS por usuario y FK compuesta que impide vincular eventos a partidas ajenas. No se ha conectado ni ejecutado Supabase. Un futuro adaptador debe proporcionar transacciones y concurrencia por revisión. No hay claves requeridas ni secretos en el cliente.

## GitHub Pages

El workflow `.github/workflows/pages.yml` instala, prueba, compila y publica automáticamente al subir cambios a `main`, o al ejecutarlo manualmente desde Actions. En Settings → Pages, Source debe ser **GitHub Actions**. Publicación solicitada por el propietario.

El destino exclusivo es `https://maccmotorservice-rgb.github.io/FIGUREMANIA/`. Antes de compilar, el workflow consulta Pages y rechaza un dominio personalizado o una URL distinta. Solo actúa dentro de `maccmotorservice-rgb/FIGUREMANIA`; no modifica otros repositorios ni sitios. El estado real de publicación se comprueba en la pestaña Actions.

Vite compila con `VITE_BASE_PATH=/FIGUREMANIA/`. La navegación se resuelve en memoria sin rutas que dependan del servidor. Al recargar, Inicio ofrece Continuar para restaurar la fase exacta del combate. No hacen falta claves adicionales: Actions usa su token temporal de GitHub con permisos limitados.

Las fuentes se incluyen en el bundle mediante `@fontsource`; no dependen de Google Fonts ni de recursos externos. El combate funciona sin red después de cargar todos los recursos. No hay service worker ni garantía de arranque sin conexión desde una pestaña nueva.

## Validación y balance

Ver `docs/BALANCE.md`, `docs/simulation-results.json`, `docs/FINDINGS.md` y `docs/VALIDATION.md`. Las simulaciones son de políticas explícitas, con semillas reproducibles y posiciones alternas. Sus límites técnicos no son reglas del juego. No se han cambiado silenciosamente las reglas iniciales.

## Próximas integraciones

- Reconocimiento: `FigureRecognition` en `src/core/integrations.ts` recibe una foto y propone IDs registrados. El usuario debe confirmar antes de seleccionar. Ahora se selecciona manualmente; no se simula reconocimiento.
- Repetición IA: cada golpe original conectado conserva atacante, defensor, imágenes opcionales, movimiento, daño, salud resultante y estado `unavailable`. Se informa que no hay proveedor. `ReplayProvider` define solicitud asíncrona con límite de costo e idempotencia. Futuro backend autenticado debe aplicar presupuesto, cola, estados, cancelación y URLs temporales. Nunca cambiará el resultado resuelto del motor ni bloqueará jugar. No hay videos simulados ni llamadas IA actuales.
- Multidispositivo/cuentas: implementar adaptador Supabase y probar RLS con dos usuarios antes de habilitar acceso remoto; añadir storage privado para medios.

WWE, Mattel y nombres de luchadores pertenecen a sus respectivos titulares. FIGUREMANIA es un prototipo no oficial con identidad visual propia. Valoraciones, rarezas y ediciones demo son valores ficticios del juego, no precios ni calificaciones oficiales.
