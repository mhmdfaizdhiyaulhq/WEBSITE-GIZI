// Import "alat" yang kita perlukan dari Firebase
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc } from './firebase.js';

// Variabel scanner kita letakkan di scope atas agar bisa diakses
let html5QrcodeScanner;

// --- (Fungsi-fungsi helper) ---

// Fungsi yang dipanggil saat scan berhasil
function onScanSuccess(decodedText, decodedResult) {
  // Hentikan scanner
  if (html5QrcodeScanner) {
    // Panggil .clear() di dalam try...catch untuk menghindari error jika scanner sudah hilang
    try {
      html5QrcodeScanner.clear();
    } catch (e) {
      console.warn("Gagal membersihkan scanner, mungkin sudah dibersihkan.", e);
    }
  }
  // Cari info gizi
  cariInfoGizi(decodedText);
}

// Helper function untuk membuat 1 baris fakta gizi
function createNutriItem(name, value, unit = 'g') {
  if (!value || parseFloat(value) === 0) {
    return ''; 
  }
  return `
    <li class="list-group-item nutrition-item">
      <span><i class="bi bi-dot"></i> ${name}</span>
      <span class="nutrition-value">${value} ${unit}</span>
    </li>
  `;
}

// Fungsi untuk memanggil API dan menampilkan hasil
async function cariInfoGizi(barcode) {
  const hasilElement = document.getElementById('scan-results');
  
  hasilElement.innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Mencari data untuk ${barcode}...</p>
    </div>
  `;

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1) {
      const product = data.product;
      const gizi = product.nutriments;
      const imageUrl = product.image_front_small_url || 'https://via.placeholder.com/80x80.png?text=No+Image';

      hasilElement.innerHTML = `
        <div class="card nutrition-card">
          <div class="card-header nutrition-header">
            <div class="d-flex align-items-center">
              <img src="${imageUrl}" alt="${product.product_name}" class="me-3">
              <h5>${product.product_name || 'Nama Produk Tidak Dikenal'}</h5>
            </div>
          </div>
          <div class="card-body">
            <h6 class="mb-3">Informasi Gizi (per 100g)</h6>
            <ul class="list-group list-group-flush nutrition-facts">
              ${createNutriItem('Kalori', gizi['energy-kcal_100g'], 'kcal')}
              ${createNutriItem('Lemak', gizi.fat_100g, 'g')}
              ${createNutriItem('Karbohidrat', gizi.carbohydrates_100g, 'g')}
              ${createNutriItem('Gula', gizi.sugars_100g, 'g')} 
              ${createNutriItem('Protein', gizi.proteins_100g, 'g')}
              ${createNutriItem('Garam', gizi.salt_100g, 'g')}
            </ul>
          </div>
        </div>
      `;
      
      // Panggil fungsi untuk menambahkan poin
      addPoinForScan();

    } else {
      hasilElement.innerHTML = `
        <div class="alert alert-warning" role="alert">
          <h4 class="alert-heading">Produk Tidak Ditemukan</h4>
          <p>Maaf, produk dengan barcode <strong>${barcode}</strong> tidak ada di database kami.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    hasilElement.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <strong>Oops!</strong> Terjadi kesalahan saat mengambil data. Silakan coba lagi.
      </div>
    `;
  }
}

// --- (Fungsi-fungsi untuk poin) ---
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
    console.log("Pengguna tidak login, tidak ada poin ditambahkan.");
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

      showScanAlert(`+${POIN_DAPAT} Poin!`, `Anda berhasil scan produk dan mendapat ${POIN_DAPAT} poin.`);
    }
  } catch (error) {
    console.error("Error menambah poin untuk scan:", error);
  }
}

function showScanAlert(title, message) {
  const hasilElement = document.getElementById('scan-results');
  
  const alertHTML = `
    <div class="alert alert-success alert-dismissible fade show" role="alert">
      <strong>${title}</strong> ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
  
  hasilElement.insertAdjacentHTML('afterbegin', alertHTML);
}


// ▼▼▼ INI ADALAH PERBAIKANNYA ▼▼▼

// Kita buat fungsi untuk menyalakan scanner
function startScanner() {
  // Cek apakah library 'Html5QrcodeScanner' sudah dimuat oleh browser
  if (typeof window.Html5QrcodeScanner !== 'undefined') { 
    
    html5QrcodeScanner = new window.Html5QrcodeScanner(
      "reader", 
      { 
        fps: 10, 
        qrbox: 250 
      }
    );
    html5QrcodeScanner.render(onScanSuccess);
    
  } else {
    // Ini terjadi jika script library gagal dimuat
    console.error("Html5QrcodeScanner library is not loaded!");
    alert("Error: Gagal memuat library scanner. Coba refresh halaman.");
  }
}

// Ganti 'DOMContentLoaded' menjadi 'load'
// 'load' akan menunggu SEMUA file (termasuk script eksternal) selesai dimuat
window.addEventListener("load", () => {
  startScanner();
});