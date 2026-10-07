const data = window.OPERATION_LIMIT_DATA;

const el = {
  projectNameInput: document.querySelector("#projectNameInput"),
  projectNumberInput: document.querySelector("#projectNumberInput"),
  revisionInput: document.querySelector("#revisionInput"),
  generatePdfButton: document.querySelector("#generatePdfButton"),
  saveProjectButton: document.querySelector("#saveProjectButton"),
  undoButton: document.querySelector("#undoButton"),
  redoButton: document.querySelector("#redoButton"),
  loadProjectButton: document.querySelector("#loadProjectButton"),
  loadProjectInput: document.querySelector("#loadProjectInput"),
  twfInput: document.querySelector("#twfInput"),
  windCategorySelect: document.querySelector("#windCategorySelect"),
  limitCategoryControls: document.querySelector("#limitCategoryControls"),
  addLimitCategoryButton: document.querySelector("#addLimitCategoryButton"),
  addActivityButton: document.querySelector("#addActivityButton"),
  activitiesContainer: document.querySelector("#activitiesContainer"),
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let nextActivityId = 1;
let nextCategoryId = 1;
const activities = [];
const limitCategories = [];
const undoStack = [];
const redoStack = [];
const maxUndoSteps = 50;
const forcedTransitHsCategory = "A2 or B - No Environmental Monitoring";
const nseaLogoSvg = `
  <svg class="nsea-report-logo" xmlns="http://www.w3.org/2000/svg" width="39" height="74" viewBox="0 0 39 74" fill="none" aria-label="N-Sea logo">
    <path d="M19.3197 0C29.9897 0 38.4697 7.23999 38.4697 18.27V52.47H28.3097V18.69C28.3097 12.69 24.7997 9.11002 19.3097 9.11002C13.8197 9.11002 10.2497 12.69 10.2497 18.69V52.52H0.179688V18.32C0.179688 7.32001 8.6497 0.0499878 19.3197 0.0499878" fill="#FFEE02"></path>
    <path d="M5 73.1895C4.07065 73.2456 3.1404 73.0955 2.27594 72.7497C1.41148 72.4039 0.63425 71.8711 0 71.1895L0.799988 70.3895C1.32843 70.9894 1.98695 71.4607 2.72522 71.7675C3.46349 72.0742 4.26203 72.2083 5.06 72.1595C7.43 72.1595 8.92999 71.0195 8.92999 69.0595C8.95156 68.6688 8.8886 68.278 8.74536 67.9139C8.60212 67.5497 8.38202 67.2208 8.10004 66.9495C7.48219 66.4553 6.72078 66.1746 5.92999 66.1495L4.17999 65.8695C3.2026 65.7628 2.27442 65.3853 1.5 64.7795C1.10319 64.4394 0.7896 64.0129 0.583313 63.5327C0.377025 63.0525 0.283522 62.5314 0.309998 62.0095C0.309998 59.4995 2.11004 57.8895 4.98004 57.8895C5.77412 57.8577 6.56648 57.9856 7.31024 58.2656C8.054 58.5456 8.734 58.9719 9.31 59.5195L8.57001 60.2595C8.08942 59.7899 7.51738 59.4242 6.88947 59.1851C6.26155 58.946 5.59117 58.8385 4.91998 58.8695C2.73998 58.8695 1.42999 60.0695 1.42999 61.9695C1.39815 62.3403 1.45192 62.7135 1.58716 63.0603C1.7224 63.407 1.93552 63.7181 2.21002 63.9695C2.86477 64.4661 3.63605 64.7863 4.45001 64.8995L6.08002 65.1495C7.05448 65.2014 7.9897 65.5504 8.76001 66.1495C9.18223 66.5056 9.51912 66.9519 9.74585 67.4555C9.97258 67.9592 10.0834 68.5073 10.07 69.0595C10.07 71.5895 8.07 73.2195 5 73.2195" fill="#000"></path>
    <path d="M14.4395 73.0593V58.0293H23.5494V59.0493H15.5795V64.9793H22.3694V65.9893H15.5795V72.0493H23.5494V73.0593H14.4395ZM37.3192 73.0605L36.0092 69.4105H29.0092L27.7092 73.0605H26.4492L31.9792 58.0605H32.9792L38.5092 73.0605H37.3192ZM32.5092 59.5504L29.3592 68.4005H35.6492L32.5092 59.5504" fill="#000"></path>
  </svg>
`;

function toNumber(value) {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatValue(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    return Number.isInteger(value) ? String(value) : value.toFixed(decimals).replace(/\.?0+$/, "");
  }
  return String(value);
}

function formatNumberString(value, decimals = 2) {
  if (value === null || value === undefined || value === "" || value === "-") return value ?? "";
  const number = toNumber(value);
  return number === null ? String(value) : formatValue(number, decimals);
}

function limitDecimalPlaces(value, decimals = 2) {
  const text = String(value ?? "");
  if (!text.includes(".")) return text;
  const [whole, ...rest] = text.split(".");
  return `${whole}.${rest.join("").slice(0, decimals)}`;
}

function formatInputValue(value) {
  const number = toNumber(value);
  return number === null ? "" : formatValue(number);
}

function formatDesignLimitInputValue(value) {
  if (value === "-") return "-";
  return formatInputValue(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function detectCsvDelimiter(text) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
  let commaCount = 0;
  let semicolonCount = 0;
  let quoted = false;

  for (let index = 0; index < sample.length; index += 1) {
    const char = sample[index];
    const next = sample[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') index += 1;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") commaCount += 1;
    else if (char === ";") semicolonCount += 1;
  }

  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(text, delimiter = detectCsvDelimiter(text)) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((items) => items.some((item) => item !== ""));
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseProjectCsv(text) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.includes("Activity")
    && (row.includes("Operation") || row.includes("Main Activity"))
    && row.includes("Variable"));
  if (headerIndex === -1) {
    return { rows: csvToObjects(text), meta: {}, settings: {} };
  }

  const knownKeys = new Set([
    "Project Name",
    "Project Number",
    "Revision",
    "Twf [hrs]",
    "Wind α-factor category",
  ]);
  const meta = {};
  const settings = {};
  rows.slice(0, headerIndex).forEach((row) => {
    row.forEach((cell, index) => {
      if (!knownKeys.has(cell)) return;
      const value = row[index + 1] ?? "";
      if (cell === "Project Name") meta.projectName = value;
      if (cell === "Project Number") meta.projectNumber = value;
      if (cell === "Revision") meta.revision = value;
      if (cell === "Twf [hrs]" || cell === "Twf [h]") settings.twf = value;
      if (cell === "Wind α-factor category" || cell === "Wind alpha-factor category") settings.windCategory = value;
    });
  });

  const headers = rows[headerIndex];
  const bodyRows = rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])))
    .filter((row) => row.Activity || row.Operation || row["Main Activity"] || row.Variable);

  return { rows: bodyRows, meta, settings };
}

