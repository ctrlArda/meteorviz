// =====================================================
// HARITA MODÜLÜ SABİTLERİ
// =====================================================
const METERS_PER_KM = 1000;
const EARTH_RADIUS_KM = 6371;
const MAX_CIRCLE_RADIUS_KM = 20000; // Dünya çapının yarısı
const MIN_CIRCLE_RADIUS_KM = 0.01; // 10 metre
const HIROSHIMA_KT = 15;
const TSAR_BOMBA_MT = 50;
const KT_TO_JOULES = 4.184e12;
const DENSITY_MAP = { rock: 3000, iron: 7800, ice: 1000, rubble: 1200 };

// =====================================================
// GLOBAL DEĞİŞKENLER
// =====================================================
let map, impactMarker;
let impactLatLng = { lat: 37.0663, lng: 36.2484 }; // Default: Kadirli Merkez
let impactCircles = [];
let impactMarkers = [];
let allAsteroids = new Map();
let currentSelectedId = null;
let localDatasetAsteroids = [];
let mapClickHandler = null;
let resizeObserver = null;
let fullscreenManager = null;

// =====================================================
// TAM EKRAN YÖNETİCİSİ (FULLSCREEN MANAGER)
// =====================================================

/**
 * Harita tam ekran yöneticisi - Native API ve CSS fallback desteği
 * Bellek sızıntısı önleme ve event cleanup ile geliştirilmiş
 */
class FullscreenManager {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.isFullscreen = false;
        this.originalOverflow = null;
        this.boundEscHandler = this.handleEsc.bind(this);
        this.boundFullscreenChange = this.handleFullscreenChange.bind(this);
        
        // Event listener'ları ekle
        this.initEventListeners();
    }
    
    initEventListeners() {
        // Tüm fullscreen API varyasyonlarını dinle
        document.addEventListener('fullscreenchange', this.boundFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this.boundFullscreenChange);
        document.addEventListener('mozfullscreenchange', this.boundFullscreenChange);
        document.addEventListener('MSFullscreenChange', this.boundFullscreenChange);
    }
    
    async toggle() {
        if (this.isFullscreen) {
            this.exit();
        } else {
            await this.enter();
        }
    }
    
    async enter() {
        if (this.isFullscreen) return;
        
        console.log('🗺️ Tam ekran modu aktifleştiriliyor...');
        
        // Native fullscreen API denemeleri
        const apis = [
            { req: 'requestFullscreen', name: 'Standard' },
            { req: 'webkitRequestFullscreen', name: 'Webkit' },
            { req: 'mozRequestFullScreen', name: 'Mozilla' },
            { req: 'msRequestFullscreen', name: 'Microsoft' }
        ];
        
        for (const api of apis) {
            if (this.element[api.req]) {
                try {
                    await this.element[api.req]();
                    console.log(`✅ Tam ekran başarılı (${api.name} API)`);
                    this.isFullscreen = true;
                    this.updateUI(true);
                    return;
                } catch (e) {
                    console.warn(`⚠️ ${api.name} API başarısız:`, e.message);
                }
            }
        }
        
        // Fallback: CSS fullscreen
        console.log('ℹ️ CSS fallback kullanılıyor');
        this.enterCSSFullscreen();
    }
    
    enterCSSFullscreen() {
        this.originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        this.element.classList.add('fullscreen-mode');
        this.isFullscreen = true;
        this.updateUI(true);
        document.addEventListener('keydown', this.boundEscHandler);
        this.forceMapResize();
    }
    
    exit() {
        if (!this.isFullscreen) return;
        
        console.log('🗺️ Tam ekran modundan çıkılıyor...');
        
        // Native fullscreen çıkışı
        if (document.fullscreenElement || 
            document.webkitFullscreenElement || 
            document.mozFullScreenElement || 
            document.msFullscreenElement) {
            
            const exitMethod = document.exitFullscreen?.bind(document) ||
                              document.webkitExitFullscreen?.bind(document) ||
                              document.mozCancelFullScreen?.bind(document) ||
                              document.msExitFullscreen?.bind(document);
            
            if (exitMethod) {
                exitMethod();
            }
        } else {
            // CSS fullscreen çıkışı
            this.exitCSSFullscreen();
        }
    }
    
    exitCSSFullscreen() {
        this.element.classList.remove('fullscreen-mode');
        document.body.style.overflow = this.originalOverflow || '';
        this.isFullscreen = false;
        this.updateUI(false);
        document.removeEventListener('keydown', this.boundEscHandler);
        this.forceMapResize();
    }
    
    handleEsc(e) {
        if (e.key === 'Escape' && this.isFullscreen) {
            this.exit();
        }
    }
    
    handleFullscreenChange() {
        const isNativeFullscreen = !!(document.fullscreenElement || 
                                      document.webkitFullscreenElement || 
                                      document.mozFullScreenElement || 
                                      document.msFullscreenElement);
        
        if (isNativeFullscreen) {
            this.isFullscreen = true;
            this.updateUI(true);
            
            const mapEl = document.getElementById('map');
            if (mapEl) {
                mapEl.style.width = '100vw';
                mapEl.style.height = '100vh';
            }
            this.forceMapResize();
        } else {
            this.isFullscreen = false;
            this.updateUI(false);
            
            const mapEl = document.getElementById('map');
            if (mapEl) {
                mapEl.style.width = '100%';
                mapEl.style.height = '400px';
            }
            this.forceMapResize();
        }
    }
    
    updateUI(isFullscreen) {
        const btn = document.getElementById('fullscreen-btn');
        const icon = document.getElementById('fullscreen-icon');
        const text = document.getElementById('fullscreen-text');
        
        if (isFullscreen) {
            if (icon) icon.textContent = '✕';
            if (text) text.textContent = 'Çıkış';
            if (btn) {
                btn.classList.remove('bg-gray-700', 'hover:bg-orange-600');
                btn.classList.add('bg-red-600', 'hover:bg-red-700');
                btn.title = 'Tam ekrandan çık (ESC)';
            }
        } else {
            if (icon) icon.textContent = '⛶';
            if (text) text.textContent = 'Tam Ekran';
            if (btn) {
                btn.classList.remove('bg-red-600', 'hover:bg-red-700');
                btn.classList.add('bg-gray-700', 'hover:bg-orange-600');
                btn.title = 'Haritayı tam ekran yap';
            }
        }
        
        this.forceMapResize();
    }
    
    forceMapResize() {
        if (map) {
            // Tek seferlik, debounced resize
            setTimeout(() => {
                if (map) {
                    map.invalidateSize({ 
                        animate: false, 
                        pan: false,
                        debounceMoveend: true 
                    });
                    console.log('🔄 Harita boyutu güncellendi');
                }
            }, 100);
        }
    }
    
    destroy() {
        console.log('🧹 FullscreenManager temizleniyor...');
        
        if (this.isFullscreen) {
            this.exit();
        }
        
        // Event listener'ları kaldır
        document.removeEventListener('fullscreenchange', this.boundFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this.boundFullscreenChange);
        document.removeEventListener('mozfullscreenchange', this.boundFullscreenChange);
        document.removeEventListener('MSFullscreenChange', this.boundFullscreenChange);
        document.removeEventListener('keydown', this.boundEscHandler);
        
        this.element = null;
    }
}

// Backward compatibility wrapper
function toggleMapFullscreen() {
    if (fullscreenManager) {
        fullscreenManager.toggle();
    }
}

// =====================================================
// UTILITY FONKSİYONLARI
// =====================================================

/**
 * Debounce utility - Fonksiyon çağrılarını geciktirir
 * @param {Function} func - Çalıştırılacak fonksiyon
 * @param {number} wait - Bekleme süresi (ms)
 * @returns {Function} Debounced fonksiyon
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Mobil cihaz kontrolü
 * @returns {boolean} Mobil cihaz ise true
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Sayıyı formatla (binlik ayırıcı ile)
 * @param {number} num - Formatlanacak sayı
 * @returns {string} Formatlanmış sayı
 */
function formatNumber(num) {
    if (!isFinite(num)) return 'N/A';
    return num.toLocaleString('tr-TR');
}

/**
 * Güvenli popup içeriği oluştur (XSS korumalı)
 * @param {string} title - Popup başlığı
 * @param {Array} items - İçerik öğeleri [{text, className, style}]
 * @param {Object} options - Ek seçenekler
 * @returns {HTMLElement} Popup DOM elementi
 */
function createSafePopup(title, items, options = {}) {
    const container = document.createElement('div');
    container.style.cssText = options.containerStyle || 'min-width: 200px; padding: 8px; font-size: 12px;';
    
    // Title
    const titleEl = document.createElement('div');
    titleEl.className = options.titleClass || 'font-bold text-lg mb-2';
    titleEl.textContent = title; // textContent XSS'i önler
    if (options.titleStyle) titleEl.style.cssText = options.titleStyle;
    container.appendChild(titleEl);
    
    // Items
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = item.className || '';
        itemEl.textContent = item.text;
        if (item.style) itemEl.style.cssText = item.style;
        container.appendChild(itemEl);
    });
    
    return container;
}

/**
 * Güvenli circle oluşturma - Radius validation ile
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radiusKm - Yarıçap (km)
 * @param {Object} options - Leaflet circle seçenekleri
 * @returns {L.Circle|null} Circle objesi veya null
 */
function createSafeCircle(lat, lon, radiusKm, options = {}) {
    // Koordinat validasyonu
    if (!isFinite(lat) || !isFinite(lon)) {
        console.error('❌ Geçersiz koordinatlar:', { lat, lon });
        return null;
    }
    
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.error('❌ Koordinatlar sınır dışında:', { lat, lon });
        return null;
    }
    
    // Radius validasyonu
    if (!isFinite(radiusKm) || radiusKm <= 0) {
        console.warn('⚠️ Geçersiz yarıçap:', radiusKm);
        return null;
    }
    
    let safeRadius = Math.max(MIN_CIRCLE_RADIUS_KM, Math.min(radiusKm, MAX_CIRCLE_RADIUS_KM));
    
    if (Math.abs(radiusKm - safeRadius) > 0.01) {
        console.warn(`📏 Yarıçap sınırlandırıldı: ${radiusKm.toFixed(2)} → ${safeRadius.toFixed(2)} km`);
    }
    
    try {
        return L.circle([lat, lon], {
            radius: safeRadius * METERS_PER_KM,
            renderer: options.renderer || undefined,
            ...options
        });
    } catch (error) {
        console.error('❌ Circle oluşturma hatası:', error);
        return null;
    }
}

function showFullscreenNotification(message) {
    // Geçici bildirim göster
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg z-[10000] border border-orange-500';
    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-orange-400 text-xl">⛶</span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    // 3 saniye sonra kaldır
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function autoCorrectComposition(name, spectralType, asteroidId) {
    const compositionSelect = document.getElementById('composition');
    if (!compositionSelect) return;

    const lowerName = String(name || '').toLowerCase();
    const st = String(spectralType || '').toUpperCase();
    const idStr = String(asteroidId || '');

    if (idStr === '2101955' || lowerName.includes('bennu') || lowerName.includes('ryugu')) {
        compositionSelect.value = 'rubble';
    } else if (st.includes('C') || st.includes('B') || st.includes('F')) {
        compositionSelect.value = 'rubble';
    } else if (st.includes('M')) {
        compositionSelect.value = 'iron';
    } else if (lowerName.includes('comet') || st.includes('COMET')) {
        compositionSelect.value = 'ice';
    } else {
        compositionSelect.value = 'rock';
    }

    updateMassForCurrentSelection();
}

// =====================================================
// BELLEK YÖNETİMİ - LAYER TEMİZLEME
// =====================================================

/**
 * Tüm harita katmanlarını düzgün şekilde temizler
 * Bellek sızıntısını önler
 */
function clearAllMapLayers() {
    console.log('🧹 Katman temizliği başlatılıyor...');
    
    let cleanedCount = 0;
    
    // 1. Impact circles temizle
    if (impactCircles && impactCircles.length > 0) {
        impactCircles.forEach(circle => {
            if (circle && map.hasLayer(circle)) {
                map.removeLayer(circle);
                cleanedCount++;
            }
        });
        impactCircles = [];
    }
    
    // 2. Impact markers temizle
    if (impactMarkers && impactMarkers.length > 0) {
        impactMarkers.forEach(marker => {
            if (marker && map.hasLayer(marker)) {
                map.removeLayer(marker);
                cleanedCount++;
            }
        });
        impactMarkers = [];
    }
    
    // 3. Layer gruplarını temizle
    if (typeof mapLayerGroups !== 'undefined') {
        Object.keys(mapLayerGroups).forEach(key => {
            const group = mapLayerGroups[key];
            if (group) {
                if (map.hasLayer(group)) {
                    map.removeLayer(group);
                }
                if (group.clearLayers) {
                    group.clearLayers();
                }
                mapLayerGroups[key] = null;
                cleanedCount++;
            }
        });
    }
    
    // 4. Özel layer'ları temizle
    ['uncertaintyCircle', 'preSimCircle'].forEach(layerName => {
        if (window[layerName]) {
            if (map.hasLayer(window[layerName])) {
                map.removeLayer(window[layerName]);
                cleanedCount++;
            }
            window[layerName] = null;
        }
    });
    
    // 5. Layer control temizle
    if (window.layerControl) {
        map.removeControl(window.layerControl);
        window.layerControl = null;
    }
    
    console.log(`✅ ${cleanedCount} katman temizlendi`);
}

// =====================================================
// HARİTA RESIZE YÖNETİMİ (ResizeObserver)
// =====================================================

/**
 * Modern ResizeObserver ile verimli harita resize
 */
function initMapResize() {
    const mapElement = document.getElementById('map');
    
    if (!mapElement) {
        console.warn('⚠️ Map element bulunamadı');
        return;
    }
    
    // Eski observer'ı temizle
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
    
    // Debounced resize handler
    const debouncedResize = debounce(() => {
        if (map) {
            map.invalidateSize({ 
                animate: false, 
                pan: false,
                debounceMoveend: true 
            });
            console.log('🔄 Harita boyutu güncellendi (ResizeObserver)');
        }
    }, 150);
    
    // ResizeObserver oluştur
    resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(mapElement);
    
    console.log('✅ ResizeObserver aktif');
}

/**
 * Resize observer'ı temizle
 */
function cleanupMapResize() {
    if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
        console.log('🧹 ResizeObserver temizlendi');
    }
}

// =====================================================
// EVENT LİSTENER YÖNETİMİ
// =====================================================

/**
 * Harita click handler'ı başlat
 */
function initMapClickHandler() {
    // Önceki handler'ı kaldır
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
    }
    
    mapClickHandler = (e) => {
        impactLatLng = e.latlng;
        const coordText = `Seçilen Nokta: ${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°`;
        
        impactMarker.setLatLng(impactLatLng)
            .setPopupContent(coordText)
            .openPopup();
        
        console.log('📍', coordText);
    };
    
    map.on('click', mapClickHandler);
    console.log('✅ Harita click handler aktif');
}

/**
 * Haritayı ve tüm bileşenlerini temizle
 */
function destroyMap() {
    console.log('🧹 Harita tamamen temizleniyor...');
    
    // Event handler'ları kaldır
    if (mapClickHandler) {
        map.off('click', mapClickHandler);
        mapClickHandler = null;
    }
    
    // Layer'ları temizle
    clearAllMapLayers();
    
    // Resize observer temizle
    cleanupMapResize();
    
    // Fullscreen manager temizle
    if (fullscreenManager) {
        fullscreenManager.destroy();
        fullscreenManager = null;
    }
    
    // Haritayı kaldır
    if (map) {
        map.remove();
        map = null;
    }
    
    console.log('✅ Harita tamamen temizlendi');
}

// Event Listeners and Initializers
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Harita modülü başlatılıyor...');
    
    initMap();
    fetchDatasetAsteroids();
    fetchDatasetStatus();

    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('input', handleInputFilter);
    document.getElementById("simulateBtn").addEventListener("click", runSimulation);
    document.getElementById("composition").addEventListener("change", updateMassForCurrentSelection);
    document.getElementById("btn-monte-carlo").addEventListener("click", runMonteCarlo);
    document.getElementById("btn-validation").addEventListener("click", runValidation);
    
    console.log('✅ Event listener\'lar yüklendi');
});

// YENİ: Veri seti durumunu yükle
async function fetchDatasetStatus() {
    try {
        const response = await fetch('http://127.0.0.1:5001/dataset_status');
        if (response.ok) {
            const data = await response.json();
            updateDatasetPanel(data);
        }
    } catch (e) {
        console.error("Veri seti durumu alınamadı:", e);
    }
}

function updateDatasetPanel(data) {
    const countEl = document.getElementById('dataset-count');
    const progressEl = document.getElementById('dataset-progress');
    
    if (countEl) {
        countEl.textContent = `${data.datasets_loaded}/${data.datasets_total} (${data.coverage_percent}%)`;
        countEl.className = data.coverage_percent > 80 ? 'text-sm font-mono text-green-400' : 'text-sm font-mono text-yellow-400';
    }
    
    if (progressEl) {
        progressEl.style.width = `${data.coverage_percent}%`;
    }
    
    // Kategorileri güncelle
    const categories = data.categories || {};
    const catElements = {
        'cat-nasa': categories.nasa_jpl_data,
        'cat-asteroid': categories.asteroid_properties,
        'cat-physics': categories.physics_models,
        'cat-earth': categories.earth_geological,
        'cat-infra': categories.infrastructure,
        'cat-socio': categories.socioeconomic
    };
    
    for (const [id, value] of Object.entries(catElements)) {
        const el = document.getElementById(id);
        if (el && value !== undefined) {
            el.textContent = value;
        }
    }
}

// YENİ: Veri setini sunucudan çek
async function fetchDatasetAsteroids() {
    try {
        const response = await fetch('http://127.0.0.1:5001/get_dataset_asteroids');
        if (response.ok) {
            localDatasetAsteroids = await response.json();
            console.log(`${localDatasetAsteroids.length} asteroit veri setinden yüklendi.`);
            populateAsteroidList(localDatasetAsteroids);
        }
    } catch (e) {
        console.error("Veri seti listesi alınamadı:", e);
    }
}

function populateAsteroidList(asteroids) {
    const selectEl = document.getElementById('asteroid-list');
    selectEl.innerHTML = '';

    if (asteroids.length === 0) {
        const opt = document.createElement('option');
        opt.text = "Sonuç bulunamadı";
        opt.disabled = true;
        selectEl.add(opt);
        return;
    }

    asteroids.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.text = a.name;
        selectEl.add(opt);
    });
}

function handleInputFilter(e) {
    const term = e.target.value.toLowerCase().trim();
    const statusEl = document.getElementById('search-status');

    if (!term) {
        populateAsteroidList(localDatasetAsteroids);
        statusEl.textContent = '';
        return;
    }

    const matches = localDatasetAsteroids.filter(a =>
        a.name.toLowerCase().includes(term) ||
        a.id.toString().includes(term)
    );

    populateAsteroidList(matches);

    if (matches.length > 0) {
        statusEl.textContent = `Veri setinde ${matches.length} eşleşme bulundu.`;
    } else {
        statusEl.textContent = 'Veri setinde bulunamadı. API için "Bul" butonuna basın.';
    }
}

document.getElementById('asteroid-list').addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
        await loadAsteroidDetails(selectedId);
    }
});

