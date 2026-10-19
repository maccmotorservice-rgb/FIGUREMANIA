# Simulaciones reproducibles

Reglas iniciales sin cambios. `npm run simulate`. Cada fila contiene 10 000 partidas; se alternan posiciones (5000 por orientación). Semillas y contadores exactos en `simulation-results.json`. Límite técnico 500 intercambios: no concede victoria. Duraciones en intercambios; percentiles solo de partidas terminadas.

Estrategias: **daño** elige el mayor daño disponible y revierte con ≥20 energía. **remate** reserva impulso (no usa personal), usa técnico mientras ahorra, remata con 100 impulso y 40 energía; revierte con ≥60 energía. **conservadora** elige el mayor golpe normal conservando 20 energía y solo revierte con salud ≤50 y energía ≥40. Todas intentan cuenta salvo la variante ≥50%. Mismas semillas por fila para comparar políticas.

| Valoraciones A/B | Estrategias A/B             | Cuenta A/B        | Victorias A/B | Mediana / P90 | Reversal intentos / éxitos | Remates | Sin terminar |
| ---------------- | --------------------------- | ----------------- | ------------- | ------------- | -------------------------- | ------- | ------------ |
| 84 vs 84         | daño / daño                 | siempre / siempre | 5005 / 4995   | 4 / 8         | 35546 / 8871               | 0       | 0            |
| 84 vs 84         | remate / remate             | siempre / siempre | 4966 / 5034   | 5 / 8         | 17448 / 4300               | 4073    | 0            |
| 84 vs 84         | conservadora / conservadora | siempre / siempre | 4995 / 5005   | 3 / 7         | 3720 / 906                 | 0       | 0            |
| 84 vs 84         | daño / remate               | siempre / siempre | 5675 / 4325   | 4 / 8         | 25995 / 6521               | 1778    | 0            |
| 84 vs 84         | remate / conservadora       | siempre / siempre | 5087 / 4913   | 4 / 7         | 8478 / 2094                | 1772    | 0            |
| 84 vs 84         | conservadora / daño         | siempre / siempre | 4296 / 5704   | 4 / 8         | 18990 / 4729               | 0       | 0            |
| 84 vs 84         | daño / daño                 | siempre / ≥50%    | 7838 / 2162   | 7 / 11        | 44006 / 11000              | 0       | 0            |
| 93 vs 84         | daño / daño                 | siempre / siempre | 5625 / 4375   | 4 / 8         | 35555 / 8916               | 0       | 0            |
| 93 vs 84         | remate / remate             | siempre / siempre | 5497 / 4503   | 5 / 8         | 17366 / 4329               | 3989    | 0            |
| 93 vs 84         | conservadora / conservadora | siempre / siempre | 5598 / 4402   | 3 / 7         | 3846 / 972                 | 0       | 0            |
| 93 vs 84         | daño / remate               | siempre / siempre | 6293 / 3707   | 4 / 8         | 24860 / 6230               | 1664    | 0            |
| 93 vs 84         | remate / conservadora       | siempre / siempre | 5648 / 4352   | 4 / 7         | 7786 / 1931                | 1849    | 0            |
| 93 vs 84         | conservadora / daño         | siempre / siempre | 4892 / 5108   | 4 / 8         | 20361 / 5132               | 0       | 0            |
| 93 vs 84         | daño / daño                 | siempre / ≥50%    | 8436 / 1564   | 6 / 11        | 42919 / 10769              | 0       | 0            |
| 95 vs 70         | daño / daño                 | siempre / siempre | 6180 / 3820   | 4 / 8         | 35452 / 8918               | 0       | 0            |
| 95 vs 70         | remate / remate             | siempre / siempre | 6033 / 3967   | 5 / 8         | 17438 / 4341               | 3954    | 0            |
| 95 vs 70         | conservadora / conservadora | siempre / siempre | 6221 / 3779   | 3 / 7         | 3935 / 996                 | 0       | 0            |
| 95 vs 70         | daño / remate               | siempre / siempre | 6784 / 3216   | 4 / 8         | 23745 / 6003               | 1619    | 0            |
| 95 vs 70         | remate / conservadora       | siempre / siempre | 6246 / 3754   | 4 / 7         | 7090 / 1788                | 1825    | 0            |
| 95 vs 70         | conservadora / daño         | siempre / siempre | 5513 / 4487   | 4 / 8         | 21805 / 5495               | 0       | 0            |
| 95 vs 70         | daño / daño                 | siempre / ≥50%    | 8891 / 1109   | 6 / 11        | 41961 / 10562              | 0       | 0            |

Las frecuencias por intercambio, remates por 100 ataques y victorias separadas por posición están en el JSON. Estos resultados son evidencia de estas políticas; no prueban equilibrio ni dominancia universal.