function safeFileName(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    || fallback;
}

function reportFileTitle(meta, fallback) {
  return [meta.projectNumber, meta.projectName, meta.revision]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" - ") || fallback;
}

function projectMeta() {
  return {
    projectName: el.projectNameInput.value,
    projectNumber: el.projectNumberInput.value,
    revision: el.revisionInput.value,
  };
}

function setProjectMeta(meta = {}) {
  el.projectNameInput.value = meta.projectName ?? "";
  el.projectNumberInput.value = meta.projectNumber ?? "";
  el.revisionInput.value = meta.revision ?? "";
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentState() {
  return {
    meta: projectMeta(),
    settings: {
      twf: el.twfInput.value,
      windCategory: el.windCategorySelect.value,
    },
    nextActivityId,
    nextCategoryId,
    limitCategories: cloneState(limitCategories),
    activities: cloneState(activities),
  };
}

function pushUndo() {
  undoStack.push(currentState());
  if (undoStack.length > maxUndoSteps) undoStack.shift();
  redoStack.splice(0, redoStack.length);
}

function restoreState(state) {
  setProjectMeta(state.meta);
  el.twfInput.value = formatNumberString(state.settings?.twf ?? data.twf ?? 6);
  if (state.settings?.windCategory) el.windCategorySelect.value = state.settings.windCategory;
  nextActivityId = state.nextActivityId ?? nextActivityId;
  nextCategoryId = state.nextCategoryId ?? nextCategoryId;
  limitCategories.splice(0, limitCategories.length, ...cloneState(state.limitCategories ?? []));
  activities.splice(0, activities.length, ...cloneState(state.activities ?? []));
  renderCategoryControls();
  render();
}

function undoLastChange() {
  const state = undoStack.pop();
  if (!state) return;
  redoStack.push(currentState());
  if (redoStack.length > maxUndoSteps) redoStack.shift();
  restoreState(state);
}

function redoLastChange() {
  const state = redoStack.pop();
  if (!state) return;
  undoStack.push(currentState());
  if (undoStack.length > maxUndoSteps) undoStack.shift();
  restoreState(state);
}

function operationByName(name) {
  return data.operations.find((operation) => operation.name === name) ?? null;
}

function subOperationByName(operation, name) {
  return operation?.subOperations.find((item) => item.name === name) ?? null;
}

function defaultVariables() {
  return [
    { name: "Hs", designLimit: "", unit: "[m]" },
    { name: "Wind", designLimit: "", unit: "[m/s]" },
    { name: "Current", designLimit: "", unit: "[knts]" },
  ];
}

function hasSplitHs(activity) {
  return activity.variables.some((variable) => variable.name === "Hs upper limit")
    && activity.variables.some((variable) => variable.name === "Hs lower limit");
}

function normalizeHsVariableOrder(activity) {
  const upperIndex = activity.variables.findIndex((variable) => variable.name === "Hs upper limit");
  const lowerIndex = activity.variables.findIndex((variable) => variable.name === "Hs lower limit");
  if (upperIndex === -1 || lowerIndex === -1 || upperIndex < lowerIndex) return;

  const [upperVariable] = activity.variables.splice(upperIndex, 1);
  const updatedLowerIndex = activity.variables.findIndex((variable) => variable.name === "Hs lower limit");
  activity.variables.splice(updatedLowerIndex, 0, upperVariable);
}

function splitHsVariables(activity) {
  if (hasSplitHs(activity)) return;
  const hsIndex = activity.variables.findIndex((variable) => variableKind(variable.name) === "hs");
  if (hsIndex === -1) {
    activity.variables.unshift({ name: "Hs lower limit", designLimit: "", unit: "[m]" });
    activity.variables.unshift({ name: "Hs upper limit", designLimit: "", unit: "[m]" });
    return;
  }

  const hsVariable = activity.variables[hsIndex];
  activity.variables.splice(
    hsIndex,
    1,
    { name: "Hs upper limit", designLimit: hsVariable.designLimit, unit: hsVariable.unit || "[m]" },
    { name: "Hs lower limit", designLimit: hsVariable.designLimit, unit: hsVariable.unit || "[m]" },
  );
}

function collapseHsVariables(activity) {
  if (!hasSplitHs(activity)) return;
  const upper = activity.variables.find((variable) => variable.name === "Hs upper limit");
  const lower = activity.variables.find((variable) => variable.name === "Hs lower limit");
  const designLimit = upper?.designLimit || lower?.designLimit || "";
  activity.variables = activity.variables.filter((variable) => variable.name !== "Hs upper limit" && variable.name !== "Hs lower limit");
  const firstHsIndex = activity.variables.findIndex((variable) => variableKind(variable.name) === "hs");
  const hsVariable = { name: "Hs", designLimit, unit: upper?.unit || lower?.unit || "[m]" };
  if (firstHsIndex === -1) activity.variables.unshift(hsVariable);
  else activity.variables.splice(firstHsIndex, 1, hsVariable);
}

function makeActivity(operationName = null, subOperationName = null) {
  const operation = operationByName(operationName) ?? data.operations[0];
  const subOperation = subOperationByName(operation, subOperationName) ?? operation.subOperations[0];
  const activity = {
    id: nextActivityId,
    operationName: operation.name,
    subOperationName: subOperation.name,
    tPop: formatInputValue(subOperation.primary.tPop),
    tC: formatInputValue(subOperation.primary.tC),
    tStripC: formatInputValue(subOperation.strip.tC ?? 1),
    tSafe: formatInputValue(subOperation.timeToAbandon) || "6",
    comment: subOperation.comment ?? "",
    variables: subOperation.variables.map((variable) => ({
      name: variable.name,
      designLimit: formatDesignLimitInputValue(variable.designLimit),
      unit: variable.unit ?? "",
    })),
  };
  normalizeHsVariableOrder(activity);
  return activity;
}

function makeBlankActivity() {
  return {
    id: nextActivityId,
    operationName: "",
    subOperationName: "",
    tPop: "",
    tC: "",
    tStripC: "1",
    tSafe: "",
    comment: "",
    variables: defaultVariables(),
  };
}

function resetActivityFromTemplate(activity) {
  const operation = operationByName(activity.operationName);
  const subOperation = subOperationByName(operation, activity.subOperationName);
  if (!subOperation) {
    activity.tPop = "";
    activity.tC = "";
    activity.tStripC = "1";
    activity.tSafe = activity.tSafe || "6";
    activity.comment = "";
    activity.variables = defaultVariables();
    return;
  }

  activity.tPop = formatInputValue(subOperation.primary.tPop);
  activity.tC = formatInputValue(subOperation.primary.tC);
  activity.tStripC = formatInputValue(subOperation.strip.tC ?? 1);
  activity.tSafe = formatInputValue(subOperation.timeToAbandon) || activity.tSafe || "6";
  activity.comment = subOperation.comment ?? "";
  activity.variables = subOperation.variables.map((variable) => ({
    name: variable.name,
    designLimit: formatDesignLimitInputValue(variable.designLimit),
    unit: variable.unit ?? "",
  }));
  normalizeHsVariableOrder(activity);
}

function operationSuggestions() {
  return data.operations.map((operation) => operation.name);
}

function subOperationSuggestions(activity) {
  const operation = operationByName(activity.operationName);
  if (!operation) {
    return data.operations.flatMap((item) => item.subOperations.map((subOperation) => subOperation.name));
  }
  return operation.subOperations.map((subOperation) => subOperation.name);
}

function activityFieldLabel(field) {
  if (field === "operationName") return "Main activity";
  if (field === "subOperationName") return "Sub activity";
  return "";
}

function textInputCell(activity, field, value, values) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  const label = activityFieldLabel(field);
  const options = uniqueValues.map((option) => `
    <button class="combo-option" data-activity-id="${activity.id}" data-field="${field}" data-value="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>
  `).join("");
  return `
    <span class="combo-cell">
      <input class="table-input text-table-input" data-activity-id="${activity.id}" data-field="${field}" aria-label="${escapeHtml(label || field)}" title="${escapeHtml(label || field)}" value="${escapeHtml(value)}">
      <button class="combo-toggle" data-activity-id="${activity.id}" data-field="${field}" type="button" aria-label="Show options">v</button>
      <span class="combo-menu">${options}</span>
    </span>
  `;
}