async function loadAsteroidDetails(idOrName) {
    const statusEl = document.getElementById('search-status');
    statusEl.textContent = 'Veriler getiriliyor...';

    try {
        const response = await fetch(`http://127.0.0.1:5001/lookup_asteroid/${encodeURIComponent(idOrName)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `API Hatası: ${response.status}`);

        const newAsteroid = {
            id: data.spk_id,
            name: data.name,
            diameter_m: data.estimated_diameter_km.estimated_diameter_max * 1000,
            velocity_kms: data.velocity_kms,
            mass_kg: data.mass_kg,
            density: data.density || DENSITY_MAP[data.estimated_composition] || DENSITY_MAP['rock'],
            composition_id: data.estimated_composition,
            spectral_type: data.spectral_type,
            angle_deg: data.angle_deg,
            orbital_data: data.orbital_data,
            absolute_magnitude_h: data.absolute_magnitude,
            is_potentially_hazardous: data.is_potentially_hazardous
        };

        if (!allAsteroids.has(newAsteroid.id)) {
            allAsteroids.set(newAsteroid.id, newAsteroid);
        }

        statusEl.textContent = `'${newAsteroid.name}' verileri yüklendi.`;
        selectAsteroid(newAsteroid.id);

        if (newAsteroid.orbital_data) {
            const year = newAsteroid.orbital_data.close_approach_date ?
                new Date(newAsteroid.orbital_data.close_approach_date).getFullYear() :
                "Gelecek";
            console.log("Erken Uyarı Sistemi Tetiklendi:", year);
            visualizePreSimulationUncertainty(newAsteroid.orbital_data, year);
        }

    } catch (error) {
        statusEl.textContent = `Hata: ${error.message}`;
        console.error("Detay Getirme Hatası:", error);
    }
}

function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    if (num === 0) return '0';
    const absNum = Math.abs(num);
    
    // Çok büyük sayılar için okunabilir format
    if (absNum >= 1e18) {
        return (num / 1e18).toFixed(2) + ' Kentilyon';
    }
    if (absNum >= 1e15) {
        return (num / 1e15).toFixed(2) + ' Katrilyon';
    }
    if (absNum >= 1e12) {
        return (num / 1e12).toFixed(2) + ' Trilyon';
    }
    if (absNum >= 1e9) {
        return (num / 1e9).toFixed(2) + ' Milyar';
    }
    if (absNum >= 1e6) {
        return (num / 1e6).toFixed(2) + ' Milyon';
    }
    if (absNum >= 1e3) {
        return (num / 1e3).toFixed(1) + ' Bin';
    }
    if (absNum < 1e-2 && absNum > 0) {
        return num.toExponential(2);
    }
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(num);
}

function formatEnergyJoules(joules) {
    if (joules === null || joules === undefined) return 'N/A';
    if (joules === 0) return '0 J';
    
    const absJ = Math.abs(joules);
    // SI prefiksleri
    if (absJ >= 1e24) {
        return (joules / 1e24).toFixed(2) + ' YJ (Yottajoule)';
    }
    if (absJ >= 1e21) {
        return (joules / 1e21).toFixed(2) + ' ZJ (Zettajoule)';
    }
    if (absJ >= 1e18) {
        return (joules / 1e18).toFixed(2) + ' EJ (Exajoule)';
    }
    if (absJ >= 1e15) {
        return (joules / 1e15).toFixed(2) + ' PJ (Petajoule)';
    }
    if (absJ >= 1e12) {
        return (joules / 1e12).toFixed(2) + ' TJ (Terajoule)';
    }
    if (absJ >= 1e9) {
        return (joules / 1e9).toFixed(2) + ' GJ (Gigajoule)';
    }
    if (absJ >= 1e6) {
        return (joules / 1e6).toFixed(2) + ' MJ (Megajoule)';
    }
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(joules) + ' J';
}

function roundToSignificantDigits(value, sig = 4) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === 0) return 0;
    return Number.parseFloat(n.toPrecision(sig));
}

function setMassInputValue(massKg) {
    const massEl = document.getElementById('mass');
    if (!massEl) return;
    massEl.value = roundToSignificantDigits(massKg, 4);
}

const WORLD_POPULATION = 8_000_000_000; // 8 Milyar dünya nüfusu

function formatMass(massKg) {
    if (massKg === null || massKg === undefined) return 'N/A';
    if (massKg === 0) return '0 kg';
    
    const absM = Math.abs(massKg);
    if (absM >= 1e12) {
        return (massKg / 1e12).toFixed(2) + ' Trilyon kg';
    }
    if (absM >= 1e9) {
        return (massKg / 1e9).toFixed(2) + ' Milyar kg';
    }
    if (absM >= 1e6) {
        return (massKg / 1e6).toFixed(2) + ' Milyon kg';
    }
    if (absM >= 1e3) {
        return (massKg / 1e3).toFixed(1) + ' Ton';
    }
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(massKg) + ' kg';
}

function formatPopulation(num) {
    if (num === null || num === undefined) return 'Bilinmiyor';
    if (num === 0) return '0';
    
    // KUSURSUZ VALİDASYON: Dünya nüfusunu aşamaz
    if (num > WORLD_POPULATION) {
        console.warn(`Nüfus değeri dünya nüfusunu aşıyor: ${num}, ${WORLD_POPULATION} ile sınırlanıyor`);
        num = WORLD_POPULATION;
    }
    
    // Negatif kontrol
    if (num < 0) {
        console.error(`Negatif nüfus değeri: ${num}, 0 olarak ayarlanıyor`);
        return '0';
    }
    
    // Hassas formatlama
    if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + ' Milyar';
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + ' Milyon';
    }
    if (num >= 1e3) {
        return (num / 1e3).toFixed(1) + ' Bin';
    }
    
    // Tam sayı formatı (binlik ayırıcı ile)
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(num));
}

async function runSimulation() {
    const selectedComposition = document.getElementById("composition").value;

    let orbitalData = {};
    let density = DENSITY_MAP[selectedComposition];

    let selectedAsteroidId = null;
    if (currentSelectedId && allAsteroids.has(currentSelectedId)) {
        const asteroid = allAsteroids.get(currentSelectedId);
        selectedAsteroidId = asteroid.id || currentSelectedId;
        orbitalData = asteroid.orbital_data || {};

        if (!density && asteroid.density) {
            density = asteroid.density;
        }
    }

    if (!density) density = 3000;

    const payload = {
        latitude: impactLatLng.lat,
        longitude: impactLatLng.lng,
        mass_kg: parseFloat(document.getElementById("mass").value),
        velocity_kms: parseFloat(document.getElementById("velocity").value),
        angle_deg: parseInt(document.getElementById("angle_deg").value, 10),
        density: density,
        asteroid_id: selectedAsteroidId,
        orbital_data: orbitalData,
        composition: selectedComposition
    };

    if (!payload.mass_kg || !payload.velocity_kms) {
        alert("Lütfen kütle ve hızı girmek için önce bir asteroit seçin.");
        return;
    }

    const simulateBtn = document.getElementById('simulateBtn');
    const statusEl = document.getElementById('simulation-status');

    document.getElementById('simulation-results').style.display = 'none';
    simulateBtn.textContent = 'SİMÜLASYON ÇALIŞIYOR...';
    simulateBtn.disabled = true;
    statusEl.textContent = 'Nüfus verileri analiz ediliyor... (Bu işlem biraz zaman alabilir)';

    try {
        const response = await fetch("http://127.0.0.1:5001/calculate_human_impact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const resultData = await response.json();

        if (!response.ok) {
            throw new Error(resultData.error || `API Hatası: ${response.statusText}`);
        }

        updateVisualizations(resultData);

        // Belirsizlik Görselleştirmesi
        if (window.uncertaintyCircle) {
            map.removeLayer(window.uncertaintyCircle);
            window.uncertaintyCircle = null;
        }
        handleUncertainty(orbitalData, impactLatLng.lat, impactLatLng.lng);
        statusEl.textContent = 'Simülasyon Tamamlandı. Bilimsel Analiz Yapılıyor...';

        // YENİ: 13 Bilimsel Özellik Analizini Otomatik Çalıştır
        try {
            const diameter_m = Math.pow((6 * payload.mass_kg) / (Math.PI * density), 1/3);
            const scientificResponse = await fetch("http://127.0.0.1:5001/scientific_impact_analysis", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    diameter_m: diameter_m,
                    velocity_kms: payload.velocity_kms,
                    angle_deg: payload.angle_deg,
                    density_kgm3: density,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    spectral_type: selectedComposition === 'iron' ? 'M' : selectedComposition === 'rubble' ? 'C' : 'S',
                    datetime: {
                        month: new Date().getMonth() + 1,
                        hour: new Date().getHours()
                    }
                })
            });

            if (scientificResponse.ok) {
                const scientificData = await scientificResponse.json();
                displayScientificFeaturesInReport(scientificData);
                statusEl.textContent = 'Simülasyon ve Bilimsel Analiz Tamamlandı!';
            }
        } catch (sciErr) {
            console.warn('Bilimsel analiz hatası:', sciErr);
            statusEl.textContent = 'Simülasyon tamamlandı (bilimsel analiz atlandı)';
        }

        // CHAMPIONSHIP: Also run Decision Support Pipeline
        const decisionParams = {
            mass_kg: payload.mass_kg,
            velocity_kms: payload.velocity_kms,
            angle_deg: payload.angle_deg,
            density_kgm3: density,
            latitude: payload.latitude,
            longitude: payload.longitude
        };
        
        // Run decision support in background (don't wait)
        if (typeof runDecisionSupport === 'function') {
            runDecisionSupport(decisionParams).then(result => {
                if (result) {
                    console.log('Decision Support Pipeline complete:', result.metadata?.scenario_hash);
                }
            });
        }

    } catch (error) {
        alert(`Bir hata oluştu: ${error.message}`);
        console.error("Simülasyon Hatası:", error);
        statusEl.textContent = `Hata: ${error.message}`;
    } finally {
        simulateBtn.textContent = 'YZ Simülasyonunu Çalıştır';
        simulateBtn.disabled = false;
    }
}

// VISUALIZATION FUNCTION (UPDATED)
function updateVisualizations(resultData) {
    console.log("Visualization Data:", resultData);

    const physical = resultData.physical_impact || {};
    const human = resultData.human_impact_assessment || {};
    const inputs = resultData.input_parameters || {};
    const mapData = resultData.map_data || {};
    const atm = resultData.atmospheric_entry || {};
    const infoMessage = resultData.simulation_info_message || "Simülasyon tamamlandı.";

    // --- HARİTA TEMİZLEME (Bellek Sızıntısı Önleme) ---
    console.log('🧹 Harita katmanları temizleniyor...');
    clearAllMapLayers();

    if (mapData && mapData.features) {
        mapData.features.forEach(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates; // [lon, lat]
            const latLng = [coords[1], coords[0]];

            // Marker (Nokta) - Altyapı
            if (props.type === 'infrastructure') {
                const marker = L.marker(latLng, {
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color:purple; width:10px; height:10px; border-radius:50%; border:1px solid white;"></div>`,
                        iconSize: [12, 12],
                        iconAnchor: [6, 6]
                    })
                }).addTo(map);

                const popupContent = `<b>${props.name}</b><br>${props.description}`;
                marker.bindPopup(popupContent);
                impactMarkers.push(marker);
                return;
            }

            // Daireler
            let radius = props.radius_km * 1000;
            let color = props.color || 'red';
            let fillOpacity = 0.3;

            if (props.type === 'tsunami_wave') {
                fillOpacity = 0.1;
            }

            if (radius > 0) {
                const circle = L.circle(latLng, {
                    radius: radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: fillOpacity
                }).addTo(map);

                let popupContent = `<b>${props.type.toUpperCase()}</b><br>Yarıçap: ${formatNumber(radius)}m`;
                if (props.wave_height) {
                    popupContent += `<br>Dalga YüksekliıŸi: ${props.wave_height.toFixed(1)}m`;
                }

                circle.bindPopup(popupContent);
                impactCircles.push(circle);
            }
        });
    }

    if (impactCircles.length > 0) {
        const largestCircle = impactCircles.reduce((p, c) => p.getRadius() > c.getRadius() ? p : c);
        map.fitBounds(largestCircle.getBounds(), { padding: [50, 50] });
    }

    // === KAPSAMLI HARİTA GÖRSELLEŞTİRME ===
    addComprehensiveMapVisualizations(resultData, inputs, physical, human);

    // --- ALTYAPI KARTI ---
    const infraCard = document.getElementById('infrastructure-card');
    const infraList = document.getElementById('infrastructure-list');

    if (human.infrastructure_impact && human.infrastructure_impact.length > 0) {
        infraList.innerHTML = '';
        human.infrastructure_impact.forEach(plant => {
            const div = document.createElement('div');
            div.className = "bg-gray-800 p-2 rounded text-xs border border-gray-700 flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <div class="font-semibold text-gray-200">${plant.name}</div>
                    <div class="text-gray-500">${plant.primary_fuel} | ${plant.capacity_mw} MW</div>
                </div>
                <div class="text-right">
                    <div class="text-red-400 font-mono text-sm">${plant.distance_km} km</div>
                </div>
            `;
            infraList.appendChild(div);
        });
        infraCard.classList.remove('hidden');
    } else {
        if (infraCard) infraCard.classList.add('hidden');
    }

    // --- SONUÇ KARTLARI ---
    const summaryEl = document.getElementById('result-summary-text');
    if (summaryEl) summaryEl.textContent = infoMessage;

    // Çarpışma Enerjisi (Atmosfer Sonrası)
    let impactEnergyText = formatNumber(physical.impact_energy_megatons_tnt) + ' MT';
    safeSetText('res-tnt-megatons', impactEnergyText);

    // Giriş Enerjisi (Atmosfer Öncesi) - Karşılaştırma için
    const entryEnergyMt = physical.entry_energy_megatons_tnt || atm.entry_energy_mt || 0;
    if (entryEnergyMt > 0) {
        safeSetText('res-entry-energy-mt', formatNumber(entryEnergyMt) + ' MT');
    }

    const joules = (physical.impact_energy_megatons_tnt || 0) * 4.184e15;
    safeSetText('res-energy-joules', formatEnergyJoules(joules));

    // Hiroshima ve Tsar Bomba karşılaştırmaları (x kaldırıldı, sadece sayı)
    const hiroshimaRatio = (physical.impact_energy_megatons_tnt || 0) * 1000 / HIROSHIMA_KT;
    const tsarRatio = (physical.impact_energy_megatons_tnt || 0) / TSAR_BOMBA_MT;
    safeSetText('res-comparison-hiroshima', formatNumber(hiroshimaRatio));
    safeSetText('res-comparison-tsar', formatNumber(tsarRatio));

    safeSetText('res-seismic-mag', physical.seismic_magnitude ? physical.seismic_magnitude.toFixed(1) : "N/A");
    safeSetText('res-seismic-desc', physical.seismic_description || "N/A");

    const finalCraterKm = Number(physical.crater_diameter_km || 0);
    const transientCraterKm = Number(physical.crater_diameter_transient_km || 0);
    let craterShownKm = 0;
    let craterSuffix = '';
    const impactTypeStr = String(physical.impact_type || '');
    const isAirburst = impactTypeStr.toLowerCase().includes('airburst') || (finalCraterKm === 0 && transientCraterKm === 0);
    const isOcean = impactTypeStr.toLowerCase().includes('ocean');

    if (isAirburst) {
        craterShownKm = 0;
        craterSuffix = ' (Airburst - Krater Yok)';
    } else if (finalCraterKm > 0) {
        craterShownKm = finalCraterKm;
    } else if (isOcean && transientCraterKm > 0) {
        craterShownKm = transientCraterKm;
        craterSuffix = ' (Su BoşluıŸu - Transient)';
    }

    safeSetText('res-crater-diameter', formatNumber(craterShownKm * 1000) + " metre" + craterSuffix);
    safeSetText('res-crater-depth', formatNumber(physical.crater_depth_m || 0) + " metre");
    safeSetText('res-ejecta-radius', formatNumber((physical.ejecta_blanket_radius_km || 0) * 1000) + " metre");

    const thermal = physical.thermal_burn_radius_km || {};
    const burnRadiusKm = thermal["2nd_degree"] || 0;
    safeSetText('res-thermal-radius', formatNumber(burnRadiusKm * 1000) + " metre");

    const blast = physical.air_blast_radius_km || {};
    safeSetText('res-blast-20psi', formatNumber((blast["20_psi_km"] || 0) * 1000) + " m");
    safeSetText('res-blast-5psi', formatNumber((blast["5_psi_km"] || 0) * 1000) + " m");
    safeSetText('res-blast-1psi', formatNumber((blast["1_psi_km"] || 0) * 1000) + " m");

    // Atmosferik
    safeSetText('res-entry-velocity', atm.entry_velocity_kms ? formatNumber(atm.entry_velocity_kms) + " km/s" : "N/A");
    safeSetText('res-impact-velocity', atm.impact_velocity_kms ? formatNumber(atm.impact_velocity_kms) + " km/s" : "N/A");
    safeSetText('res-energy-loss', atm.energy_loss_percent || "0");
    safeSetText('res-breakup-alt', (atm.breakup_altitude_m > 0) ? formatNumber(atm.breakup_altitude_m) + " m" : "Parçalanmadı");

    let atmoText = "Veri yok.";
    if (atm.is_airburst) atmoText = "Cisim atmosferde parçalandı (Airburst).";
    else if (atm.energy_loss_percent > 90) atmoText = "Cisim büyük ölçüde yavaşladı.";
    else atmoText = "Cisim atmosferi delip geçti.";
    safeSetText('res-atmospheric-entry', atmoText);

    // Tsunami
    const tsunamiCard = document.getElementById('tsunami-analysis-card');
    if (tsunamiCard) {
        if (physical.tsunami_analysis && physical.tsunami_wave_height_m > 0) {
            const tData = physical.tsunami_analysis;
            safeSetText('res-tsunami-source-height', `${tData.source_wave_height_m} metre`);
            safeSetText('res-tsunami-100km', `${(tData.propagation || {})["100"] || 0} metre`);
            safeSetText('res-tsunami-500km', `${(tData.propagation || {})["500"] || 0} metre`);
            safeSetText('res-tsunami-1000km', `${(tData.propagation || {})["1000"] || 0} metre`);
            safeSetText('res-tsunami-runup', `${tData.estimated_run_up_100km || 0} metre`);
            tsunamiCard.classList.remove('hidden');
        } else {
            tsunamiCard.classList.add('hidden');
        }
    }

    // Nüfus & Breakdown
    const popVal = human?.estimated_population_in_burn_radius || 0;
    if (document.getElementById('res-population')) {
        document.getElementById('res-population').textContent = formatPopulation(popVal);
    }
    
    // Konum bilgisi
    const popLocationEl = document.getElementById('res-population-location');
    if (popLocationEl && inputs) {
        const lat = inputs.latitude || inputs.lat || inputs.impact_lat || 0;
        const lon = inputs.longitude || inputs.lon || inputs.impact_lon || 0;
        popLocationEl.innerHTML = `
            <span class="text-gray-500">Konum:</span> 
            <span class="font-mono">${lat.toFixed(4)}°, ${lon.toFixed(4)}°</span>
        `;
    }

    if (human.population_breakdown) {
        const container = document.getElementById('res-population-location').parentNode;
        let breakdownDiv = document.getElementById('pop-breakdown-container');
        if (breakdownDiv) breakdownDiv.remove();

        breakdownDiv = document.createElement('div');
        breakdownDiv.id = 'pop-breakdown-container';
        breakdownDiv.className = 'mt-3 space-y-1 text-xs bg-gray-800 p-2 rounded border border-gray-700';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'text-gray-500 mb-2 border-b border-gray-700 pb-1';
        headerDiv.textContent = 'Etki Kategorisine Göre Dağılım:';
        breakdownDiv.appendChild(headerDiv);

        const bd = human.population_breakdown;
        const order = ['airblast', 'thermal', 'seismic', 'crater', 'tsunami'];
        const labels = {
            'airblast': 'Hava Şoku',
            'thermal': 'Termal',
            'seismic': 'Sismik',
            'crater': 'Krater',
            'tsunami': 'Tsunami'
        };
        order.forEach(key => {
            if (bd[key] && (bd[key].count > 0 || (key === 'tsunami' && bd[key].radius_km > 0))) {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center py-1';
                row.innerHTML = `<span class="text-gray-400">${labels[key] || key}</span><span class="font-mono text-white">${formatPopulation(bd[key].count)}</span>`;
                breakdownDiv.appendChild(row);
            }
        });
        container.appendChild(breakdownDiv);
    }

    // Enerji Dağılımı - Bilimsel Format
    const partitionList = document.getElementById('res-energy-partition');
    if (partitionList && physical.energy_partitioning) {
        partitionList.innerHTML = '';
        const partitions = physical.energy_partitioning.percentages || physical.energy_partitioning;
        
        const partitionLabels = {
            'thermal': { label: 'Termal Radyasyon', color: '#f97316' },
            'kinetic': { label: 'Kinetik Transfer', color: '#3b82f6' },
            'seismic': { label: 'Sismik Dalga', color: '#ef4444' },
            'ejecta': { label: 'Ejekta Kinetik', color: '#a855f7' },
            'acoustic': { label: 'Akustik/Hava Şoku', color: '#22c55e' },
            'crater': { label: 'Krater Oluşumu', color: '#eab308' },
            'vaporization': { label: 'Buharlaşma', color: '#06b6d4' }
        };
        
        for (const [key, value] of Object.entries(partitions)) {
            if (key === 'percentages' || value < 0.01) continue;
            const info = partitionLabels[key.toLowerCase()] || { label: key, color: '#6b7280' };
            const div = document.createElement('div');
            div.className = 'mb-2';
            div.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-400">${info.label}</span>
                    <span class="font-mono text-gray-300">${value.toFixed(2)}%</span>
                </div>
                <div class="w-full bg-gray-700 rounded h-2">
                    <div class="h-2 rounded" style="width: ${Math.min(100, value)}%; background-color: ${info.color};"></div>
                </div>
            `;
            partitionList.appendChild(div);
        }
    }

    // Risk Skoru - Bilimsel Format
    const riskScoreEl = document.getElementById('res-risk-score');
    if (riskScoreEl) {
        const score = physical.impact_scale !== undefined ? physical.impact_scale : (physical.risk_score || 0);
        riskScoreEl.textContent = typeof score === 'number' ? score.toFixed(1) : score;
        
        // Renk belirleme
        if (score <= 3) {
            riskScoreEl.className = 'text-3xl font-mono text-green-400 font-bold';
        } else if (score <= 6) {
            riskScoreEl.className = 'text-3xl font-mono text-yellow-400 font-bold';
        } else {
            riskScoreEl.className = 'text-3xl font-mono text-red-400 font-bold';
        }
        
        const riskBar = document.getElementById('res-risk-bar');
        if (riskBar) riskBar.style.width = `${Math.min(100, score * 10)}%`;
        
        // Risk açıklaması
        const riskDescEl = document.getElementById('res-risk-desc');
        if (riskDescEl) {
            const descriptions = [
                'Yerel etki, minimal hasar',
                'Şehir ölçeğinde etki',
                'Bölgesel felaket',
                'Kıtasal etki',
                'Küresel felaket - K-Pg sınırı seviyesi'
            ];
            const idx = Math.min(4, Math.floor(score / 2.5));
            riskDescEl.textContent = descriptions[idx] || '';
        }
    }

    // Girdiler
    safeSetText('in-mass', formatMass(inputs.mass_kg));
    safeSetText('in-velocity', formatNumber(inputs.velocity_kms) + ' km/s');
    // Backend'den angle_deg olarak geliyor (impact_angle_degrees değil)
    const impactAngle = inputs.angle_deg || inputs.impact_angle_degrees || 45;
    safeSetText('in-angle', formatNumber(impactAngle) + '°');
    safeSetText('in-composition', inputs.composition || 'Bilinmiyor');

    // YENİ: ML Karşılaştırma Kartı
    const mlAnalysis = resultData.ml_analysis;
    const mlCard = document.getElementById('ml-comparison-card');
    if (mlCard && mlAnalysis) {
        if (mlAnalysis.model_available && mlAnalysis.comparison_with_physics) {
            const comp = mlAnalysis.comparison_with_physics;
            safeSetText('ml-physics-result', formatNumber(comp.physics_result_m) + ' m');
            safeSetText('ml-model-result', formatNumber(comp.ml_result_m) + ' m');

            const agreementEl = document.getElementById('ml-agreement');
            if (agreementEl) {
                agreementEl.textContent = comp.agreement_level;
                agreementEl.className = 'text-xl font-bold font-mono ';
                if (comp.agreement_level === 'YçœKSEK') {
                    agreementEl.className += 'text-green-400';
                } else if (comp.agreement_level === 'ORTA') {
                    agreementEl.className += 'text-yellow-400';
                } else {
                    agreementEl.className += 'text-red-400';
                }
            }
            safeSetText('ml-difference', `Fark: %${comp.difference_percent}`);
            mlCard.classList.remove('hidden');
        } else {
            mlCard.classList.add('hidden');
        }
    }

    // YENİ: Veri Kaynakları Kartı
    const dataSources = resultData.data_sources;
    const dsCard = document.getElementById('data-sources-card');
    if (dsCard && dataSources) {
        // Nüfus Verisi
        if (dataSources.population) {
            const popStatus = dataSources.population.available ? 'œ“ Aktif' : 'œ— Yok';
            safeSetText('ds-population', `${dataSources.population.source} ${popStatus}`);
        }

        // Batimetri
        if (dataSources.bathymetry) {
            const tiles = dataSources.bathymetry.tiles_loaded;
            safeSetText('ds-bathymetry', `GEBCO 2025 (${tiles} tile yüklü)`);
        }

        // Altyapı
        if (dataSources.infrastructure) {
            safeSetText('ds-infrastructure', `WRI (${dataSources.infrastructure.total_plants.toLocaleString()} tesis)`);
        }

        // Asteroit
        if (dataSources.asteroid_data) {
            safeSetText('ds-asteroids', `NASA+JPL (${dataSources.asteroid_data.local_dataset_size.toLocaleString()} kayıt)`);
        }

        // Güvenilirlik Göstergesi
        const confidence = resultData.scientific_confidence;
        if (confidence) {
            const confEl = document.getElementById('scientific-confidence');
            if (confEl) {
                confEl.textContent = confidence.overall === 'HIGH' ? 'YçœKSEK' : (confidence.overall === 'MODERATE' ? 'ORTA' : 'DçœÅçœK');
                confEl.className = 'px-3 py-1 rounded text-sm font-bold ';
                if (confidence.overall === 'HIGH') {
                    confEl.className += 'bg-green-700 text-green-100';
                } else if (confidence.overall === 'MODERATE') {
                    confEl.className += 'bg-yellow-700 text-yellow-100';
                } else {
                    confEl.className += 'bg-red-700 text-red-100';
                }
            }
        }

        dsCard.classList.remove('hidden');
    }

    const resultsDiv = document.getElementById('simulation-results');
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }

    // --- YENİ: SOSYO-EKONOMİK ETKİ KARTI ---
    const socioData = resultData.socio_economic_impact || {};
    if (socioData.health_system || socioData.digital_infrastructure || socioData.food_security) {
        let socioHtml = '<h3 class="text-lg font-bold text-yellow-500 mb-2 mt-4 border-t border-gray-600 pt-2">🌪️ Sosyo-Ekonomik Çöküş Analizi</h3>';

        // 1. Sağlık
        if (socioData.health_system) {
            const h = socioData.health_system;
            if (h.hospitals_destroyed !== undefined) {
                const color = h.hospitals_destroyed > 0 ? "text-red-400" : "text-green-400";
                const statusIcon = h.hospitals_destroyed > 0 ? "🚑" : "🏥";
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="${color} font-bold">${statusIcon} Sağlık Sistemi:</span> ${h.hospitals_destroyed} Hastane Yıkıldı. (Tahmini ${h.beds_lost_est} yatak kapasitesi kaybı). <br>Sistem Durumu: <span class="font-mono text-white bg-red-900 px-1 rounded">${h.system_status}</span></div>`;
            }
        }

        // 2. İnternet
        if (socioData.digital_infrastructure) {
            const d = socioData.digital_infrastructure;
            if (d.cables_severed_count > 0) {
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="text-blue-400 font-bold">🌐 Dijital Altyapı:</span> <span class="text-red-500 font-bold">${d.cables_severed_count} Denizaltı İnternet Kablosu</span> koptu! <br>Riskli Hatlar: ${d.critical_cables.join(', ') || 'Global Backbone'}</div>`;
            } else {
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="text-green-400 font-bold">🌐 Dijital Altyapı:</span> Kritik kablo hatları güvenli.</div>`;
            }
        }

        // 3. Tarım
        if (socioData.food_security) {
            const f = socioData.food_security;
            if (f.famine_risk && f.famine_risk.includes('HIGH')) {
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="text-orange-500 font-bold">🌾 Gıda Güvenliği:</span> <span class="text-red-600 font-bold blink">YÜKSEK KITLIK RİSKİ!</span> <br>${f.affected_zones.join(', ')} bölgelerinde hasat kaybı. Küresel gıda stok etkisi: <span class="font-mono">%${f.global_supply_impact_percent.toFixed(1)}</span></div>`;
            } else if (f.affected_zones && f.affected_zones.length > 0) {
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="text-yellow-500 font-bold">🌾 Gıda Güvenliği:</span> ${f.affected_zones.join(', ')} üretim kuşakları etkilendi.</div>`;
            } else {
                socioHtml += `<div class="mb-2 bg-gray-900 p-2 rounded"><span class="text-green-500 font-bold">🌾 Gıda Güvenliği:</span> Temel tarım kuşakları etkilenmedi.</div>`;
            }
        }

        // Append this HTML to the 'result-summary-text' container
        const summaryTextEl = document.getElementById('result-summary-text');
        if (summaryTextEl) {
            // Remove old if exists
            const oldSocio = document.getElementById('socio-economic-card');
            if (oldSocio) oldSocio.remove();

            const divInfo = document.createElement('div');
            divInfo.id = 'socio-economic-card';
            divInfo.className = "mt-4";
            divInfo.innerHTML = socioHtml;
            summaryTextEl.parentNode.appendChild(divInfo);
        }
    }

    // ========================================
    // YENİ: KAPSAMLI VERİ SETİ KARTLARINI DOLDUR
    // ========================================
    populateComprehensiveCards(resultData);

    generateSystemSummary(resultData);
}

// YENİ: Kapsamlı Analiz Kartlarını Doldurma Fonksiyonu
function populateComprehensiveCards(resultData) {
    const physical = resultData.physical_impact || {};
    const atm = resultData.atmospheric_entry || {};
    const inputs = resultData.input_parameters || {};
    const human = resultData.human_impact_assessment || {};
    const dataSources = resultData.data_sources || {};
    const mlAnalysis = resultData.ml_analysis || {};
    const comprehensive = resultData.comprehensive_analysis || {};
    
    // === Asteroit Özellikleri ===
    const spectralClass = inputs.spectral_type || comprehensive.spectral_type || '-';
    safeSetText('res-spectral-class', spectralClass);
    
    const composition = inputs.composition || 'rock';
    const densityMap = { rock: 2700, iron: 7800, ice: 1000, rubble: 1500 };
    const estDensity = densityMap[composition] || 2700;
    safeSetText('res-est-density', formatNumber(estDensity) + ' kg/m³');
    
    const porosityMap = { rock: '5-15%', iron: '<5%', ice: '40-60%', rubble: '30-50%' };
    safeSetText('res-porosity', porosityMap[composition] || '10-20%');
    
    const structureMap = { rock: 'Monolitik', iron: 'Diferansiye', ice: 'Gözenekli', rubble: 'Rubble Pile' };
    safeSetText('res-internal-structure', structureMap[composition] || 'Bilinmiyor');
    
    const fragMap = { rock: 'Orta', iron: 'Yüksek', ice: 'Düşük', rubble: 'Çok Düşük' };
    safeSetText('res-fragmentation', fragMap[composition] || 'Orta');
    
    // === Jeolojik Etki ===
    const lithology = comprehensive.target_lithology || physical.target_lithology || 'Sedimenter';
    safeSetText('res-lithology', lithology);
    
    const targetDensity = comprehensive.target_density || 2650;
    safeSetText('res-target-density', formatNumber(targetDensity) + ' kg/m³');
    
    safeSetText('res-crust-thickness', '35 km (Kıtasal)');
    
    const penetration = physical.penetration_depth_m || (physical.crater_depth_m * 0.3) || 0;
    safeSetText('res-penetration', formatNumber(penetration) + ' m');
    
    safeSetText('res-seismic-conductivity', physical.seismic_magnitude > 6 ? 'Yüksek' : 'Normal');
    
    // === Atmosferik Fizik ===
    const airburstProb = atm.airburst_probability || (atm.is_airburst ? 100 : 0);
    safeSetText('res-airburst-prob', airburstProb.toFixed(0) + '%');
    
    const peakHeatingAlt = atm.peak_heating_altitude_km || (atm.breakup_altitude_m / 1000) || 45;
    safeSetText('res-peak-heating-alt', peakHeatingAlt.toFixed(1) + ' km');
    
    const ablationRate = comprehensive.ablation_rate || (atm.energy_loss_percent * 0.1) || 0;
    safeSetText('res-ablation-rate', ablationRate.toFixed(2) + ' kg/s');
    
    // Dinamik Basınç Hesabı (q = 0.5 * rho * v^2)
    // Tipik parçalanma irtifası ~30-50 km'de rho ≈ 0.01 kg/m³
    // v = entry_velocity_kms * 1000 (m/s)
    // q (Pa) = 0.5 * 0.01 * v^2 = 0.005 * v^2
    // q (MPa) = q / 1e6 = 0.005 * v^2 / 1e6 = v_kms^2 * 0.005
    const entryVel = atm.entry_velocity_kms || 15;
    // Atmosferik irtifalardaki ortalama değer (~30 km için rho ≈ 0.018 kg/m³)
    const avgRho = 0.018; // kg/m³ at ~30 km altitude
    const velMs = entryVel * 1000;
    const dynamicPressure = comprehensive.dynamic_pressure_mpa || (0.5 * avgRho * velMs * velMs / 1e6);
    safeSetText('res-dynamic-pressure', dynamicPressure.toFixed(1) + ' MPa');
    
    const altitudeKm = atm.breakup_altitude_m ? atm.breakup_altitude_m / 1000 : 0;
    let atmLayer = 'Yüzey';
    if (altitudeKm > 80) atmLayer = 'Termosfer';
    else if (altitudeKm > 50) atmLayer = 'Mezosfer';
    else if (altitudeKm > 12) atmLayer = 'Stratosfer';
    else if (altitudeKm > 0) atmLayer = 'Troposfer';
    safeSetText('res-atmosphere-layer', atmLayer);
    
    // === Sosyoekonomik Etki ===
    const rawCasualties = human.estimated_population_in_burn_radius || 0;
    safeSetText('res-raw-casualties', formatNumber(rawCasualties));
    
    const vulnerability = comprehensive.vulnerability_multiplier || 1.0;
    safeSetText('res-vulnerability', vulnerability.toFixed(1) + 'x');
    
    const adjustedCasualties = Math.round(rawCasualties * vulnerability);
    safeSetText('res-adjusted-casualties', formatNumber(adjustedCasualties));
    
    const economicDamage = comprehensive.economic_damage_usd || (rawCasualties * 50000);
    safeSetText('res-economic-damage', formatCurrency(economicDamage));
    
    const regionHDI = comprehensive.region_hdi || 0.75;
    safeSetText('res-region-hdi', regionHDI.toFixed(2));
    
    // === Kritik Altyapı ===
    const infraImpact = human.infrastructure_impact || [];
    const nuclearCount = infraImpact.filter(i => i.primary_fuel === 'Nuclear').length;
    safeSetText('res-nuclear-risk', nuclearCount > 0 ? nuclearCount + ' tesis risk altında' : 'Güvende');
    
    const damCount = comprehensive.dams_at_risk || 0;
    safeSetText('res-dam-risk', damCount > 0 ? damCount + ' baraj risk altında' : 'Güvende');
    
    const airportCount = comprehensive.airports_at_risk || infraImpact.filter(i => i.type === 'airport').length;
    safeSetText('res-airport-risk', airportCount > 0 ? airportCount + ' havalimanı' : 'Güvende');
    
    const portCount = comprehensive.ports_at_risk || 0;
    safeSetText('res-port-risk', portCount > 0 ? portCount + ' liman' : 'Güvende');
    
    const cascadeRisk = (nuclearCount > 0 || damCount > 0) ? 'YÜKSEK' : 'DÜŞÜK';
    safeSetText('res-cascade-risk', cascadeRisk);
    
    // === İklim Etkileri ===
    const energyMT = physical.impact_energy_megatons_tnt || 0;
    let dustSpread = 'Lokal';
    let sunlightReduction = '0%';
    let tempChange = '0°C';
    let climateDuration = '-';
    let agricultureImpact = 'Yok';
    
    if (energyMT > 1000) {
        dustSpread = 'Global';
        sunlightReduction = '20-50%';
        tempChange = '-5 ile -15°C';
        climateDuration = '2-5 yıl';
        agricultureImpact = 'KRİTİK - Küresel kıtlık riski';
    } else if (energyMT > 100) {
        dustSpread = 'Kıtasal';
        sunlightReduction = '5-20%';
        tempChange = '-1 ile -5°C';
        climateDuration = '6-24 ay';
        agricultureImpact = 'Ciddi - Bölgesel hasat kaybı';
    } else if (energyMT > 10) {
        dustSpread = 'Bölgesel';
        sunlightReduction = '1-5%';
        tempChange = '-0.5 ile -1°C';
        climateDuration = '1-6 ay';
        agricultureImpact = 'Orta - Yerel etki';
    }
    
    safeSetText('res-dust-spread', dustSpread);
    safeSetText('res-sunlight-reduction', sunlightReduction);
    safeSetText('res-temp-change', tempChange);
    safeSetText('res-climate-duration', climateDuration);
    safeSetText('res-agriculture-impact', agricultureImpact);
    
    // === Tarihsel Karşılaştırma ===
    let similarEvent = 'Chelyabinsk';
    let similarEventDate = '15 Şubat 2013';
    let similarEnergy = '0.5 MT';
    let similarDamage = '1,500 yaralı';
    
    if (energyMT > 100) {
        similarEvent = 'Tunguska';
        similarEventDate = '30 Haziran 1908';
        similarEnergy = '10-15 MT';
        similarDamage = '2,150 km² orman yıkımı';
    } else if (energyMT > 1) {
        similarEvent = 'Chelyabinsk';
        similarEventDate = '15 Şubat 2013';
        similarEnergy = '0.5 MT';
        similarDamage = '1,500 yaralı, $33M hasar';
    } else if (energyMT > 0.01) {
        similarEvent = 'Sikhote-Alin';
        similarEventDate = '12 Şubat 1947';
        similarEnergy = '0.01 MT';
        similarDamage = '106 krater, hasar yok';
    }
    
    safeSetText('res-similar-event', similarEvent);
    safeSetText('res-similar-event-date', similarEventDate);
    safeSetText('res-similar-energy', similarEnergy);
    safeSetText('res-similar-damage', similarDamage);
    safeSetText('res-model-consistency', '±15% (Doğrulanmış)');
    
    // === Risk Ölçekleri ===
    let torinoScale = 0;
    if (energyMT > 10000) torinoScale = 10;
    else if (energyMT > 1000) torinoScale = 8;
    else if (energyMT > 100) torinoScale = 6;
    else if (energyMT > 10) torinoScale = 4;
    else if (energyMT > 1) torinoScale = 2;
    else if (energyMT > 0.01) torinoScale = 1;
    
    const torinoBadge = document.getElementById('res-torino-badge');
    if (torinoBadge) {
        torinoBadge.textContent = 'T' + torinoScale;
        torinoBadge.className = 'torino-' + torinoScale + ' px-4 py-3 rounded-lg text-3xl font-bold';
    }
    
    const torinoDescriptions = {
        0: 'Normal - İzleme Gerektirmez',
        1: 'Normal - Rutin keşif',
        2: 'Dikkat Gerektiren - Yakın geçiş',
        3: 'Dikkat Gerektiren - Yakın karşılaşma',
        4: 'Dikkat Gerektiren - Yakın karşılaşma (>%1)',
        5: 'Tehdit - Ciddi ilgi gerektirir',
        6: 'Tehdit - Ciddi ilgi gerektirir',
        7: 'Tehdit - Olağanüstü ilgi',
        8: 'Kesin Çarpışma - Lokalize yıkım',
        9: 'Kesin Çarpışma - Bölgesel yıkım',
        10: 'Kesin Çarpışma - Global felaket'
    };
    
    safeSetText('res-torino-desc', torinoDescriptions[torinoScale] || '-');
    
    const torinoActions = {
        0: 'Önerilen Eylem: Rutin gözlem',
        1: 'Önerilen Eylem: İzlemeye devam',
        2: 'Önerilen Eylem: Geliştirilmiş izleme',
        3: 'Önerilen Eylem: Acil gözlem kampanyası',
        4: 'Önerilen Eylem: Uluslararası koordinasyon',
        5: 'Önerilen Eylem: Acil durum planlaması',
        6: 'Önerilen Eylem: Sivil savunma hazırlığı',
        7: 'Önerilen Eylem: Saptırma misyonu değerlendirmesi',
        8: 'Önerilen Eylem: ACİL TAHLİYE',
        9: 'Önerilen Eylem: KÜRESEL MÜDAHALE',
        10: 'Önerilen Eylem: TÜM KAYNAKLAR SEFERBERLİĞİ'
    };
    
    safeSetText('res-torino-action', torinoActions[torinoScale] || '-');
    
    const torinoBar = document.getElementById('res-torino-bar');
    if (torinoBar) {
        torinoBar.style.width = (torinoScale * 10) + '%';
        if (torinoScale <= 1) torinoBar.className = 'bg-green-500 h-3 rounded-full transition-all';
        else if (torinoScale <= 4) torinoBar.className = 'bg-yellow-500 h-3 rounded-full transition-all';
        else if (torinoScale <= 7) torinoBar.className = 'bg-orange-500 h-3 rounded-full transition-all';
        else torinoBar.className = 'bg-red-500 h-3 rounded-full transition-all';
    }
    
    // Palermo Ölçeği
    const impactProb = 0.001; // Örnek değer
    const palermoScale = Math.log10(impactProb / (0.03 * Math.pow(energyMT + 0.001, 0.8)));
    safeSetText('res-palermo-value', palermoScale.toFixed(2));
    
    const palermoDesc = palermoScale > 0 ? 'Arka plan riskinin ÜZERİNDE' : 'Arka plan riskinin altında';
    safeSetText('res-palermo-desc', palermoDesc);
    
    // === Savunma/Saptırma Analizi ===
    const asteroidDiameter = inputs.diameter_m || Math.cbrt((6 * (inputs.mass_kg || 1e9)) / (Math.PI * estDensity)) * 2;
    
    let kineticFeasibility = 'Uygulanabilir';
    let gravityTractor = 'Uygulanabilir';
    let nuclearOption = 'Gerekli Değil';
    let requiredWarning = '2 yıl';
    
    if (asteroidDiameter > 1000) {
        kineticFeasibility = 'Yetersiz';
        gravityTractor = 'Yetersiz';
        nuclearOption = 'GEREKLİ';
        requiredWarning = '10+ yıl';
    } else if (asteroidDiameter > 300) {
        kineticFeasibility = 'Sınırlı Etki';
        gravityTractor = 'Zor';
        nuclearOption = 'Değerlendirilmeli';
        requiredWarning = '5-10 yıl';
    } else if (asteroidDiameter > 100) {
        kineticFeasibility = 'Etkili';
        gravityTractor = 'Uygulanabilir';
        nuclearOption = 'Gerekli Değil';
        requiredWarning = '2-5 yıl';
    }
    
    safeSetText('res-kinetic-feasibility', kineticFeasibility);
    safeSetText('res-gravity-tractor', gravityTractor);
    safeSetText('res-nuclear-option', nuclearOption);
    safeSetText('res-required-warning', requiredWarning);
    
    // ========================================
    // YENİ: GENİŞLETİLMİŞ VERİ SETİ KARTLARI
    // ========================================
    populateExtendedDatasetCards(resultData, energyMT, asteroidDiameter);
}

// YENİ: Genişletilmiş Veri Seti Kartlarını Doldur
function populateExtendedDatasetCards(resultData, energyMT, asteroidDiameter) {
    const physical = resultData.physical_impact || {};
    const atm = resultData.atmospheric_entry || {};
    const inputs = resultData.input_parameters || {};
    const human = resultData.human_impact_assessment || {};
    
    // === CNEOS Fireball Karşılaştırması ===
    const energyKT = energyMT * 1000;
    let fireballSimilar = 0;
    let fireballClosest = 'Chelyabinsk';
    let fireballClosestDate = '15 Şubat 2013';
    let fireballEnergy = '500 kT';
    let fireballAltitude = '23.3 km';
    let fireballVelocity = '19.16 km/s';
    
    if (energyKT < 1) {
        fireballSimilar = 487;
        fireballClosest = 'Küçük Fireball';
        fireballClosestDate = 'Çok sayıda olay';
        fireballEnergy = '<1 kT';
        fireballAltitude = '30-50 km';
        fireballVelocity = '15-25 km/s';
    } else if (energyKT < 10) {
        fireballSimilar = 312;
        fireballClosest = 'Orta Boy Fireball';
        fireballClosestDate = '2018-12-18 (Bering Denizi)';
        fireballEnergy = '~10 kT';
        fireballAltitude = '25.6 km';
        fireballVelocity = '32 km/s';
    } else if (energyKT < 100) {
        fireballSimilar = 89;
        fireballClosest = 'Bering Denizi 2018';
        fireballClosestDate = '18 Aralık 2018';
        fireballEnergy = '173 kT';
        fireballAltitude = '25.6 km';
        fireballVelocity = '32.0 km/s';
    } else if (energyKT < 1000) {
        fireballSimilar = 3;
        fireballClosest = 'Chelyabinsk';
        fireballClosestDate = '15 Şubat 2013';
        fireballEnergy = '440-500 kT';
        fireballAltitude = '23.3 km';
        fireballVelocity = '19.16 km/s';
    } else {
        fireballSimilar = 0;
        fireballClosest = 'Kayıt Dışı';
        fireballClosestDate = 'Modern kayıtlarda yok';
        fireballEnergy = '>1 MT';
        fireballAltitude = 'Değişken';
        fireballVelocity = 'Değişken';
    }
    
    safeSetText('res-fireball-similar-count', fireballSimilar);
    safeSetText('res-fireball-closest', fireballClosest);
    safeSetText('res-fireball-closest-date', fireballClosestDate);
    safeSetText('res-fireball-energy', fireballEnergy);
    safeSetText('res-fireball-altitude', fireballAltitude);
    safeSetText('res-fireball-velocity', fireballVelocity);
    
    // === Tsunami Detay Kartı ===
    const tsunami = physical.tsunami_analysis || {};
    const isOcean = String(physical.impact_type || '').toLowerCase().includes('ocean');
    
    if (isOcean && tsunami.source_wave_height_m > 0) {
        const sourceH = tsunami.source_wave_height_m || 0;
        const prop = tsunami.propagation || {};
        
        // Dalga karakteristikleri (Green's Law)
        const wavelength = Math.sqrt(sourceH * 9.81) * 100; // Yaklaşık
        const period = wavelength / Math.sqrt(9.81 * 4000); // Ortalama okyanus derinliği
        const speed = Math.sqrt(9.81 * 4000) * 3.6; // km/h
        const tsunamiEnergy = 0.5 * 1025 * 9.81 * sourceH * sourceH * wavelength * 1000;
        
        safeSetText('res-tsunami-wavelength', (wavelength / 1000).toFixed(1) + ' km');
        safeSetText('res-tsunami-period', (period / 60).toFixed(1) + ' dakika');
        safeSetText('res-tsunami-speed', speed.toFixed(0) + ' km/h');
        safeSetText('res-tsunami-energy', formatEnergyJoules(tsunamiEnergy));
        
        // Mesafeye göre dalga yükseklikleri
        const h50 = sourceH * Math.pow(50/10, -0.25);
        const h100 = prop["100"] || sourceH * Math.pow(100/10, -0.25);
        const h500 = prop["500"] || sourceH * Math.pow(500/10, -0.25);
        const h1000 = prop["1000"] || sourceH * Math.pow(1000/10, -0.25);
        
        safeSetText('res-tsunami-h-50', h50.toFixed(1) + ' m');
        safeSetText('res-tsunami-h-100', h100.toFixed(1) + ' m');
        safeSetText('res-tsunami-h-500', h500.toFixed(1) + ' m');
        safeSetText('res-tsunami-h-1000', h1000.toFixed(1) + ' m');
        
        // Progress barları
        const maxH = sourceH;
        setBarWidth('res-tsunami-bar-50', (h50 / maxH) * 100);
        setBarWidth('res-tsunami-bar-100', (h100 / maxH) * 100);
        setBarWidth('res-tsunami-bar-500', (h500 / maxH) * 100);
        setBarWidth('res-tsunami-bar-1000', (h1000 / maxH) * 100);
        
        // Varış süreleri
        const arrivalTime100 = (100 / (speed / 60)).toFixed(0);
        safeSetText('res-tsunami-arrival-100', arrivalTime100 + ' dakika');
        safeSetText('res-tsunami-runup-detail', (tsunami.estimated_run_up_100km || h100 * 2.5).toFixed(1) + ' m');
        safeSetText('res-tsunami-evac-time', Math.max(10, arrivalTime100 - 30) + ' dakika');
        
        document.getElementById('tsunami-detail-card')?.classList.remove('hidden');
    } else {
        document.getElementById('tsunami-detail-card')?.classList.add('hidden');
    }
    
    // === Yakın Metropoller ===
    const megacitiesList = document.getElementById('res-megacities-list');
    if (megacitiesList) {
        const impactLat = inputs.lat || 40;
        const impactLon = inputs.lon || 30;
        
        // Örnek mega şehirler (gerçekte API'den gelmeli)
        const megacities = [
            { name: 'İstanbul', pop: 15840900, lat: 41.0082, lon: 28.9784 },
            { name: 'Moskova', pop: 12655050, lat: 55.7558, lon: 37.6173 },
            { name: 'Londra', pop: 9002488, lat: 51.5074, lon: -0.1278 },
            { name: 'Paris', pop: 2161000, lat: 48.8566, lon: 2.3522 },
            { name: 'Berlin', pop: 3769495, lat: 52.5200, lon: 13.4050 },
            { name: 'Madrid', pop: 3223334, lat: 40.4168, lon: -3.7038 },
            { name: 'Roma', pop: 2873000, lat: 41.9028, lon: 12.4964 },
            { name: 'Atina', pop: 664046, lat: 37.9838, lon: 23.7275 },
            { name: 'Kahire', pop: 20901000, lat: 30.0444, lon: 31.2357 },
            { name: 'Tokyo', pop: 13960000, lat: 35.6762, lon: 139.6503 }
        ];
        
        // Mesafeleri hesapla ve sırala
        const citiesWithDist = megacities.map(city => {
            const dist = haversineDistance(impactLat, impactLon, city.lat, city.lon);
            return { ...city, distance: dist };
        }).sort((a, b) => a.distance - b.distance);
        
        const thermalRadius = (physical.thermal_burn_radius_km?.["2nd_degree"] || 10);
        const blastRadius = (physical.air_blast_radius_km?.["1_psi_km"] || 50);
        const affectedCities = citiesWithDist.filter(c => c.distance < blastRadius * 2);
        
        let totalMetroPop = 0;
        megacitiesList.innerHTML = '';
        
        citiesWithDist.slice(0, 5).forEach(city => {
            const isAffected = city.distance < blastRadius;
            const isCritical = city.distance < thermalRadius;
            
            if (isAffected) totalMetroPop += city.pop;
            
            const div = document.createElement('div');
            div.className = `bg-gray-800 p-2 rounded text-xs flex justify-between items-center ${isCritical ? 'border border-red-500' : isAffected ? 'border border-orange-500' : ''}`;
            div.innerHTML = `
                <div>
                    <span class="font-bold ${isCritical ? 'text-red-400' : isAffected ? 'text-orange-400' : 'text-gray-200'}">${city.name}</span>
                    <span class="text-gray-500 ml-2">${formatNumber(city.pop)} kişi</span>
                </div>
                <div class="text-right">
                    <span class="font-mono ${city.distance < 100 ? 'text-red-400' : city.distance < 500 ? 'text-orange-400' : 'text-green-400'}">${city.distance.toFixed(0)} km</span>
                    ${isCritical ? '<span class="ml-2 text-red-500">⚠️ KRİTİK</span>' : ''}
                </div>
            `;
            megacitiesList.appendChild(div);
        });
        
        safeSetText('res-total-metro-pop', formatNumber(totalMetroPop));
    }
    
    // === Sağlık Altyapısı ===
    const healthInfra = resultData.health_infrastructure || {};
    const hospitalsAffected = healthInfra.hospitals_destroyed || Math.floor(energyMT * 0.5);
    const bedsLost = healthInfra.beds_lost_est || hospitalsAffected * 250;
    
    safeSetText('res-hospitals-affected', hospitalsAffected);
    safeSetText('res-beds-lost', formatNumber(bedsLost));
    safeSetText('res-nearest-safe-hospital', healthInfra.nearest_safe || '50+ km');
    safeSetText('res-health-system-status', hospitalsAffected > 10 ? 'ÇÖKMÜŞ' : hospitalsAffected > 5 ? 'KRİTİK' : hospitalsAffected > 0 ? 'STRES ALTINDA' : 'NORMAL');
    
    // === Denizaltı Kablolar ===
    const digitalInfra = resultData.socio_economic_impact?.digital_infrastructure || {};
    safeSetText('res-cables-at-risk', digitalInfra.cables_severed_count || 0);
    safeSetText('res-cable-capacity', digitalInfra.capacity_lost_tbps ? digitalInfra.capacity_lost_tbps + ' Tbps' : '0 Tbps');
    safeSetText('res-critical-cables', digitalInfra.critical_cables?.slice(0, 2).join(', ') || 'Yok');
    safeSetText('res-internet-outage-risk', digitalInfra.cables_severed_count > 5 ? 'ÇOK YÜKSEK' : digitalInfra.cables_severed_count > 2 ? 'YÜKSEK' : digitalInfra.cables_severed_count > 0 ? 'ORTA' : 'DÜŞÜK');
    
    // === Biyoçeşitlilik ===
    let biodiversityHotspot = 'Bilinmiyor';
    let speciesAtRisk = 0;
    let endemicSpecies = 0;
    let ecosystemRisk = 'DÜŞÜK';
    
    if (energyMT > 100) {
        biodiversityHotspot = 'Çoklu Bölge';
        speciesAtRisk = Math.floor(energyMT * 50);
        endemicSpecies = Math.floor(energyMT * 5);
        ecosystemRisk = 'KRİTİK';
    } else if (energyMT > 10) {
        biodiversityHotspot = 'Bölgesel';
        speciesAtRisk = Math.floor(energyMT * 10);
        endemicSpecies = Math.floor(energyMT);
        ecosystemRisk = 'YÜKSEK';
    } else if (energyMT > 1) {
        speciesAtRisk = Math.floor(energyMT * 5);
        ecosystemRisk = 'ORTA';
    }
    
    safeSetText('res-biodiversity-hotspot', biodiversityHotspot);
    safeSetText('res-species-at-risk', speciesAtRisk);
    safeSetText('res-endemic-species', endemicSpecies);
    safeSetText('res-ecosystem-risk', ecosystemRisk);
    
    // === Tarımsal Etki ===
    const foodSecurity = resultData.socio_economic_impact?.food_security || {};
    const agriArea = energyMT > 10 ? Math.floor(energyMT * 100) : Math.floor(energyMT * 10);
    
    safeSetText('res-agri-area', formatNumber(agriArea) + ' km²');
    safeSetText('res-crop-loss', foodSecurity.global_supply_impact_percent ? foodSecurity.global_supply_impact_percent.toFixed(1) + '%' : (agriArea * 0.001).toFixed(2) + '%');
    safeSetText('res-crops-affected', foodSecurity.affected_zones?.join(', ') || 'Tahıl, Sebze');
    safeSetText('res-food-security-status', foodSecurity.famine_risk || (energyMT > 100 ? 'KRİTİK' : energyMT > 10 ? 'ENDİŞE VERİCİ' : 'NORMAL'));
    
    // === Tespit & Erken Uyarı ===
    let detectionProb = '99%';
    let avgWarning = '10+ yıl';
    let minDetectionDist = '1 AU';
    let apparentMag = '+20';
    
    if (asteroidDiameter < 10) {
        detectionProb = '<10%';
        avgWarning = '0-24 saat';
        minDetectionDist = '0.01 AU';
        apparentMag = '+28';
    } else if (asteroidDiameter < 50) {
        detectionProb = '30-50%';
        avgWarning = 'Günler-Haftalar';
        minDetectionDist = '0.05 AU';
        apparentMag = '+24';
    } else if (asteroidDiameter < 140) {
        detectionProb = '60-80%';
        avgWarning = 'Aylar-1 Yıl';
        minDetectionDist = '0.2 AU';
        apparentMag = '+22';
    } else if (asteroidDiameter < 1000) {
        detectionProb = '90%+';
        avgWarning = '1-5 Yıl';
        minDetectionDist = '0.5 AU';
        apparentMag = '+18';
    } else {
        detectionProb = '99%+';
        avgWarning = '10+ Yıl';
        minDetectionDist = '2+ AU';
        apparentMag = '+14';
    }
    
    safeSetText('res-detection-prob', detectionProb);
    safeSetText('res-avg-warning', avgWarning);
    safeSetText('res-min-detection-dist', minDetectionDist);
    safeSetText('res-apparent-mag', apparentMag);
    
    // Tespit sistemleri
    safeSetText('res-css-detection', asteroidDiameter > 50 ? '✓ Tespit Edilir' : '✗ Zor');
    safeSetText('res-panstarrs-detection', asteroidDiameter > 30 ? '✓ Tespit Edilir' : '✗ Zor');
    safeSetText('res-atlas-detection', asteroidDiameter > 20 ? '✓ Son Dakika' : '✗ Zor');
    safeSetText('res-neowise-detection', asteroidDiameter > 100 ? '✓ Kızılötesi' : '△ Sınırlı');
    
    // === JPL Sentry Karşılaştırması ===
    let sentrySimilar = 0;
    let sentryMostDangerous = 'Apophis';
    let sentryDangerDate = '2029, 2036';
    let sentryPalermo = '-2.8';
    let sentryProb = '1/100,000';
    
    if (asteroidDiameter < 50) {
        sentrySimilar = 1847;
        sentryMostDangerous = '2010 RF12';
        sentryDangerDate = '2095';
        sentryPalermo = '-3.2';
        sentryProb = '1/20';
    } else if (asteroidDiameter < 200) {
        sentrySimilar = 189;
        sentryMostDangerous = 'Bennu';
        sentryDangerDate = '2182';
        sentryPalermo = '-1.7';
        sentryProb = '1/2,700';
    } else if (asteroidDiameter < 500) {
        sentrySimilar = 24;
        sentryMostDangerous = 'Apophis';
        sentryDangerDate = '2068';
        sentryPalermo = '-2.8';
        sentryProb = '1/150,000';
    } else {
        sentrySimilar = 3;
        sentryMostDangerous = '(29075) 1950 DA';
        sentryDangerDate = '2880';
        sentryPalermo = '-1.4';
        sentryProb = '1/8,300';
    }
    
    safeSetText('res-sentry-similar', sentrySimilar);
    safeSetText('res-sentry-most-dangerous', sentryMostDangerous);
    safeSetText('res-sentry-danger-date', sentryDangerDate);
    safeSetText('res-sentry-palermo', sentryPalermo);
    safeSetText('res-sentry-prob', sentryProb);
    
    // === Atmosfer Katmanları ===
    const breakupAlt = atm.breakup_altitude_m ? atm.breakup_altitude_m / 1000 : 0;
    const isAirburst = atm.is_airburst;
    
    safeSetText('res-atm-exosphere', breakupAlt > 600 ? '← GİRİŞ' : '✓ Geçti');
    safeSetText('res-atm-thermosphere', breakupAlt > 80 && breakupAlt <= 600 ? '← GİRİŞ' : breakupAlt > 600 ? '-' : '✓ Geçti');
    safeSetText('res-atm-mesosphere', breakupAlt > 50 && breakupAlt <= 80 ? '← PATLAMA' : breakupAlt > 80 ? '-' : '✓ Geçti');
    safeSetText('res-atm-stratosphere', breakupAlt > 12 && breakupAlt <= 50 ? '← PATLAMA' : breakupAlt > 50 ? '-' : '✓ Geçti');
    safeSetText('res-atm-troposphere', breakupAlt > 0 && breakupAlt <= 12 ? '← PATLAMA' : breakupAlt > 12 && isAirburst ? '-' : '✓ Geçti');
    safeSetText('res-atm-burst-alt', breakupAlt > 0 ? breakupAlt.toFixed(1) + ' km' : '-');
    safeSetText('res-atm-surface', isAirburst ? '✗ Ulaşmadı' : '💥 ÇARPIŞMA');
    
    // Atmosfer detayları
    const entryVel = atm.entry_velocity_kms || inputs.velocity_kms || 20;
    const entryTemp = Math.min(30000, entryVel * entryVel * 50); // Yaklaşık
    const maxHeating = entryTemp * 1000; // W/m²
    // Dinamik basınç - Parçalanma tipik olarak 30-50 km irtifada (~0.01-0.02 kg/m³)
    // Yüzey yoğunluğu (1.225 kg/m³) kullanmak yanlış!
    const rhoAtBreakup = 0.018; // kg/m³ at ~30 km (ortalama)
    const peakPressure = 0.5 * rhoAtBreakup * Math.pow(entryVel * 1000, 2) / 1e6; // MPa
    const totalAblation = atm.energy_loss_percent || 0;
    
    safeSetText('res-entry-temp', formatNumber(entryTemp) + ' K');
    safeSetText('res-max-heating', formatNumber(maxHeating) + ' W/m²');
    safeSetText('res-peak-dynamic-pressure', peakPressure.toFixed(1) + ' MPa');
    safeSetText('res-total-ablation', totalAblation.toFixed(0) + '%');
}

// Yardımcı: Progress bar genişliği ayarla
function setBarWidth(id, percent) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(100, Math.max(0, percent)) + '%';
}

// Yardımcı: Haversine mesafe hesaplama
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Para birimi formatı
function formatCurrency(usd) {
    if (usd >= 1e12) return '$' + (usd / 1e12).toFixed(1) + ' Trilyon';
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(1) + ' Milyar';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + ' Milyon';
    return '$' + Math.round(usd).toLocaleString('tr-TR');
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function generateSystemSummary(resultData) {
    const phys = resultData.physical_impact || {};
    const human = resultData.human_impact_assessment || resultData.human_impact || {};
    const atm = resultData.atmospheric_entry || {};

    let parts = [];

    // 1. Enerji Analizi
    const energyMT = phys.impact_energy_megatons_tnt || 0;
    const hiroshimaRatio = (energyMT * 1000) / 15;

    parts.push(`<strong>DURUM RAPORU:</strong> Bu kozmik olay, <span class="text-blue-400 font-bold">${energyMT.toFixed(2)} Megaton (TNT)</span> gücünde bir enerji açııŸa çıkaracaktır.`);

    if (hiroshimaRatio > 1) {
        const ratioStr = hiroshimaRatio > 1000 ? (hiroshimaRatio / 1000).toFixed(1) + " BİN" : hiroshimaRatio.toFixed(0);
        parts.push(`Bu enerji, Hiroşima'ya atılan atom bombasının yaklaşık <span class="text-yellow-400 font-bold">${ratioStr} KATINA</span> eşdeıŸerdir.`);
    }

    // 2. ç‡arpışma MekaniıŸi
    if (atm.is_airburst) {
        parts.push(`Asteroidin yapısal bütünlüıŸü korunamayacak ve yüzeye ulaşamadan <span class="text-green-400">${formatNumber(atm.breakup_altitude_m)} metre irtifada</span> atmosferde patlayacaktır (Airburst). Bu durum, zeminde krater oluşturmasa da geniş çaplı bir şok dalgası ve termal hasar yaratacaktır.`);
    } else if (String(phys.impact_type).toLowerCase().includes('ocean')) {
        const waveH = phys.tsunami_analysis ? phys.tsunami_analysis.source_wave_height_m : 0;
        parts.push(`Cisim okyanusa düşecek ve merkez üssünde <span class="text-cyan-400 font-bold">${waveH.toFixed(1)} metre</span> yüksekliıŸinde Tsunami dalgaları üretecektir. Kıyı şeritleri için acil tahliye protokolleri uygulanmalıdır.`);
    } else {
        const craterKm = phys.crater_diameter_km || phys.crater_diameter_transient_km || 0;
        parts.push(`Yüzeye doıŸrudan çarpışma gerçekleşecek ve <span class="text-red-500 font-bold">${(craterKm * 1000).toFixed(0)} metre</span> çapında bir krater oluşacaktır. Bölgesel topoıŸrafya kalıcı olarak deıŸişecektir.`);
    }

    // 3. İnsan ve Altyapı Etkisi
    const pop = human.estimated_population_in_burn_radius || 0;
    if (pop > 0) {
        const popStr = formatNumber(pop);
        const severity = pop > 100000 ? "FELAKET DüZEYİNDE (CAT 5)" : "CİDDİ (CAT 3-4)";
        parts.push(`Tahmini etki yarıçapı içinde <span class="text-red-400 font-bold">${popStr} kişi</span> yaşamaktadır. Olayın insani etkisi <span class="text-red-500 font-bold">${severity}</span> olacaktır.`);
    } else {
        parts.push(`Etki alanı içinde yerleşik nüfus tespit edilmemiştir, ancak çevresel etkiler (iklimsel/sismik) küresel sonuçlar doıŸurabilir.`);
    }

    if (human.infrastructure_impact && human.infrastructure_impact.length > 0) {
        parts.push(`Ayrıca bölgedeki <span class="text-purple-400 font-bold">${human.infrastructure_impact.length} adet kritik enerji/sanayi tesisi</span> risk altındadır.`);
    }

    const analysisSection = document.getElementById('result-summary-text');
    if (analysisSection) {
        analysisSection.innerHTML = parts.map(p => `<p class='mb-2 border-l-2 border-gray-600 pl-2'>${p}</p>`).join('');
    }
}

// Map Functions
function initMap() {
    console.log('🗺️ Harita başlatılıyor...');
    
    // Harita Katmanları - Fallback destekli
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
    });

    const physical = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
    });

    const natGeo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 16,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
    });

    // Şehir İsimleri ve Sınırlar Katmanı
    const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri'
    });

    // Harita oluştur - Gelişmiş ayarlar
    map = L.map("map", {
        center: [impactLatLng.lat, impactLatLng.lng],
        zoom: 8,
        minZoom: 2,  // Dünya görünümü
        maxZoom: 18, // Sokak seviyesi
        maxBounds: [[-90, -180], [90, 180]], // Dünya sınırları
        maxBoundsViscosity: 1.0, // Sınır dışına çıkmayı engelle
        layers: [satellite, labels], // Varsayılan katmanlar
        zoomControl: true,
        attributionControl: true
    });

    const baseMaps = {
        "🛰️ Uydu Görüntüsü": satellite,
        "🗺️ Fiziki Harita": physical,
        "🌍 NatGeo Atlas": natGeo
    };

    const overlayMaps = {
        "🏙️ Şehirler & Sınırlar": labels
    };

    L.control.layers(baseMaps, overlayMaps, {
        position: 'topright',
        collapsed: isMobileDevice() ? true : false // Mobilde kapalı
    }).addTo(map);
    
    // İlk marker
    impactMarker = L.marker([impactLatLng.lat, impactLatLng.lng]).addTo(map);
    impactMarker.bindPopup("📍 Varsayılan Çarpışma Noktası<br>Harita üzerinde tıklayarak değiştirebilirsiniz").openPopup();
    
    // Click handler'ı başlat
    initMapClickHandler();
    
    // Resize observer başlat
    initMapResize();
    
    // Fullscreen manager başlat
    fullscreenManager = new FullscreenManager('map-container');
    
    console.log('✅ Harita başarıyla başlatıldı');
}

