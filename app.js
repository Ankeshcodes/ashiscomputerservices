// Improved app.js for Ashish Computer Services
// - All DOM access guarded
// - Wrapped in DOMContentLoaded
// - Robust modal handling, admin demo login, product & ticket storage in localStorage
// - Clear, small, well-commented functions for maintainability
console.log('app.js (improved) loaded');

document.addEventListener('DOMContentLoaded', () => {
  // === CONFIG ===
  const STORAGE_KEY = "warranty_v001_store_v2";
  const ADMIN_SESSION_KEY = "warranty_admin_session_modern";
  const DEMO_ADMIN_USER = "admin";
  const DEMO_ADMIN_PASS = "admin123";

  // === in-memory store ===
  let store = loadStore(); // { products: [], tickets: [] }
  let products = store.products || [];
  let tickets = store.tickets || [];

  // === DOM elements (guarded) ===
  const $ = id => document.getElementById(id);
  const quickTicketId = $('quickTicketId');
  const quickFind = $('quickFind');
  const statusOnlyBtn = $('statusOnlyBtn');

  const checkProduct = $('checkProduct');
  const checkSerial = $('checkSerial');
  const checkBtn = $('checkBtn');
  const checkResult = $('checkResult');

  const totalTicketsEl = $('totalTickets');
  const inServiceCountEl = $('inServiceCount');
  const ticketListEl = $('ticketList');
  const emptyMsg = $('emptyMsg');
  const searchInput = $('searchInput');
  const statusFilter = $('statusFilter');
  const sortBy = $('sortBy');
  const exportBtn = $('exportBtn');

  const adminPanelLink = $('adminPanelLink');
  const adminRegisterProductBtn = $('adminRegisterProductBtn');
  const adminCreateTicketBtn = $('adminCreateTicketBtn');
  const adminTableBody = $('adminTableBody');
  const adminSearch = $('adminSearch');
  const adminStatusFilter = $('adminStatusFilter');

  const adminBtn = $('adminBtn');
  const adminModal = $('adminModal');
  const adminSubmitBtn = $('adminSubmit');
  const adminLogoutBtn = $('adminLogout');
  const adminMsg = $('adminMsg');
  const adminUser = $('adminUser');
  const adminPass = $('adminPass');
  const adminPanel = $('adminDashboard');

  const regModal = $('adminRegisterProductModal');
  const reg_itemName = $('reg_itemName');
  const reg_serial = $('reg_serial');
  const reg_model = $('reg_model');
  const reg_billNo = $('reg_billNo');
  const reg_purchaseDate = $('reg_purchaseDate');
  const reg_warrantyMonths = $('reg_warrantyMonths');
  const regSaveBtn = $('regSaveBtn');
  const regCancelBtn = $('regCancelBtn');
  const regMsg = $('regMsg');

  const ticketModal = $('adminCreateTicketModal');
  const ticket_productSelect = $('ticket_productSelect');
  const ticket_custName = $('ticket_custName');
  const ticket_custPhone = $('ticket_custPhone');
  const ticket_priority = $('ticket_priority');
  const ticket_problem = $('ticket_problem');
  const ticketSaveBtn = $('ticketSaveBtn');
  const ticketCancelBtn = $('ticketCancelBtn');
  const ticketMsg = $('ticketMsg');

  const modal = $('modal');
  const modalBody = $('modalBody');
  const closeModalBtn = $('closeModal');
  const closeAdminBtn = $('closeAdmin');
  const closeRegisterProductBtn = $('closeRegisterProduct');
  const closeCreateTicketBtn = $('closeCreateTicket');

  // safe addEvent helper
  function safeAdd(el, ev, fn){
    if(el) el.addEventListener(ev, fn);
  }

  // === Event wiring ===
  safeAdd(quickFind, 'click', () => {
    const q = (quickTicketId && quickTicketId.value || "").trim();
    if(!q){ alert("Enter Ticket ID (e.g. T-...)"); return; }
    const t = tickets.find(x => x.id.toLowerCase() === q.toLowerCase());
    if(!t) return alert("Ticket not found");
    openModal(t.id);
  });

  safeAdd(checkBtn, 'click', () => {
    const p = (checkProduct && checkProduct.value || '').trim();
    const s = (checkSerial && checkSerial.value || '').trim();
    if(!p || !s){ if(checkResult) checkResult.textContent = "Please enter both product name and serial number."; return; }
    doWarrantyCheck(p, s);
  });

  safeAdd(searchInput, 'input', renderList);
  safeAdd(statusFilter, 'change', renderList);
  safeAdd(sortBy, 'change', renderList);
  safeAdd(exportBtn, 'click', exportCSV);

  safeAdd($('nav-check'), 'click', () => showSection('check'));
  safeAdd($('nav-status'), 'click', () => showSection('list'));
  safeAdd($('nav-contact'), 'click', () => alert("Contact: 8521450594\nGarhwa, Jharkhand"));

  safeAdd(adminBtn, 'click', openAdminModal);
  safeAdd(adminSubmitBtn, 'click', adminLogin);
  safeAdd(adminLogoutBtn, 'click', adminLogout);

  safeAdd(adminRegisterProductBtn, 'click', openRegisterProductModal);
  safeAdd(adminCreateTicketBtn, 'click', openCreateTicketModal);
  safeAdd(adminSearch, 'input', renderAdminTable);
  safeAdd(adminStatusFilter, 'change', renderAdminTable);

  safeAdd(regSaveBtn, 'click', onRegisterProduct);
  safeAdd(regCancelBtn, 'click', () => regModal && regModal.classList.add('hidden'));

  safeAdd(ticketSaveBtn, 'click', onCreateTicket);
  safeAdd(ticketCancelBtn, 'click', () => ticketModal && ticketModal.classList.add('hidden'));

  safeAdd(closeModalBtn, 'click', closeModal);
  safeAdd(closeAdminBtn, 'click', closeModal);
  safeAdd(closeRegisterProductBtn, 'click', () => regModal && regModal.classList.add('hidden'));
  safeAdd(closeCreateTicketBtn, 'click', () => ticketModal && ticketModal.classList.add('hidden'));

  // initial render
  renderList();
  renderAdminTable();
  renderProductsList();
  updateHeaderStats();
  updateAdminUI();

  // ------------------ Functions ------------------
  function closeModal(){
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }

  function loadStore(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { products: [], tickets: [] };
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return { products: [], tickets: parsed };
      return { products: parsed.products || [], tickets: parsed.tickets || [] };
    }catch(e){ return { products: [], tickets: [] }; }
  }
  function saveStore(){
    store.products = products;
    store.tickets = tickets;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function genProductId(){ return 'P-' + Date.now().toString(36).toUpperCase().slice(-6); }
  function genTicketId(){ return 'T-' + Date.now().toString(36).toUpperCase().slice(-8); }
  function nowISO(){ return new Date().toISOString(); }

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

  function doWarrantyCheck(productName, serial){
    const p = productName.trim().toLowerCase();
    const s = serial.trim().toLowerCase();
    const foundProd = products.find(prod =>
      (prod.itemName || '').toLowerCase() === p &&
      (prod.serial || '').toLowerCase() === s
    );
    if(!foundProd){
      if(checkResult) checkResult.textContent = "No product found for given name and serial. Please contact the service center.";
      return;
    }
    const relatedTickets = tickets.filter(t => t.productId === foundProd.productId);
    const latestTicket = relatedTickets.length ? relatedTickets[0] : null;
    const w = warrantyInfoForProduct(foundProd);
    let warrantyText = "";
    if(!w.endDate) warrantyText = "Warranty info not available";
    else if(w.onWarranty) warrantyText = `On warranty — ${w.daysLeft} day${w.daysLeft !== 1 ? 's' : ''} left (ends ${formatDate(w.endDate)})`;
    else warrantyText = `Out of warranty — Expired on ${formatDate(w.endDate)}`;

    if(checkResult){
      checkResult.innerHTML = `
        <div><strong>${escapeHtml(foundProd.itemName)}</strong> — ${escapeHtml(foundProd.productId)}</div>
        <div class="ticket-meta">Bill: ${escapeHtml(foundProd.billNo || '—')} • Purchase: ${escapeHtml(foundProd.purchaseDate || '—')}</div>
        <div style="margin-top:8px;color:#0b6;font-weight:600">${warrantyText}</div>
        <div style="margin-top:8px">${ latestTicket ? `Latest Ticket: <strong>${escapeHtml(latestTicket.id)}</strong> — Status: <span class="badge status-${cssClassForStatus(latestTicket.status)}">${escapeHtml(latestTicket.status)}</span>` : 'No tickets yet for this product.' }</div>
        <div style="margin-top:8px"><button class="btn" onclick="openProductModal('${foundProd.productId}')">View Product</button></div>
      `;
    }
  }

  function openProductModal(productId){
    const p = products.find(x => x.productId === productId);
    if(!p) return;
    const w = warrantyInfoForProduct(p);
    const warrantyText = !w.endDate ? 'Warranty info not available' : (w.onWarranty ? `On warranty — ${w.daysLeft} day${w.daysLeft!==1?'s':''} left (ends ${formatDate(w.endDate)})` : `Out of warranty — Expired on ${formatDate(w.endDate)}`);
    if(modalBody && modal){
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
      modal.classList.remove('hidden');
    }
  }

  function openRegisterProductModal(){
    if(!isAdmin()) return alert("Admin only");
    if(reg_itemName) reg_itemName.value = '';
    if(reg_serial) reg_serial.value = '';
    if(reg_model) reg_model.value = '';
    if(reg_billNo) reg_billNo.value = '';
    if(reg_purchaseDate) reg_purchaseDate.value = '';
    if(reg_warrantyMonths) reg_warrantyMonths.value = '';
    if(regMsg) regMsg.textContent = '';
    if(regModal) regModal.classList.remove('hidden');
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
    if(regMsg) regMsg.textContent = `Product registered: ${product.productId}`;
    setTimeout(() => { if(regModal) regModal.classList.add('hidden'); renderProductsList(); renderAdminTable(); updateHeaderStats(); }, 700);
  }

  function openCreateTicketModal(){
    if(!isAdmin()) return alert("Admin only");
    if(ticket_productSelect){
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
    setTimeout(()=>{ openModal(ticket.id); printTicketReceipt(ticket); }, 180);
  }

  function renderList(){
    if(!isAdmin()){
      if(ticketListEl) ticketListEl.innerHTML = '';
      if(emptyMsg){ emptyMsg.style.display = 'block'; emptyMsg.textContent = 'Login as admin to view the full ticket list.'; }
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
    if(ticketListEl) ticketListEl.innerHTML = '';
    if(!data.length){ if(emptyMsg){ emptyMsg.style.display='block'; emptyMsg.textContent='No tickets found.'; } updateHeaderStats(); return; } else if(emptyMsg) emptyMsg.style.display='none';
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
  function cssClassForStatus(status){ return String(status || '').replace(/\s/g,'\\ '); }

  function renderAdminTable(){
    if(!isAdmin()){ if(adminTableBody) adminTableBody.innerHTML = `<tr><td colspan="7" style="padding:8px">Login as admin to manage tickets.</td></tr>`; return; }
    const q = (adminSearch && adminSearch.value || '').trim().toLowerCase();
    const statusF = adminStatusFilter && adminStatusFilter.value;
    let data = tickets.slice();
    if(statusF && statusF !== 'All') data = data.filter(t => t.status === statusF);
    if(q) data = data.filter(t => (t.id||'').toLowerCase().includes(q) || (t.custName||'').toLowerCase().includes(q) || (t.itemName||'').toLowerCase().includes(q) || (t.productId||'').toLowerCase().includes(q));
    data.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    if(adminTableBody) adminTableBody.innerHTML = '';
    if(!data.length){ if(adminTableBody) adminTableBody.innerHTML = `<tr><td colspan="7" style="padding:8px">No tickets found.</td></tr>`; return; }
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

  function renderProductsList(){
    const wrap = $('adminProductsWrap');
    