import { initCrmCloud, schedulePersist, persistNow, setStateGetter, isConfigured } from './crm-cloud.js';
import {
  toNumber as toNumberCore,
  formatMoney as formatMoneyCore,
  formatPercentForMessage as formatPercentForMessageCore,
  formatDateInputValue as formatDateInputValueCore,
  parseDateInputValue as parseDateInputValueCore,
  formatDateTimeRu,
} from './core/formatters.js';
import {
  collectPersonOperations as collectPersonOperationsByPerson,
  filterOperationsByRange as filterOperationsByRangeCore,
  applyHistoryFilters,
  summarizeOperations,
} from './services/history-service.js';
import { pushAuditLog, makeCsv } from './services/audit-service.js';
import {
  sumServiceBalances as sumServiceBalancesCore,
  accrueSalaryFromServices as accrueSalaryFromServicesCore,
  takeSnapshot as takeSalarySnapshotCore,
  restoreLastSnapshot as restoreLastSalarySnapshotCore,
} from './services/salary-service.js';
import {
  canDeletePayoutByRole,
  applyPayout,
  deletePayout,
} from './services/payout-service.js';
import { bindHistoryUi } from './modules/history/history-bindings.js';
import { bindPayoutUi } from './modules/payout/payout-bindings.js';
import { bindAppUi } from './modules/app/app-bindings.js';
import { initMobileNav as initMobileNavModule } from './modules/app/mobile-nav.js';
import { runStartup } from './modules/app/startup.js';
import {
  attachSettingsDetailDirtyTracking as attachSettingsDetailDirtyTrackingModule,
  bindDeleteCategoryButtons as bindDeleteCategoryButtonsModule,
} from './modules/settings/settings-bindings.js';
import {
  BASE_PERSON_KEYS,
  DEFAULT_STRUCTURE,
  deepClone,
  mergePercentagesFromParsed,
  normalizeSalaryState,
} from './core/state.js';
import { escapeHtml, escapeAttr } from './core/html.js';

const STORAGE_KEYS = {
  auth: 'calc_auth_role',
  authLogin: 'calc_auth_login',
  theme: 'calc_theme_v1',
};

/* SECURITY: логины и пароли в этом файле видны в браузере (DevTools). Для реальной защиты нужен сервер. */
const USERS = {
  admin: { login: 'admin', password: 'admin', role: 'admin', title: 'Администратор' },
  owner: { login: '560676', password: '560676', role: 'owner', title: 'Владелец' },
};

const { sumPercents, isPercentTotalValid, wouldExceed100, calcService } = PercentLogic;

let PERCENTAGES = deepClone(DEFAULT_STRUCTURE);

function saveSalaryState() {
  schedulePersist();
}

let SALARY = normalizeSalaryState(null, PERCENTAGES);
let currentRole = null;
let currentUserLogin = null;

let payoutTarget = { serviceKey: null, name: null };
let personHistoryTarget = { serviceKey: null, name: null };
/** Открытое направление в модалке «Зарплата» (для синхронизации из облака). */
let salaryDetailOpenKey = null;
let payoutDeleteTarget = null;
const personHistoryFilters = {
  type: 'all',
  minAmount: 0,
  search: '',
};

let settingsNavView = 'hub';
let settingsDetailKey = null;
let settingsDetailDirty = false;
let devToolsActionTarget = null;

function setUiStatus(msg, kind = 'muted') {
  if (!els.status) return;
  els.status.textContent = msg;
  const colorVar =
    kind === 'ok' ? 'var(--ok)' : kind === 'danger' ? 'var(--danger)' : 'var(--muted)';
  els.status.style.color = colorVar;
}

/** Активная вкладка: всегда ровно одна видима на экране. */
let activePanel = 'distribution'; // 'distribution' | 'salary' | 'settings' | 'calculator'

const CALC_MAX_LEN = 14;
const CALC_HISTORY_LIMIT = 20;
const calculatorState = {
  display: '0',
  stored: null,
  operator: null,
  waitingNext: false,
  error: false,
  expression: '',
  history: [],
};

const els = {
  loginScreen: document.getElementById('loginScreen'),
  appScreen: document.getElementById('appScreen'),
  loginInput: document.getElementById('loginInput'),
  passwordInput: document.getElementById('passwordInput'),
  loginBtn: document.getElementById('loginBtn'),
  loginStatus: document.getElementById('loginStatus'),
  roleBadge: document.getElementById('roleBadge'),
  distributionBtn: document.getElementById('distributionBtn'),
  salaryBtn: document.getElementById('salaryBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  calculatorBtn: document.getElementById('calculatorBtn'),
  devToolsBtn: document.getElementById('devToolsBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  salaryCard: document.getElementById('salaryCard'),
  calculatorCard: document.getElementById('calculatorCard'),
  calculatorScreen: document.getElementById('calculatorScreen'),
  calculatorExpr: document.getElementById('calculatorExpr'),
  calculatorMain: document.getElementById('calculatorMain'),
  calculatorGrid: document.getElementById('calculatorGrid'),
  calculatorBackBtn: document.getElementById('calculatorBackBtn'),
  calculatorHistoryBtn: document.getElementById('calculatorHistoryBtn'),
  calculatorHistoryPanel: document.getElementById('calculatorHistoryPanel'),
  calculatorHistoryList: document.getElementById('calculatorHistoryList'),
  calculatorHistoryCloseBtn: document.getElementById('calculatorHistoryCloseBtn'),
  calculatorHistoryCloseArea: document.getElementById('calculatorHistoryCloseArea'),
  settingsCard: document.getElementById('settingsCard'),
  settingsContent: document.getElementById('settingsContent'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  settingsStatus: document.getElementById('settingsStatus'),
  exportPercentsBtn: document.getElementById('exportPercentsBtn'),
  importPercentsBtn: document.getElementById('importPercentsBtn'),
  importPercentsFile: document.getElementById('importPercentsFile'),
  loadWarning: document.getElementById('loadWarning'),
  mobileAngel: document.getElementById('mobileAngel'),
  nova: document.getElementById('nova'),
  tlabs: document.getElementById('tlabs'),
  calcBtn: document.getElementById('calcBtn'),
  copyBtn: document.getElementById('copyBtn'),
  clearBtn: document.getElementById('clearBtn'),
  output: document.getElementById('output'),
  resultGrid: document.getElementById('resultGrid'),
  totals: document.getElementById('totals'),
  status: document.getElementById('status'),
  brandThemeBtn: document.getElementById('brandThemeBtn'),
  brandLogo: document.getElementById('brandLogo'),
  loginThemeBtn: document.getElementById('loginThemeBtn'),
  loginBrandLogo: document.getElementById('loginBrandLogo'),
  mobileNavToggle: document.getElementById('mobileNavToggle'),
  settingsBackBtn: document.getElementById('settingsBackBtn'),
  settingsTitle: document.getElementById('settingsTitle'),
  settingsHint: document.getElementById('settingsHint'),
  settingsSaveWrap: document.getElementById('settingsSaveWrap'),
  salaryDirections: document.getElementById('salaryDirections'),
  salaryDetailModal: document.getElementById('salaryDetailModal'),
  salaryDetailTitle: document.getElementById('salaryDetailTitle'),
  salaryDetailBody: document.getElementById('salaryDetailBody'),
  payoutModal: document.getElementById('payoutModal'),
  payoutModalTitle: document.getElementById('payoutModalTitle'),
  payoutModalHint: document.getElementById('payoutModalHint'),
  payoutAmountInput: document.getElementById('payoutAmountInput'),
  payoutModalStatus: document.getElementById('payoutModalStatus'),
  payoutConfirmBtn: document.getElementById('payoutConfirmBtn'),
  personHistoryModal: document.getElementById('personHistoryModal'),
  personHistoryTitle: document.getElementById('personHistoryTitle'),
  personHistoryBody: document.getElementById('personHistoryBody'),
  personHistoryDateFrom: document.getElementById('personHistoryDateFrom'),
  personHistoryDateTo: document.getElementById('personHistoryDateTo'),
  personHistoryType: document.getElementById('personHistoryType'),
  personHistoryMinAmount: document.getElementById('personHistoryMinAmount'),
  personHistorySearch: document.getElementById('personHistorySearch'),
  exportHistoryCsvBtn: document.getElementById('exportHistoryCsvBtn'),
  takeSnapshotBtn: document.getElementById('takeSnapshotBtn'),
  restoreSnapshotBtn: document.getElementById('restoreSnapshotBtn'),
  payoutDeleteModal: document.getElementById('payoutDeleteModal'),
  payoutDeleteSummary: document.getElementById('payoutDeleteSummary'),
  payoutDeleteReason: document.getElementById('payoutDeleteReason'),
  payoutDeleteStatus: document.getElementById('payoutDeleteStatus'),
  payoutDeleteConfirmBtn: document.getElementById('payoutDeleteConfirmBtn'),
  devToolsModal: document.getElementById('devToolsModal'),
  devToolsConfirmInput: document.getElementById('devToolsConfirmInput'),
  devToolsStatus: document.getElementById('devToolsStatus'),
  devClearAccrualsBtn: document.getElementById('devClearAccrualsBtn'),
  devResetCategoriesBtn: document.getElementById('devResetCategoriesBtn'),
};

function applyTheme(theme) {
  const next = theme === 'dark' || theme === 'light' ? theme : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(STORAGE_KEYS.theme, next);
  } catch (e) {}
  updateThemeToggleButtons();
  updateBrandLogos();
}

function updateBrandLogos() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const src = dark ? 'assets/logo-dark.svg' : 'assets/logo.svg';
  if (els.brandLogo) els.brandLogo.src = src;
  if (els.loginBrandLogo) els.loginBrandLogo.src = src;
}

function updateThemeToggleButtons() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const label = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
  const pressed = dark ? 'true' : 'false';
  [els.brandThemeBtn, els.loginThemeBtn].forEach((btn) => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', pressed);
    btn.setAttribute('aria-label', label);
  });
}

function initTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
  updateThemeToggleButtons();
  updateBrandLogos();
}

function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function savePercentages() {
  schedulePersist();
}

function syncSalaryWithPercentages() {
  SALARY = normalizeSalaryState(SALARY, PERCENTAGES);
  saveSalaryState();
}

function sumServiceBalances(serviceKey) {
  return sumServiceBalancesCore(SALARY, serviceKey);
}

function accrueSalaryFromServices(services) {
  accrueSalaryFromServicesCore(SALARY, services);
  addAudit('accrual_calculated', {
    services: Object.keys(services),
  });
  saveSalaryState();
}

function renderSalaryDetailBody(serviceKey) {
  if (!els.salaryDetailTitle || !els.salaryDetailBody) return;
  const service = PERCENTAGES[serviceKey];
  if (!service) return;
  els.salaryDetailTitle.textContent = service.title;
  const balances = SALARY.balances[serviceKey] || {};
  const names = Object.keys(service.items);
  const rows = names
    .map((name) => {
      const bal = balances[name] ?? 0;
      return `
      <div class="salary-detail-row">
        <div class="salary-detail-row__main">
          <button type="button" class="salary-detail-row__name-btn" data-salary-history="${escapeAttr(serviceKey)}" data-person-name="${escapeAttr(name)}">
            <span class="salary-detail-row__name-text">${escapeHtml(name)}</span>
            <span class="salary-detail-row__name-meta">История</span>
          </button>
        </div>
        <div class="salary-detail-row__balance">
          <span class="salary-detail-row__balance-label">Баланс</span>
          <span class="salary-detail-row__sum">${formatMoney(bal)} <span class="salary-detail-row__currency">₽</span></span>
        </div>
        <div class="salary-detail-row__action">
          <button type="button" class="ghost small-btn salary-detail-row__payout-btn" data-salary-payout="${escapeAttr(serviceKey)}" data-payout-name="${escapeAttr(name)}">Выплата</button>
        </div>
      </div>
    `;
    })
    .join('');
  els.salaryDetailBody.innerHTML = rows
    ? `<div class="salary-detail-list">${rows}</div>`
    : '<p class="muted salary-detail-empty">Нет строк.</p>';
}

function openSalaryDetailModal(serviceKey) {
  if (!PERCENTAGES[serviceKey] || !els.salaryDetailModal) return;
  salaryDetailOpenKey = serviceKey;
  renderSalaryDetailBody(serviceKey);
  els.salaryDetailModal.classList.remove('hidden');
  els.salaryDetailModal.setAttribute('aria-hidden', 'false');
}

function closeSalaryDetailModal() {
  if (!els.salaryDetailModal) return;
  salaryDetailOpenKey = null;
  els.salaryDetailModal.classList.add('hidden');
  els.salaryDetailModal.setAttribute('aria-hidden', 'true');
}

function formatDateInputValue(d) {
  return formatDateInputValueCore(d);
}

function parseDateInputValue(str) {
  return parseDateInputValueCore(str);
}

function getPersonHistoryDateRange() {
  const fromStr = els.personHistoryDateFrom && els.personHistoryDateFrom.value;
  const toStr = els.personHistoryDateTo && els.personHistoryDateTo.value;
  const d0 = parseDateInputValue(fromStr);
  const d1 = parseDateInputValue(toStr);
  if (!d0 || !d1) return null;
  const start = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0, 0, 0, 0);
  const end = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 23, 59, 59, 999);
  if (start > end) return null;
  return { start, end };
}