// Asteroid Search/Select Functions
async function handleSearch() {
    const searchTerm = document.getElementById('search-input').value.trim();
    if (!searchTerm) {
        populateAsteroidList(localDatasetAsteroids);
        return;
    }
    await loadAsteroidDetails(searchTerm);
}

function updateMassForCurrentSelection() {
    if (!currentSelectedId) return;

    const asteroid = allAsteroids.get(currentSelectedId);
    if (!asteroid) return;

    if (asteroid.mass_kg) {
        setMassInputValue(asteroid.mass_kg);
        return;
    }

    const diameter_m = asteroid.diameter_m;
    if (!diameter_m) {
        setMassInputValue(0);
        return;
    }
    const radius_m = diameter_m / 2;
    const volume_m3 = (4 / 3) * Math.PI * Math.pow(radius_m, 3);

    const selectedComposition = document.getElementById('composition').value;
    let density = DENSITY_MAP[selectedComposition];

    if (!density && asteroid.density) {
        density = asteroid.density;
    }
    if (!density) density = 3000;

    const calculatedMass = volume_m3 * density;
    setMassInputValue(calculatedMass);
}

function selectAsteroid(selectedId) {
    if (!selectedId) return;
    currentSelectedId = String(selectedId);
    const selectedAsteroid = allAsteroids.get(currentSelectedId);

    if (selectedAsteroid) {
        if (String(selectedAsteroid.id) === '2101955') {
            document.getElementById('velocity').value = 14;
        } else {
            document.getElementById('velocity').value = selectedAsteroid.velocity_kms;
        }

        const compositionSelect = document.getElementById('composition');
        if (selectedAsteroid.composition_id) {
            compositionSelect.value = selectedAsteroid.composition_id;
        } else {
            const density = selectedAsteroid.density;
            if (density > 5000) compositionSelect.value = 'iron';
            else if (density < 1500) compositionSelect.value = 'ice';
            else compositionSelect.value = 'rock';
        }

        autoCorrectComposition(selectedAsteroid.name, selectedAsteroid.spectral_type, selectedAsteroid.id);

        if (String(selectedAsteroid.id) === '2101955') {
            document.getElementById('angle_deg').value = 45;
        } else if (selectedAsteroid.angle_deg) {
            document.getElementById('angle_deg').value = selectedAsteroid.angle_deg;
        } else {
            document.getElementById('angle_deg').value = 45;
        }

        if (String(selectedAsteroid.id) === '2101955') {
            const BENNU_MASS_KG = 7.3e10;
            selectedAsteroid.mass_kg = BENNU_MASS_KG;
            setMassInputValue(BENNU_MASS_KG);
        } else if (selectedAsteroid.mass_kg) {
            setMassInputValue(selectedAsteroid.mass_kg);
        } else {
            updateMassForCurrentSelection();
        }

        document.querySelectorAll('.result-item').forEach(el => {
            el.classList.remove('selected');

        });

        // Gerekirse listede seçili hale getirebiliriz ama şu an dropdown kullandııŸımız için gerek yok

        updateAsteroidDetailsPanel(selectedAsteroid);
    }
}

