"""
🏆 WORLD PHYSICS CHAMPIONSHIP - ELITE DATASETS
===============================================
Bu script, projeyi 'Lise/Lisans' seviyesinden 'Doktora/NASA' seviyesine taşıyacak
ileri fizik veri setlerini indirir ve oluşturur.

İÇERİK:
1. NASA JPL DE440s (Ephemeris Kernel) - N-Cisim Hassas Yörünge
2. US Standard Atmosphere 1976 - Katmanlı Atmosfer Fiziği
3. PREM (Preliminary Reference Earth Model) - Sismik Dalga Fiziği
4. Meteorite Tensile Strength - Parçalanma İstatistiği (Weibull)
"""

import os
import json
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from skyfield.api import Loader

# Veri setleri klasörü
DATA_DIR = Path("datasets")
DATA_DIR.mkdir(exist_ok=True)

print("=" * 70)
print("🏆 FİZİK ŞAMPİYONASI - ELİT VERİ SETLERİ (NASA CLASS)")
print("=" * 70)

# ============================================================================
# 1. NASA JPL DE440s (Ephemeris Kernel)
# ============================================================================
print("\n[1/4] NASA JPL DE440s Ephemeris İndiriliyor...")
try:
    # Skyfield Loader kullanarak indirme (Resmi NASA sunucularından)
    load = Loader(DATA_DIR)
    # de440s.bsp (Short version) ~32MB, 1849-2150 yıllarını kapsar. Yarışma için mükemmel.
    planets = load('de440s.bsp')
    print(f"   ✓ NASA Ephemeris Kernel (de440s.bsp) hazır.")
    print(f"     Konum: {DATA_DIR / 'de440s.bsp'}")
except Exception as e:
    print(f"   ✗ Ephemeris indirme hatası: {e}")

# ============================================================================
# 2. US STANDARD ATMOSPHERE 1976 (Katmanlı Model)
# ============================================================================
print("\n[2/4] US Standard Atmosphere 1976 Modeli Oluşturuluyor...")
try:
    # 7 Katmanlı detaylı model (Geopotential Height vs Temperature/Pressure)
    atmosphere_model = {
        "description": "US Standard Atmosphere 1976 - Idealized Steady State",
        "layers": [
            {
                "name": "Troposphere",
                "base_altitude_km": 0,
                "lapse_rate_k_km": -6.5,
                "base_temp_k": 288.15,
                "base_pressure_pa": 101325.0,
                "base_density_kgm3": 1.225
            },
            {
                "name": "Tropopause",
                "base_altitude_km": 11,
                "lapse_rate_k_km": 0.0,
                "base_temp_k": 216.65,
                "base_pressure_pa": 22632.1,
                "base_density_kgm3": 0.36391
            },
            {
                "name": "Stratosphere 1",
                "base_altitude_km": 20,
                "lapse_rate_k_km": 1.0,
                "base_temp_k": 216.65,
                "base_pressure_pa": 5474.89,
                "base_density_kgm3": 0.08803
            },
            {
                "name": "Stratosphere 2",
                "base_altitude_km": 32,
                "lapse_rate_k_km": 2.8,
                "base_temp_k": 228.65,
                "base_pressure_pa": 868.019,
                "base_density_kgm3": 0.01322
            },
            {
                "name": "Stratopause",
                "base_altitude_km": 47,
                "lapse_rate_k_km": 0.0,
                "base_temp_k": 270.65,
                "base_pressure_pa": 110.906,
                "base_density_kgm3": 0.00143
            },
            {
                "name": "Mesosphere 1",
                "base_altitude_km": 51,
                "lapse_rate_k_km": -2.8,
                "base_temp_k": 270.65,
                "base_pressure_pa": 66.9389,
                "base_density_kgm3": 0.00086
            },
            {
                "name": "Mesosphere 2",
                "base_altitude_km": 71,
                "lapse_rate_k_km": -2.0,
                "base_temp_k": 214.65,
                "base_pressure_pa": 3.95642,
                "base_density_kgm3": 0.000064
            }
        ],
        "constants": {
            "R_gas_constant": 8.31432,
            "g0_gravity": 9.80665,
            "M_air_molar_mass": 0.0289644
        }
    }
    
    with open(DATA_DIR / "us_standard_atmosphere_1976.json", 'w') as f:
        json.dump(atmosphere_model, f, indent=2)
    print(f"   ✓ Atmosferik fizik modeli kaydedildi")
