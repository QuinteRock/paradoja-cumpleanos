/**
 * Paradoja del cumpleaños
 * Demostración visual: probabilidad de al menos 2 personas
 * con el mismo cumpleaños en un grupo de N personas (365 días).
 *
 * Modos de muestreo:
 *   - uniform: cada día 1/365
 *   - inegi: distribución ponderada con nacimientos reales (INEGI 2024)
 */

import mexicoBirthdays2024 from "./data/mexicoBirthdays2024.json";

// ---------- Constantes ----------
const DAYS_IN_YEAR = 365;
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
const MONTHS_FULL = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
/** Días por mes (año no bisiesto — modelo clásico de 365 días) */
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ---------- DOM ----------
const stage = document.getElementById("stage");
const peopleGrid = document.getElementById("peopleGrid");
const mainTitle = document.getElementById("mainTitle");
const subtitle = document.getElementById("subtitle");
const matchBanner = document.getElementById("matchBanner");
const matchLabel = document.getElementById("matchLabel");
const matchList = document.getElementById("matchList");
const batchPanel = document.getElementById("batchPanel");
const batchExperiment = document.getElementById("batchExperiment");
const withMatchEl = document.getElementById("withMatch");
const withoutMatchEl = document.getElementById("withoutMatch");
const withMatchLabel = document.getElementById("withMatchLabel");
const withoutMatchLabel = document.getElementById("withoutMatchLabel");
const batchProgressBar = document.getElementById("batchProgressBar");
const batchHint = document.getElementById("batchHint");
const batchResult = document.getElementById("batchResult");
const resultSummary = document.getElementById("resultSummary");
const resultPercent = document.getElementById("resultPercent");
const resultTheory = document.getElementById("resultTheory");
const compare10k = document.getElementById("compare10k");
const compareUniform = document.getElementById("compareUniform");
const compareInegi = document.getElementById("compareInegi");
const avgRuns = document.getElementById("avgRuns");
const avgRunsList = document.getElementById("avgRunsList");
const statPeople = document.getElementById("statPeople");
const statRepeats = document.getElementById("statRepeats");
const statMatch = document.getElementById("statMatch");
const theoryFooter = document.querySelector(".theory");
const theoryExpand = document.getElementById("theoryExpand");
const theoryValue = document.getElementById("theoryValue");
const theoryHints = document.getElementById("theoryHints");
const sourceNote = document.getElementById("sourceNote");
const btnGenerate = document.getElementById("btnGenerate");
const btnSim100 = document.getElementById("btnSim100");
const btnSim10000 = document.getElementById("btnSim10000");
const btnCompareBoth = document.getElementById("btnCompareBoth");
const btnAvg100 = document.getElementById("btnAvg100");
const modeUniformBtn = document.getElementById("modeUniform");
const modeInegiBtn = document.getElementById("modeInegi");
const directorFab = document.getElementById("directorFab");
const directorPanel = document.getElementById("directorPanel");
const revealMode = document.getElementById("revealMode");
const revealSim100 = document.getElementById("revealSim100");
const revealSim10000 = document.getElementById("revealSim10000");
const revealCompare = document.getElementById("revealCompare");
const revealAvg100 = document.getElementById("revealAvg100");

// ---------- Estado ----------
/** @type {"uniform" | "inegi"} */
let birthdayMode = "uniform";
/** Fijo en 50 para la demo / video */
const peopleCount = 50;
let busy = false;
/** @type {AbortController | null} */
let runController = null;

/** Últimos resultados de 10,000 grupos por modo (para comparar) */
/** @type {{ uniform: number | null, inegi: number | null }} */
const last10k = { uniform: null, inegi: null };

// ---------- Distribución INEGI (CDF) ----------

/**
 * month (1–12) + day (1–31) → índice 0..364
 */
function monthDayToIndex(month, day) {
  let idx = 0;
  for (let m = 1; m < month; m++) idx += DAYS_PER_MONTH[m - 1];
  return idx + day - 1;
}

/**
 * CDF: [{ dayIndex, cumulative }, ...] con cumulative creciente hasta ~1.
 * Se construye una sola vez al cargar el JSON.
 */