function updatePersonHistoryPresetButtons(activePreset) {
  if (!els.personHistoryModal) return;
  els.personHistoryModal.querySelectorAll('[data-person-history-preset]').forEach((btn) => {
    const p = btn.getAttribute('data-person-history-preset');
    const isActive = Boolean(activePreset && p === activePreset);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setPersonHistoryPreset(preset) {
  const now = new Date();
  let from;
  let to;
  if (preset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (preset === '30') {
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    from = new Date(to);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else if (preset === 'prevMonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else {
    return;
  }
  if (els.personHistoryDateFrom) els.personHistoryDateFrom.value = formatDateInputValue(from);
  if (els.personHistoryDateTo) els.personHistoryDateTo.value = formatDateInputValue(to);
  updatePersonHistoryPresetButtons(preset);
  renderPersonHistoryBody();
}

function canDeletePayout() {
  return canDeletePayoutByRole(currentRole);
}

function getCurrentActor() {
  const role = currentRole === 'owner' ? 'owner' : 'admin';
  const login = currentUserLogin || (role === 'owner' ? USERS.owner.login : USERS.admin.login);
  return { role, login };
}

function addAudit(action, meta = {}) {
  const actor = getCurrentActor();
  pushAuditLog(SALARY, {
    action,
    byRole: actor.role,
    byLogin: actor.login,
    meta,
  });
}

function collectPersonOperations(serviceKey, name) {
  return collectPersonOperationsByPerson(SALARY, serviceKey, name);
}

function filterOperationsByRange(ops, start, end) {
  return filterOperationsByRangeCore(ops, start, end);
}

function renderPersonHistoryBody() {
  if (!els.personHistoryBody || !personHistoryTarget.serviceKey || !personHistoryTarget.name) return;
  const { serviceKey, name } = personHistoryTarget;
  const svcTitle = PERCENTAGES[serviceKey] ? PERCENTAGES[serviceKey].title : serviceKey;
  if (els.personHistoryTitle) {
    els.personHistoryTitle.textContent = `${name} — ${svcTitle}`;
  }
  const range = getPersonHistoryDateRange();
  if (!range) {
    els.personHistoryBody.innerHTML =
      '<div class="salary-history-msg salary-history-msg--warn"><p>Укажите период «с» и «по».</p></div>';
    return;
  }
  const { start, end } = range;
  const all = collectPersonOperations(serviceKey, name);
  const ranged = filterOperationsByRange(all, start, end);
  const inRange = applyHistoryFilters(ranged, personHistoryFilters);
  const sums = summarizeOperations(inRange);
  const accSum = sums.accrual;
  const paySum = sums.payout;
  const delta = sums.delta;

  const fmtDateLong = (d) =>
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDt = (iso) => formatDateTimeRu(iso);

  const rows = inRange
    .map((o) => {
      const isAcc = o.kind === 'accrual';
      const isDeletedPayout = o.kind === 'payout_deleted';
      const isPayout = o.kind === 'payout';
      const label = isAcc ? 'Начисление' : isDeletedPayout ? 'Выплата (удалено)' : 'Выплата';
      const cls = isAcc
        ? 'salary-history-row--accrual'
        : isDeletedPayout
          ? 'salary-history-row--deleted'
          : 'salary-history-row--payout';
      const sign = isAcc ? '+' : '−';
      const amt = formatMoney(o.amount);
      const canDelete = isPayout && canDeletePayout() && o.id;
      const action = isDeletedPayout
        ? `<span class="salary-history-row__tag salary-history-row__tag--deleted">Удалено</span>`
        : canDelete
          ? `<button type="button" class="ghost small-btn salary-history-row__remove-btn" data-delete-payout-id="${escapeAttr(o.id)}" data-delete-service="${escapeAttr(serviceKey)}" data-delete-name="${escapeAttr(name)}" data-delete-amount="${escapeAttr(String(o.amount))}">Удалить</button>`
          : '<span class="salary-history-row__action-placeholder">—</span>';
      return `<div class="salary-history-row ${cls}" role="row">
        <span class="salary-history-row__kind">${label}</span>
        <span class="salary-history-row__date">${escapeHtml(fmtDt(o.at))}</span>
        <span class="salary-history-row__amount">${sign}${escapeHtml(amt)}</span>
        <span class="salary-history-row__action">${action}</span>
      </div>`;
    })
    .join('');

  const periodLabel = `${fmtDateLong(start)} — ${fmtDateLong(end)}`;

  const listBlock = inRange.length
    ? `<div class="salary-history-table" role="table" aria-label="Операции за период">
        <div class="salary-history-list-head" role="row">
          <span>Тип</span><span>Дата и время</span><span>Сумма</span><span>Действие</span>
        </div>
        <div class="salary-history-list">${rows}</div>
      </div>`
    : `<div class="salary-history-empty-state">
        <span class="salary-history-empty-icon" aria-hidden="true">📋</span>
        <p class="salary-history-empty-title">Нет операций</p>
        <p class="salary-history-empty-sub">За выбранный период записей не было.</p>
      </div>`;

  const deletionsInRange =
    currentRole === 'owner'
      ? (SALARY.payoutDeletionLog || []).filter((e) => {
          if (e.serviceKey !== serviceKey || e.name !== name) return false;
          const t = new Date(e.at);
          return !Number.isNaN(t.getTime()) && t >= start && t <= end;
        })
      : [];

  const deletionRows = deletionsInRange
    .map(
      (e) => `<div class="salary-deletion-row">
        <span class="salary-deletion-row__meta">${escapeHtml(fmtDt(e.at))}</span>
        <span class="salary-deletion-row__meta">${escapeHtml(e.byRole || '—')} / ${escapeHtml(e.byLogin || '—')}</span>
        <span class="salary-deletion-row__sum">${escapeHtml(formatMoney(e.amount))}</span>
        <span class="salary-deletion-row__reason">${escapeHtml(e.reason)}</span>
      </div>`
    )
    .join('');
  const deletionBlock =
    currentRole === 'owner'
      ? `<div class="salary-deletion-block">
          <p class="salary-deletion-block__title">Журнал удалений выплат (только владелец)</p>
          ${
            deletionRows
              ? `<div class="salary-deletion-table">
                  <div class="salary-deletion-head"><span>Когда</span><span>Кто удалил</span><span>Сумма</span><span>Причина</span></div>
                  <div class="salary-deletion-list">${deletionRows}</div>
                </div>`
              : '<p class="salary-deletion-empty">Удалений выплат за период нет.</p>'
          }
        </div>`
      : '';

  els.personHistoryBody.innerHTML = `
    <div class="salary-history-summary">
      <div class="salary-history-summary__item">
        <span class="salary-history-summary__label">Начислено</span>
        <strong class="salary-history-summary__val salary-history-summary__val--ok">${formatMoney(accSum)}</strong>
        <span class="salary-history-summary__hint">₽ за период</span>
      </div>
      <div class="salary-history-summary__item">
        <span class="salary-history-summary__label">Выплачено</span>
        <strong class="salary-history-summary__val salary-history-summary__val--out">${formatMoney(paySum)}</strong>
        <span class="salary-history-summary__hint">₽ за период</span>
      </div>
      <div class="salary-history-summary__item">
        <span class="salary-history-summary__label">Разница</span>
        <strong class="salary-history-summary__val">${formatMoney(delta)}</strong>
        <span class="salary-history-summary__hint">начислено − выплачено</span>
      </div>
    </div>
    <div class="salary-history-period-bar">
      <span class="salary-history-period-bar__label">Период</span>
      <span class="salary-history-period-bar__value">${escapeHtml(periodLabel)}</span>
    </div>
    ${listBlock}
    ${deletionBlock}
  `;
}

function openPersonHistoryModal(serviceKey, name) {
  personHistoryTarget = { serviceKey, name };
  personHistoryFilters.type = 'all';
  personHistoryFilters.minAmount = 0;
  personHistoryFilters.search = '';
  if (els.personHistoryType) els.personHistoryType.value = 'all';
  if (els.personHistoryMinAmount) els.personHistoryMinAmount.value = '';
  if (els.personHistorySearch) els.personHistorySearch.value = '';
  setPersonHistoryPreset('month');
  if (els.personHistoryModal) {
    els.personHistoryModal.classList.remove('hidden');
    els.personHistoryModal.setAttribute('aria-hidden', 'false');
  }
}

function closePersonHistoryModal() {
  personHistoryTarget = { serviceKey: null, name: null };
  updatePersonHistoryPresetButtons(null);
  if (els.personHistoryModal) {
    els.personHistoryModal.classList.add('hidden');
    els.personHistoryModal.setAttribute('aria-hidden', 'true');
  }
}

function openPayoutModal(serviceKey, name) {
  payoutTarget = { serviceKey, name };
  const svcTitle = PERCENTAGES[serviceKey].title;
  if (els.payoutModalTitle) els.payoutModalTitle.textContent = 'Выплата';
  if (els.payoutModalHint) {
    const bal = SALARY.balances[serviceKey] && typeof SALARY.balances[serviceKey][name] === 'number' ? SALARY.balances[serviceKey][name] : 0;
    els.payoutModalHint.textContent = `${name} — ${svcTitle}. Текущий баланс: ${formatMoney(bal)}. Если выплатить больше баланса, остаток станет отрицательным (учёт переплаты) — подтверждение не требуется.`;
  }
  if (els.payoutAmountInput) els.payoutAmountInput.value = '';
  if (els.payoutModalStatus) {
    els.payoutModalStatus.textContent = '';
    els.payoutModalStatus.style.color = '';
  }
  if (els.payoutModal) {
    els.payoutModal.classList.remove('hidden');
    els.payoutModal.setAttribute('aria-hidden', 'false');
  }
  setTimeout(() => els.payoutAmountInput && els.payoutAmountInput.focus(), 0);
}

function closePayoutModal() {
  if (els.payoutModal) {
    els.payoutModal.classList.add('hidden');
    els.payoutModal.setAttribute('aria-hidden', 'true');
  }
  payoutTarget = { serviceKey: null, name: null };
}

function openPayoutDeleteModal(operation) {
  if (!operation || !operation.id || !canDeletePayout() || !els.payoutDeleteModal) return;
  payoutDeleteTarget = operation;
  const svcTitle = PERCENTAGES[operation.serviceKey] ? PERCENTAGES[operation.serviceKey].title : operation.serviceKey;
  if (els.payoutDeleteSummary) {
    els.payoutDeleteSummary.textContent = `Удалить выплату ${formatMoney(operation.amount)} ₽ у «${operation.name}» (${svcTitle}) и вернуть сумму в баланс.`;
  }
  if (els.payoutDeleteReason) els.payoutDeleteReason.value = '';
  if (els.payoutDeleteStatus) {
    els.payoutDeleteStatus.textContent = '';
    els.payoutDeleteStatus.style.color = '';
  }
  els.payoutDeleteModal.classList.remove('hidden');
  els.payoutDeleteModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => els.payoutDeleteReason && els.payoutDeleteReason.focus(), 0);
}

function closePayoutDeleteModal() {
  if (!els.payoutDeleteModal) return;
  els.payoutDeleteModal.classList.add('hidden');
  els.payoutDeleteModal.setAttribute('aria-hidden', 'true');
  payoutDeleteTarget = null;
}

function takeSalarySnapshot() {
  takeSalarySnapshotCore(SALARY);
  addAudit('snapshot_take', { snapshots: SALARY.snapshots.length });
  saveSalaryState();
  setUiStatus('Снимок состояния сохранён.', 'ok');
}

function restoreLastSalarySnapshot() {
  const snapshots = Array.isArray(SALARY.snapshots) ? SALARY.snapshots : [];
  if (!snapshots.length) {
    setUiStatus('Нет снимков для отката.', 'danger');
    return;
  }
  if (!window.confirm('Откатить состояние к последнему снимку?')) return;
  const restored = restoreLastSalarySnapshotCore(SALARY);
  if (!restored.ok) {
    setUiStatus('Нет снимков для отката.', 'danger');
    return;
  }
  addAudit('snapshot_restore', { at: restored.snapshotAt || null });
  saveSalaryState();
  renderSalaryModule();
  if (salaryDetailOpenKey && els.salaryDetailModal && !els.salaryDetailModal.classList.contains('hidden')) {
    renderSalaryDetailBody(salaryDetailOpenKey);
  }
  if (els.personHistoryModal && !els.personHistoryModal.classList.contains('hidden')) {
    renderPersonHistoryBody();
  }
  setUiStatus('Состояние откатили к последнему снимку.', 'ok');
}

function confirmPayoutDelete() {
  if (!canDeletePayout() || !payoutDeleteTarget || !els.payoutDeleteReason) return;
  const reason = String(els.payoutDeleteReason.value || '').trim();
  if (!reason) {
    if (els.payoutDeleteStatus) {
      els.payoutDeleteStatus.textContent = 'Причина удаления обязательна.';
      els.payoutDeleteStatus.style.color = 'var(--danger)';
    }
    return;
  }

  const { id, serviceKey, name } = payoutDeleteTarget;
  const actor = getCurrentActor();
  const deleted = deletePayout(SALARY, {
    id,
    serviceKey,
    name,
    actor,
    reason,
  });
  if (!deleted.ok) {
    if (els.payoutDeleteStatus) {
      els.payoutDeleteStatus.textContent = 'Эта выплата уже удалена или не найдена.';
      els.payoutDeleteStatus.style.color = 'var(--danger)';
    }
    return;
  }

  const payout = deleted.payout;
  addAudit('payout_deleted', {
    payoutId: payout.id,
    serviceKey,
    name,
    amount: payout.amount,
    reason,
  });

  saveSalaryState();
  closePayoutDeleteModal();
  renderSalaryModule();
  if (salaryDetailOpenKey && els.salaryDetailModal && !els.salaryDetailModal.classList.contains('hidden')) {
    renderSalaryDetailBody(salaryDetailOpenKey);
  }
  if (
    personHistoryTarget.serviceKey === serviceKey &&
    personHistoryTarget.name === name &&
    els.personHistoryModal &&
    !els.personHistoryModal.classList.contains('hidden')
  ) {
    renderPersonHistoryBody();
  }
}

function confirmPayout() {
  const { serviceKey, name } = payoutTarget;
  if (!serviceKey || !name || !els.payoutAmountInput) return;
  const raw = String(els.payoutAmountInput.value).trim();
  if (raw === '') {
    if (els.payoutModalStatus) {
      els.payoutModalStatus.textContent = 'Введите сумму выплаты.';
      els.payoutModalStatus.style.color = 'var(--danger)';
    }
    return;
  }
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    if (els.payoutModalStatus) {
      els.payoutModalStatus.textContent = 'Нужно число, например 5000 или 1500,50.';
      els.payoutModalStatus.style.color = 'var(--danger)';
    }
    return;
  }
  if (amount <= 0) {
    if (els.payoutModalStatus) {
      els.payoutModalStatus.textContent = 'Сумма должна быть больше нуля.';
      els.payoutModalStatus.style.color = 'var(--danger)';
    }
    return;
  }
  const actor = getCurrentActor();
  const applied = applyPayout(SALARY, { serviceKey, name, amount, actor });
  if (!applied.ok) {
    if (els.payoutModalStatus) {
      els.payoutModalStatus.textContent = 'Не удалось провести выплату.';
      els.payoutModalStatus.style.color = 'var(--danger)';
    }
    return;
  }
  addAudit('payout_created', { serviceKey, name, amount });
  saveSalaryState();
  const reopenKey = serviceKey;
  closePayoutModal();
  renderSalaryModule();
  if (reopenKey && els.salaryDetailModal && !els.salaryDetailModal.classList.contains('hidden')) {
    renderSalaryDetailBody(reopenKey);
  }
  if (
    personHistoryTarget.serviceKey === serviceKey &&
    personHistoryTarget.name === name &&
    els.personHistoryModal &&
    !els.personHistoryModal.classList.contains('hidden')
  ) {
    renderPersonHistoryBody();
  }
}

function renderSalaryModule() {
  if (!els.salaryDirections) return;
  const buttonsHtml = Object.keys(DEFAULT_STRUCTURE)
    .map((key) => {
      const title = PERCENTAGES[key].title;
      const total = sumServiceBalances(key);
      return `
        <button type="button" class="settings-hub-btn" data-salary-open="${escapeAttr(key)}">
          <span class="settings-hub-btn__title">${escapeHtml(title)}</span>
          <span class="settings-hub-btn__hint salary-hub-balance">${formatMoney(total)}</span>
        </button>
      `;
    })
    .join('');
  els.salaryDirections.innerHTML = `<div class="settings-hub">${buttonsHtml}</div>`;
}

function toNumber(value) {
  return toNumberCore(value);
}

function formatMoney(num) {
  return formatMoneyCore(num);
}

function formatPercentForMessage(total) {
  return formatPercentForMessageCore(total);
}

function collectPercentIssues(structure) {
  const list = [];
  for (const key of Object.keys(DEFAULT_STRUCTURE)) {
    const svc = structure[key];
    if (!svc) continue;
    const total = sumPercents(svc.items);
    if (!isPercentTotalValid(total)) {
      list.push({ key, title: svc.title, total });
    }
  }
  return list;
}

function updateLoadWarningBanner() {
  if (!els.loadWarning) return;
  const issues = collectPercentIssues(PERCENTAGES);
  if (issues.length === 0) {
    els.loadWarning.classList.add('hidden');
    els.loadWarning.textContent = '';
    return;
  }
  els.loadWarning.classList.remove('hidden');
  els.loadWarning.textContent =
    issues
      .map(
        (i) =>
          `«${i.title}»: сейчас ${formatPercentForMessage(i.total)}%, а нужно ровно ${PercentLogic.PERCENT_TOTAL_TARGET}%.`
      )
      .join(' ') +
    ' Открой «Настройки» → выбери направление и подгони проценты так, чтобы в каждом блоке сумма была 100%.';
}

function refreshUIFromCloud() {
  updateLoadWarningBanner();
  renderSalaryModule();
  if (currentRole === 'owner' && activePanel === 'settings') {
    renderSettings();
  }
  if (els.salaryDetailModal && !els.salaryDetailModal.classList.contains('hidden') && salaryDetailOpenKey) {
    renderSalaryDetailBody(salaryDetailOpenKey);
  }
  if (
    els.personHistoryModal &&
    !els.personHistoryModal.classList.contains('hidden') &&
    personHistoryTarget.serviceKey &&
    personHistoryTarget.name
  ) {
    renderPersonHistoryBody();
  }
  const hasInput =
    toNumber(els.mobileAngel.value) ||
    toNumber(els.nova.value) ||
    toNumber(els.tlabs.value);
  if (activePanel === 'distribution' && hasInput) {
    calculate({ accrueSalary: false });
  }
}

function renderService(title, inputSum, data) {
  const rows = Object.entries(data)
    .map(([name, value]) => `<div class="row"><span>${escapeHtml(name)}</span><strong>${formatMoney(value)}</strong></div>`)
    .join('');

  return `
        <div class="service-box">
          <div class="service-title">
            <h3>${escapeHtml(title)}</h3>
            <span class="badge">${formatMoney(inputSum)}</span>
          </div>
          ${rows}
        </div>
      `;
}

function buildWhatsappText(allResults) {
  const sections = [];

  for (const [key, result] of Object.entries(allResults.services)) {
    sections.push(`📊 ${PERCENTAGES[key].title} (${formatMoney(allResults.inputs[key])})`);
    for (const [name, value] of Object.entries(result)) {
      sections.push(`${name} — ${formatMoney(value)}`);
    }
    sections.push('');
  }

  sections.push('📌 ИТОГ');
  for (const [name, value] of Object.entries(allResults.personTotals)) {
    sections.push(`${name} — ${formatMoney(value)}`);
  }

  return sections.join('\n');
}

function calculate(options = {}) {
  const accrueSalary = options.accrueSalary !== false;

  const inputs = {
    mobileAngel: toNumber(els.mobileAngel.value),
    nova: toNumber(els.nova.value),
    tlabs: toNumber(els.tlabs.value),
  };

  if (!inputs.mobileAngel && !inputs.nova && !inputs.tlabs) {
    els.status.textContent =
      'Введите хотя бы одну сумму больше нуля (Мобильный ангел, Нова или Т‑лабс), затем нажми «Рассчитать».';
    els.status.style.color = 'var(--danger)';
    return;
  }

  const services = {
    mobileAngel: calcService(inputs.mobileAngel, PERCENTAGES.mobileAngel),
    nova: calcService(inputs.nova, PERCENTAGES.nova),
    tlabs: calcService(inputs.tlabs, PERCENTAGES.tlabs),
  };

  if (accrueSalary) {
    accrueSalaryFromServices(services);
    if (
      els.personHistoryModal &&
      !els.personHistoryModal.classList.contains('hidden') &&
      personHistoryTarget.serviceKey &&
      personHistoryTarget.name
    ) {
      renderPersonHistoryBody();
    }
  }

  const personKeys = BASE_PERSON_KEYS;
  const personTotals = {};

  personKeys.forEach((name) => {
    personTotals[name] = 0;
  });

  for (const service of Object.values(services)) {
    for (const person of personKeys) {
      personTotals[person] += service[person] || 0;
    }
  }

  for (const key of Object.keys(personTotals)) {
    personTotals[key] = +personTotals[key].toFixed(2);
  }

  els.resultGrid.innerHTML = Object.entries(services)
    .map(([key, data]) => renderService(PERCENTAGES[key].title, inputs[key], data))
    .join('');

  els.totals.innerHTML = `
        <div class="service-box">
          <h3>Итог по людям</h3>
          ${Object.entries(personTotals)
            .map(([name, value]) => `<div class="row"><span>${escapeHtml(name)}</span><strong>${formatMoney(value)}</strong></div>`)
            .join('')}
        </div>
      `;

  els.output.value = buildWhatsappText({ inputs, services, personTotals });
  els.status.textContent = 'Готово.';
  els.status.style.color = 'var(--ok)';
  renderSalaryModule();
}

async function copyText() {
  const text = els.output.value.trim();
  if (!text) {
    els.status.textContent = 'Сначала введи суммы и нажми «Рассчитать» — после этого можно скопировать текст.';
    els.status.style.color = 'var(--danger)';
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    els.status.textContent = 'Текст скопирован. Вставь в нужный чат (например, Telegram).';
    els.status.style.color = 'var(--ok)';
  } catch (error) {
    els.output.focus();
    els.output.select();
    els.status.textContent =
      'Автокопирование недоступно. Скопируй вручную (Ctrl+C или из меню) — текст уже выделен в поле ниже.';
    els.status.style.color = 'var(--danger)';
  }
}

function clearAll() {
  els.mobileAngel.value = '';
  els.nova.value = '';
  els.tlabs.value = '';
  els.output.value = '';
  els.resultGrid.innerHTML = '<div class="empty-note">Пока пусто. Нажми «Рассчитать» в блоке под суммами.</div>';
  els.totals.innerHTML = '';
  els.status.textContent = 'Поля очищены. Можно ввести новые суммы.';
  els.status.style.color = 'var(--muted)';
  els.mobileAngel.focus();
}

function normalizeCalcText(str) {
  if (!Number.isFinite(Number(str))) return '0';
  const n = Number(str);
  if (Object.is(n, -0)) return '0';
  const text = String(n);
  if (text.length <= CALC_MAX_LEN) return text;
  return n.toPrecision(Math.max(6, CALC_MAX_LEN - 6));
}

function calcOperatorSymbol(operator) {
  if (operator === 'add') return '+';
  if (operator === 'subtract') return '−';
  if (operator === 'multiply') return '×';
  if (operator === 'divide') return '÷';
  return '';
}

function normalizeExprOperand(text) {
  const n = Number(text);
  if (!Number.isFinite(n)) return '0';
  return String(n);
}

/** Верхняя строка дисплея: видно цепочку «что с чем» (операторы и операнды). */
function getCalculatorTapeText() {
  if (calculatorState.error) return '';
  const ex = (calculatorState.expression || '').trim();
  if (!ex) return '';
  if (calculatorState.waitingNext && calculatorState.operator) {
    return ex;
  }
  const disp = calculatorState.display ?? '0';
  return `${ex} ${disp}`.replace(/\s+/g, ' ').trim();
}

function scrollCalcStripToEnd(scrollEl) {
  if (!scrollEl) return;
  requestAnimationFrame(() => {
    scrollEl.scrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
  });
}

function renderCalculator() {
  if (!els.calculatorMain || !els.calculatorScreen) return;
  const mainText = calculatorState.display || '0';
  els.calculatorMain.textContent = mainText;
  const tape = getCalculatorTapeText();
  if (els.calculatorExpr) {
    els.calculatorExpr.textContent = tape;
    els.calculatorExpr.classList.toggle('calculator-screen__expr--long', tape.length > 22);
  }
  const tapeScroll = els.calculatorScreen.querySelector('.calculator-screen__expr-scroll');
  const mainScroll = els.calculatorScreen.querySelector('.calculator-screen__main-scroll');
  scrollCalcStripToEnd(tapeScroll);
  scrollCalcStripToEnd(mainScroll);
  const a11y = tape ? `${tape}, ${mainText}` : mainText;
  els.calculatorScreen.setAttribute('aria-label', a11y);
}

function renderCalculatorHistory() {
  if (!els.calculatorHistoryList) return;
  if (!calculatorState.history.length) {
    els.calculatorHistoryList.innerHTML = '<p class="calculator-history__empty">История пуста.</p>';
    return;
  }
  els.calculatorHistoryList.innerHTML = calculatorState.history
    .map(
      (item, idx) => `<button type="button" class="calculator-history__item" data-calc-history-index="${idx}">
        <span class="calculator-history__expr">${escapeHtml(item.expr)}</span>
        <strong class="calculator-history__result">${escapeHtml(item.result)}</strong>
      </button>`
    )
    .join('');
}

function openCalculatorHistory() {
  if (!els.calculatorHistoryPanel) return;
  renderCalculatorHistory();
  els.calculatorHistoryPanel.classList.remove('hidden');
  els.calculatorHistoryPanel.setAttribute('aria-hidden', 'false');
}

function closeCalculatorHistory() {
  if (!els.calculatorHistoryPanel) return;
  els.calculatorHistoryPanel.classList.add('hidden');
  els.calculatorHistoryPanel.setAttribute('aria-hidden', 'true');
}

function pushCalculatorHistory(expr, result) {
  const item = { expr: String(expr || '').trim(), result: String(result || '').trim() };
  if (!item.expr || !item.result) return;
  calculatorState.history.unshift(item);
  if (calculatorState.history.length > CALC_HISTORY_LIMIT) {
    calculatorState.history = calculatorState.history.slice(0, CALC_HISTORY_LIMIT);
  }
}

function resetCalculator() {
  calculatorState.display = '0';
  calculatorState.stored = null;
  calculatorState.operator = null;
  calculatorState.waitingNext = false;
  calculatorState.error = false;
  calculatorState.expression = '';
  renderCalculator();
}

function applyCalculatorOperation(left, right, operator) {
  if (operator === 'add') return left + right;
  if (operator === 'subtract') return left - right;
  if (operator === 'multiply') return left * right;
  if (operator === 'divide') {
    if (right === 0) return null;
    return left / right;
  }
  return right;
}

function inputCalcDigit(digit) {
  if (calculatorState.error) resetCalculator();
  if (calculatorState.waitingNext) {
    calculatorState.display = digit;
    calculatorState.waitingNext = false;
    renderCalculator();
    return;
  }
  if (calculatorState.display === '0') {
    calculatorState.display = digit;
  } else if (calculatorState.display.length < CALC_MAX_LEN) {
    calculatorState.display += digit;
  }
  renderCalculator();
}

function inputCalcDot() {
  if (calculatorState.error) resetCalculator();
  if (calculatorState.waitingNext) {
    calculatorState.display = '0.';
    calculatorState.waitingNext = false;
    renderCalculator();
    return;
  }
  if (!calculatorState.display.includes('.')) {
    calculatorState.display += '.';
    renderCalculator();
  }
}

function toggleCalcSign() {
  if (calculatorState.error) return;
  if (calculatorState.display === '0') return;
  calculatorState.display = calculatorState.display.startsWith('-')
    ? calculatorState.display.slice(1)
    : `-${calculatorState.display}`;
  renderCalculator();
}

function calcPercent() {
  if (calculatorState.error) return;
  const current = Number(calculatorState.display);
  if (!Number.isFinite(current)) return;
  calculatorState.display = normalizeCalcText(String(current / 100));
  calculatorState.waitingNext = false;
  renderCalculator();
}

function computePendingCalc() {
  const current = Number(calculatorState.display);
  if (!Number.isFinite(current)) return;
  if (calculatorState.stored == null || !calculatorState.operator) {
    calculatorState.stored = current;
    return;
  }
  const out = applyCalculatorOperation(calculatorState.stored, current, calculatorState.operator);
  if (out == null || !Number.isFinite(out)) {
    calculatorState.display = 'Ошибка';
    calculatorState.error = true;
    calculatorState.stored = null;
    calculatorState.operator = null;
    calculatorState.waitingNext = true;
    renderCalculator();
    return;
  }
  calculatorState.stored = out;
  calculatorState.display = normalizeCalcText(String(out));
  renderCalculator();
}

function chooseCalcOperator(operator) {
  if (calculatorState.error) return;
  const symbol = calcOperatorSymbol(operator);
  if (!symbol) return;
  if (calculatorState.waitingNext) {
    if (calculatorState.expression) {
      calculatorState.expression = calculatorState.expression.replace(/[+\-−×÷]\s*$/, symbol);
    } else {
      calculatorState.expression = `${normalizeExprOperand(calculatorState.display)} ${symbol}`;
    }
    calculatorState.operator = operator;
    renderCalculator();
    return;
  }
  const operand = normalizeExprOperand(calculatorState.display);
  if (!calculatorState.expression) {
    calculatorState.expression = operand;
  } else {
    calculatorState.expression = `${calculatorState.expression} ${operand}`;
  }
  computePendingCalc();
  if (calculatorState.error) return;
  calculatorState.operator = operator;
  calculatorState.waitingNext = true;
  calculatorState.expression = `${calculatorState.expression} ${symbol}`;
  renderCalculator();
}

function equalCalc() {
  if (calculatorState.error) return;
  if (calculatorState.waitingNext && calculatorState.operator) return;
  const operand = normalizeExprOperand(calculatorState.display);
  const expr = calculatorState.expression
    ? `${calculatorState.expression} ${operand}`.trim()
    : operand;
  computePendingCalc();
  if (calculatorState.error) return;
  const result = normalizeExprOperand(calculatorState.display);
  pushCalculatorHistory(expr, result);
  calculatorState.operator = null;
  calculatorState.waitingNext = true;
  calculatorState.expression = '';
  renderCalculator();
}

function calcBackspace() {
  if (activePanel !== 'calculator') return;
  if (calculatorState.error) {
    resetCalculator();
    return;
  }
  if (calculatorState.waitingNext) return;
  const cur = calculatorState.display;
  if (cur.length <= 1 || (cur.length === 2 && cur.startsWith('-'))) {
    calculatorState.display = '0';
  } else {
    calculatorState.display = cur.slice(0, -1);
  }
  renderCalculator();
}

function handleCalculatorAction(action) {
  if (action === 'clear') {
    resetCalculator();
    return;
  }
  if (action === 'dot') {
    inputCalcDot();
    return;
  }
  if (action === 'sign') {
    toggleCalcSign();
    return;
  }
  if (action === 'percent') {
    calcPercent();
    return;
  }
  if (action === 'equals') {
    equalCalc();
  }
}

function initCalculator() {
  resetCalculator();
  if (els.calculatorGrid) {
    els.calculatorGrid.addEventListener('click', (e) => {
      const digitBtn = e.target.closest('[data-calc-digit]');
      if (digitBtn) {
        inputCalcDigit(String(digitBtn.getAttribute('data-calc-digit') || '0'));
        return;
      }
      const opBtn = e.target.closest('[data-calc-op]');
      if (opBtn) {
        chooseCalcOperator(String(opBtn.getAttribute('data-calc-op') || ''));
        return;
      }
      const actionBtn = e.target.closest('[data-calc-action]');
      if (actionBtn) {
        handleCalculatorAction(String(actionBtn.getAttribute('data-calc-action') || ''));
      }
    });
  }
  if (els.calculatorBackBtn) {
    els.calculatorBackBtn.addEventListener('click', showDistribution);
  }
  if (els.calculatorHistoryBtn) {
    els.calculatorHistoryBtn.addEventListener('click', openCalculatorHistory);
  }
  if (els.calculatorHistoryCloseBtn) {
    els.calculatorHistoryCloseBtn.addEventListener('click', closeCalculatorHistory);
  }
  if (els.calculatorHistoryCloseArea) {
    els.calculatorHistoryCloseArea.addEventListener('click', closeCalculatorHistory);
  }
  if (els.calculatorHistoryList) {
    els.calculatorHistoryList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-calc-history-index]');
      if (!btn) return;
      const idx = Number(btn.getAttribute('data-calc-history-index'));
      const row = Number.isFinite(idx) && idx >= 0 ? calculatorState.history[idx] : null;
      if (!row) return;
      calculatorState.display = row.result;
      calculatorState.stored = Number(row.result);
      calculatorState.operator = null;
      calculatorState.waitingNext = true;
      calculatorState.error = false;
      calculatorState.expression = '';
      renderCalculator();
      closeCalculatorHistory();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (activePanel !== 'calculator') return;
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      inputCalcDigit(e.key);
      return;
    }
    if (e.key === '.') {
      e.preventDefault();
      inputCalcDot();
      return;
    }
    if (e.key === '+' || e.key === '-') {
      e.preventDefault();
      chooseCalcOperator(e.key === '+' ? 'add' : 'subtract');
      return;
    }
    if (e.key === '*' || e.key.toLowerCase() === 'x') {
      e.preventDefault();
      chooseCalcOperator('multiply');
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      chooseCalcOperator('divide');
      return;
    }
    if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      equalCalc();
      return;
    }
    if (e.key === '%') {
      e.preventDefault();
      calcPercent();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      calcBackspace();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (els.calculatorHistoryPanel && !els.calculatorHistoryPanel.classList.contains('hidden')) {
        closeCalculatorHistory();
        return;
      }
      resetCalculator();
    }
  });
}

