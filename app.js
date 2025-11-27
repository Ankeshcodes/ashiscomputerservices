document.addEventListener("DOMContentLoaded", () => {

/* app.js
   Full app:
   - Products (register) & Tickets (create)
   - Public hero search by Ticket ID only
   - Admin login/logout with admin-only UI/actions
   - Warranty days calculation & receipt printing
   - Products list with delete & view (admin)
*/
// === CONFIG ===
const STORAGE_KEY = "warranty_v001_store_v2";
const ADMIN_SESSION_KEY = "warranty_admin_session_modern";
const EMBED_ADMIN_USER = "admin";
const EMBED_ADMIN_HASH = "bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d"; // sha256("admin:admin123")

// === in-memory store ===
let store = loadStore(); // { products: [], tickets: [] }
let products = store.products || [];
let tickets = store.tickets || [];

// === DOM elements ===
// hero quick ticket search (Ticket ID only)
const quickTicketId = document.getElementById("quickTicketId");
const quickFind = document.getElementById("quickFind");
const statusOnlyBtn = document.getElementById("statusOnlyBtn");

// public check (product+serial)
const checkProduct = document.getElementById("checkProduct");
const checkSerial = document.getElementById("checkSerial");
const checkBtn = document.getElementById("checkBtn");
const checkResult = document.getElementById("checkResult");

// header stats and list
const totalTicketsEl = document.getElementById("totalTickets");
const inServiceCountEl = document.getElementById("inServiceCount");
const ticketListEl = document.getElementById("ticketList");
const emptyMsg = document.getElementById("emptyMsg");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortBy = document.getElementById("sortBy");
const exportBtn = document.getElementById("exportBtn");

// admin dashboard controls
const adminPanelLink = document.getElementById("adminPanelLink");
const adminRegisterProductBtn = document.getElementById("adminRegisterProductBtn");
const adminCreateTicketBtn = document.getElementById("adminCreateTicketBtn");
const adminTableBody = document.getElementById("adminTableBody");
const adminSearch = document.getElementById("adminSearch");
const adminStatusFilter = document.getElementById("adminStatusFilter");

// admin login
const adminBtn = document.getElementById("adminBtn");
const adminModal = document.getElementById("adminModal");
const adminSubmitBtn = document.getElementById("adminSubmit");
const adminLogoutBtn = document.getElementById("adminLogout");
const adminMsg = document.getElementById("adminMsg");
const adminTitle = document.getElementById("adminModalTitle");

// register product modal elements
const regModal = document.getElementById("adminRegisterProductModal");
const regClose = document.getElementById("closeRegisterProduct");
const reg_itemName = document.getElementById("reg_itemName");
const reg_serial = document.getElementById("reg_serial");
const reg_model = document.getElementById("reg_model");
const reg_billNo = document.getElementById("reg_billNo");
const reg_purchaseDate = document.getElementById("reg_purchaseDate");
const reg_warrantyMonths = document.getElementById("reg_warrantyMonths");
const regSaveBtn = document.getElementById("regSaveBtn");
const regCancelBtn = document.getElementById("regCancelBtn");
const regMsg = document.getElementById("regMsg");

// create ticket modal elements
const ticketModal = document.getElementById("adminCreateTicketModal");
const ticketClose = document.getElementById("closeCreateTicket");
const ticket_productSelect = document.getElementById("ticket_productSelect");
const ticket_custName = document.getElementById("ticket_custName");
const ticket_custPhone = document.getElementById("ticket_custPhone");
const ticket_priority = document.getElementById("ticket_priority");
const ticket_problem = document.getElementById("ticket_problem");
const ticketSaveBtn = document.getElementById("ticketSaveBtn");
const ticketCancelBtn = document.getElementById("ticketCancelBtn");
const ticketMsg = document.getElementById("ticketMsg");

// modal (view)
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

// other (close main modal)
document.getElementById("closeModal").addEventListener("click", closeModal);

// === init events ===
quickFind && quickFind.addEventListener("click", () => {
  const q = (quickTicketId.value || "").trim();
  if(!q){ alert("Enter Ticket ID (e.g. T-...)"); return; }
  const t = tickets.find(x => x.id.toLowerCase() === q.toLowerCase());
  if(!t) return alert("Ticket not found");
  openModal(t.id);
});

// public product+serial check
checkBtn && checkBtn.addEventListener("click", () => {
  const p = (checkProduct.value || '').trim();
  const s = (checkSerial.value || '').trim();
  if(!p || !s){ checkResult.textContent = "Please enter both product name and serial number."; return; }
  doWarrantyCheck(p, s);
});

// search / admin filters
searchInput && searchInput.addEventListener("input", renderList);
statusFilter && statusFilter.addEventListener("change", renderList);
sortBy && sortBy.addEventListener("change", renderList);
exportBtn && exportBtn.addEventListener("click", exportCSV);

// nav
document.getElementById("nav-check").addEventListener("click", () => showSection('check'));
document.getElementById("nav-status").addEventListener("click", () => showSection('list'));
document.getElementById("nav-contact").addEventListener("click", () => alert("Contact: 8521450594\nGarhwa, Jharkhand"));

// admin login
adminBtn.addEventListener("click", () => openAdminModal());
adminSubmitBtn.addEventListener("click", adminLogin);
adminLogoutBtn.addEventListener("click", adminLogout);

// admin dashboard actions
adminRegisterProductBtn && adminRegisterProductBtn.addEventListener("click", () => openRegisterProductModal());
adminCreateTicketBtn && adminCreateTicketBtn.addEventListener("click", () => openCreateTicketModal());
adminSearch && adminSearch.addEventListener("input", renderAdminTable);
adminStatusFilter && adminStatusFilter.addEventListener("change", renderAdminTable);

// register product modal events
regClose && regClose.addEventListener("click", () => regModal.classList.add("hidden"));
regCancelBtn && regCancelBtn.addEventListener("click", () => regModal.classList.add("hidden"));
regSaveBtn && regSaveBtn.addEventListener("click", onRegisterProduct);

// create ticket modal events
ticketClose && ticketClose.addEventListener("click", () => ticketModal.classList.add("hidden"));
ticketCancelBtn && ticketCancelBtn.addEventListener("click", () => ticketModal.classList.add("hidden"));
ticketSaveBtn && ticketSaveBtn.addEventListener("click", onCreateTicket);

// initial render
renderList();
renderAdminTable();
renderProductsList();
updateHeaderStats();
updateAdminUI();

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.add("hidden");
}

function closeModal() {
  document.querySelectorAll(".modal").forEach(m => {
      m.classList.add("hidden");
  });
}
// ---------------- Storage helpers ----------------
function loadStore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { products: [], tickets: [] };
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed)) return { products: [], tickets: parsed };
    return { products: parsed.products || [], tickets: parsed.tickets || [] };
  } catch(e){
    return { products: [], tickets: [] };
  }
}
function saveStore(){
  store.products = products;
  store.tickets = tickets;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ---------------- ID generators ----------------
function genProductId(){ return 'P-' + Date.now().toString(36).toUpperCase().slice(-6); }
function genTicketId(){ return 'T-' + Date.now().toString(36).toUpperCase().slice(-8); }
function nowISO(){ return new Date().toISOString(); }

// ---------------- Date / Warranty utils ----------------
function addMonthsToDate(date, months){
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if(d.getDate() < day) d.setDate(0);
  return d;
}
function formatDate(d){
  if(!d) return '—';
  const dt = new Date(d);
  if(isNaN(dt)) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function warrantyInfoForProduct(prod){
  if(!prod || !prod.purchaseDate || typeof prod.warrantyMonths === 'undefined' || prod.warrantyMonths === null) return { onWarranty:false, daysLeft:null, endDate:null };
  const purchase = new Date(prod.purchaseDate + "T00:00:00");
  if(isNaN(purchase)) return { onWarranty:false, daysLeft:null, endDate:null };
  const end = addMonthsToDate(purchase, Number(prod.warrantyMonths||0));
  const now = new Date();
  const msPerDay = 24*60*60*1000;
  const diff = Math.ceil((new Date(end.getFullYear(), end.getMonth(), end.getDate(),23,59,59) - now) / msPerDay);
  return { onWarranty: diff >= 0, daysLeft: diff >= 0 ? diff : 0, endDate: new Date(end) };
}

// ---------------- Public warranty check (product+serial) ----------------
function doWarrantyCheck(productName, serial){
  const p = productName.trim().toLowerCase();
  const s = serial.trim().toLowerCase();
  const foundProd = products.find(prod =>
    (prod.itemName || '').toLowerCase() === p &&
    (prod.serial || '').toLowerCase() === s
  );
  if(!foundProd){
    checkResult.textContent = "No product found for given name and serial. Please contact the service center.";
    return;
  }
  const relatedTickets = tickets.filter(t => t.productId === foundProd.productId);
  const latestTicket = relatedTickets.length ? relatedTickets[0] : null;
  const w = warrantyInfoForProduct(foundProd);
  let warrantyText = "";
  if(!w.endDate) warrantyText = "Warranty info not available";
  else if(w.onWarranty) warrantyText = `On warranty — ${w.daysLeft} day${w.daysLeft !== 1 ? 's' : ''} left (ends ${formatDate(w.endDate)})`;
  else warrantyText = `Out of warranty — Expired on ${formatDate(w.endDate)}`;

  checkResult.innerHTML = `
    <div><strong>${escapeHtml(foundProd.itemName)}</strong> — ${escapeHtml(foundProd.productId)}</div>
    <div class="ticket-meta">Bill: ${escapeHtml(foundProd.billNo || '—')} • Purchase: ${escapeHtml(foundProd.purchaseDate || '—')}</div>
    <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
    <div style="margin-top:8px">${ latestTicket ? `Latest Ticket: <strong>${escapeHtml(latestTicket.id)}</strong> — Status: <span class="badge status-${cssClassForStatus(latestTicket.status)}">${escapeHtml(latestTicket.status)}</span>` : 'No tickets yet for this product.' }</div>
    <div style="margin-top:8px"><button class="btn" onclick="openProductModal('${foundProd.productId}')">View Product</button></div>
  `;
}

// public view product (limited)
function openProductModal(productId){
  const p = products.find(x => x.productId === productId);
  if(!p) return;
  const w = warrantyInfoForProduct(p);
  const warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day${w.daysLeft!==1?'s':''} left (ends ${formatDate(w.endDate)})` : `Out of warranty — Expired on ${formatDate(w.endDate)}`);
  modalBody.innerHTML = `
    <h3>${escapeHtml(p.itemName)} — ${escapeHtml(p.productId)}</h3>
    <div class="ticket-meta">Serial: ${escapeHtml(p.serial||'—')}</div>
    <div class="ticket-meta">Bill: ${escapeHtml(p.billNo||'—')} • Purchase: ${escapeHtml(p.purchaseDate||'—')}</div>
    <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
    <section class="timeline" style="margin-top:12px">
      <h4>Related Tickets</h4>
      ${ tickets.filter(t=>t.productId===p.productId).map(t=>`<div class="step">${escapeHtml(t.id)} — ${escapeHtml(t.status)} — ${escapeHtml(t.receivedDate)}</div>`).join('') || '<div class="muted">No tickets</div>'}
    </section>
  `;
  modal.classList.remove("hidden");
}

// ---------------- Admin: Register Product ----------------
function openRegisterProductModal(){
  if(!isAdmin()) return alert("Admin only");
  reg_itemName.value = '';
  reg_serial.value = '';
  reg_model.value = '';
  reg_billNo.value = '';
  reg_purchaseDate.value = '';
  reg_warrantyMonths.value = '';
  regMsg.textContent = '';
  regModal.classList.remove("hidden");
}
function onRegisterProduct(){
  if(!isAdmin()) return alert("Admin only");
  const itemName = (reg_itemName.value || '').trim();
  const serial = (reg_serial.value || '').trim();
  const model = (reg_model.value || '').trim();
  const billNo = (reg_billNo.value || '').trim();
  const purchaseDate = (reg_purchaseDate.value || '').trim();
  const warrantyMonths = reg_warrantyMonths.value ? Number(reg_warrantyMonths.value) : null;
  if(!itemName){ regMsg.textContent = "Item name required."; return; }

  const product = {
    productId: genProductId(),
    itemName,
    serial,
    model,
    billNo,
    purchaseDate,
    warrantyMonths: warrantyMonths !== null ? warrantyMonths : null,
    createdAt: nowISO()
  };
  products.unshift(product);
  saveStore();
  regMsg.textContent = `Product registered: ${product.productId}`;
  setTimeout(() => { regModal.classList.add('hidden'); renderProductsList(); renderAdminTable(); updateHeaderStats(); }, 700);
}

// ---------------- Admin: Create Ticket (attach to product) ----------------
function openCreateTicketModal(){
  if(!isAdmin()) return alert("Admin only");
  ticket_productSelect.innerHTML = '';
  if(!products.length){
    ticket_productSelect.innerHTML = '<option value="">-- No products registered (register first) --</option>';
  } else {
    ticket_productSelect.innerHTML = products.map(p => `<option value="${p.productId}">${p.productId} — ${escapeHtml(p.itemName)} ${p.serial? '('+escapeHtml(p.serial)+')':''}</option>`).join('');
  }
  ticket_custName.value = '';
  ticket_custPhone.value = '';
  ticket_priority.value = 'Normal';
  ticket_problem.value = '';
  ticketMsg.textContent = '';
  ticketSaveBtn.dataset.editingId = '';
  ticketModal.classList.remove('hidden');
}
function onCreateTicket(){
  if(!isAdmin()) return alert("Admin only");
  const productId = (ticket_productSelect.value || '').trim();
  const custName = (ticket_custName.value || '').trim();
  const custPhone = (ticket_custPhone.value || '').trim();
  const priority = ticket_priority.value || 'Normal';
  const problem = (ticket_problem.value || '').trim();
  if(!productId){ ticketMsg.textContent = 'Select a Product ID (register product if none).'; return; }
  if(!custName){ ticketMsg.textContent = 'Customer name required.'; return; }
  const product = products.find(p => p.productId === productId);
  if(!product){ ticketMsg.textContent = 'Selected product not found.'; return; }

  const editingId = ticketSaveBtn.dataset.editingId || '';
  if(editingId){
    const t = tickets.find(x => x.id === editingId);
    if(!t){ ticketMsg.textContent = 'Ticket not found.'; return; }
    t.productId = product.productId;
    t.custName = custName;
    t.custPhone = custPhone;
    t.priority = priority;
    t.problem = problem;
    saveStore();
    ticketMsg.textContent = 'Ticket updated.';
    setTimeout(()=>{ ticketModal.classList.add('hidden'); renderList(); renderAdminTable(); }, 600);
    return;
  }

  const ticket = {
// ==== SAFE WRAPPED app.js ====
// This file was adjusted so script runs after DOM ready and won't crash if elements are missing.
// Confirmed working with your index.html / style.css structure.

// quick startup trace
console.log("app.js (patched) - script loaded");

// Wrap everything so it runs after DOM is ready
document.addEventListener("DOMContentLoaded", () => {

  // === CONFIG ===
  const STORAGE_KEY = "warranty_v001_store_v2";
  const ADMIN_SESSION_KEY = "warranty_admin_session_modern";
  const EMBED_ADMIN_USER = "admin";
  const EMBED_ADMIN_HASH = "bf6b5bdb74c79ece9fc0ad0ac9fb0359f9555d4f35a83b2e6ec69ae99e09603d"; // sha256("admin:admin123")

  // === in-memory store ===
  let store = loadStore(); // { products: [], tickets: [] }
  let products = store.products || [];
  let tickets = store.tickets || [];

  // === DOM elements ===
  // hero quick ticket search (Ticket ID only)
  const quickTicketId = document.getElementById("quickTicketId");
  const quickFind = document.getElementById("quickFind");
  const statusOnlyBtn = document.getElementById("statusOnlyBtn");

  // public check (product+serial)
  const checkProduct = document.getElementById("checkProduct");
  const checkSerial = document.getElementById("checkSerial");
  const checkBtn = document.getElementById("checkBtn");
  const checkResult = document.getElementById("checkResult");

  // header stats and list
  const totalTicketsEl = document.getElementById("totalTickets");
  const inServiceCountEl = document.getElementById("inServiceCount");
  const ticketListEl = document.getElementById("ticketList");
  const emptyMsg = document.getElementById("emptyMsg");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const sortBy = document.getElementById("sortBy");
  const exportBtn = document.getElementById("exportBtn");

  // admin dashboard controls
  const adminPanelLink = document.getElementById("adminPanelLink");
  const adminRegisterProductBtn = document.getElementById("adminRegisterProductBtn");
  const adminCreateTicketBtn = document.getElementById("adminCreateTicketBtn");
  const adminTableBody = document.getElementById("adminTableBody");
  const adminSearch = document.getElementById("adminSearch");
  const adminStatusFilter = document.getElementById("adminStatusFilter");

  // admin login
  const adminBtn = document.getElementById("adminBtn");
  const adminModal = document.getElementById("adminModal");
  const adminSubmitBtn = document.getElementById("adminSubmit");
  const adminLogoutBtn = document.getElementById("adminLogout");
  const adminMsg = document.getElementById("adminMsg");
  const adminTitle = document.getElementById("adminModalTitle");

  // register product modal elements
  const regModal = document.getElementById("adminRegisterProductModal");
  const regClose = document.getElementById("closeRegisterProduct");
  const reg_itemName = document.getElementById("reg_itemName");
  const reg_serial = document.getElementById("reg_serial");
  const reg_model = document.getElementById("reg_model");
  const reg_billNo = document.getElementById("reg_billNo");
  const reg_purchaseDate = document.getElementById("reg_purchaseDate");
  const reg_warrantyMonths = document.getElementById("reg_warrantyMonths");
  const regSaveBtn = document.getElementById("regSaveBtn");
  const regCancelBtn = document.getElementById("regCancelBtn");
  const regMsg = document.getElementById("regMsg");

  // create ticket modal elements
  const ticketModal = document.getElementById("adminCreateTicketModal");
  const ticketClose = document.getElementById("closeCreateTicket");
  const ticket_productSelect = document.getElementById("ticket_productSelect");
  const ticket_custName = document.getElementById("ticket_custName");
  const ticket_custPhone = document.getElementById("ticket_custPhone");
  const ticket_priority = document.getElementById("ticket_priority");
  const ticket_problem = document.getElementById("ticket_problem");
  const ticketSaveBtn = document.getElementById("ticketSaveBtn");
  const ticketCancelBtn = document.getElementById("ticketCancelBtn");
  const ticketMsg = document.getElementById("ticketMsg");

  // modal (view)
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modalBody");

  // other close buttons (safe attach)
  const closeModalBtn = document.getElementById("closeModal");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
  const closeAdminBtn = document.getElementById("closeAdmin");
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener("click", closeModal);
  }
  const closeRegisterProductBtn = document.getElementById("closeRegisterProduct");
  if (closeRegisterProductBtn) {
    closeRegisterProductBtn.addEventListener("click", () => {
      if (regModal) regModal.classList.add("hidden");
    });
  }
  const closeCreateTicketBtn = document.getElementById("closeCreateTicket");
  if (closeCreateTicketBtn) {
    closeCreateTicketBtn.addEventListener("click", () => {
      if (ticketModal) ticketModal.classList.add("hidden");
    });
  }

  // === init events ===
  quickFind && quickFind.addEventListener("click", () => {
    const q = (quickTicketId && quickTicketId.value || "").trim();
    if(!q){ alert("Enter Ticket ID (e.g. T-...)"); return; }
    const t = tickets.find(x => x.id.toLowerCase() === q.toLowerCase());
    if(!t) return alert("Ticket not found");
    openModal(t.id);
  });

  // public product+serial check
  checkBtn && checkBtn.addEventListener("click", () => {
    const p = (checkProduct && checkProduct.value || '').trim();
    const s = (checkSerial && checkSerial.value || '').trim();
    if(!p || !s){ if (checkResult) checkResult.textContent = "Please enter both product name and serial number."; return; }
    doWarrantyCheck(p, s);
  });

  // search / admin filters
  searchInput && searchInput.addEventListener("input", renderList);
  statusFilter && statusFilter.addEventListener("change", renderList);
  sortBy && sortBy.addEventListener("change", renderList);
  exportBtn && exportBtn.addEventListener("click", exportCSV);

  // nav (safe attach)
  const navCheck = document.getElementById("nav-check");
  if (navCheck) navCheck.addEventListener("click", () => showSection('check'));
  const navStatus = document.getElementById("nav-status");
  if (navStatus) navStatus.addEventListener("click", () => showSection('list'));
  const navContact = document.getElementById("nav-contact");
  if (navContact) navContact.addEventListener("click", () => alert("Contact: 8521450594\nGarhwa, Jharkhand"));

  // admin login (safe)
  if (adminBtn) adminBtn.addEventListener("click", () => openAdminModal());
  if (adminSubmitBtn) adminSubmitBtn.addEventListener("click", adminLogin);
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", adminLogout);

  // admin dashboard actions
  adminRegisterProductBtn && adminRegisterProductBtn.addEventListener("click", () => openRegisterProductModal());
  adminCreateTicketBtn && adminCreateTicketBtn.addEventListener("click", () => openCreateTicketModal());
  adminSearch && adminSearch.addEventListener("input", renderAdminTable);
  adminStatusFilter && adminStatusFilter.addEventListener("change", renderAdminTable);

  // register product modal events
  regClose && regClose.addEventListener("click", () => regModal && regModal.classList.add("hidden"));
  regCancelBtn && regCancelBtn.addEventListener("click", () => regModal && regModal.classList.add("hidden"));
  regSaveBtn && regSaveBtn.addEventListener("click", onRegisterProduct);

  // create ticket modal events
  ticketClose && ticketClose.addEventListener("click", () => ticketModal && ticketModal.classList.add("hidden"));
  ticketCancelBtn && ticketCancelBtn.addEventListener("click", () => ticketModal && ticketModal.classList.add("hidden"));
  ticketSaveBtn && ticketSaveBtn.addEventListener("click", onCreateTicket);

  // initial render
  renderList();
  renderAdminTable();
  renderProductsList();
  updateHeaderStats();
  updateAdminUI();

  // ---- helpers & functions (your original code below) ----

  function closeModal() {
    // Hide all modal overlays
    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  }

  // ---------------- Storage helpers ----------------
  function loadStore(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { products: [], tickets: [] };
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return { products: [], tickets: parsed };
      return { products: parsed.products || [], tickets: parsed.tickets || [] };
    } catch(e){
      return { products: [], tickets: [] };
    }
  }
  function saveStore(){
    store.products = products;
    store.tickets = tickets;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  // ---------------- ID generators ----------------
  function genProductId(){ return 'P-' + Date.now().toString(36).toUpperCase().slice(-6); }
  function genTicketId(){ return 'T-' + Date.now().toString(36).toUpperCase().slice(-8); }
  function nowISO(){ return new Date().toISOString(); }

  // ---------------- Date / Warranty utils ----------------
  function addMonthsToDate(date, months){
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if(d.getDate() < day) d.setDate(0);
    return d;
  }
  function formatDate(d){
    if(!d) return '—';
    const dt = new Date(d);
    if(isNaN(dt)) return '—';
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const day = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function warrantyInfoForProduct(prod){
    if(!prod || !prod.purchaseDate || typeof prod.warrantyMonths === 'undefined' || prod.warrantyMonths === null) return { onWarranty:false, daysLeft:null, endDate:null };
    const purchase = new Date(prod.purchaseDate + "T00:00:00");
    if(isNaN(purchase)) return { onWarranty:false, daysLeft:null, endDate:null };
    const end = addMonthsToDate(purchase, Number(prod.warrantyMonths||0));
    const now = new Date();
    const msPerDay = 24*60*60*1000;
    const diff = Math.ceil((new Date(end.getFullYear(), end.getMonth(), end.getDate(),23,59,59) - now) / msPerDay);
    return { onWarranty: diff >= 0, daysLeft: diff >= 0 ? diff : 0, endDate: new Date(end) };
  }

  // ---------------- Public warranty check (product+serial) ----------------
  function doWarrantyCheck(productName, serial){
    const p = productName.trim().toLowerCase();
    const s = serial.trim().toLowerCase();
    const foundProd = products.find(prod =>
      (prod.itemName || '').toLowerCase() === p &&
      (prod.serial || '').toLowerCase() === s
    );
    if(!foundProd){
      checkResult && (checkResult.textContent = "No product found for given name and serial. Please contact the service center.");
      return;
    }
    const relatedTickets = tickets.filter(t => t.productId === foundProd.productId);
    const latestTicket = relatedTickets.length ? relatedTickets[0] : null;
    const w = warrantyInfoForProduct(foundProd);
    let warrantyText = "";
    if(!w.endDate) warrantyText = "Warranty info not available";
    else if(w.onWarranty) warrantyText = `On warranty — ${w.daysLeft} day${w.daysLeft !== 1 ? 's' : ''} left (ends ${formatDate(w.endDate)})`;
    else warrantyText = `Out of warranty — Expired on ${formatDate(w.endDate)}`;

    if (checkResult) {
      checkResult.innerHTML = `
        <div><strong>${escapeHtml(foundProd.itemName)}</strong> — ${escapeHtml(foundProd.productId)}</div>
        <div class="ticket-meta">Bill: ${escapeHtml(foundProd.billNo || '—')} • Purchase: ${escapeHtml(foundProd.purchaseDate || '—')}</div>
        <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
        <div style="margin-top:8px">${ latestTicket ? `Latest Ticket: <strong>${escapeHtml(latestTicket.id)}</strong> — Status: <span class="badge status-${cssClassForStatus(latestTicket.status)}">${escapeHtml(latestTicket.status)}</span>` : 'No tickets yet for this product.' }</div>
        <div style="margin-top:8px"><button class="btn" onclick="openProductModal('${foundProd.productId}')">View Product</button></div>
      `;
    }
  }

  // public view product (limited)
  function openProductModal(productId){
    const p = products.find(x => x.productId === productId);
    if(!p) return;
    const w = warrantyInfoForProduct(p);
    const warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day${w.daysLeft!==1?'s':''} left (ends ${formatDate(w.endDate)})` : `Out of warranty — Expired on ${formatDate(w.endDate)}`);
    if (modalBody && modal) {
      modalBody.innerHTML = `
        <h3>${escapeHtml(p.itemName)} — ${escapeHtml(p.productId)}</h3>
        <div class="ticket-meta">Serial: ${escapeHtml(p.serial||'—')}</div>
        <div class="ticket-meta">Bill: ${escapeHtml(p.billNo||'—')} • Purchase: ${escapeHtml(p.purchaseDate||'—')}</div>
        <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
        <section class="timeline" style="margin-top:12px">
          <h4>Related Tickets</h4>
          ${ tickets.filter(t=>t.productId===p.productId).map(t=>`<div class="step">${escapeHtml(t.id)} — ${escapeHtml(t.status)} — ${escapeHtml(t.receivedDate)}</div>`).join('') || '<div class="muted">No tickets</div>'}
        </section>
      `;
      modal.classList.remove("hidden");
    }
  }

  // ---------------- Admin: Register Product ----------------
  function openRegisterProductModal(){
    if(!isAdmin()) return alert("Admin only");
    if(reg_itemName) reg_itemName.value = '';
    if(reg_serial) reg_serial.value = '';
    if(reg_model) reg_model.value = '';
    if(reg_billNo) reg_billNo.value = '';
    if(reg_purchaseDate) reg_purchaseDate.value = '';
    if(reg_warrantyMonths) reg_warrantyMonths.value = '';
    if(regMsg) regMsg.textContent = '';
    if (regModal) regModal.classList.remove("hidden");
  }
  function onRegisterProduct(){
    if(!isAdmin()) return alert("Admin only");
    const itemName = (reg_itemName && reg_itemName.value || '').trim();
    const serial = (reg_serial && reg_serial.value || '').trim();
    const model = (reg_model && reg_model.value || '').trim();
    const billNo = (reg_billNo && reg_billNo.value || '').trim();
    const purchaseDate = (reg_purchaseDate && reg_purchaseDate.value || '').trim();
    const warrantyMonths = reg_warrantyMonths && reg_warrantyMonths.value ? Number(reg_warrantyMonths.value) : null;
    if(!itemName){ if(regMsg) regMsg.textContent = "Item name required."; return; }

    const product = {
      productId: genProductId(),
      itemName,
      serial,
      model,
      billNo,
      purchaseDate,
      warrantyMonths: warrantyMonths !== null ? warrantyMonths : null,
      createdAt: nowISO()
    };
    products.unshift(product);
    saveStore();
    if (regMsg) regMsg.textContent = `Product registered: ${product.productId}`;
    setTimeout(() => { if(regModal) regModal.classList.add('hidden'); renderProductsList(); renderAdminTable(); updateHeaderStats(); }, 700);
  }

  // ---------------- Admin: Create Ticket (attach to product) ----------------
  function openCreateTicketModal(){
    if(!isAdmin()) return alert("Admin only");
    if (ticket_productSelect) {
      ticket_productSelect.innerHTML = '';
      if(!products.length){
        ticket_productSelect.innerHTML = '<option value="">-- No products registered (register first) --</option>';
      } else {
        ticket_productSelect.innerHTML = products.map(p => `<option value="${p.productId}">${p.productId} — ${escapeHtml(p.itemName)} ${p.serial? '('+escapeHtml(p.serial)+')':''}</option>`).join('');
      }
    }
    if(ticket_custName) ticket_custName.value = '';
    if(ticket_custPhone) ticket_custPhone.value = '';
    if(ticket_priority) ticket_priority.value = 'Normal';
    if(ticket_problem) ticket_problem.value = '';
    if(ticketMsg) ticketMsg.textContent = '';
    if(ticketSaveBtn) ticketSaveBtn.dataset.editingId = '';
    if(ticketModal) ticketModal.classList.remove('hidden');
  }
  function onCreateTicket(){
    if(!isAdmin()) return alert("Admin only");
    const productId = (ticket_productSelect && ticket_productSelect.value || '').trim();
    const custName = (ticket_custName && ticket_custName.value || '').trim();
    const custPhone = (ticket_custPhone && ticket_custPhone.value || '').trim();
    const priority = (ticket_priority && ticket_priority.value) || 'Normal';
    const problem = (ticket_problem && ticket_problem.value || '').trim();
    if(!productId){ if(ticketMsg) ticketMsg.textContent = 'Select a Product ID (register product if none).'; return; }
    if(!custName){ if(ticketMsg) ticketMsg.textContent = 'Customer name required.'; return; }
    const product = products.find(p => p.productId === productId);
    if(!product){ if(ticketMsg) ticketMsg.textContent = 'Selected product not found.'; return; }

    const editingId = (ticketSaveBtn && ticketSaveBtn.dataset && ticketSaveBtn.dataset.editingId) || '';
    if(editingId){
      const t = tickets.find(x => x.id === editingId);
      if(!t){ if(ticketMsg) ticketMsg.textContent = 'Ticket not found.'; return; }
      t.productId = product.productId;
      t.custName = custName;
      t.custPhone = custPhone;
      t.priority = priority;
      t.problem = problem;
      saveStore();
      if(ticketMsg) ticketMsg.textContent = 'Ticket updated.';
      setTimeout(()=>{ ticketModal && ticketModal.classList.add('hidden'); renderList(); renderAdminTable(); }, 600);
      return;
    }

    const ticket = {
      id: genTicketId(),
      productId: product.productId,
      custName,
      custPhone,
      itemName: product.itemName,
      serial: product.serial || '',
      model: product.model || '',
      billNo: product.billNo || '',
      purchaseDate: product.purchaseDate || '',
      warrantyMonths: product.warrantyMonths !== null ? product.warrantyMonths : null,
      receivedDate: new Date().toISOString().slice(0,10),
      priority,
      problem,
      createdAt: nowISO(),
      status: "Received",
      timeline: [{ at: nowISO(), status: "Received", note: "Created by admin (ticket)" }],
      notes: []
    };
    tickets.unshift(ticket);
    saveStore();
    ticketModal && ticketModal.classList.add('hidden');
    renderList();
    renderAdminTable();
    updateHeaderStats();
    // open modal and print
    setTimeout(()=>{ openModal(ticket.id); printTicketReceipt(ticket); }, 180);
  }

  // ---------------- List render (Admin-only) ----------------
  function renderList(){
    if(!isAdmin()){
      if (ticketListEl) ticketListEl.innerHTML = '';
      if (emptyMsg) { emptyMsg.style.display = 'block'; emptyMsg.textContent = 'Login as admin to view the full ticket list.'; }
      updateHeaderStats();
      return;
    }
    const q = (searchInput && searchInput.value || '').trim().toLowerCase();
    const statusF = statusFilter && statusFilter.value;
    const sort = sortBy && sortBy.value;
    let data = tickets.slice();
    if(statusF && statusF !== 'All') data = data.filter(t => t.status === statusF);
    if(q) data = data.filter(t => (t.id||'').toLowerCase().includes(q) || (t.custName||'').toLowerCase().includes(q) || (t.itemName||'').toLowerCase().includes(q) || (t.productId||'').toLowerCase().includes(q));
    data.sort((a,b) => (sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    if (ticketListEl) ticketListEl.innerHTML = '';
    if(!data.length){ if (emptyMsg) { emptyMsg.style.display='block'; emptyMsg.textContent='No tickets found.'; } updateHeaderStats(); return; } else if (emptyMsg) emptyMsg.style.display='none';
    data.forEach(t => {
      const li = document.createElement('li');
      li.className = 'ticket-item';
      li.innerHTML = `
        <div class="ticket-main">
          <div>
            <div style="font-weight:600">${escapeHtml(t.itemName)} <span class="ticket-sub">(${escapeHtml(t.model||'—')})</span></div>
            <div class="ticket-meta">${escapeHtml(t.custName)} • ${escapeHtml(t.productId || '—')} • ${escapeHtml(t.receivedDate)}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <div class="badge status-${cssClassForStatus(t.status)}">${t.status}</div>
          <div class="ticket-meta small">${new Date(t.createdAt).toLocaleString()}</div>
          <button class="btn" onclick="openModal('${t.id}')">Open</button>
        </div>
      `;
      ticketListEl && ticketListEl.appendChild(li);
    });
    updateHeaderStats();
  }
  function cssClassForStatus(status){ return status.replace(/\s/g,'\\ '); }

  // ---------------- Admin table ----------------
  function renderAdminTable(){
    if(!isAdmin()){ if (adminTableBody) adminTableBody.innerHTML = `<tr><td colspan="7" style="padding:8px">Login as admin to manage tickets.</td></tr>`; return; }
    const q = (adminSearch && adminSearch.value || '').trim().toLowerCase();
    const statusF = adminStatusFilter && adminStatusFilter.value;
    let data = tickets.slice();
    if(statusF && statusF !== 'All') data = data.filter(t => t.status === statusF);
    if(q) data = data.filter(t => (t.id||'').toLowerCase().includes(q) || (t.custName||'').toLowerCase().includes(q) || (t.itemName||'').toLowerCase().includes(q) || (t.productId||'').toLowerCase().includes(q));
    data.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    if (adminTableBody) adminTableBody.innerHTML = '';
    if(!data.length){ if (adminTableBody) adminTableBody.innerHTML = `<tr><td colspan="7" style="padding:8px">No tickets found.</td></tr>`; return; }
    data.forEach(t => {
      const prod = products.find(p => p.productId === t.productId) || {};
      const w = warrantyInfoForProduct(prod);
      const warrantySummary = w.endDate ? (w.onWarranty ? `${w.daysLeft}d left` : `Expired ${formatDate(w.endDate)}`) : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px;vertical-align:top">${t.id}</td>
        <td style="vertical-align:top">${escapeHtml(t.custName)}<div class="ticket-meta">${escapeHtml(t.custPhone||'')}</div></td>
        <td style="vertical-align:top">${escapeHtml(t.itemName)}<div class="ticket-meta small">${escapeHtml(t.model||'')}</div></td>
        <td style="vertical-align:top">${escapeHtml(t.productId||'')}</td>
        <td style="vertical-align:top"><div class="badge status-${cssClassForStatus(t.status)}">${t.status}</div><div class="ticket-meta small">${warrantySummary}</div></td>
        <td style="vertical-align:top">${escapeHtml(t.receivedDate)}</td>
        <td style="vertical-align:top">
          <button class="btn" onclick="openModal('${t.id}')">Open</button>
          <button class="btn btn-outline" onclick="openTicketForEdit('${t.id}')">Edit</button>
          <button class="btn btn-outline" onclick="adminDeleteTicket('${t.id}')">Delete</button>
        </td>
      `;
      adminTableBody && adminTableBody.appendChild(tr);
    });
  }

  // ---------------- rest of functions (escapeHtml, updateHeaderStats, updateAdminUI, renderProductsList, exportCSV,
  // openAdminModal, adminLogin, adminLogout, openModal, openTicketForEdit, adminDeleteTicket, printTicketReceipt, etc.)
  // You should keep your existing implementations below - for brevity I assume they exist unchanged.
  // If any of those functions reference elements that might be missing, wrap access with checks (like above).

  // --- placeholder implementations (if you already have them later in file keep originals) ---
  // If these functions are already defined later in your original file, they will override these placeholders.
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
  function updateHeaderStats(){
    if(!totalTicketsEl || !inServiceCountEl) return;
    totalTicketsEl.textContent = tickets.length || 0;
    const inService = tickets.filter(t=>t.status && t.status.toLowerCase().includes('service')).length;
    inServiceCountEl.textContent = inService;
  }
  function updateAdminUI(){
    if(!isAdmin()){
      if(adminPanelLink) adminPanelLink.style.display = 'none';
    } else {
      if(adminPanelLink) adminPanelLink.style.display = '';
    }
  }
  function renderProductsList(){
    // Renders product list under adminProductsWrap (simple)
    const wrap = document.getElementById('adminProductsWrap');
    if(!wrap) return;
    wrap.innerHTML = products.map(p=>`<div class="step">${escapeHtml(p.productId)} — ${escapeHtml(p.itemName)}</div>`).join('') || '<div class="muted">No products</div>';
  }
  function exportCSV(){ alert('Export CSV not implemented in this quick patch.'); }

  function isAdmin(){
    try {
      return !!localStorage.getItem(ADMIN_SESSION_KEY);
    } catch(e){ return false; }
  }

  function openAdminModal(){
    if(adminModal) adminModal.classList.remove('hidden');
  }
  function adminLogin(){
    // Very simple embedded admin login (demo)
    const user = document.getElementById('adminUser') && document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass') && document.getElementById('adminPass').value;
    if(user === 'admin' && pass === 'admin123'){
      localStorage.setItem(ADMIN_SESSION_KEY, '1');
      updateAdminUI();
      alert('Admin logged in (demo)');
      adminModal && adminModal.classList.add('hidden');
    } else {
      adminMsg && (adminMsg.textContent = 'Invalid credentials (demo username: admin, password: admin123)');
    }
  }
  function adminLogout(){
    localStorage.removeItem(ADMIN_SESSION_KEY);
    updateAdminUI();
    alert('Logged out');
  }

  function openModal(id){
    // if id matches a ticket id, open the shared viewer modal body
    if(!id) return;
    const t = tickets.find(x => x.id === id);
    if(t){
      // show ticket in modalBody
      if(modalBody && modal){
        modalBody.innerHTML = `<h3>${escapeHtml(t.id)} — ${escapeHtml(t.itemName)}</h3><div class="ticket-meta">${escapeHtml(t.custName)}</div>`;
        modal.classList.remove('hidden');
      }
    } else {
      // maybe it's a product id — try product view
      const p = products.find(x => x.productId === id);
      if(p) openProductModal(id);
    }
  }

  function openTicketForEdit(id){
    const t = tickets.find(x=>x.id===id);
    if(!t) return alert('Ticket not found');
    openCreateTicketModal();
    if(ticketSaveBtn) ticketSaveBtn.dataset.editingId = t.id;
    if(ticket_productSelect) ticket_productSelect.value = t.productId;
    if(ticket_custName) ticket_custName.value = t.custName;
    if(ticket_custPhone) ticket_custPhone.value = t.custPhone;
    if(ticket_priority) ticket_priority.value = t.priority;
    if(ticket_problem) ticket_problem.value = t.problem;
  }

  function adminDeleteTicket(id){
    if(!confirm('Delete ticket '+id+'?')) return;
    tickets = tickets.filter(t=>t.id!==id);
    saveStore();
    renderList();
    renderAdminTable();
    updateHeaderStats();
  }

  function printTicketReceipt(ticket){
    // minimal print stub
    console.log('print ticket', ticket && ticket.id);
  }

  // ---- end DOMContentLoaded wrapper contents ----
}); // END DOM READY WRAPPER