const inegiCdf = (() => {
  /** @type {{ dayIndex: number, cumulative: number }[]} */
  const cdf = [];
  let cum = 0;
  for (const entry of mexicoBirthdays2024) {
    cum += entry.probability;
    cdf.push({
      dayIndex: monthDayToIndex(entry.month, entry.day),
      cumulative: cum,
    });
  }
  // Asegurar que el último sea exactamente 1 (evitar huecos por float)
  if (cdf.length) cdf[cdf.length - 1].cumulative = 1;
  return cdf;
})();

/**
 * Búsqueda binaria en la CDF: primera entrada con cumulative >= r.
 */
function sampleInegiDayIndex() {
  const r = Math.random();
  let lo = 0;
  let hi = inegiCdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (inegiCdf[mid].cumulative < r) lo = mid + 1;
    else hi = mid;
  }
  return inegiCdf[lo].dayIndex;
}

/**
 * Generación central de cumpleaños (0..364).
 * Todos los modos de simulación pasan por aquí.
 * @param {"uniform" | "inegi"} [mode]
 */
function getRandomBirthday(mode = birthdayMode) {
  if (mode === "inegi") return sampleInegiDayIndex();
  return Math.floor(Math.random() * DAYS_IN_YEAR);
}

// ---------- Utilidades de fechas ----------

/**
 * Índice de día 0..364 → { monthIndex 0..11, day 1..31 }
 */
function dayIndexToParts(dayIndex) {
  let remaining = dayIndex;
  for (let m = 0; m < 12; m++) {
    if (remaining < DAYS_PER_MONTH[m]) {
      return { monthIndex: m, day: remaining + 1 };
    }
    remaining -= DAYS_PER_MONTH[m];
  }
  return { monthIndex: 11, day: 31 };
}

function formatShort(dayIndex) {
  const { monthIndex, day } = dayIndexToParts(dayIndex);
  return `${String(day).padStart(2, "0")} ${MONTHS_SHORT[monthIndex]}`;
}

function formatFull(dayIndex) {
  const { monthIndex, day } = dayIndexToParts(dayIndex);
  return `${day} de ${MONTHS_FULL[monthIndex]}`;
}

/**
 * Probabilidad teórica de al menos una coincidencia con n personas.
 * Solo aplica al modelo uniforme clásico.
 * P = 1 − ∏_{k=1}^{n−1} (365−k)/365
 */
function theoreticalProbability(n) {
  if (n < 2) return 0;
  if (n > DAYS_IN_YEAR) return 1;

  let allDifferent = 1;
  for (let k = 1; k < n; k++) {
    allDifferent *= (DAYS_IN_YEAR - k) / DAYS_IN_YEAR;
  }
  return 1 - allDifferent;
}

function formatPercent(p, digits = 2) {
  return `${(p * 100).toFixed(digits)}%`;
}

/**
 * Un experimento completo: ¿hay al menos una coincidencia?
 * @param {number} n
 * @param {"uniform" | "inegi"} [mode]
 */
function hasCollision(n, mode = birthdayMode) {
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const d = getRandomBirthday(mode);
    if (seen.has(d)) return true;
    seen.add(d);
  }
  return false;
}

/** Cuenta coincidencias en `total` grupos independientes. */
function countCollisions(n, total, mode) {
  let withMatch = 0;
  for (let i = 0; i < total; i++) {
    if (hasCollision(n, mode)) withMatch++;
  }
  return withMatch;
}

function columnsFor(n) {
  // Preferir rejillas que llenan bien en 9:16 (50 → 5×10)
  if (n === 50) return 5;
  if (n <= 16) return 4;
  if (n <= 30) return 5;
  if (n <= 48) return 6;
  if (n <= 70) return 7;
  return 8;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

// ---------- UI: cuadrícula y teoría ----------

function buildEmptyGrid(n) {
  peopleGrid.style.setProperty("--cols", String(columnsFor(n)));
  peopleGrid.innerHTML = "";

  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "person is-empty";
    el.dataset.index = String(i);
    el.innerHTML = `
      <span class="person-num">#${i + 1}</span>
      <span class="person-date">-- ---</span>
    `;
    peopleGrid.appendChild(el);
  }
}

