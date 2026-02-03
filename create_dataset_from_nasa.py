import os
import time

import numpy as np
import pandas as pd
import requests
from tqdm import tqdm

# --- AYARLAR ---
# 1. Adımda aldığınız NASA API anahtarını ENV'den okuyun (önerilen)
# PowerShell: $env:NASA_API_KEY = "..."; python create_dataset_from_nasa.py
NASA_API_KEY = os.getenv('NASA_API_KEY', 'YOUR_API_KEY_HERE')
# Ne kadar veri çekmek istiyoruz? Her sayfada ~20-25 nesne var.
PAGES_TO_FETCH = 120 # Yaklaşık 2400-3000 asteroid verisi için (Hedef: 2000+)

# --- FİZİKSEL MODELLER ---
# Kütle ve krater hesabı için gerekli fonksiyonlar
TARGET_DENSITY = 2700
GRAVITY = 9.81
IMPACTOR_PROPERTIES = {
    'rock': {'density': 3000},
    'ice': {'density': 1000},
    'iron': {'density': 7800}
}

# Literatürde kullanılan standart çap tahmini (H & albedo)
# D(km) = 1329 / sqrt(p) * 10^(-H/5)
ALBEDO_BY_COMPOSITION = {
    # Tipik değerler (çok kaba); gerçek albedo geniş dağılım gösterebilir.
    'ice': 0.04,
    'rock': 0.14,
    'iron': 0.20,
}

VELOCITY_DIST = {
    'mu_kms': 20.0,
    'sigma_kms': 5.0,
    'min_kms': 11.0,
    'max_kms': 72.0,
}

def _to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def estimate_diameter_m_from_h(H, albedo):
    """Estimate diameter (meters) from absolute magnitude H and geometric albedo."""
    H = _to_float(H)
    albedo = _to_float(albedo)
    if H is None or albedo is None or albedo <= 0:
        return None
    diameter_km = 1329.0 / np.sqrt(albedo) * (10 ** (-H / 5.0))
    return float(diameter_km * 1000.0)

def sample_truncated_normal(mu, sigma, lo, hi):
    """Simple rejection sampling for truncated normal."""
    for _ in range(50):
        x = np.random.normal(mu, sigma)
        if lo <= x <= hi:
            return float(x)
    # Fallback: clamp a normal sample
    return float(np.clip(np.random.normal(mu, sigma), lo, hi))

def calculate_mass(diameter_m, density):
    """Verilen çap ve yoğunluktan küresel bir cismin kütlesini hesaplar."""
    radius_m = diameter_m / 2
    volume_m3 = (4/3) * np.pi * (radius_m ** 3)
    return volume_m3 * density

def calculate_crater(energy_joules, density, angle_rad):
    """Krater çapını Holsapple–Schmidt ölçekleme ile hesaplar.

    D_c = K * (E_k / rho_t)^(1/3) * g^(-1/6)
    (Bu veri seti üretiminde K=1.0 varsayılmıştır.)
    """
    if energy_joules <= 0:
        return 0
    K = 1.0
    return float(K * ((energy_joules / TARGET_DENSITY) ** (1/3)) * (GRAVITY ** (-1/6)))

# --- ANA İŞLEM ---
if NASA_API_KEY == 'YOUR_API_KEY_HERE':
    print("HATA: Lütfen kodun içine NASA_API_KEY değişkenini kendi anahtarınızla güncelleyin.")
    exit()

print("NASA NeoWs API'sinden gerçek asteroit verileri çekiliyor...")
all_neos = []
base_url = 'https://api.nasa.gov/neo/rest/v1/neo/browse'

