const STORE_KEY = 'moneyDiary.records.v3';
const CATEGORY_KEY = 'moneyDiary.categories.v3';
const BUDGET_KEY = 'moneyDiary.budget.v3';
const CATEGORY_BUDGET_KEY = 'moneyDiary.categoryBudgets.v35';
const THEME_KEY = 'moneyDiary.theme.v3';
const SAFETY_SNAPSHOT_KEY = 'moneyDiary.safetySnapshot.v41';

const defaultCategories = {
  expense: ['餐飲', '交通', '生活', '娛樂', '購物', '醫療'],
  income: ['薪資', '獎金', '副業', '退款', '其他收入']
};

migrateLegacyData();
let records = load(STORE_KEY, []);
let categories = load(CATEGORY_KEY, defaultCategories);
let categoryBudgets = load(CATEGORY_BUDGET_KEY, {});
let currentType = 'expense';
let selectedCategory = categories.expense[0];
let manageType = 'expense';
let editingRecordId = null;
let editingType = 'expense';

const $ = (id) => document.getElementById(id);
const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
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
    version: '4.1',
    exportedAt: new Date().toISOString(),
    recordCount: records.length,
    records,
    categories,
    categoryBudgets,
    monthlyBudget: localStorage.getItem(BUDGET_KEY) || '0',
    theme: localStorage.getItem(THEME_KEY) || 'light'
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