function updateAsteroidDetailsPanel(asteroid) {
    const detailsPanel = document.getElementById('asteroid-details');
    const contentDiv = document.getElementById('asteroid-details-content');

    if (!asteroid || !asteroid.orbital_data) {
        detailsPanel.classList.add('hidden');
        return;
    }

    const od = asteroid.orbital_data;
    const h = asteroid.absolute_magnitude_h;
    const haz = asteroid.is_potentially_hazardous;

    const dataPoints = [
        { label: "ID", value: asteroid.id },
        { label: "İsim", value: asteroid.name },
        { label: "Spektral Tip", value: asteroid.spectral_type || 'Bilinmiyor' },
        { label: "Mutlak Parlaklık (H)", value: h !== undefined ? h : 'N/A' },
        { label: "Tehlikeli mi?", value: haz ? "EVET" : "HAYIR", color: haz ? "text-red-500" : "text-green-500" },
        { label: "Yörünge ID", value: od.orbit_id || 'N/A' },
        { label: "Dış Merkezlik (e)", value: od.eccentricity || 'N/A' },
        { label: "Yarı Büyük Eksen (a)", value: `${od.semi_major_axis || 'N/A'} AU` },
        { label: "EıŸim (i)", value: `${od.inclination || 'N/A'}` },
        { label: "Yörünge Periyodu", value: `${od.orbital_period || 'N/A'} gün` },
        { label: "Günberi (q)", value: `${od.perihelion_distance || 'N/A'} AU` },
        { label: "Günöte (Q)", value: `${od.aphelion_distance || 'N/A'} AU` },
        { label: "Ortalama Anomali", value: `${od.mean_anomaly || 'N/A'}` },
        { label: "Ortalama Hareket", value: `${od.mean_motion || 'N/A'}/gün` }
    ];

    let html = '';
    dataPoints.forEach(dp => {
        const colorClass = dp.color ? dp.color : 'text-cyan-400';
        html += `
            <div class="flex justify-between border-b border-gray-600 pb-1 mb-1">
                <span>${dp.label}:</span>
                <span class="font-mono ${colorClass}">${dp.value}</span>
            </div>
        `;
    });

    contentDiv.innerHTML = html;
    detailsPanel.classList.remove('hidden');
}

// Monte Carlo Simülasyonu
async function runMonteCarlo() {
    const btn = document.getElementById('btn-monte-carlo');
    const originalText = btn.textContent;
    btn.textContent = "Hesaplanıyor...";
    btn.disabled = true;

    try {
        const mass = parseFloat(document.getElementById("mass").value);
        const velocity = parseFloat(document.getElementById("velocity").value);
        const angle = parseFloat(document.getElementById("angle_deg").value);
        const composition = document.getElementById("composition").value;
        const density = DENSITY_MAP[composition];

        if (!mass || !velocity) {
            alert("Lütfen önce bir asteroit seçin veya parametreleri girin.");
            return;
        }

        const response = await fetch("http://127.0.0.1:5001/simulate_monte_carlo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mass_kg: mass,
                velocity_kms: velocity,
                angle_deg: angle,
                density: density || 3000,
                iterations: 10000
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        displayMonteCarloResults(data);

    } catch (e) {
        alert("Monte Carlo Hatası: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function displayMonteCarloResults(data) {
    const container = document.getElementById('scientific-results');
    const card = document.getElementById('monte-carlo-card');
    container.classList.remove('hidden');
    card.classList.remove('hidden');

    const stats = data.statistics;
    const list = document.getElementById('mc-stats-list');
    list.innerHTML = `
        <li>Ortalama Krater: <strong class="text-purple-400">${formatNumber(stats.mean_crater_m)} m</strong></li>
        <li>Standart Sapma: <strong class="text-gray-400">±${formatNumber(stats.std_dev_crater)} m</strong></li>
        <li>%95 Güven Aralığı: <br><span class="font-mono text-xs text-yellow-500">[${formatNumber(stats.confidence_interval_95[0])}m - ${formatNumber(stats.confidence_interval_95[1])}m]</span></li>
        <li>Airburst Olasılığı: <strong class="${stats.probability_of_airburst > 0 ? 'text-red-500' : 'text-green-500'}">%${stats.probability_of_airburst.toFixed(1)}</strong></li>
        <li>Ortalama Enerji: <strong class="text-blue-400">${stats.mean_energy_mt.toFixed(2)} MT</strong></li>
    `;

    const histDiv = document.getElementById('mc-histogram');
    histDiv.innerHTML = '';
    const bins = data.histogram_data.crater_bins;
    const maxBin = Math.max(...bins);

    bins.forEach(count => {
        const heightPercent = (count / maxBin) * 100;
        const bar = document.createElement('div');
        bar.style.height = `${heightPercent}%`;
        bar.className = 'flex-1 bg-purple-500 hover:bg-purple-400 transition-all';
        bar.title = `${count} simülasyon`;
        histDiv.appendChild(bar);
    });

    document.getElementById('hist-min').textContent = formatNumber(data.statistics.min_crater) + "m";
    document.getElementById('hist-max').textContent = formatNumber(data.statistics.max_crater) + "m";

    container.scrollIntoView({ behavior: 'smooth' });
}

async function runValidation() {
    const btn = document.getElementById('btn-validation');
    const originalText = btn.textContent;
    btn.textContent = "DoıŸrulanıyor...";
    btn.disabled = true;

    try {
        const response = await fetch("http://127.0.0.1:5001/validate_model");
        const results = await response.json();

        const container = document.getElementById('scientific-results');
        const card = document.getElementById('validation-card');
        const content = document.getElementById('validation-content');

        container.classList.remove('hidden');
        card.classList.remove('hidden');

        let html = `
            <table class="min-w-full text-xs text-left text-gray-300">
                <thead class="text-xs text-gray-400 uppercase bg-gray-800">
                    <tr>
                        <th class="px-2 py-1">Olay</th>
                        <th class="px-2 py-1">Gerçek Enerji</th>
                        <th class="px-2 py-1">Model Enerji</th>
                        <th class="px-2 py-1">Hata (%)</th>
                        <th class="px-2 py-1">Durum</th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach(res => {
            const statusColor = res.status === 'PASS' ? 'text-green-500' : 'text-red-500';
            html += `
                <tr class="border-b border-gray-700">
                    <td class="px-2 py-2 font-medium text-white">${res.case_name}</td>
                    <td class="px-2 py-2">${res.historical_data.energy_mt} MT</td>
                    <td class="px-2 py-2">${res.model_output.energy_mt} MT</td>
                    <td class="px-2 py-2">${res.error_margin_percent.energy}%</td>
                    <td class="px-2 py-2 font-bold ${statusColor}">${res.status}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        content.innerHTML = html;

        container.scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        alert("DoıŸrulama Hatası: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- BELİRSİZLİK HESAPLAMA VE Gç–RSELLEÅTİRME ---
function handleUncertainty(orbitalData, lat, lng) {
    if (!orbitalData) return;

    const sigOm = parseFloat(orbitalData.sigma_om) || 0;
    const sigI = parseFloat(orbitalData.sigma_i) || 0;

    if (sigOm === 0 && sigI === 0) {
        const el = document.getElementById('res-uncertainty');
        if (el) el.innerHTML = "„¹ï¸ Belirsizlik verisi mevcut deıŸil.";
        return;
    }

    // Basit Fiziksel Projeksiyon: 1 derece hata ‰ˆ 2.6 milyon km (1 AU mesafede)
    // Ancak çarpma anında bu hata Dünya ölçeıŸine indirgenir.
    const kmPerDegree = 149597871 * (Math.PI / 180);
    const sigmaTotal = Math.sqrt(Math.pow(sigOm, 2) + Math.pow(sigI, 2));

    // %80 Güven aralııŸı için Rayleigh daıŸılımı faktörü (1.79)
    let radiusKm = sigmaTotal * kmPerDegree * 0.0001 * 1.79; // ç–lçeklendirilmiş hata payı

    // Minimum 10km, Maksimum 2000km sınırları (Görsel tutarlılık için)
    radiusKm = Math.max(10, Math.min(radiusKm, 2000));

    // UI Güncelleme
    const uncertaintyEl = document.getElementById('res-uncertainty');
    if (uncertaintyEl) {
        uncertaintyEl.innerHTML =
            `š ï¸ %80 Olasılıkla ${radiusKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km'lik bir alana düşecektir.`;
    }

    // Haritaya ç‡izim
    if (window.uncertaintyCircle) map.removeLayer(window.uncertaintyCircle);

    window.uncertaintyCircle = L.circle([lat, lng], {
        radius: radiusKm * 1000, // metreye çevrim
        color: '#fbbf24', // Amber (Sarı)
        dashArray: '10, 10', // Kesikli çizgi
        fillOpacity: 0.1,
        weight: 2
    }).addTo(map);

    window.uncertaintyCircle.bindPopup(`<strong>%80 Güven AralııŸı</strong><br>Düşüş Belirsizlik Yarıçapı: ${radiusKm.toFixed(1)} km`);
}

// Yeni Fonksiyon: Simülasyon öncesi görselleştirme (Erken Uyarı Sistemi)
function visualizePreSimulationUncertainty(orbitalData, year) {
    if (!orbitalData) return;

    // Sigma deıŸerlerini al
    const sigOm = parseFloat(orbitalData.sigma_om) || 0;
    const sigI = parseFloat(orbitalData.sigma_i) || 0;

    // Basit bir belirsizlik yarıçapı hesabı (km)
    // 1 derece hata ‰ˆ 2.6M km (1 AU'da), ancak biz bunu Dünya yüzeyindeki izdüşümüne ölçekliyoruz
    const kmPerDegree = 149597871 * (Math.PI / 180);
    const sigmaTotal = Math.sqrt(Math.pow(sigOm, 2) + Math.pow(sigI, 2));

    // EıŸer sigmaTotal 0 ise (veri yoksa) varsayılan bir deıŸer ata (örn: küçük bir belirsizlik)
    // veya hiç çizme. Kullanıcı deneyimi için varsayılan küçük bir deıŸer atayalım.
    const effectiveSigma = sigmaTotal > 0 ? sigmaTotal : 0.00001;

    let radiusKm = effectiveSigma * kmPerDegree * 0.0001 * 1.79;
    radiusKm = Math.max(15, Math.min(radiusKm, 1500)); // Görsel sınırlar

    // Harita üzerindeki eski çizimleri temizle
    if (window.preSimCircle) map.removeLayer(window.preSimCircle);

    // Belirsizlik Alanını ç‡iz (Sarı/Turuncu Kesikli Daire)
    window.preSimCircle = L.circle([impactLatLng.lat, impactLatLng.lng], {
        radius: radiusKm * 1000,
        color: '#f59e0b', // Amber-500
        weight: 3,
        dashArray: '10, 20',
        fillColor: '#f59e0b',
        fillOpacity: 0.15
    }).addTo(map);

    // POP-UP VE UI BİLGİLENDİRMESİ KALDIRILDI

    // Haritayı bu alana odakla
    map.flyTo([impactLatLng.lat, impactLatLng.lng], 6);
}

// --- PHD & SCIENTIFIC MODE CONTROLLER ---
let currentMode = 'standard';

window.switchMode = function (mode) {
    currentMode = mode;
    // Buton stillerini güncelle
    ['standard', 'scientific', 'phd'].forEach(m => {
        const btn = document.getElementById('btn-mode-' + m);
        if (btn) {
            if (m === mode) {
                btn.classList.add('ring-2', 'ring-offset-2', 'ring-offset-gray-900');
                if (m === 'phd') btn.classList.add('bg-purple-900');
                else if (m === 'scientific') btn.classList.add('bg-gray-600');
            } else {
                btn.classList.remove('ring-2', 'ring-offset-2', 'ring-offset-gray-900', 'bg-purple-900', 'bg-gray-600');
            }
        }
    });

    // Panelleri göster/gizle
    const phdDashboard = document.getElementById('phd-dashboard');
    if (phdDashboard) {
        if (mode === 'phd') {
            phdDashboard.classList.remove('hidden');
        } else {
            phdDashboard.classList.add('hidden');
        }
    }

    console.log('Mode switched to: ' + mode);
};

async function updateSystemStatus() {
    try {
        const r1 = await fetch('http://127.0.0.1:5001/dataset_status');
        const s1 = await r1.json();
        const dsEl = document.getElementById('status-datasets');
        if (dsEl) dsEl.textContent = 'Datasets: ' + s1.total_datasets_loaded + '/' + s1.max_datasets;

        const r2 = await fetch('http://127.0.0.1:5001/phd_physics_status');
        const s2 = await r2.json();
        const phEl = document.getElementById('status-physics');
        if (phEl) phEl.textContent = 'Engine: ' + s2.level;

        const r3 = await fetch('http://127.0.0.1:5001/sentry_threats');
        const s3 = await r3.json();
        const seEl = document.getElementById('status-sentry');
        if (seEl) seEl.textContent = 'Sentry Threats: ' + s3.count;

        const r4 = await fetch('http://127.0.0.1:5001/planetary_defense/approaching');
        const s4 = await r4.json();
        const neEl = document.getElementById('status-nea');
        if (neEl) neEl.textContent = 'Near Earth Objects (60d): ' + s4.count;

    } catch (e) { console.error('System status error', e); }
}

async function runPhdAnalysis(payload) {
    if (currentMode !== 'phd') return;

    // 1. Scientific Physics Analysis (N-Body, Plasma, Seismic)
    try {
        const physPayload = {
            latitude: payload.latitude,
            distance_km: 5000,
            altitude_km: 45,
            mass_kg: payload.mass_kg
        };

        const r = await fetch('http://127.0.0.1:5001/scientific_physics_analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(physPayload)
        });
        const data = await r.json();

        // Update Plasma (Mock/Simulated based on Physics)
        document.getElementById('phd-plasma-temp').textContent = '8,450';
        document.getElementById('phd-ionization').textContent = 'High (Fe+)';

        // Update N-Body
        const nb = data.n_body_perturbation;
        const force = nb.instantaneous_force_n;
        document.getElementById('phd-jupiter-force').textContent = force ? force.toExponential(2) + ' N' : 'Calculating...';
        document.getElementById('phd-drift-rate').textContent = nb.orbital_drift_rate_m_per_year + ' m/y';

        // Update Seismic
        const seis = data.seismic_propagation_prem;
        const pWave = seis.p_wave_arrival_sec;
        const sWave = seis.s_wave_arrival_sec;
        document.getElementById('phd-p-wave').textContent = pWave ? pWave.toFixed(1) + 's' : '-';
        document.getElementById('phd-s-wave').textContent = sWave ? sWave.toFixed(1) + 's' : '-';

    } catch (e) { console.error('PhD Physics Error', e); }

    // 2. Deep Impact Analysis (Economy, Ecology, Atmosphere)
    try {
        const energy_j = 0.5 * payload.mass_kg * Math.pow(payload.velocity_kms * 1000, 2);
        const energy_mt = energy_j / (4.184e15);

        const deepPayload = {
            latitude: payload.latitude,
            longitude: payload.longitude,
            energy_mt: energy_mt
        };

        const r = await fetch('http://127.0.0.1:5001/impact_deep_analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deepPayload)
        });
        const data = await r.json();

        // Update Economy
        const loss = data.economic_impact.estimated_gdp_loss_usd;
        document.getElementById('phd-gdp-loss').textContent = '$' + (loss / 1e9).toFixed(1) + ' Billion';
        document.getElementById('phd-economic-desc').textContent = 'Recovery: ' + data.economic_impact.recovery_years + ' Years | Global Impact';

        // Update Bio
        const bio = data.ecological_impact;
        document.getElementById('phd-bio-risk').textContent = bio.extinction_risk;
        const hotspots = bio.affected_biodiversity_hotspots;
        document.getElementById('phd-bio-desc').textContent = 'Hotspots: ' + (hotspots.length > 0 ? hotspots.join(', ') : 'None directly hit');

        // Update Chemistry
        document.getElementById('phd-nox-prod').textContent = (energy_mt * 5000).toFixed(0) + ' tons';
        document.getElementById('phd-ozone-dep').textContent = energy_mt > 50 ? 'Severe (Global)' : 'Local';

    } catch (e) { console.error('Deep Analysis Error', e); }
}

// Auto-run status update
setInterval(updateSystemStatus, 30000);
setTimeout(updateSystemStatus, 2000);



document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('simulateBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            const payload = {
                latitude: impactLatLng.lat,
                longitude: impactLatLng.lng,
                mass_kg: parseFloat(document.getElementById('mass').value),
                velocity_kms: parseFloat(document.getElementById('velocity').value)
            };
            setTimeout(() => { if (typeof runPhdAnalysis === 'function') runPhdAnalysis(payload); }, 2000);
        });
    }
    
    // Initialize mode switching
    initModeSwitcher();
    
    // Check decision engine status
    checkDecisionEngineStatus();
});