except Exception as e:
    print(f"   ✗ Atmosfer modeli hatası: {e}")

# ============================================================================
# 3. PREM (Preliminary Reference Earth Model) - Sismik Fizik
# ============================================================================
print("\n[3/4] PREM Sismik Yer Modeli Oluşturuluyor...")
try:
    # Dünyanın iç yapısı (Derinlik vs Yoğunluk ve Dalga Hızları)
    prem_data = [
        {"layer": "Upper Crust", "depth_km": 15,    "density_gcm3": 2.60, "v_p_kms": 5.80, "v_s_kms": 3.20},
        {"layer": "Lower Crust", "depth_km": 24.4,  "density_gcm3": 2.90, "v_p_kms": 6.80, "v_s_kms": 3.90},
        {"layer": "Upper Mantle (Lid)", "depth_km": 80,  "density_gcm3": 3.38, "v_p_kms": 8.10, "v_s_kms": 4.50},
        {"layer": "Low Velocity Zone", "depth_km": 220, "density_gcm3": 3.30, "v_p_kms": 7.90, "v_s_kms": 4.30},
        {"layer": "Transition Zone", "depth_km": 400, "density_gcm3": 3.50, "v_p_kms": 9.00, "v_s_kms": 5.00},
        {"layer": "Lower Mantle", "depth_km": 670, "density_gcm3": 4.40, "v_p_kms": 10.7, "v_s_kms": 5.90},
        {"layer": "Outer Core (Liquid)", "depth_km": 2891, "density_gcm3": 9.90, "v_p_kms": 8.10, "v_s_kms": 0.00},
        {"layer": "Inner Core (Solid)", "depth_km": 5150, "density_gcm3": 12.8, "v_p_kms": 11.0, "v_s_kms": 3.50},
        {"layer": "Center", "depth_km": 6371, "density_gcm3": 13.1, "v_p_kms": 11.3, "v_s_kms": 3.70}
    ]
    
    prem_df = pd.DataFrame(prem_data)
    prem_df.to_csv(DATA_DIR / "prem_earth_model.csv", index=False)
    print(f"   ✓ PREM sismik modeli kaydedildi")
except Exception as e:
    print(f"   ✗ PREM modeli hatası: {e}")

# ============================================================================
# 4. METEORITE TENSILE STRENGTH (Malzeme Fiziği)
# ============================================================================
print("\n[4/4] Meteorite Tensile Strength Database Oluşturuluyor...")
try:
    # Gerçek meteoritlerin kopma/parçalanma dayanımları (Pascals)
    # Weibull modülü (parçalanma istatistiği için)
    material_physics = {
        "Iron (Gibeon)": {"tensile_strength_mpa": 350, "weibull_modulus": 15},
        "Stony-Iron (Pallasite)": {"tensile_strength_mpa": 60, "weibull_modulus": 8},
        "Chondrite (L5)": {"tensile_strength_mpa": 25, "weibull_modulus": 6},
        "Carbonaceous Chondrite": {"tensile_strength_mpa": 5, "weibull_modulus": 3},
        "Cometary Ice": {"tensile_strength_mpa": 0.1, "weibull_modulus": 2}
    }
    
    with open(DATA_DIR / "meteorite_physics.json", 'w') as f:
        json.dump(material_physics, f, indent=2)
    print(f"   ✓ Malzeme fiziği verileri kaydedildi")
except Exception as e:
    print(f"   ✗ Malzeme fiziği hatası: {e}")

print("\n🏆 ŞAMPİYONLUK VERİLERİ HAZIR!")