function updateTheoryUI() {
  const n = peopleCount;
  statPeople.textContent = String(n);
  btnGenerate.textContent = `Generar ${n} cumpleaños`;

  if (birthdayMode === "inegi") {
    mainTitle.textContent = "¿Y con datos reales?";
    subtitle.textContent = `${n} personas · INEGI 2024`;
    theoryFooter.classList.add("is-inegi");
    theoryValue.textContent = "Distribución ponderada con nacimientos reales";
    sourceNote.hidden = false;
  } else {
    const p = theoreticalProbability(n);
    const lastDay = DAYS_IN_YEAR - n + 1;
    const pct = formatPercent(p);
    const rounded = Math.round(p * 100);

    mainTitle.textContent = `¿${rounded}% de probabilidad?`;
    subtitle.textContent = `${n} personas · ${DAYS_IN_YEAR} días`;
    theoryFooter.classList.remove("is-inegi");
    theoryExpand.textContent = `P = 1 − (365/365 × 364/365 × … × ${lastDay}/365)`;
    theoryValue.textContent = `≈ ${pct}`;
    theoryHints.textContent =
      "23 → 50.73% · 30 → 70.63% · 40 → 89.12% · 50 → 97.04%";
    sourceNote.hidden = true;
  }
}

function setMode(mode) {
  if (busy || mode === birthdayMode) return;
  birthdayMode = mode;
  modeUniformBtn.classList.toggle("is-active", mode === "uniform");
  modeInegiBtn.classList.toggle("is-active", mode === "inegi");
  updateTheoryUI();
  resetVisualState({ keepCompare: true });
}

function setBusy(value) {
  busy = value;
  stage.classList.toggle("is-busy", value);
  btnGenerate.disabled = value;
  btnSim100.disabled = value;
  btnSim10000.disabled = value;
  btnCompareBoth.disabled = value;
  btnAvg100.disabled = value;
  modeUniformBtn.disabled = value;
  modeInegiBtn.disabled = value;
}

/** Aplica toggles del panel de video (fuera del lienzo). */
function applyReveals() {
  stage.classList.toggle("show-mode", revealMode.checked);
  stage.classList.toggle("show-sim100", revealSim100.checked);
  stage.classList.toggle("show-sim10000", revealSim10000.checked);
  stage.classList.toggle("show-compare", revealCompare.checked);
  stage.classList.toggle("show-avg100", revealAvg100.checked);

  // Si se oculta Uniforme/INEGI mientras estás en INEGI, volver a uniforme
  if (!revealMode.checked && birthdayMode === "inegi") {
    birthdayMode = "uniform";
    modeUniformBtn.classList.add("is-active");
    modeInegiBtn.classList.remove("is-active");
    updateTheoryUI();
  }
}

function hideMatchBanner() {
  matchBanner.hidden = true;
  matchList.innerHTML = "";
  matchLabel.textContent = "¡COINCIDENCIA!";
}

/**
 * Formatea índices 0-based → "#7, #14 y #22"
 */
