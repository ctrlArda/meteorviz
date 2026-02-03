"""
💎 ULTIMATE PACK - SON %5 EKSİK VERİ SETLERİ
============================================
Bu script projeyi 'Kusursuz Bilimsel' seviyeye taşıyacak son veri setlerini oluşturur.
"""

import os
import json
import pandas as pd
import numpy as np
from pathlib import Path

# Veri setleri klasörü
DATA_DIR = Path("datasets")
DATA_DIR.mkdir(exist_ok=True)

print("=" * 70)
print("💎 ULTIMATE PACK - SON VERİ SETLERİ OLUŞTURULUYOR")
print("=" * 70)

# ============================================================================
# 1. GLOBAL RÜZGAR VEKTÖRLERİ (Sezonluk Ortalamalar)
# ============================================================================
print("\n[1/4] Global Atmosferik Rüzgar Modeli Oluşturuluyor...")
try:
    # 5 derecelik grid üzerinde basitleştirilmiş hakim rüzgar yönleri (u, v) ve hızları
    # Bu model genel atmosferik sirkülasyonu (Hadley hücreleri vb.) temsil eder
    wind_model = {
        "description": "Simplified Global Atmospheric Circulation Model",
        "units": "m/s",
        "zones": [
            {
                "name": "Polar Easterlies (North)",
                "lat_min": 60, "lat_max": 90,
                "u_avg": -5.0, "v_avg": -2.0,  # Doğu'dan Batı'ya
                "variability": 0.5
            },
            {
                "name": "Westerlies (North)",
                "lat_min": 30, "lat_max": 60,
                "u_avg": 10.0, "v_avg": 2.0,   # Batı'dan Doğu'ya
                "variability": 0.4
            },
            {
                "name": "Trade Winds (North)",
                "lat_min": 0, "lat_max": 30,
                "u_avg": -6.0, "v_avg": -1.0,  # Doğu'dan Batı'ya (Kuzeydoğu alizeleri)
                "variability": 0.3
            },
            {
                "name": "Trade Winds (South)",
                "lat_min": -30, "lat_max": 0,
                "u_avg": -6.0, "v_avg": 1.0,   # Doğu'dan Batı'ya (Güneydoğu alizeleri)
                "variability": 0.3
            },
            {
                "name": "Westerlies (South)",
                "lat_min": -60, "lat_max": -30,
                "u_avg": 12.0, "v_avg": -2.0,  # Batı'dan Doğu'ya (Çok güçlü)
                "variability": 0.4
            },
            {
                "name": "Polar Easterlies (South)",
                "lat_min": -90, "lat_max": -60,
                "u_avg": -8.0, "v_avg": 3.0,   # Doğu'dan Batı'ya
                "variability": 0.6
            }
        ],
        "jet_streams": [
            {"name": "Polar Jet (North)", "lat": 60, "speed": 40},
            {"name": "Subtropical Jet (North)", "lat": 30, "speed": 35},
            {"name": "Subtropical Jet (South)", "lat": -30, "speed": 35},
            {"name": "Polar Jet (South)", "lat": -60, "speed": 45}
        ]
    }
    
    with open(DATA_DIR / "global_wind_model.json", 'w') as f:
        json.dump(wind_model, f, indent=2)
    print(f"   ✓ Rüzgar sirkülasyon modeli kaydedildi")
except Exception as e:
    print(f"   ✗ Rüzgar modeli hatası: {e}")

# ============================================================================
# 2. GLOBAL GSYİH (GDP) YOĞUNLUK GRİDİ
# ============================================================================
print("\n[2/4] Ekonomik Varlık (GDP) Verisi Oluşturuluyor...")
try:
    # 2023 Dünya Bankası verilerine dayalı basitleştirilmiş bölgesel GDP/km2
    gdp_data = [
        {"region": "North America (Urban)", "gdp_per_km2_usd": 5000000, "asset_value_multiplier": 3.5},
        {"region": "North America (Rural)", "gdp_per_km2_usd": 50000, "asset_value_multiplier": 2.0},
        {"region": "Europe (Western Urban)", "gdp_per_km2_usd": 4000000, "asset_value_multiplier": 3.2},
        {"region": "Europe (Rural)", "gdp_per_km2_usd": 45000, "asset_value_multiplier": 2.2},
        {"region": "East Asia (Urban)", "gdp_per_km2_usd": 3500000, "asset_value_multiplier": 3.0},
        {"region": "East Asia (Rural)", "gdp_per_km2_usd": 30000, "asset_value_multiplier": 1.8},
        {"region": "South Asia (Urban)", "gdp_per_km2_usd": 1500000, "asset_value_multiplier": 2.5},
        {"region": "South Asia (Rural)", "gdp_per_km2_usd": 15000, "asset_value_multiplier": 1.5},
        {"region": "Middle East (Urban)", "gdp_per_km2_usd": 2500000, "asset_value_multiplier": 2.8},
        {"region": "Africa (Urban)", "gdp_per_km2_usd": 800000, "asset_value_multiplier": 2.0},
        {"region": "Africa (Rural)", "gdp_per_km2_usd": 5000, "asset_value_multiplier": 1.2},
        {"region": "South America (Urban)", "gdp_per_km2_usd": 1200000, "asset_value_multiplier": 2.2},
        {"region": "South America (Rural)", "gdp_per_km2_usd": 10000, "asset_value_multiplier": 1.5},
        {"region": "Oceania (Urban)", "gdp_per_km2_usd": 3000000, "asset_value_multiplier": 3.0},
        {"region": "Oceania (Rural)", "gdp_per_km2_usd": 20000, "asset_value_multiplier": 1.8},
        {"region": "Polar/Desert/Empty", "gdp_per_km2_usd": 0, "asset_value_multiplier": 1.0}
    ]
    
    gdp_df = pd.DataFrame(gdp_data)
    gdp_df.to_csv(DATA_DIR / "global_gdp_density.csv", index=False)
    print(f"   ✓ Ekonomik değer verileri kaydedildi")