function login() {
  const loginVal = els.loginInput.value.trim();
  const password = els.passwordInput.value.trim();

  if (loginVal === USERS.admin.login && password === USERS.admin.password) {
    setAuth('admin', loginVal);
    return;
  }

  if (loginVal === USERS.owner.login && password === USERS.owner.password) {
    setAuth('owner', loginVal);
    return;
  }

  els.loginStatus.textContent =
    'Неверный логин или пароль. Проверь раскладку клавиатуры и Caps Lock, затем попробуй снова.';
  els.loginStatus.style.color = 'var(--danger)';
}

function setAuth(role, loginVal) {
  currentRole = role;
  currentUserLogin = loginVal || (role === 'owner' ? USERS.owner.login : USERS.admin.login);
  localStorage.setItem(STORAGE_KEYS.auth, role);
  localStorage.setItem(STORAGE_KEYS.authLogin, currentUserLogin);
  els.loginScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  els.loginStatus.textContent = '';
  els.loginInput.value = '';
  els.passwordInput.value = '';
  activePanel = 'distribution';
  updateRoleUI();
  updateLoadWarningBanner();
  renderSalaryModule();
  document.body.classList.remove('mobile-nav-expanded');
  syncMobileNavChrome();
}

function logout() {
  currentRole = null;
  currentUserLogin = null;
  localStorage.removeItem(STORAGE_KEYS.auth);
  localStorage.removeItem(STORAGE_KEYS.authLogin);
  els.appScreen.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
  activePanel = 'distribution';
  document.body.classList.remove('mobile-nav-expanded');
  syncAppPanelMode();
  if (els.loadWarning) {
    els.loadWarning.classList.add('hidden');
    els.loadWarning.textContent = '';
  }
}