function inputCell(activity, field, value, step = "0.5") {
  return `<input class="table-input" data-activity-id="${activity.id}" data-field="${field}" type="number" step="${step}" value="${escapeHtml(formatNumberString(value))}">`;
}

function designLimitInputCell(activity, field, value) {
  return `<input class="table-input" data-activity-id="${activity.id}" data-field="${field}" type="text" inputmode="decimal" value="${escapeHtml(formatNumberString(value))}">`;
}

function getTimeKey(table, lookupTpop) {
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
    .find((time) => lookupTpop <= time);
}

function interpolateHs(tableByHs, hs) {
  const points = Object.entries(tableByHs)
    .map(([key, value]) => ({ hs: Number(key), alpha: Number(value) }))
    .filter((point) => Number.isFinite(point.hs) && Number.isFinite(point.alpha))
    .sort((a, b) => a.hs - b.hs);
  const hsValues = points.map((point) => point.hs);
  if (!hsValues.length) return null;

  const cappedHs = Math.min(Math.max(hs, hsValues[0]), hsValues[hsValues.length - 1]);
  for (let index = 0; index < points.length - 1; index += 1) {
    const lowerHs = points[index].hs;
    const upperHs = points[index + 1].hs;
    if (lowerHs <= cappedHs && cappedHs <= upperHs) {
      const lowerAlpha = points[index].alpha;
      const upperAlpha = points[index + 1].alpha;
      const fraction = (cappedHs - lowerHs) / (upperHs - lowerHs);
      return lowerAlpha + fraction * (upperAlpha - lowerAlpha);
    }
  }

  return points[points.length - 1].alpha;
}

function lookupDetails(activity) {
  const twf = toNumber(el.twfInput.value) ?? 0;
  const tSafe = toNumber(activity.tSafe) ?? 0;
  const tPop = toNumber(activity.tPop);
  const tC = toNumber(activity.tC);
  const tR = tPop === null || tC === null ? null : tPop + tC;
  const primaryInRange = tPop !== null && tC !== null && tPop <= 72 && tR <= 96;
  const tStripPop = twf + tSafe;
  const tStripC = toNumber(activity.tStripC) ?? 1;
  const tStripR = tStripPop + tStripC;

  if (primaryInRange) {
    return { mode: "primary", lookupTpop: tPop, tR, primaryInRange, tStripPop, tStripC, tStripR };
  }
  if (tStripPop <= 72 && tStripR <= 96) {
    return { mode: "strip", lookupTpop: tStripPop, tR, primaryInRange, tStripPop, tStripC, tStripR };
  }
  return { mode: "unrestricted", tR, primaryInRange, tStripPop, tStripC, tStripR };
}

function shouldShowStripColumns(activity, details) {
  const tPop = toNumber(activity.tPop);
  return tPop !== null && details.tR !== null && tPop > 72 && details.tR > 96;
}

function variableKind(name) {
  const normalized = String(name ?? "").toLowerCase();
  if (normalized.includes("wind")) return "wind";
  if (normalized.includes("current")) return "current";
  if (normalized.includes("hs")) return "hs";
  return "other";
}