function formatPersonGroup(indices) {
  const nums = indices.map((i) => `#${i + 1}`);
  if (nums.length === 1) return nums[0];
  if (nums.length === 2) return `${nums[0]} y ${nums[1]}`;
  return `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
}

/**
 * Lista TODAS las fechas con ≥2 personas en el banner.
 * @param {Map<number, number[]>} byDay
 */
function renderAllMatches(byDay) {
  /** @type {{ day: number, people: number[] }[]} */
  const matches = [];
  for (const [day, people] of byDay) {
    if (people.length >= 2) matches.push({ day, people: [...people] });
  }

  matches.sort((a, b) => Math.min(...a.people) - Math.min(...b.people));

  matchList.innerHTML = "";
  if (matches.length === 0) {
    matchBanner.hidden = true;
    return;
  }

  matchLabel.textContent =
    matches.length === 1 ? "¡COINCIDENCIA!" : `¡${matches.length} COINCIDENCIAS!`;

  for (const { day, people } of matches) {
    const li = document.createElement("li");
    li.className = "match-item";
    li.innerHTML = `${formatPersonGroup(people)} · <span>${formatFull(day)}</span>`;
    matchList.appendChild(li);
  }

  matchBanner.hidden = false;
  matchList.scrollTop = matchList.scrollHeight;
}

function updateStats(repeats, hadMatch) {
  statRepeats.textContent = String(repeats);
  if (hadMatch === null) {
    statMatch.textContent = "—";
    statMatch.className = "stat-value";
  } else if (hadMatch) {
    statMatch.textContent = "SÍ";
    statMatch.className = "stat-value is-yes";
  } else {
    statMatch.textContent = "NO";
    statMatch.className = "stat-value is-no";
  }
}

function renderCompare10k() {
  const hasAny = last10k.uniform !== null || last10k.inegi !== null;
  compare10k.hidden = !hasAny;
  compareUniform.textContent =
    last10k.uniform === null ? "—" : `${last10k.uniform.toFixed(2)}%`;
  compareInegi.textContent =
    last10k.inegi === null ? "—" : `${last10k.inegi.toFixed(2)}%`;
}

function hideAvgRuns() {
  avgRuns.hidden = true;
  avgRunsList.innerHTML = "";
}

/**
 * @param {{ uniform: number, inegi: number }[]} runs
 */
function renderAvgRuns(runs) {
  avgRunsList.innerHTML = "";
  runs.forEach((run, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="run-num">#${String(i + 1).padStart(2, "0")}</span><span>${run.uniform.toFixed(2)}%</span><span>${run.inegi.toFixed(2)}%</span>`;
    avgRunsList.appendChild(li);
  });
  avgRuns.hidden = false;
  avgRunsList.scrollTop = avgRunsList.scrollHeight;
}

/**
 * @param {{ keepCompare?: boolean }} [opts]
 */
function resetVisualState(opts = {}) {
  hideMatchBanner();
  hideAvgRuns();
  batchPanel.hidden = true;
  batchResult.hidden = true;
  stage.classList.remove("mode-batch", "mode-batch-result");
  buildEmptyGrid(peopleCount);
  updateStats(0, null);
  if (!opts.keepCompare) {
    last10k.uniform = null;
    last10k.inegi = null;
  }
  renderCompare10k();
}

function abortCurrentRun() {
  if (runController) {
    runController.abort();
    runController = null;
  }
}

function theoryNoteForBatch(n, pct) {
  if (birthdayMode === "inegi") {
    return "Distribución ponderada con nacimientos reales (INEGI 2024)";
  }
  return `Probabilidad matemática: ${formatPercent(theoreticalProbability(n))}`;
}

// ---------- Simulación individual animada ----------

async function runSingleSimulation() {
  abortCurrentRun();
  const controller = new AbortController();
  runController = controller;
  const { signal } = controller;

  setBusy(true);
  hideMatchBanner();
  batchPanel.hidden = true;
  batchResult.hidden = true;
  stage.classList.remove("mode-batch", "mode-batch-result");
  buildEmptyGrid(peopleCount);
  updateStats(0, null);

  const n = peopleCount;
  const birthdays = Array.from({ length: n }, () => getRandomBirthday());
  /** @type {Map<number, number[]>} dayIndex → índices de persona (0-based) */
  const byDay = new Map();
  const matchedDays = new Set();

  const cards = /** @type {HTMLElement[]} */ ([...peopleGrid.children]);
  const delayMs = Math.max(28, Math.min(55, Math.floor(2200 / n)));

  try {
    for (let i = 0; i < n; i++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const day = birthdays[i];
      const card = cards[i];
      const dateEl = card.querySelector(".person-date");

      dateEl.textContent = formatShort(day);
      card.classList.remove("is-empty");
      card.classList.add("is-active");

      const prev = byDay.get(day);
      if (prev) {
        prev.push(i);
        byDay.set(day, prev);

        for (const idx of prev) {
          cards[idx].classList.add("is-match");
          cards[idx].classList.remove("is-active");
        }

        matchedDays.add(day);
        renderAllMatches(byDay);
        updateStats(matchedDays.size, true);
      } else {
        byDay.set(day, [i]);
      }

      await sleep(delayMs, signal);
    }

    const hadMatch = matchedDays.size > 0;
    updateStats(matchedDays.size, hadMatch);
    if (!hadMatch) hideMatchBanner();
    else renderAllMatches(byDay);
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    if (runController === controller) runController = null;
    setBusy(false);
  }
}