function updateRoleUI() {
  const roleLabel = currentRole === 'owner' ? 'Владелец' : 'Администратор';
  if (els.roleBadge) {
    els.roleBadge.setAttribute('aria-label', `Текущая роль: ${roleLabel}`);
    els.roleBadge.setAttribute('title', roleLabel);
  }
  if (currentRole === 'owner') {
    els.settingsBtn.classList.remove('hidden');
    if (els.devToolsBtn) els.devToolsBtn.classList.remove('hidden');
  } else {
    els.settingsBtn.classList.add('hidden');
    if (els.devToolsBtn) els.devToolsBtn.classList.add('hidden');
    if (activePanel === 'settings') {
      activePanel = 'distribution';
    }
  }
  syncAppPanelMode();
}

function setDevToolsStatus(msg, kind = 'muted') {
  if (!els.devToolsStatus) return;
  els.devToolsStatus.textContent = msg;
  const colorVar =
    kind === 'ok' ? 'var(--ok)' : kind === 'danger' ? 'var(--danger)' : 'var(--muted)';
  els.devToolsStatus.style.color = colorVar;
}

function clearAccrualsData() {
  const nextState = {
    balances: {},
    payoutLog: Array.isArray(SALARY.payoutLog) ? SALARY.payoutLog : [],
    accrualLog: [],
    payoutDeletionLog: Array.isArray(SALARY.payoutDeletionLog) ? SALARY.payoutDeletionLog : [],
    snapshots: Array.isArray(SALARY.snapshots) ? SALARY.snapshots : [],
    auditLog: Array.isArray(SALARY.auditLog) ? SALARY.auditLog : [],
  };
  SALARY = normalizeSalaryState(nextState, PERCENTAGES);
}

