const STORAGE_KEY = 'moneyDiaryRecordsV2';
const THEME_KEY = 'moneyDiaryThemeV2';
const expenseCategories = ['餐飲','交通','日用品','娛樂','醫療','其他'];
const incomeCategories = ['薪資','獎金','轉帳','退款','其他'];
let currentType = 'expense';
let currentCategory = expenseCategories[0];
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

const $ = (id) => document.getElementById(id);
const fmt = (n) => `NT$ ${Number(n || 0).toLocaleString('zh-TW')}`;
const today = new Date();

function init(){
  $('monthLabel').textContent = `${today.getFullYear()}年${today.getMonth()+1}月`;
  $('todayLabel').textContent = `${today.getMonth()+1}/${today.getDate()}（${'日一二三四五六'[today.getDay()]}）`;
  if(localStorage.getItem(THEME_KEY)==='dark') document.body.classList.add('dark');
  renderCategories(); renderAll(); bindEvents(); registerSW();
}
function save(){localStorage.setItem(STORAGE_KEY, JSON.stringify(records));}
function bindEvents(){
  document.querySelectorAll('.segmented button').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.segmented button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); currentType = btn.dataset.type; currentCategory = (currentType==='expense'?expenseCategories:incomeCategories)[0]; renderCategories();
  }));
  $('saveBtn').addEventListener('click', addRecord);
  $('clearBtn').addEventListener('click',()=>{ if(confirm('確定清空所有紀錄？')){records=[];save();renderAll();}});
  $('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem(THEME_KEY,document.body.classList.contains('dark')?'dark':'light')});
  document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>switchPage(btn.dataset.page,btn)));
  $('exportBtn').addEventListener('click', exportCSV);
}
function renderCategories(){
  const list = currentType==='expense'?expenseCategories:incomeCategories;
  $('categoryRow').innerHTML = list.map(c=>`<button class="cat-btn ${c===currentCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');
  document.querySelectorAll('.cat-btn').forEach(btn=>btn.addEventListener('click',()=>{currentCategory=btn.dataset.cat;renderCategories();}));
}
function addRecord(){
  const amount = Number(String($('amountInput').value).replace(/,/g,''));
  const note = $('noteInput').value.trim();
  if(!amount || amount <= 0){toast('請輸入金額'); return;}
  records.unshift({id:Date.now(), type:currentType, amount, category:currentCategory, note, createdAt:new Date().toISOString()});
  save(); $('amountInput').value=''; $('noteInput').value=''; renderAll(); toast('已儲存');
}
function renderAll(){renderSummary(); renderRecords(); renderStats();}
function monthRecords(){const y=today.getFullYear(), m=today.getMonth(); return records.filter(r=>{const d=new Date(r.createdAt); return d.getFullYear()===y && d.getMonth()===m;});}
function renderSummary(){
  const list=monthRecords();
  const income=list.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense=list.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  $('incomeText').textContent=fmt(income); $('expenseText').textContent=fmt(expense); $('balanceText').textContent=fmt(income-expense);
}
function renderRecords(){
  const list = records.slice(0,20);
  if(!list.length){$('recordList').innerHTML='<div class="empty">還沒有紀錄，先記下第一筆吧。</div>'; return;}
  $('recordList').innerHTML=list.map(r=>{
    const sign=r.type==='income'?'+':'-'; const date=new Date(r.createdAt);
    return `<article class="record-item"><div class="record-left"><div class="record-icon">${r.type==='income'?'入':'出'}</div><div><div class="record-title">${r.category}</div><div class="record-note">${r.note||'無備註'}・${date.getMonth()+1}/${date.getDate()}</div></div></div><div class="record-amount ${r.type}">${sign}${fmt(r.amount)}</div></article>`;
  }).join('');
}
function renderStats(){
  const map={}; monthRecords().filter(r=>r.type==='expense').forEach(r=>map[r.category]=(map[r.category]||0)+r.amount);
  const rows=Object.entries(map).sort((a,b)=>b[1]-a[1]);
  $('categoryStats').innerHTML = rows.length ? rows.map(([k,v])=>`<div class="stat-line"><b>${k}</b><span>${fmt(v)}</span></div>`).join('') : '<div class="empty">本月還沒有支出資料。</div>';
}
function switchPage(pageId,btn){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(pageId).classList.add('active');document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1600);}
function exportCSV(){
  const header=['日期','類型','金額','分類','備註'];
  const rows=records.map(r=>[new Date(r.createdAt).toLocaleString('zh-TW'),r.type==='income'?'收入':'支出',r.amount,r.category,r.note||'']);
  const csv=[header,...rows].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='money-diary.csv'; a.click(); URL.revokeObjectURL(url);
}
function registerSW(){ if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn)); }}
init();
