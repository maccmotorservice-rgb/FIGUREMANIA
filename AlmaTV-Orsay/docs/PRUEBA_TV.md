# Validación física pendiente · Mac y Samsung UN50J5200

No ejecutes una sincronización ni un lanzamiento sin decidir explícitamente hacerlo. El paquete está preparado para revisión; no ha contactado tu TV.

1. Revisa `comparacion.html` y las capturas, incluida la calibración. Importa tu imagen exacta antes de construir.
2. Confirma las IP actuales y conserva el instalador de una versión que hayas probado físicamente. El adjunto base 6.0 está preservado; no se recibió una versión 3.x.
3. Desde la Mac, diagnóstico de solo lectura (no abre apps):

   ```sh
   python3 diagnostico.py --tv 192.168.1.249
   ```

   Esperado: GET YouTube y Netflix, HTTP 200, estado XML del servicio. Guarda el resultado local; no incluyas secretos.
4. Cuando autorices abrir una app, prueba cada una explícitamente (interrumpe lo que estés viendo):

   ```sh
   python3 diagnostico.py --tv 192.168.1.249 --launch YouTube
   python3 diagnostico.py --tv 192.168.1.249 --launch Netflix
   ```

   Un código 200/201/204 demuestra aceptación; **observa físicamente la app**. Un GET solo no demuestra lanzamiento.
5. Tras decidir sincronizar, sigue el README. Revisa los widgets anteriores porque el firmware puede reemplazar la lista de apps de desarrollo. No se garantiza coinstalación.
6. En Alma TV prueba un solo OK por app y volver a abrir Alma TV desde Smart Hub. Verifica EXIT, RETURN y retorno del navegador.
7. Recorre Inicio → Apps → Herramientas → Búsqueda → Ajustes. Verifica cada dirección del control, edición de IP y retorno con foco conservado.
8. Calibra escala/X/Y, guarda, cierra y reabre. Comprueba esquinas, modales y salvapantallas. Prueba 3 %, 5 % y 8 % si el marco se recorta.
9. Temporizador: 1 minuto, iniciar, pausa 5 s, continuar, cambiar de vista, finalizar, reiniciar. Al salir del widget no se promete continuidad.
10. Calendario: mes anterior/siguiente, Hoy. Reloj y fecha deben corresponder a la hora de la TV.
11. Inicia puente sin `--allow-launch`, prueba Clima y localidad resuelta Tuxtla Gutiérrez. Apaga el puente y pulsa Actualizar: debe quedar Sin datos. Si deseas usar relay DIAL, autorízalo reiniciando con `--allow-launch`.
12. Prueba sin internet: herramientas y navegación siguen funcionando; clima falla de manera explícita. Prueba IP incorrecta: DIAL debe informar fallo en ~6 s, sin congelar la UI.
13. Abre el salvapantallas con la imagen local, espera 30 s y confirma movimiento del reloj; cualquier flecha/OK vuelve y EXIT sale. Verifica que no haya bandas o recortes indeseados.

Si hay fallo, anota versión, pantalla, tecla, IP configurada, estado DIAL y mensaje HTTP; incluye foto del televisor. No uses un restablecimiento de fábrica como diagnóstico. Antes de otra instalación, compara con el paquete de respaldo.

14. Xbox: enciende tu consola y activa su tarjeta una vez. Si aparece falta de API, usa SOURCE → HDMI 2 y registra el mensaje; no se presupone que Orsay exponga la selección. No se modifica la Xbox.
15. Salvapantallas: verifica hora, fecha con año, ciudad y bloque de clima, sin caja negra; el grupo completo debe moverse cada 15 s y permanecer dentro de la zona segura. Prueba con puente activo e inactivo.
16. Activa solo Puente local para clima y verifica que Netflix/YouTube sigan por DIAL directo. Activa Relay DIAL únicamente si lo necesitas, con el servidor --allow-launch.
17. Compara navegación física con 7.0. Si toda la TV sigue lenta, realiza el reinicio completo y revisa apps opcionales desde Samsung Apps con el propietario, sin borrar componentes del sistema.
