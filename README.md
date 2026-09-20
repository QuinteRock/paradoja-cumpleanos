# Paradoja del cumpleaños

Demostración visual interactiva: en un grupo de 50 personas, la probabilidad de que al menos dos compartan cumpleaños es ≈ **97.04%**.

Optimizada para grabación vertical **9:16** (1080×1920). Compara el modelo uniforme clásico con nacimientos reales de México (INEGI 2024).

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (normalmente `http://localhost:5173`).

## Datos INEGI

La app usa `data/mexicoBirthdays2024.json` (distribución de 365 días).

Para regenerarlo desde el DBF oficial:

1. Coloca los archivos de INEGI en `natalidad_base_datos_2024_dbf/` (incluido `nacim24.dbf`).
2. Ejecuta:

```bash
npm run process:inegi
```

> `nacim24.dbf` no está en el repo (supera el límite de 100 MB de GitHub). Descárgalo desde la [página de microdatos de INEGI](https://www.inegi.org.mx/).

## Controles (demo)

- **Generar 50 cumpleaños** — simulación animada persona a persona
- **Simular 100 / 10,000 grupos** — experimentos en lote
- **Comparar ambos** — Uniforme vs INEGI (10k c/u)
- **Promedio · 100 × 10,000** — promedio de muchas corridas
- Panel **Opciones** (fuera del 9:16) — muestra/oculta funciones para grabar el video
- `/distribucion.html` — heatmap de nacimientos INEGI
