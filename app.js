(function () {
  "use strict";

  const config = window.ZOUSEI_COST_DATA;
  const STORAGE_KEY = config.storageKey;
  const RANGE_KEYS = ["low", "standard", "high"];
  const RANGE_LABELS = {
    low: "低め",
    standard: "標準",
    high: "高め"
  };
  const FEE_LABELS = {
    buildingDemolition: "建物解体費",
    treesStonesRemoval: "樹木・庭石撤去費",
    blockWallRemoval: "ブロック塀撤去費",
    waterConnection: "上水道引込費",
    sewerConnection: "下水道引込費",
    gasConnection: "ガス引込費",
    stormwaterDrainage: "雨水排水整備費",
    survey: "測量費",
    design: "設計費",
    permit: "申請費",
    geotechSurvey: "地盤調査費",
    groundImprovement: "地盤改良費"
  };

  let migrationNeeded = false;
  let appState = loadAppState();
  let saveTimer = null;

  document.addEventListener("DOMContentLoaded", () => {
    hydrateForm();
    bindEvents();
    updateWallFieldState();
    render();
    if (migrationNeeded) {
      saveState();
    } else {
      setSaveStatus("保存済み");
    }
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeDeep(base, override) {
    const output = clone(base);
    if (!override || typeof override !== "object") return output;

    Object.keys(override).forEach((key) => {
      const baseValue = output[key];
      const overrideValue = override[key];
      if (
        baseValue &&
        overrideValue &&
        typeof baseValue === "object" &&
        typeof overrideValue === "object" &&
        !Array.isArray(baseValue) &&
        !Array.isArray(overrideValue)
      ) {
        output[key] = mergeDeep(baseValue, overrideValue);
      } else {
        output[key] = overrideValue;
      }
    });

    return output;
  }

  function loadAppState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        migrationNeeded = true;
        return createInitialAppState();
      }
      return normalizeStoredData(JSON.parse(raw));
    } catch (error) {
      console.warn("保存データを読み込めませんでした。初期値で開始します。", error);
      migrationNeeded = true;
      return createInitialAppState();
    }
  }

  function normalizeStoredData(parsed) {
    if (parsed && Array.isArray(parsed.projects)) {
      const unitPrices = normalizeUnitPrices(parsed.unitPrices || {});
      const seenIds = new Set();
      const projects = parsed.projects.map((project) => normalizeProject(project, seenIds));

      if (!projects.length) {
        projects.push(createProject());
        migrationNeeded = true;
      }

      const currentProjectId = projects.some((project) => project.id === parsed.currentProjectId)
        ? parsed.currentProjectId
        : projects[0].id;

      return {
        currentProjectId,
        projects,
        unitPrices
      };
    }

    migrationNeeded = true;
    return migrateLegacyState(parsed || {});
  }

  function migrateLegacyState(legacy) {
    const unitPrices = normalizeUnitPrices({
      difficultyRates: legacy.difficultyRates,
      wallUnknownRiskRates: legacy.wallUnknownRiskRates
    });
    const now = getTimestamp();
    const project = createProject({
      name: legacy.name || legacy.projectName || config.defaultProjectName,
      location: legacy.location || "",
      lotNumber: legacy.lotNumber || "",
      propertyType: legacy.propertyType || config.defaultPropertyType,
      createdAt: legacy.createdAt || now,
      updatedAt: legacy.updatedAt || now,
      input: legacy
    });

    return {
      currentProjectId: project.id,
      projects: [project],
      unitPrices
    };
  }

  function normalizeUnitPrices(unitPrices) {
    return mergeDeep(config.defaultUnitPrices, unitPrices || {});
  }

  function normalizeProject(project, seenIds) {
    const now = getTimestamp();
    let id = project && project.id ? String(project.id) : createProjectId();
    if (seenIds.has(id)) id = createProjectId();
    seenIds.add(id);
    if (!project || !project.input || !project.input.riskChecks) {
      migrationNeeded = true;
    }

    return {
      id,
      name: normalizeText(project && project.name, config.defaultProjectName),
      location: normalizeText(project && project.location, ""),
      lotNumber: normalizeText(project && project.lotNumber, ""),
      propertyType: normalizeText(project && project.propertyType, config.defaultPropertyType),
      createdAt: normalizeText(project && project.createdAt, now),
      updatedAt: normalizeText(project && project.updatedAt, project && project.createdAt ? project.createdAt : now),
      input: normalizeInput(project && project.input ? project.input : {})
    };
  }

  function normalizeInput(input) {
    const normalized = mergeDeep(config.defaultInput, input || {});
    delete normalized.difficultyRates;
    delete normalized.wallUnknownRiskRates;
    return normalized;
  }

  function createInitialAppState() {
    const project = createProject();
    return {
      currentProjectId: project.id,
      projects: [project],
      unitPrices: normalizeUnitPrices()
    };
  }

  function createProject(overrides = {}) {
    const now = getTimestamp();
    return {
      id: overrides.id || createProjectId(),
      name: normalizeText(overrides.name, config.defaultProjectName),
      location: normalizeText(overrides.location, ""),
      lotNumber: normalizeText(overrides.lotNumber, ""),
      propertyType: normalizeText(overrides.propertyType, config.defaultPropertyType),
      createdAt: overrides.createdAt || now,
      updatedAt: overrides.updatedAt || now,
      input: normalizeInput(overrides.input || {})
    };
  }

  function createProjectId() {
    return `project_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getTimestamp() {
    return new Date().toISOString();
  }

  function normalizeText(value, fallback) {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text || fallback;
  }

  function currentProject() {
    let project = appState.projects.find((item) => item.id === appState.currentProjectId);
    if (!project) {
      project = appState.projects[0] || createProject();
      if (!appState.projects.length) appState.projects.push(project);
      appState.currentProjectId = project.id;
    }
    return project;
  }

  function currentInput() {
    const project = currentProject();
    project.input = normalizeInput(project.input);
    return project.input;
  }

  function markCurrentProjectUpdated() {
    currentProject().updatedAt = getTimestamp();
  }

  function serializableState() {
    return {
      currentProjectId: appState.currentProjectId,
      projects: appState.projects,
      unitPrices: appState.unitPrices
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
    renderProjectList();
    renderCurrentProjectName();
    setSaveStatus("保存済み");
  }

  function scheduleSave() {
    setSaveStatus("編集中");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveState, 250);
  }

  function bindEvents() {
    document.querySelectorAll("[data-field]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        setByPath(currentInput(), input.dataset.field, readControlValue(input));
        markCurrentProjectUpdated();
        if (input.dataset.field === "wallPresence") {
          updateWallFieldState();
        }
        render();
        scheduleSave();
      });
    });

    document.querySelectorAll("[data-project-field]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        setByPath(currentProject(), input.dataset.projectField, readControlValue(input));
        markCurrentProjectUpdated();
        render();
        scheduleSave();
      });
    });

    document.querySelectorAll("[data-rate-field]").forEach((input) => {
      input.addEventListener("input", () => {
        setByPath(appState.unitPrices, input.dataset.rateField, readControlValue(input));
        render();
        scheduleSave();
      });
    });

    document.getElementById("saveButton").addEventListener("click", () => {
      collectForm();
      markCurrentProjectUpdated();
      render();
      saveState();
    });

    document.getElementById("newProjectButton").addEventListener("click", createNewProject);
    document.getElementById("newProjectListButton").addEventListener("click", createNewProject);

    document.getElementById("resetCurrentButton").addEventListener("click", () => {
      currentProject().input = normalizeInput();
      markCurrentProjectUpdated();
      hydrateForm();
      updateWallFieldState();
      render();
      saveState();
    });

    document.getElementById("resetAllButton").addEventListener("click", () => {
      const shouldReset = window.confirm("案件一覧・単価設定を含む全データを初期化します。よろしいですか？");
      if (!shouldReset) return;
      appState = createInitialAppState();
      hydrateForm();
      updateWallFieldState();
      render();
      saveState();
    });

    document.getElementById("resetRatesButton").addEventListener("click", () => {
      appState.unitPrices.difficultyRates = clone(config.defaultDifficultyRates);
      appState.unitPrices.wallUnknownRiskRates = clone(config.defaultWallUnknownRiskRates);
      hydrateForm();
      render();
      saveState();
    });

    document.getElementById("clearFeesButton").addEventListener("click", () => {
      Object.keys(currentInput().fees).forEach((key) => {
        currentInput().fees[key] = 0;
      });
      markCurrentProjectUpdated();
      hydrateForm();
      render();
      saveState();
    });

    document.getElementById("copyMemoButton").addEventListener("click", async () => {
      const memo = document.getElementById("generatedMemo").value;
      try {
        await navigator.clipboard.writeText(memo);
        setSaveStatus("メモをコピー");
      } catch (error) {
        document.getElementById("generatedMemo").select();
        setSaveStatus("メモを選択中");
      }
    });

    document.getElementById("projectListBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-project-action]");
      if (!button) return;
      const action = button.dataset.projectAction;
      const projectId = button.dataset.projectId;
      if (action === "open") openProject(projectId);
      if (action === "duplicate") duplicateProject(projectId);
      if (action === "delete") deleteProject(projectId);
    });
  }

  function createNewProject() {
    collectForm();
    const project = createProject();
    appState.projects.unshift(project);
    appState.currentProjectId = project.id;
    hydrateForm();
    updateWallFieldState();
    render();
    saveState();
  }

  function openProject(projectId) {
    const project = appState.projects.find((item) => item.id === projectId);
    if (!project) return;
    collectForm();
    appState.currentProjectId = project.id;
    hydrateForm();
    updateWallFieldState();
    render();
    saveState();
  }

  function duplicateProject(projectId) {
    const source = appState.projects.find((item) => item.id === projectId);
    if (!source) return;
    collectForm();
    const project = createProject({
      name: `${normalizeText(source.name, config.defaultProjectName)} コピー`,
      location: source.location,
      lotNumber: source.lotNumber,
      propertyType: source.propertyType,
      input: clone(source.input)
    });
    appState.projects.unshift(project);
    appState.currentProjectId = project.id;
    hydrateForm();
    updateWallFieldState();
    render();
    saveState();
  }

  function deleteProject(projectId) {
    const project = appState.projects.find((item) => item.id === projectId);
    if (!project) return;
    const shouldDelete = window.confirm(`案件「${normalizeText(project.name, config.defaultProjectName)}」を削除します。よろしいですか？`);
    if (!shouldDelete) return;

    const wasCurrent = appState.currentProjectId === projectId;
    appState.projects = appState.projects.filter((item) => item.id !== projectId);
    if (!appState.projects.length) {
      appState.projects.push(createProject());
    }
    if (wasCurrent) {
      appState.currentProjectId = appState.projects[0].id;
      hydrateForm();
      updateWallFieldState();
    }
    render();
    saveState();
  }

  function hydrateForm() {
    const input = currentInput();
    const project = currentProject();

    document.querySelectorAll("[data-field]").forEach((control) => {
      const value = getByPath(input, control.dataset.field);
      control.value = value ?? "";
    });

    document.querySelectorAll("[data-project-field]").forEach((control) => {
      const value = getByPath(project, control.dataset.projectField);
      control.value = value ?? "";
    });

    document.querySelectorAll("[data-rate-field]").forEach((control) => {
      const value = getByPath(appState.unitPrices, control.dataset.rateField);
      control.value = value ?? "";
    });
  }

  function collectForm() {
    const input = currentInput();
    const project = currentProject();

    document.querySelectorAll("[data-field]").forEach((control) => {
      setByPath(input, control.dataset.field, readControlValue(control));
    });

    document.querySelectorAll("[data-project-field]").forEach((control) => {
      setByPath(project, control.dataset.projectField, readControlValue(control));
    });

    document.querySelectorAll("[data-rate-field]").forEach((control) => {
      setByPath(appState.unitPrices, control.dataset.rateField, readControlValue(control));
    });
  }

  function readControlValue(control) {
    if (control.type === "number") {
      return control.value === "" ? "" : Number(control.value);
    }
    return control.value;
  }

  function getByPath(object, path) {
    return path.split(".").reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      return current[key];
    }, object);
  }

  function setByPath(object, path, value) {
    const keys = path.split(".");
    let current = object;
    keys.slice(0, -1).forEach((key) => {
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      current = current[key];
    });
    current[keys[keys.length - 1]] = value;
  }

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function calculate(input = currentInput()) {
    const siteArea = toNumber(input.siteArea);
    const effectiveSiteArea = toNumber(input.effectiveSiteArea);
    const lotCount = Math.max(1, Math.floor(toNumber(input.lotCount) || 1));
    const difficultyRateSet = appState.unitPrices.difficultyRates[input.difficulty] || appState.unitPrices.difficultyRates.unknown;
    const wallRiskRates = appState.unitPrices.wallUnknownRiskRates || config.defaultWallUnknownRiskRates;
    const wallLength = toNumber(input.wallLength);
    const wallHeight = toNumber(input.wallHeight);
    const wallUnitPrice = toNumber(input.wallUnitPrice);
    const wallArea = wallLength * wallHeight;
    const knownWallCost = input.wallPresence === "known" ? wallArea * wallUnitPrice : 0;
    const feesTotal = sumFees(input);
    const contingencyRate = toNumber(input.contingencyRate) / 100;

    const earthwork = {};
    const wallUnknownRisk = {};
    const subtotal = {};
    const contingency = {};
    const total = {};

    RANGE_KEYS.forEach((key) => {
      earthwork[key] = siteArea * toNumber(difficultyRateSet[key]);
      wallUnknownRisk[key] =
        input.wallPresence === "unknownQuantity"
          ? siteArea * toNumber(wallRiskRates[key])
          : 0;
      subtotal[key] = earthwork[key] + knownWallCost + wallUnknownRisk[key] + feesTotal;
      contingency[key] = subtotal[key] * contingencyRate;
      total[key] = subtotal[key] + contingency[key];
    });

    return {
      siteArea,
      effectiveSiteArea,
      lotCount,
      earthwork,
      wallArea,
      knownWallCost,
      wallUnknownRisk,
      feesTotal,
      subtotal,
      contingency,
      total
    };
  }

  function sumFees(input) {
    return Object.keys(input.fees).reduce((sum, key) => sum + toNumber(input.fees[key]), 0);
  }

  function diagnoseRisk(input = currentInput()) {
    const riskChecks = input.riskChecks || {};
    const selected = config.riskCheckDefinitions.map((definition) => {
      const selectedValue = riskChecks[definition.key] || "unknown";
      const option = definition.options.find((item) => item.value === selectedValue) || definition.options[definition.options.length - 1];
      return {
        key: definition.key,
        label: definition.label,
        confirm: definition.confirm,
        value: option.value,
        optionLabel: option.label,
        score: option.score
      };
    });

    const score = selected.reduce((sum, item) => sum + item.score, 0);
    const level = getRiskLevel(score);
    const attentionItems = selected
      .filter((item) => item.score >= 2)
      .map((item) => `${item.label}: ${item.optionLabel}`);
    const confirmationItems = selected
      .filter((item) => item.score >= 1)
      .map((item) => `${item.label}: ${item.confirm}`);
    const mainLabels = attentionItems.length
      ? attentionItems.map((item) => item.split(":")[0])
      : selected.filter((item) => item.score === 1).map((item) => item.label);
    const riskNamesText = mainLabels.length ? mainLabels.slice(0, 4).join("・") : "大きなリスク項目";

    return {
      selected,
      score,
      level,
      attentionItems,
      confirmationItems,
      summary: buildRiskSummary(level, riskNamesText),
      assessmentComment: buildAssessmentRiskComment(level, riskNamesText),
      buyerComment: buildBuyerRiskComment(level, riskNamesText),
      adjustmentRate: level.adjustmentRate
    };
  }

  function getRiskLevel(score) {
    if (score >= 15) {
      return {
        key: "detail",
        label: "要詳細見積・要専門家確認",
        adjustmentRate: 0.15
      };
    }
    if (score >= 10) {
      return {
        key: "high",
        label: "高リスク",
        adjustmentRate: 0.10
      };
    }
    if (score >= 5) {
      return {
        key: "medium",
        label: "中リスク",
        adjustmentRate: 0.05
      };
    }
    return {
      key: "low",
      label: "低リスク",
      adjustmentRate: 0
    };
  }

  function buildRiskSummary(level, riskNamesText) {
    if (level.key === "low") {
      return "選択項目上は大きな造成リスクは目立ちません。標準レンジを中心に見つつ、通常の現地確認を行ってください。";
    }
    if (level.key === "medium") {
      return `${riskNamesText}に確認事項があります。標準概算に軽いリスク調整を見込み、現地確認で上振れ要因を確認してください。`;
    }
    if (level.key === "high") {
      return `${riskNamesText}に注意が必要です。造成業者または設計者による現地確認を前提に、標準〜高めの造成費を見込むのが安全です。`;
    }
    return `${riskNamesText}のリスクが重なっています。初期査定段階でも、詳細見積または専門家確認を前提に価格余力を見てください。`;
  }

  function buildAssessmentRiskComment(level, riskNamesText) {
    if (level.key === "low") {
      return "査定時は通常の造成費レンジで検討可能ですが、正式判断前には現地・行政・施工条件の確認が必要です。";
    }
    if (level.key === "medium") {
      return `${riskNamesText}の確認結果により造成費が上振れする可能性があります。標準レンジに加えて調整後概算も確認してください。`;
    }
    if (level.key === "high") {
      return `${riskNamesText}が査定価格に影響する可能性があります。現地確認前提で高めレンジまで価格余力を確認してください。`;
    }
    return `${riskNamesText}について詳細見積・専門家確認が必要です。概算だけで買取価格を固めないでください。`;
  }

  function buildBuyerRiskComment(level, riskNamesText) {
    if (level.key === "low") {
      return "買取業者へは、初期概算であり正式な工事見積ではないことを前提に共有してください。";
    }
    if (level.key === "medium") {
      return `${riskNamesText}は追加確認事項として明示し、標準概算に5%程度のリスク調整を見込んだ前提で打診してください。`;
    }
    if (level.key === "high") {
      return `${riskNamesText}は買取業者に先に共有し、造成業者・設計者確認前提で標準〜高めレンジを見込む条件で打診してください。`;
    }
    return `${riskNamesText}は大きな不確定要素です。造成業者・設計者による確認、行政確認、詳細見積を前提条件として打診してください。`;
  }

  function render() {
    const result = calculate();
    const diagnosis = diagnoseRisk(currentInput());
    document.getElementById("totalLow").textContent = formatManYen(result.total.low);
    document.getElementById("totalStandard").textContent = formatManYen(result.total.standard);
    document.getElementById("totalHigh").textContent = formatManYen(result.total.high);
    renderCurrentProjectName();
    renderProjectList();
    renderRiskDiagnosis(diagnosis);
    renderAdjustedTotals(result, diagnosis);
    renderTsuboCosts(result);
    renderPerLotCosts(result);
    renderBreakdown(result);
    renderRiskComments(result, diagnosis);
    renderGeneratedMemo(result, diagnosis);
  }

  function renderCurrentProjectName() {
    const element = document.getElementById("currentProjectName");
    if (element) {
      element.textContent = normalizeText(currentProject().name, config.defaultProjectName);
    }
  }

  function renderProjectList() {
    const body = document.getElementById("projectListBody");
    const empty = document.getElementById("projectListEmpty");
    if (!body) return;

    body.innerHTML = appState.projects.map((project) => {
      const input = normalizeInput(project.input);
      const result = calculate(input);
      const isCurrent = project.id === appState.currentProjectId;
      return `
        <tr class="${isCurrent ? "current-row" : ""}">
          <td><strong>${escapeHtml(normalizeText(project.name, config.defaultProjectName))}</strong></td>
          <td>${escapeHtml(project.location || "-")}</td>
          <td class="number">${formatArea(input.siteArea)}</td>
          <td class="number">${formatLotCount(input.lotCount)}</td>
          <td>${escapeHtml(getLabel("difficulty", input.difficulty))}</td>
          <td class="number">${formatManYen(result.total.standard)}</td>
          <td>${escapeHtml(formatDateTime(project.updatedAt))}</td>
          <td class="actions">
            <button type="button" class="button table-action" data-project-action="open" data-project-id="${escapeHtml(project.id)}">開く</button>
            <button type="button" class="button table-action" data-project-action="duplicate" data-project-id="${escapeHtml(project.id)}">複製</button>
            <button type="button" class="button table-action danger-text" data-project-action="delete" data-project-id="${escapeHtml(project.id)}">削除</button>
          </td>
        </tr>
      `;
    }).join("");

    if (empty) {
      empty.hidden = appState.projects.length > 0;
    }
  }

  function renderRiskDiagnosis(diagnosis) {
    const badge = document.getElementById("riskLevelBadge");
    const score = document.getElementById("riskScore");
    const summary = document.getElementById("riskDiagnosisSummary");
    const attention = document.getElementById("riskAttentionItems");
    const confirmations = document.getElementById("riskConfirmationItems");
    const assessment = document.getElementById("assessmentRiskComment");
    const buyer = document.getElementById("buyerRiskComment");

    if (badge) {
      badge.textContent = diagnosis.level.label;
      badge.className = `risk-badge ${diagnosis.level.key}`;
    }
    if (score) score.textContent = `${diagnosis.score}点`;
    if (summary) summary.textContent = diagnosis.summary;
    if (attention) {
      attention.innerHTML = renderListItems(diagnosis.attentionItems, "大きな注意項目は選択されていません。");
    }
    if (confirmations) {
      confirmations.innerHTML = renderListItems(diagnosis.confirmationItems, "通常の現地確認で足りる見込みです。");
    }
    if (assessment) assessment.textContent = diagnosis.assessmentComment;
    if (buyer) buyer.textContent = diagnosis.buyerComment;
  }

  function renderAdjustedTotals(result, diagnosis) {
    const info = document.getElementById("riskAdjustmentInfo");
    const totals = document.getElementById("adjustedTotals");
    const rate = diagnosis.adjustmentRate;
    const adjusted = {
      low: result.total.low,
      standard: result.total.standard * (1 + rate),
      high: result.total.high * (1 + rate)
    };

    if (info) {
      const percent = Math.round(rate * 100);
      info.textContent = rate
        ? `リスク調整係数: 標準・高めに${percent}%加算（低めは据え置き）`
        : "リスク調整係数: 加算なし";
    }
    if (totals) {
      totals.innerHTML = RANGE_KEYS.map((key) => {
        return `<p><span>${RANGE_LABELS[key]}</span><strong>${formatManYen(adjusted[key])}</strong></p>`;
      }).join("");
    }
  }

  function renderListItems(items, emptyText) {
    if (!items.length) return `<li>${escapeHtml(emptyText)}</li>`;
    return items.slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function renderTsuboCosts(result) {
    const container = document.getElementById("tsuboCosts");
    const basisArea = result.effectiveSiteArea || result.siteArea;
    if (!basisArea) {
      container.innerHTML = "<p>面積入力後に表示</p>";
      return;
    }

    const tsubo = basisArea / 3.305785;
    container.innerHTML = RANGE_KEYS.map((key) => {
      const unitPrice = tsubo ? result.total[key] / tsubo : 0;
      return `<p><span>${RANGE_LABELS[key]}</span><strong>${formatYen(unitPrice)} / 坪</strong></p>`;
    }).join("");
  }

  function renderPerLotCosts(result) {
    const container = document.getElementById("perLotCosts");
    container.innerHTML = RANGE_KEYS.map((key) => {
      const cost = result.total[key] / result.lotCount;
      return `<p><span>${RANGE_LABELS[key]}</span><strong>${formatManYen(cost)}</strong></p>`;
    }).join("");
  }

  function renderBreakdown(result) {
    const rows = [
      ["土工費", result.earthwork],
      [wallBreakdownLabel(result), rangeValue(result.knownWallCost)],
      ["擁壁数量不明リスク加算", result.wallUnknownRisk],
      ["その他費用", rangeValue(result.feesTotal)],
      ["予備費", result.contingency],
      ["合計", result.total]
    ].filter((row) => {
      return row[0] === "土工費" || row[0] === "合計" || RANGE_KEYS.some((key) => row[1][key] > 0);
    });

    document.getElementById("breakdown").innerHTML = `
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>低め</th>
            <th>標準</th>
            <th>高め</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <th>${escapeHtml(row[0])}</th>
              <td>${formatManYen(row[1].low)}</td>
              <td>${formatManYen(row[1].standard)}</td>
              <td>${formatManYen(row[1].high)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function wallBreakdownLabel(result) {
    if (currentInput().wallPresence !== "known") return "擁壁費";
    return `擁壁費（${formatDecimal(result.wallArea)}㎡）`;
  }

  function rangeValue(value) {
    return {
      low: value,
      standard: value,
      high: value
    };
  }

  function renderRiskComments(result, diagnosis) {
    const comments = [
      `総合リスクは「${diagnosis.level.label}」（${diagnosis.score}点）です。${diagnosis.summary}`,
      ...buildRiskComments(result, currentInput())
    ];
    const list = document.getElementById("riskComments");
    list.innerHTML = comments.map((comment) => `<li>${escapeHtml(comment)}</li>`).join("");
  }

  function buildRiskComments(result, input) {
    const comments = [];
    const difficultyLabel = getLabel("difficulty", input.difficulty);

    if (!result.siteArea) {
      comments.push("土地面積が未入力のため、土工費は0円で計算されています。");
    }
    if (input.difficulty === "unknown") {
      comments.push("造成難易度が不明のため、不明単価レンジで概算しています。現地高低差・道路段差の確認が必要です。");
    }
    if (["elevation", "retainingLarge", "forestSlope"].includes(input.difficulty)) {
      comments.push(`造成難易度は「${difficultyLabel}」です。初期打診では高めレンジも見て価格余力を確認してください。`);
    }
    if (input.elevationGap === "over2") {
      comments.push("高低差2m以上のため、擁壁・階段・排水計画の追加確認が必要です。");
    } else if (input.elevationGap === "from1to2") {
      comments.push("高低差1m以上のため、造成範囲と残置擁壁の安全性確認が必要です。");
    }
    if (input.slopeDegree === "steep") {
      comments.push("強い傾斜があるため、造成範囲・搬入経路・法面処理のリスクが高めです。");
    } else if (input.slopeDegree === "moderate") {
      comments.push("中程度の傾斜があるため、平坦地より造成費が上振れしやすい条件です。");
    }
    if (input.roadLevelGap === "over1") {
      comments.push("道路との段差が1m以上あるため、乗入れ・排水・擁壁の追加費用に注意してください。");
    }
    if (input.wallPresence === "known" && (!result.wallArea || !toNumber(input.wallUnitPrice))) {
      comments.push("擁壁あり・数量入力ですが、延長・高さ・単価のいずれかが未入力のため擁壁費が十分に反映されていません。");
    }
    if (input.wallPresence === "known" && toNumber(input.wallHeight) >= 2) {
      comments.push("擁壁平均高さが2m以上です。構造確認、既存擁壁の安全性、行政協議のリスクがあります。");
    }
    if (input.wallPresence === "unknownQuantity") {
      comments.push("擁壁あり・数量不明として、土地面積に対するリスク加算をレンジ別に反映しています。");
    }
    if (input.wallPresence === "unknown") {
      comments.push("擁壁の有無が不明です。現地写真、隣地境界、道路側の段差確認を優先してください。");
    }
    addMissingFeeComment(comments, input.oldHouse === "yes", input.fees.buildingDemolition, "古家ありですが、建物解体費が0円です。解体見積の確認が必要です。");
    addMissingFeeComment(comments, input.treesStones === "yes", input.fees.treesStonesRemoval, "樹木・庭石ありですが、撤去費が0円です。搬出経路と処分費を確認してください。");
    addMissingFeeComment(comments, input.blockWall === "yes", input.fees.blockWallRemoval, "ブロック塀ありですが、撤去費が0円です。境界・安全性・撤去範囲の確認が必要です。");
    addMissingFeeComment(comments, ["notExists", "upgrade"].includes(input.waterConnection), input.fees.waterConnection, "上水道引込・増設の可能性がありますが、引込費が0円です。");
    addMissingFeeComment(comments, ["notExists", "septic"].includes(input.sewerConnection), input.fees.sewerConnection, "下水道引込または排水方式の確認が必要ですが、下水道関連費が0円です。");
    addMissingFeeComment(comments, input.gasConnection === "notExists", input.fees.gasConnection, "ガス引込なしですが、ガス引込費が0円です。供給方式を確認してください。");
    addMissingFeeComment(comments, ["needed", "high"].includes(input.stormwater), input.fees.stormwaterDrainage, "雨水排水整備が必要見込みですが、雨水排水整備費が0円です。");
    addMissingFeeComment(comments, input.surveyNeed === "needed", input.fees.survey, "測量が必要ですが、測量費が0円です。境界確定の要否を確認してください。");
    addMissingFeeComment(comments, input.designNeed === "needed", input.fees.design, "造成設計が必要ですが、設計費が0円です。");

    if (input.permitRisk === "medium") {
      comments.push("申請リスクは中程度です。開発許可、宅造許可、条例手続きの要否を事前確認してください。");
    } else if (input.permitRisk === "high") {
      comments.push("申請リスクが高い条件です。査定・買取打診前に行政協議や専門家確認を推奨します。");
    } else if (input.permitRisk === "unknown") {
      comments.push("申請リスクが不明です。区域区分、宅造規制区域、開発面積基準などを確認してください。");
    }

    if (toNumber(input.fees.groundImprovement) > 0) {
      comments.push("地盤改良費を加算しています。地盤調査結果により増減する可能性があります。");
    }
    if (comments.length === 0) {
      comments.push("選択条件上、大きな上振れ要因は目立ちません。正式判断前には施工業者等の見積確認が必要です。");
    }

    return comments.slice(0, 10);
  }

  function addMissingFeeComment(comments, condition, fee, text) {
    if (condition && toNumber(fee) === 0) {
      comments.push(text);
    }
  }

  function renderGeneratedMemo(result, diagnosis) {
    const project = currentProject();
    const input = currentInput();
    const difficultyLabel = getLabel("difficulty", input.difficulty);
    const statusLabel = getLabel("currentStatus", input.currentStatus);
    const wallLabel = getLabel("wallPresence", input.wallPresence);
    const otherCosts = buildFilledFeesText(input);
    const comments = buildRiskComments(result, input).slice(0, 4).join(" ");
    const mainRiskItems = diagnosis.attentionItems.length
      ? diagnosis.attentionItems.slice(0, 4).join("、")
      : "大きな注意項目なし";
    const confirmationItems = diagnosis.confirmationItems.length
      ? diagnosis.confirmationItems.slice(0, 4).join("、")
      : "通常の現地確認";
    const userMemo = input.memo ? `\n個別メモ: ${input.memo}` : "";

    const memo = [
      `案件名「${normalizeText(project.name, config.defaultProjectName)}」。所在地「${project.location || "未入力"}」、地番「${project.lotNumber || "未入力"}」、物件種別「${project.propertyType || config.defaultPropertyType}」。`,
      `対象地は土地面積${formatArea(result.siteArea)}、有効宅地面積${formatArea(result.effectiveSiteArea)}、想定${result.lotCount}区画。現況は「${statusLabel}」。`,
      `造成難易度は「${difficultyLabel}」として、土量入力なしで面積単価により概算。概算造成費は低め${formatManYen(result.total.low)}、標準${formatManYen(result.total.standard)}、高め${formatManYen(result.total.high)}。`,
      `総合リスク判定は「${diagnosis.level.label}」（${diagnosis.score}点）。主なリスク項目は${mainRiskItems}。追加確認事項は${confirmationItems}。`,
      `坪単価換算は標準で${formatTsuboUnit(result)}、1区画あたり標準${formatManYen(result.total.standard / result.lotCount)}。擁壁は「${wallLabel}」。${otherCosts}`,
      `主なリスク: ${comments}`,
      `この概算は正式な工事見積ではありません。売買判断・買取価格判断・事業収支判断では、造成業者・設計者による確認が必要です。${userMemo}`
    ].join("\n");

    document.getElementById("generatedMemo").value = memo;
  }

  function buildFilledFeesText(input) {
    const filled = Object.keys(input.fees)
      .filter((key) => toNumber(input.fees[key]) > 0)
      .map((key) => `${FEE_LABELS[key]}${formatManYen(input.fees[key])}`);

    if (!filled.length) return "その他費用の個別加算は未入力。";
    return `その他加算は${filled.slice(0, 5).join("、")}${filled.length > 5 ? "など" : ""}。`;
  }

  function formatTsuboUnit(result) {
    const basisArea = result.effectiveSiteArea || result.siteArea;
    if (!basisArea) return "面積未入力";
    const tsubo = basisArea / 3.305785;
    return `${formatYen(result.total.standard / tsubo)} / 坪`;
  }

  function updateWallFieldState() {
    const input = currentInput();
    const wallInputs = ["wallLength", "wallHeight", "wallUnitPrice"];
    const disabled = input.wallPresence !== "known";
    wallInputs.forEach((id) => {
      const control = document.getElementById(id);
      if (control) control.disabled = disabled;
    });

    const riskDisabled = input.wallPresence !== "unknownQuantity";
    ["wallRiskLow", "wallRiskStandard", "wallRiskHigh"].forEach((id) => {
      const control = document.getElementById(id);
      if (control) control.disabled = riskDisabled;
    });
  }

  function setSaveStatus(text) {
    const element = document.getElementById("saveStatus");
    if (element) element.textContent = text;
  }

  function getLabel(group, value) {
    return config.labels[group][value] || value || "未入力";
  }

  function formatArea(value) {
    const number = toNumber(value);
    return number ? `${formatDecimal(number)}㎡` : "未入力";
  }

  function formatLotCount(value) {
    const number = Math.max(1, Math.floor(toNumber(value) || 1));
    return `${number}区画`;
  }

  function formatManYen(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "0万円";
    return `${Math.round(number / 10000).toLocaleString("ja-JP")}万円`;
  }

  function formatYen(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "0円";
    return `${Math.round(number).toLocaleString("ja-JP")}円`;
  }

  function formatDecimal(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