for page in tqdm(range(PAGES_TO_FETCH), desc="Sayfalar taranıyor"):
    try:
        params = {'page': page, 'api_key': NASA_API_KEY}
        response = requests.get(base_url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            all_neos.extend(data.get('near_earth_objects', []))
        else:
            print(f"Hata: Sayfa {page} alınamadı. Durum Kodu: {response.status_code}")
            break # Hata durumunda döngüyü kır
        
        # NASA'nın hız limitine takılmamak için küçük bir bekleme
        time.sleep(1) 
            
    except Exception as e:
        print(f"Bir hata oluştu: {e}")
        break

print(f"\nToplam {len(all_neos)} adet Dünya'ya yakın nesne verisi çekildi.")
print("Veri zenginleştirme ve simülasyon başlıyor...")

impact_data = []
for neo in tqdm(all_neos, desc="Asteroitler işleniyor"):
    try:
        # 1. VERİ ÇEKME (NASA)
        abs_mag_h = neo.get('absolute_magnitude_h')

        # Çap: NASA estimated_diameter varsa onu kullan, yoksa H+albedo ile tahmin et
        avg_diameter_m = None
        diameter_source = None
        try:
            diameter_min_m = neo['estimated_diameter']['meters']['estimated_diameter_min']
            diameter_max_m = neo['estimated_diameter']['meters']['estimated_diameter_max']
            avg_diameter_m = float((diameter_min_m + diameter_max_m) / 2)
            diameter_source = 'nasa_estimated_diameter'
        except Exception:
            avg_diameter_m = None

        # 2. VERİ ZENGİNLEŞTİRME (Bizim Varsayımlarımız)
        # Rastgele bileşim ata (NEO'lar için kaya daha olası)
        composition = np.random.choice(['rock', 'ice', 'iron'], p=[0.80, 0.05, 0.15])
        density = IMPACTOR_PROPERTIES[composition]['density']

        # Albedo ata (bileşime göre tipik değerin etrafında küçük bir oynama)
        base_albedo = ALBEDO_BY_COMPOSITION[composition]
        albedo = float(np.clip(np.random.normal(base_albedo, base_albedo * 0.25), 0.02, 0.60))

        if avg_diameter_m is None:
            avg_diameter_m = estimate_diameter_m_from_h(abs_mag_h, albedo)
            diameter_source = 'h_albedo_estimate'

        if avg_diameter_m is None or avg_diameter_m <= 0:
            continue

        # Hız (yaklaşım verisinden V_rel). Eksikse literatür dağılımından örnekle.
        velocity_kms = None
        velocity_source = None
        try:
            velocity_kms = float(neo['close_approach_data'][0]['relative_velocity']['kilometers_per_second'])
            velocity_source = 'nasa_v_rel'
        except Exception:
            velocity_kms = None

        if velocity_kms is None or not np.isfinite(velocity_kms):
            velocity_kms = sample_truncated_normal(
                VELOCITY_DIST['mu_kms'],
                VELOCITY_DIST['sigma_kms'],
                VELOCITY_DIST['min_kms'],
                VELOCITY_DIST['max_kms'],
            )
            velocity_source = 'stochastic_vi'
        
        # Kütleyi hesapla
        mass_kg = calculate_mass(avg_diameter_m, density)
        
        # Rastgele çarpma açısı ata
        angle_deg = float(np.random.uniform(0, 90))
        
        # 3. SONUÇ HESAPLAMA (Fizik Simülasyonu)
        velocity_ms = velocity_kms * 1000
        angle_rad = np.deg2rad(angle_deg)
        impact_energy_joules = 0.5 * mass_kg * velocity_ms**2
        
        crater_diameter_m = calculate_crater(impact_energy_joules, density, angle_rad)
        
        # 4. EKSTRA VERİLERİ AL (API'den gelen diğer alanlar)
        orbital_data = neo.get('orbital_data', {})
        moid_au = _to_float(orbital_data.get('minimum_orbit_intersection'))
        designation = neo.get('designation') or neo.get('neo_reference_id')
        
        if crater_diameter_m > 1: # Sadece anlamlı kraterleri ekle
            impact_data.append({
                'id': neo.get('id'),
                'name': neo.get('name'),
                'designation': designation,
                'absolute_magnitude_h': _to_float(abs_mag_h),
                'is_potentially_hazardous': neo.get('is_potentially_hazardous_asteroid'),
                # Yörüngesel Veriler
                'orbit_id': orbital_data.get('orbit_id'),
                'eccentricity': _to_float(orbital_data.get('eccentricity')),
                'semi_major_axis': _to_float(orbital_data.get('semi_major_axis')),
                'inclination': _to_float(orbital_data.get('inclination')),
                'orbital_period': _to_float(orbital_data.get('orbital_period')),
                'perihelion_distance': _to_float(orbital_data.get('perihelion_distance')),
                'aphelion_distance': _to_float(orbital_data.get('aphelion_distance')),
                'mean_anomaly': _to_float(orbital_data.get('mean_anomaly')),
                'mean_motion': _to_float(orbital_data.get('mean_motion')),
                'moid_au': moid_au,
                # Simülasyon Verileri
                'diameter_m': float(avg_diameter_m),
                'diameter_source': diameter_source,
                'albedo': albedo,
                'mass_kg': mass_kg,
                'velocity_kms': velocity_kms,
                'velocity_source': velocity_source,
                'angle_deg': angle_deg,
                'density': density,
                'composition': composition,
                'impact_energy_joules': impact_energy_joules,
                'crater_diameter_m': crater_diameter_m
            })

    except (KeyError, IndexError, TypeError, ValueError):
        # Bazı nesnelerin veri yapısı eksik olabilir, onları atlıyoruz.
        continue

# Veriyi DataFrame'e dönüştür ve kaydet
df = pd.DataFrame(impact_data)
print(f"\nToplam {len(df)} satırlık genişletilmiş veri seti oluşturuldu.")
print(f"Veri seti sütunları: {list(df.columns)}")

df.to_csv('nasa_impact_dataset.csv', index=False)

print(f"\nİşlem tamamlandı!")
print(f"NASA verilerine dayalı {len(df)} senaryoluk yeni veri seti 'nasa_impact_dataset.csv' olarak kaydedildi.")
print(df.head())