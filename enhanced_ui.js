/**
 * MeteorViz Enhanced UI Controller
 * ================================
 * 50 veri seti entegrasyonu ile gelişmiş kullanıcı arayüzü
 */

// ============================================================================
// GLOBAL DEĞİŞKENLER
// ============================================================================

const API_BASE = 'http://127.0.0.1:5001';
let currentUIMode = 'simulation';
let comprehensiveAnalysisResult = null;
let sentryThreatsLoaded = false;

// ============================================================================
// SAYFA YÜKLENDİĞİNDE
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('MeteorViz Enhanced UI başlatılıyor...');
    
    // Mod değiştirici butonları
    initModeButtons();
    
    // Sonuç tab'ları
    initResultTabs();
    
    // Veri seti durumunu yükle
    loadDatasetStatus();
    
    // Kapsamlı analiz butonu
    initComprehensiveAnalysis();
    
    // Karar destek butonu
    initDecisionSupport();
    
    // Sentry tehditleri
    loadSentryThreats();
    
    console.log('Enhanced UI hazır!');
});

// ============================================================================
// MOD YÖNETİMİ
// ============================================================================

function initModeButtons() {
    const modeButtons = document.querySelectorAll('#mode-simulation, #mode-analysis, #mode-defense, #mode-datasets');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.target.id.replace('mode-', '');
            switchUIMode(mode);
        });
    });
}

function switchUIMode(mode) {
    currentUIMode = mode;
    
    // Buton stillerini güncelle
    document.querySelectorAll('[id^="mode-"]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('mode-' + mode)?.classList.add('active');
    
    // Panelleri göster/gizle
    document.querySelectorAll('.mode-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById('panel-' + mode)?.classList.remove('hidden');
    
    // Mode'a özel yüklemeler
    if (mode === 'defense' && !sentryThreatsLoaded) {
        loadSentryThreats();
    }
    
    console.log('UI Mode:', mode);
}

// ============================================================================
// SONUÇ TAB'LARI
// ============================================================================

function initResultTabs() {
    const tabButtons = document.querySelectorAll('.result-tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.tab;
            switchResultTab(tabId);
        });
    });
}