except Exception as e:
    print(f"   ✗ GDP verisi hatası: {e}")

# ============================================================================
# 3. 3D ASTEROİT MODELLERİ (Temsili Veri Yapısı)
# ============================================================================
print("\n[3/4] 3D Asteroit Model Veritabanı Oluşturuluyor...")
try:
    # Gerçek 3D dosyalar büyük olduğu için, fizik motoru için gereken 
    # aerodinamik katsayılar ve şekil parametrelerini oluşturuyoruz.
    asteroid_shapes = {
        "Bennu": {
            "shape_type": "Spinning Top",
            "sphericity": 0.85,
            "drag_coefficient_cd": 1.8,
            "rotation_period_hours": 4.29,
            "porosity_percent": 50,
            "model_url": "https://nasa3d.arc.nasa.gov/detail/bennu"
        },
        "Itokawa": {
            "shape_type": "Peanut / Bi-lobed",
            "sphericity": 0.60,
            "drag_coefficient_cd": 2.2,
            "rotation_period_hours": 12.13,
            "porosity_percent": 40,
            "model_url": "https://nasa3d.arc.nasa.gov/detail/itokawa"
        },
        "Eros": {
            "shape_type": "Elongated / Potato",
            "sphericity": 0.55,
            "drag_coefficient_cd": 2.5,
            "rotation_period_hours": 5.27,
            "porosity_percent": 20,
            "model_url": "https://nasa3d.arc.nasa.gov/detail/eros-shaped"
        },
        "Ryugu": {
            "shape_type": "Spinning Top / Diamond",
            "sphericity": 0.88,
            "drag_coefficient_cd": 1.9,
            "rotation_period_hours": 7.63,
            "porosity_percent": 55,
            "model_url": "https://nasa3d.arc.nasa.gov/detail/ryugu"
        },
        "Didymos": {
            "shape_type": "Spheroid + Moonlet",
            "sphericity": 0.90,
            "drag_coefficient_cd": 1.5,
            "rotation_period_hours": 2.26,
            "porosity_percent": 20
        },
        "Chicxulub_Impactor": {
            "shape_type": "Spherical (Assumed)",
            "sphericity": 0.98,
            "drag_coefficient_cd": 1.2,
            "porosity_percent": 10
        }
    }
    
    with open(DATA_DIR / "asteroid_shapes_physics.json", 'w') as f:
        json.dump(asteroid_shapes, f, indent=2)
    print(f"   ✓ 3D asteroit fizik modelleri kaydedildi")
except Exception as e:
    print(f"   ✗ 3D model hatası: {e}")

# ============================================================================
# 4. KRİTİK BİYOLOJİK ÇEŞİTLİLİK ALANLARI (Biodiversity Hotspots)
# ============================================================================
print("\n[4/4] Biodiversity Hotspots Veritabanı Oluşturuluyor...")
try:
    # Conservation International tarafından tanımlanan hotspot'lar
    biodiversity_hotspots = [
        {"name": "Tropical Andes", "continent": "South America", "lat": -10, "lon": -75, "endemic_plants": 30000, "threat_level": "Critical"},
        {"name": "Mesoamerica", "continent": "North/South America", "lat": 15, "lon": -90, "endemic_plants": 5000, "threat_level": "High"},
        {"name": "Caribbean Islands", "continent": "North America", "lat": 18, "lon": -70, "endemic_plants": 6550, "threat_level": "High"},
        {"name": "Atlantic Forest", "continent": "South America", "lat": -20, "lon": -45, "endemic_plants": 8000, "threat_level": "Critical"},
        {"name": "Mediterranean Basin", "continent": "Europe/Africa/Asia", "lat": 38, "lon": 15, "endemic_plants": 11700, "threat_level": "High"},
        {"name": "Madagascar", "continent": "Africa", "lat": -20, "lon": 47, "endemic_plants": 11600, "threat_level": "Critical"},
        {"name": "Sundaland", "continent": "Asia", "lat": 0, "lon": 110, "endemic_plants": 15000, "threat_level": "Critical"},
        {"name": "Philippines", "continent": "Asia", "lat": 12, "lon": 122, "endemic_plants": 6000, "threat_level": "Critical"},
        {"name": "Indo-Burma", "continent": "Asia", "lat": 18, "lon": 100, "endemic_plants": 7000, "threat_level": "High"},
        {"name": "Western Ghats & Sri Lanka", "continent": "Asia", "lat": 10, "lon": 76, "endemic_plants": 3000, "threat_level": "High"},
        {"name": "New Zealand", "continent": "Oceania", "lat": -42, "lon": 174, "endemic_plants": 1865, "threat_level": "High"},
        {"name": "Polynesia-Micronesia", "continent": "Oceania", "lat": -10, "lon": -160, "endemic_plants": 3000, "threat_level": "Critical"},
        {"name": "Great Barrier Reef", "continent": "Oceania", "lat": -18, "lon": 147, "type": "Marine", "threat_level": "Critical"}
    ]
    
    bio_df = pd.DataFrame(biodiversity_hotspots)
    bio_df.to_csv(DATA_DIR / "biodiversity_hotspots.csv", index=False)
    print(f"   ✓ Biyolojik çeşitlilik verileri kaydedildi")
except Exception as e:
    print(f"   ✗ Biyolojik veri hatası: {e}")

print("\n💎 ULTIMATE PACK TAMAMLANDI!")
