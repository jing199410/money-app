const STORAGE_KEY = 'money_diary_records_v2';
const THEME_KEY = 'money_diary_theme_v2';
const cats = {
  expense: [
    ['飲食','🍔'], ['交通','🚇'], ['日用品','🧴'], ['娛樂','🎮'], ['購物','🛍️'], ['醫療','💊'], ['其他','🧾']
  ],
  income: [
    ['薪資','💼'], ['獎金','🎁'], ['兼職','🧑‍💻'], ['退款','↩️'], ['其他','✨']
  ]
};
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentType = 'expense';
let currentCategory = cats.expense[0][0];
const $ = id => document.getElementById(id);
const fmt = n => 'NT$ ' + Number(n || 0).toLocaleString('zh-TW');
const today = new Date();
function dateKey(d){ return new Date(d).toISOString().slice(0,10); }
function monthKey(d){ const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`; }
function weekday(d){ return ['週日','週一','週二','週三','週四','週五','週六'][new Date(d).getDay()]; }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); render(); }
function showToast(msg='已儲存'){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600); }
function renderCategories(){
  const box = $('categoryChips'); box.innerHTML='';
  cats[currentType].forEach(([name,icon])=>{
    const b=document.createElement('button'); b.className='chip'+(name===currentCategory?' active':''); b.textContent=`${icon} ${name}`;
    b.onclick=()=>{ currentCategory=name; renderCategories(); };
    box.appendChild(b);
  });
}
function setType(type){ currentType=type; currentCategory=cats[type][0][0]; document.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active', b.dataset.type===type)); renderCategories(); }
function addRecord(){
  const amount = Number($('amountInput').value);
  if(!amount || amount <= 0){ showToast('請輸入金額'); $('amountInput').focus(); return; }
  records.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type: currentType, amount, category: currentCategory, note: $('noteInput').value.trim(), createdAt: new Date().toISOString() });
  $('amountInput').value=''; $('noteInput').value=''; save(); showToast('已新增一筆');
}
function deleteRecord(id){ records = records.filter(r=>r.id!==id); save(); showToast('已刪除'); }
function renderSummary(){
  const m = monthKey(new Date()); const monthly = records.filter(r=>monthKey(r.createdAt)===m);
  const income = monthly.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense = monthly.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  $('monthPill').textContent = `${today.getFullYear()}年${today.getMonth()+1}月`;
  $('todayLabel').textContent = `${today.getMonth()+1}/${today.getDate()}（${weekday(today)}）`;
  $('balanceAmount').textContent = fmt(income-expense);
  $('incomeAmount').textContent = fmt(income); $('expenseAmount').textContent = fmt(expense);
}
function renderList(){
  const list=$('recordList'); list.innerHTML='';
  if(!records.length){ list.innerHTML='<div class="empty">還沒有紀錄，先記下第一筆吧。</div>'; return; }
  records.slice(0,40).forEach(r=>{
    const icon = (cats[r.type].find(c=>c[0]===r.category)||['','🧾'])[1];
    const item=document.createElement('div'); item.className='record-item';
    item.innerHTML=`<div class="record-icon">${icon}</div><div class="record-main"><strong>${r.category}${r.note?'｜'+escapeHtml(r.note):''}</strong><span>${new Date(r.createdAt).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div><div><div class="record-money ${r.type}">${r.type==='income'?'+':'-'}${fmt(r.amount)}</div><button class="delete-btn" aria-label="刪除">×</button></div>`;
    item.querySelector('.delete-btn').onclick=()=>deleteRecord(r.id);
    list.appendChild(item);
  });
}
function renderStats(){
  const box=$('categoryStats'); box.innerHTML='';
  const m=monthKey(new Date()); const expenses=records.filter(r=>r.type==='expense' && monthKey(r.createdAt)===m);
  if(!expenses.length){ box.innerHTML='<div class="empty">本月還沒有支出資料。</div>'; return; }
  const sum=expenses.reduce((s,r)=>s+r.amount,0); const map={}; expenses.forEach(r=>map[r.category]=(map[r.category]||0)+r.amount);
  Object.entries(map).sort((a,b)=>b[1]-a[1]).forEach(([cat,val])=>{
    const row=document.createElement('div'); row.className='stat-row'; const pct=sum?Math.round(val/sum*100):0;
    row.innerHTML=`<div class="stat-top"><span>${cat}</span><span>${fmt(val)} · ${pct}%</span></div><div class="bar"><span style="width:${pct}%"></span></div>`;
    box.appendChild(row);
  });
}
function render(){ renderSummary(); renderList(); renderStats(); }
function escapeHtml(s){ return s.replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function exportCSV(){
  const rows=[['日期','類型','金額','分類','備註']].concat(records.map(r=>[new Date(r.createdAt).toLocaleString('zh-TW'), r.type==='income'?'收入':'支出', r.amount, r.category, r.note||'']));
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='輕帳備份.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function addDemo(){
  const sample=[
    {type:'expense',amount:80,category:'飲食',note:'早餐'}, {type:'expense',amount:45,category:'交通',note:'捷運'}, {type:'income',amount:1200,category:'兼職',note:'案件'}
  ];
  records = sample.map((r,i)=>({...r,id:String(Date.now()+i),createdAt:new Date(Date.now()-i*3600000).toISOString()})).concat(records); save(); showToast('已加入範例');
}
document.addEventListener('DOMContentLoaded',()=>{
  if(localStorage.getItem(THEME_KEY)==='dark') document.body.classList.add('dark');
  $('themeToggle').onclick=()=>{ document.body.classList.toggle('dark'); localStorage.setItem(THEME_KEY, document.body.classList.contains('dark')?'dark':'light'); };
  document.querySelectorAll('.seg-btn').forEach(b=>b.onclick=()=>setType(b.dataset.type));
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); $(b.dataset.page).classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); });
  $('saveBtn').onclick=addRecord;
  $('amountInput').addEventListener('keydown',e=>{ if(e.key==='Enter') addRecord(); });
  $('clearAllBtn').onclick=()=>{ if(confirm('確定清空全部紀錄？')){ records=[]; save(); } };
  $('resetBtn').onclick=()=>{ if(confirm('確定清除全部資料？')){ records=[]; save(); showToast('已清除'); } };
  $('exportBtn').onclick=exportCSV; $('importDemoBtn').onclick=addDemo;
  renderCategories(); render();
});
