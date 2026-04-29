const STORAGE_KEY = 'ina_money_records_v1';
const CATEGORY_KEY = 'ina_money_categories_v1';
const THEME_KEY = 'ina_money_theme_v1';
let state = { type: 'expense', category: '', records: [], categories: [] };
const defaultCategories = [
  { id:'food', name:'餐飲', type:'expense' }, { id:'traffic', name:'交通', type:'expense' }, { id:'daily', name:'日用品', type:'expense' },
  { id:'fun', name:'娛樂', type:'expense' }, { id:'medical', name:'醫療', type:'expense' }, { id:'salary', name:'薪資', type:'income' },
  { id:'bonus', name:'獎金', type:'income' }, { id:'other-income', name:'其他收入', type:'income' }
];
const $ = (id)=>document.getElementById(id);
function formatMoney(n){ return `NT$ ${Number(n||0).toLocaleString('zh-TW')}`; }
function todayISO(){ return new Date().toISOString(); }
function load(){
  state.records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  state.categories = JSON.parse(localStorage.getItem(CATEGORY_KEY) || 'null') || defaultCategories;
  document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) || 'light';
  state.category = getVisibleCategories()[0]?.name || '';
}
function saveRecords(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records)); }
function saveCategories(){ localStorage.setItem(CATEGORY_KEY, JSON.stringify(state.categories)); }
function getVisibleCategories(){ return state.categories.filter(c=>c.type===state.type); }
function render(){ renderDate(); renderCategories(); renderRecords(); renderSummary(); renderAllCategories(); }
function renderDate(){
  const now = new Date();
  $('todayText').textContent = now.toLocaleDateString('zh-TW', {month:'numeric',day:'numeric',weekday:'short'});
  $('monthName').textContent = now.toLocaleDateString('zh-TW', {year:'numeric',month:'long'});
}
function renderCategories(){
  const list = $('categoryList'); list.innerHTML = '';
  const cats = getVisibleCategories();
  if(!cats.some(c=>c.name===state.category)) state.category = cats[0]?.name || '';
  cats.forEach(cat=>{
    const btn = document.createElement('button'); btn.className = 'cat-chip' + (cat.name===state.category?' active':'');
    btn.textContent = cat.name; btn.onclick = ()=>{ state.category = cat.name; renderCategories(); };
    list.appendChild(btn);
  });
}
function renderRecords(){
  const box = $('recordList'); box.innerHTML='';
  const recent = [...state.records].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20);
  if(!recent.length){ box.innerHTML = '<div class="empty">還沒有紀錄，先記下第一筆吧。</div>'; return; }
  recent.forEach(r=>{
    const item = document.createElement('div'); item.className='record-item';
    item.innerHTML = `<div class="record-main"><div class="record-title">${escapeHtml(r.category)}</div><div class="record-note">${new Date(r.createdAt).toLocaleDateString('zh-TW')}・${escapeHtml(r.note || '無備註')}</div></div><div class="record-amount ${r.type}">${r.type==='income'?'+':'-'}${formatMoney(r.amount)}</div>`;
    item.ondblclick = ()=>deleteRecord(r.id);
    box.appendChild(item);
  });
}
function renderSummary(){
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const month = state.records.filter(r=>r.createdAt.slice(0,7)===ym);
  const income = month.filter(r=>r.type==='income').reduce((s,r)=>s+Number(r.amount),0);
  const expense = month.filter(r=>r.type==='expense').reduce((s,r)=>s+Number(r.amount),0);
  $('monthIncome').textContent = formatMoney(income); $('monthExpense').textContent = formatMoney(expense); $('monthBalance').textContent = formatMoney(income-expense);
}
function renderAllCategories(){
  const box = $('allCategories'); if(!box) return; box.innerHTML='';
  state.categories.forEach(cat=>{
    const btn = document.createElement('button'); btn.textContent = `${cat.type==='income'?'收入':'支出'}｜${cat.name}`;
    btn.oncontextmenu = (e)=>{ e.preventDefault(); removeCategory(cat.id); };
    let timer; btn.addEventListener('touchstart',()=> timer=setTimeout(()=>removeCategory(cat.id),650));
    btn.addEventListener('touchend',()=>clearTimeout(timer));
    box.appendChild(btn);
  });
}
function setType(type){ state.type=type; document.querySelectorAll('.segmented button').forEach(b=>b.classList.toggle('active', b.dataset.type===type)); renderCategories(); }
function addRecord(){
  const amount = Number($('amountInput').value.replace(/,/g,''));
  if(!amount || amount <= 0){ toast('請輸入正確金額'); return; }
  if(!state.category){ toast('請先選擇分類'); return; }
  state.records.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type:state.type, amount, category:state.category, note:$('noteInput').value.trim(), createdAt:todayISO() });
  saveRecords(); $('amountInput').value=''; $('noteInput').value=''; render(); toast('已儲存');
}
function deleteRecord(id){ if(confirm('要刪除這筆紀錄嗎？')){ state.records = state.records.filter(r=>r.id!==id); saveRecords(); render(); } }
function addCategory(){
  const name = $('newCategoryName').value.trim(); const type = $('newCategoryType').value;
  if(!name){ toast('請輸入分類名稱'); return; }
  if(state.categories.some(c=>c.name===name && c.type===type)){ toast('分類已存在'); return; }
  state.categories.push({ id:String(Date.now()), name, type }); saveCategories(); $('newCategoryName').value=''; render(); toast('分類已新增');
}
function removeCategory(id){
  const cat = state.categories.find(c=>c.id===id); if(!cat) return;
  if(confirm(`刪除分類「${cat.name}」？既有紀錄不會刪除。`)){ state.categories = state.categories.filter(c=>c.id!==id); saveCategories(); render(); }
}
function exportCSV(){
  const header = ['建立時間','類型','金額','分類','備註'];
  const rows = state.records.map(r=>[r.createdAt, r.type==='income'?'收入':'支出', r.amount, r.category, r.note || '']);
  const csv = [header,...rows].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='輕帳紀錄.csv'; a.click(); URL.revokeObjectURL(url);
}
function toast(text){ const d=$('toastDialog'); $('toastText').textContent=text; d.showModal(); setTimeout(()=>d.close(),1200); }
function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function bind(){
  document.querySelectorAll('.segmented button').forEach(b=>b.onclick=()=>setType(b.dataset.type));
  $('saveBtn').onclick=addRecord; $('addCategoryBtn').onclick=addCategory; $('manageCategoryBtn').onclick=()=>$('categoryDialog').showModal(); $('exportBtn').onclick=exportCSV;
  $('themeBtn').onclick=()=>{ const next = document.documentElement.dataset.theme==='dark'?'light':'dark'; document.documentElement.dataset.theme=next; localStorage.setItem(THEME_KEY,next); };
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); toast(b.dataset.view==='home'?'目前在首頁':'這個頁籤下一版補上完整內容'); });
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
load(); bind(); render();
