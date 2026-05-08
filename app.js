const STORE_KEY = 'moneyDiary.records.v3';
const CATEGORY_KEY = 'moneyDiary.categories.v3';
const BUDGET_KEY = 'moneyDiary.budget.v3';
const CATEGORY_BUDGET_KEY = 'moneyDiary.categoryBudgets.v35';
const MONTHLY_BUDGETS_KEY = 'app-monthly-budgets';
const THEME_KEY = 'moneyDiary.theme.v3';
const THEME_COLOR_KEY = 'moneyDiary.themeColor.v5';
const SAFETY_SNAPSHOT_KEY = 'moneyDiary.safetySnapshot.v41';
const LAST_BACKUP_KEY = 'moneyDiary.lastBackupAt.v43';

const defaultCategories = {
  expense: ['餐飲', '交通', '生活', '娛樂', '購物', '醫療'],
  income: ['薪資', '獎金', '副業', '退款', '其他收入']
};

migrateLegacyData();
let records = load(STORE_KEY, []);
let categories = load(CATEGORY_KEY, defaultCategories);
let categoryBudgets = load(CATEGORY_BUDGET_KEY, {});
let monthlyBudgets = load(MONTHLY_BUDGETS_KEY, {});
let currentType = 'expense';
let selectedCategory = categories.expense[0];
let manageType = 'expense';
let editingRecordId = null;
let editingType = 'expense';