// ---------- Modo 100 simulaciones (animado ~5–8 s) ----------

async function runBatch100() {
  abortCurrentRun();
  const controller = new AbortController();
  runController = controller;
  const { signal } = controller;

  setBusy(true);
  hideMatchBanner();
  hideAvgRuns();
  stage.classList.add("mode-batch");
  stage.classList.remove("mode-batch-result");
  batchPanel.hidden = false;
  batchResult.hidden = true;
  withMatchEl.textContent = "0";
  withoutMatchEl.textContent = "0";
  buildEmptyGrid(peopleCount);
  updateStats(0, null);

  const total = 100;
  const n = peopleCount;
  let withMatch = 0;
  let withoutMatch = 0;
  // ~30 ms × 100 ≈ 3 s (antes 65 ms ≈ 6.5 s)
  const delayMs = 30;

  batchExperiment.innerHTML = `Experimento<br /><span>0 / ${total}</span>`;
  withMatchEl.textContent = "0";
  withoutMatchEl.textContent = "0";
  if (batchProgressBar) batchProgressBar.style.width = "0%";
  if (batchHint) {
    batchHint.textContent =
      "Cada experimento = 1 grupo nuevo de 50 cumpleaños (100 grupos en total)";
  }

  try {
    for (let i = 1; i <= total; i++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const hit = hasCollision(n);
      if (hit) withMatch++;
      else withoutMatch++;

      batchExperiment.innerHTML = `Experimento<br /><span>${i} / ${total}</span>`;
      withMatchEl.textContent = String(withMatch);
      withoutMatchEl.textContent = String(withoutMatch);
      if (batchProgressBar) batchProgressBar.style.width = `${(i / total) * 100}%`;

      await sleep(delayMs, signal);
    }

    const pct = (withMatch / total) * 100;

    resultSummary.textContent = `${withMatch} de ${total} grupos tuvieron al menos una coincidencia`;
    resultPercent.textContent = `Resultado experimental: ${pct.toFixed(0)}%`;
    resultPercent.style.animation = "none";
    void resultPercent.offsetWidth;
    resultPercent.style.animation = "";
    resultTheory.textContent = theoryNoteForBatch(n, pct);
    batchResult.hidden = false;
    stage.classList.add("mode-batch-result");
    renderCompare10k();

    updateStats(0, withMatch > 0);
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    if (runController === controller) runController = null;
    setBusy(false);
  }
}

function flashGridProgress(ratio) {
  const cards = peopleGrid.children;
  const lit = Math.floor(ratio * cards.length);
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (i < lit) {
      c.classList.add("is-active");
      c.classList.remove("is-empty");
    } else {
      c.classList.add("is-empty");
      c.classList.remove("is-active", "is-match");
    }
  }
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/**
 * Efecto de “cargando” ~3–5 s: el cálculo ya está listo,
 * pero el contador sube animado para el video.
 * Importante: CON + SIN siempre suman el contador de grupos hechos.
 */