function resetCategoriesAndLinkedData() {
  PERCENTAGES = deepClone(DEFAULT_STRUCTURE);
  SALARY = normalizeSalaryState(null, PERCENTAGES);
  settingsNavView = 'hub';
  settingsDetailKey = null;
  settingsDetailDirty = false;
}

function closeDevToolsModal() {
  if (!els.devToolsModal) return;
  els.devToolsModal.classList.add('hidden');
  els.devToolsModal.setAttribute('aria-hidden', 'true');
  devToolsActionTarget = null;
  if (els.devToolsConfirmInput) els.devToolsConfirmInput.value = '';
  setDevToolsStatus('', 'muted');
}

function openDevToolsModal() {
  if (currentRole !== 'owner' || !els.devToolsModal) return;
  els.devToolsModal.classList.remove('hidden');
  els.devToolsModal.setAttribute('aria-hidden', 'false');
  devToolsActionTarget = null;
  if (els.devToolsConfirmInput) {
    els.devToolsConfirmInput.value = '';
    els.devToolsConfirmInput.focus();
  }
  setDevToolsStatus('', 'muted');
}

function runDevToolsAction(action) {
  if (currentRole !== 'owner') return;
  const phrase = String((els.devToolsConfirmInput && els.devToolsConfirmInput.value) || '').trim();
  if (phrase !== 'ПОДТВЕРЖДАЮ') {
    setDevToolsStatus('Введите фразу ПОДТВЕРЖДАЮ.', 'danger');
    return;
  }
  devToolsActionTarget = action;
  if (action === 'clear_accruals') {
    clearAccrualsData();
    saveSalaryState();
  } else if (action === 'reset_categories') {
    resetCategoriesAndLinkedData();
    savePercentages();
    saveSalaryState();
  } else {
    return;
  }
  calculate({ accrueSalary: false });
  renderSalaryModule();
  renderSettings();
  updateLoadWarningBanner();
  setDevToolsStatus('Готово', 'ok');
}