function init(){
  $('recordDate').value = todayISO();
  const now = new Date();
  $('monthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  $('statsMonthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
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
  $('editBudgetBtn').onclick = openBudgetModal;
  $('cancelBudgetBtn').onclick = closeBudgetModal;
  $('saveBudgetBtn').onclick = saveBudget;
  $('budgetModal').onclick = (e) => { if(e.target.id === 'budgetModal') closeBudgetModal(); };
  $('editCategoryBudgetBtn').onclick = openCategoryBudgetModal;
  $('cancelCategoryBudgetBtn').onclick = closeCategoryBudgetModal;
  $('saveCategoryBudgetBtn').onclick = saveCategoryBudgets;
  $('categoryBudgetModal').onclick = (e) => { if(e.target.id === 'categoryBudgetModal') closeCategoryBudgetModal(); };
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
  renderBudget();
  renderCategoryBudgets();
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
  $('monthBalance').textContent = fmt(income - expense);
  $('monthIncome').textContent = fmt(income);
  $('monthExpense').textContent = fmt(expense);
  const todayExpense = records.filter(r => r.type === 'expense' && r.date === todayISO()).reduce((sum,r)=>sum+r.amount,0);
  if($('todayExpense')) $('todayExpense').textContent = fmt(todayExpense);
}

function renderDataSafetyStatus(){
  if(!$('dataSafetyStatus')) return;
  const snapshot = load(SAFETY_SNAPSHOT_KEY, null);
  const last = snapshot?.snapshotAt ? new Date(snapshot.snapshotAt).toLocaleString('zh-TW', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '尚無';
  $('dataSafetyStatus').innerHTML = `目前共有 <strong>${records.length}</strong> 筆紀錄｜上次安全快照：${last}`;
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
  if(!latest.length){ list.innerHTML = '<p class="empty">還沒有紀錄，先記第一筆。</p>'; return; }
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

function getCategoryBudgetTotal(){
  return Object.values(categoryBudgets || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function getMonthlyBudget(){
  // 分類預算有設定時，總預算自動等於所有分類預算加總；沒有分類預算時才使用手動本月預算。
  const categoryTotal = getCategoryBudgetTotal();
  if(categoryTotal > 0) return categoryTotal;
  return Number(localStorage.getItem(BUDGET_KEY) || 0);
}

function renderBudget(){
  const categoryTotal = getCategoryBudgetTotal();
  const manualBudget = Number(localStorage.getItem(BUDGET_KEY) || 0);
  const budget = getMonthlyBudget();
  const expense = records.filter(r => r.type === 'expense' && isThisMonth(r.date)).reduce((s,r)=>s+r.amount,0);

  $('budgetAmountText').textContent = budget ? fmt(budget) : '尚未設定';

  $('budgetProgress').classList.remove('over');
  if(!budget){
    $('budgetProgress').style.width = '0%';
    $('budgetNote').textContent = '設定分類預算後，本月總預算會自動加總。';
    return;
  }

  const rawPercent = Math.round((expense / budget) * 100);
  const percent = Math.min(100, rawPercent);
  $('budgetProgress').style.width = percent + '%';
  const left = budget - expense;
  if(left < 0) $('budgetProgress').classList.add('over');
  const sourceText = categoryTotal > 0 ? `分類預算自動加總 ${fmt(categoryTotal)}` : `手動預算 ${fmt(manualBudget)}`;
  $('budgetNote').textContent = left >= 0
    ? `${sourceText}｜已使用 ${rawPercent}% ，剩餘 ${fmt(left)}`
    : `${sourceText}｜已使用 ${rawPercent}% ，已超支 ${fmt(Math.abs(left))}`;
}

function getMonthlyCategoryExpense(){
  const data = {};
  records.filter(r=>r.type==='expense' && isThisMonth(r.date)).forEach(r => {
    data[r.category] = (data[r.category] || 0) + r.amount;
  });
  return data;
}

function renderCategoryBudgets(){
  const box = $('categoryBudgetList');
  if(!box) return;
  const expenses = getMonthlyCategoryExpense();
  const expenseCategories = categories.expense || [];
  const rows = expenseCategories
    .filter(cat => Number(categoryBudgets[cat] || 0) > 0 || Number(expenses[cat] || 0) > 0)
    .map(cat => ({ cat, budget: Number(categoryBudgets[cat] || 0), used: Number(expenses[cat] || 0) }));
  if(!rows.length){
    box.innerHTML = '<p class="empty">尚未設定分類預算。可先設定餐飲、交通等個別預算。</p>';
    return;
  }
  box.innerHTML = '';
  rows.forEach(({cat, budget, used}) => {
    const percent = budget ? Math.min(100, Math.round(used / budget * 100)) : 0;
    const left = budget - used;
    const row = document.createElement('div');
    row.className = 'category-budget-row' + (budget && used > budget ? ' over' : '');
    row.innerHTML = `
      <div class="category-budget-top">
        <strong>${escapeHTML(cat)}</strong>
        <span>${budget ? `已用 ${fmt(used)} / 預算 ${fmt(budget)}` : `已用 ${fmt(used)} / 預算未設定`}</span>
      </div>
      <div class="mini-progress"><div style="width:${budget ? percent : 0}%"></div></div>
      <p>${budget ? (left >= 0 ? `剩餘 ${fmt(left)}` : `已超支 ${fmt(Math.abs(left))}`) : '尚未設定此分類預算'}</p>`;
    box.appendChild(row);
  });
}

function renderChart(){
  const box = $('chartList');
  const data = getMonthlyCategoryExpense();
  const rows = Object.entries(data).sort((a,b)=>b[1]-a[1]);
  if(!rows.length){ box.innerHTML = '<p class="empty">本月還沒有支出資料。</p>'; return; }
  const max = rows[0][1];
  box.innerHTML = '';
  rows.forEach(([cat, amount]) => {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.innerHTML = `<strong>${escapeHTML(cat)}</strong><div class="bar-track"><div class="bar" style="width:${Math.max(8, amount/max*100)}%"></div></div><span>${fmt(amount)}</span>`;
    box.appendChild(row);
  });
}

function openCategoryPanel(){ $('sheetMask').classList.add('show'); $('categoryPanel').classList.add('show'); $('categoryPanel').setAttribute('aria-hidden','false'); renderManageList(); }
function closeCategoryPanel(){ $('sheetMask').classList.remove('show'); $('categoryPanel').classList.remove('show'); $('categoryPanel').setAttribute('aria-hidden','true'); }
function switchManageType(type){
  manageType = type;
  $('manageExpenseBtn').classList.toggle('active', type === 'expense');
  $('manageIncomeBtn').classList.toggle('active', type === 'income');
  renderManageList();
}
function addCategory(){
  const name = $('newCategoryInput').value.trim();
  if(!name) return;
  if(categories[manageType].includes(name)){ showToast('分類已存在'); return; }
  categories[manageType].push(name);
  save(CATEGORY_KEY, categories);
  $('newCategoryInput').value = '';
  if(currentType === manageType && !selectedCategory) selectedCategory = name;
  renderAll();
}
function renderManageList(){
  const list = $('manageCategoryList');
  if(!list) return;
  list.innerHTML = '';
  categories[manageType].forEach(cat => {
    const item = document.createElement('div');
    item.className = 'manage-item';
    item.innerHTML = `<span>${escapeHTML(cat)}</span><button data-cat="${escapeAttr(cat)}">刪除</button>`;
    list.appendChild(item);
  });
  list.querySelectorAll('button').forEach(btn => btn.onclick = () => removeCategory(btn.dataset.cat));
}
function removeCategory(cat){
  if(categories[manageType].length <= 1){ showToast('至少保留一個分類'); return; }
  categories[manageType] = categories[manageType].filter(c => c !== cat);
  if(manageType === 'expense') delete categoryBudgets[cat];
  if(currentType === manageType && selectedCategory === cat) selectedCategory = categories[manageType][0];
  save(CATEGORY_KEY, categories);
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
  renderAll();
}

function openBudgetModal(){ $('budgetInput').value = localStorage.getItem(BUDGET_KEY) || ''; $('budgetModal').classList.add('show'); }
function closeBudgetModal(){ $('budgetModal').classList.remove('show'); }
function saveBudget(){
  const value = Number($('budgetInput').value || 0);
  if(value < 0){ showToast('預算不可小於 0'); return; }
  localStorage.setItem(BUDGET_KEY, String(value));
  closeBudgetModal();
  renderBudget();
  showToast('已儲存預算');
}

function openCategoryBudgetModal(){
  const editor = $('categoryBudgetEditor');
  editor.innerHTML = '';
  (categories.expense || []).forEach(cat => {
    const row = document.createElement('label');
    row.className = 'category-budget-input-row';
    row.innerHTML = `<span>${escapeHTML(cat)}</span><input type="number" inputmode="decimal" min="0" data-cat="${escapeAttr(cat)}" value="${Number(categoryBudgets[cat] || 0) || ''}" placeholder="0" />`;
    editor.appendChild(row);
  });
  $('categoryBudgetModal').classList.add('show');
}
function closeCategoryBudgetModal(){ $('categoryBudgetModal').classList.remove('show'); }
function saveCategoryBudgets(){
  const next = {};
  document.querySelectorAll('#categoryBudgetEditor input').forEach(input => {
    const value = Number(input.value || 0);
    if(value > 0) next[input.dataset.cat] = value;
  });
  categoryBudgets = next;
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
  localStorage.setItem(BUDGET_KEY, String(getCategoryBudgetTotal()));
  closeCategoryBudgetModal();
  renderAll();
  showToast('已更新總預算');
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
  showToast(`已匯出 ${records.length} 筆備份`);
}

function importBackupFile(event){
  const file = event.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const text = String(reader.result || '');
      createSafetySnapshot('import-before');
      if(file.name.toLowerCase().endsWith('.csv')){
        importCSV(text);
      }else{
        importJSON(text);
      }
      event.target.value = '';
      renderAll();
      showToast('匯入完成');
    }catch(err){
      console.error(err);
      showToast('匯入失敗，檔案格式不正確');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function importJSON(text){
  const data = JSON.parse(text);
  if(!Array.isArray(data.records)) throw new Error('missing records');
  categories = normalizeCategories(data.categories || categories);
  const importedRecords = data.records.map(normalizeRecord).filter(Boolean);
  records = mergeById(records, importedRecords);
  categoryBudgets = data.categoryBudgets && typeof data.categoryBudgets === 'object' ? data.categoryBudgets : {};
  save(STORE_KEY, records);
  save(CATEGORY_KEY, categories);
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
  if(data.monthlyBudget !== undefined) localStorage.setItem(BUDGET_KEY, String(data.monthlyBudget || 0));
  if(data.theme) localStorage.setItem(THEME_KEY, data.theme);
  applyTheme();
}

function importCSV(text){
  const rows = parseCSV(text).filter(row => row.some(cell => String(cell).trim() !== ''));
  if(rows.length < 2) throw new Error('empty csv');
  const header = rows[0].map(h => String(h).trim());
  const idx = (name) => header.indexOf(name);
  const next = rows.slice(1).map(row => normalizeRecord({
    date: row[idx('日期')],
    type: row[idx('類型')] === '收入' ? 'income' : row[idx('類型')] === '支出' ? 'expense' : row[idx('類型')],
    amount: row[idx('金額')],
    category: row[idx('分類')],
    note: row[idx('備註')],
    createdAt: row[idx('建立時間')]
  })).filter(Boolean);
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
  save(STORE_KEY, records);
  save(CATEGORY_KEY, categories);
  save(CATEGORY_BUDGET_KEY, categoryBudgets);
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


function toggleTheme(){ document.body.classList.toggle('dark'); localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light'); }
function applyTheme(){
  document.body.classList.toggle('dark', localStorage.getItem(THEME_KEY)==='dark');
}
function escapeHTML(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(s){ return escapeHTML(s).replace(/'/g,'&#039;'); }

document.addEventListener('DOMContentLoaded', init);

/* V4.2：查詢 / 篩選 */
function bindSearchEvents(){
  const ids = ['searchKeyword','searchStartDate','searchEndDate','searchType','searchCategory'];
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
  return [...records]
    .filter(r => !keyword || `${r.category || ''} ${r.note || ''}`.toLowerCase().includes(keyword))
    .filter(r => !start || r.date >= start)
    .filter(r => !end || r.date <= end)
    .filter(r => type === 'all' || r.type === type)
    .filter(r => category === 'all' || r.category === category)
    .sort((a,b)=> b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
  renderSearchResults();
}
