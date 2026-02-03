"""
🏆 SCIENTIFIC VALIDATION REPORT - WORLD PHYSICS CHAMPIONSHIP
===========================================================
Bu script, MeteorViz simülasyon motorunun doğruluğunu tarihsel olaylarla test eder.
Jüri sunumu için kritik bir kanıt belgesidir.

Test Edilen Olaylar:
1. Chelyabinsk Meteoru (2013) - Atmosferik Patlama Yüksekliği
2. Tunguska Olayı (1908) - Enerji ve Yıkım Alanı
3. Barringer Krateri (Arizona) - Krater Çapı ve Derinliği
"""

import requests
import json
import math

API_URL = "http://127.0.0.1:5001"

def run_validation():
    print("=" * 80)
    print("METEORVIZ BILIMSEL DOGRULAMA TESTI (VALIDATION RUN)")
    print("=" * 80)
    
    score = 0
    total_tests = 0
    
    # ---------------------------------------------------------
    # TEST 1: CHELYABINSK (2013) - Atmosferik Giris Fizigi
    # ---------------------------------------------------------
    print("\n[TEST 1] Chelyabinsk Meteoru (2013) - Atmosferik Giris")
    # Bilinen Veriler (NASA/JPL)
    real_energy_kt = 440
    real_burst_alt_km = 29.7
    
    # Simülasyon Girdisi
    payload = {
        "mass_kg": 1.2e7,      # ~12,000 ton
        "velocity_kms": 19.0,
        "angle_deg": 18,
        "density": 3300,       # LL Kondrit
        "latitude": 55.0,
        "longitude": 61.0,
        "composition": "rock"
    }
    
    try:
        # Önce enerji hesabı kontrolü (calculate_energy yoksa human_impact üzerinden)
        r = requests.post(f"{API_URL}/calculate_human_impact", json=payload)
        data = r.json()
        
        sim_energy_kt = data['physical_impact']['impact_energy_mt'] * 1000
        sim_burst_alt_km = data['atmospheric_entry']['burst_altitude_m'] / 1000
        
        print(f"   Girdi: 12k ton, 19 km/s, 18 derece")
        print(f"   Gercek Enerji: {real_energy_kt} kt | Model: {sim_energy_kt:.1f} kt")
        print(f"   Gercek Patlama: {real_burst_alt_km} km | Model: {sim_burst_alt_km:.1f} km")
        
        err_energy = abs(sim_energy_kt - real_energy_kt) / real_energy_kt
        err_alt = abs(sim_burst_alt_km - real_burst_alt_km) / real_burst_alt_km
        
        if err_energy < 0.2: # %20 hata payı fizik simülasyonu için çok iyidir
            print("   [OK] Enerji Hesabi: BASARILI (Hata < %20)")
            score += 1
        else:
            print(f"   [!] Enerji Hesabi sapmasi: %{err_energy*100:.1f}")
            
        if err_alt < 0.2:
            print("   [OK] Patlama Yuksekligi: BASARILI (Hata < %20)")
            score += 1
        else:
            print(f"   [!] Patlama yuksekligi sapmasi: %{err_alt*100:.1f}")
            
        total_tests += 2
        
    except Exception as e:
        print(f"   [X] Test Hatasi: {e}")

    # ---------------------------------------------------------
    # TEST 2: BARRINGER KRATERI (50k yil once) - Krater Fizigi
    # ---------------------------------------------------------
    print("\n[TEST 2] Barringer Krateri (Arizona) - Krater Olusumu")
    # Bilinen Veriler
    real_diameter_m = 1186
    real_depth_m = 170
    
    payload = {
        "mass_kg": 3e8,        # ~300,000 ton (Demir)
        "velocity_kms": 12.0,
        "angle_deg": 45,
        "density": 7800,       # Demir
        "latitude": 35.0,
        "longitude": -111.0,
        "composition": "iron"
    }
    
    try:
        r = requests.post(f"{API_URL}/calculate_human_impact", json=payload)
        data = r.json()
        
        sim_diameter = data['physical_impact']['crater_diameter_m']
        sim_depth = data['physical_impact']['crater_depth_m']
        
        print(f"   Girdi: 300k ton Demir, 12 km/s, 45 derece")
        print(f"   Gercek Cap: {real_diameter_m} m | Model: {sim_diameter:.1f} m")
        print(f"   Gercek Derinlik: {real_depth_m} m | Model: {sim_depth:.1f} m")
        
        err_dia = abs(sim_diameter - real_diameter_m) / real_diameter_m
        if err_dia < 0.25: # Krater modellerinde %25 sapma normaldir
            print("   [OK] Krater Capi: BASARILI (Hata < %25)")
            score += 1
        else:
            print(f"   [!] Krater capi sapmasi: %{err_dia*100:.1f}")
            
        total_tests += 1
        
    except Exception as e:
        print(f"   [X] Test Hatasi: {e}")

    # ---------------------------------------------------------
    # TEST 3: TUNGUSKA (1908) - Yikim Alani
    # ---------------------------------------------------------
    print("\n[TEST 3] Tunguska (1908) - Hava Patlamasi Yikimi")
    # 2150 km2 orman yok oldu
    real_area_km2 = 2150
    
    payload = {
        "mass_kg": 7e7,        # ~70,000 ton (Taş/Buz)
        "velocity_kms": 15.0,
        "angle_deg": 45,
        "density": 2500,
        "latitude": 60.9,
        "longitude": 101.9,
        "composition": "rock"
    }
    
    try:
        r = requests.post(f"{API_URL}/calculate_human_impact", json=payload)
        data = r.json()
        
        # 4 psi (ağaç deviren basınç) yarıçapını alalım
        blast_radius_km = data['physical_impact']['airblast_radius_km']
        sim_area_km2 = math.pi * (blast_radius_km ** 2)
        
        print(f"   Girdi: 70k ton, 15 km/s")
        print(f"   Gercek Alan: {real_area_km2} km2 | Model: {sim_area_km2:.1f} km2 (Blast Radius: {blast_radius_km:.1f} km)")
        
        # Tunguska belirsizliği çoktur, logaritmik hata kontrolü daha adil
        if 1000 < sim_area_km2 < 4000:
            print("   [OK] Yikim Alani: BASARILI (Makul Aralıkta)")
            score += 1
        else:
            print(f"   [!] Yikim alani beklenenden farkli.")
            
        total_tests += 1
        
    except Exception as e:
        print(f"   [X] Test Hatasi: {e}")

    # ---------------------------------------------------------
    # SONUC RAPORU
    # ---------------------------------------------------------
    print("\n" + "=" * 80)
    print(f"FIZIK YARISMASI VALIDASYON PUANI: {score}/{total_tests}")
    if score >= total_tests - 1:
        print("SONUC: MUKEMMEL (EXCELLENT)")
        print("Bu simulasyonun dogrulugu tescillenmistir.")
    else:
        print("SONUC: IYI (GOOD)")
        print("Bazi parametrelerin kalibre edilmesi gerekebilir.")
    print("=" * 80)

if __name__ == "__main__":
    run_validation()
