// Import "alat" yang kita perlukan dari Firebase
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from './firebase.js';

// --- (Database Produk & Aksi Cerdas - Diambil dari contoh Anda) ---
const productDatabase = {
  // --- BARCODE PRODUK ---
  '8992761132711': { // Jus Apel kemasan
    name: 'Jus Apel Kemasan (250ml)',
    info: '<strong>Energi:</strong> 120 kkal | <strong>Gula:</strong> 28g | <strong>Lemak:</strong> 0g',
    warning: '⚠️ TINGGI GULA!',
    suggestion: '<strong>Saran Alternatif:</strong> Jus buah segar tanpa tambahan gula.',
    isProduct: true
  },
  '8996001301031': { // Cokelat Batang
    name: 'Cokelat Batang (50g)',
    info: '<strong>Energi:</strong> 250 kkal | <strong>Gula:</strong> 25g | <strong>Lemak:</strong> 15g',
    warning: '⚠️ TINGGI GULA & LEMAK!',
    suggestion: '<strong>Saran Alternatif:</strong> Dark chocolate (>70%) atau buah-buahan.',
    isProduct: true
  },
  '070470478952': { // Pocari Sweat
    name: 'Pocari Sweat (250g)',
    info: '<strong>Energi:</strong> 70 kkal | <strong>Gula:</strong> 17g | <strong>Protein:</strong> 0g',
    warning: '✅ PILIHAN BAIK!',
    suggestion: '<strong>Saran penyajian:</strong> Tambahkan buah segar untuk mempercepat pemulihan cairan tubuh.',
    isProduct: true
  },
  // --- QR CODE KHUSUS APLIKASI ---
  'APP_BUKA_PROFIL': {
    name: 'Aksi Aplikasi: Buka Profil',
    info: '<strong>Status:</strong> Perintah "Buka Profil" diterima.',
    warning: '✅ PERINTAH DIJALANKAN',
    suggestion: '<strong>Info:</strong> Anda akan diarahkan ke halaman profil pengguna...',
    isProduct: false
  },
  'APP_LOGIN_USER_123': {
    name: 'Aksi Aplikasi: Login',
    info: '<strong>Status:</strong> Melakukan login untuk User 123.',
    warning: '✅ LOGIN BERHASIL',
    suggestion: '<strong>Info:</strong> Selamat datang kembali!',
    isProduct: false
  }
};

// --- (Variabel Global ZXing & Elemen) ---
let codeReader = null; 
const hasilElement = document.getElementById('scan-results');
const barcodeResultEl = document.getElementById('barcode-result');
const productInfoEl = document.getElementById('product-info');
const startBtn = document.getElementById('start-scan-btn');
const stopBtn = document.getElementById('stop-scan-btn');

// --- (Fungsi-fungsi Helper Poin - Dipertahankan dari file lama) ---
let currentUser = null; 
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user; 
  } else {
    currentUser = null; 
  }
});

async function addPoinForScan() {
  if (!currentUser) {
    showScanAlert('Gagal Tambah Poin', 'Login untuk mendapatkan Poin!', 'alert-warning');
    return;
  }
  
  try {
    const POIN_DAPAT = 5; 
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const poinSekarang = userDoc.data().poin || 0;
      const poinBaru = poinSekarang + POIN_DAPAT;
      
      await setDoc(userDocRef, { poin: poinBaru }, { merge: true });

      showScanAlert(`+${POIN_DAPAT} Poin!`, `Anda berhasil scan dan mendapat ${POIN_DAPAT} poin.`, 'alert-success');
    }
  } catch (error) {
    console.error("Error menambah poin untuk scan:", error);
  }
}

function showScanAlert(title, message, className) {
  // Membersihkan alert lama
  const oldAlert = document.querySelector('.scan-alert-temp');
  if (oldAlert) oldAlert.remove();
  
  const alertHTML = `
    <div class="alert ${className} alert-dismissible fade show scan-alert-temp" role="alert" style="max-width: 500px; margin: 10px auto;">
      <strong>${title}</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  hasilElement.insertAdjacentHTML('beforebegin', alertHTML);
}

// --- (Fungsi Baru: Tampilkan Hasil) ---
function displayResultInfo(codeText, item) {
    
    // Tampilkan Kode yang Terdeteksi
    barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
    
    productInfoEl.innerHTML = `
        <h4 class="text-center mt-3" style="color: #00796B;">${item.name}</h4>
        <div class="my-3 p-3 border rounded text-center">
            ${item.info}
        </div>
        <p class="text-center lead" style="font-weight: 700; color: ${item.warning.includes('TINGGI') ? '#d9534f' : '#00796B'};">${item.warning}</p>
        <p class="text-center mt-2" style="font-style:italic; font-size: 0.9rem;">${item.suggestion}</p>
    `;

    // Jika kode yang terdeteksi adalah produk, tambahkan poin
    if (item.isProduct) {
        addPoinForScan();
    }
    
    // Hentikan scanner agar hasil tetap terlihat
    stopScanner(); 
}

// --- (Fungsi Utama: Logic Scan) ---
function onScanSuccess(result) {
    const codeText = result.getText();
    const item = productDatabase[codeText];

    if (item) {
        // Kode Cerdas: Dikenal, tampilkan info
        displayResultInfo(codeText, item);
    } else {
        // Kode tidak dikenal
        barcodeResultEl.textContent = `Kode Terdeteksi: ${codeText}`;
        productInfoEl.innerHTML = `<p class="text-center mt-3">Kode ini (${codeText}) tidak dikenali di database kami. ${codeText.length > 13 ? 'Mungkin ini QR Code/data yang belum terdaftar.' : 'Mencari data produk umum...'}</p>`;
        
        // Pilihan: Jika tidak ditemukan di database lokal, Anda bisa fallback ke API OpenFoodFacts (seperti di kode lama Anda) di sini.
        // Untuk saat ini, kita anggap hanya database lokal yang digunakan.
        
        // Tetap berikan poin untuk scan (walau produk tidak dikenal), agar pengguna tetap mendapat reward.
        addPoinForScan();
        stopScanner();
    }
}

// --- (Kontrol Scanner) ---
function startScanner() {
    barcodeResultEl.textContent = 'Mencari perangkat kamera...';
    productInfoEl.innerHTML = '';
    
    if (!codeReader) {
        // Inisialisasi hanya sekali
        codeReader = new ZXing.BrowserMultiFormatReader();
    }
    
    // Mulai pemindaian
    codeReader.decodeFromVideoDevice(undefined, 'video-scanner', (result, err) => {
        if (result) {
            onScanSuccess(result);
        }
        
        // Perbaiki tampilan jika error (selain NotFoundException)
        if (err && !(err instanceof ZXing.NotFoundException)) {
            console.error(err);
            barcodeResultEl.textContent = `Error: ${err.message}. ${err.message.includes('permission') ? 'Cek izin kamera browser!' : ''}`;
        }
    });

    barcodeResultEl.textContent = 'Arahkan barcode atau QR Code ke kamera...';
}

function stopScanner() {
    if (codeReader) {
        codeReader.reset(); // Menghentikan kamera dan proses scan
    }
    barcodeResultEl.textContent = 'Status: Kamera tidak aktif.';
    productInfoEl.innerHTML = ''; // Membersihkan hasil
}

// --- (Event Listeners) ---
window.addEventListener("load", () => {
    // Tambahkan event untuk tombol Start dan Stop
    startBtn.addEventListener('click', startScanner);
    stopBtn.addEventListener('click', stopScanner);

    // Otomatis mulai scan saat halaman dimuat (opsional, tapi disarankan)
    // startScanner();
});