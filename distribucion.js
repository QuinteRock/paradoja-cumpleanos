/**
 * Vista /distribucion — calendario de nacimientos INEGI 2024
 * Ruta separada de la demo principal de la paradoja.
 */

import mexicoBirthdays2024 from "./data/mexicoBirthdays2024.json";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MONTHS_SHORT = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

const calendar = document.getElementById("calendar");
const detail = document.getElementById("detail");
const detailDate = document.getElementById("detailDate");
const detailBirths = document.getElementById("detailBirths");
const detailProb = document.getElementById("detailProb");
const monthBars = document.getElementById("monthBars");

const byKey = new Map(mexicoBirthdays2024.map((e) => [e.date, e]));
const births = mexicoBirthdays2024.map((e) => e.births);
const minB = Math.min(...births);
const maxB = Math.max(...births);
const total = births.reduce((s, n) => s + n, 0);

const maxEntry = mexicoBirthdays2024.reduce((a, b) => (b.births > a.births ? b : a));
const minEntry = mexicoBirthdays2024.reduce((a, b) => (b.births < a.births ? b : a));

function formatDateLabel(entry) {
  return `${entry.day} de ${MONTHS[entry.month - 1]}`;
}

function intensity(n) {
  if (maxB === minB) return 0.5;
  return (n - minB) / (maxB - minB);
}

function cellColor(t) {
  // Escala: fondo oscuro → teal (coincide con la demo)
  const r = Math.round(14 + t * (61 - 14));
  const g = Math.round(20 + t * (224 - 20));
  const b = Math.round(30 + t * (197 - 30));
  const a = 0.25 + t * 0.75;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

document.getElementById("statTotal").textContent = total.toLocaleString("es-MX");
document.getElementById("statMax").textContent =
  `${formatDateLabel(maxEntry)} · ${maxEntry.births.toLocaleString("es-MX")}`;
document.getElementById("statMin").textContent =
  `${formatDateLabel(minEntry)} · ${minEntry.births.toLocaleString("es-MX")}`;

function showDetail(entry) {
  detail.hidden = false;
  detailDate.textContent = formatDateLabel(entry);
  detailBirths.textContent = `${entry.births.toLocaleString("es-MX")} nacimientos`;
  detailProb.textContent = `${(entry.probability * 100).toFixed(3)}% del total`;
}

function buildCalendar() {
  calendar.innerHTML = "";

  for (let m = 1; m <= 12; m++) {
    const row = document.createElement("div");
    row.className = "dist-month";

    const label = document.createElement("div");
    label.className = "dist-month-label";
    label.textContent = MONTHS_SHORT[m - 1];
    row.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "dist-month-days";

    const daysInMonth = mexicoBirthdays2024.filter((e) => e.month === m).length;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const entry = byKey.get(key);
      if (!entry) continue;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "dist-day";
      cell.style.background = cellColor(intensity(entry.births));
      cell.title = `${formatDateLabel(entry)}: ${entry.births.toLocaleString("es-MX")}`;
      cell.setAttribute("aria-label", cell.title);
      cell.dataset.date = entry.date;

      if (entry.date === maxEntry.date) cell.classList.add("is-max");
      if (entry.date === minEntry.date) cell.classList.add("is-min");

      cell.addEventListener("click", () => {
        calendar.querySelectorAll(".dist-day.is-selected").forEach((el) => {
          el.classList.remove("is-selected");
        });
        cell.classList.add("is-selected");
        showDetail(entry);
      });

      grid.appendChild(cell);
    }

    row.appendChild(grid);
    calendar.appendChild(row);
  }
}

function buildMonthBars() {
  /** @type {number[]} */
  const perMonth = Array(12).fill(0);
  for (const e of mexicoBirthdays2024) {
    perMonth[e.month - 1] += e.births;
  }

  // Escala fija 0–50%: el ancho de la barra = % real del año (no relativo al mes pico)
  const SCALE_MAX_PCT = 50;

  monthBars.innerHTML = "";
  perMonth.forEach((n, i) => {
    const pct = (n / total) * 100;
    const row = document.createElement("div");
    row.className = "dist-bar-row";

    const name = document.createElement("span");
    name.className = "dist-bar-name";
    name.textContent = MONTHS_SHORT[i];

    const track = document.createElement("div");
    track.className = "dist-bar-track";
    track.setAttribute("aria-hidden", "true");

    const fill = document.createElement("div");
    fill.className = "dist-bar-fill";
    fill.style.width = `${Math.min(100, (pct / SCALE_MAX_PCT) * 100)}%`;
    fill.title = `${n.toLocaleString("es-MX")} nacimientos`;
    track.appendChild(fill);

    const val = document.createElement("span");
    val.className = "dist-bar-val";
    val.textContent = `${pct.toFixed(1)}% (${n.toLocaleString("es-MX")})`;

    row.append(name, track, val);
    monthBars.appendChild(row);
  });
}

buildCalendar();
buildMonthBars();
showDetail(maxEntry);
calendar.querySelector(`[data-date="${maxEntry.date}"]`)?.classList.add("is-selected");
