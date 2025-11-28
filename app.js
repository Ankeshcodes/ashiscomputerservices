// app.js - upgraded for V0.0.2
// Keeps your original store and auth logic, adds page routing and renderAdmin()

const STORAGE_KEY = "warranty_v001_store_v2";

// ---------- store helpers (unchanged) ----------
function loadStore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { products: [], tickets: [] };
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed)) return { products: [], tickets: parsed };
    return { products: parsed.products || [], tickets: parsed.tickets || [] };
  }catch(e){ return { products: [], tickets: [] }; }
}
function saveStore(store){ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function getAllProducts(){ return loadStore().products || []; }
function getAllTickets(){ return loadStore().tickets || []; }
function writeProducts(products){ const s = loadStore(); s.products = products; saveStore(s); }
function writeTickets(tickets){ const s = loadStore(); s.tickets = tickets; saveStore(s); }

function genProductId(){ return 'P-' + Date.now().toString(36).toUpperCase().slice(-6); }
function genTicketId(){ return 'T-' + Date.now().toString(36).toUpperCase().slice(-8); }

function findProduct(productId){
  return getAllProducts().find(p => p.productId === productId);
}

function warrantyInfoForProduct(prod){
  if(!prod || !prod.purchaseDate || typeof prod.warrantyMonths === 'undefined' || prod.warrantyMonths === null) return { onWarranty:false, daysLeft:null, endDate:null };
  const purchase = new Date(prod.purchaseDate + "T00:00:00");
  if(isNaN(purchase)) return { onWarranty:false, daysLeft:null, endDate:null };
  const end = new Date(purchase); end.setMonth(end.getMonth() + Number(prod.warrantyMonths||0));
  const now = new Date();
  const msPerDay = 24*60*60*1000;
  const diff = Math.ceil(((new Date(end.getFullYear(), end.getMonth(), end.getDate(),23,59,59)) - now) / msPerDay);
  return { onWarranty: diff >= 0, daysLeft: diff >= 0 ? diff : 0, endDate: new Date(end) };
}
function formatDate(d){ if(!d) return '—'; const dt = new Date(d); if(isNaN(dt)) return '—'; return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// --- Public warranty check call used in index.html invoke
function doWarrantyCheckPublic(productName, serial){
  const products = getAllProducts();
  const found = products.find(p => (p.itemName||'').toLowerCase() === productName.toLowerCase() && (p.serial||'').toLowerCase() === serial.toLowerCase());
  const el = document.getElementById('checkResult');
  if(!el) return;
  if(!found){ el.textContent = 'No product found for given name+serial.'; return; }
  const w = warrantyInfoForProduct(found);
  let warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day(s) left (ends ${formatDate(w.endDate)})` : `Out of warranty — Expired on ${formatDate(w.endDate)}`);
  el.innerHTML = `<div><strong>${escapeHtml(found.itemName)}</strong> — ${escapeHtml(found.productId)}</div>
    <div class="ticket-meta">Bill: ${escapeHtml(found.billNo||'—')} • Purchase: ${escapeHtml(found.purchaseDate||'—')}</div>
    <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>`;
}

// --- Admin auth (simple, kept same credentials)
const EMBED_ADMIN_USER = 'admin';
const EMBED_ADMIN_HASH = 'bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d'; // sha256(admin:admin123)
const ADMIN_SESSION_KEY = 'warranty_admin_session_modern';

async function sha256Hex(message){
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}
async function adminLogin(user, pass){
  const hash = await sha256Hex(`${user}:${pass}`);
  if(user === EMBED_ADMIN_USER && hash === EMBED_ADMIN_HASH){
    localStorage.setItem(ADMIN_SESSION_KEY, user);
    return true;
  }
  return false;
}
function adminLogoutFn(){ localStorage.removeItem(ADMIN_SESSION_KEY); }
function isAdmin(){ return !!localStorage.getItem(ADMIN_SESSION_KEY); }

// expose some functions to global for pages to call
window.getAllProducts = getAllProducts;
window.getAllTickets = getAllTickets;
window.findProduct = findProduct;
window.deRegisterProduct = function(productId){
  const prods = getAllProducts().filter(p=>p.productId !== productId);
  writeProducts(prods);
};
window.adminDeleteTicket = function(ticketId){
  if(!isAdmin()) return alert('Admin only');
  const ticks = getAllTickets().filter(t=>t.id !== ticketId);
  writeTickets(ticks);
  // refresh render if available
  if(typeof renderAdmin === 'function') renderAdmin();
};

// export CSV
window.exportCSV = function(){
  const tickets = getAllTickets();
  const rows = [["id","productId","custName","custPhone","itemName","serial","model","billNo","purchaseDate","warrantyMonths","receivedDate","priority","status","createdAt","problem"]];
  tickets.forEach(t => rows.push([t.id,t.productId,t.custName,t.custPhone,t.itemName,t.serial,t.model,t.billNo,t.purchaseDate,t.warrantyMonths,t.receivedDate,t.priority,t.status,t.createdAt,(t.problem||'').replace(/\n/g,' ')]));
  const csv = rows.map(r => r.map(cell => `"${(cell||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `warranty_tickets_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
};

// --- Admin register product & create ticket helpers ---
window.onRegisterProduct = function(){
  if(!isAdmin()) return alert('Admin only');
  const itemName = (document.getElementById('reg_itemName').value||'').trim();
  const serial = (document.getElementById('reg_serial').value||'').trim();
  const billNo = (document.getElementById('reg_billNo').value||'').trim();
  const purchaseDate = (document.getElementById('reg_purchaseDate').value||'').trim();
  const warrantyMonths = document.getElementById('reg_warrantyMonths').value ? Number(document.getElementById('reg_warrantyMonths').value) : null;
  if(!itemName) return document.getElementById('regMsg').textContent = 'Item name required';
  const products = getAllProducts();
  const p = { productId: genProductId(), itemName, serial, billNo, purchaseDate, warrantyMonths, createdAt: new Date().toISOString() };
  products.unshift(p);
  writeProducts(products);
  document.getElementById('regMsg').textContent = `Registered ${p.productId}`;
  setTimeout(()=>{ document.getElementById('adminRegisterProductModal').classList.add('hidden'); if(typeof renderAdmin==='function') renderAdmin(); },800);
};

window.openRegisterProductModal = function(){ document.getElementById('adminRegisterProductModal').classList.remove('hidden'); document.getElementById('regMsg').textContent=''; };

window.openCreateTicketModal = function(){
  if(!isAdmin()) return alert('Admin only');
  const sel = document.getElementById('ticket_productSelect');
  sel.innerHTML = '';
  const products = getAllProducts();
  if(!products.length){ sel.innerHTML = '<option value="">-- No products --</option>'; } 
  else sel.innerHTML = products.map(p=>`<option value="${p.productId}">${p.productId} — ${escapeHtml(p.itemName)}</option>`).join('');
  document.getElementById('adminCreateTicketModal').classList.remove('hidden');
};

window.onCreateTicket = function(){
  if(!isAdmin()) return alert('Admin only');
  const productId = (document.getElementById('ticket_productSelect').value||'').trim();
  const custName = (document.getElementById('ticket_custName').value||'').trim();
  const custPhone = (document.getElementById('ticket_custPhone').value||'').trim();
  const problem = (document.getElementById('ticket_problem').value||'').trim();
  if(!productId) return document.getElementById('ticketMsg').textContent = 'Select product';
  if(!custName) return document.getElementById('ticketMsg').textContent = 'Customer name required';
  const products = getAllProducts();
  const prod = products.find(x=>x.productId===productId);
  const tickets = getAllTickets();
  const t = {
    id: genTicketId(),
    productId: prod.productId,
    itemName: prod.itemName,
    serial: prod.serial||'',
    model: prod.model||'',
    billNo: prod.billNo||'',
    purchaseDate: prod.purchaseDate||'',
    warrantyMonths: prod.warrantyMonths||null,
    custName, custPhone, problem,
    receivedDate: new Date().toISOString().slice(0,10),
    createdAt: new Date().toISOString(),
    status: 'Received',
    timeline: [{ at: new Date().toISOString(), status: 'Received', note: 'Created by admin' }],
    notes: []
  };
  tickets.unshift(t);
  writeTickets(tickets);
  document.getElementById('adminCreateTicketModal').classList.add('hidden');
  setTimeout(()=>{ openTicketInModal(t.id); if(typeof renderAdmin === 'function') renderAdmin(); }, 300);
};

function openTicketInModal(id){
  const t = getAllTickets().find(x=>x.id===id);
  if(!t) return alert('Ticket not found');
  const prod = findProduct(t.productId) || {};
  const w = warrantyInfoForProduct(prod);
  const warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day(s) left` : `Out of warranty — Expired ${formatDate(w.endDate)}`);
  document.getElementById('modalBody').innerHTML = `<h3>${escapeHtml(t.itemName)} — ${t.id}</h3>
    <div class="ticket-meta">Customer: ${escapeHtml(t.custName)} • ${escapeHtml(t.custPhone||'—')}</div>
    <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
    <section class="timeline">${t.timeline.map(s=>`<div class="step">${escapeHtml(s.status)} — ${escapeHtml(s.note||'')}</div>`).join('')}</section>
    <div style="margin-top:8px"><button class="btn" onclick='printTicketReceipt(${JSON.stringify(t).replace(/</g,"\\u003c")})'>Print</button></div>`;
  document.getElementById('modal').classList.remove('hidden');
}
window.openTicketInModal = openTicketInModal;

// print minimal receipt (admin)
function printTicketReceipt(ticket){
  if(typeof ticket === 'string') ticket = JSON.parse(ticket);
  const prod = findProduct(ticket.productId) || {};
  const w = warrantyInfoForProduct(prod);
  const html = `<div class="print-area" style="padding:18px;font-family:Arial">
    <h2>Receipt — ${escapeHtml(ticket.id)}</h2>
    <div>Customer: ${escapeHtml(ticket.custName)} • ${escapeHtml(ticket.custPhone||'—')}</div>
    <div>Item: ${escapeHtml(ticket.itemName)} • Product: ${escapeHtml(ticket.productId)}</div>
    <div>Received: ${escapeHtml(ticket.receivedDate)}</div>
    <div style="margin-top:10px">Problem: ${escapeHtml(ticket.problem||'—')}</div>
  </div>`;
  const wwin = window.open('', '_blank', 'width=800,height=600');
  wwin.document.write(html);
  wwin.document.close();
  wwin.focus();
  wwin.print();
  setTimeout(()=> wwin.close(), 1000);
}

// --- new: renderAdmin (centralized admin UI renderer) ---
function renderAdmin(){
  // ensure admin area exists
  const tableBody = document.getElementById('adminTableBody');
  const productsWrap = document.getElementById('adminProductsWrap');
  if(!tableBody || !productsWrap) return;

  // tickets table
  const data = getAllTickets().slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  tableBody.innerHTML = '';
  if(!data.length){
    tableBody.innerHTML = '<tr><td colspan="6" style="padding:8px">No tickets</td></tr>';
  } else {
    data.forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.id}</td><td>${escapeHtml(t.custName)}</td><td>${escapeHtml(t.itemName)}</td><td>${escapeHtml(t.productId)}</td><td>${escapeHtml(t.status)}</td>
        <td>
          <button class="btn" data-op="open" data-id="${t.id}">Open</button>
          <button class="btn btn-outline" data-op="del" data-id="${t.id}">Delete</button>
        </td>`;
      tableBody.appendChild(tr);
    });
    // wire buttons
    Array.from(tableBody.querySelectorAll('button[data-op]')).forEach(b=>{
      const op = b.dataset.op;
      const id = b.dataset.id;
      b.addEventListener('click', ()=> {
        if(op === 'open') openTicketInModal(id);
        if(op === 'del') { if(confirm('Delete ticket?')) { window.adminDeleteTicket(id); } }
      });
    });
  }

  // products list
  const prods = getAllProducts();
  if(!prods.length){
    productsWrap.innerHTML = '<div class="card">No products registered</div>';
  } else {
    productsWrap.innerHTML = `<h4>Products (${prods.length})</h4>` + prods.map(p => `
      <div class="ticket-item">
        <div class="ticket-main">
          <div>
            <div style="font-weight:700">${escapeHtml(p.itemName)} • ${escapeHtml(p.productId)}</div>
            <div class="ticket-meta">S/N: ${escapeHtml(p.serial||'—')} • Bill: ${escapeHtml(p.billNo||'—')}</div>
            <div class="ticket-meta small">Purchase: ${escapeHtml(p.purchaseDate||'—')} • Warranty: ${escapeHtml(p.warrantyMonths||'—')} mo</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn" data-prod="${p.productId}" data-op="view">Open</button>
          <button class="btn btn-outline" data-prod="${p.productId}" data-op="dereg">Delete</button>
        </div>
      </div>
    `).join('');
    // wire product buttons
    Array.from(productsWrap.querySelectorAll('button[data-op]')).forEach(b=>{
      const op = b.dataset.op;
      const pid = b.dataset.prod;
      b.addEventListener('click', ()=> {
        if(op === 'view'){
          // open a fake ticket-like modal to show product warranty
          const prod = findProduct(pid);
          if(prod) {
            const w = warrantyInfoForProduct(prod);
            const warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day(s) left (ends ${formatDate(w.endDate)})` : `Out of warranty — Expired on ${formatDate(w.endDate)}`);
            document.getElementById('modalBody').innerHTML = `<h3>${escapeHtml(prod.itemName)} — ${escapeHtml(prod.productId)}</h3>
              <div class="ticket-meta">S/N: ${escapeHtml(prod.serial||'—')} • Bill: ${escapeHtml(prod.billNo||'—')}</div>
              <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>`;
            document.getElementById('modal').classList.remove('hidden');
          }
        }
        if(op === 'dereg' && confirm('Delete product?')) {
          window.deRegisterProduct(pid);
          if(typeof renderAdmin === 'function') renderAdmin();
        }
      });
    });
  }
}

// Expose renderAdmin so admin.html can call it
window.renderAdmin = renderAdmin;

// Fill minimal demo data if empty (keeps site usable)
(function ensureDemoData(){
  const s = loadStore();
  if(!s.products || s.products.length === 0){
    s.products = [
      { productId: 'P-DEMO1', itemName: 'Demo Laptop', serial: 'DL-1001', billNo: 'B-1001', purchaseDate: new Date().toISOString().slice(0,10), warrantyMonths: 12, createdAt: new Date().toISOString() }
    ];
  }
  if(!s.tickets || s.tickets.length === 0){
    s.tickets = [
      { id: 'T-DEMO1', productId: 'P-DEMO1', itemName: 'Demo Laptop', serial: 'DL-1001', model: '', billNo: 'B-1001', purchaseDate: new Date().toISOString().slice(0,10), warrantyMonths: 12, custName: 'Demo', custPhone: '000', problem: 'Demo problem', receivedDate: new Date().toISOString().slice(0,10), createdAt: new Date().toISOString(), status: 'In Service', timeline: [{at:new Date().toISOString(), status:'In Service', note:'Demo'}], notes: [] }
    ];
  }
  saveStore(s);
})();