function switchResultTab(tabId) {
    // Tab butonlarını güncelle
    document.querySelectorAll('.result-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    
    // Tab içeriklerini göster/gizle
    document.querySelectorAll('.result-tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById('tab-' + tabId)?.classList.remove('hidden');
}

// ============================================================================
// VERİ SETİ DURUMU
// ============================================================================

async function loadDatasetStatus() {
    try {
        const response = await fetch(`${API_BASE}/dataset_status`);
        if (!response.ok) return;
        
        const data = await response.json();
        updateDatasetUI(data);
        
    } catch (e) {
        console.error('Veri seti durumu yüklenemedi:', e);
    }
}

function updateDatasetUI(data) {
    // Header badge
    const headerCount = document.getElementById('header-dataset-count');
    if (headerCount) headerCount.textContent = data.datasets_loaded || 50;
    
    // Progress bar
    const coverage = data.coverage_percent || 100;
    const coverageEl = document.getElementById('dataset-coverage');
    const progressEl = document.getElementById('dataset-progress');
    
    if (coverageEl) coverageEl.textContent = coverage + '%';
    if (progressEl) progressEl.style.width = coverage + '%';
    
    // Kategori sayıları
    const categories = data.categories || {};
    const mapping = {
        'ds-nasa': categories.nasa_jpl_data,
        'ds-asteroid': categories.asteroid_properties,
        'ds-physics': categories.physics_models,
        'ds-infra': categories.infrastructure,
        'ds-historical': categories.historical_validation,
        'ds-defense': 5
    };
    
    for (const [id, value] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el && value !== undefined) {
            el.textContent = value + '/' + value;
        }
    }
}

// ============================================================================
// KAPSAMLI ANALİZ (50 VERİ SETİ)
// ============================================================================

function initComprehensiveAnalysis() {
    const btn = document.getElementById('btn-comprehensive');
    if (btn) {
        btn.addEventListener('click', runComprehensiveAnalysis);
    }
}

async function runComprehensiveAnalysis() {
    const btn = document.getElementById('btn-comprehensive');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analiz Ediliyor...';
    btn.disabled = true;
    
    try {
        const mass = parseFloat(document.getElementById('mass').value);
        const velocity = parseFloat(document.getElementById('velocity').value);
        const angle = parseFloat(document.getElementById('angle_deg').value) || 45;
        const composition = document.getElementById('composition').value;
        const spectralType = document.getElementById('spectral-type')?.value || 'S';
        
        if (!mass || !velocity) {
            alert('Lütfen önce bir asteroit seçin!');
            return;
        }
        
        // Yoğunluk haritası
        const densityMap = {
            'rock': 2700,
            'rubble': 1500,
            'iron': 7800,
            'ice': 1000
        };
        
        const payload = {
            mass_kg: mass,
            velocity_kms: velocity,
            diameter_m: Math.cbrt((6 * mass) / (Math.PI * densityMap[composition])) * 2,
            angle_deg: angle,
            lat: window.impactLatLng?.lat || 40,
            lon: window.impactLatLng?.lng || 30,
            composition: composition,
            spectral_type: spectralType,
            hour_local: new Date().getHours(),
            day_of_week: new Date().getDay(),
            month: new Date().getMonth() + 1
        };
        
        const response = await fetch(`${API_BASE}/comprehensive_impact_analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }
        
        comprehensiveAnalysisResult = await response.json();
        displayComprehensiveResults(comprehensiveAnalysisResult);
        
        // Sonuç panelini göster
        document.getElementById('results-panel')?.classList.remove('hidden');
        
        // Kullanılan veri setlerini göster
        showUsedDatasets(comprehensiveAnalysisResult.datasets_used || []);
        
    } catch (e) {
        console.error('Kapsamlı analiz hatası:', e);
        alert('Analiz hatası: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function displayComprehensiveResults(data) {
    console.log('Kapsamlı Analiz Sonuçları:', data);
    
    // Özet kartları
    const effects = data.impact_effects || {};
    const energy = effects.energy || {};
    
    // Enerji
    safeSetText('res-energy-mt', formatNumber(energy.tnt_equivalent_megatons || 0) + ' MT');
    safeSetText('res-energy-joules', formatEnergy(energy.kinetic_energy_joules || 0));
    safeSetText('res-tnt', formatNumber(energy.tnt_equivalent_megatons || 0) + ' Megaton');
    safeSetText('res-hiroshima', formatNumber(energy.hiroshima_equivalents || 0) + 'x');
    
    // Krater
    const crater = effects.crater || {};
    safeSetText('res-crater', formatNumber(crater.diameter_m || 0) + ' m');
    safeSetText('res-crater-diameter', formatNumber(crater.diameter_m || 0) + ' m');
    safeSetText('res-crater-depth', formatNumber(crater.depth_m || 0) + ' m');
    
    // Sismik
    safeSetText('res-seismic', (effects.seismic_magnitude || 0).toFixed(1) + ' Mw');
    safeSetText('res-seismic-mag', (effects.seismic_magnitude || 0).toFixed(1) + ' Mw');
    
    // Hava şoku
    const blast = effects.blast_radii_km || {};
    safeSetText('res-blast-20', formatNumber((blast['20_psi_km'] || 0) * 1000) + ' m');
    safeSetText('res-blast-5', formatNumber((blast['5_psi_km'] || 0) * 1000) + ' m');
    safeSetText('res-blast-1', formatNumber((blast['1_psi_km'] || 0) * 1000) + ' m');
    
    // Termal
    safeSetText('res-thermal-3', formatNumber((effects.thermal_radius_km || 0) * 1000) + ' m');
    
    // Tsunami
    const tsunami = effects.tsunami || {};
    if (tsunami.is_ocean_impact) {
        document.getElementById('tsunami-land')?.classList.add('hidden');
        document.getElementById('tsunami-ocean')?.classList.remove('hidden');
        
        safeSetText('res-wave-source', formatNumber(tsunami.at_100km?.wave_height_m || 0) + ' m');
        safeSetText('res-wave-100', formatNumber(tsunami.at_100km?.wave_height_m || 0) + ' m');
        safeSetText('res-wave-500', formatNumber(tsunami.at_500km?.wave_height_m || 0) + ' m');
        safeSetText('res-wave-1000', formatNumber(tsunami.at_1000km?.wave_height_m || 0) + ' m');
    } else {
        document.getElementById('tsunami-land')?.classList.remove('hidden');
        document.getElementById('tsunami-ocean')?.classList.add('hidden');
    }
    
    // Airburst analizi
    const airburst = data.airburst_analysis || {};
    safeSetText('res-breakup-alt', (airburst.predicted_breakup_altitude_km || 0).toFixed(1) + ' km');
    safeSetText('res-impact-type', airburst.reaches_ground ? 'Yüzey Çarpışması' : 'Airburst');
    
    // Risk değerlendirmesi
    updateRiskAssessment(data);
}

function showUsedDatasets(datasets) {
    if (datasets.length === 0) return;
    
    console.log('Kullanılan veri setleri:', datasets);
    // Bildirim gösterilebilir
}

// ============================================================================
// KARAR DESTEK SİSTEMİ
// ============================================================================

function initDecisionSupport() {
    const btn = document.getElementById('btn-decision-support');
    if (btn) {
        btn.addEventListener('click', runDecisionSupportAnalysis);
    }
}

async function runDecisionSupportAnalysis() {
    const btn = document.getElementById('btn-decision-support');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analiz Ediliyor...';
    btn.disabled = true;
    
    try {
        const mass = parseFloat(document.getElementById('mass').value);
        const velocity = parseFloat(document.getElementById('velocity').value);
        
        if (!mass || !velocity) {
            alert('Lütfen önce bir asteroit seçin!');
            return;
        }
        
        const payload = {
            mass_kg: mass,
            velocity_kms: velocity,
            angle_deg: parseFloat(document.getElementById('angle_deg').value) || 45,
            density_kgm3: 2500,
            diameter_m: Math.cbrt((6 * mass) / (Math.PI * 2500)) * 2,
            lat: window.impactLatLng?.lat || 40,
            lon: window.impactLatLng?.lng || 30,
            impact_probability: 0.01,
            base_population: 1000000,
            observation_arc_days: 30,
            country: 'Türkiye',
            scenario_id: 'ui_' + Date.now()
        };
        
        const response = await fetch(`${API_BASE}/decision_support`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('API yanıt vermedi');
        }
        
        const result = await response.json();
        displayDecisionResults(result);
        
        // Analiz moduna geç
        switchUIMode('analysis');
        
    } catch (e) {
        console.error('Karar destek hatası:', e);
        alert('Analiz hatası: ' + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function displayDecisionResults(data) {
    console.log('Karar Destek Sonuçları:', data);
    
    const policy = data.policy || {};
    
    // Ana öneri
    safeSetText('decision-action', formatActionName(policy.recommended_action || 'BİLİNMİYOR'));
    safeSetText('decision-confidence', (policy.confidence_pct || 0).toFixed(0) + '%');
    
    // Torino badge
    const torino = policy.torino_scale || 0;
    const torinoBadge = document.getElementById('torino-badge');
    if (torinoBadge) {
        torinoBadge.textContent = 'T' + torino;
        torinoBadge.className = 'torino-' + torino + ' px-4 py-2 rounded-lg text-2xl font-bold';
    }
    
    // Palermo
    safeSetText('palermo-value', (policy.palermo_scale || -Infinity).toFixed(2));
    
    // Gerekçeler
    const justList = document.getElementById('decision-justification');
    if (justList) {
        justList.innerHTML = '';
        (policy.action_justification || []).forEach(j => {
            const div = document.createElement('div');
            div.className = 'p-2 bg-gray-800 rounded text-xs';
            div.innerHTML = `
                <span class="text-green-400">✓</span>
                <span class="text-gray-300 ml-2">${j.criterion}</span>
            `;
            justList.appendChild(div);
        });
    }
    
    // Reddedilen alternatifler
    const rejList = document.getElementById('decision-rejected');
    if (rejList) {
        rejList.innerHTML = '';
        (policy.rejected_alternatives || []).forEach(r => {
            const div = document.createElement('div');
            div.className = 'p-2 bg-gray-800 rounded text-xs';
            div.innerHTML = `
                <span class="text-red-400">✗</span>
                <span class="text-gray-300 ml-2">${r.action}</span>
                <span class="text-gray-500 block ml-4">${r.reason}</span>
            `;
            rejList.appendChild(div);
        });
    }
    
    // Sosyoekonomik
    const socio = data.socioeconomic || {};
    safeSetText('socio-raw-casualties', formatNumber(socio.raw_casualty_estimate?.mean || 0));
    safeSetText('socio-vulnerability', (socio.vulnerability_multiplier || 1).toFixed(1) + 'x');
    safeSetText('socio-adjusted', formatNumber(socio.adjusted_casualties?.mean || 0));
    safeSetText('socio-economic', formatCurrency(socio.economic_damage_usd?.mean || 0));
}

// ============================================================================
// SENTRY TEHDİTLERİ
// ============================================================================

async function loadSentryThreats() {
    try {
        const response = await fetch(`${API_BASE}/sentry_threats`);
        if (!response.ok) return;
        
        const data = await response.json();
        displaySentryThreats(data.threats || []);
        sentryThreatsLoaded = true;
        
    } catch (e) {
        console.error('Sentry tehditleri yüklenemedi:', e);
    }
}

function displaySentryThreats(threats) {
    const tbody = document.getElementById('sentry-table');
    if (!tbody) return;
    
    if (threats.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-gray-500">
                    Aktif tehdit bulunamadı
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = threats.slice(0, 10).map(t => `
        <tr class="border-b border-gray-800 hover:bg-gray-800/50">
            <td class="py-2 px-3 text-white font-medium">${t.designation || t.name || 'Bilinmiyor'}</td>
            <td class="text-center py-2 px-3 font-mono">${t.diameter_km ? t.diameter_km.toFixed(2) + ' km' : '-'}</td>
            <td class="text-center py-2 px-3 font-mono text-orange-400">${formatProbability(t.impact_probability)}</td>
            <td class="text-center py-2 px-3">${t.potential_impact_date || '-'}</td>
            <td class="text-center py-2 px-3 font-mono ${t.palermo_scale > 0 ? 'text-red-400' : 'text-green-400'}">
                ${t.palermo_scale ? t.palermo_scale.toFixed(2) : '-'}
            </td>
            <td class="text-center py-2 px-3">
                <span class="torino-${t.torino_scale || 0} px-2 py-1 rounded text-sm font-bold">
                    T${t.torino_scale || 0}
                </span>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// RİSK DEĞERLENDİRMESİ
// ============================================================================

function updateRiskAssessment(data) {
    const energy = data.impact_effects?.energy?.tnt_equivalent_megatons || 0;
    
    // Torino ölçeği hesaplama (basitleştirilmiş)
    let torino = 0;
    if (energy > 10000) torino = 10;
    else if (energy > 1000) torino = 8;
    else if (energy > 100) torino = 6;
    else if (energy > 10) torino = 4;
    else if (energy > 1) torino = 2;
    else if (energy > 0.01) torino = 1;
    
    // Palermo ölçeği hesaplama (basitleştirilmiş)
    const impactProb = 0.001; // Örnek değer
    const palermo = Math.log10(impactProb / (0.03 * Math.pow(energy, 0.8)));
    
    // UI güncelleme
    const torinoBadge = document.getElementById('torino-badge');
    if (torinoBadge) {
        torinoBadge.textContent = 'T' + torino;
        torinoBadge.className = 'torino-' + torino + ' px-4 py-2 rounded-lg text-2xl font-bold';
    }
    
    safeSetText('palermo-value', palermo.toFixed(2));
}

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatNumber(n) {
    if (n === null || n === undefined) return '-';
    if (n >= 1e12) return (n / 1e12).toFixed(1) + ' Trilyon';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' Milyar';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Milyon';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + ' Bin';
    return Math.round(n).toLocaleString('tr-TR');
}

function formatEnergy(joules) {
    if (joules >= 1e21) return (joules / 1e21).toFixed(1) + ' ZJ';
    if (joules >= 1e18) return (joules / 1e18).toFixed(1) + ' EJ';
    if (joules >= 1e15) return (joules / 1e15).toFixed(1) + ' PJ';
    if (joules >= 1e12) return (joules / 1e12).toFixed(1) + ' TJ';
    if (joules >= 1e9) return (joules / 1e9).toFixed(1) + ' GJ';
    return joules.toExponential(2) + ' J';
}

function formatCurrency(usd) {
    if (usd >= 1e12) return '$' + (usd / 1e12).toFixed(1) + ' Trilyon';
    if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(1) + ' Milyar';
    if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + ' Milyon';
    return '$' + Math.round(usd).toLocaleString('tr-TR');
}

function formatProbability(p) {
    if (p === null || p === undefined) return '-';
    if (p >= 0.01) return (p * 100).toFixed(1) + '%';
    if (p >= 0.0001) return (p * 100).toFixed(4) + '%';
    return '1/' + Math.round(1/p).toLocaleString('tr-TR');
}

function formatActionName(action) {
    if (!action) return 'Bilinmiyor';
    
    const translations = {
        'CONTINUE_OBSERVATION': 'Gözleme Devam',
        'ENHANCED_TRACKING': 'Gelişmiş Takip',
        'PRECAUTIONARY_PLANNING': 'Önlem Planlaması',
        'ACTIVE_PREPARATION': 'Aktif Hazırlık',
        'DEFLECTION_MISSION': 'Saptırma Misyonu',
        'CIVIL_DEFENSE_ALERT': 'Sivil Savunma Alarmı',
        'EVACUATION': 'Tahliye',
        'SHELTER_IN_PLACE': 'Yerinde Sığınma'
    };
    
    return translations[action] || action.replace(/_/g, ' ');
}

// ============================================================================
// EXPORT
// ============================================================================

window.enhancedUI = {
    switchUIMode,
    loadDatasetStatus,
    runComprehensiveAnalysis,
    runDecisionSupportAnalysis
};

console.log('Enhanced UI modülü yüklendi');
