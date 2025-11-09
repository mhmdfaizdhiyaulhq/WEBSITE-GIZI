/**
 * scan.js (Diperbaiki: Dengan Penundaan, Manajemen Tampilan Video, dan Debugging String)
 */

import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from './firebase.js';

// --- ZXing reader (global via script tag) ---
let codeReader = null;

// --- Database produk lokal (contoh) ---
const productDatabase = {
  // PASTIKAN SEMUA KUNCI BARCODE DI SINI HANYA BERISI ANGKA
  '8992761132711': {
    name: 'Jus Apel Kemasan (250ml)',
    info: '<strong>Energi:</strong> 120 kkal | <strong>Gula:</strong> 28g | <strong>Lemak:</strong> 0g',
    warning: '⚠️ TINGGI GULA!',
    suggestion: '<strong>Saran Alternatif:</strong> Jus buah segar tanpa tambahan gula.',
    isProduct: true
  },
  '8996001301031': {
    name: 'Cokelat Batang (50g)',
    info: '<strong>Energi:</strong> 250 kkal | <strong>Gula:</strong> 25g | <strong>Lemak:</strong> 15g',
    warning: '⚠️ TINGGI GULA & LEMAK!',
    suggestion: '<strong>Saran Alternatif:</strong> Dark chocolate (>70%) atau buah-buahan.',
    isProduct: true
  },
  '070470478952': {
    name: 'Pocari Sweat (250g)',
    info: '<strong>Energi:</strong> 70 kkal | <strong>Gula:</strong> 17g | <strong>Protein:</strong> 0g',
    warning: '✅ PILIHAN BAIK!',
    suggestion: '<strong>Saran penyajian:</strong> Tambahkan buah segar untuk mempercepat pemulihan cairan tubuh.',
    isProduct: true
  },
  'APP_BUKA_PROFIL': {
    name: 'Aksi: Buka Profil',
    info: '<strong>Status:</strong> Perintah buka profil diterima.',
    warning: '✅ PERINTAH DIJALANKAN',
    suggestion: 'Anda akan diarahkan ke halaman profil.',
    isProduct: false
  },
  'APP_LOGIN_USER_123': {
    name: 'Aksi: Login User 123',
    info: '<strong>Status:</strong> Login berhasil untuk User 123.',
    warning: '✅ LOGIN BERHASIL',
    suggestion: 'Selamat datang kembali!',
    isProduct: false
  }
};

// --- Elemen DOM ---
const startBtn = document.getElementById('start-scan-btn');
const stopBtn = document.getElementById('stop-scan-btn');
const barcodeResultEl = document.getElementById('barcode-result');
const productInfoEl = document.getElementById('product-info');
const scanAlertsEl = document.getElementById('scan-alerts');
const videoEl = document.getElementById('video-scanner'); // Ambil elemen video

// --- Auth state ---
let currentUser = null;
if (typeof onAuthStateChanged === 'function') {
  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
  });
}

// --- Helper: tampilkan alert singkat ---
function showScanAlert(title, message, type='success') {
  const div = document.createElement('div');
  div.className = 'alert alert-dismissible fade show scan-alert ' + (type === 'success' ? 'alert-success' : 'alert-warning');
  div.innerHTML = `<strong>${title}</strong> — ${message}`;
  scanAlertsEl.innerHTML = ''; 
  scanAlertsEl.appendChild(div);

  setTimeout(()=> {
    if (scanAlertsEl.contains(div)) scanAlertsEl.removeChild(div);
  }, 3500);
}

// --- Menambah poin ke Firestore (jika ada) ---
async function addPoinForScan() {
  if (!currentUser || !auth) {
    showScanAlert('Poin tidak ditambahkan', 'Login untuk mendapatkan poin.', 'warning');
    return;
  }

  try {
    const POIN_DAPAT = 5;
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    let poinSekarang = 0;
    if (userDoc.exists()) poinSekarang = userDoc.data().poin || 0;

    const poinBaru = poinSekarang + POIN_DAPAT;
    await setDoc(userDocRef, { poin: poinBaru }, { merge: true });

    showScanAlert('Poin +5', `Anda mendapat ${POIN_DAPAT} poin. Total: ${poinBaru}.`, 'success');
  } catch (err) {
    console.error('Gagal update poin:', err);
    showScanAlert('Error', 'Gagal menambahkan poin (cek console).', 'warning');
  }
}