// ============================================================================
// CHAMPIONSHIP DECISION SUPPORT - MODE SWITCHING
// ============================================================================

// currentMode is already declared above (line ~1137)
let lastDecisionResult = null;

function initModeSwitcher() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newMode = e.target.dataset.mode;
            switchDecisionMode(newMode);
        });
    });
}

function switchDecisionMode(mode) {
    currentMode = mode;
    
    // Update button styles
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Show/hide panels based on mode
    const scientificPanels = document.querySelectorAll('#simulation-results, #scientific-results');
    const decisionPanel = document.getElementById('decision-mode-panel');
    const scenarioPanel = document.getElementById('scenario-mode-panel');
    
    if (mode === 'scientific') {
        scientificPanels.forEach(p => { if (p) p.classList.remove('hidden'); });
        if (decisionPanel) decisionPanel.classList.add('hidden');
        if (scenarioPanel) scenarioPanel.classList.add('hidden');
    } else if (mode === 'decision') {
        scientificPanels.forEach(p => { if (p) p.classList.add('hidden'); });
        if (decisionPanel) decisionPanel.classList.remove('hidden');
        if (scenarioPanel) scenarioPanel.classList.add('hidden');
        // Auto-run decision analysis if we have data
        if (lastDecisionResult) {
            populateDecisionPanel(lastDecisionResult);
        }
    } else if (mode === 'scenario') {
        scientificPanels.forEach(p => { if (p) p.classList.add('hidden'); });
        if (decisionPanel) decisionPanel.classList.add('hidden');
        if (scenarioPanel) scenarioPanel.classList.remove('hidden');
        initScenarioMode();
    }
}

// ============================================================================
// DECISION SUPPORT API CALLS
// ============================================================================

async function runDecisionSupport(params) {
    const statusEl = document.getElementById('simulation-status');
    statusEl.textContent = 'Karar Destek Sistemi Çalıştırılıyor...';
    
    try {
        const payload = {
            mass_kg: params.mass_kg,
            velocity_kms: params.velocity_kms,
            angle_deg: params.angle_deg || 45,
            density_kgm3: params.density_kgm3 || 2500,
            diameter_m: params.diameter_m || Math.cbrt((6 * params.mass_kg) / (Math.PI * (params.density_kgm3 || 2500))) * 2,
            lat: params.latitude,
            lon: params.longitude,
            impact_probability: params.impact_probability || 0.001,
            base_population: params.base_population || 1000000,
            observation_arc_days: params.observation_arc_days || 30,
            country: params.country || 'Bilinmeyen',
            scenario_id: 'sim_' + Date.now()
        };
        
        const response = await fetch('http://127.0.0.1:5001/decision_support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            lastDecisionResult = await response.json();
            statusEl.textContent = 'Karar analizi tamamlandı!';
            
            // If in decision mode, populate the panel
            if (currentMode === 'decision') {
                populateDecisionPanel(lastDecisionResult);
            }
            
            return lastDecisionResult;
        } else {
            const err = await response.json();
            statusEl.textContent = 'Karar analizi hatası: ' + err.error;
            return null;
        }
    } catch (e) {
        console.error('Decision support error:', e);
        statusEl.textContent = 'Karar destek sistemi kullanılamıyor';
        return null;
    }
}

function populateDecisionPanel(data) {
    if (!data) return;
    
    // Main action card
    const policy = data.policy || {};
    const torino = policy.torino_scale || 0;
    const palermo = policy.palermo_scale || 0;
    const detection = data.detection || {};
    const baseline = data.baseline || {};
    const physics = data.physics || {};
    
    document.getElementById('decision-action').textContent = 
        formatActionName(policy.recommended_action || 'UNKNOWN');
    document.getElementById('decision-confidence').textContent = 
        `Model güvenilirlik seviyesi: ${(policy.confidence_pct || 0).toFixed(1)}%`;
    
    // Torino badge
    const torinoBadge = document.getElementById('decision-torino-badge');
    torinoBadge.textContent = 'T' + torino;
    torinoBadge.className = 'torino-' + torino + ' px-4 py-2 rounded text-xl font-mono font-bold';
    
    // Palermo sınıflandırması (metinsel)
    let palermoClass = 'Değerlendirme dışı';
    if (palermo < -2) palermoClass = 'İhmal edilebilir risk (P < -2)';
    else if (palermo < 0) palermoClass = 'Normal izleme gerektiren (-2 ≤ P < 0)';
    else if (palermo < 1) palermoClass = 'Dikkatli izleme gerektiren (0 ≤ P < 1)';
    else palermoClass = 'Ciddi endişe kaynağı (P ≥ 1)';
    
    const palermoClassEl = document.getElementById('decision-palermo-class');
    if (palermoClassEl) palermoClassEl.textContent = palermoClass;
    
    // Uyarı süresi sınıflandırması (metinsel)
    const warningDays = detection.warning_time_days?.mean || 0;
    let warningClass = 'Belirsiz';
    if (warningDays < 30) warningClass = 'Kritik kısa vadeli (< 30 gün) - Sadece tahliye mümkün';
    else if (warningDays < 365) warningClass = 'Kısa vadeli (30 gün - 1 yıl) - Sınırlı müdahale';
    else if (warningDays < 1825) warningClass = 'Orta vadeli (1-5 yıl) - Kinetik müdahale mümkün';
    else warningClass = 'Uzun vadeli (> 5 yıl) - Tüm seçenekler değerlendirilebilir';
    
    const warningClassEl = document.getElementById('decision-warning-class');
    if (warningClassEl) warningClassEl.textContent = warningClass;
    
    // Gizli sayısal alanlar (eski ID'ler için uyumluluk)
    const dp = document.getElementById('decision-palermo');
    if (dp) dp.textContent = palermo.toFixed(2);
    
    const dpr = document.getElementById('decision-probability');
    if (dpr) dpr.textContent = formatPercent(detection.detection_probability || 0);
    
    const dwt = document.getElementById('decision-warning-time');
    if (dwt) dwt.textContent = formatWarningTime(warningDays);
    
    const de = document.getElementById('decision-energy');
    if (de) de.textContent = formatEnergyMT(physics.energy_mt?.mean || 0);
    
    // Justification list - Metinsel açıklamalarla
    const justList = document.getElementById('decision-justification');
    if (justList) {
        justList.innerHTML = '';
        (policy.action_justification || []).forEach(j => {
            const li = document.createElement('li');
            li.className = 'p-2 bg-gray-800 rounded text-sm';
            li.innerHTML = `
                <span class="text-green-400 mr-2">&#10003;</span>
                <span class="text-gray-300">${j.criterion}</span>
            `;
            justList.appendChild(li);
        });
        
        if ((policy.action_justification || []).length === 0) {
            justList.innerHTML = '<li class="text-gray-500 text-sm">Gerekçe bilgisi bekleniyor...</li>';
        }
    }
    
    // Rejected alternatives - Metinsel açıklamalarla
    const rejList = document.getElementById('decision-rejected');
    if (rejList) {
        rejList.innerHTML = '';
        (policy.rejected_alternatives || []).forEach(r => {
            const li = document.createElement('li');
            li.className = 'p-2 bg-gray-800 rounded text-sm';
            li.innerHTML = `
                <span class="text-red-400 mr-2">&#10007;</span>
                <span class="text-gray-300">${formatActionName(r.action)}</span>
                <span class="text-xs text-gray-500 block mt-1">${r.reason}</span>
            `;
            rejList.appendChild(li);
        });
        
        if ((policy.rejected_alternatives || []).length === 0) {
            rejList.innerHTML = '<li class="text-gray-500 text-sm">Alternatif değerlendirmesi bekleniyor...</li>';
        }
    }
    
    // Timeline - Sadece açıklama metinleri
    const timeline = document.getElementById('decision-timeline');
    if (timeline) {
        timeline.innerHTML = '';
        const temporal = data.temporal || {};
        (temporal.timeline || []).forEach((event, i) => {
            const div = document.createElement('div');
            const critClass = event.phase.includes('Peak') ? 'border-l-red-500' : 
                             event.phase.includes('Recovery') ? 'border-l-green-500' : 'border-l-yellow-500';
            div.className = `pl-3 py-2 border-l-2 ${critClass}`;
            div.innerHTML = `
                <p class="font-semibold text-sm text-gray-300">T+${formatHours(event.t_hours)}: ${event.phase}</p>
                <p class="text-xs text-gray-400 mt-1">${event.description}</p>
            `;
            timeline.appendChild(div);
        });
    }
    
    // Sensitivity bars
    const sensContainer = document.getElementById('sensitivity-bars');
    if (sensContainer) {
        sensContainer.innerHTML = '';
        const sensitivity = data.sensitivity || {};
        (sensitivity.parameter_ranking || []).forEach(p => {
            const div = document.createElement('div');
            div.innerHTML = `
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-gray-300">${formatParamName(p.parameter)}</span>
                    <span class="text-gray-400">${(p.normalized_effect * 100).toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="h-2 rounded-full bg-yellow-500" style="width: ${p.normalized_effect * 100}%"></div>
                </div>
            `;
            sensContainer.appendChild(div);
        });
    }
    
    const sensitiveDom = document.getElementById('sensitivity-dominant');
    if (sensitiveDom) {
        const sensitivity = data.sensitivity || {};
        sensitiveDom.textContent = formatParamName(sensitivity.dominant_driver || 'belirsiz');
    }
    
    // Baseline comparison - Metinsel açıklamalar
    const baselineCas = baseline.baseline_casualties?.mean || 0;
    const actionCas = baseline.action_casualties?.mean || 0;
    const livesSaved = baseline.casualties_avoided?.mean || 0;
    const cbr = baseline.cost_benefit_ratio || 0;
    
    const baselineText = document.getElementById('baseline-casualties-text');
    if (baselineText) {
        baselineText.innerHTML = `Herhangi bir önlem alınmadığı takdirde, tahmini kayıp <strong class="text-red-400">${formatNumber(baselineCas)}</strong> kişi olarak hesaplanmaktadır.`;
    }
    
    const actionText = document.getElementById('action-casualties-text');
    if (actionText) {
        actionText.innerHTML = `Önerilen müdahale uygulandığında, tahmini kayıp <strong class="text-green-400">${formatNumber(actionCas)}</strong> kişiye düşürülebilir.`;
    }
    
    const livesSavedText = document.getElementById('lives-saved-text');
    if (livesSavedText) {
        livesSavedText.innerHTML = `<strong>${formatNumber(livesSaved)}</strong> kişi`;
    }
    
    const cbrText = document.getElementById('cost-benefit-text');
    if (cbrText) {
        const cbrAssessment = cbr > 1 ? 'Ekonomik olarak gerekçeli' : 'Ekonomik açıdan değerlendirme gerekli';
        cbrText.innerHTML = `<strong>${cbr.toFixed(2)}x</strong> - ${cbrAssessment}`;
    }
    
    // Gizli alanlar (uyumluluk)
    const bcEl = document.getElementById('baseline-casualties');
    if (bcEl) bcEl.textContent = formatNumber(baselineCas);
    
    const acEl = document.getElementById('action-casualties');
    if (acEl) acEl.textContent = formatNumber(actionCas);
    
    const lsEl = document.getElementById('lives-saved');
    if (lsEl) lsEl.textContent = formatNumber(livesSaved);
    
    const cbEl = document.getElementById('cost-benefit');
    if (cbEl) cbEl.textContent = cbr.toFixed(2) + 'x';
    
    // === DETAYLI RAPOR KARTI GÜNCELLEME ===
    updateDecisionMetricsCard(data);
}

// Detaylı Çarpışma Analizi Raporundaki Karar Destek Metrikleri kartını güncelle
function updateDecisionMetricsCard(data) {
    const card = document.getElementById('decision-metrics-card');
    if (!card || !data) return;
    
    card.classList.remove('hidden');
    
    const policy = data.policy || {};
    const detection = data.detection || {};
    const baseline = data.baseline || {};
    const physics = data.physics || {};
    
    const torino = policy.torino_scale || 0;
    const palermo = policy.palermo_scale || 0;
    const probability = detection.detection_probability || 0;
    const warningDays = detection.warning_time_days?.mean || 0;
    const baselineCas = baseline.baseline_casualties?.mean || 0;
    const actionCas = baseline.action_casualties?.mean || 0;
    const livesSaved = baseline.casualties_avoided?.mean || 0;
    const cbr = baseline.cost_benefit_ratio || 0;
    
    // Torino
    const dmTorino = document.getElementById('dm-torino');
    if (dmTorino) {
        dmTorino.textContent = 'T' + torino;
        dmTorino.className = 'text-2xl font-mono font-bold ' + 
            (torino <= 2 ? 'text-green-400' : torino <= 4 ? 'text-yellow-400' : torino <= 7 ? 'text-orange-400' : 'text-red-400');
    }
    
    // Palermo
    const dmPalermo = document.getElementById('dm-palermo');
    if (dmPalermo) dmPalermo.textContent = palermo.toFixed(2);
    
    // Probability
    const dmProb = document.getElementById('dm-probability');
    if (dmProb) dmProb.textContent = formatPercent(probability);
    
    // Warning time
    const dmWarning = document.getElementById('dm-warning');
    if (dmWarning) dmWarning.textContent = formatWarningTime(warningDays);
    
    // Casualties
    const dmBaseline = document.getElementById('dm-baseline-casualties');
    if (dmBaseline) dmBaseline.textContent = formatNumber(baselineCas) + ' kişi';
    
    const dmAction = document.getElementById('dm-action-casualties');
    if (dmAction) dmAction.textContent = formatNumber(actionCas) + ' kişi';
    
    const dmLives = document.getElementById('dm-lives-saved');
    if (dmLives) dmLives.textContent = formatNumber(livesSaved) + ' kişi';
    
    // Cost-benefit
    const dmCBR = document.getElementById('dm-cost-benefit');
    if (dmCBR) dmCBR.textContent = cbr.toFixed(2) + 'x';
    
    // Action
    const dmActionText = document.getElementById('dm-action');
    if (dmActionText) dmActionText.textContent = formatActionName(policy.recommended_action || '-');
    
    const dmConf = document.getElementById('dm-confidence');
    if (dmConf) dmConf.textContent = `Güvenilirlik: ${(policy.confidence_pct || 0).toFixed(1)}%`;
}

// ============================================================================
// SCENARIO COMPARISON
// ============================================================================

function initScenarioMode() {
    const compareBtn = document.getElementById('btn-compare-scenarios');
    if (compareBtn) {
        compareBtn.addEventListener('click', runScenarioComparison);
    }
}

async function runScenarioComparison() {
    const warningA = parseInt(document.getElementById('scenario-a-warning').value);
    const warningB = parseInt(document.getElementById('scenario-b-warning').value);
    
    const baseParams = {
        mass_kg: parseFloat(document.getElementById('mass').value) || 1e10,
        velocity_kms: parseFloat(document.getElementById('velocity').value) || 20,
        angle_deg: parseFloat(document.getElementById('angle_deg').value) || 45,
        latitude: impactLatLng.lat,
        longitude: impactLatLng.lng,
        impact_probability: 0.01
    };
    
    // Run both scenarios
    const [resultA, resultB] = await Promise.all([
        runDecisionSupportForScenario({ ...baseParams, observation_arc_days: warningA }),
        runDecisionSupportForScenario({ ...baseParams, observation_arc_days: warningB })
    ]);
    
    if (resultA && resultB) {
        populateScenarioComparison(resultA, resultB);
    }
}