function animateBatchProgress({
  labelHtml,
  total,
  withMatch,
  durationMs,
  signal,
}) {
  const withoutMatch = total - withMatch;

  return new Promise((resolve, reject) => {
    const start = performance.now();
    let settled = false;
    /** @type {number} */
    let rafId = 0;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(rafId);
      signal?.removeEventListener("abort", onAbort);
      if (ok) resolve();
      else reject(new DOMException("Aborted", "AbortError"));
    };

    const onAbort = () => finish(false);
    signal?.addEventListener("abort", onAbort, { once: true });

    function frame(now) {
      if (settled || signal?.aborted) {
        finish(false);
        return;
      }

      const t = Math.min(1, (now - start) / durationMs);
      const e = easeOutCubic(t);
      const done = Math.round(total * e);
      // Proporción real sobre los grupos “ya contados” en la animación
      const wShow = Math.round((withMatch / total) * done);
      const woShow = done - wShow;

      batchExperiment.innerHTML = `${labelHtml}<br /><span>${done.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")}</span>`;
      withMatchEl.textContent = String(wShow);
      withoutMatchEl.textContent = String(woShow);
      if (batchProgressBar) batchProgressBar.style.width = `${e * 100}%`;

      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        withMatchEl.textContent = String(withMatch);
        withoutMatchEl.textContent = String(withoutMatch);
        batchExperiment.innerHTML = `${labelHtml}<br /><span>${total.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")}</span>`;
        if (batchProgressBar) batchProgressBar.style.width = "100%";
        finish(true);
      }
    }

    rafId = requestAnimationFrame(frame);
  });
}

// ---------- Modo 10,000 (cálculo rápido + carga visual ~4 s) ----------

async function runBatch10000() {
  abortCurrentRun();
  const controller = new AbortController();
  runController = controller;
  const { signal } = controller;

  setBusy(true);
  hideMatchBanner();
  hideAvgRuns();
  stage.classList.add("mode-batch");
  stage.classList.remove("mode-batch-result");
  batchPanel.hidden = false;
  batchResult.hidden = true;
  buildEmptyGrid(peopleCount);

  const total = 10_000;
  const n = peopleCount;
  const modeAtStart = birthdayMode;

  batchExperiment.innerHTML = `Experimento<br /><span>0 / ${total.toLocaleString("es-ES")}</span>`;
  withMatchEl.textContent = "0";
  withoutMatchEl.textContent = "0";
  if (batchProgressBar) batchProgressBar.style.width = "0%";
  if (batchHint) {
    batchHint.textContent =
      "Cada +1 del contador = otro grupo distinto de 50 cumpleaños al azar";
  }

  try {
    // Resultado real al instante; la animación es solo efecto.
    // countCollisions llama hasCollision 10,000 veces; cada una genera 50 fechas nuevas.
    const withMatch = countCollisions(n, total, modeAtStart);
    const withoutMatch = total - withMatch;
    const pct = (withMatch / total) * 100;
    last10k[modeAtStart] = pct;

    await animateBatchProgress({
      labelHtml: `10,000 grupos · ${n} pers. c/u`,
      total,
      withMatch,
      durationMs: 4000,
      signal,
    });

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    resultSummary.textContent = `${withMatch.toLocaleString("es-ES")} de ${total.toLocaleString("es-ES")} grupos independientes (cada uno = ${n} cumpleaños nuevos) tuvieron coincidencia`;
    resultPercent.textContent = `Resultado experimental: ${pct.toFixed(2)}%`;
    resultPercent.style.animation = "none";
    void resultPercent.offsetWidth;
    resultPercent.style.animation = "";
    resultTheory.textContent = theoryNoteForBatch(n, pct);
    batchResult.hidden = false;
    stage.classList.add("mode-batch-result");
    renderCompare10k();
    updateStats(0, null);
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    if (runController === controller) runController = null;
    setBusy(false);
  }
}

/**
 * 10,000 Uniforme + 10,000 INEGI, con carga visual (~2 s + ~2 s).
 */
