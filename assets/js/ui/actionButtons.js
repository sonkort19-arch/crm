/**
 * Состояние кнопок действий (только DOM, без бизнес-логики).
 */

import { parseMoneyInput, MAX_PERCENT } from '../core/utils.js';

export function updateGlobalButton() {
  const input = document.getElementById('globalIncome');
  const btn = document.getElementById('addGlobalIncome');
  if (!input || !btn) return;
  const v = parseMoneyInput(input.value);
  btn.disabled = !(v > 0);
}

export function updateDetailButtons() {
  const inc = document.getElementById('income');
  const w = document.getElementById('withdraw');
  const bi = document.getElementById('addIncome');
  const bt = document.getElementById('takeMoney');
  if (!inc || !w || !bi || !bt) return;
  const iv = parseMoneyInput(inc.value);
  const wv = parseMoneyInput(w.value);
  bi.disabled = !(iv > 0);
  bt.disabled = !(wv > 0);
}

export function updateAddUserButton() {
  const n = document.getElementById('newUserNameSettings');
  const p = document.getElementById('newUserPercentSettings');
  const u = document.getElementById('newUserUsernameSettings');
  const pw = document.getElementById('newUserPasswordSettings');
  const btn = document.getElementById('addUserBtn');
  if (!n || !p || !btn) return;
  const nameOk = n.value.trim().length > 0;
  const pv = Number(p.value);
  const pOk = p.value !== '' && Number.isFinite(pv) && pv >= 0 && pv <= MAX_PERCENT;
  const uOk = u ? u.value.trim().length >= 3 : false;
  const pwOk = pw ? pw.value.length >= 4 : false;
  btn.disabled = !(nameOk && pOk && uOk && pwOk);
}

export function updateAllActionButtons() {
  updateGlobalButton();
  updateDetailButtons();
  updateAddUserButton();
}