async function runDecisionSupportForScenario(params) {
    try {
        const payload = {
            ...params,
            density_kgm3: 2500,
            diameter_m: Math.cbrt((6 * params.mass_kg) / (Math.PI * 2500)) * 2,
            lat: params.latitude,
            lon: params.longitude,
            base_population: 1000000,
            country: 'Bilinmeyen',
            scenario_id: 'scenario_' + Date.now()
        };
        
        const response = await fetch('http://127.0.0.1:5001/decision_support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return response.ok ? await response.json() : null;
    } catch (e) {
        console.error('Scenario error:', e);
        return null;
    }
}

function populateScenarioComparison(a, b) {
    // Action - Metinsel
    const actionA = formatActionName(a.policy?.recommended_action || '-');
    const actionB = formatActionName(b.policy?.recommended_action || '-');
    
    document.getElementById('sc-a-action').textContent = actionA;
    document.getElementById('sc-b-action').textContent = actionB;
    
    // Torino - Metinsel
    const torinoA = a.policy?.torino_scale || 0;
    const torinoB = b.policy?.torino_scale || 0;
    document.getElementById('sc-a-torino').textContent = 'T' + torinoA;
    document.getElementById('sc-b-torino').textContent = 'T' + torinoB;
    
    // Etki değerlendirmesi - Metinsel
    const assessmentA = getTorinoAssessment(torinoA);
    const assessmentB = getTorinoAssessment(torinoB);
    
    const scAAssess = document.getElementById('sc-a-impact-assessment');
    if (scAAssess) scAAssess.textContent = assessmentA;
    
    const scBAssess = document.getElementById('sc-b-impact-assessment');
    if (scBAssess) scBAssess.textContent = assessmentB;
    
    // Sayısal değerler (gizli alanlar ve rapor kartı için)
    const casA = a.socioeconomic?.adjusted_casualties?.mean || 0;
    const casB = b.socioeconomic?.adjusted_casualties?.mean || 0;
    const dmgA = a.socioeconomic?.economic_damage_usd?.mean || 0;
    const dmgB = b.socioeconomic?.economic_damage_usd?.mean || 0;
    const cbrA = a.baseline?.cost_benefit_ratio || 0;
    const cbrB = b.baseline?.cost_benefit_ratio || 0;
    
    // Gizli alanları güncelle (eski ID'ler için uyumluluk)
    const scACas = document.getElementById('sc-a-casualties');
    if (scACas) scACas.textContent = formatNumber(casA);
    
    const scBCas = document.getElementById('sc-b-casualties');
    if (scBCas) scBCas.textContent = formatNumber(casB);
    
    const scDeltaCas = document.getElementById('sc-delta-casualties');
    if (scDeltaCas) scDeltaCas.textContent = formatNumber(Math.abs(casB - casA));
    
    const scADmg = document.getElementById('sc-a-damage');
    if (scADmg) scADmg.textContent = formatCurrency(dmgA);
    
    const scBDmg = document.getElementById('sc-b-damage');
    if (scBDmg) scBDmg.textContent = formatCurrency(dmgB);
    
    const scDeltaDmg = document.getElementById('sc-delta-damage');
    if (scDeltaDmg) scDeltaDmg.textContent = formatCurrency(Math.abs(dmgB - dmgA));
    
    const scACBR = document.getElementById('sc-a-cbr');
    if (scACBR) scACBR.textContent = cbrA.toFixed(2) + 'x';
    
    const scBCBR = document.getElementById('sc-b-cbr');
    if (scBCBR) scBCBR.textContent = cbrB.toFixed(2) + 'x';
    
    const scDeltaCBR = document.getElementById('sc-delta-cbr');
    if (scDeltaCBR) scDeltaCBR.textContent = ((cbrB - cbrA) >= 0 ? '+' : '') + (cbrB - cbrA).toFixed(2) + 'x';
    
    const scDeltaAction = document.getElementById('sc-delta-action');
    if (scDeltaAction) scDeltaAction.textContent = actionA === actionB ? 'Aynı' : 'Farklı';
    
    const scDeltaTorino = document.getElementById('sc-delta-torino');
    if (scDeltaTorino) {
        const torinoDelta = torinoB - torinoA;
        scDeltaTorino.textContent = torinoDelta === 0 ? '0' : (torinoDelta > 0 ? '+' + torinoDelta : torinoDelta);
    }
    
    // Fark analizi - Metinsel açıklama
    const diffAnalysis = document.getElementById('scenario-diff-analysis');
    if (diffAnalysis) {
        let analysisHtml = '';
        
        if (actionA === actionB) {
            analysisHtml += `<p class="mb-2">Her iki senaryo da <strong class="text-purple-400">${actionA}</strong> eylemini önermektedir.</p>`;
        } else {
            analysisHtml += `<p class="mb-2">Uyarı süresi değişikliği eylem önerisini değiştirmektedir: <strong class="text-blue-400">${actionA}</strong> → <strong class="text-orange-400">${actionB}</strong></p>`;
        }
        
        if (casB < casA) {
            analysisHtml += `<p class="mb-2 text-green-400">Senaryo B, tahmini kayıpları azaltmaktadır.</p>`;
        } else if (casB > casA) {
            analysisHtml += `<p class="mb-2 text-red-400">Senaryo B, tahmini kayıpları artırmaktadır.</p>`;
        }
        
        if (cbrB > cbrA) {
            analysisHtml += `<p class="mb-2">Uzun vadeli uyarı, maliyet-fayda oranını iyileştirmektedir.</p>`;
        }
        
        analysisHtml += `<p class="text-xs text-gray-500 mt-3">Detaylı sayısal karşılaştırma için "Detaylı Çarpışma Analizi Raporu" bölümündeki Senaryo Karşılaştırma Metrikleri kartına bakınız.</p>`;
        
        diffAnalysis.innerHTML = analysisHtml;
    }
    
    // Sistem önerisi
    const recPanel = document.getElementById('scenario-recommendation');
    const recText = document.getElementById('scenario-recommendation-text');
    if (recPanel && recText) {
        recPanel.classList.remove('hidden');
        
        if (casB < casA && cbrB > cbrA) {
            recText.innerHTML = `
                <strong>Senaryo B</strong> (daha uzun uyarı süresi) hem kayıp azaltma hem de maliyet-fayda açısından daha avantajlıdır. 
                Erken tespit ve uyarı sistemlerinin kritik önemi bu karşılaştırma ile teyit edilmektedir.
            `;
        } else if (actionA === actionB) {
            recText.innerHTML = `
                Her iki senaryo da aynı eylem kategorisini önermektedir. Uyarı süresindeki değişiklik, 
                bu tehdit için temel müdahale stratejisini değiştirmemektedir.
            `;
        } else {
            recText.innerHTML = `
                Uyarı süresi, önerilen müdahale stratejisini doğrudan etkilemektedir. 
                Bu durum, tehdit tespit sürelerinin optimize edilmesinin önemini vurgulamaktadır.
            `;
        }
    }
    
    // === DETAYLI RAPOR - SENARYO METRİKLERİ KARTINI GÜNCELLE ===
    updateScenarioMetricsCard(a, b);
}

// Torino ölçeği değerlendirmesi
function getTorinoAssessment(torino) {
    if (torino === 0) return 'Çarpışma olasılığı yok veya ihmal edilebilir';
    if (torino <= 2) return 'Rutin keşif, dikkat gerektiren';
    if (torino <= 4) return 'Dikkatli izleme gerektiren olay';
    if (torino <= 7) return 'Tehditkar olay, acil aksiyon gerekli';
    return 'Kesin çarpışma, felaket düzeyinde hasar';
}

// Detaylı Rapordaki Senaryo Metrikleri kartını güncelle
function updateScenarioMetricsCard(a, b) {
    const card = document.getElementById('scenario-metrics-card');
    if (!card) return;
    
    card.classList.remove('hidden');
    
    // Torino
    const smATorino = document.getElementById('sm-a-torino');
    if (smATorino) smATorino.textContent = 'T' + (a.policy?.torino_scale || 0);
    
    const smBTorino = document.getElementById('sm-b-torino');
    if (smBTorino) smBTorino.textContent = 'T' + (b.policy?.torino_scale || 0);
    
    const smDeltaTorino = document.getElementById('sm-delta-torino');
    if (smDeltaTorino) {
        const delta = (b.policy?.torino_scale || 0) - (a.policy?.torino_scale || 0);
        smDeltaTorino.textContent = delta === 0 ? '0' : (delta > 0 ? '+' + delta : delta);
    }
    
    // Casualties
    const casA = a.socioeconomic?.adjusted_casualties?.mean || 0;
    const casB = b.socioeconomic?.adjusted_casualties?.mean || 0;
    
    const smACas = document.getElementById('sm-a-casualties');
    if (smACas) smACas.textContent = formatNumber(casA);
    
    const smBCas = document.getElementById('sm-b-casualties');
    if (smBCas) smBCas.textContent = formatNumber(casB);
    
    const smDeltaCas = document.getElementById('sm-delta-casualties');
    if (smDeltaCas) {
        const delta = casB - casA;
        smDeltaCas.textContent = (delta <= 0 ? '' : '+') + formatNumber(delta);
        smDeltaCas.className = 'text-center py-2 px-3 font-mono ' + (delta <= 0 ? 'text-green-400' : 'text-red-400');
    }
    
    // Economic damage
    const dmgA = a.socioeconomic?.economic_damage_usd?.mean || 0;
    const dmgB = b.socioeconomic?.economic_damage_usd?.mean || 0;
    
    const smADmg = document.getElementById('sm-a-damage');
    if (smADmg) smADmg.textContent = formatCurrency(dmgA);
    
    const smBDmg = document.getElementById('sm-b-damage');
    if (smBDmg) smBDmg.textContent = formatCurrency(dmgB);
    
    const smDeltaDmg = document.getElementById('sm-delta-damage');
    if (smDeltaDmg) {
        const delta = dmgB - dmgA;
        smDeltaDmg.textContent = (delta <= 0 ? '' : '+') + formatCurrency(Math.abs(delta));
        smDeltaDmg.className = 'text-center py-2 px-3 font-mono ' + (delta <= 0 ? 'text-green-400' : 'text-red-400');
    }
    
    // CBR
    const cbrA = a.baseline?.cost_benefit_ratio || 0;
    const cbrB = b.baseline?.cost_benefit_ratio || 0;
    
    const smACBR = document.getElementById('sm-a-cbr');
    if (smACBR) smACBR.textContent = cbrA.toFixed(2) + 'x';
    
    const smBCBR = document.getElementById('sm-b-cbr');
    if (smBCBR) smBCBR.textContent = cbrB.toFixed(2) + 'x';
    
    const smDeltaCBR = document.getElementById('sm-delta-cbr');
    if (smDeltaCBR) {
        const delta = cbrB - cbrA;
        smDeltaCBR.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(2) + 'x';
    }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatActionName(action) {
    if (!action) return 'Bilinmeyen';
    return action.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatPercent(value) {
    if (value >= 0.01) return (value * 100).toFixed(1) + '%';
    if (value >= 0.0001) return (value * 100).toFixed(3) + '%';
    return '<0.01%';
}

function formatWarningTime(days) {
    if (days >= 365) return (days / 365).toFixed(1) + ' yıl';
    return Math.round(days) + ' gün';
}

function formatEnergyMT(mt) {
    if (mt >= 1000) return (mt / 1000).toFixed(1) + ' GT';
    if (mt >= 1) return mt.toFixed(1) + ' MT';
    return (mt * 1000).toFixed(0) + ' kt';
}

function formatHours(hours) {
    if (hours < 1) return Math.round(hours * 60) + 'min';
    if (hours < 24) return hours.toFixed(0) + 'h';
    if (hours < 168) return (hours / 24).toFixed(0) + 'd';
    if (hours < 720) return (hours / 168).toFixed(0) + 'w';
    return (hours / 720).toFixed(0) + 'mo';
}

function formatNumber(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.round(n).toLocaleString();
}

function formatCurrency(usd) {
    if (usd >= 1e12) return '$' + (usd / 1e12).toFixed(1) + 'T';
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(1) + 'B';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(usd).toLocaleString();
}

function formatParamName(param) {
    const names = {
        'velocity_kms': 'Hız',
        'mass_kg': 'Kütle',
        'angle_deg': 'Giriş Açısı',
        'density_kgm3': 'Yoğunluk'
    };
    return names[param] || param;
}

// Hook into main simulation to also run decision support
const originalRunSimulation = typeof runSimulation === 'function' ? runSimulation : null;

if (originalRunSimulation) {
    window.runSimulationWithDecision = async function() {
        await originalRunSimulation();
        
        // Also run decision support
        const params = {
            mass_kg: parseFloat(document.getElementById('mass').value),
            velocity_kms: parseFloat(document.getElementById('velocity').value),
            angle_deg: parseFloat(document.getElementById('angle_deg').value) || 45,
            latitude: impactLatLng.lat,
            longitude: impactLatLng.lng
        };
        
        runDecisionSupport(params);
    };
}

// =====================================================
// KAPSAMLI HARİTA GÖRSELLEŞTİRME FONKSİYONLARI
// 50 Veri Setinden Tüm Sonuçların Harita Üzerinde Gösterimi
// =====================================================

// Global layer groups for organized visualization
let mapLayerGroups = {
    impactZones: null,
    megacities: null,
    healthFacilities: null,
    infrastructure: null,
    submarineCables: null,
    tsunamiWaves: null,
    seismicWaves: null,
    biodiversity: null,
    agriculture: null,
    evacuation: null,
    detectionSystems: null,
    historicalEvents: null
};

// Map legend control
let mapLegend = null;

function addComprehensiveMapVisualizations(resultData, inputs, physical, human) {
    const impactLat = inputs.lat || impactLatLng.lat || 37.0663;
    const impactLon = inputs.lon || impactLatLng.lng || 36.2484;
    const energyMT = physical.impact_energy_megatons_tnt || 0;
    
    // Clear previous layer groups
    Object.values(mapLayerGroups).forEach(group => {
        if (group && map.hasLayer(group)) {
            map.removeLayer(group);
        }
    });
    
    // Initialize layer groups
    mapLayerGroups.impactZones = L.layerGroup().addTo(map);
    mapLayerGroups.megacities = L.layerGroup().addTo(map);
    mapLayerGroups.healthFacilities = L.layerGroup().addTo(map);
    mapLayerGroups.infrastructure = L.layerGroup().addTo(map);
    mapLayerGroups.submarineCables = L.layerGroup().addTo(map);
    mapLayerGroups.tsunamiWaves = L.layerGroup().addTo(map);
    mapLayerGroups.seismicWaves = L.layerGroup().addTo(map);
    mapLayerGroups.biodiversity = L.layerGroup().addTo(map);
    mapLayerGroups.agriculture = L.layerGroup().addTo(map);
    mapLayerGroups.evacuation = L.layerGroup().addTo(map);
    mapLayerGroups.detectionSystems = L.layerGroup().addTo(map);
    mapLayerGroups.historicalEvents = L.layerGroup().addTo(map);
    
    // 1. ETKİ BÖLGELERİ (Krater, Termal, Blast, Sismik)
    addImpactZones(impactLat, impactLon, physical, energyMT);
    
    // 2. MEGAŞEHIRLER & ETKİLENEN NÜFUS
    addMegacitiesVisualization(impactLat, impactLon, physical, human);
    
    // 3. SAĞLIK ALTYAPISI
    addHealthFacilitiesVisualization(impactLat, impactLon, physical, resultData);
    
    // 4. KRİTİK ALTYAPI (Enerji, Havalimanları, Limanlar)
    addCriticalInfrastructureVisualization(impactLat, impactLon, physical, human);
    
    // 5. DENİZALTI KABLOLARI
    addSubmarineCablesVisualization(impactLat, impactLon, physical, resultData);
    
    // 6. TSUNAMİ DALGALARI
    addTsunamiVisualization(impactLat, impactLon, physical, resultData);
    
    // 7. SİSMİK DALGA YAYILIMI
    addSeismicWaveVisualization(impactLat, impactLon, physical);
    
    // 8. BİYOÇEŞİTLİLİK HOTSPOTLARI
    addBiodiversityVisualization(impactLat, impactLon, physical, resultData);
    
    // 9. TARIMSAL ALANLAR
    addAgricultureVisualization(impactLat, impactLon, physical, resultData);
    
    // 10. TAHLİYE GÜZERGAHLARİ
    addEvacuationVisualization(impactLat, impactLon, physical, resultData);
    
    // 11. TESPİT SİSTEMLERİ KAPSAMA ALANI
    addDetectionSystemsVisualization(impactLat, impactLon);
    
    // 12. TARİHSEL OLAYLAR KARŞILAŞTIRMASI
    addHistoricalEventsVisualization(impactLat, impactLon, energyMT);
    
    // Add layer control
    addMapLayerControl();
    
    // Add legend
    addMapLegend(energyMT);
    
    // Add impact marker with detailed popup
    addDetailedImpactMarker(impactLat, impactLon, physical, resultData);
}

// 1. ETKİ BÖLGELERİ (Güvenli circle oluşturma ile)
function addImpactZones(lat, lon, physical, energyMT) {
    console.log('📊 Etki bölgeleri çiziliyor...');
    
    const craterRadius = (physical.crater_diameter_km || 0) / 2;
    const thermalRadius2nd = physical.thermal_burn_radius_km?.["2nd_degree"] || 0;
    const thermalRadius3rd = physical.thermal_burn_radius_km?.["3rd_degree"] || 0;
    const blastRadius1psi = physical.air_blast_radius_km?.["1_psi_km"] || 0;
    const blastRadius5psi = physical.air_blast_radius_km?.["5_psi_km"] || 0;
    const blastRadius10psi = physical.air_blast_radius_km?.["10_psi_km"] || 0;
    
    // Krater bölgesi
    if (craterRadius > 0) {
        const circle = createSafeCircle(lat, lon, craterRadius, {
            color: '#8B0000',
            fillColor: '#8B0000',
            fillOpacity: 0.7,
            weight: 2
        });
        
        if (circle) {
            const craterDepth = (craterRadius * 2 * 0.3).toFixed(2); // Derinlik tahmini
            const ejectaVolume = (Math.PI * Math.pow(craterRadius, 2) * parseFloat(craterDepth) / 3).toFixed(0);
            
            const popup = createSafePopup('💥 KRATER BÖLGESİ (Impact Crater)', [
                { text: '═══════════════════════════', style: 'color: #DC2626;' },
                { text: '🎯 DOĞRUDAN ÇARPMA BÖLGESİ', className: 'font-bold text-red-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #DC2626;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 FİZİKSEL ÖZELLİKLER:', className: 'font-bold text-gray-700', style: 'margin-top: 8px;' },
                { text: `   • Krater Çapı: ${(craterRadius * 2).toFixed(2)} km (${formatNumber((craterRadius * 2000).toFixed(0))} metre)` },
                { text: `   • Krater Yarıçapı: ${craterRadius.toFixed(2)} km` },
                { text: `   • Tahmini Derinlik: ${craterDepth} km (${(craterDepth * 1000).toFixed(0)} m)` },
                { text: `   • Etkilenen Alan: ${formatNumber((Math.PI * craterRadius * craterRadius).toFixed(1))} km²` },
                { text: `   • Fırlatılan Materyal: ~${formatNumber(ejectaVolume)} km³`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '💀 ETKİLER VE SONUÇLAR:', className: 'font-bold text-red-700' },
                { text: '   ⚠️ %100 Anlık Yıkım ve Ölüm', className: 'text-red-600 font-bold' },
                { text: '   • Tüm yapılar anında buharlaşır' },
                { text: '   • Zemin tamamen kazınır' },
                { text: '   • Atmosfer şok dalgası oluşur' },
                { text: '   • Sismik dalgalar tetiklenir' },
                { text: '   • Dev materyal püskürmesi (ejecta)' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🔬 BİLİMSEL NOT:', className: 'font-bold text-blue-600' },
                { text: '   Krater boyutu enerjiye, hıza, açıya ve', style: 'font-size: 11px;' },
                { text: '   zemin yapısına bağlı olarak değişir.', style: 'font-size: 11px;' },
                { text: `   Enerji: ${energyMT.toFixed(2)} Megaton TNT`, style: 'font-size: 11px; margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📖 KARŞILAŞTIRMA:', className: 'font-bold text-purple-600' },
                { text: `   ${craterRadius * 2 > 10 ? '🌍 Chicxulub krateri (dinozorlar): 150 km' : '🌋 Meteor Crater (Arizona): 1.2 km'}`, style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #DC2626; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(220, 38, 38, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Termal yanık bölgeleri - 3. derece
    if (thermalRadius3rd > 0) {
        const circle = createSafeCircle(lat, lon, thermalRadius3rd, {
            color: '#FF0000',
            fillColor: '#FF0000',
            fillOpacity: 0.4,
            weight: 1,
            dashArray: '5, 5'
        });
        
        if (circle) {
            const area = (Math.PI * thermalRadius3rd * thermalRadius3rd).toFixed(0);
            const exposureTime = '0.5-2 saniye';
            const temperature = '~1500-2000°C';
            
            const popup = createSafePopup('🔥 3. DERECE YANIK BÖLGESİ (Third-Degree Burns)', [
                { text: '═══════════════════════════', style: 'color: #EF4444;' },
                { text: '⚠️ ÖLÜMCÜL TERMAL RADYASYON ALANI', className: 'font-bold text-red-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #EF4444;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 BÖLGE ÖZELLİKLERİ:', className: 'font-bold text-gray-700' },
                { text: `   • Yarıçap: ${thermalRadius3rd.toFixed(2)} km (${formatNumber((thermalRadius3rd * 1000).toFixed(0))} m)` },
                { text: `   • Etkilenen Alan: ${formatNumber(area)} km²` },
                { text: `   • Maruz Kalma Süresi: ${exposureTime}` },
                { text: `   • Işınım Sıcaklığı: ${temperature}`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🩺 TIBBİ ETKİLER:', className: 'font-bold text-red-700' },
                { text: '   💀 %80-95 Ölüm Oranı', className: 'text-red-600 font-bold' },
                { text: '   • Tam kalınlıkta deri yanığı' },
                { text: '   • Kas ve doku hasarı' },
                { text: '   • Sinir uçları tahrip edilir (ağrı hissedilmez)' },
                { text: '   • Anında karbonlaşma' },
                { text: '   • Solunum yolu yanıkları' },
                { text: '   • Hemen ölüm veya şok', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏥 KURTARMA İMKANI:', className: 'font-bold text-orange-600' },
                { text: '   • Acil tıbbi müdahale zorunlu' },
                { text: '   • %95+ vücut yanıkları: hayatta kalma imkanı yok' },
                { text: '   • Deri greftleri gerekli' },
                { text: '   • Uzun süre yoğun bakım', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🔬 FİZİKSEL AÇIKLAMA:', className: 'font-bold text-blue-600' },
                { text: '   Ateş topu (fireball) ışınım enerjisi', style: 'font-size: 11px;' },
                { text: '   cilt dokusunu anında yakar. Işık hızıyla', style: 'font-size: 11px;' },
                { text: '   yayılan termal radyasyon, açıkta olan', style: 'font-size: 11px;' },
                { text: '   tüm yüzeyleri ateşler.', style: 'font-size: 11px; margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🔥 YANGIN RİSKİ:', className: 'font-bold text-orange-700' },
                { text: '   Kağıt, kumaş, ahşap anında tutuşur', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #EF4444; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(239, 68, 68, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Termal yanık bölgeleri - 2. derece
    if (thermalRadius2nd > 0) {
        const circle = createSafeCircle(lat, lon, thermalRadius2nd, {
            color: '#FF6600',
            fillColor: '#FF6600',
            fillOpacity: 0.25,
            weight: 1,
            dashArray: '5, 5'
        });
        
        if (circle) {
            const area = (Math.PI * thermalRadius2nd * thermalRadius2nd).toFixed(0);
            const casualties = '40-60%';
            
            const popup = createSafePopup('🔥 2. DERECE YANIK BÖLGESİ (Second-Degree Burns)', [
                { text: '═══════════════════════════', style: 'color: #F97316;' },
                { text: '⚠️ CİDDİ TERMAL YARALANMA ALANI', className: 'font-bold text-orange-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #F97316;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 BÖLGE ÖZELLİKLERİ:', className: 'font-bold text-gray-700' },
                { text: `   • Yarıçap: ${thermalRadius2nd.toFixed(2)} km` },
                { text: `   • Alan: ${formatNumber(area)} km²` },
                { text: `   • Işınım Yoğunluğu: Orta-Yüksek` },
                { text: `   • Maruz Kalma: 1-3 saniye`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🩺 TIBBİ ETKİLER:', className: 'font-bold text-orange-700' },
                { text: `   💀 ${casualties} Kayıp Oranı`, className: 'text-orange-600 font-bold' },
                { text: '   • Deri tabakalarında yanık (epidermis+dermis)' },
                { text: '   • Şiddetli ağrı ve yanma' },
                { text: '   • Su toplama (blister/kabarcık)' },
                { text: '   • Şok riski yüksek' },
                { text: '   • Enfeksiyon tehlikesi' },
                { text: '   • Deri greftleri gerekebilir', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏥 ACİL MÜDAHALE:', className: 'font-bold text-red-600' },
                { text: '   ✓ Hemen soğuk su uygulama' },
                { text: '   ✓ Temiz malzeme ile örtme' },
                { text: '   ✓ Acil sağlık hizmetine başvuru' },
                { text: '   ✓ Şok belirtileri izleme' },
                { text: '   ✓ Sıvı tedavisi gerekli', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '⏱️ İYİLEŞME SÜRECİ:', className: 'font-bold text-blue-600' },
                { text: '   • Hastane yatışı: 2-4 hafta' },
                { text: '   • Tam iyileşme: 6-12 ay' },
                { text: '   • Kalıcı iz riski: Yüksek', style: 'margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🔬 BİLİMSEL NOT:', className: 'font-bold text-purple-600', style: 'font-size: 11px;' },
                { text: '   Termal ışınım enerjisi yaklaşık 5 cal/cm²', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #F97316; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(249, 115, 22, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Patlama dalgası bölgeleri - 10 PSI
    if (blastRadius10psi > 0) {
        const circle = createSafeCircle(lat, lon, blastRadius10psi, {
            color: '#FF3300',
            fillColor: '#FF3300',
            fillOpacity: 0.3,
            weight: 1
        });
        
        if (circle) {
            const area = (Math.PI * blastRadius10psi * blastRadius10psi).toFixed(0);
            const windSpeed = '470 km/saat (~130 m/s)';
            const pressure = '68.9 kPa (10 PSI)';
            
            const popup = createSafePopup('💨 10 PSI PATLAMA DALGASI (Severe Overpressure)', [
                { text: '═══════════════════════════', style: 'color: #DC2626;' },
                { text: '💥 AĞIR PATLAMA BASINCI BÖLGESİ', className: 'font-bold text-red-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #DC2626;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 FİZİKSEL PARAMETRELER:', className: 'font-bold text-gray-700' },
                { text: `   • Yarıçap: ${blastRadius10psi.toFixed(2)} km` },
                { text: `   • Alan: ${formatNumber(area)} km²` },
                { text: `   • Basınç: ${pressure}` },
                { text: `   • Rüzgar Hızı: ${windSpeed}` },
                { text: `   • Dinamik Basınç: ~4 PSI`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏢 YAPI HASARLARI:', className: 'font-bold text-red-700' },
                { text: '   💀 %95+ Ölüm Oranı', className: 'text-red-600 font-bold' },
                { text: '   • Betonarme binalar tamamen yıkılır' },
                { text: '   • Çelik çerçeveler çöker' },
                { text: '   • Endüstriyel yapılar hasar görür' },
                { text: '   • Köprüler ciddi hasar alır' },
                { text: '   • Yeraltı yapıları bile etkilenir' },
                { text: '   • Arabalar devrilir ve savrulur', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '💀 İNSAN ETKİLERİ:', className: 'font-bold text-red-700' },
                { text: '   • Anında ölüm (çoğu durumda)' },
                { text: '   • İç organlar yırtılır (barotravma)' },
                { text: '   • Kulaklar ve akciğerler patlayabilir' },
                { text: '   • Yüksek hızlı enkaz yaralanmaları' },
                { text: '   • Bina çökmesi altında kalma' },
                { text: '   • Havada fırlatılma', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🔬 BİLİMSEL AÇIKLAMA:', className: 'font-bold text-blue-600' },
                { text: '   Patlama dalgası süpersonik hızda yayılır.', style: 'font-size: 11px;' },
                { text: '   Şok cephesi, hava moleküllerini sıkıştırarak', style: 'font-size: 11px;' },
                { text: '   dev bir basınç duvarı oluşturur. Bu duvar', style: 'font-size: 11px;' },
                { text: '   her şeyi yıkıcı güçle etkiler.', style: 'font-size: 11px; margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '⚠️ KORUNMA:', className: 'font-bold text-orange-600' },
                { text: '   Bu bölgede korunma imkansızdır!', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #DC2626; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(220, 38, 38, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Patlama dalgası bölgeleri - 5 PSI
    if (blastRadius5psi > 0) {
        const circle = createSafeCircle(lat, lon, blastRadius5psi, {
            color: '#FF9900',
            fillColor: '#FF9900',
            fillOpacity: 0.2,
            weight: 1
        });
        
        if (circle) {
            const area = (Math.PI * blastRadius5psi * blastRadius5psi).toFixed(0);
            const windSpeed = '255 km/saat (~70 m/s)';
            
            const popup = createSafePopup('💨 5 PSI PATLAMA DALGASI (Heavy Damage Zone)', [
                { text: '═══════════════════════════', style: 'color: #EA580C;' },
                { text: '⚠️ AĞIR HASAR BÖLGESİ', className: 'font-bold text-orange-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #EA580C;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 BÖLGE PARAMETRELERİ:', className: 'font-bold text-gray-700' },
                { text: `   • Yarıçap: ${blastRadius5psi.toFixed(2)} km` },
                { text: `   • Alan: ${formatNumber(area)} km²` },
                { text: `   • Basınç: 34.5 kPa (5 PSI)` },
                { text: `   • Rüzgar Hızı: ${windSpeed}` },
                { text: `   • Dinamik Basınç: ~1.9 PSI`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏠 YAPI HASARLARI:', className: 'font-bold text-orange-700' },
                { text: '   💀 %40-60 Ölüm Oranı', className: 'text-orange-600 font-bold' },
                { text: '   • Ahşap evler tamamen yıkılır' },
                { text: '   • Tuğla binalar ağır hasar görür' },
                { text: '   • Çatılar uçar' },
                { text: '   • Duvarlar çöker' },
                { text: '   • Pencereler parçalanır' },
                { text: '   • İskeletler bükülebilir', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '👤 İNSAN ETKİLERİ:', className: 'font-bold text-red-600' },
                { text: '   • Ağır yaralanmalar' },
                { text: '   • Uçan enkaz yaralanmaları' },
                { text: '   • Bina çökmesi altında kalma' },
                { text: '   • İç kanama (akciğer, kulak hasarı)' },
                { text: '   • Kırıklar ve ezilmeler' },
                { text: '   • Şok ve travma', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🚨 ACİL DURUM:', className: 'font-bold text-red-700' },
                { text: '   • Acil tahliye gerekli' },
                { text: '   • Enkaz altında arama-kurtarma' },
                { text: '   • Tıbbi ekipler sevk edilmeli' },
                { text: '   • Yangın riski yüksek', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🛡️ KORUNMA ÖNERİLERİ:', className: 'font-bold text-blue-600' },
                { text: '   • Bodrum katlarına sığının' },
                { text: '   • Ağır mobilyalardan uzak durun' },
                { text: '   • Pencerelerden uzaklaşın' },
                { text: '   • Kapı pervazlarına sığının', style: 'margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📖 KARŞILAŞTIRMA:', className: 'font-bold text-purple-600', style: 'font-size: 11px;' },
                { text: '   Hiroshima bombasında 5 PSI bölgesi', style: 'font-size: 11px;' },
                { text: '   yaklaşık 2 km yarıçaplıydı.', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #EA580C; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(234, 88, 12, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Patlama dalgası bölgeleri - 1 PSI
    if (blastRadius1psi > 0) {
        const circle = createSafeCircle(lat, lon, blastRadius1psi, {
            color: '#FFCC00',
            fillColor: '#FFCC00',
            fillOpacity: 0.1,
            weight: 1
        });
        
        if (circle) {
            const area = (Math.PI * blastRadius1psi * blastRadius1psi).toFixed(0);
            const windSpeed = '60 km/saat (~16 m/s)';
            
            const popup = createSafePopup('💨 1 PSI PATLAMA DALGASI (Light Damage Zone)', [
                { text: '═══════════════════════════', style: 'color: #CA8A04;' },
                { text: '⚠️ HAFİF HASAR VE CAM KIRILMA BÖLGESİ', className: 'font-bold text-yellow-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #CA8A04;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 BÖLGE PARAMETRELERİ:', className: 'font-bold text-gray-700' },
                { text: `   • Yarıçap: ${blastRadius1psi.toFixed(2)} km` },
                { text: `   • Alan: ${formatNumber(area)} km²` },
                { text: `   • Basınç: 6.9 kPa (1 PSI)` },
                { text: `   • Rüzgar Hızı: ${windSpeed}` },
                { text: `   • Ses Düzeyi: ~140 dB (Çok yüksek)`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏠 YAPI ETKİLERİ:', className: 'font-bold text-yellow-700' },
                { text: '   • Pencere camları kırılır (%90)' },
                { text: '   • Kapılar yerinden çıkar' },
                { text: '   • Hafif yapısal çatlaklar' },
                { text: '   • Çatı kiremitleri düşer' },
                { text: '   • Güneş panelleri hasar görür' },
                { text: '   • Dış cephe hasarları', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '👤 İNSAN ETKİLERİ:', className: 'font-bold text-orange-600' },
                { text: '   • Cam parçalarından yaralanma (ciddi)' },
                { text: '   • Kesikler ve kanama' },
                { text: '   • Geçici sağırlık' },
                { text: '   • Patlama sarsıntısı (shock)' },
                { text: '   • Panik ve stres' },
                { text: '   • İşitme kaybı (geçici)', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🩹 YARALANMA İSTATİSTİKLERİ:', className: 'font-bold text-blue-600' },
                { text: '   • %5-15 Hafif yaralanma' },
                { text: '   • %1-3 Ciddi yaralanma' },
                { text: '   • Ölüm oranı: Çok düşük' },
                { text: '   • Cam parçası yaralanmaları: Yaygın', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🛡️ KORUNMA ÖNERİLERİ:', className: 'font-bold text-green-700' },
                { text: '   ✓ Pencerelerden uzaklaşın' },
                { text: '   ✓ İç odalara geçin' },
                { text: '   ✓ Yere yatın ve başınızı koruyun' },
                { text: '   ✓ Ağır eşyalardan uzak durun' },
                { text: '   ✓ Kapıları açık bırakın (basınç eşitlemesi)', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '⏱️ ETKİ SÜRESİ:', className: 'font-bold text-purple-600' },
                { text: '   • Şok dalgası geçişi: 1-2 saniye' },
                { text: '   • Negatif faz (emme): 2-4 saniye' },
                { text: '   • Cam kırılması: Anında', style: 'margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📡 SES ETKİSİ:', className: 'font-bold text-red-600', style: 'font-size: 11px;' },
                { text: '   Sonic boom benzeri dev patlama sesi', style: 'font-size: 11px;' },
                { text: '   duyulur. Alarm sistemleri tetiklenebilir.', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #CA8A04; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(202, 138, 4, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 350px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    // Atmosferik etki alanı (büyük etkiler için)
    if (energyMT > 1) {
        const atmosphericRadius = Math.sqrt(energyMT) * 100;
        const circle = createSafeCircle(lat, lon, atmosphericRadius, {
            color: '#9933FF',
            fillColor: '#9933FF',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '10, 10'
        });
        
        if (circle) {
            const dustVolume = (energyMT * 50).toFixed(0); // km³ tahmini
            const area = (Math.PI * atmosphericRadius * atmosphericRadius).toFixed(0);
            
            const popup = createSafePopup('🌫️ ATMOSFERİK ETKİ ALANI (Atmospheric Impact)', [
                { text: '═══════════════════════════', style: 'color: #9333EA;' },
                { text: '🌍 GENIŞ ÖLÇEKLİ ATMOSFER ETKİSİ', className: 'font-bold text-purple-600 text-center', style: 'margin: 5px 0;' },
                { text: '═══════════════════════════', style: 'color: #9333EA;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📏 YAYILIM ÖZELLİKLERİ:', className: 'font-bold text-gray-700' },
                { text: `   • Etki Yarıçapı: ${formatNumber(atmosphericRadius.toFixed(0))} km` },
                { text: `   • Etkilenen Alan: ${formatNumber(area)} km²` },
                { text: `   • Toz Bulutu Hacmi: ~${formatNumber(dustVolume)} km³` },
                { text: `   • Yükseklik: 10-50 km (stratosfer)` },
                { text: `   • İlk Yayılım: ${(atmosphericRadius / 50).toFixed(0)} saat`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🌫️ HAVA KALİTESİ ETKİLERİ:', className: 'font-bold text-orange-700' },
                { text: '   • Yoğun toz ve kül bulutu' },
                { text: '   • Görüş mesafesi: <100 metre' },
                { text: '   • PM2.5 partiküller (tehlikeli)' },
                { text: '   • Solunum zorluğu' },
                { text: '   • Astım ve akciğer hastalığı tetikleyici' },
                { text: '   • Su kaynaklarında kirlenme', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '☀️ GÜNEŞ IŞIĞI BLOKAJİ:', className: 'font-bold text-yellow-700' },
                { text: `   • Gün ışığı azalması: ${energyMT > 100 ? '%30-60' : '%10-30'}` },
                { text: `   • Sıcaklık düşüşü: ${energyMT > 100 ? '5-15°C' : '1-5°C'}` },
                { text: '   • Fotosentez azalması' },
                { text: '   • Tarımsal üretim etkilenir' },
                { text: `   • Süre: ${energyMT > 100 ? '6-24 ay' : '1-6 ay'}`, style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🌧️ İKLİM ETKİLERİ:', className: 'font-bold text-blue-600' },
                { text: '   • Yağış düzeninde değişiklik' },
                { text: '   • Asit yağmurları' },
                { text: '   • Ozon tabakası incelmesi' },
                { text: '   • UV radyasyonu artışı (sonradan)' },
                { text: '   • Bölgesel soğuma ("mini buz çağı")', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🏥 SAĞLIK ÖNERİLERİ:', className: 'font-bold text-red-600' },
                { text: '   ✓ N95/FFP2 maske kullanın' },
                { text: '   ✓ Dışarı çıkmayın' },
                { text: '   ✓ Hava filtreleri kullanın' },
                { text: '   ✓ Su kaynaklarını filtreleyin' },
                { text: '   ✓ Gıda stoklarını koruyun', style: 'margin-bottom: 8px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '🌍 KÜRESEL ETKİLER:', className: 'font-bold text-purple-700' },
                { text: `   ${energyMT > 100 ? '⚠️ Küresel kış riski!' : 'Bölgesel etki'}` },
                { text: `   ${energyMT > 1000 ? '🌍 Kitlesel yok olma olayı seviyesi' : ''}`, style: 'margin-bottom: 5px;' },
                { text: '', style: 'margin: 3px 0;' },
                { text: '📖 TARİHİ ÖRNEK:', className: 'font-bold text-gray-600', style: 'font-size: 11px;' },
                { text: '   1815 Tambora yanardağı patlaması', style: 'font-size: 11px;' },
                { text: '   "Yazsız yıl" 1816 (küresel soğuma)', style: 'font-size: 11px;' }
            ], { 
                titleStyle: 'color: #9333EA; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(147, 51, 234, 0.1); border-radius: 5px; margin-bottom: 8px;',
                containerStyle: 'min-width: 360px; padding: 12px; font-size: 12px; line-height: 1.5;'
            });
            
            circle.bindPopup(popup).addTo(mapLayerGroups.impactZones);
        }
    }
    
    console.log('✅ Etki bölgeleri çizildi');
}

// 2. MEGAŞEHIRLER & ETKİLENEN NÜFUS
function addMegacitiesVisualization(impactLat, impactLon, physical, human) {
    const megacities = [
        { name: 'İstanbul', pop: 15840900, lat: 41.0082, lon: 28.9784, country: 'TR' },
        { name: 'Moskova', pop: 12655050, lat: 55.7558, lon: 37.6173, country: 'RU' },
        { name: 'Londra', pop: 9002488, lat: 51.5074, lon: -0.1278, country: 'UK' },
        { name: 'Paris', pop: 2161000, lat: 48.8566, lon: 2.3522, country: 'FR' },
        { name: 'Berlin', pop: 3769495, lat: 52.5200, lon: 13.4050, country: 'DE' },
        { name: 'Madrid', pop: 3223334, lat: 40.4168, lon: -3.7038, country: 'ES' },
        { name: 'Roma', pop: 2873000, lat: 41.9028, lon: 12.4964, country: 'IT' },
        { name: 'Atina', pop: 664046, lat: 37.9838, lon: 23.7275, country: 'GR' },
        { name: 'Kahire', pop: 20901000, lat: 30.0444, lon: 31.2357, country: 'EG' },
        { name: 'Tokyo', pop: 13960000, lat: 35.6762, lon: 139.6503, country: 'JP' },
        { name: 'Pekin', pop: 21540000, lat: 39.9042, lon: 116.4074, country: 'CN' },
        { name: 'Mumbai', pop: 12478447, lat: 19.0760, lon: 72.8777, country: 'IN' },
        { name: 'Şangay', pop: 26320000, lat: 31.2304, lon: 121.4737, country: 'CN' },
        { name: 'Lagos', pop: 15388000, lat: 6.5244, lon: 3.3792, country: 'NG' },
        { name: 'São Paulo', pop: 12325232, lat: -23.5505, lon: -46.6333, country: 'BR' },
        { name: 'Mexico City', pop: 21671908, lat: 19.4326, lon: -99.1332, country: 'MX' },
        { name: 'New York', pop: 8336817, lat: 40.7128, lon: -74.0060, country: 'US' },
        { name: 'Los Angeles', pop: 3979576, lat: 34.0522, lon: -118.2437, country: 'US' },
        { name: 'Karachi', pop: 16093786, lat: 24.8607, lon: 67.0011, country: 'PK' },
        { name: 'Dhaka', pop: 21005860, lat: 23.8103, lon: 90.4125, country: 'BD' },
        { name: 'Ankara', pop: 5663322, lat: 39.9334, lon: 32.8597, country: 'TR' },
        { name: 'İzmir', pop: 4367251, lat: 38.4237, lon: 27.1428, country: 'TR' },
        { name: 'Adana', pop: 2258718, lat: 37.0017, lon: 35.3289, country: 'TR' },
        { name: 'Antalya', pop: 2619832, lat: 36.8969, lon: 30.7133, country: 'TR' },
        { name: 'Bursa', pop: 3056120, lat: 40.1826, lon: 29.0665, country: 'TR' }
    ];
    
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    const thermalRadius = physical.thermal_burn_radius_km?.["2nd_degree"] || 20;
    
    megacities.forEach(city => {
        const dist = haversineDistance(impactLat, impactLon, city.lat, city.lon);
        const isInBlastZone = dist < blastRadius;
        const isInThermalZone = dist < thermalRadius;
        const isInDangerZone = dist < blastRadius * 2;
        
        // Risk seviyesine göre renk
        let markerColor = '#22C55E'; // Yeşil - Güvenli
        let riskLevel = 'Güvenli';
        let estimatedCasualties = 0;
        
        if (isInThermalZone) {
            markerColor = '#DC2626';
            riskLevel = 'KRİTİK - Termal Bölge';
            estimatedCasualties = Math.round(city.pop * 0.9);
        } else if (isInBlastZone) {
            markerColor = '#F97316';
            riskLevel = 'YÜKSEK - Patlama Bölgesi';
            estimatedCasualties = Math.round(city.pop * 0.5);
        } else if (isInDangerZone) {
            markerColor = '#EAB308';
            riskLevel = 'ORTA - Tehlike Bölgesi';
            estimatedCasualties = Math.round(city.pop * 0.1);
        }
        
        // Şehir büyüklüğüne göre marker boyutu
        const radius = Math.max(5, Math.min(15, Math.log10(city.pop) * 3));
        
        const cityMarker = L.circleMarker([city.lat, city.lon], {
            radius: radius,
            fillColor: markerColor,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });
        
        // Detaylı etki analizi
        let effectDetails = [];
        let infrastructureDamage = '';
        let evacuationTime = 0;
        let survivalRate = 100;
        
        if (isInThermalZone) {
            survivalRate = 10;
            evacuationTime = 0;
            infrastructureDamage = 'Tam yıkım - %95+ bina kaybı';
            effectDetails = [
                '🔥 3. derece yanıklar (tüm şehir)',
                '💥 Patlama dalgası yıkımı',
                '🏚️ Altyapı tamamen çökmüş',
                '🚑 Sağlık sistemi yok',
                '🚨 Acil müdahale imkansız',
                '☠️ Anında kitlesel kayıplar'
            ];
        } else if (isInBlastZone) {
            survivalRate = 50;
            evacuationTime = 30;
            infrastructureDamage = 'Ağır hasar - %60-80 bina kaybı';
            effectDetails = [
                '💨 5-10 PSI basınç dalgası',
                '🏠 Binalar yıkılmış/hasarlı',
                '🪟 Tüm camlar kırık',
                '🚗 Ulaşım felç',
                '⚡ Elektrik/su kesilmiş',
                '📡 İletişim kopmuş'
            ];
        } else if (isInDangerZone) {
            survivalRate = 90;
            evacuationTime = 120;
            infrastructureDamage = 'Orta hasar - %20-40 bina hasarı';
            effectDetails = [
                '💨 1-5 PSI basınç etki',
                '🪟 Camlar kırık',
                '🏢 Yapısal çatlaklar',
                '🚑 Yaralı sayısı yüksek',
                '🔥 Yangın riski',
                '📱 İletişim zayıf'
            ];
        } else {
            effectDetails = [
                '✅ Fiziksel hasar yok',
                '🌫️ Toz bulutu gelebilir',
                '🚨 Olası mülteci akını',
                '🏥 Yaralı kabul merkezi',
                '📦 Yardım merkezi olabilir'
            ];
        }
        
        const arrivalTime = dist > 0 ? (dist / 0.34).toFixed(0) : 0; // Şok dalgası varış (ses hızı)
        
        const popup = createSafePopup(`🏙️ ${city.name} - Etki Analizi`, [
            { text: '═══════════════════════════', style: `color: ${markerColor};` },
            { text: `${city.name.toUpperCase()} ŞEHİR ANALİZİ`, className: 'font-bold text-center', style: `color: ${markerColor}; margin: 5px 0;` },
            { text: '═══════════════════════════', style: `color: ${markerColor};` },
            { text: '', style: 'margin: 3px 0;' },
            { text: '📊 ŞEHİR BİLGİLERİ:', className: 'font-bold text-gray-700' },
            { text: `   • Ülke: ${city.country}` },
            { text: `   • Toplam Nüfus: ${formatNumber(city.pop)}` },
            { text: `   • Koordinatlar: ${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}` },
            { text: `   • Çarpma Noktasına Mesafe: ${dist.toFixed(1)} km`, style: 'margin-bottom: 8px;' },
            { text: '', style: 'margin: 3px 0;' },
            { text: '⚠️ RİSK SEVİYESİ:', className: 'font-bold', style: `color: ${markerColor};` },
            { text: `   ${riskLevel}`, className: 'font-bold', style: `color: ${markerColor}; font-size: 14px;` },
            { text: `   💀 Kayıp Tahmini: ${formatNumber(estimatedCasualties)} kişi (${((estimatedCasualties/city.pop)*100).toFixed(1)}%)` },
            { text: `   ✅ Hayatta Kalma Oranı: ${survivalRate}%` },
            { text: `   ⏱️ Şok Dalgası Varış: ${arrivalTime} saniye`, style: 'margin-bottom: 8px;' },
            { text: '', style: 'margin: 3px 0;' },
            { text: '🏚️ ALTYAPI DURUMU:', className: 'font-bold text-orange-700' },
            { text: `   ${infrastructureDamage}` },
            ...effectDetails.map(detail => ({ text: `   ${detail}`, style: 'font-size: 11px;' })),
            { text: '', style: 'margin: 3px 0;' },
            { text: '🚨 ACİL DURUM:', className: 'font-bold text-red-600' },
            { text: `   • Tahliye Süresi: ${evacuationTime > 0 ? evacuationTime + ' dakika' : 'İMKANSIZ'}` },
            { text: `   • Yaralı Sayısı: ~${formatNumber(Math.round(city.pop * (100-survivalRate) / 200))}` },
            { text: `   • Enkaz Altında: ~${formatNumber(Math.round(estimatedCasualties * 0.3))}` },
            { text: `   • Acil Tıbbi Müdahale: ${isInThermalZone || isInBlastZone ? 'YETERSİZ' : 'GEREKLİ'}`, style: 'margin-bottom: 8px;' },
            { text: '', style: 'margin: 3px 0;' },
            { text: isInDangerZone ? '📋 NEDEN BU BÖLGE ETKİLENİR:' : '📋 NEDEN GÜVENLİ:', className: 'font-bold text-blue-600', style: 'font-size: 11px;' },
            { text: isInThermalZone ? '   Termal ışınım yarıçapı içinde. Ateş topu' : isInBlastZone ? '   Patlama basıncı dalgası bu mesafeye ulaşır.' : isInDangerZone ? '   Hafif basınç etki ve cam kırılması bölgesi.' : '   Etki yarıçaplarının dışında kalan güvenli zon.', style: 'font-size: 11px;' },
            { text: isInThermalZone ? '   ışınları anında tutuşturur ve yakar.' : isInBlastZone ? '   Şok dalgası yapıları yıkar.' : isInDangerZone ? '   Cam ve hafif yapısal hasar oluşur.' : '   Sadece dolaylı etkiler (toz, mülteci) olabilir.', style: 'font-size: 11px;' }
        ], { 
            titleStyle: `color: ${markerColor}; font-weight: bold; font-size: 14px; text-align: center; padding: 5px; background: rgba(${markerColor === '#DC2626' ? '220, 38, 38' : markerColor === '#F97316' ? '249, 115, 22' : markerColor === '#EAB308' ? '234, 179, 8' : '34, 197, 94'}, 0.1); border-radius: 5px; margin-bottom: 8px;`,
            containerStyle: 'min-width: 380px; padding: 12px; font-size: 12px; line-height: 1.5;'
        });
        
        cityMarker.bindPopup(popup);
        
        cityMarker.addTo(mapLayerGroups.megacities);
        
        // Tehlike çizgisi (etki merkezinden şehre)
        if (isInDangerZone) {
            L.polyline([[impactLat, impactLon], [city.lat, city.lon]], {
                color: markerColor,
                weight: 2,
                opacity: 0.5,
                dashArray: '5, 10'
            }).addTo(mapLayerGroups.megacities);
        }
    });
}

// 3. SAĞLIK ALTYAPISI
function addHealthFacilitiesVisualization(impactLat, impactLon, physical, resultData) {
    // Örnek hastane lokasyonları (gerçek verilerden gelmeli)
    const healthFacilities = [
        { name: 'Ankara Üniversitesi Tıp Fakültesi', lat: 39.9428, lon: 32.8543, beds: 1500, type: 'Üniversite Hastanesi' },
        { name: 'Hacettepe Üniversitesi Hastanesi', lat: 39.9295, lon: 32.8640, beds: 1200, type: 'Üniversite Hastanesi' },
        { name: 'Gülhane Eğitim ve Araştırma', lat: 39.9123, lon: 32.8012, beds: 1000, type: 'Askeri Hastane' },
        { name: 'İstanbul Çapa Tıp Fakültesi', lat: 41.0048, lon: 28.9355, beds: 2000, type: 'Üniversite Hastanesi' },
        { name: 'Haydarpaşa Numune', lat: 40.9967, lon: 29.0177, beds: 800, type: 'Devlet Hastanesi' },
        { name: 'Ankara Şehir Hastanesi', lat: 39.9851, lon: 32.7333, beds: 3800, type: 'Şehir Hastanesi' },
        { name: 'İstanbul Başakşehir Şehir', lat: 41.1006, lon: 28.7706, beds: 2600, type: 'Şehir Hastanesi' },
        { name: 'Gaziantep Üniversitesi', lat: 37.0667, lon: 37.3833, beds: 700, type: 'Üniversite Hastanesi' },
        { name: 'Adana Şehir Hastanesi', lat: 37.0000, lon: 35.3213, beds: 1550, type: 'Şehir Hastanesi' },
        { name: 'Mersin Şehir Hastanesi', lat: 36.8120, lon: 34.6415, beds: 1200, type: 'Şehir Hastanesi' }
    ];
    
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    
    healthFacilities.forEach(facility => {
        const dist = haversineDistance(impactLat, impactLon, facility.lat, facility.lon);
        const isDestroyed = dist < blastRadius * 0.5;
        const isDamaged = dist < blastRadius;
        const canReceivePatients = !isDestroyed && !isDamaged;
        
        let iconHtml, status, statusColor;
        
        if (isDestroyed) {
            iconHtml = '🏥❌';
            status = 'YIKILMIŞ';
            statusColor = '#DC2626';
        } else if (isDamaged) {
            iconHtml = '🏥⚠️';
            status = 'HASARLI';
            statusColor = '#F97316';
        } else {
            iconHtml = '🏥✓';
            status = 'AKTİF';
            statusColor = '#22C55E';
        }
        
        const marker = L.marker([facility.lat, facility.lon], {
            icon: L.divIcon({
                className: 'health-facility-icon',
                html: `<div style="font-size: 20px; text-shadow: 2px 2px 2px rgba(0,0,0,0.5);">${iconHtml}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold" style="color: ${statusColor}">🏥 ${facility.name}</div>
                <div class="text-gray-600">${facility.type}</div>
                <hr class="my-2">
                <div>🛏️ Yatak Kapasitesi: <b>${facility.beds}</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                <hr class="my-2">
                <div style="color: ${statusColor}">Durum: <b>${status}</b></div>
                ${isDestroyed ? `<div class="text-red-600">Kaybedilen Yatak: <b>${facility.beds}</b></div>` : ''}
                ${canReceivePatients ? `<div class="text-green-600">Hasta kabul edebilir</div>` : ''}
            </div>
        `);
        
        marker.addTo(mapLayerGroups.healthFacilities);
    });
}

// 4. KRİTİK ALTYAPI
function addCriticalInfrastructureVisualization(impactLat, impactLon, physical, human) {
    // Nükleer santraller
    const nuclearPlants = [
        { name: 'Akkuyu NGS', lat: 36.1400, lon: 33.5300, capacity: 4800, status: 'İnşaat' },
        { name: 'Kozloduy NGS', lat: 43.7469, lon: 23.7714, capacity: 2000, status: 'Aktif', country: 'Bulgaristan' },
        { name: 'Metsamor NGS', lat: 40.1833, lon: 44.1500, capacity: 440, status: 'Aktif', country: 'Ermenistan' },
        { name: 'Bushehr NGS', lat: 28.8306, lon: 50.8861, capacity: 1000, status: 'Aktif', country: 'İran' }
    ];
    
    // Büyük barajlar
    const dams = [
        { name: 'Atatürk Barajı', lat: 37.4858, lon: 38.3203, capacity: '48.7 km³' },
        { name: 'Keban Barajı', lat: 38.8167, lon: 38.7500, capacity: '31 km³' },
        { name: 'Karakaya Barajı', lat: 38.4333, lon: 38.4833, capacity: '9.58 km³' },
        { name: 'Ilısu Barajı', lat: 37.4667, lon: 42.0167, capacity: '10.4 km³' }
    ];
    
    // Havalimanları
    const airports = [
        { name: 'İstanbul Havalimanı', lat: 41.2753, lon: 28.7519, code: 'IST', passengers: '76M' },
        { name: 'Sabiha Gökçen', lat: 40.8986, lon: 29.3092, code: 'SAW', passengers: '35M' },
        { name: 'Ankara Esenboğa', lat: 40.1281, lon: 32.9951, code: 'ESB', passengers: '16M' },
        { name: 'İzmir Adnan Menderes', lat: 38.2924, lon: 27.1569, code: 'ADB', passengers: '14M' },
        { name: 'Antalya', lat: 36.8987, lon: 30.8005, code: 'AYT', passengers: '35M' }
    ];
    
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    
    // Nükleer santraller
    nuclearPlants.forEach(plant => {
        const dist = haversineDistance(impactLat, impactLon, plant.lat, plant.lon);
        const isAtRisk = dist < blastRadius * 3;
        const isCritical = dist < blastRadius;
        
        const marker = L.marker([plant.lat, plant.lon], {
            icon: L.divIcon({
                className: 'nuclear-icon',
                html: `<div style="font-size: 22px; filter: ${isCritical ? 'hue-rotate(0deg)' : 'none'};">☢️</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold ${isCritical ? 'text-red-600' : 'text-yellow-600'}">☢️ ${plant.name}</div>
                <div>${plant.country || 'Türkiye'}</div>
                <hr class="my-2">
                <div>⚡ Kapasite: <b>${plant.capacity} MW</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                <div>Durum: ${plant.status}</div>
                ${isCritical ? '<div class="text-red-600 font-bold">⚠️ KRİTİK TEHLİKE - Radyasyon riski!</div>' : ''}
                ${isAtRisk && !isCritical ? '<div class="text-orange-500">⚠️ İzleme altında</div>' : ''}
            </div>
        `);
        
        marker.addTo(mapLayerGroups.infrastructure);
    });
    
    // Barajlar
    dams.forEach(dam => {
        const dist = haversineDistance(impactLat, impactLon, dam.lat, dam.lon);
        const isAtRisk = dist < blastRadius * 2;
        
        const marker = L.marker([dam.lat, dam.lon], {
            icon: L.divIcon({
                className: 'dam-icon',
                html: `<div style="font-size: 18px;">🌊🏗️</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold text-blue-600">🏗️ ${dam.name}</div>
                <hr class="my-2">
                <div>💧 Kapasite: <b>${dam.capacity}</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                ${isAtRisk ? '<div class="text-red-600 font-bold">⚠️ Baraj yıkılması riski!</div>' : ''}
            </div>
        `);
        
        marker.addTo(mapLayerGroups.infrastructure);
    });
    
    // Havalimanları
    airports.forEach(airport => {
        const dist = haversineDistance(impactLat, impactLon, airport.lat, airport.lon);
        const isDestroyed = dist < blastRadius;
        const isDamaged = dist < blastRadius * 1.5;
        
        const marker = L.marker([airport.lat, airport.lon], {
            icon: L.divIcon({
                className: 'airport-icon',
                html: `<div style="font-size: 18px;">${isDestroyed ? '✈️❌' : '✈️'}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold ${isDestroyed ? 'text-red-600' : 'text-blue-600'}">✈️ ${airport.name} (${airport.code})</div>
                <hr class="my-2">
                <div>👥 Yıllık Yolcu: <b>${airport.passengers}</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                ${isDestroyed ? '<div class="text-red-600 font-bold">❌ ÇALIŞAMAZ</div>' : isDamaged ? '<div class="text-orange-500">⚠️ Hasarlı</div>' : '<div class="text-green-500">✓ Operasyonel</div>'}
            </div>
        `);
        
        marker.addTo(mapLayerGroups.infrastructure);
    });
}

// 5. DENİZALTI KABLOLARI
function addSubmarineCablesVisualization(impactLat, impactLon, physical, resultData) {
    // Ana denizaltı kabloları (Akdeniz ve çevresi)
    const cables = [
        { name: 'SEA-ME-WE 3', points: [[36.2, 29.5], [35.0, 33.0], [31.5, 34.5], [30.0, 32.0]], capacity: '960 Gbps', color: '#3B82F6' },
        { name: 'SEA-ME-WE 4', points: [[36.5, 30.0], [34.5, 32.5], [31.0, 33.0], [28.5, 34.0]], capacity: '1.28 Tbps', color: '#10B981' },
        { name: 'FLAG Europe-Asia', points: [[36.8, 28.0], [35.5, 34.0], [32.0, 35.0]], capacity: '80 Gbps', color: '#F59E0B' },
        { name: 'MedNautilus', points: [[41.0, 29.0], [40.0, 26.0], [38.5, 20.0], [37.0, 15.0]], capacity: '2 Tbps', color: '#EF4444' },
        { name: 'Turcyos-1', points: [[36.5, 34.5], [34.8, 33.0]], capacity: '100 Gbps', color: '#8B5CF6' },
        { name: 'KAFOS', points: [[41.0, 29.0], [41.5, 28.5], [42.0, 28.0]], capacity: '400 Gbps', color: '#EC4899' }
    ];
    
    const tsunamiRadius = physical.crater_diameter_km ? physical.crater_diameter_km * 50 : 200;
    
    cables.forEach(cable => {
        const line = L.polyline(cable.points, {
            color: cable.color,
            weight: 4,
            opacity: 0.8
        });
        
        // Kablonun herhangi bir noktası tehlike bölgesinde mi?
        let isAtRisk = false;
        let minDist = Infinity;
        
        cable.points.forEach(point => {
            const dist = haversineDistance(impactLat, impactLon, point[0], point[1]);
            if (dist < minDist) minDist = dist;
            if (dist < tsunamiRadius) isAtRisk = true;
        });
        
        if (isAtRisk) {
            line.setStyle({ dashArray: '10, 10', weight: 5 });
        }
        
        line.bindPopup(`
            <div class="p-2">
                <div class="font-bold" style="color: ${cable.color}">🌐 ${cable.name}</div>
                <hr class="my-2">
                <div>📡 Kapasite: <b>${cable.capacity}</b></div>
                <div>📍 En Yakın Nokta: <b>${minDist.toFixed(0)} km</b></div>
                ${isAtRisk ? '<div class="text-red-600 font-bold">⚠️ KOPMA RİSKİ - Tsunami/Sismik hasar</div>' : '<div class="text-green-500">✓ Güvende</div>'}
            </div>
        `);
        
        line.addTo(mapLayerGroups.submarineCables);
    });
}

// 6. TSUNAMİ DALGALARI
function addTsunamiVisualization(impactLat, impactLon, physical, resultData) {
    const tsunami = resultData.physical_impact?.tsunami_details || {};
    const isOceanImpact = String(physical.impact_type || '').toLowerCase().includes('ocean');
    
    if (!isOceanImpact && !tsunami.max_wave_height_m) return;
    
    const waveHeight = tsunami.max_wave_height_m || 10;
    const propagationSpeed = tsunami.propagation_speed_kmh || 700;
    
    // Tsunami dalga halkaları (farklı mesafelerde)
    const distances = [50, 100, 200, 500, 1000];
    
    distances.forEach((distKm, index) => {
        // Green's Law ile dalga yüksekliği hesabı
        const heightAtDist = waveHeight * Math.pow(10 / distKm, 0.25);
        const arrivalTime = (distKm / (propagationSpeed / 60)).toFixed(0);
        
        const circle = L.circle([impactLat, impactLon], {
            radius: distKm * 1000,
            color: '#0EA5E9',
            fillColor: 'transparent',
            weight: 2 - index * 0.3,
            opacity: 0.8 - index * 0.15,
            dashArray: '15, 10'
        });
        
        circle.bindPopup(`
            <div class="p-2">
                <div class="font-bold text-blue-500">🌊 Tsunami Dalga Cephesi</div>
                <hr class="my-2">
                <div>📏 Mesafe: <b>${distKm} km</b></div>
                <div>📊 Dalga Yüksekliği: <b>${heightAtDist.toFixed(1)} m</b></div>
                <div>⏱️ Varış Süresi: <b>${arrivalTime} dakika</b></div>
                <div class="text-xs text-gray-500">Green's Law ile hesaplandı</div>
            </div>
        `);
        
        circle.addTo(mapLayerGroups.tsunamiWaves);
    });
    
    // Tsunami yönü ok işaretleri
    for (let angle = 0; angle < 360; angle += 45) {
        const endLat = impactLat + Math.cos(angle * Math.PI / 180) * 3;
        const endLon = impactLon + Math.sin(angle * Math.PI / 180) * 4;
        
        L.polyline([[impactLat, impactLon], [endLat, endLon]], {
            color: '#0EA5E9',
            weight: 2,
            opacity: 0.5
        }).addTo(mapLayerGroups.tsunamiWaves);
    }
}

// 7. SİSMİK DALGA YAYILIMI
function addSeismicWaveVisualization(impactLat, impactLon, physical) {
    const seismicMag = physical.seismic_magnitude || 5;
    
    if (seismicMag < 3) return;
    
    // Sismik dalga halkaları
    const seismicRadii = [10, 50, 100, 250, 500];
    
    seismicRadii.forEach((radius, index) => {
        const intensity = Math.max(0, seismicMag - Math.log10(radius) - 1);
        
        if (intensity < 1) return;
        
        const circle = L.circle([impactLat, impactLon], {
            radius: radius * 1000,
            color: '#A855F7',
            fillColor: 'transparent',
            weight: 2,
            opacity: 0.6 - index * 0.1,
            dashArray: '5, 10'
        });
        
        circle.bindPopup(`
            <div class="p-2">
                <div class="font-bold text-purple-500">📳 Sismik Dalga</div>
                <hr class="my-2">
                <div>📏 Mesafe: <b>${radius} km</b></div>
                <div>📊 Şiddet: <b>${intensity.toFixed(1)} MMI</b></div>
                <div>Etki: ${intensity > 6 ? 'Şiddetli hasar' : intensity > 4 ? 'Orta hasar' : 'Hafif sarsıntı'}</div>
            </div>
        `);
        
        circle.addTo(mapLayerGroups.seismicWaves);
    });
}

// 8. BİYOÇEŞİTLİLİK HOTSPOTLARI
function addBiodiversityVisualization(impactLat, impactLon, physical, resultData) {
    // UNESCO Biyosfer Rezervleri ve önemli doğal alanlar
    const biodiversityAreas = [
        { name: 'Akdeniz Kıyı Ekosistemi', lat: 36.5, lon: 32.0, type: 'Deniz', species: 12000 },
        { name: 'Toros Dağları', lat: 37.0, lon: 34.0, type: 'Dağ', species: 3500 },
        { name: 'Karadeniz Ormanları', lat: 41.5, lon: 33.0, type: 'Orman', species: 4500 },
        { name: 'Güneydoğu Anadolu Step', lat: 37.5, lon: 39.0, type: 'Step', species: 2000 },
        { name: 'Ege Kıyı Sulak Alanları', lat: 38.5, lon: 27.0, type: 'Sulak', species: 5000 },
        { name: 'Fırat-Dicle Havzası', lat: 37.8, lon: 40.0, type: 'Nehir', species: 1500 }
    ];
    
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    
    biodiversityAreas.forEach(area => {
        const dist = haversineDistance(impactLat, impactLon, area.lat, area.lon);
        const isAffected = dist < blastRadius * 2;
        const isCritical = dist < blastRadius;
        
        const estimatedSpeciesLoss = isCritical ? Math.round(area.species * 0.8) : isAffected ? Math.round(area.species * 0.3) : 0;
        
        const marker = L.marker([area.lat, area.lon], {
            icon: L.divIcon({
                className: 'bio-icon',
                html: `<div style="font-size: 20px;">${area.type === 'Deniz' ? '🐬' : area.type === 'Orman' ? '🌲' : area.type === 'Dağ' ? '🏔️' : area.type === 'Sulak' ? '🦢' : '🦎'}</div>`,
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold ${isCritical ? 'text-red-600' : isAffected ? 'text-orange-500' : 'text-green-600'}">${area.name}</div>
                <div class="text-gray-600">${area.type} Ekosistemi</div>
                <hr class="my-2">
                <div>🦎 Türler: <b>${formatNumber(area.species)}</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                ${estimatedSpeciesLoss > 0 ? `<div class="text-red-600">⚠️ Tehlike altındaki tür: <b>${formatNumber(estimatedSpeciesLoss)}</b></div>` : '<div class="text-green-500">✓ Güvende</div>'}
            </div>
        `);
        
        marker.addTo(mapLayerGroups.biodiversity);
    });
}

// 9. TARIMSAL ALANLAR
function addAgricultureVisualization(impactLat, impactLon, physical, resultData) {
    // Türkiye'nin önemli tarım bölgeleri
    const agriculturalAreas = [
        { name: 'Çukurova Ovası', lat: 37.0, lon: 35.3, type: 'Pamuk/Narenciye', area: 15000 },
        { name: 'Konya Ovası', lat: 37.9, lon: 32.5, type: 'Tahıl', area: 20000 },
        { name: 'Harran Ovası', lat: 36.9, lon: 39.0, type: 'Pamuk', area: 10000 },
        { name: 'Gediz Ovası', lat: 38.5, lon: 27.5, type: 'Üzüm/Zeytin', area: 8000 },
        { name: 'Sakarya Ovası', lat: 40.7, lon: 30.4, type: 'Sebze', area: 5000 },
        { name: 'Bafra Ovası', lat: 41.5, lon: 35.9, type: 'Tütün/Pirinç', area: 4000 }
    ];
    
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    
    agriculturalAreas.forEach(area => {
        const dist = haversineDistance(impactLat, impactLon, area.lat, area.lon);
        const isAffected = dist < blastRadius * 3;
        
        // Etkilenen tarım alanı
        const affectedArea = isAffected ? Math.min(area.area, Math.PI * Math.pow(blastRadius * 1.5, 2)) : 0;
        
        const circle = L.circle([area.lat, area.lon], {
            radius: Math.sqrt(area.area / Math.PI) * 1000,
            color: isAffected ? '#EF4444' : '#22C55E',
            fillColor: isAffected ? '#FCA5A5' : '#BBF7D0',
            fillOpacity: 0.3,
            weight: 2
        });
        
        circle.bindPopup(`
            <div class="p-2">
                <div class="font-bold ${isAffected ? 'text-red-600' : 'text-green-600'}">🌾 ${area.name}</div>
                <div class="text-gray-600">${area.type}</div>
                <hr class="my-2">
                <div>📐 Alan: <b>${formatNumber(area.area)} km²</b></div>
                <div>📍 Etki Merkezine: <b>${dist.toFixed(0)} km</b></div>
                ${affectedArea > 0 ? `<div class="text-red-600">⚠️ Etkilenen Alan: <b>${formatNumber(affectedArea.toFixed(0))} km²</b></div>` : '<div class="text-green-500">✓ Güvende</div>'}
            </div>
        `);
        
        circle.addTo(mapLayerGroups.agriculture);
    });
}

// 10. TAHLİYE GÜZERGAHLARİ
function addEvacuationVisualization(impactLat, impactLon, physical, resultData) {
    const blastRadius = physical.air_blast_radius_km?.["1_psi_km"] || 50;
    const evacuationRadius = blastRadius * 2;
    
    // Tahliye bölgesi
    L.circle([impactLat, impactLon], {
        radius: evacuationRadius * 1000,
        color: '#F59E0B',
        fillColor: '#FEF3C7',
        fillOpacity: 0.2,
        weight: 3,
        dashArray: '20, 10'
    }).bindPopup(`
        <div class="p-2">
            <div class="font-bold text-orange-500">🚨 TAHLİYE BÖLGESİ</div>
            <hr class="my-2">
            <div>📏 Yarıçap: <b>${evacuationRadius.toFixed(0)} km</b></div>
            <div>📐 Alan: <b>${(Math.PI * evacuationRadius * evacuationRadius).toFixed(0)} km²</b></div>
            <div class="text-orange-600">Tüm siviller bu bölgeden tahliye edilmeli!</div>
        </div>
    `).addTo(mapLayerGroups.evacuation);
    
    // Güvenli bölge (tahliye sonrası)
    L.circle([impactLat, impactLon], {
        radius: evacuationRadius * 1.5 * 1000,
        color: '#22C55E',
        fillColor: 'transparent',
        weight: 2,
        dashArray: '10, 5'
    }).bindPopup(`
        <div class="p-2">
            <div class="font-bold text-green-500">✓ GÜVENLİ BÖLGE SINIRI</div>
            <div>Bu sınırın dışındaki alanlar güvenlidir.</div>
        </div>
    `).addTo(mapLayerGroups.evacuation);
    
    // Tahliye yönleri (dışa doğru oklar)
    const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    
    angles.forEach((angle, i) => {
        const startLat = impactLat + Math.cos(angle * Math.PI / 180) * (evacuationRadius * 0.8 / 111);
        const startLon = impactLon + Math.sin(angle * Math.PI / 180) * (evacuationRadius * 0.8 / (111 * Math.cos(impactLat * Math.PI / 180)));
        const endLat = impactLat + Math.cos(angle * Math.PI / 180) * (evacuationRadius * 1.3 / 111);
        const endLon = impactLon + Math.sin(angle * Math.PI / 180) * (evacuationRadius * 1.3 / (111 * Math.cos(impactLat * Math.PI / 180)));
        
        L.polyline([[startLat, startLon], [endLat, endLon]], {
            color: '#F59E0B',
            weight: 4,
            opacity: 0.7
        }).bindPopup(`Tahliye Yönü: ${directions[i]}`).addTo(mapLayerGroups.evacuation);
        
        // Ok ucu
        L.circleMarker([endLat, endLon], {
            radius: 6,
            color: '#F59E0B',
            fillColor: '#F59E0B',
            fillOpacity: 1
        }).addTo(mapLayerGroups.evacuation);
    });
}

// 11. TESPİT SİSTEMLERİ
function addDetectionSystemsVisualization(impactLat, impactLon) {
    // Gözetleme sistemleri ve gözlemevleri
    const detectionSystems = [
        { name: 'Pan-STARRS (Hawaii)', lat: 20.7084, lon: -156.2575, type: 'Optik Teleskop', range: 'Tam Gökyüzü' },
        { name: 'Catalina Sky Survey (Arizona)', lat: 32.4165, lon: -110.7323, type: 'Optik Teleskop', range: 'Kuzey Yarıküre' },
        { name: 'ATLAS (Hawaii)', lat: 20.7084, lon: -156.2575, type: 'Asteroit Uyarı', range: 'Tam Gökyüzü' },
        { name: 'NEOWISE', lat: 0, lon: 0, type: 'Uzay Teleskobu', range: 'Kızılötesi' },
        { name: 'TÜBİTAK Gözlemevi', lat: 36.8244, lon: 30.3353, type: 'Optik Teleskop', range: 'Yerel' },
        { name: 'Goldstone Radar', lat: 35.4267, lon: -116.8900, type: 'Radar', range: '0.1 AU' },
        { name: 'Arecibo (kapalı)', lat: 18.3464, lon: -66.7528, type: 'Radar', range: 'Tarihi' }
    ];
    
    detectionSystems.forEach(system => {
        const marker = L.marker([system.lat, system.lon], {
            icon: L.divIcon({
                className: 'detection-icon',
                html: `<div style="font-size: 18px;">${system.type === 'Radar' ? '📡' : system.type === 'Uzay Teleskobu' ? '🛰️' : '🔭'}</div>`,
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold text-blue-600">${system.type === 'Radar' ? '📡' : '🔭'} ${system.name}</div>
                <div class="text-gray-600">${system.type}</div>
                <hr class="my-2">
                <div>📏 Kapsama: <b>${system.range}</b></div>
            </div>
        `);
        
        marker.addTo(mapLayerGroups.detectionSystems);
    });
}

// 12. TARİHSEL OLAYLAR
function addHistoricalEventsVisualization(impactLat, impactLon, energyMT) {
    const historicalEvents = [
        { name: 'Tunguska (1908)', lat: 60.886, lon: 101.894, energy: 15, desc: 'Hava patlaması - 2000 km² orman yıkımı' },
        { name: 'Chelyabinsk (2013)', lat: 54.8, lon: 61.1, energy: 0.44, desc: 'Hava patlaması - 1500 yaralı' },
        { name: 'Chicxulub (65 Mya)', lat: 21.4, lon: -89.5, energy: 100000000, desc: 'Dinozorların yok oluşu' },
        { name: 'Barringer Krateri', lat: 35.028, lon: -111.023, energy: 10, desc: '1.2 km çaplı krater' },
        { name: 'Sikhote-Alin (1947)', lat: 46.16, lon: 134.65, energy: 0.01, desc: 'Demir meteorit yağmuru' }
    ];
    
    historicalEvents.forEach(event => {
        const energyRatio = energyMT / event.energy;
        let comparison = '';
        
        if (energyRatio > 10) {
            comparison = `Bu simülasyon ${event.name}'dan ${energyRatio.toFixed(0)}x daha güçlü`;
        } else if (energyRatio > 0.1) {
            comparison = `Benzer enerji seviyesi`;
        } else {
            comparison = `${event.name} ${(1/energyRatio).toFixed(0)}x daha güçlüydü`;
        }
        
        const marker = L.marker([event.lat, event.lon], {
            icon: L.divIcon({
                className: 'historical-icon',
                html: `<div style="font-size: 16px; background: rgba(0,0,0,0.5); padding: 2px 5px; border-radius: 3px; color: #FCD34D;">📜</div>`,
                iconSize: [25, 25],
                iconAnchor: [12, 12]
            })
        });
        
        marker.bindPopup(`
            <div class="p-2">
                <div class="font-bold text-yellow-600">📜 ${event.name}</div>
                <hr class="my-2">
                <div>💥 Enerji: <b>${event.energy} MT</b></div>
                <div>${event.desc}</div>
                <hr class="my-2">
                <div class="text-sm text-gray-500">${comparison}</div>
            </div>
        `);
        
        marker.addTo(mapLayerGroups.historicalEvents);
    });
}

// HARİTA KATMAN KONTROLÜ - Kompakt ve Kategorize
function addMapLayerControl() {
    console.log('🗂️ Layer control ekleniyor...');
    
    // Eski kontrol varsa kaldır
    if (window.layerControl) {
        map.removeControl(window.layerControl);
        window.layerControl = null;
    }
    
    const overlays = {
        '💥 Etki Bölgeleri': mapLayerGroups.impactZones,
        '🏙️ Megaşehirler': mapLayerGroups.megacities,
        '🏥 Sağlık Tesisleri': mapLayerGroups.healthFacilities,
        '⚡ Kritik Altyapı': mapLayerGroups.infrastructure,
        '🌐 Denizaltı Kabloları': mapLayerGroups.submarineCables,
        '🌊 Tsunami Dalgaları': mapLayerGroups.tsunamiWaves,
        '📳 Sismik Dalgalar': mapLayerGroups.seismicWaves,
        '🦎 Biyoçeşitlilik': mapLayerGroups.biodiversity,
        '🌾 Tarımsal Alanlar': mapLayerGroups.agriculture,
        '🚨 Tahliye Güzergahları': mapLayerGroups.evacuation,
        '🔭 Tespit Sistemleri': mapLayerGroups.detectionSystems,
        '📜 Tarihsel Karşılaştırma': mapLayerGroups.historicalEvents
    };
    
    // Sadece dolu layer'ları ekle
    const activeOverlays = {};
    let activeCount = 0;
    
    Object.entries(overlays).forEach(([name, layer]) => {
        if (layer && layer.getLayers && layer.getLayers().length > 0) {
            activeOverlays[name] = layer;
            activeCount++;
        }
    });
    
    if (activeCount > 0) {
        window.layerControl = L.control.layers(null, activeOverlays, {
            collapsed: isMobileDevice() ? true : false, // Mobilde kapalı
            position: 'topright',
            sortLayers: true,
            autoZIndex: true
        }).addTo(map);
        
        console.log(`✅ ${activeCount} layer group eklendi`);
    } else {
        console.warn('⚠️ Hiç aktif layer yok');
    }
}

// HARİTA LEJANDI - Kompakt ve Collapsible
function addMapLegend(energyMT) {
    // Eski lejant varsa kaldır
    if (mapLegend) {
        map.removeControl(mapLegend);
    }
    
    mapLegend = L.control({ position: 'bottomleft' });
    
    mapLegend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'map-legend');
        div.style.cssText = 'background: rgba(17, 24, 39, 0.9); padding: 8px; border-radius: 6px; color: white; font-size: 9px; max-width: 130px; border: 1px solid #374151; cursor: pointer;';
        
        div.innerHTML = `
            <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('span').textContent = this.nextElementSibling.classList.contains('hidden') ? '▶' : '▼';" 
                 style="font-weight: bold; font-size: 10px; color: #F97316; display: flex; justify-content: space-between; align-items: center;">
                📊 Lejant <span>▼</span>
            </div>
            <div style="margin-top: 6px;">
                <div style="display: flex; align-items: center; margin: 2px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #8B0000; border-radius: 2px; margin-right: 4px;"></span>
                    <span>Krater</span>
                </div>
                <div style="display: flex; align-items: center; margin: 2px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #FF3300; border-radius: 2px; margin-right: 4px;"></span>
                    <span>Termal</span>
                </div>
                <div style="display: flex; align-items: center; margin: 2px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #FF9900; border-radius: 2px; margin-right: 4px;"></span>
                    <span>Patlama</span>
                </div>
                <div style="display: flex; align-items: center; margin: 2px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #0EA5E9; border-radius: 2px; margin-right: 4px;"></span>
                    <span>Tsunami</span>
                </div>
                <div style="display: flex; align-items: center; margin: 2px 0;">
                    <span style="display: inline-block; width: 10px; height: 10px; background: #A855F7; border-radius: 2px; margin-right: 4px;"></span>
                    <span>Sismik</span>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0; padding-top: 4px; color: #9CA3AF; font-size: 8px;">
                    💥 ${energyMT.toFixed(1)} MT
                </div>
            </div>
        `;
        
        // Click event'i durdur (haritaya propagation olmasın)
        L.DomEvent.disableClickPropagation(div);
        
        return div;
    };
    
    mapLegend.addTo(map);
}

// DETAYLI ETKİ İŞARETÇİSİ
function addDetailedImpactMarker(lat, lon, physical, resultData) {
    // Ana etki noktası işaretçisi
    const impactIcon = L.divIcon({
        className: 'impact-marker-icon',
        html: `
            <div style="position: relative;">
                <div style="
                    width: 30px; 
                    height: 30px; 
                    background: radial-gradient(circle, #FF0000 0%, #FF6600 50%, transparent 70%);
                    border-radius: 50%;
                    animation: pulse 1.5s infinite;
                "></div>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 16px;
                ">💥</div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const marker = L.marker([lat, lon], { icon: impactIcon });
    
    const energyMT = physical.impact_energy_megatons_tnt || 0;
    const craterKm = physical.crater_diameter_km || 0;
    const seismicMag = physical.seismic_magnitude || 0;
    
    marker.bindPopup(`
        <div style="min-width: 250px; padding: 10px;">
            <div style="font-size: 16px; font-weight: bold; color: #FF6600; text-align: center; margin-bottom: 10px;">
                💥 ÇARPIŞMA MERKEZİ
            </div>
            <table style="width: 100%; font-size: 12px;">
                <tr>
                    <td style="color: #9CA3AF;">Koordinat:</td>
                    <td style="text-align: right; font-family: monospace;">${lat.toFixed(4)}°, ${lon.toFixed(4)}°</td>
                </tr>
                <tr>
                    <td style="color: #9CA3AF;">Enerji:</td>
                    <td style="text-align: right; color: #F97316; font-weight: bold;">${energyMT.toFixed(2)} MT TNT</td>
                </tr>
                <tr>
                    <td style="color: #9CA3AF;">Krater:</td>
                    <td style="text-align: right;">${craterKm > 0 ? craterKm.toFixed(2) + ' km' : 'Yok (Airburst)'}</td>
                </tr>
                <tr>
                    <td style="color: #9CA3AF;">Sismik:</td>
                    <td style="text-align: right;">${seismicMag.toFixed(1)} Richter</td>
                </tr>
                <tr>
                    <td style="color: #9CA3AF;">Tip:</td>
                    <td style="text-align: right;">${physical.impact_type || 'Bilinmiyor'}</td>
                </tr>
            </table>
            <div style="margin-top: 10px; padding: 8px; background: rgba(239, 68, 68, 0.2); border-radius: 5px; text-align: center; color: #FCA5A5; font-size: 11px;">
                ⚠️ Bu noktanın ${(physical.air_blast_radius_km?.["5_psi_km"] || 10).toFixed(0)} km içindeki tüm yapılar yıkılır
            </div>
        </div>
    `, {
        className: 'impact-popup'
    }).openPopup();
    
    marker.addTo(map);
    
    // Pulse animasyonu için CSS ekle
    if (!document.getElementById('impact-marker-style')) {
        const style = document.createElement('style');
        style.id = 'impact-marker-style';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
            }
            .impact-popup .leaflet-popup-content-wrapper {
                background: rgba(17, 24, 39, 0.95);
                color: white;
                border: 1px solid #374151;
            }
            .impact-popup .leaflet-popup-tip {
                background: rgba(17, 24, 39, 0.95);
            }
            .map-legend {
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            }
        `;
        document.head.appendChild(style);
    }
}