const $ = (id) => document.getElementById(id);
const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
function renderMoneyHTML(el, value){
  const numeric = Number(value || 0);
  const sign = numeric < 0 ? '-' : '';
  const abs = Math.abs(Math.round(numeric)).toLocaleString('zh-TW');
  el.innerHTML = `<span class="currency">NT$</span><span class="value">${sign}${abs}</span>`;
  el.classList.toggle('negative', numeric < 0);
  el.classList.toggle('positive', numeric > 0);
  el.classList.toggle('zero', numeric === 0);
}
function animateMoney(el, target){
  if(!el) return;
  const end = Number(target || 0);
  const start = Number(el.dataset.value || 0);
  el.dataset.value = String(end);
  el.classList.remove('amount-tick');
  void el.offsetWidth;
  el.classList.add('amount-tick');
  const duration = 520;
  const started = performance.now();
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now){
    const t = Math.min(1, (now - started) / duration);
    const current = start + (end - start) * easeOutCubic(t);
    renderMoneyHTML(el, current);
    if(t < 1) requestAnimationFrame(frame);
    else renderMoneyHTML(el, end);
  }
  requestAnimationFrame(frame);
}
const todayISO = () => new Date().toISOString().slice(0,10);

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function migrateLegacyData(){
  if(localStorage.getItem(STORE_KEY)) return;
  const legacyKeys = ['money_diary_records_v2','moneyDiary.records.v2','moneyDiary.records.v1','records'];
  for(const key of legacyKeys){
    const raw = localStorage.getItem(key);
    if(!raw) continue;
    try{
      const data = JSON.parse(raw);
      if(Array.isArray(data) && data.length){
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
        return;
      }
    }catch{}
  }
}
function buildBackupPayload(){
  return {
    app: 'money-diary',
    version: '5.1-month-budget',
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
    categories,
    categoryBudgets,
    monthlyBudgets,
    monthlyBudget: localStorage.getItem(BUDGET_KEY) || '0', // 保留舊版相容
    theme: localStorage.getItem(THEME_KEY) || 'light',
    themeColor: localStorage.getItem(THEME_COLOR_KEY) || 'berry'
  };
}
function createSafetySnapshot(reason='manual'){
  const payload = buildBackupPayload();
  payload.reason = reason;
  payload.snapshotAt = new Date().toISOString();
  localStorage.setItem(SAFETY_SNAPSHOT_KEY, JSON.stringify(payload));
}
function parseLocalDate(iso){
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}
function monthKey(date = new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function isThisMonth(iso){ return iso && iso.slice(0,7) === monthKey(); }
function ymdText(iso){
  const d = parseLocalDate(iso);
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function dateGroupText(iso){
  const target = parseLocalDate(iso);
  const today = parseLocalDate(todayISO());
  const diff = Math.round((today - target) / 86400000);
  if(diff === 0) return '今天';
  if(diff === 1) return '昨天';
  if(diff === 2) return '前天';
  return `${target.getMonth()+1}/${target.getDate()}（${'日一二三四五六'[target.getDay()]}）`;
}

function migrateLegacyMonthlyBudget(){
  if(monthlyBudgets && Object.keys(monthlyBudgets).length) return;
  const legacyBudget = Number(localStorage.getItem(BUDGET_KEY) || 0);
  if(legacyBudget > 0){
    monthlyBudgets[monthKey()] = legacyBudget;
    save(MONTHLY_BUDGETS_KEY, monthlyBudgets);
  }
}

function init(){
  $('recordDate').value = todayISO();
  const now = new Date();
  $('monthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  $('statsMonthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  if($('budgetHomeMonth')) $('budgetHomeMonth').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  migrateLegacyMonthlyBudget();
  if($('budgetMonthInput')) $('budgetMonthInput').value = monthKey();
  loadMonthlyBudgetForm();
  bindEvents();
  applyTheme();
  renderAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

function bindEvents(){
  $('expenseTab').onclick = () => switchType('expense');
  $('incomeTab').onclick = () => switchType('income');
  $('saveBtn').onclick = addRecord;
  $('themeToggle').onclick = toggleTheme;
  bindThemeColorCards();
  $('openCategoryPanel').onclick = openCategoryPanel;
  $('openCategoryPanel2').onclick = openCategoryPanel;
  $('closeCategoryPanel').onclick = closeCategoryPanel;
  $('sheetMask').onclick = closeCategoryPanel;
  $('addCategoryBtn').onclick = addCategory;
  $('newCategoryInput').addEventListener('keydown', e => { if(e.key === 'Enter') addCategory(); });
  $('manageExpenseBtn').onclick = () => switchManageType('expense');
  $('manageIncomeBtn').onclick = () => switchManageType('income');
  $('clearAllBtn').onclick = clearAll;
  $('exportBtn').onclick = exportCSV;
  $('exportBackupBtn').onclick = exportBackup;
  $('restoreSnapshotBtn').onclick = restoreSafetySnapshot;
  $('importBackupBtn').onclick = () => $('importFileInput').click();
  $('importFileInput').onchange = importBackupFile;
  $('cancelEditBtn').onclick = closeEditRecordModal;
  $('saveEditBtn').onclick = saveEditedRecord;
  $('editExpenseBtn').onclick = () => switchEditType('expense');
  $('editIncomeBtn').onclick = () => switchEditType('income');
  $('editRecordModal').onclick = (e) => { if(e.target.id === 'editRecordModal') closeEditRecordModal(); };
  if($('budgetMonthInput')) $('budgetMonthInput').addEventListener('change', loadMonthlyBudgetForm);
  if($('saveMonthlyBudgetBtn')) $('saveMonthlyBudgetBtn').onclick = saveMonthlyBudgetSetting;
  bindSearchEvents();

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.onclick = () => switchPage(btn.dataset.page);
  });
}

function switchType(type){
  currentType = type;
  selectedCategory = categories[type][0] || '';
  $('expenseTab').classList.toggle('active', type === 'expense');
  $('incomeTab').classList.toggle('active', type === 'income');
  renderCategories();
}

function switchPage(page){
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('pageHome').classList.toggle('active', page === 'home');
  $('recordsBlock').classList.toggle('active', page === 'home');
  if($('monthBudgetCard')) $('monthBudgetCard').classList.toggle('active', page === 'home');
  $('pageStats').classList.toggle('active', page === 'stats');
  if($('pageSearch')) $('pageSearch').classList.toggle('active', page === 'search');
  $('pageSettings').classList.toggle('active', page === 'settings');
  window.scrollTo({top:0, behavior:'smooth'});
}

function addRecord(){
  const amount = Number($('amountInput').value);
  const date = $('recordDate').value || todayISO();
  const note = $('noteInput').value.trim();
  if(!amount || amount <= 0){ showToast('請輸入金額'); return; }
  if(!selectedCategory){ showToast('請先選分類'); return; }
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date, type: currentType, amount, category: selectedCategory, note,
    createdAt: new Date().toISOString()
  };
  records.unshift(record);
  save(STORE_KEY, records);
  $('amountInput').value = '';
  $('noteInput').value = '';
  $('recordDate').value = todayISO();
  pulseSaved();
  showToast('已記錄');
  renderAll();
}

function pulseSaved(){
  const card = $('pageHome');
  card.classList.remove('saved-pulse');
  void card.offsetWidth;
  card.classList.add('saved-pulse');
}

function showToast(text){
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1500);
}

