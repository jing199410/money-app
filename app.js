const STORE_KEY = 'moneyDiary.records.v3';
const CATEGORY_KEY = 'moneyDiary.categories.v3';
const BUDGET_KEY = 'moneyDiary.budget.v3';
const THEME_KEY = 'moneyDiary.theme.v3';

const defaultCategories = {
  expense: ['餐飲', '交通', '生活', '娛樂', '購物', '醫療'],
  income: ['薪資', '獎金', '副業', '退款', '其他收入']
};

let records = load(STORE_KEY, []);
let categories = load(CATEGORY_KEY, defaultCategories);
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
function weekdayText(iso){
  const d = parseLocalDate(iso);
  return `${d.getMonth()+1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`;
}
function ymdText(iso){
  const d = parseLocalDate(iso);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function init(){
  $('recordDate').value = todayISO();
  const now = new Date();
  $('monthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  $('statsMonthLabel').textContent = `${now.getFullYear()}年${now.getMonth()+1}月`;
  $('recordDate').addEventListener('change', () => {});
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
  showToast('已記錄');
  renderAll();
}

function showToast(text){
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1400);
}

function renderAll(){ renderSummary(); renderCategories(); renderRecords(); renderBudget(); renderChart(); renderManageList(); }

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
  const latest = [...records].sort((a,b)=> b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0,18);
  if(!latest.length){ list.innerHTML = '<p class="empty">還沒有紀錄，先記第一筆。</p>'; return; }
  list.innerHTML = '';
  latest.forEach(r => {
    const item = document.createElement('div');
    item.className = 'record-item';
    const sign = r.type === 'income' ? '+' : '-';
    item.innerHTML = `
      <div class="record-meta">
        <strong>${escapeHTML(r.category)}${r.note ? '｜' + escapeHTML(r.note) : ''}</strong>
        <span>${ymdText(r.date)} · ${r.type === 'income' ? '收入' : '支出'}</span>
      </div>
      <div>
        <span class="record-money ${r.type}">${sign}${fmt(r.amount)}</span>
        <button class="delete-btn" data-id="${r.id}">刪除</button>
      </div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = () => deleteRecord(btn.dataset.id);
  });
}

function renderBudget(){
  const budget = Number(localStorage.getItem(BUDGET_KEY) || 0);
  const expense = records.filter(r => r.type === 'expense' && isThisMonth(r.date)).reduce((s,r)=>s+r.amount,0);
  $('budgetAmountText').textContent = budget ? fmt(budget) : '尚未設定';
  if(!budget){ $('budgetProgress').style.width = '0%'; $('budgetNote').textContent = '設定預算後，這裡會顯示本月使用進度。'; return; }
  const percent = Math.min(100, Math.round((expense / budget) * 100));
  $('budgetProgress').style.width = percent + '%';
  const left = budget - expense;
  $('budgetNote').textContent = left >= 0 ? `已使用 ${percent}% ，剩餘 ${fmt(left)}` : `已超支 ${fmt(Math.abs(left))}`;
}

function renderChart(){
  const box = $('chartList');
  const data = {};
  records.filter(r=>r.type==='expense' && isThisMonth(r.date)).forEach(r => data[r.category] = (data[r.category] || 0) + r.amount);
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
  if(currentType === manageType && selectedCategory === cat) selectedCategory = categories[manageType][0];
  save(CATEGORY_KEY, categories);
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