async function runBatch10000Both() {
  abortCurrentRun();
  const controller = new AbortController();
  runController = controller;
  const { signal } = controller;

  setBusy(true);
  hideMatchBanner();
  hideAvgRuns();
  stage.classList.add("mode-batch");
  stage.classList.remove("mode-batch-result");
  batchPanel.hidden = false;
  batchResult.hidden = true;
  buildEmptyGrid(peopleCount);

  const total = 10_000;
  const n = peopleCount;

  batchExperiment.innerHTML = `Comparación<br /><span>0 / ${total.toLocaleString("es-ES")}</span>`;
  withMatchEl.textContent = "0";
  withoutMatchEl.textContent = "0";

  try {
    const withUniform = countCollisions(n, total, "uniform");
    const pctUniform = (withUniform / total) * 100;
    last10k.uniform = pctUniform;

    await animateBatchProgress({
      labelHtml: `Comparación · Uniforme · ${n} pers.`,
      total,
      withMatch: withUniform,
      durationMs: 2200,
      signal,
    });

    const withInegi = countCollisions(n, total, "inegi");
    const pctInegi = (withInegi / total) * 100;
    last10k.inegi = pctInegi;

    await animateBatchProgress({
      labelHtml: `Comparación · INEGI · ${n} pers.`,
      total,
      withMatch: withInegi,
      durationMs: 2200,
      signal,
    });

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const delta = pctInegi - pctUniform;
    const absDelta = Math.abs(delta);
    const theoryPct = theoreticalProbability(n) * 100;
    const distUniform = Math.abs(pctUniform - theoryPct);
    const distInegi = Math.abs(pctInegi - theoryPct);

    batchExperiment.innerHTML = `Comparación<br /><span>${total.toLocaleString("es-ES")} × 2</span>`;

    resultSummary.textContent = `${total.toLocaleString("es-ES")} grupos nuevos de ${n} personas en cada modelo (nada se reutiliza)`;

    let headline;
    if (Math.abs(distUniform - distInegi) < 0.005) {
      headline = `Empate: ambos a ~${theoryPct.toFixed(2)}%`;
    } else if (distUniform < distInegi) {
      headline = `Más cerca del ${theoryPct.toFixed(2)}%: Uniforme`;
    } else {
      headline = `Más cerca del ${theoryPct.toFixed(2)}%: INEGI`;
    }

    if (absDelta >= 0.5) {
      headline += delta > 0 ? " · INEGI más alto" : " · Uniforme más alto";
    }

    resultPercent.textContent = headline;
    resultPercent.style.animation = "none";
    void resultPercent.offsetWidth;
    resultPercent.style.animation = "";
    resultTheory.textContent = `Uniforme ${pctUniform.toFixed(2)}% · INEGI ${pctInegi.toFixed(2)}% · teórico ≈ ${theoryPct.toFixed(2)}%`;
    batchResult.hidden = false;
    stage.classList.add("mode-batch-result");
    renderCompare10k();
    updateStats(0, null);
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    if (runController === controller) runController = null;
    setBusy(false);
  }
}

/**
 * 100 comparaciones independientes de 10,000 grupos c/u.
 * Cada grupo = 50 cumpleaños nuevos (no se reutiliza ninguna generación).
 * Lista cada corrida y muestra el promedio de Uniforme e INEGI.
 */