function isTransitVesselTransit(activity) {
  return String(activity?.operationName ?? "").trim().toLowerCase() === "transit"
    && String(activity?.subOperationName ?? "").trim().toLowerCase() === "vessel transit";
}

function effectiveLimitCategory(activity, limitCategory) {
  if (isTransitVesselTransit(activity)) {
    return { ...limitCategory, hsCategory: forcedTransitHsCategory };
  }
  return limitCategory;
}

function alphaForVariable(variable, details, limitCategory, activity = null) {
  const designLimit = toNumber(variable.designLimit);
  if (details.mode === "unrestricted" || designLimit === null) return { alpha: null, limit: null };

  const kind = variableKind(variable.name);
  if (kind === "hs") {
    const category = effectiveLimitCategory(activity, limitCategory);
    const table = data.alphaHs[category.hsCategory];
    const timeKey = table ? getTimeKey(table, details.lookupTpop) : null;
    const alpha = timeKey ? interpolateHs(table[String(timeKey)], designLimit) : null;
    return { alpha, limit: alpha === null ? null : alpha * designLimit };
  }

  if (kind === "wind") {
    const table = data.alphaWind[el.windCategorySelect.value];
    const timeKey = table ? getTimeKey(table, details.lookupTpop) : null;
    const alpha = timeKey ? table[String(timeKey)] : null;
    return { alpha, limit: alpha === null ? null : alpha * designLimit };
  }

  if (kind === "current") return { alpha: null, limit: designLimit };
  return { alpha: null, limit: null };
}

function categoryLabel(index) {
  return alphabet[index] ?? String(index + 1);
}

function addLimitCategory(recordUndo = true) {
  if (recordUndo) pushUndo();
  const categories = Object.keys(data.alphaHs);
  limitCategories.push({
    id: nextCategoryId,
    hsCategory: categories[Math.min(limitCategories.length, categories.length - 1)] ?? categories[0],
  });
  nextCategoryId += 1;
  renderCategoryControls();
  render();
}

function removeLimitCategory(id) {
  if (limitCategories.length === 1) return;
  const index = limitCategories.findIndex((category) => category.id === Number(id));
  if (index === -1) return;
  pushUndo();
  limitCategories.splice(index, 1);
  renderCategoryControls();
  render();
}

