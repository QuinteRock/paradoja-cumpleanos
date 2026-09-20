/**
 * Procesa el DBF oficial de INEGI (Estadística de Nacimientos Registrados 2024)
 * y genera data/mexicoBirthdays2024.json con la distribución diaria (365 días).
 *
 * Fuente validada (DBD_Nacimientos_2024.pdf):
 *   DIA_NAC / MES_NAC  → día y mes de OCURRENCIA (nacimiento)
 *   DIA_REG / MES_REG  → día y mes de REGISTRO (NO usar)
 *   Día 99 / mes 99    → "No especificado"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DBFFile } from "dbffile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DBF_PATH = path.join(ROOT, "natalidad_base_datos_2024_dbf", "nacim24.dbf");
const OUT_PATH = path.join(ROOT, "data", "mexicoBirthdays2024.json");

/** Días por mes en año no bisiesto (excluye 29-feb del modelo de 365 días) */
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidCalendarDay(day, month) {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > DAYS_PER_MONTH[month - 1]) return false;
  return true;
}

async function main() {
  if (!fs.existsSync(DBF_PATH)) {
    console.error(`No se encontró el DBF: ${DBF_PATH}`);
    process.exit(1);
  }

  console.log("Abriendo DBF…");
  console.log(`  ${DBF_PATH}`);

  const dbf = await DBFFile.open(DBF_PATH);
  const fieldNames = dbf.fields.map((f) => f.name);

  // Validar que existen los campos de nacimiento (no registro)
  for (const required of ["DIA_NAC", "MES_NAC"]) {
    if (!fieldNames.includes(required)) {
      console.error(`Falta el campo requerido ${required}. Campos: ${fieldNames.join(", ")}`);
      process.exit(1);
    }
  }

  console.log(`Registros totales del DBF: ${dbf.recordCount.toLocaleString("es-MX")}`);
  console.log(`Campos de nacimiento: DIA_NAC, MES_NAC`);
  console.log(`Campos de registro (NO usados): DIA_REG, MES_REG`);

  /** @type {Map<string, number>} clave "MM-DD" → conteo */
  const counts = new Map();
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= DAYS_PER_MONTH[m - 1]; d++) {
      counts.set(`${pad2(m)}-${pad2(d)}`, 0);
    }
  }

  let totalRecords = 0;
  let validUsed = 0;
  let discarded = 0;
  let feb29Excluded = 0;

  const BATCH = 50_000;
  while (true) {
    const rows = await dbf.readRecords(BATCH);
    if (rows.length === 0) break;

    for (const row of rows) {
      totalRecords++;

      const day = Number(row.DIA_NAC);
      const month = Number(row.MES_NAC);

      // 99 = "No especificado" según diccionario INEGI
      if (day === 99 || month === 99 || !Number.isFinite(day) || !Number.isFinite(month)) {
        discarded++;
        continue;
      }

      // Excluir 29 de febrero para mantener exactamente 365 días
      if (month === 2 && day === 29) {
        feb29Excluded++;
        discarded++;
        continue;
      }

      if (!isValidCalendarDay(day, month)) {
        discarded++;
        continue;
      }

      const key = `${pad2(month)}-${pad2(day)}`;
      counts.set(key, counts.get(key) + 1);
      validUsed++;
    }

    if (totalRecords % 200_000 === 0 || rows.length < BATCH) {
      process.stdout.write(
        `\rProcesados: ${totalRecords.toLocaleString("es-MX")} / ${dbf.recordCount.toLocaleString("es-MX")}`
      );
    }
  }
  process.stdout.write("\n");

  if (validUsed === 0) {
    console.error("No quedaron registros válidos. Abortando.");
    process.exit(1);
  }

  /** @type {Array<{day:number, month:number, date:string, births:number, probability:number}>} */
  const entries = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= DAYS_PER_MONTH[m - 1]; d++) {
      const date = `${pad2(m)}-${pad2(d)}`;
      const births = counts.get(date) ?? 0;
      entries.push({
        day: d,
        month: m,
        date,
        births,
        probability: births / validUsed,
      });
    }
  }

  if (entries.length !== 365) {
    console.error(`ERROR: se generaron ${entries.length} fechas, se esperaban 365.`);
    process.exit(1);
  }

  // Renormalizar por si hay error de punto flotante (suma ≈ 1)
  const rawSum = entries.reduce((s, e) => s + e.probability, 0);
  if (Math.abs(rawSum - 1) > 1e-9) {
    for (const e of entries) {
      e.probability = e.probability / rawSum;
    }
  }

  const probSum = entries.reduce((s, e) => s + e.probability, 0);

  let maxE = entries[0];
  let minE = entries[0];
  for (const e of entries) {
    if (e.births > maxE.births) maxE = e;
    if (e.births < minE.births) minE = e;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2), "utf8");

  console.log("\n—— Validación ——");
  console.log(`Registros totales del DBF:     ${totalRecords.toLocaleString("es-MX")}`);
  console.log(`Registros válidos usados:      ${validUsed.toLocaleString("es-MX")}`);
  console.log(`Registros descartados:         ${discarded.toLocaleString("es-MX")}`);
  console.log(`  (de ellos, 29-feb excluidos): ${feb29Excluded.toLocaleString("es-MX")}`);
  console.log(`Fechas generadas:              ${entries.length}`);
  console.log(`Suma de probabilidades:        ${probSum}`);
  console.log(`Fecha con más nacimientos:     ${maxE.date} (${maxE.births.toLocaleString("es-MX")})`);
  console.log(`Fecha con menos nacimientos:   ${minE.date} (${minE.births.toLocaleString("es-MX")})`);
  console.log(`\nEscrito: ${OUT_PATH}`);

  if (entries.length !== 365) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