function renderAll(){
  renderSummary();
  renderCategories();
  renderRecords();
  renderMonthlyBudget();
  renderChart();
  renderManageList();
  renderDataSafetyStatus();
  renderSearchOptions();
  renderSearchResults();
}

function renderSummary(){
  const monthRecords = records.filter(r => isThisMonth(r.date));
  const income = monthRecords.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense = monthRecords.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  animateMoney($('monthBalance'), income - expense);
  $('monthIncome').textContent = fmt(income);
  $('monthExpense').textContent = fmt(expense);
  const todayExpense = records.filter(r => r.type === 'expense' && r.date === todayISO()).reduce((sum,r)=>sum+r.amount,0);
  if($('todayExpense')) $('todayExpense').textContent = fmt(todayExpense);
}

function renderDataSafetyStatus(){
  if(!$('dataSafetyStatus')) return;
  const snapshot = load(SAFETY_SNAPSHOT_KEY, null);
  const lastSnapshot = snapshot?.snapshotAt ? new Date(snapshot.snapshotAt).toLocaleString('zh-TW', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '尚無';
  const lastBackupAt = localStorage.getItem(LAST_BACKUP_KEY);
  const lastBackup = lastBackupAt ? new Date(lastBackupAt).toLocaleString('zh-TW', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '尚無';
  $('dataSafetyStatus').innerHTML = `目前共有 <strong>${records.length}</strong> 筆紀錄｜上次備份：${lastBackup}｜上次安全快照：${lastSnapshot}`;
  const reminder = $('backupReminder');
  if(reminder){
    const days = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : Infinity;
    reminder.textContent = !records.length ? '目前尚無資料，開始記帳後再備份即可。' : (days === Infinity ? '尚未備份，建議先匯出一次 JSON 備份。' : days >= 7 ? `已 ${days} 天未備份，建議匯出 JSON。` : `備份狀態良好，上次備份距今 ${days} 天。`);
    reminder.classList.toggle('warn', records.length && (days === Infinity || days >= 7));
  }
}

function renderCategories(){
  const list = $('categoryList');
  list.innerHTML = '';
  if(!categories[currentType]?.length){
    list.innerHTML = '<p class="empty">請先新增分類</p>';
    return;
  }
  categories[currentType].forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'category-pill' + (cat === selectedCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => { selectedCategory = cat; renderCategories(); };
    list.appendChild(btn);
  });
}

function renderRecords(){
  const list = $('recordList');
  const latest = [...records].sort((a,b)=> b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  if(!latest.length){ list.innerHTML = '<div class="empty-cat"><img src="icons/icon-192.png" alt=""><p>今天還沒記帳，小貓等你記第一筆。</p></div>'; return; }
  list.innerHTML = '';
  let currentGroup = '';
  latest.forEach(r => {
    const group = dateGroupText(r.date);
    if(group !== currentGroup){
      currentGroup = group;
      const groupEl = document.createElement('div');
      groupEl.className = 'record-group-title';
      groupEl.textContent = group;
      list.appendChild(groupEl);
    }
    const item = document.createElement('div');
    item.className = 'record-item';
    const sign = r.type === 'income' ? '+' : '-';
    item.innerHTML = `
      <div class="record-meta">
        <strong>${escapeHTML(r.category)}${r.note ? '｜' + escapeHTML(r.note) : ''}</strong>
        <span>${ymdText(r.date)} · ${r.type === 'income' ? '收入' : '支出'}</span>
      </div>
      <div class="record-side">
        <span class="record-money ${r.type}">${sign}${fmt(r.amount)}</span>
        <button class="edit-btn" data-id="${r.id}">編輯</button>
        <button class="delete-btn" data-id="${r.id}">刪除</button>
      </div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => openEditRecordModal(btn.dataset.id);
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => deleteRecord(btn.dataset.id);
  });
}


function getMonthExpense(targetMonth = monthKey()){
  return records
    .filter(r => r.type === 'expense' && r.date && r.date.slice(0,7) === targetMonth)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

function getMonthlyBudgetAmount(targetMonth = monthKey()){
  return Number((monthlyBudgets && monthlyBudgets[targetMonth]) || 0);
}

function getBudgetCareMessage(budget, expense){
  if(!budget || budget <= 0) return '尚未設定本月預算，可以到設定頁新增。';
  const percent = Math.round((expense / budget) * 100);
  if(percent < 60) return '目前花費很穩定，這個月還有餘裕。';
  if(percent < 80) return '已使用一半以上，接下來可以稍微留意。';
  if(percent < 100) return '快接近本月預算了，建議放慢一點點。';
  return '本月已超出預算，先照顧必要支出就好。';
}

function renderMonthlyBudget(){
  const targetMonth = monthKey();
  const budget = getMonthlyBudgetAmount(targetMonth);
  const expense = getMonthExpense(targetMonth);
  const left = budget - expense;
  const progress = $('budgetHomeProgress');
  const note = $('budgetHomeNote');

  if($('budgetHomeAmount')) $('budgetHomeAmount').textContent = budget > 0 ? fmt(budget) : '尚未設定';
  if($('budgetHomeExpense')) $('budgetHomeExpense').textContent = fmt(expense);
  if($('budgetHomeLeft')) $('budgetHomeLeft').textContent = budget > 0 ? fmt(left) : '尚未設定';

  if(progress){
    progress.classList.remove('over');
    if(budget > 0){
      const percent = Math.min(100, Math.round((expense / budget) * 100));
      progress.style.width = percent + '%';
      progress.classList.toggle('over', expense > budget);
    }else{
      progress.style.width = '0%';
    }
  }
  if(note) note.textContent = getBudgetCareMessage(budget, expense);

  if($('monthlyBudgetStatus')){
    $('monthlyBudgetStatus').textContent = budget > 0
      ? `${targetMonth} 預算 ${fmt(budget)}｜已支出 ${fmt(expense)}｜${left >= 0 ? '剩餘 ' + fmt(left) : '已超支 ' + fmt(Math.abs(left))}`
      : `${targetMonth} 尚未設定預算。`;
  }
}

function loadMonthlyBudgetForm(){
  const monthInput = $('budgetMonthInput');
  const amountInput = $('monthlyBudgetInput');
  if(!monthInput || !amountInput) return;
  const targetMonth = monthInput.value || monthKey();
  monthInput.value = targetMonth;
  const value = getMonthlyBudgetAmount(targetMonth);
  amountInput.value = value > 0 ? String(value) : '';
  const status = $('monthlyBudgetStatus');
  if(status){
    const expense = getMonthExpense(targetMonth);
    status.textContent = value > 0
      ? `${targetMonth} 預算 ${fmt(value)}｜已支出 ${fmt(expense)}｜剩餘 ${fmt(value - expense)}`
      : `${targetMonth} 尚未設定預算。`;
  }
}

function saveMonthlyBudgetSetting(){
  const monthInput = $('budgetMonthInput');
  const amountInput = $('monthlyBudgetInput');
  if(!monthInput || !amountInput) return;
  const targetMonth = monthInput.value || monthKey();
  const value = Number(amountInput.value || 0);
  if(value < 0){ showToast('預算不可小於 0'); return; }
  if(value > 0) monthlyBudgets[targetMonth] = value;
  else delete monthlyBudgets[targetMonth];
  save(MONTHLY_BUDGETS_KEY, monthlyBudgets);
  localStorage.setItem(BUDGET_KEY, String(getMonthlyBudgetAmount(monthKey()))); // 舊版相容
  loadMonthlyBudgetForm();
  renderMonthlyBudget();
  showToast('本月預算已更新');
}

function clearAll(){
  if(!records.length) return;
  if(confirm('確定清空所有記帳資料？系統會先保留一份安全快照。')){
    createSafetySnapshot('clear-before');
    records = []; save(STORE_KEY, records); renderAll();
  }
}
function deleteRecord(id){ createSafetySnapshot('delete-before'); records = records.filter(r => r.id !== id); save(STORE_KEY, records); renderAll(); showToast('已刪除，可用安全快照還原'); }

function openEditRecordModal(id){
  const record = records.find(r => r.id === id);
  if(!record) return;
  editingRecordId = id;
  editingType = record.type;
  $('editDateInput').value = record.date || todayISO();
  $('editAmountInput').value = record.amount || '';
  $('editNoteInput').value = record.note || '';
  switchEditType(record.type, false);
  $('editCategoryInput').value = record.category;
  $('editRecordModal').classList.add('show');
}

function closeEditRecordModal(){
  $('editRecordModal').classList.remove('show');
  editingRecordId = null;
}

function switchEditType(type, resetCategory = true){
  editingType = type;
  $('editExpenseBtn').classList.toggle('active', type === 'expense');
  $('editIncomeBtn').classList.toggle('active', type === 'income');
  const select = $('editCategoryInput');
  select.innerHTML = '';
  (categories[type] || []).forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
  if(resetCategory && categories[type]?.length) select.value = categories[type][0];
}

function saveEditedRecord(){
  const amount = Number($('editAmountInput').value);
  const date = $('editDateInput').value || todayISO();
  const category = $('editCategoryInput').value;
  const note = $('editNoteInput').value.trim();
  if(!editingRecordId) return;
  if(!amount || amount <= 0){ showToast('請輸入金額'); return; }
  if(!category){ showToast('請選擇分類'); return; }

  createSafetySnapshot('edit-before');
  records = records.map(r => r.id === editingRecordId
    ? {...r, date, type: editingType, amount, category, note, updatedAt: new Date().toISOString()}
    : r
  );
  save(STORE_KEY, records);
  closeEditRecordModal();
  renderAll();
  showToast('已更新');
}


function exportCSV(){
  const header = ['日期','類型','金額','分類','備註','建立時間'];
  const rows = records.map(r => [r.date, r.type === 'income' ? '收入' : '支出', r.amount, r.category, r.note || '', r.createdAt]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `money-diary-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  renderDataSafetyStatus();
}

function exportBackup(){
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `money-diary-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  renderDataSafetyStatus();
  showToast(`已匯出 ${records.length} 筆備份`);
}

function importBackupFile(event){
  const file = event.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = String(reader.result || '');
      let previewCount = 0;
      if(file.name.toLowerCase().endsWith('.csv')) previewCount = previewCSV(text).length;
      else previewCount = previewJSON(text).records.length;
      if(!confirm(`確認匯入 ${previewCount} 筆資料？系統會先建立安全快照。`)){ event.target.value = ''; return; }
      createSafetySnapshot('import-before');
      if(file.name.toLowerCase().endsWith('.csv')) importCSV(text); else importJSON(text);
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      event.target.value = '';
      renderAll();
      showToast(`匯入完成，共 ${previewCount} 筆`);
    }catch(err){
      console.error(err);
      event.target.value = '';
      showToast('匯入失敗，檔案格式不正確，原資料未覆蓋');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function previewJSON(text){
  const data = JSON.parse(text);
  if(!data || !Array.isArray(data.records)) throw new Error('missing records');
  const nextRecords = data.records.map(normalizeRecord).filter(Boolean);
  if(data.records.length && !nextRecords.length) throw new Error('no valid records');
  return {...data, records: nextRecords};
}
function importJSON(text){
  const data = previewJSON(text);
  categories = normalizeCategories(data.categories || categories);
  records = mergeById(records, data.records);
  categoryBudgets = data.categoryBudgets && typeof data.categoryBudgets === 'object' ? data.categoryBudgets : {};
  monthlyBudgets = data.monthlyBudgets && typeof data.monthlyBudgets === 'object' ? data.monthlyBudgets : monthlyBudgets;
  if(data.monthlyBudgets === undefined && data.monthlyBudget !== undefined){
    const legacyBudget = Number(data.monthlyBudget || 0);
    if(legacyBudget > 0) monthlyBudgets[monthKey()] = legacyBudget;
  }
  save(STORE_KEY, records);
  save(CATEGORY_KEY, categories);
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
  save(MONTHLY_BUDGETS_KEY, monthlyBudgets);
  if(data.monthlyBudget !== undefined) localStorage.setItem(BUDGET_KEY, String(data.monthlyBudget || 0));
  if(data.theme) localStorage.setItem(THEME_KEY, data.theme);
  if(data.themeColor) localStorage.setItem(THEME_COLOR_KEY, data.themeColor);
  applyTheme();
}

function previewCSV(text){
  const rows = parseCSV(text).filter(row => row.some(cell => String(cell).trim() !== ''));
  if(rows.length < 2) throw new Error('empty csv');
  const header = rows[0].map(h => String(h).trim().replace(/^\uFEFF/, ''));
  const required = ['日期','類型','金額','分類'];
  if(required.some(name => !header.includes(name))) throw new Error('missing csv columns');
  const idx = (name) => header.indexOf(name);
  const next = rows.slice(1).map(row => normalizeRecord({
    date: row[idx('日期')],
    type: row[idx('類型')] === '收入' ? 'income' : row[idx('類型')] === '支出' ? 'expense' : row[idx('類型')],
    amount: row[idx('金額')],
    category: row[idx('分類')],
    note: idx('備註') >= 0 ? row[idx('備註')] : '',
    createdAt: idx('建立時間') >= 0 ? row[idx('建立時間')] : ''
  })).filter(Boolean);
  if(rows.length > 1 && !next.length) throw new Error('no valid csv rows');
  return next;
}
function importCSV(text){
  const next = previewCSV(text);
  records = mergeById(records, next);
  save(STORE_KEY, records);
  save(CATEGORY_KEY, categories);
}

function mergeById(existing, imported){
  const map = new Map();
  [...existing, ...imported].forEach(item => {
    if(item?.id) map.set(item.id, item);
  });
  return [...map.values()].sort((a,b)=> b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function restoreSafetySnapshot(){
  const snapshot = load(SAFETY_SNAPSHOT_KEY, null);
  if(!snapshot || !Array.isArray(snapshot.records)){ showToast('目前沒有可還原的安全快照'); return; }
  if(!confirm('確定還原到上次匯入 / 編輯 / 刪除前的資料？')) return;
  records = snapshot.records.map(normalizeRecord).filter(Boolean);
  categories = normalizeCategories(snapshot.categories || categories);
  categoryBudgets = snapshot.categoryBudgets && typeof snapshot.categoryBudgets === 'object' ? snapshot.categoryBudgets : {};
  monthlyBudgets = snapshot.monthlyBudgets && typeof snapshot.monthlyBudgets === 'object' ? snapshot.monthlyBudgets : monthlyBudgets;
  save(STORE_KEY, records);
  save(CATEGORY_KEY, categories);
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
  save(MONTHLY_BUDGETS_KEY, monthlyBudgets);
  if(snapshot.monthlyBudget !== undefined) localStorage.setItem(BUDGET_KEY, String(snapshot.monthlyBudget || 0));
  renderAll();
  showToast('已還原安全快照');
}

function normalizeRecord(r){
  if(!r) return null;
  const amount = Number(r.amount || 0);
  const type = r.type === 'income' || r.type === '收入' ? 'income' : 'expense';
  const category = String(r.category || (categories[type]?.[0] || '未分類')).trim();
  if(!amount || amount <= 0) return null;
  if(!categories[type]) categories[type] = [];
  if(category && !categories[type].includes(category)) categories[type].push(category);
  return {
    id: r.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())),
    date: r.date || todayISO(),
    type,
    amount,
    category,
    note: r.note || '',
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || ''
  };
}

function normalizeCategories(input){
  const next = {expense:[...defaultCategories.expense], income:[...defaultCategories.income]};
  if(input && Array.isArray(input.expense) && input.expense.length) next.expense = input.expense.map(String);
  if(input && Array.isArray(input.income) && input.income.length) next.income = input.income.map(String);
  return next;
}

function parseCSV(text){
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const char = text[i], next = text[i+1];
    if(char === '"' && inQuotes && next === '"'){ cell += '"'; i++; continue; }
    if(char === '"'){ inQuotes = !inQuotes; continue; }
    if(char === ',' && !inQuotes){ row.push(cell); cell = ''; continue; }
    if((char === '\n' || char === '\r') && !inQuotes){
      if(char === '\r' && next === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}


const themeColorNames = {
  berry: '奶油莓果',
  'milk-tea': '奶茶杏色',
  business: '商務灰綠',
  silver: 'iOS 白銀',
  cocoa: '夜間可可'
};
const validThemeColors = Object.keys(themeColorNames);

function getThemeMode(){
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}
function getThemeColor(){
  const saved = localStorage.getItem(THEME_COLOR_KEY) || 'berry';
  return validThemeColors.includes(saved) ? saved : 'berry';
}
function toggleTheme(){
  const next = getThemeMode() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
}
function applyTheme(){
  const mode = getThemeMode();
  const color = getThemeColor();
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.themeColor = color;
  document.body.classList.toggle('dark', mode === 'dark');
  document.body.dataset.theme = mode;
  document.body.dataset.themeColor = color;
  const themeToggle = $('themeToggle');
  if(themeToggle){
    themeToggle.textContent = mode === 'dark' ? '☀' : '☾';
    themeToggle.setAttribute('aria-label', mode === 'dark' ? '切換淺色模式' : '切換深色模式');
  }
  updateThemeColorUI(color);
}
function bindThemeColorCards(){
  document.querySelectorAll('[data-theme-color].theme-card').forEach(card => {
    card.onclick = () => setThemeColor(card.dataset.themeColor);
  });
}
function setThemeColor(color){
  if(!validThemeColors.includes(color)) color = 'berry';
  localStorage.setItem(THEME_COLOR_KEY, color);
  applyTheme();
  showToast(`已套用${themeColorNames[color]}`);
}
function updateThemeColorUI(color){
  document.querySelectorAll('[data-theme-color].theme-card').forEach(card => {
    const active = card.dataset.themeColor === color;
    card.classList.toggle('is-active', active);
    card.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const label = $('currentThemeColorLabel');
  if(label) label.textContent = themeColorNames[color] || themeColorNames.berry;
}
function escapeHTML(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(s){ return escapeHTML(s).replace(/'/g,'&#039;'); }

document.addEventListener('DOMContentLoaded', init);

/* V4.2：查詢 / 篩選 */
function bindSearchEvents(){
  const ids = ['searchKeyword','searchStartDate','searchEndDate','searchType','searchCategory','searchSort'];
  ids.forEach(id => {
    const el = $(id);
    if(!el) return;
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, renderSearchResults);
  });
  if($('resetSearchBtn')) $('resetSearchBtn').onclick = resetSearchFilters;
}

function renderSearchOptions(){
  const select = $('searchCategory');
  if(!select) return;
  const current = select.value || 'all';
  const allCategories = [...new Set([...(categories.expense || []), ...(categories.income || []), ...records.map(r => r.category).filter(Boolean)])];
  select.innerHTML = '<option value="all">全部分類</option>' + allCategories.map(cat => `<option value="${escapeAttr(cat)}">${escapeHTML(cat)}</option>`).join('');
  select.value = allCategories.includes(current) ? current : 'all';
}

function getFilteredRecords(){
  const keyword = ($('searchKeyword')?.value || '').trim().toLowerCase();
  const start = $('searchStartDate')?.value || '';
  const end = $('searchEndDate')?.value || '';
  const type = $('searchType')?.value || 'all';
  const category = $('searchCategory')?.value || 'all';
  const sort = $('searchSort')?.value || 'dateDesc';
  const result = [...records]
    .filter(r => !keyword || `${r.category || ''} ${r.note || ''}`.toLowerCase().includes(keyword))
    .filter(r => !start || r.date >= start)
    .filter(r => !end || r.date <= end)
    .filter(r => type === 'all' || r.type === type)
    .filter(r => category === 'all' || r.category === category);
  const sorters = {
    dateDesc: (a,b)=> b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    dateAsc: (a,b)=> a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
    amountDesc: (a,b)=> Number(b.amount||0) - Number(a.amount||0),
    amountAsc: (a,b)=> Number(a.amount||0) - Number(b.amount||0)
  };
  return result.sort(sorters[sort] || sorters.dateDesc);
}

function renderSearchResults(){
  const list = $('searchResultList');
  if(!list) return;
  const result = getFilteredRecords();
  const income = result.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense = result.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  if($('searchSummary')) $('searchSummary').textContent = `共 ${result.length} 筆｜收入 ${fmt(income)}｜支出 ${fmt(expense)}｜結餘 ${fmt(income - expense)}`;
  if(!result.length){ list.innerHTML = '<p class="empty">找不到符合條件的紀錄。</p>'; return; }
  list.innerHTML = '';
  let currentGroup = '';
  result.slice(0,120).forEach(r => {
    const group = dateGroupText(r.date);
    if(group !== currentGroup){
      currentGroup = group;
      const groupEl = document.createElement('div');
      groupEl.className = 'record-group-title';
      groupEl.textContent = group;
      list.appendChild(groupEl);
    }
    const item = document.createElement('div');
    item.className = 'record-item';
    const sign = r.type === 'income' ? '+' : '-';
    item.innerHTML = `
      <div class="record-meta">
        <strong>${escapeHTML(r.category)}${r.note ? '｜' + escapeHTML(r.note) : ''}</strong>
        <span>${ymdText(r.date)} · ${r.type === 'income' ? '收入' : '支出'}</span>
      </div>
      <div class="record-side">
        <span class="record-money ${r.type}">${sign}${fmt(r.amount)}</span>
        <button class="edit-btn" data-id="${r.id}">編輯</button>
        <button class="delete-btn" data-id="${r.id}">刪除</button>
      </div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.edit-btn').forEach(btn => btn.onclick = () => openEditRecordModal(btn.dataset.id));
  list.querySelectorAll('.delete-btn').forEach(btn => btn.onclick = () => deleteRecord(btn.dataset.id));
}

function resetSearchFilters(){
  if($('searchKeyword')) $('searchKeyword').value = '';
  if($('searchStartDate')) $('searchStartDate').value = '';
  if($('searchEndDate')) $('searchEndDate').value = '';
  if($('searchType')) $('searchType').value = 'all';
  if($('searchCategory')) $('searchCategory').value = 'all';
  if($('searchSort')) $('searchSort').value = 'dateDesc';
  renderSearchResults();
}
