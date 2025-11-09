/**
 * scan.js
 * Logika Scanner dengan ZXing dan integrasi Poin Firebase
 */

import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from './firebase.js';

// --- INISIALISASI ZXing reader ---
const codeReader = new ZXing.BrowserMultiFormatReader();

// --- Database produk lokal (mengandung info gizi) ---
const productDatabase = {
  // Barcode 1
  '8992761132711': {
    name: 'Jus Apel Kemasan (250ml)',
    info: '<strong>Energi:</strong> 120 kkal | <strong>Gula:</strong> 28g | <strong>Lemak:</strong> 0g',
    warning: '⚠️ TINGGI GULA!',
    suggestion: '<strong>Saran Alternatif:</strong> Jus buah segar tanpa tambahan gula.',
    isProduct: true
  },
  // Barcode 2
  '8996001301031': {
    name: 'Cokelat Batang (50g)',
    info: '<strong>Energi:</strong> 250 kkal | <strong>Gula:</strong> 25g | <strong>Lemak:</strong> 15g',
    warning: '⚠️ TINGGI GULA & LEMAK!',
    suggestion: '<strong>Saran Alternatif:</strong> Dark chocolate (>70%) atau buah-buahan.',
    isProduct: true
  },
  // Barcode 3
  '070470478952': {
    name: 'Pocari Sweat (250g)',
    info: '<strong>Energi:</strong> 70 kkal | <strong>Gula:</strong> 17g | <strong>Protein:</strong> 0g',
    warning: '✅ PILIHAN BAIK!',
    suggestion: '<strong>Saran penyajian:</strong> Tambahkan buah segar untuk mempercepat pemulihan cairan tubuh.',
    isProduct: true
  },
  
  // Barcode/QR Code Khusus Aplikasi (Tidak Dapat Poin)
  'APP_BUKA_PROFIL': {
    name: 'Aksi Aplikasi: Buka Profil',
    info: '<strong>Status:</strong> Perintah "Buka Profil" diterima.',
    warning: '✅ PERINTAH DIJALANKAN',
    suggestion: '<strong>Info:</strong> Anda akan diarahkan ke halaman profil pengguna...',
    isProduct: false
  }
};

// --- Elemen DOM ---
const startBtn = document.getElementById('start-scan-btn');
const stopBtn = document.getElementById('stop-scan-btn');
const barcodeResultEl = document.getElementById('barcode-result');
const productInfoEl = document.getElementById('product-info');
const scanAlertsEl = document.getElementById('scan-alerts');

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

// --- Menambah poin ke Firestore ---
async function addPoinForScan() {
  if (!currentUser || !auth) {
    showScanAlert('Poin tidak ditambahkan', 'Login untuk mendapatkan poin.', 'warning');
    return;
  }
  // Logika poin... (Tetap sama)
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

// --- FUNGSI UTAMA: Tampilkan hasil & Proses Aksi ---
function displayProductInfo(item, codeText) {
  // 1. Tampilkan kode yang terdeteksi
  barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
  
  // 2. Tampilkan detail produk/aksi (mengisi div#product-info)
  productInfoEl.innerHTML = `
    <h4 style="text-align:center; color:#00796B; margin-top:6px;">${item.name}</h4>
    <div style="padding:12px; margin:10px auto; max-width:680px; border-radius:8px; border:1px solid #eef6ff; background:#fff;">
      ${item.info}
    </div>
    <p class="${item.warning.includes('TINGGI') ? 'text-danger' : 'text-success'}" style="font-weight:800; text-align:center;">${item.warning}</p>
    <p style="text-align:center; font-style:italic; margin-top:8px; color: #777;">${item.suggestion}</p>
  `;

  // 3. Logika Poin
  if (item.isProduct) {
    addPoinForScan(); // Beri poin jika itu adalah produk
  } 
}

// --- Logika bila hasil didapat (onScanSuccess) ---
function onScanSuccess(result) {
  const codeText = result.getText();
  const item = productDatabase[codeText];

  if (item) {
    // Jika kode DITEMUKAN di database
    displayProductInfo(item, codeText);
  } else {
    // Jika kode TIDAK DITEMUKAN
    barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
    productInfoEl.innerHTML = `<p style="text-align:center; margin-top:6px;">Kode (${codeText}) tidak ada di database lokal. Poin tetap diberikan.</p>`;
    // Beri poin untuk kode yang valid namun tidak terdaftar
    addPoinForScan();
  }

  // Hentikan scanner agar hasil tetap terlihat
  stopScanner(); 
}

// --- Kontrol scanner (dengan perbaikan error handling) ---
function startScanner() {
  barcodeResultEl.textContent = 'Mencari perangkat kamera...';
  productInfoEl.innerHTML = '';
  scanAlertsEl.innerHTML = '';

  codeReader.getVideoInputDevices()
    .then((videoInputDevices) => {
      if (videoInputDevices.length === 0) {
        showScanAlert('Kamera Tidak Ditemukan', 'Tidak ada perangkat kamera yang terdeteksi.', 'warning');
        barcodeResultEl.textContent = 'Gagal: Tidak ada kamera ditemukan.';
        return;
      }
      
      const preferredDeviceId = undefined; 
      
      codeReader.decodeFromVideoDevice(preferredDeviceId, 'video-scanner', (result, err) => {
        if (result) {
          onScanSuccess(result);
        }
        if (err && !(err instanceof ZXing.NotFoundException)) {
          console.error("Scanner Error:", err);
          barcodeResultEl.textContent = `Error: ${err.message}`;
          
          if (err.message && (err.message.toLowerCase().includes('permission') || err.message.toLowerCase().includes('notallowederror'))) {
            showScanAlert('Akses Kamera Ditolak!', 'Harap izinkan akses kamera pada browser Anda dan pastikan menggunakan HTTPS/localhost.', 'warning');
          }
        }
      });
      barcodeResultEl.textContent = 'Kamera aktif. Arahkan barcode atau QR Code...';
    })
    .catch((err) => {
      console.error('Error saat mencoba mengakses perangkat video:', err);
      barcodeResultEl.textContent = `Gagal membuka kamera: ${err.name} - ${err.message}`;
      if (err.name === 'NotAllowedError') {
         showScanAlert('Izin Kamera Ditolak!', 'Harap izinkan akses kamera pada browser Anda dan pastikan menggunakan HTTPS/localhost.', 'warning');
      }
    });
}

function stopScanner() {
  if (codeReader) {
    try { 
      codeReader.reset();
    } catch(e){ /* abaikan error reset */ }
  }
  barcodeResultEl.textContent = 'Status: Kamera tidak aktif.';
  productInfoEl.innerHTML = '';
}

// --- Event listeners ---
window.addEventListener('load', () => {
  startBtn.addEventListener('click', startScanner);
  stopBtn.addEventListener('click', stopScanner);
});
