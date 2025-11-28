// /js/app.js
// Full app script for Warranty Tracker V0.0.3
// - Firebase v10 modular SDK via CDN
// - Auth: signup, login, logout, password reset, email verification
// - Firestore: save, fetch, realtime
// - Auto UI bindings for pages: login.html, index.html, admin/dashboard.html
// --------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";

// -------------------------
// CONFIG: replace if needed
// (This uses the config you provided earlier)
// -------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCr_l5JAkOFtK0dBMpCNSlec8KRH7_Qm1g",
  authDomain: "acsweb-f27d4.firebaseapp.com",
  projectId: "acsweb-f27d4",
  storageBucket: "acsweb-f27d4.firebasestorage.app",
  messagingSenderId: "157168034124",
  appId: "1:157168034124:web:9085ebaa9ee63ca5eeafe9",
  measurementId: "G-Z4H2B6GJH5"
};

// Initialize
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firestore collection
const warrantiesRef = collection(db, "warranties");

// -------------------------
// AUTH UTILITIES (exported)
// -------------------------
export async function signup(email, password) {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  // send verification email
  await sendEmailVerification(res.user);
  return res;
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

export async function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// -------------------------
// WARRANTY FUNCTIONS
// -------------------------
export async function saveWarranty(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const payload = {
    productName: data.productName || "",
    serial: data.serial || "",
    purchaseDate: data.purchaseDate || "",
    notes: data.notes || "",
    ownerUid: user.uid,
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(warrantiesRef, payload);
  return docRef.id;
}

export async function getMyWarranties() {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(warrantiesRef, where("ownerUid", "==", user.uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function onMyWarrantiesChange(cb) {
  const user = auth.currentUser;
  if (!user) return () => {};
  const q = query(warrantiesRef, where("ownerUid", "==", user.uid));
  const unsub = onSnapshot(q, snapshot => {
    cb(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return unsub;
}

// -------------------------
// ADMIN PAGE PROTECT
// -------------------------
export function protectAdminPage(redirectTo = "/login.html") {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = redirectTo;
    }
  });
}

// -------------------------
// HELPERS
// -------------------------
export function readableDate(ts) {
  try {
    if (!ts) return "";
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    return new Date(ts.seconds * 1000).toLocaleDateString();
  } catch (e) {
    return "";
  }
}

// -------------------------
// UI BINDINGS - auto attach if elements exist on page
// This allows a single JS file to work across pages.
// -------------------------

// --- Login page bindings (login.html) ---
function bindLoginPage() {
  const emailEl = document.getElementById('email');
  const pwdEl = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const status = document.getElementById('status');
  const resetBtn = document.getElementById('resetBtn'); // optional
  const verifyNote = document.getElementById('verifyNote'); // optional

  if (!loginBtn && !signupBtn) return; // nothing to bind

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      status.textContent = 'Signing in...';
      try {
        await login(emailEl.value.trim(), pwdEl.value);
        status.textContent = 'Signed in ✅';
        // redirect to app
        setTimeout(() => location.href = '/index.html', 600);
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
      }
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', async () => {
      status.textContent = 'Creating account...';
      try {
        await signup(emailEl.value.trim(), pwdEl.value);
        status.textContent = 'Account created. Verification email sent. Check inbox.';
        if (verifyNote) verifyNote.classList.remove('hidden');
        setTimeout(() => location.href = '/index.html', 1200);
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const email = emailEl.value.trim();
      if (!email) { status.textContent = 'Enter email to reset'; return; }
      try {
        await sendResetEmail(email);
        status.textContent = 'Password reset sent to ' + email;
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
      }
    });
  }

  // show current auth status
  onAuthChange(user => {
    if (user) {
      status.textContent = `Logged in as ${user.email} ${user.emailVerified ? '(verified)' : '(not verified)'}`;
    } else {
      status.textContent = 'Not signed in';
    }
  });
}

// --- Index page bindings (index.html) ---
function bindIndexPage() {
  const goLogin = document.getElementById('goLogin');
  const adminBtn = document.getElementById('adminBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const saveBtn = document.getElementById('save');
  const list = document.getElementById('list');
  const saveStatus = document.getElementById('saveStatus');

  if (!goLogin && !saveBtn) return;

  if (goLogin) goLogin.addEventListener('click', () => location.href = '/login.html');
  if (adminBtn) adminBtn.addEventListener('click', () => location.href = '/admin/dashboard.html');
  if (signOutBtn) signOutBtn.addEventListener('click', async () => {
    await logout();
    location.reload();
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        saveStatus.textContent = 'Saving...';
        const p = document.getElementById('product').value.trim();
        const s = document.getElementById('serial').value.trim();
        const pd = document.getElementById('pdate').value;
        const notes = document.getElementById('notes').value.trim();

        await saveWarranty({ productName: p, serial: s, purchaseDate: pd, notes });
        saveStatus.textContent = 'Saved ✅';
        // clear
        document.getElementById('product').value = '';
        document.getElementById('serial').value = '';
        document.getElementById('pdate').value = '';
        document.getElementById('notes').value = '';
      } catch (e) {
        saveStatus.textContent = 'Error: ' + e.message;
      }
    });
  }

  // auth state handling: load list and subscribe realtime
  onAuthChange(async user => {
    if (user) {
      if (signOutBtn) signOutBtn.classList.remove('hidden');
      // initial fetch
      try {
        const arr = await getMyWarranties();
        renderList(arr, list);
      } catch (e) {
        list.innerHTML = 'Error loading warranties: ' + e.message;
      }
      // subscribe
      onMyWarrantiesChange(items => renderList(items, list));
    } else {
      if (signOutBtn) signOutBtn.classList.add('hidden');
      if (list) list.innerHTML = 'Please <a href="/login.html">login</a> to see your warranties.';
    }
  });

  function renderList(items, listEl) {
    if (!listEl) return;
    if (!items || items.length === 0) {
      listEl.innerHTML = 'No warranties yet.';
      return;
    }
    listEl.innerHTML = '';
    items.forEach(it => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(it.productName || '—')}</strong>
        <div class="small">Serial: ${escapeHtml(it.serial || '—')} • Purchased: ${escapeHtml(it.purchaseDate || readableDate(it.createdAt))}</div>
        <div class="small">${escapeHtml(it.notes || '')}</div>`;
      listEl.appendChild(el);
    });
  }
}

// --- Admin dashboard bindings (admin/dashboard.html) ---
function bindAdminPage() {
  const who = document.getElementById('who');
  const signOut = document.getElementById('signOut');
  const wlist = document.getElementById('wlist');

  if (!who && !wlist) return;

  // protect page right away
  protectAdminPage('/login.html');

  if (signOut) signOut.addEventListener('click', async () => {
    await logout();
    location.href = '/login.html';
  });

  onAuthChange(user => {
    if (user) {
      if (who) who.textContent = `Signed in as ${user.email} ${user.emailVerified ? '(verified)' : '(not verified)'}`;
      // subscribe and render
      onMyWarrantiesChange(items => render(items));
    } else {
      if (who) who.textContent = 'Not signed in';
    }
  });

  function render(items) {
    if (!wlist) return;
    if (!items || items.length === 0) { wlist.innerHTML = 'No warranties yet.'; return; }
    wlist.innerHTML = '';
    items.forEach(it => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(it.productName || '—')}</strong>
        <div class="small">Serial: ${escapeHtml(it.serial || '—')} • Purchased: ${escapeHtml(it.purchaseDate || readableDate(it.createdAt))}</div>
        <div class="small">${escapeHtml(it.notes || '')}</div>`;
      wlist.appendChild(el);
    });
  }
}

// -------------------------
// Simple XSS-avoid helper
// -------------------------
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// -------------------------
// Auto-detect page and bind
// -------------------------
function autoBind() {
  // Delay to ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindLoginPage();
      bindIndexPage();
      bindAdminPage();
    });
  } else {
    bindLoginPage();
    bindIndexPage();
    bindAdminPage();
  }
}

autoBind();

// -------------------------
// Export nothing else — all functions already exported above.
// -------------------------
