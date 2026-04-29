const STORE_KEY = 'moneyDiary.records.v3';
const CATEGORY_KEY = 'moneyDiary.categories.v3';
const BUDGET_KEY = 'moneyDiary.budget.v3';
const CATEGORY_BUDGET_KEY = 'moneyDiary.categoryBudgets.v35';
const THEME_KEY = 'moneyDiary.theme.v3';

const defaultCategories = {
  expense: ['餐飲', '交通', '生活', '娛樂', '購物', '醫療'],
  income: ['薪資', '獎金', '副業', '退款', '其他收入']
};

let records = load(STORE_KEY, []);
let categories = load(CATEGORY_KEY, defaultCategories);
let categoryBudgets = load(CATEGORY_BUDGET_KEY, {});
let currentType = 'expense';
let selectedCategory = categories.expense[0];
let manageType = 'expense';

const $ = (id) => document.getElementById(id);
const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
const todayISO = () => new Date().toISOString().slice(0,10);

function load(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
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
  $('editBudgetBtn').onclick = openBudgetModal;
  $('cancelBudgetBtn').onclick = closeBudgetModal;
  $('saveBudgetBtn').onclick = saveBudget;
  $('budgetModal').onclick = (e) => { if(e.target.id === 'budgetModal') closeBudgetModal(); };
  $('editCategoryBudgetBtn').onclick = openCategoryBudgetModal;
  $('cancelCategoryBudgetBtn').onclick = closeCategoryBudgetModal;
  $('saveCategoryBudgetBtn').onclick = saveCategoryBudgets;
  $('categoryBudgetModal').onclick = (e) => { if(e.target.id === 'categoryBudgetModal') closeCategoryBudgetModal(); };

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
}

function renderSummary(){
  const monthRecords = records.filter(r => isThisMonth(r.date));
  const income = monthRecords.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense = monthRecords.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  $('monthBalance').textContent = fmt(income - expense);
  $('monthIncome').textContent = fmt(income);
  $('monthExpense').textContent = fmt(expense);
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
        <button class="delete-btn" data-id="${r.id}">刪除</button>
      </div>`;
    list.appendChild(item);
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

  if(!budget){
    $('budgetProgress').style.width = '0%';
    $('budgetNote').textContent = '設定分類預算後，本月總預算會自動加總。';
    return;
  }

  const percent = Math.min(100, Math.round((expense / budget) * 100));
  $('budgetProgress').style.width = percent + '%';
  const left = budget - expense;
  const sourceText = categoryTotal > 0 ? `分類預算自動加總 ${fmt(categoryTotal)}` : `手動預算 ${fmt(manualBudget)}`;
  $('budgetNote').textContent = left >= 0
    ? `${sourceText}｜已使用 ${percent}% ，剩餘 ${fmt(left)}`
    : `${sourceText}｜已超支 ${fmt(Math.abs(left))}`;
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
        <span>${budget ? `${fmt(used)} / ${fmt(budget)}` : `${fmt(used)} / 未設定`}</span>
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
  if(confirm('確定清空所有記帳資料？這個動作無法復原。')){
    records = []; save(STORE_KEY, records); renderAll();
  }
}
function deleteRecord(id){ records = records.filter(r => r.id !== id); save(STORE_KEY, records); renderAll(); }
function exportCSV(){
  const header = ['日期','類型','金額','分類','備註','建立時間'];
  const rows = records.map(r => [r.date, r.type === 'income' ? '收入' : '支出', r.amount, r.category, r.note || '', r.createdAt]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `money-diary-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
}
function toggleTheme(){ document.body.classList.toggle('dark'); localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light'); }
function applyTheme(){ if(localStorage.getItem(THEME_KEY)==='dark') document.body.classList.add('dark'); }
function escapeHTML(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(s){ return escapeHTML(s).replace(/'/g,'&#039;'); }

document.addEventListener('DOMContentLoaded', init);