function renderCategoryControls() {
  const options = Object.keys(data.alphaHs);
  el.limitCategoryControls.innerHTML = limitCategories.map((category, index) => `
    <label class="field limit-category-field">
      <span>Operational limit ${categoryLabel(index)}</span>
      <span class="category-select-row">
        <select data-category-id="${category.id}">
          ${options.map((option) => `<option value="${escapeHtml(option)}"${option === category.hsCategory ? " selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
        ${limitCategories.length > 1 ? `<button class="small-remove-category" data-category-id="${category.id}" type="button">x</button>` : ""}
      </span>
    </label>
  `).join("");
}

function renderColGroup(showStripColumns) {
  const stripCols = showStripColumns
    ? '<col class="time-col"><col class="time-col"><col class="time-col">'
    : "";
  const limitCols = limitCategories.map(() => '<col class="alpha-col"><col class="limit-col">').join("");
  return `
    <colgroup>
      <col class="number-col">
      <col class="time-col">
      <col class="time-col">
      <col class="time-col">
      ${stripCols}
      <col class="variable-col">
      <col class="design-col">
      <col class="unit-col">
      ${limitCols}
      <col class="comment-col">
      <col class="tsafe-col">
    </colgroup>
  `;
}

function renderTables() {
  return activities.map((activity, activityIndex) => {
    normalizeHsVariableOrder(activity);
    const details = lookupDetails(activity);
    const showStripColumns = shouldShowStripColumns(activity, details);
    const variables = activity.variables.length ? activity.variables : defaultVariables();
    const baseColumns = 7 + (showStripColumns ? 3 : 0);
    const totalColumns = baseColumns + (limitCategories.length * 2) + 2;
    const categoryCells = limitCategories.map((category) => {
      const effectiveCategory = effectiveLimitCategory(activity, category);
      return `<td colspan="2" class="operation-category-name">${escapeHtml(effectiveCategory.hsCategory)}</td>`;
    }).join("");
    const categoryHeaders = limitCategories.map(() => '<th class="alpha-header">α-factor</th><th>Operational limit</th>').join("");
    const stripHeaders = showStripColumns
      ? '<th title="The new planned operation duration based on the TSAFE + TWF">T&apos;pop<br><span>[hrs]</span></th><th title="Contingency time to cease the operation">T&apos;C<br><span>[hrs]</span></th><th title="The new operation reference duration, T&apos;POP plus T&apos;C for ceasing the operation.">T&apos;R<br><span>[hrs]</span></th>'
      : "";
    const stripCells = showStripColumns
      ? `
        <td rowspan="${variables.length}" class="number">${formatValue(details.tStripPop)}</td>
        <td rowspan="${variables.length}" class="number">${inputCell(activity, "tStripC", activity.tStripC)}</td>
        <td rowspan="${variables.length}" class="number">${formatValue(details.tStripR)}</td>
      `
      : "";

    const operationHeader = `
      <tr class="operation-section-row">
        <td colspan="${totalColumns}">
          <button class="activity-add-button" data-activity-id="${activity.id}" type="button">Add operation</button>
          <span class="operation-section-inputs">
            ${textInputCell(activity, "operationName", activity.operationName, operationSuggestions())}
          </span>
          <button class="split-hs-button" data-activity-id="${activity.id}" type="button">${hasSplitHs(activity) ? "Single Hs" : "Split Hs"}</button>
          <button class="remove-activity section-remove" data-activity-id="${activity.id}" type="button">Remove</button>
        </td>
      </tr>
      <tr class="category-row">
        <td colspan="${baseColumns}" class="sub-activity-cell">${textInputCell(activity, "subOperationName", activity.subOperationName, subOperationSuggestions(activity))}</td>
        ${categoryCells}
        <td colspan="2"></td>
      </tr>
      <tr>
        <th>No.</th>
        <th title="Planned operation duration">Tpop<br><span>[hrs]</span></th>
        <th title="Contingency time of the planned duration">Tc<br><span>[hrs]</span></th>
        <th title="Operation reference duration, the planned operation duration plus contingency duration (TPOP + Tc)">TR<br><span>[hrs]</span></th>
        ${stripHeaders}
        <th>Variable</th>
        <th>Design limit</th>
        <th>Unit</th>
        ${categoryHeaders}
        <th>Note</th>
        <th class="tsafe-header" title="Estimated time to safely cease the operation">T safe<br><span>[hrs]</span></th>
      </tr>
    `;

    const variableRows = variables.map((variable, variableIndex) => {
      const leadingCells = variableIndex === 0
        ? `
          <td rowspan="${variables.length}" class="row-index">${activityIndex + 1}</td>
          <td rowspan="${variables.length}" class="number">${inputCell(activity, "tPop", activity.tPop)}</td>
          <td rowspan="${variables.length}" class="number">${inputCell(activity, "tC", activity.tC)}</td>
          <td rowspan="${variables.length}" class="number">${formatValue(details.tR)}</td>
          ${stripCells}
        `
        : "";
      const limitCells = limitCategories.map((category) => {
        const result = alphaForVariable(variable, details, category, activity);
        return `
          <td class="number">${escapeHtml(formatValue(result.alpha))}</td>
          <td class="number operation-limit-cell">${escapeHtml(formatValue(result.limit))}</td>
        `;
      }).join("");
      const endCells = variableIndex === 0
        ? `
          <td rowspan="${variables.length}"><textarea class="comment-cell" data-activity-id="${activity.id}" data-field="comment">${escapeHtml(activity.comment)}</textarea></td>
          <td rowspan="${variables.length}" class="tsafe-cell">${inputCell(activity, "tSafe", activity.tSafe)}</td>
        `
        : "";

      return `
        <tr>
          ${leadingCells}
          <td>${escapeHtml(variable.name ?? "")}</td>
          <td>${designLimitInputCell(activity, `designLimit:${variableIndex}`, variable.designLimit)}</td>
          <td>${escapeHtml(variable.unit ?? "")}</td>
          ${limitCells}
          ${endCells}
        </tr>
      `;
    }).join("");

    return `
      <table class="operation-table">
        ${renderColGroup(showStripColumns)}
        <tbody>${operationHeader}${variableRows}</tbody>
      </table>
    `;
  }).join("");
}

function render() {
  el.activitiesContainer.innerHTML = `
    <section class="panel excel-panel">
      <div class="table-wrap">
        ${renderTables()}
      </div>
    </section>
  `;
}

function addActivity() {
  pushUndo();
  nextActivityId += 1;
  activities.push(makeBlankActivity());
  render();
}

function addActivityAfter(id) {
  const index = activities.findIndex((activity) => activity.id === Number(id));
  pushUndo();
  nextActivityId += 1;
  const newActivity = makeBlankActivity();
  activities.splice(index === -1 ? activities.length : index + 1, 0, newActivity);
  render();
}

function findActivity(id) {
  return activities.find((activity) => activity.id === Number(id));
}

function initSelect(select, values) {
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function saveProject() {
  const csv = projectCsv();
  const meta = projectMeta();
  const rawName = [meta.projectNumber, meta.projectName, meta.revision]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("_");
  const filename = `${safeFileName(rawName, "operational-limit-project")}.csv`;
  downloadText(filename, csv, "text/csv");
}

function loadProjectFromRows(rows, meta = {}, settings = {}) {
  if (!rows.length) throw new Error("No CSV rows found.");

  const firstRow = rows[0];
  setProjectMeta({
    projectName: meta.projectName ?? firstRow["Project Name"],
    projectNumber: meta.projectNumber ?? firstRow["Project Number"],
    revision: meta.revision ?? firstRow.Revision,
  });
  el.twfInput.value = formatNumberString(settings.twf || firstRow.Twf || data.twf || 6);
  const windCategory = settings.windCategory || firstRow["Wind Category"];
  if (windCategory) el.windCategorySelect.value = windCategory;

  limitCategories.splice(0, limitCategories.length);
  const categoryEntries = Object.keys(firstRow)
    .map((key) => key.match(/^Category ([A-Z]+)$/)?.[1])
    .filter(Boolean)
    .map((label) => ({ label, hsCategory: firstRow[`Category ${label}`] }))
    .filter((category) => category.hsCategory);
  (categoryEntries.length ? categoryEntries : [{ hsCategory: Object.keys(data.alphaHs)[0] }]).forEach((category) => {
    limitCategories.push({
      id: nextCategoryId,
      hsCategory: category.hsCategory,
    });
    nextCategoryId += 1;
  });

  activities.splice(0, activities.length);
  const groupedRows = new Map();
  rows.forEach((row) => {
    const key = row.Activity || String(groupedRows.size + 1);
    if (!groupedRows.has(key)) groupedRows.set(key, []);
    groupedRows.get(key).push(row);
  });

  groupedRows.forEach((activityRows) => {
    const row = activityRows[0];
    const activity = {
      id: nextActivityId,
      operationName: row["Main Activity"] || row.Operation || "",
      subOperationName: row["Sub Activity"] || row["Sub Operation"] || "",
      tPop: row.Tpop || "",
      tC: row.Tc || "",
      tStripC: row["T'C"] || "1",
      tSafe: row.Tsafe || "6",
      comment: row.Note || "",
      variables: activityRows.map((item) => ({
        name: item.Variable || "",
        designLimit: item["Design limit"] || "",
        unit: item.Unit || "",
      })).filter((variable) => variable.name),
    };
    normalizeHsVariableOrder(activity);
    activities.push(activity);
    nextActivityId += 1;
  });

  if (!activities.length) activities.push(makeActivity());

  renderCategoryControls();
  render();
}

function loadProjectFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsedProject = parseProjectCsv(String(reader.result));
      pushUndo();
      loadProjectFromRows(parsedProject.rows, parsedProject.meta, parsedProject.settings);
    } catch (error) {
      alert("Could not load project file. Please select a valid saved Operational Limit CSV file.");
    }
  });
  reader.readAsText(file);
}

function flattenedRows() {
  const meta = projectMeta();
  return activities.flatMap((activity, activityIndex) => {
    normalizeHsVariableOrder(activity);
    const details = lookupDetails(activity);
    return activity.variables.map((variable) => {
      const limitValues = {};
      limitCategories.forEach((category, categoryIndex) => {
        const result = alphaForVariable(variable, details, category, activity);
        const effectiveCategory = effectiveLimitCategory(activity, category);
        const label = categoryLabel(categoryIndex);
        limitValues[`α-factor ${label}`] = formatValue(result.alpha);
        limitValues[`Operational limit ${label}`] = formatValue(result.limit);
        limitValues[`Category ${label}`] = effectiveCategory.hsCategory;
      });
      return {
        "Project Name": meta.projectName,
        "Project Number": meta.projectNumber,
        Revision: meta.revision,
        Twf: formatNumberString(el.twfInput.value),
        "Wind Category": el.windCategorySelect.value,
        Activity: activityIndex + 1,
        "Main Activity": activity.operationName,
        "Sub Activity": activity.subOperationName,
        Tpop: formatNumberString(activity.tPop),
        Tc: formatNumberString(activity.tC),
        TR: formatValue(details.tR),
        "T'pop": shouldShowStripColumns(activity, details) ? formatValue(details.tStripPop) : "",
        "T'C": shouldShowStripColumns(activity, details) ? formatNumberString(activity.tStripC) : "",
        "T'R": shouldShowStripColumns(activity, details) ? formatValue(details.tStripR) : "",
        Variable: variable.name,
        "Design limit": formatNumberString(variable.designLimit),
        Unit: variable.unit,
        ...limitValues,
        Note: activity.comment,
        Tsafe: formatNumberString(activity.tSafe),
      };
    });
  });
}

function projectCsv() {
  const meta = projectMeta();
  const rows = flattenedRows();
  const headers = reportHeaders();
  return [
    ["Weather Assessment Table"].map(csvEscape).join(","),
    ["Project Name", meta.projectName, "", "Project Number", meta.projectNumber, "", "Revision", meta.revision].map(csvEscape).join(","),
    ["Twf [hrs]", formatNumberString(el.twfInput.value), "", "Wind α-factor category", el.windCategorySelect.value].map(csvEscape).join(","),
    ["DISCLAIMER: No consequences can be inferred from the limitations provided in this table."].map(csvEscape).join(","),
    ["Operations and Limits"].map(csvEscape).join(","),
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function reportHeaders() {
  const fixedHeaders = ["Activity", "Main Activity", "Sub Activity", "Tpop", "Tc", "TR", "T'pop", "T'C", "T'R", "Variable", "Design limit", "Unit"];
  const categoryHeaders = limitCategories.flatMap((category, categoryIndex) => {
    const label = categoryLabel(categoryIndex);
    return [`Category ${label}`, `α-factor ${label}`, `Operational limit ${label}`];
  });
  return [...fixedHeaders, ...categoryHeaders, "Note", "Tsafe"];
}

function generatePdfReport() {
  const rows = flattenedRows();
  const meta = projectMeta();
  const pdfTitle = reportFileTitle(meta, "Operational Limit Report");
  const showStripColumns = rows.some((row) => row["T'pop"] || row["T'C"] || row["T'R"]);
  const leadingHeaders = ["Activity", "Tpop", "Tc", "TR", ...(showStripColumns ? ["T'pop", "T'C", "T'R"] : [])];
  const detailHeaders = ["Variable", "Design limit", "Unit"];
  const limitHeaders = limitCategories.flatMap((category, index) => {
    const label = categoryLabel(index);
    return [
      { key: `α-factor ${label}`, label: "α-factor" },
      { key: `Operational limit ${label}`, label: "Operational limit" },
    ];
  });
  const headers = [...leadingHeaders, ...detailHeaders, ...limitHeaders, "Note", "Tsafe"];
  const fixedHeaderCount = leadingHeaders.length + detailHeaders.length;
  const categoryGroupHeaders = limitCategories.map((category) => `
    <th colspan="2">${escapeHtml(category.hsCategory)}<br><span>Operational Limit</span></th>
  `).join("");
  const groupedRows = [];
  rows.forEach((row) => {
    let group = groupedRows[groupedRows.length - 1];
    if (!group || group.activity !== row.Activity) {
      group = { activity: row.Activity, mainActivity: row["Main Activity"] ?? "", rows: [] };
      groupedRows.push(group);
    }
    group.rows.push(row);
  });
  const colGroup = [
    '<col class="activity-col">',
    '<col class="time-col">',
    '<col class="time-col">',
    '<col class="time-col">',
    ...(showStripColumns ? ['<col class="time-col">', '<col class="time-col">', '<col class="time-col">'] : []),
    '<col class="variable-col">',
    '<col class="design-col">',
    '<col class="unit-col">',
    ...limitCategories.flatMap(() => ['<col class="alpha-col">', '<col class="limit-col">']),
    '<col class="note-col">',
    '<col class="tsafe-col">',
  ].join("");
  const htmlRows = groupedRows.map((group, groupIndex) => {
    const rowSpan = group.rows.length;
    const previousGroup = groupedRows[groupIndex - 1];
    const showMainActivityRow = !previousGroup || previousGroup.mainActivity !== group.mainActivity;
    const mainActivityRow = showMainActivityRow
      ? `
        <tr class="main-activity-row">
          <td colspan="${headers.length}">${escapeHtml(group.mainActivity)}</td>
        </tr>
      `
      : "";
    return mainActivityRow + group.rows.map((row, index) => {
      const leadingCells = index === 0 ? leadingHeaders.map((header) => `
        <td rowspan="${rowSpan}" class="center strong">${escapeHtml(header === "Activity" ? (row["Sub Activity"] ?? "") : (row[header] ?? ""))}</td>
      `).join("") : "";
      const detailCells = detailHeaders.map((header) => `<td class="${header === "Variable" ? "" : "center"}">${escapeHtml(row[header] ?? "")}</td>`).join("");
      const limitCells = limitCategories.flatMap((category, categoryIndex) => {
        const label = categoryLabel(categoryIndex);
        return [
          `<td class="center strong">${escapeHtml(row[`α-factor ${label}`] ?? row[`Alfa factor ${label}`] ?? "")}</td>`,
          `<td class="center strong">${escapeHtml(row[`Operational limit ${label}`] ?? "")}</td>`,
        ];
      }).join("");
      const endCells = index === 0 ? `
        <td rowspan="${rowSpan}" class="note">${escapeHtml(row.Note ?? "")}</td>
        <td rowspan="${rowSpan}" class="center strong">${escapeHtml(row.Tsafe ?? "")}</td>
      ` : "";
      return `<tr>${leadingCells}${detailCells}${limitCells}${endCells}</tr>`;
    }).join("");
  }).join("");
  const hasHsLowerLimit = rows.some((row) => String(row.Variable ?? "").trim().toLowerCase() === "hs lower limit");
  const hasHsUpperLimit = rows.some((row) => String(row.Variable ?? "").trim().toLowerCase() === "hs upper limit");
  const pdfColspan = headers.length;
  const hsNoteRows = [
    `
      <tr class="limit-explanation general-note-title">
        <td colspan="${pdfColspan}">General Note:</td>
      </tr>
      <tr class="limit-explanation general-note-disclaimer">
        <td colspan="${pdfColspan}">The decision to proceed with operation lies with (D)OCM even though no weather limits has been exceeded. At all times, the safety of the vessel and all personnel upon the vessel is to the authority of the Vessel Master.</td>
      </tr>
    `,
    hasHsLowerLimit ? `
      <tr class="limit-explanation">
        <td colspan="${pdfColspan}">H<sub>s</sub><sub>lower_limit</sub> = Significant wave height and period, which can be worked with regardless of wave heading or wave period.</td>
      </tr>
    ` : "",
    hasHsUpperLimit ? `
      <tr class="limit-explanation">
        <td colspan="${pdfColspan}">H<sub>s</sub><sub>upper_limit</sub> = Significant wave height and period, which can be worked in certain wave headings or wave periods. Cross checks against the Cable Analysis Report is required.</td>
      </tr>
    ` : "",
  ].join("");
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Please allow pop-ups to generate the PDF report.");
    return;
  }

  reportWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(pdfTitle)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Calibri, Arial, sans-serif; color: #000; margin: 18px; }
          .title { position: relative; display: flex; align-items: center; justify-content: center; min-height: 70px; background: #002060; color: #fff; font-size: 20px; font-weight: 700; text-align: center; padding: 12px 82px; }
          .report-logo-wrap { position: absolute; left: 18px; top: 7px; display: flex; align-items: center; justify-content: center; width: 48px; height: 56px; background: #fff; }
          .nsea-report-logo { display: block; width: 30px; height: 52px; }
          .disclaimer { border: 1px solid #8c8c8c; border-top: 0; padding: 6px; text-align: center; font-size: 10px; }
          .meta { width: 36%; min-width: 360px; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          .meta th, .meta td { border: 1px solid #8c8c8c; padding: 6px 8px; text-align: left; min-height: 24px; }
          .meta th { width: 38%; background: #d9e2ef; color: #000; }
          .spacer { height: 18px; }
          .twf { width: 42%; min-width: 440px; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
          .twf td { border: 1px solid #8c8c8c; padding: 5px 7px; background: #f2f2f2; }
          .twf td:first-child { width: 70px; font-weight: 700; }
          .twf td:last-child { width: 70px; text-align: center; font-weight: 700; }
          table.report { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
          .report th, .report td { border: 1px solid #8c8c8c; padding: 4px 5px; vertical-align: middle; overflow-wrap: anywhere; }
          .report .band th { background: #002060; color: #fff; font-size: 11px; text-align: center; }
          .report .main-activity-row td { background: #9dc3e6; color: #000; font-weight: 700; text-align: left; }
          .report .header th { background: #d9e2ef; text-align: center; font-weight: 700; }
          .report td { background: #f2f2f2; }
          .report .center { text-align: center; }
          .report .strong { font-weight: 700; }
          .report .note { white-space: pre-line; }
          .report .limit-explanation td { background: #fff; font-size: 9px; }
          .report .general-note-title td { background: #dfe8dd; font-weight: 700; }
          .report .general-note-disclaimer td { background: #fff; font-weight: 700; }
          .activity-col { width: 145px; }
          .time-col { width: 42px; }
          .variable-col { width: 58px; }
          .design-col { width: 58px; }
          .unit-col { width: 50px; }
          .alpha-col { width: 56px; }
          .limit-col { width: 72px; }
          .note-col { width: 210px; }
          .tsafe-col { width: 48px; }
          @page { size: A3 landscape; margin: 10mm; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="title"><span class="report-logo-wrap">${nseaLogoSvg}</span><span>Weather Assessment Table</span></div>
        <div class="disclaimer">DISCLAIMER: No consequences can be inferred from the limitations provided in this table.</div>
        <table class="meta">
          <tr><th>Project Name</th><td>${escapeHtml(meta.projectName)}</td></tr>
          <tr><th>Project Number</th><td>${escapeHtml(meta.projectNumber)}</td></tr>
          <tr><th>Revision</th><td>${escapeHtml(meta.revision)}</td></tr>
        </table>
        <div class="spacer"></div>
        <table class="twf">
          <tr>
            <td><strong>Twf</strong></td>
            <td>The time between receiving consecutive weather forecasts</td>
            <td><strong>${escapeHtml(formatNumberString(el.twfInput.value))}</strong></td>
          </tr>
        </table>
        <table class="report">
          <colgroup>${colGroup}</colgroup>
          <thead>
            <tr class="band">
              <th colspan="${fixedHeaderCount}">Operations and Limits</th>
              ${categoryGroupHeaders}
              <th colspan="2">Abandonment / Cease Operation</th>
            </tr>
            <tr class="header">${headers.map((header) => `<th>${escapeHtml(typeof header === "string" ? header : header.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>${htmlRows}${hsNoteRows}</tbody>
        </table>
        <script>window.addEventListener("load", () => window.print());<\/script>
      </body>
    </html>
  `);
  reportWindow.document.close();
}

function init() {
  el.twfInput.value = formatNumberString(data.twf ?? 6);
  initSelect(el.windCategorySelect, Object.keys(data.alphaWind));
  addLimitCategory(false);
  activities.push(makeBlankActivity());
  render();

  el.addActivityButton?.addEventListener("click", addActivity);
  el.addLimitCategoryButton.addEventListener("click", addLimitCategory);
  el.generatePdfButton.addEventListener("click", generatePdfReport);
  el.saveProjectButton.addEventListener("click", saveProject);
  el.undoButton.addEventListener("click", undoLastChange);
  el.redoButton.addEventListener("click", redoLastChange);
  el.loadProjectButton.addEventListener("click", () => el.loadProjectInput.click());
  el.loadProjectInput.addEventListener("change", () => {
    const file = el.loadProjectInput.files?.[0];
    if (file) loadProjectFile(file);
    el.loadProjectInput.value = "";
  });
  [el.projectNameInput, el.projectNumberInput, el.revisionInput].forEach((input) => {
    input.addEventListener("focus", () => pushUndo(), { once: false });
  });
  el.twfInput.addEventListener("focus", () => pushUndo());
  el.twfInput.addEventListener("input", () => {
    el.twfInput.value = limitDecimalPlaces(el.twfInput.value);
  });
  el.twfInput.addEventListener("change", () => {
    el.twfInput.value = formatNumberString(el.twfInput.value);
    render();
  });
  el.windCategorySelect.addEventListener("focus", () => pushUndo());
  el.windCategorySelect.addEventListener("change", render);

  el.limitCategoryControls.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const category = limitCategories.find((item) => item.id === Number(target.dataset.categoryId));
    if (!category) return;
    pushUndo();
    category.hsCategory = target.value;
    render();
  });

  el.limitCategoryControls.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (!target.classList.contains("small-remove-category")) return;
    removeLimitCategory(target.dataset.categoryId);
  });

  el.activitiesContainer.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    const activity = findActivity(target.dataset.activityId);
    if (!activity) return;
    const field = target.dataset.field;

    if (field === "comment") {
      pushUndo();
      activity.comment = target.value;
      return;
    }
    if (field?.startsWith("designLimit:")) {
      const index = Number(field.split(":")[1]);
      target.value = limitDecimalPlaces(target.value);
      pushUndo();
      activity.variables[index].designLimit = target.value;
      return;
    }
    if (["tPop", "tC", "tStripC", "tSafe"].includes(field)) {
      target.value = limitDecimalPlaces(target.value);
    }
    pushUndo();
    activity[field] = target.value;
  });

  el.activitiesContainer.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    if (target.dataset.field !== "comment" || !event.altKey || event.key !== "Enter") return;

    event.preventDefault();
    pushUndo();
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
    target.selectionStart = start + 1;
    target.selectionEnd = start + 1;

    const activity = findActivity(target.dataset.activityId);
    if (activity) activity.comment = target.value;
  });

  el.activitiesContainer.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const activity = findActivity(target.dataset.activityId);
    if (!activity) return;

    if (target.dataset.field === "operationName") {
      pushUndo();
      activity.operationName = target.value;
      const operation = operationByName(target.value);
      if (operation) {
        activity.subOperationName = operation.subOperations[0].name;
        resetActivityFromTemplate(activity);
      }
      render();
      return;
    }

    if (target.dataset.field === "subOperationName") {
      pushUndo();
      activity.subOperationName = target.value;
      if (subOperationByName(operationByName(activity.operationName), target.value)) {
        resetActivityFromTemplate(activity);
      }
      render();
      return;
    }

    const field = target.dataset.field;
    if (field?.startsWith("designLimit:")) {
      const index = Number(field.split(":")[1]);
      if (activity.variables[index]) activity.variables[index].designLimit = formatNumberString(activity.variables[index].designLimit);
    } else if (["tPop", "tC", "tStripC", "tSafe"].includes(field)) {
      activity[field] = formatNumberString(activity[field]);
    }

    render();
  });

  el.activitiesContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    if (target.classList.contains("combo-toggle")) {
      const combo = target.closest(".combo-cell");
      const isOpen = combo?.classList.contains("is-open");
      el.activitiesContainer.querySelectorAll(".combo-cell.is-open").forEach((item) => item.classList.remove("is-open"));
      if (combo && !isOpen) combo.classList.add("is-open");
      return;
    }

    if (target.classList.contains("combo-option")) {
      const activity = findActivity(target.dataset.activityId);
      const field = target.dataset.field;
      if (!activity || !field) return;
      pushUndo();

      if (field === "operationName") {
        activity.operationName = target.dataset.value ?? "";
        const operation = operationByName(activity.operationName);
        if (operation) {
          activity.subOperationName = operation.subOperations[0].name;
          resetActivityFromTemplate(activity);
        }
        render();
        return;
      }

      if (field === "subOperationName") {
        activity.subOperationName = target.dataset.value ?? "";
        if (subOperationByName(operationByName(activity.operationName), activity.subOperationName)) {
          resetActivityFromTemplate(activity);
        }
        render();
        return;
      }
    }

    if (target.classList.contains("split-hs-button")) {
      const activity = findActivity(target.dataset.activityId);
      if (!activity) return;
      pushUndo();
      if (hasSplitHs(activity)) collapseHsVariables(activity);
      else splitHsVariables(activity);
      render();
      return;
    }

    if (target.classList.contains("activity-add-button")) {
      addActivityAfter(target.dataset.activityId);
      return;
    }

    if (!target.classList.contains("remove-activity")) return;
    const index = activities.findIndex((activity) => activity.id === Number(target.dataset.activityId));
    if (index === -1 || activities.length === 1) return;
    pushUndo();
    activities.splice(index, 1);
    render();
  });
}

init();