async function runAvg100x10k() {
  abortCurrentRun();
  const controller = new AbortController();
  runController = controller;
  const { signal } = controller;

  setBusy(true);
  hideMatchBanner();
  hideAvgRuns();
  stage.classList.add("mode-batch");
  stage.classList.remove("mode-batch-result");
  batchPanel.hidden = false;
  batchResult.hidden = true;
  buildEmptyGrid(peopleCount);
  updateStats(0, null);

  const ROUNDS = 100;
  const PER_RUN = 10_000;
  const n = peopleCount;
  /** @type {{ uniform: number, inegi: number }[]} */
  const runs = [];
  let sumU = 0;
  let sumI = 0;

  batchExperiment.innerHTML = `100 × (10k grupos de ${n})<br /><span>0 / ${ROUNDS}</span>`;
  withMatchEl.textContent = "0";
  withoutMatchEl.textContent = "0";
  withMatchLabel.textContent = "PROM. UNIFORME %";
  withoutMatchLabel.textContent = "PROM. INEGI %";
  if (batchProgressBar) batchProgressBar.style.width = "0%";
  if (batchHint) {
    batchHint.textContent =
      "100 corridas × 10,000 grupos nuevos cada una · Uniforme vs INEGI";
  }

  try {
    for (let i = 0; i < ROUNDS; i++) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      // Cada countCollisions genera PER_RUN grupos independientes desde cero
      const withU = countCollisions(n, PER_RUN, "uniform");
      const withI = countCollisions(n, PER_RUN, "inegi");
      const pctU = (withU / PER_RUN) * 100;
      const pctI = (withI / PER_RUN) * 100;

      runs.push({ uniform: pctU, inegi: pctI });
      sumU += pctU;
      sumI += pctI;

      const avgU = sumU / (i + 1);
      const avgI = sumI / (i + 1);

      batchExperiment.innerHTML = `100 × (10k grupos de ${n})<br /><span>${i + 1} / ${ROUNDS}</span>`;
      withMatchEl.textContent = avgU.toFixed(2);
      withoutMatchEl.textContent = avgI.toFixed(2);
      if (batchProgressBar) batchProgressBar.style.width = `${((i + 1) / ROUNDS) * 100}%`;

      await sleep(25, signal);
    }

    const avgUniform = sumU / ROUNDS;
    const avgInegi = sumI / ROUNDS;
    const theoryPct = theoreticalProbability(n) * 100;

    last10k.uniform = avgUniform;
    last10k.inegi = avgInegi;

    batchExperiment.innerHTML = `100 × (10k grupos de ${n})<br /><span>${ROUNDS} / ${ROUNDS}</span>`;
    withMatchEl.textContent = avgUniform.toFixed(2);
    withoutMatchEl.textContent = avgInegi.toFixed(2);

    resultSummary.textContent = `${ROUNDS} corridas independientes · cada una = ${PER_RUN.toLocaleString("es-ES")} grupos nuevos de ${n}`;
    resultPercent.textContent = `Promedio Uniforme ${avgUniform.toFixed(2)}% · INEGI ${avgInegi.toFixed(2)}%`;
    resultPercent.style.animation = "none";
    void resultPercent.offsetWidth;
    resultPercent.style.animation = "";
    resultTheory.textContent = `≈ teórico uniforme ${theoryPct.toFixed(2)}% · acercarse a ese valor es lo esperado`;

    batchResult.hidden = false;
    stage.classList.add("mode-batch-result");
    renderCompare10k();
    renderAvgRuns(runs);
    updateStats(0, null);
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    withMatchLabel.textContent = "CON COINCIDENCIA";
    withoutMatchLabel.textContent = "SIN COINCIDENCIA";
    if (runController === controller) runController = null;
    setBusy(false);
  }
}

// ---------- Eventos ----------

modeUniformBtn.addEventListener("click", () => setMode("uniform"));
modeInegiBtn.addEventListener("click", () => setMode("inegi"));

directorFab.addEventListener("click", () => {
  const open = directorPanel.hidden;
  directorPanel.hidden = !open;
  directorFab.setAttribute("aria-expanded", open ? "true" : "false");
});

for (const el of [
  revealMode,
  revealSim100,
  revealSim10000,
  revealCompare,
  revealAvg100,
]) {
  el.addEventListener("change", applyReveals);
}

btnGenerate.addEventListener("click", () => {
  if (busy) return;
  runSingleSimulation();
});

btnSim100.addEventListener("click", () => {
  if (busy) return;
  runBatch100();
});

btnSim10000.addEventListener("click", () => {
  if (busy) return;
  runBatch10000();
});

btnCompareBoth.addEventListener("click", () => {
  if (busy) return;
  runBatch10000Both();
});

btnAvg100.addEventListener("click", () => {
  if (busy) return;
  runAvg100x10k();
});

// ---------- Init ----------
applyReveals();
updateTheoryUI();
resetVisualState();
trackPageVisit();

/**
 * Contador de visitas vía CountAPI (sin backend ni registro).
 * Se muestra en el panel Opciones, fuera del lienzo 9:16.
 * Nota: también cuenta cargas en localhost al probar.
 */
async function trackPageVisit() {
  const visitCountEl = document.getElementById("visitCount");
  if (!visitCountEl) return;

  const key = "quinterock-paradoja-cumpleanos-visitas";
  const url = `https://countapi.mileshilliard.com/api/v1/hit/${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const n = Number(data.value);
    visitCountEl.textContent = Number.isFinite(n)
      ? n.toLocaleString("es-MX")
      : "—";
  } catch {
    visitCountEl.textContent = "—";
  }
}
