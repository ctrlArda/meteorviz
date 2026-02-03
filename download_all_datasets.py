"""
🛡️ KUSURSUZ GEZEGEN SAVUNMASI SİSTEMİ
Tüm Veri Setleri İndirme ve Entegrasyon Scripti
================================================
"""

import os
import json
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

# Veri setleri klasörü
DATA_DIR = Path("datasets")
DATA_DIR.mkdir(exist_ok=True)

print("=" * 70)
print("🛡️ KUSURSUZ GEZEGEN SAVUNMASI - TÜM VERİ SETLERİ")
print("=" * 70)
print(f"Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# 1. CNEOS CLOSE APPROACH - YAKIN GEÇİŞ VERİLERİ (Gerçek Zamanlı)
# ============================================================================
print("\n[1/15] CNEOS Close Approach Verileri İndiriliyor...")
try:
    # Gelecek 60 gün için yakın geçiş verileri
    cad_url = "https://ssd-api.jpl.nasa.gov/cad.api"
    params = {
        "date-min": datetime.now().strftime("%Y-%m-%d"),
        "date-max": (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d"),
        "dist-max": "0.05",  # 0.05 AU = ~7.5 milyon km
        "sort": "date"
    }
    response = requests.get(cad_url, params=params, timeout=30)
    cad_data = response.json()
    
    if 'data' in cad_data:
        # Sütun isimleri
        fields = cad_data.get('fields', [])
        cad_df = pd.DataFrame(cad_data['data'], columns=fields)
        cad_df.to_csv(DATA_DIR / "cneos_close_approach.csv", index=False)
        print(f"   ✓ {len(cad_df)} yakın geçiş kaydedildi (gelecek 365 gün)")
except Exception as e:
    print(f"   ✗ Close Approach hatası: {e}")

# ============================================================================
# 2. CNEOS FIREBALL DATA - ATMOSFER PATLAMALARI (Gerçek Olaylar)
# ============================================================================
print("\n[2/15] CNEOS Fireball Data İndiriliyor...")
try:
    fireball_url = "https://ssd-api.jpl.nasa.gov/fireball.api"
    params = {
        "date-min": "2000-01-01",
        "limit": 1000
    }
    response = requests.get(fireball_url, params=params, timeout=30)
    fb_data = response.json()
    
    if 'data' in fb_data:
        fields = fb_data.get('fields', [])
        fb_df = pd.DataFrame(fb_data['data'], columns=fields)
        fb_df.to_csv(DATA_DIR / "cneos_fireballs.csv", index=False)
        print(f"   ✓ {len(fb_df)} atmosferik patlama kaydedildi (2000'den beri)")
except Exception as e:
    print(f"   ✗ Fireball hatası: {e}")

# ============================================================================
# 3. DART MİSYONU DEFLEKSİYON VERİLERİ
# ============================================================================
print("\n[3/15] DART Mission Deflection Verileri Oluşturuluyor...")
try:
    dart_data = {
        "mission_info": {
            "name": "Double Asteroid Redirection Test (DART)",
            "launch_date": "2021-11-24",
            "impact_date": "2022-09-26T23:14:00Z",
            "target": "Dimorphos (S/2003 (65803) 1)",
            "parent_body": "Didymos (65803)",
            "agency": "NASA/APL"
        },
        "impact_parameters": {
            "spacecraft_mass_kg": 570,
            "impact_velocity_kms": 6.6,
            "impact_velocity_ms": 6600,
            "impact_angle_deg": 73,
            "kinetic_energy_joules": 1.24e10,
            "kinetic_energy_tnt_tons": 2.96
        },
        "target_properties": {
            "dimorphos_diameter_m": 151,
            "dimorphos_mass_kg": 4.3e9,
            "original_orbital_period_hours": 11.92,
            "original_orbital_period_seconds": 42912
        },
        "deflection_results": {
            "orbital_period_change_minutes": -32,
            "orbital_period_change_seconds": -1920,
            "new_orbital_period_hours": 11.37,
            "semi_major_axis_change_m": -37,
            "beta_momentum_enhancement": 3.6,
            "beta_uncertainty": 0.2,
            "total_ejected_mass_kg": 1e7,
            "ejecta_velocity_kms": 0.5
        },
        "scaling_laws": {
            "momentum_transfer_formula": "p_total = p_spacecraft * beta",
            "beta_definition": "Total momentum / Spacecraft momentum",
            "delta_v_formula": "delta_v = p_total / target_mass",
            "typical_beta_rubble_pile": [2.0, 5.0],
            "typical_beta_monolithic": [1.0, 1.5]
        },
        "deflection_efficiency": {
            "delta_v_achieved_mms": 2.7,
            "delta_v_per_kg_spacecraft": 4.7e-6,
            "warning_time_years_for_1m_deflection": 10,
            "mission_success": True
        }
    }
    
    with open(DATA_DIR / "dart_mission_data.json", 'w') as f:
        json.dump(dart_data, f, indent=2)
    print(f"   ✓ DART misyon verileri kaydedildi")
except Exception as e:
    print(f"   ✗ DART verisi hatası: {e}")

# ============================================================================
# 4. NÜKLEER SANTRAL VERİTABANI (Kritik Altyapı)
# ============================================================================
print("\n[4/15] Global Nükleer Santral Veritabanı Oluşturuluyor...")
try:
    # IAEA PRIS veritabanı bazlı (manuel derleme)
    nuclear_plants = {
        'plant_name': [
            'Kashiwazaki-Kariwa', 'Zaporizhzhia', 'Bruce', 'Hanbit', 'Hanul',
            'Gravelines', 'Paluel', 'Cattenom', 'Tricastin', 'Fukushima Daini',
            'Koeberg', 'Barakah', 'Vogtle', 'South Texas', 'Palo Verde',
            'Taishan', 'Yangjiang', 'Hongyanhe', 'Fangchenggang', 'Tianwan'
        ],
        'country': [
            'Japan', 'Ukraine', 'Canada', 'South Korea', 'South Korea',
            'France', 'France', 'France', 'France', 'Japan',
            'South Africa', 'UAE', 'USA', 'USA', 'USA',
            'China', 'China', 'China', 'China', 'China'
        ],
        'latitude': [
            37.43, 47.51, 44.33, 35.42, 37.09,
            51.01, 49.86, 49.41, 44.33, 37.32,
            -33.67, 23.95, 33.14, 28.80, 33.39,
            21.91, 21.71, 39.80, 21.64, 34.69
        ],
        'longitude': [
            138.60, 34.59, -81.60, 126.42, 129.38,
            2.11, 0.63, 6.22, 4.73, 141.02,
            18.43, 52.23, -81.76, -96.05, -112.86,
            112.98, 111.98, 121.48, 108.53, 119.46
        ],
        'capacity_mw': [
            7965, 5700, 6384, 5875, 5881,
            5460, 5320, 5200, 3660, 4400,
            1860, 5380, 4540, 2708, 3942,
            3500, 6000, 4500, 4060, 4600
        ],
        'reactors': [7, 6, 8, 6, 6, 6, 4, 4, 4, 4, 2, 4, 4, 2, 3, 2, 6, 6, 6, 6],
        'status': ['Operational']*20,
        'tsunami_risk': ['High', 'Low', 'Low', 'Medium', 'Medium',
                        'Low', 'Low', 'Low', 'Low', 'High',
                        'Medium', 'Low', 'Low', 'Low', 'Low',
                        'Medium', 'Medium', 'Low', 'Medium', 'Medium'],
        'seismic_risk': ['High', 'Medium', 'Low', 'Medium', 'Medium',
                        'Low', 'Low', 'Low', 'Low', 'High',
                        'Low', 'Low', 'Low', 'Low', 'Medium',
                        'Medium', 'Medium', 'Low', 'Medium', 'Medium']
    }
    
    nuclear_df = pd.DataFrame(nuclear_plants)
    nuclear_df.to_csv(DATA_DIR / "nuclear_power_plants.csv", index=False)
    print(f"   ✓ {len(nuclear_df)} nükleer santral kaydedildi")
except Exception as e:
    print(f"   ✗ Nükleer santral hatası: {e}")

# ============================================================================
# 5. BÜYÜK BARAJLAR VERİTABANI (İkincil Hasar Riski)
# ============================================================================
print("\n[5/15] Major Dams Veritabanı Oluşturuluyor...")
try:
    dams_data = {
        'dam_name': [
            'Three Gorges', 'Itaipu', 'Guri', 'Tucuruí', 'Grand Coulee',
            'Sayano-Shushenskaya', 'Longtan', 'Krasnoyarsk', 'Robert-Bourassa', 'Churchill Falls',
            'Bratsk', 'Kariba', 'Aswan High', 'Akosombo', 'Hoover',
            'Glen Canyon', 'Oroville', 'Atatürk', 'Nurek', 'Rogun'
        ],
        'country': [
            'China', 'Brazil/Paraguay', 'Venezuela', 'Brazil', 'USA',
            'Russia', 'China', 'Russia', 'Canada', 'Canada',
            'Russia', 'Zambia/Zimbabwe', 'Egypt', 'Ghana', 'USA',
            'USA', 'USA', 'Turkey', 'Tajikistan', 'Tajikistan'
        ],
        'latitude': [
            30.82, -25.41, 7.76, -3.83, 47.95,
            52.83, 25.03, 55.93, 53.78, 53.53,
            56.45, -16.52, 23.97, 6.30, 36.02,
            36.94, 39.54, 37.51, 38.37, 38.73
        ],
        'longitude': [
            111.00, -54.59, -63.00, -49.65, -118.98,
            91.37, 107.05, 92.30, -77.45, -64.30,
            101.78, 28.76, 32.88, 0.06, -114.74,
            -111.48, -121.48, 38.32, 69.35, 69.17
        ],
        'height_m': [181, 196, 162, 76, 168, 242, 216, 124, 162, 32, 124, 128, 111, 134, 221, 216, 235, 169, 300, 335],
        'reservoir_km3': [39.3, 29.0, 135.0, 45.5, 11.9, 31.3, 27.3, 73.3, 61.7, 32.6, 169.3, 185.0, 132.0, 150.0, 35.2, 33.3, 4.4, 48.7, 10.5, 13.3],
        'capacity_mw': [22500, 14000, 10235, 8370, 6809, 6400, 6426, 6000, 5616, 5428, 4500, 1830, 2100, 1020, 2080, 1320, 819, 2400, 3000, 3600],
        'downstream_population_millions': [6.0, 0.5, 0.2, 0.3, 0.1, 0.05, 0.5, 0.2, 0.01, 0.01, 0.1, 0.5, 10.0, 0.1, 0.3, 0.1, 0.2, 2.0, 0.5, 0.5],
        'failure_flood_risk': ['Extreme', 'High', 'Medium', 'High', 'High', 'High', 'High', 'Medium', 'Low', 'Low', 'Medium', 'Extreme', 'Extreme', 'Medium', 'High', 'High', 'High', 'Extreme', 'High', 'Extreme']
    }
    
    dams_df = pd.DataFrame(dams_data)
    dams_df.to_csv(DATA_DIR / "major_dams.csv", index=False)
    print(f"   ✓ {len(dams_df)} büyük baraj kaydedildi")
except Exception as e:
    print(f"   ✗ Baraj hatası: {e}")

# ============================================================================
# 6. HAVALİMANLARI VERİTABANI (Tahliye Planlaması)
# ============================================================================
print("\n[6/15] Major Airports Veritabanı Oluşturuluyor...")
try:
    airports_data = {
        'iata_code': ['ATL', 'PEK', 'DXB', 'LAX', 'HND', 'ORD', 'LHR', 'PVG', 'CDG', 'DFW',
                      'CAN', 'AMS', 'FRA', 'IST', 'DEL', 'JFK', 'SIN', 'ICN', 'DEN', 'BKK'],
        'airport_name': [
            'Hartsfield-Jackson Atlanta', 'Beijing Capital', 'Dubai International', 
            'Los Angeles International', 'Tokyo Haneda', 'Chicago O\'Hare', 
            'London Heathrow', 'Shanghai Pudong', 'Paris Charles de Gaulle', 
            'Dallas/Fort Worth', 'Guangzhou Baiyun', 'Amsterdam Schiphol',
            'Frankfurt Airport', 'Istanbul Airport', 'Indira Gandhi International',
            'John F. Kennedy', 'Singapore Changi', 'Incheon International',
            'Denver International', 'Suvarnabhumi Bangkok'
        ],
        'city': ['Atlanta', 'Beijing', 'Dubai', 'Los Angeles', 'Tokyo', 'Chicago', 
                'London', 'Shanghai', 'Paris', 'Dallas', 'Guangzhou', 'Amsterdam',
                'Frankfurt', 'Istanbul', 'Delhi', 'New York', 'Singapore', 'Seoul', 'Denver', 'Bangkok'],
        'country': ['USA', 'China', 'UAE', 'USA', 'Japan', 'USA', 'UK', 'China', 'France', 'USA',
                   'China', 'Netherlands', 'Germany', 'Turkey', 'India', 'USA', 'Singapore', 
                   'South Korea', 'USA', 'Thailand'],
        'latitude': [33.64, 40.08, 25.25, 33.94, 35.55, 41.97, 51.47, 31.14, 49.01, 32.90,
                    23.39, 52.31, 50.03, 41.26, 28.56, 40.64, 1.36, 37.46, 39.86, 13.69],
        'longitude': [-84.43, 116.58, 55.36, -118.41, 139.78, -87.90, -0.46, 121.81, 2.55, -97.04,
                     113.30, 4.77, 8.57, 28.74, 77.10, -73.78, 103.99, 126.44, -104.67, 100.75],
        'annual_passengers_millions': [110, 100, 89, 88, 87, 84, 80, 76, 76, 75, 
                                       73, 72, 70, 64, 63, 62, 62, 62, 58, 57],
        'runways': [5, 3, 2, 4, 4, 8, 2, 5, 4, 7, 3, 6, 4, 5, 3, 4, 2, 4, 6, 2],
        'evacuation_capacity_per_day': [150000, 130000, 100000, 120000, 100000, 120000, 
                                        100000, 100000, 100000, 100000, 90000, 90000,
                                        90000, 90000, 80000, 80000, 80000, 80000, 75000, 70000]
    }
    
    airports_df = pd.DataFrame(airports_data)
    airports_df.to_csv(DATA_DIR / "major_airports.csv", index=False)
    print(f"   ✓ {len(airports_df)} büyük havalimanı kaydedildi")
except Exception as e:
    print(f"   ✗ Havalimanı hatası: {e}")

# ============================================================================
# 7. BÜYÜK ŞEHİRLER VERİTABANI (Etki Analizi)
# ============================================================================
print("\n[7/15] Major Cities Veritabanı Oluşturuluyor...")
try:
    cities_data = {
        'city': ['Tokyo', 'Delhi', 'Shanghai', 'São Paulo', 'Mexico City', 
                'Cairo', 'Mumbai', 'Beijing', 'Dhaka', 'Osaka',
                'New York', 'Karachi', 'Buenos Aires', 'Chongqing', 'Istanbul',
                'Kolkata', 'Lagos', 'Manila', 'Rio de Janeiro', 'Guangzhou',
                'Los Angeles', 'Moscow', 'Paris', 'Bangkok', 'London'],
        'country': ['Japan', 'India', 'China', 'Brazil', 'Mexico',
                   'Egypt', 'India', 'China', 'Bangladesh', 'Japan',
                   'USA', 'Pakistan', 'Argentina', 'China', 'Turkey',
                   'India', 'Nigeria', 'Philippines', 'Brazil', 'China',
                   'USA', 'Russia', 'France', 'Thailand', 'UK'],
        'latitude': [35.68, 28.61, 31.23, -23.55, 19.43,
                    30.04, 19.08, 39.90, 23.81, 34.69,
                    40.71, 24.86, -34.60, 29.43, 41.01,
                    22.57, 6.52, 14.60, -22.91, 23.13,
                    34.05, 55.76, 48.86, 13.76, 51.51],
        'longitude': [139.69, 77.21, 121.47, -46.63, -99.13,
                     31.24, 72.88, 116.41, 90.41, 135.50,
                     -74.01, 67.01, -58.38, 106.91, 28.98,
                     88.36, 3.38, 120.98, -43.17, 113.26,
                     -118.24, 37.62, 2.35, 100.50, -0.13],
        'metro_population_millions': [37.4, 31.2, 27.8, 22.4, 21.9,
                                      21.3, 20.7, 20.5, 22.5, 19.1,
                                      18.8, 16.5, 15.4, 16.9, 15.6,
                                      15.1, 15.4, 14.4, 13.6, 13.5,
                                      12.5, 12.5, 11.1, 10.7, 9.5],
        'gdp_billions_usd': [1900, 370, 650, 430, 390,
                            130, 310, 580, 110, 680,
                            1500, 120, 320, 350, 240,
                            150, 140, 180, 250, 380,
                            1000, 420, 850, 220, 1000],
        'coastal': [True, False, True, False, False,
                   False, True, False, True, True,
                   True, True, True, False, True,
                   False, True, True, True, True,
                   True, False, False, False, False]
    }
    
    cities_df = pd.DataFrame(cities_data)
    cities_df.to_csv(DATA_DIR / "major_cities.csv", index=False)
    print(f"   ✓ {len(cities_df)} büyük şehir kaydedildi")
except Exception as e:
    print(f"   ✗ Şehir hatası: {e}")

# ============================================================================
# 8. İKLİM ETKİSİ PARAMETRELERİ (Impact Winter)
# ============================================================================
print("\n[8/15] Impact Winter Parametreleri Oluşturuluyor...")
try:
    climate_impact = {
        "dust_injection_models": {
            "small_impact_10mt": {
                "dust_mass_kg": 1e9,
                "stratosphere_residence_months": 3,
                "surface_cooling_kelvin": 0.1,
                "regional_effect": True
            },
            "medium_impact_1000mt": {
                "dust_mass_kg": 1e12,
                "stratosphere_residence_months": 12,
                "surface_cooling_kelvin": 2,
                "hemisphere_effect": True
            },
            "large_impact_1e6mt": {
                "dust_mass_kg": 1e15,
                "stratosphere_residence_months": 36,
                "surface_cooling_kelvin": 10,
                "global_effect": True,
                "crop_failure_probability": 0.9
            },
            "chicxulub_class_1e8mt": {
                "dust_mass_kg": 1e18,
                "stratosphere_residence_months": 120,
                "surface_cooling_kelvin": 26,
                "global_effect": True,
                "mass_extinction": True,
                "photosynthesis_shutdown_months": 24
            }
        },
        "volcanic_analogues": {
            "tambora_1815": {
                "vei": 7,
                "sulfur_dioxide_mt": 100,
                "global_cooling_kelvin": 0.5,
                "year_without_summer": True
            },
            "pinatubo_1991": {
                "vei": 6,
                "sulfur_dioxide_mt": 20,
                "global_cooling_kelvin": 0.3,
                "duration_years": 2
            },
            "laki_1783": {
                "vei": 4,
                "sulfur_dioxide_mt": 120,
                "regional_deaths": 23000,
                "crop_failure_europe": True
            }
        },
        "impact_winter_thresholds": {
            "regional_climate_change_joules": 1e18,
            "continental_climate_change_joules": 1e20,
            "global_climate_change_joules": 1e22,
            "mass_extinction_joules": 1e24
        },
        "recovery_timescales": {
            "dust_settling_months": [6, 24, 60],
            "ocean_temperature_recovery_years": [5, 20, 100],
            "ecosystem_recovery_years": [10, 100, 1000],
            "atmospheric_chemistry_years": [2, 10, 50]
        }
    }
    
    with open(DATA_DIR / "impact_winter_parameters.json", 'w') as f:
        json.dump(climate_impact, f, indent=2)
    print(f"   ✓ İklim etki parametreleri kaydedildi")
except Exception as e:
    print(f"   ✗ İklim etki hatası: {e}")

# ============================================================================
# 9. DEFLEKSİYON TEKNOLOJİLERİ VERİTABANI
# ============================================================================
print("\n[9/15] Deflection Technologies Veritabanı Oluşturuluyor...")
try:
    deflection_tech = {
        "kinetic_impactor": {
            "name": "Kinetic Impactor",
            "description": "High-speed spacecraft collision",
            "technology_readiness_level": 9,
            "demonstrated": True,
            "example_mission": "DART",
            "typical_delta_v_mms": [0.1, 10],
            "warning_time_required_years": [1, 20],
            "effectiveness_vs_size": {
                "10m": "Very High",
                "100m": "High",
                "500m": "Medium",
                "1km": "Low",
                "10km": "Negligible"
            },
            "cost_estimate_billion_usd": [0.3, 1.0]
        },
        "gravity_tractor": {
            "name": "Gravity Tractor",
            "description": "Spacecraft hovers near asteroid, uses gravity to slowly pull",
            "technology_readiness_level": 5,
            "demonstrated": False,
            "typical_delta_v_mms": [0.001, 0.1],
            "warning_time_required_years": [10, 50],
            "effectiveness_vs_size": {
                "10m": "Overkill",
                "100m": "High",
                "500m": "Medium",
                "1km": "Low",
                "10km": "Very Low"
            },
            "advantages": ["Precise control", "Works on rubble piles", "No contact needed"]
        },
        "ion_beam_deflection": {
            "name": "Ion Beam Deflection",
            "description": "Spacecraft fires ion thruster at asteroid surface",
            "technology_readiness_level": 4,
            "demonstrated": False,
            "typical_delta_v_mms": [0.01, 1],
            "warning_time_required_years": [5, 30],
            "advantages": ["Continuous thrust", "No contact needed", "Adjustable"]
        },
        "nuclear_standoff": {
            "name": "Nuclear Standoff Explosion",
            "description": "Detonation near asteroid surface to vaporize and deflect",
            "technology_readiness_level": 6,
            "demonstrated": False,
            "typical_delta_v_mms": [1, 1000],
            "warning_time_required_years": [0.5, 5],
            "effectiveness_vs_size": {
                "10m": "Overkill",
                "100m": "Very High",
                "500m": "High",
                "1km": "High",
                "10km": "Medium"
            },
            "considerations": ["Last resort", "Space treaty concerns", "Fragmentation risk"]
        },
        "solar_sail": {
            "name": "Enhanced Solar Radiation Pressure",
            "description": "Attach reflective surface to increase solar pressure",
            "technology_readiness_level": 3,
            "demonstrated": False,
            "typical_delta_v_mms": [0.0001, 0.01],
            "warning_time_required_years": [20, 100]
        },
        "mass_driver": {
            "name": "Mass Driver",
            "description": "Land on asteroid and eject material as propulsion",
            "technology_readiness_level": 3,
            "demonstrated": False,
            "typical_delta_v_mms": [0.1, 100],
            "warning_time_required_years": [5, 20]
        }
    }
    
    with open(DATA_DIR / "deflection_technologies.json", 'w') as f:
        json.dump(deflection_tech, f, indent=2)
    print(f"   ✓ 6 defleksiyon teknolojisi kaydedildi")
except Exception as e:
    print(f"   ✗ Defleksiyon teknolojisi hatası: {e}")

# ============================================================================
# 10. TAHLİYE PLANLAMA PARAMETRELERİ
# ============================================================================
print("\n[10/15] Evacuation Planning Parametreleri Oluşturuluyor...")
try:
    evacuation_params = {
        "warning_time_response": {
            "hours_1-24": {
                "evacuation_radius_km": 50,
                "evacuation_rate_percent": 30,
                "shelter_in_place_recommended": True,
                "transportation_modes": ["Private vehicles", "Emergency buses"]
            },
            "days_1-7": {
                "evacuation_radius_km": 200,
                "evacuation_rate_percent": 70,
                "mass_transit_activated": True,
                "transportation_modes": ["All ground transport", "Rail", "Short-haul flights"]
            },
            "weeks_1-4": {
                "evacuation_radius_km": 500,
                "evacuation_rate_percent": 90,
                "international_coordination": True,
                "transportation_modes": ["All available", "International flights", "Ships"]
            },
            "months_1-12": {
                "evacuation_radius_km": 2000,
                "evacuation_rate_percent": 99,
                "permanent_relocation_possible": True,
                "infrastructure_preparation": True
            }
        },
        "impact_size_protocols": {
            "airburst_10m": {
                "affected_radius_km": 20,
                "evacuation_type": "Shelter in place",
                "expected_casualties_without_warning": 1000
            },
            "small_crater_50m": {
                "affected_radius_km": 50,
                "evacuation_type": "Local evacuation",
                "expected_casualties_without_warning": 50000
            },
            "medium_impact_200m": {
                "affected_radius_km": 200,
                "evacuation_type": "Regional evacuation",
                "expected_casualties_without_warning": 500000
            },
            "large_impact_1km": {
                "affected_radius_km": 1000,
                "evacuation_type": "Continental evacuation",
                "expected_casualties_without_warning": 50000000,
                "global_effects": True
            }
        },
        "evacuation_capacity_per_hour": {
            "major_highway_lane": 2000,
            "metro_line": 30000,
            "train_line": 10000,
            "large_airport": 5000,
            "ferry_terminal": 3000
        },
        "shelter_requirements": {
            "space_per_person_m2": 4.5,
            "water_per_person_liters_per_day": 3,
            "food_per_person_kcal_per_day": 2000,
            "medical_staff_ratio": 0.01
        }
    }
    
    with open(DATA_DIR / "evacuation_parameters.json", 'w') as f:
        json.dump(evacuation_params, f, indent=2)
    print(f"   ✓ Tahliye parametreleri kaydedildi")
except Exception as e:
    print(f"   ✗ Tahliye parametreleri hatası: {e}")

# ============================================================================
# 11. YÖRÜNGE MEKANİĞİ PARAMETRELERİ
# ============================================================================
print("\n[11/15] Orbital Mechanics Parametreleri Oluşturuluyor...")
try:
    orbital_params = {
        "earth_parameters": {
            "mass_kg": 5.972e24,
            "radius_km": 6371,
            "escape_velocity_kms": 11.186,
            "orbital_velocity_kms": 29.78,
            "hill_sphere_radius_km": 1.5e6,
            "gravitational_parameter_km3s2": 398600.4418
        },
        "impact_velocities": {
            "minimum_kms": 11.2,
            "average_asteroid_kms": 17.0,
            "average_comet_kms": 51.0,
            "maximum_kms": 72.8,
            "retrograde_bonus_kms": 29.78
        },
        "delta_v_requirements": {
            "low_earth_orbit_kms": 9.4,
            "geostationary_orbit_kms": 14.4,
            "earth_escape_kms": 11.2,
            "asteroid_rendezvous_typical_kms": [3, 8],
            "asteroid_impact_trajectory_kms": [1, 5]
        },
        "warning_time_to_deflection": {
            "1_year_warning": {
                "required_delta_v_target_mms": 20,
                "miss_distance_achievable_km": 1000
            },
            "5_year_warning": {
                "required_delta_v_target_mms": 4,
                "miss_distance_achievable_km": 10000
            },
            "10_year_warning": {
                "required_delta_v_target_mms": 2,
                "miss_distance_achievable_km": 20000
            },
            "20_year_warning": {
                "required_delta_v_target_mms": 1,
                "miss_distance_achievable_km": 50000
            }
        },
        "keyhole_passages": {
            "description": "Small regions where asteroid must pass to impact on later orbit",
            "typical_size_km": [0.5, 5],
            "importance": "Targeting keyhole with deflection prevents future impact"
        }
    }
    
    with open(DATA_DIR / "orbital_mechanics.json", 'w') as f:
        json.dump(orbital_params, f, indent=2)
    print(f"   ✓ Yörünge mekaniği parametreleri kaydedildi")
except Exception as e:
    print(f"   ✗ Yörünge mekaniği hatası: {e}")

# ============================================================================
# 12. ASÖNOMİK GÖZLEM KAYNAKLARI
# ============================================================================
print("\n[12/15] Astronomical Survey Sources Oluşturuluyor...")
try:
    survey_sources = {
        "ground_based_surveys": {
            "catalina_sky_survey": {
                "location": "Arizona, USA",
                "telescope_aperture_m": 1.5,
                "limiting_magnitude": 21.5,
                "neos_discovered": 47000,
                "status": "Operational"
            },
            "pan_starrs": {
                "location": "Hawaii, USA",
                "telescope_aperture_m": 1.8,
                "limiting_magnitude": 22.0,
                "neos_discovered": 8000,
                "status": "Operational"
            },
            "atlas": {
                "location": "Hawaii, Chile, South Africa",
                "telescope_aperture_m": 0.5,
                "limiting_magnitude": 19.5,
                "coverage": "Full sky every 2 nights",
                "detection_range_m_asteroid": {"20m": "Days", "100m": "Weeks"},
                "status": "Operational"
            },
            "zwicky_transient_facility": {
                "location": "California, USA",
                "telescope_aperture_m": 1.2,
                "limiting_magnitude": 20.5,
                "status": "Operational"
            }
        },
        "space_based_surveys": {
            "neowise": {
                "wavelength": "Infrared",
                "neos_discovered": 377,
                "neos_characterized": 215000,
                "status": "Decommissioned 2024"
            },
            "neo_surveyor": {
                "launch_year": 2028,
                "wavelength": "Infrared",
                "expected_detections": "65% of 140m+ PHAs in 5 years",
                "status": "In development"
            },
            "vera_rubin_observatory": {
                "location": "Chile",
                "first_light_year": 2025,
                "expected_neo_detections_per_year": 10000,
                "status": "Under construction"
            }
        },
        "radar_facilities": {
            "goldstone": {
                "location": "California, USA",
                "antenna_diameter_m": 70,
                "range_au": 0.1,
                "resolution_m": 4,
                "capabilities": ["Shape modeling", "Rotation", "Moon detection"]
            },
            "arecibo": {
                "location": "Puerto Rico",
                "status": "Collapsed 2020",
                "historical_importance": "Highest resolution asteroid radar"
            },
            "green_bank": {
                "location": "West Virginia, USA",
                "antenna_diameter_m": 100,
                "status": "Operational (receive only)"
            }
        }
    }
    
    with open(DATA_DIR / "astronomical_surveys.json", 'w') as f:
        json.dump(survey_sources, f, indent=2)
    print(f"   ✓ Astronomik gözlem kaynakları kaydedildi")
except Exception as e:
    print(f"   ✗ Astronomik kaynaklar hatası: {e}")

# ============================================================================
# 13. RİSK DEĞERLENDİRME ÖLÇEKLERİ
# ============================================================================
print("\n[13/15] Risk Assessment Scales Oluşturuluyor...")
try:
    risk_scales = {
        "torino_scale": {
            "description": "Public communication scale for NEO impact hazard",
            "range": [0, 10],
            "levels": {
                "0": {"color": "White", "description": "No hazard", "action": "None"},
                "1": {"color": "Green", "description": "Normal", "action": "Continued monitoring"},
                "2": {"color": "Yellow", "description": "Meriting attention", "action": "Close monitoring"},
                "3": {"color": "Yellow", "description": "Close encounter", "action": "National attention"},
                "4": {"color": "Yellow", "description": ">1% chance of regional destruction", "action": "Concern"},
                "5": {"color": "Orange", "description": "Close encounter, serious threat", "action": "Contingency planning"},
                "6": {"color": "Orange", "description": "Close encounter, severe threat", "action": "Government attention"},
                "7": {"color": "Orange", "description": "Close encounter, extremely high threat", "action": "International planning"},
                "8": {"color": "Red", "description": "Certain regional collision", "action": "Regional evacuation"},
                "9": {"color": "Red", "description": "Certain global collision", "action": "Maximum response"},
                "10": {"color": "Red", "description": "Certain mass extinction", "action": "Civilization survival"}
            }
        },
        "palermo_scale": {
            "description": "Technical scale comparing to background hazard",
            "formula": "PS = log10(Pi / (fB × ΔT))",
            "interpretation": {
                "< -2": "No concern",
                "-2 to 0": "Careful monitoring",
                "0": "Equal to background hazard",
                "0 to +2": "Merits attention",
                "> +2": "Serious concern"
            },
            "reference_probability": "Background hazard of same-size impact"
        },
        "impact_energy_scale": {
            "asteroid_10m": {"energy_mt": 0.01, "frequency_years": 1, "effect": "Airburst, minor damage"},
            "asteroid_25m": {"energy_mt": 1, "frequency_years": 100, "effect": "City-level destruction"},
            "asteroid_50m": {"energy_mt": 10, "frequency_years": 1000, "effect": "Regional destruction"},
            "asteroid_140m": {"energy_mt": 100, "frequency_years": 10000, "effect": "Country-level disaster"},
            "asteroid_300m": {"energy_mt": 1000, "frequency_years": 70000, "effect": "Continental effects"},
            "asteroid_1km": {"energy_mt": 100000, "frequency_years": 500000, "effect": "Global catastrophe"},
            "asteroid_10km": {"energy_mt": 100000000, "frequency_years": 100000000, "effect": "Mass extinction"}
        }
    }
    
    with open(DATA_DIR / "risk_scales.json", 'w') as f:
        json.dump(risk_scales, f, indent=2)
    print(f"   ✓ Risk değerlendirme ölçekleri kaydedildi")
except Exception as e:
    print(f"   ✗ Risk ölçekleri hatası: {e}")

# ============================================================================
# 14. TARİHSEL OLAYLAR VERİTABANI (Genişletilmiş)
# ============================================================================
print("\n[14/15] Historical Events Database Genişletiliyor...")
try:
    historical_events = {
        "observed_impacts": [
            {
                "name": "Chelyabinsk",
                "date": "2013-02-15",
                "location": "Russia",
                "latitude": 54.82,
                "longitude": 61.12,
                "diameter_m": 20,
                "velocity_kms": 19.16,
                "entry_angle_deg": 18.3,
                "airburst_altitude_km": 29.7,
                "energy_kt": 500,
                "injuries": 1500,
                "buildings_damaged": 7200,
                "economic_damage_usd": 33000000,
                "warning_time": "None"
            },
            {
                "name": "Tunguska",
                "date": "1908-06-30",
                "location": "Siberia, Russia",
                "latitude": 60.89,
                "longitude": 101.89,
                "diameter_m": 60,
                "velocity_kms": 15,
                "airburst_altitude_km": 8,
                "energy_mt": 12,
                "trees_flattened": 80000000,
                "area_devastated_km2": 2150,
                "casualties": 0
            },
            {
                "name": "Sikhote-Alin",
                "date": "1947-02-12",
                "location": "Russia",
                "latitude": 46.16,
                "longitude": 134.65,
                "type": "Iron meteorite fall",
                "total_mass_kg": 23000,
                "craters_formed": 120,
                "largest_crater_m": 26
            },
            {
                "name": "2008 TC3 (Almahata Sitta)",
                "date": "2008-10-07",
                "location": "Sudan",
                "latitude": 20.77,
                "longitude": 32.56,
                "diameter_m": 4,
                "warning_time_hours": 19,
                "significance": "First asteroid tracked before impact",
                "meteorites_recovered": 600
            },
            {
                "name": "2014 AA",
                "date": "2014-01-02",
                "location": "Atlantic Ocean",
                "diameter_m": 3,
                "warning_time_hours": 21,
                "energy_kt": 1
            },
            {
                "name": "2018 LA",
                "date": "2018-06-02",
                "location": "Botswana",
                "diameter_m": 2,
                "warning_time_hours": 8,
                "meteorites_recovered": "Yes"
            },
            {
                "name": "2019 MO",
                "date": "2019-06-22",
                "location": "Caribbean Sea",
                "diameter_m": 5,
                "warning_time_hours": 0,
                "energy_kt": 6
            },
            {
                "name": "2022 EB5",
                "date": "2022-03-11",
                "location": "Norwegian Sea",
                "diameter_m": 2,
                "warning_time_hours": 2
            },
            {
                "name": "2023 CX1",
                "date": "2023-02-13",
                "location": "English Channel",
                "diameter_m": 1,
                "warning_time_hours": 7
            },
            {
                "name": "2024 BX1",
                "date": "2024-01-21",
                "location": "Germany",
                "diameter_m": 1,
                "warning_time_hours": 3,
                "meteorites_recovered": "Yes"
            }
        ],
        "near_misses": [
            {
                "name": "2019 OK",
                "date": "2019-07-25",
                "diameter_m": 100,
                "miss_distance_km": 72000,
                "warning_time": "Hours",
                "discovery": "Day of closest approach"
            },
            {
                "name": "Apophis (2029)",
                "date": "2029-04-13",
                "diameter_m": 370,
                "miss_distance_km": 31000,
                "significance": "Will pass within geosynchronous orbit",
                "visible_naked_eye": True
            },
            {
                "name": "2020 QG",
                "date": "2020-08-16",
                "diameter_m": 6,
                "miss_distance_km": 2950,
                "discovery": "After closest approach"
            }
        ]
    }
    
    with open(DATA_DIR / "historical_events.json", 'w') as f:
        json.dump(historical_events, f, indent=2)
    print(f"   ✓ {len(historical_events['observed_impacts'])} gözlenen etki + {len(historical_events['near_misses'])} yakın geçiş kaydedildi")
except Exception as e:
    print(f"   ✗ Tarihsel olaylar hatası: {e}")

# ============================================================================
# 15. ULUSLARARASI KOORDINASYON BİLGİLERİ
# ============================================================================
print("\n[15/15] International Coordination Data Oluşturuluyor...")
try:
    international_data = {
        "planetary_defense_organizations": {
            "nasa_pdco": {
                "name": "NASA Planetary Defense Coordination Office",
                "established": 2016,
                "budget_usd_millions": 150,
                "responsibilities": ["NEO detection", "Impact warning", "Deflection coordination"],
                "location": "Washington, DC, USA"
            },
            "esa_sst_neo": {
                "name": "ESA Space Safety - Near-Earth Objects",
                "location": "Frascati, Italy",
                "responsibilities": ["European NEO coordination", "Hera mission", "Risk assessment"]
            },
            "iawn": {
                "name": "International Asteroid Warning Network",
                "established": 2013,
                "members": 17,
                "purpose": "International coordination for NEO observations and impact warnings"
            },
            "smpag": {
                "name": "Space Mission Planning Advisory Group",
                "established": 2014,
                "purpose": "Coordinate international deflection mission planning"
            },
            "un_copuos": {
                "name": "UN Committee on Peaceful Uses of Outer Space",
                "purpose": "International governance of planetary defense"
            }
        },
        "notification_protocols": {
            "detection_to_warning_hours": 1,
            "national_agency_notification": "Immediate",
            "un_notification_threshold_torino": 4,
            "public_communication_threshold_torino": 1
        },
        "international_missions": {
            "dart": {"status": "Complete", "agency": "NASA", "year": 2022},
            "hera": {"status": "En route", "agency": "ESA", "arrival": 2026},
            "neo_surveyor": {"status": "In development", "agency": "NASA", "launch": 2028},
            "neomir": {"status": "Proposed", "agency": "ESA", "purpose": "Sun-side detection"}
        }
    }
    
    with open(DATA_DIR / "international_coordination.json", 'w') as f:
        json.dump(international_data, f, indent=2)
    print(f"   ✓ Uluslararası koordinasyon verileri kaydedildi")
except Exception as e:
    print(f"   ✗ Uluslararası veriler hatası: {e}")

# ============================================================================
# ÖZET
# ============================================================================
print("\n" + "=" * 70)
print("🛡️ TÜM VERİ SETLERİ BAŞARIYLA OLUŞTURULDU!")
print("=" * 70)

# Dosya listesi ve boyutlar
total_size = 0
file_count = 0
print("\nOluşturulan dosyalar:")
for file in sorted(DATA_DIR.iterdir()):
    size_kb = file.stat().st_size / 1024
    total_size += size_kb
    file_count += 1
    print(f"   • {file.name} ({size_kb:.1f} KB)")

print(f"\nToplam: {file_count} dosya, {total_size:.1f} KB")
print("\n✅ Kusursuz Gezegen Savunma Sistemi için tüm veriler hazır!")