// --- Tampilkan hasil ---
function displayProductInfo(item, codeText) {
  barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
  productInfoEl.innerHTML = `
    <h4 style="text-align:center; color:#00796B; margin-top:6px;">${item.name}</h4>
    <div style="padding:12px; margin:10px auto; max-width:680px; border-radius:8px; border:1px solid #eef6ff; background:#fff;">
      ${item.info}
    </div>
    <p class="${item.warning.includes('TINGGI') ? 'text-danger' : 'text-success'}" style="font-weight:800; text-align:center;">${item.warning}</p>
    <p style="text-align:center; font-style:italic; margin-top:8px; color: #777;">${item.suggestion}</p>
  `;

  if (item.isProduct) {
    addPoinForScan();
  }
}

// --- Logika bila hasil didapat ---
function onScanSuccess(result) {
  
  // Memformat kode: Menghilangkan spasi dan memastikan tipe string
  const rawCode = result.getText();
  const codeText = String(rawCode).trim(); 
  
  const item = productDatabase[codeText];

  if (item) {
    displayProductInfo(item, codeText);
  } else {
    // KODE TIDAK DITEMUKAN: Tampilkan pesan debug di Console
    
    const codeArray = Array.from(codeText).map(c => c.charCodeAt(0));
    console.error(`KODE TIDAK COCOK. Kode yang Terdeteksi: "${codeText}"`);
    console.error(`Representasi Karakter (ASCII/Unicode):`, codeArray);
    console.error(`Kunci Database Tersedia (untuk perbandingan):`, Object.keys(productDatabase));
    
    barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
    productInfoEl.innerHTML = `<p style="text-align:center; margin-top:6px;">Kode (${codeText}) tidak ada di database lokal. Harap periksa Console untuk karakter tersembunyi yang mungkin menyebabkan kegagalan pencarian.</p>`;
    addPoinForScan();
  }

  // Tunda pemanggilan stopScanner untuk memastikan hasil terlihat
  setTimeout(() => {
    stopScanner(true); 
    videoEl.style.display = 'none'; 
    startBtn.disabled = false; 
  }, 500); 
}

// --- Kontrol scanner ---
function stopScanner(preserveResult = false) {
  if (codeReader) {
    try { codeReader.reset(); } catch(e){ /* ignore */ }
  }
  
  // HANYA HAPUS HASIL jika preserveResult adalah false
  if (!preserveResult) {
    barcodeResultEl.textContent = 'Status: Kamera tidak aktif.';
    productInfoEl.innerHTML = '';
    videoEl.style.display = 'none'; 
  }
}

function startScanner() {
  // Tampilkan video saat memulai scan
  videoEl.style.display = 'block'; 
  barcodeResultEl.textContent = 'Mencari perangkat kamera...';
  productInfoEl.innerHTML = '';
  startBtn.disabled = true; 

  try {
    if (!codeReader) codeReader = new ZXing.BrowserMultiFormatReader();
    codeReader.decodeFromVideoDevice(undefined, 'video-scanner', (result, err) => {
      if (result) {
        onScanSuccess(result);
      }
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error(err);
        barcodeResultEl.textContent = `Error: ${err.message}`;
        if (err.message && err.message.toLowerCase().includes('permission')) {
          showScanAlert('Izin Kamera Tidak Diberikan', 'Periksa pengaturan izin kamera pada browser Anda.', 'warning');
        }
      }
    });
    barcodeResultEl.textContent = 'Arahkan barcode atau QR Code ke kamera...';
  } catch (e) {
    console.error('Gagal mulai scanner:', e);
    barcodeResultEl.textContent = 'Gagal membuka kamera. Cek console.';
    startBtn.disabled = false; 
  }
}

// --- Event listeners ---
window.addEventListener('load', () => {
  // Sembunyikan video secara default saat halaman dimuat
  videoEl.style.display = 'none'; 
  
  startBtn.addEventListener('click', startScanner);
  
  // Tombol stop akan mereset tampilan dan mengaktifkan tombol start
  stopBtn.addEventListener('click', () => {
      stopScanner(false);
      startBtn.disabled = false; 
  }); 
});