function openSettingsHub() {
  settingsNavView = 'hub';
  settingsDetailKey = null;
  settingsDetailDirty = false;
}

function syncAppPanelMode() {
  const isOwner = currentRole === 'owner';
  if (!isOwner && activePanel === 'settings') {
    activePanel = 'distribution';
  }

  const settingsVisible = activePanel === 'settings' && isOwner;
  const salaryVisible = activePanel === 'salary';
  const distributionVisible = activePanel === 'distribution';
  const calculatorVisible = activePanel === 'calculator';

  if (els.settingsCard) {
    els.settingsCard.classList.toggle('hidden', !settingsVisible);
  }
  if (els.salaryCard) {
    els.salaryCard.classList.toggle('hidden', !salaryVisible);
  }
  if (els.calculatorCard) {
    els.calculatorCard.classList.toggle('hidden', !calculatorVisible);
  }
  if (!calculatorVisible) {
    closeCalculatorHistory();
  }

  document.body.classList.toggle('settings-open', settingsVisible);
  document.body.classList.toggle('salary-open', salaryVisible);
  document.body.classList.toggle('distribution-open', distributionVisible);
  document.body.classList.toggle('calculator-open', calculatorVisible);

  if (els.distributionBtn) {
    if (distributionVisible) els.distributionBtn.setAttribute('aria-current', 'page');
    else els.distributionBtn.removeAttribute('aria-current');
  }
  if (els.salaryBtn) {
    if (salaryVisible) els.salaryBtn.setAttribute('aria-current', 'page');
    else els.salaryBtn.removeAttribute('aria-current');
  }
  if (els.settingsBtn) {
    if (settingsVisible) els.settingsBtn.setAttribute('aria-current', 'page');
    else els.settingsBtn.removeAttribute('aria-current');
  }
  if (els.calculatorBtn) {
    if (calculatorVisible) els.calculatorBtn.setAttribute('aria-current', 'page');
    else els.calculatorBtn.removeAttribute('aria-current');
  }
}

function showDistribution() {
  if (activePanel === 'distribution') return;
  activePanel = 'distribution';
  openSettingsHub();
  syncAppPanelMode();
}

function showSalary() {
  if (!els.salaryCard) return;
  if (activePanel === 'salary') return;
  activePanel = 'salary';
  syncAppPanelMode();
  renderSalaryModule();
}

function showSettings() {
  if (currentRole !== 'owner') return;
  if (activePanel === 'settings') return;
  activePanel = 'settings';
  openSettingsHub();
  syncAppPanelMode();
  renderSettings();
}

function showCalculator() {
  if (!els.calculatorCard) return;
  if (activePanel === 'calculator') return;
  activePanel = 'calculator';
  syncAppPanelMode();
  renderCalculator();
}

function settingsGoBack() {
  if (currentRole !== 'owner') return;
  if (settingsNavView !== 'detail') return;
  if (settingsDetailDirty) {
    if (!window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
  }
  settingsDetailDirty = false;
  openSettingsHub();
  renderSettings();
}

function markSettingsDetailDirty() {
  if (settingsNavView === 'detail') settingsDetailDirty = true;
}

function attachSettingsDetailDirtyTracking() {
  attachSettingsDetailDirtyTrackingModule({
    rootEl: els.settingsContent,
    onDirty: markSettingsDetailDirty,
  });
}

function bindDeleteCategoryButtons() {
  bindDeleteCategoryButtonsModule({
    rootDocument: document,
    getPercentages: () => PERCENTAGES,
    setPercentages: (next) => {
      PERCENTAGES = next;
    },
    deepClone,
    sumPercents,
    isPercentTotalValid,
    formatPercentForMessage,
    savePercentages,
    syncSalaryWithPercentages,
    updateLoadWarningBanner,
    setSettingsStatus: (msg, kind) => {
      els.settingsStatus.textContent = msg;
      els.settingsStatus.style.color = kind === 'danger' ? 'var(--danger)' : 'var(--ok)';
    },
    setSettingsDetailDirty: (v) => {
      settingsDetailDirty = v;
    },
    renderSettings,
    confirmDelete: () => window.confirm('Точно удалить?'),
  });
}

function renderSettingsHub() {
  settingsNavView = 'hub';
  settingsDetailKey = null;

  if (els.settingsBackBtn) els.settingsBackBtn.classList.add('hidden');
  if (els.settingsTitle) els.settingsTitle.textContent = 'Настройки';
  if (els.settingsSaveWrap) els.settingsSaveWrap.classList.add('hidden');
  if (els.settingsHint) els.settingsHint.classList.add('hidden');

  const buttonsHtml = Object.entries(PERCENTAGES)
    .map(
      ([serviceKey, service]) => `
      <button type="button" class="settings-hub-btn" data-settings-service="${escapeAttr(serviceKey)}">
        <span class="settings-hub-btn__title">${escapeHtml(service.title)}</span>
        <span class="settings-hub-btn__hint">Проценты и категории</span>
      </button>
    `
    )
    .join('');

  els.settingsContent.innerHTML = `<div class="settings-hub">${buttonsHtml}</div>`;

  els.settingsContent.querySelectorAll('[data-settings-service]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-settings-service');
      if (!key || !PERCENTAGES[key]) return;
      settingsNavView = 'detail';
      settingsDetailKey = key;
      settingsDetailDirty = false;
      renderSettings();
    });
  });
}

function renderSettingsDetail(serviceKey) {
  const service = PERCENTAGES[serviceKey];
  if (!service) {
    openSettingsHub();
    renderSettingsHub();
    return;
  }

  settingsNavView = 'detail';
  settingsDetailKey = serviceKey;
  settingsDetailDirty = false;

  if (els.settingsBackBtn) els.settingsBackBtn.classList.remove('hidden');
  if (els.settingsTitle) els.settingsTitle.textContent = service.title;
  if (els.settingsSaveWrap) els.settingsSaveWrap.classList.remove('hidden');
  if (els.settingsHint) els.settingsHint.classList.remove('hidden');

  const rows = Object.entries(service.items)
    .map(([name, percent]) => {
      const isProtected =
        BASE_PERSON_KEYS.includes(name) ||
        Object.prototype.hasOwnProperty.call(DEFAULT_STRUCTURE[serviceKey].items, name);

      return `
            <div class="percent-row">
              <input type="text" value="${escapeAttr(name)}" data-type="name" data-service="${serviceKey}" data-old-name="${escapeAttr(name)}" ${isProtected ? 'readonly' : ''}>
              <input type="number" step="0.01" value="${percent}" data-type="percent" data-service="${serviceKey}" data-name="${escapeAttr(name)}">
              <button
                class="danger small-btn delete-category-btn"
                type="button"
                data-service="${serviceKey}"
                data-name="${escapeAttr(name)}"
                ${isProtected ? 'data-confirm-delete="true"' : ''}
              >Удалить</button>
            </div>
          `;
    })
    .join('');

  els.settingsContent.innerHTML = `
      <div class="settings-service">
        ${rows}
        <div class="add-category-row">
          <input type="text" placeholder="Название категории" data-add-name="${escapeAttr(serviceKey)}">
          <input type="number" placeholder="%" data-add-percent="${escapeAttr(serviceKey)}">
          <button type="button" data-add-btn="${escapeAttr(serviceKey)}">Добавить</button>
        </div>
      </div>
    `;

  bindDeleteCategoryButtons();
  attachSettingsDetailDirtyTracking();
}

function renderSettings() {
  if (settingsNavView === 'detail' && settingsDetailKey && PERCENTAGES[settingsDetailKey]) {
    renderSettingsDetail(settingsDetailKey);
  } else {
    renderSettingsHub();
  }
}

function saveSettings() {
  if (currentRole !== 'owner') return;
  if (settingsNavView === 'hub') return;

  const newStructure = deepClone(PERCENTAGES);

  const rows = document.querySelectorAll('#settingsContent .percent-row');
  for (const row of rows) {
    const nameInput = row.querySelector('[data-type="name"]');
    const percentInput = row.querySelector('[data-type="percent"]');

    const serviceKey = nameInput.dataset.service;
    const oldName = nameInput.dataset.oldName;
    const newName = nameInput.value.trim();
    const newPercent = toNumber(percentInput.value);

    if (!Number.isFinite(newPercent) || newPercent < 0) {
      continue;
    }

    if (!newName) continue;

    if (oldName !== newName) {
      delete newStructure[serviceKey].items[oldName];
    }

    newStructure[serviceKey].items[newName] = newPercent;
  }

  for (const [, service] of Object.entries(newStructure)) {
    const total = sumPercents(service.items);

    if (!isPercentTotalValid(total)) {
      els.settingsStatus.textContent = `Сумма процентов в "${service.title}" = ${formatPercentForMessage(total)}%. Должно быть ${PercentLogic.PERCENT_TOTAL_TARGET}%.`;
      els.settingsStatus.style.color = 'var(--danger)';
      return;
    }
  }

  PERCENTAGES = newStructure;
  savePercentages();
  syncSalaryWithPercentages();
  addAudit('percentages_updated', { source: 'settings' });
  els.settingsStatus.textContent = 'Настройки сохранены.';
  els.settingsStatus.style.color = 'var(--ok)';
  updateLoadWarningBanner();
  settingsDetailDirty = false;
  calculate({ accrueSalary: false });
  renderSettings();
}

function handleAddCategoryClick(e) {
  const btn = e.target.closest('[data-add-btn]');
  if (!btn || !els.settingsContent.contains(btn)) return;
  if (currentRole !== 'owner') return;

  const serviceKey = btn.getAttribute('data-add-btn');
  if (!serviceKey || !PERCENTAGES[serviceKey]) return;

  const row = btn.closest('.add-category-row');
  if (!row) return;

  const nameInput = row.querySelector('[data-add-name]');
  const percentInput = row.querySelector('[data-add-percent]');
  if (!nameInput || !percentInput) return;

  const newName = nameInput.value.trim();
  if (!newName) {
    els.settingsStatus.textContent = 'Введите название категории.';
    els.settingsStatus.style.color = 'var(--danger)';
    return;
  }

  const percentStr = String(percentInput.value).trim().replace(',', '.');
  if (percentStr === '') {
    els.settingsStatus.textContent = 'Укажите процент.';
    els.settingsStatus.style.color = 'var(--danger)';
    return;
  }

  const percent = Number(percentStr);
  if (!Number.isFinite(percent)) {
    els.settingsStatus.textContent = 'Процент должен быть числом.';
    els.settingsStatus.style.color = 'var(--danger)';
    return;
  }

  const exists = Object.keys(PERCENTAGES[serviceKey].items).some((k) => k.toLowerCase() === newName.toLowerCase());

  if (exists) {
    els.settingsStatus.textContent = 'Такая категория уже есть.';
    els.settingsStatus.style.color = 'var(--danger)';
    return;
  }

  const currentTotal = sumPercents(PERCENTAGES[serviceKey].items);

  if (wouldExceed100(currentTotal, percent)) {
    els.settingsStatus.textContent = 'Сумма процентов превысит 100%.';
    els.settingsStatus.style.color = 'var(--danger)';
    return;
  }

  const next = deepClone(PERCENTAGES);
  next[serviceKey].items[newName] = percent;
  PERCENTAGES = next;
  savePercentages();
  syncSalaryWithPercentages();
  updateLoadWarningBanner();
  els.settingsStatus.textContent = 'Категория добавлена и сохранена.';
  els.settingsStatus.style.color = 'var(--ok)';
  renderSettings();
}

function exportPercentagesJson() {
  if (currentRole !== 'owner') return;
  const blob = new Blob([JSON.stringify(PERCENTAGES, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'calc-percentages-backup.json';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  els.settingsStatus.textContent = 'Файл JSON скачан.';
  els.settingsStatus.style.color = 'var(--ok)';
}

function importPercentagesFromFile(file) {
  file
    .text()
    .then((text) => {
      const parsed = JSON.parse(text);
      PERCENTAGES = mergePercentagesFromParsed(parsed);
      savePercentages();
      syncSalaryWithPercentages();
      addAudit('percentages_imported', { source: 'json_import' });
      updateLoadWarningBanner();
      els.settingsStatus.textContent = 'Импорт выполнен.';
      els.settingsStatus.style.color = 'var(--ok)';
      calculate({ accrueSalary: false });
      openSettingsHub();
      renderSettings();
    })
    .catch(() => {
      els.settingsStatus.textContent =
        'Импорт не удался: файл не JSON или повреждён. Выбери файл, сделанный через «Экспорт JSON» в этом приложении.';
      els.settingsStatus.style.color = 'var(--danger)';
    });
}

function boot() {
  const savedRole = localStorage.getItem(STORAGE_KEYS.auth);
  const savedLogin = localStorage.getItem(STORAGE_KEYS.authLogin);
  if (savedRole === 'admin' || savedRole === 'owner') {
    setAuth(savedRole, savedLogin || undefined);
  } else {
    els.loginScreen.classList.remove('hidden');
    els.appScreen.classList.add('hidden');
  }
}

bindAppUi({
  els,
  login,
  showDistribution,
  showSalary,
  showSettings,
  showCalculator,
  openDevToolsModal,
  settingsGoBack,
  saveSettings,
  handleAddCategoryClick,
  logout,
  exportPercentagesJson,
  canImportPercents: () => currentRole === 'owner',
  openImportFilePicker: () => els.importPercentsFile.click(),
  importPercentagesFromFile,
  calculate,
  copyText,
  clearAll,
  toggleTheme,
  openSalaryDetailModal,
  openPersonHistoryModal,
  openPayoutModal,
  runDevToolsAction,
  closePayoutModal,
  closePayoutDeleteModal,
  closeSalaryDetailModal,
  closePersonHistoryModal,
  closeDevToolsModal,
});

function exportPersonHistoryCsv() {
  if (!personHistoryTarget.serviceKey || !personHistoryTarget.name) return;
  const range = getPersonHistoryDateRange();
  if (!range) {
    setUiStatus('Сначала задайте корректный период для экспорта.', 'danger');
    return;
  }
  const { serviceKey, name } = personHistoryTarget;
  const all = collectPersonOperations(serviceKey, name);
  const ranged = filterOperationsByRange(all, range.start, range.end);
  const ops = applyHistoryFilters(ranged, personHistoryFilters);

  const rows = [['Тип', 'Дата', 'Сумма', 'ID']];
  for (const o of ops) {
    rows.push([o.kind, formatDateTimeRu(o.at), o.amount, o.id || '']);
  }
  const csv = makeCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `history-${serviceKey}-${name}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  addAudit('history_export_csv', {
    serviceKey,
    name,
    rows: ops.length,
  });
  setUiStatus('CSV-отчёт выгружен.', 'ok');
}

bindHistoryUi({
  els,
  setPreset: (preset) => {
    if (preset) {
      setPersonHistoryPreset(preset);
      return;
    }
    updatePersonHistoryPresetButtons(null);
  },
  openDeleteModal: openPayoutDeleteModal,
  renderBody: renderPersonHistoryBody,
  setFilters: ({ type, minAmount, search }) => {
    personHistoryFilters.type = type || 'all';
    personHistoryFilters.minAmount = toNumber(minAmount);
    personHistoryFilters.search = String(search || '').trim();
  },
  exportCsv: exportPersonHistoryCsv,
});

bindPayoutUi({
  els,
  confirmPayout,
  confirmPayoutDelete,
  takeSnapshot: takeSalarySnapshot,
  restoreSnapshot: restoreLastSalarySnapshot,
});

const MOBILE_NAV_MQ = window.matchMedia('(max-width: 639px)');

function initMobileNav() {
  initMobileNavModule({
    toggleEl: els.mobileNavToggle,
    mediaQuery: MOBILE_NAV_MQ,
    bodyEl: document.body,
  });
}

runStartup({
  getState: () => ({ percentages: PERCENTAGES, salary: SALARY }),
  setStateGetter,
  addAudit,
  saveSalaryState,
  setUiStatus,
  persistNow,
  initTheme,
  initMobileNav,
  initCalculator,
  isConfigured,
  initCrmCloud,
  mergePercentagesFromParsed,
  normalizeSalaryState,
  refreshUIFromCloud,
  setPercentages: (next) => {
    PERCENTAGES = next;
  },
  setSalary: (next) => {
    SALARY = next;
  },
  boot,
});
