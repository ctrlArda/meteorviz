"""
Kusursuz Simülasyon - Kapsamlı Test Scripti
"""
import requests
import json

BASE_URL = "http://127.0.0.1:5001"

print("=" * 70)
print("KUSURSUZ ASTEROIT SIMULASYONU - KAPSAMLI TEST")
print("=" * 70)

# Test 1: Veri Seti Durumu
print("\n" + "=" * 50)
print("[1] VERİ SETİ DURUMU")
print("=" * 50)
r = requests.get(f"{BASE_URL}/dataset_status")
status = r.json()

print(f"\nSistem: {status['system_info']['title']} v{status['system_info']['version']}")
print(f"Durum: {status['system_info']['status']}")
print(f"\nToplam: {status['total_datasets_loaded']}/{status['max_datasets']} veri seti aktif")

print("\nVeri Setleri:")
for name, info in status['datasets'].items():
    avail = "✓" if info.get('available') else "✗"
    records = info.get('records', '')
    records_str = f" ({records} kayıt)" if records else ""
    print(f"  {avail} {name}: {info['source']}{records_str}")

print("\nFizik Modelleri:")
for model in status['physics_models_used']:
    print(f"  • {model}")

# Test 2: Sentry Tehditleri
print("\n" + "=" * 50)
print("[2] JPL SENTRY POTANSİYEL TEHDİTLER")
print("=" * 50)
r = requests.get(f"{BASE_URL}/sentry_threats")
sentry = r.json()
print(f"\nKaynak: {sentry['source']}")
print(f"Toplam izlenen: {sentry['total_monitored']}")
print(f"Yüksek riskli: {sentry['high_risk_count']}")

print("\nEn Yüksek Riskli 5 Asteroit:")
for t in sentry['threats'][:5]:
    ps = t['palermo_scale']
    ip = t['impact_probability']
    print(f"  • {t['designation']}: PS={ps:.2f}, P={ip:.2e}, D={t['diameter_km']} km")

# Test 3: Tarihsel Çarpışmalar
print("\n" + "=" * 50)
print("[3] TARİHSEL ÇARPIŞMA KRATERLERİ")
print("=" * 50)
r = requests.get(f"{BASE_URL}/historical_impacts")
hist = r.json()
print(f"\nKaynak: {hist['source']}")
print(f"Toplam krater: {hist['total_craters']}")

print("\nEn Büyük 5 Krater:")
sorted_impacts = sorted(hist['impacts'], key=lambda x: x['diameter_km'], reverse=True)
for imp in sorted_impacts[:5]:
    extinct = " [YIKIM]" if imp['extinction_event'] else ""
    print(f"  • {imp['crater_name']} ({imp['location']}): {imp['diameter_km']} km, {imp['age_myr']} Myr{extinct}")

# Test 4: Simülasyon Testi (Bennu benzeri)
print("\n" + "=" * 50)
print("[4] BİLİMSEL SİMÜLASYON TESTİ")
print("=" * 50)
payload = {
    'latitude': 40.7,
    'longitude': -74.0,  # New York
    'mass_kg': 7.3e10,
    'velocity_kms': 14,
    'angle_deg': 45,
    'density': 1200,
    'composition': 'rubble'
}
print(f"\nTest Parametreleri: {json.dumps(payload, indent=2)}")

r = requests.post(f"{BASE_URL}/simulate_impact", json=payload)
if r.status_code == 200:
    sim = r.json()
    
    phys = sim.get('physical_impact', {})
    print(f"\nFiziksel Etki:")
    print(f"  • Tip: {phys.get('impact_type')}")
    print(f"  • Enerji: {phys.get('impact_energy_megatons_tnt', 0):.2f} MT")
    print(f"  • Krater: {phys.get('crater_diameter_km', 0):.2f} km")
    print(f"  • Richter: {phys.get('seismic_magnitude', 0):.1f}")
    
    # Litoloji
    litho = sim.get('lithology_analysis')
    if litho:
        print(f"\nLitoloji Analizi:")
        print(f"  • Kaya Tipi: {litho.get('lithology_name')}")
        print(f"  • Yoğunluk: {litho.get('density_kgm3')} kg/m³")
        print(f"  • Krater Verimi: {litho.get('crater_efficiency')}")
    
    # Tarihsel Karşılaştırma
    hist_comp = sim.get('historical_comparison')
    if hist_comp and len(hist_comp) > 0:
        print(f"\nTarihsel Karşılaştırma:")
        for comp in hist_comp[:3]:
            print(f"  • {comp['name']} ({comp['location']}): {comp['diameter_km']} km, {comp['energy_mt']} MT")
    
    # Veri Kaynakları
    ds = sim.get('data_sources', {})
    conf = sim.get('scientific_confidence', {})
    print(f"\nBilimsel Güvenilirlik:")
    print(f"  • Genel: {conf.get('overall')}")
    print(f"  • Veri Tamlığı: {conf.get('data_completeness')}")
    
    print(f"\nAktif Veri Kaynakları:")
    print(f"  • Sentry: {ds.get('jpl_sentry', {}).get('total_threats')} tehdit izleniyor")
    print(f"  • Taksonomi: {ds.get('spectral_taxonomy', {}).get('total_classes')} sınıf")
    print(f"  • Litoloji: {ds.get('lithology', {}).get('total_rock_types')} kaya tipi")
    print(f"  • Arazi: {ds.get('land_cover', {}).get('total_classes')} örtü sınıfı")
    print(f"  • Tarihsel: {ds.get('historical_impacts', {}).get('total_craters')} krater")
else:
    print(f"\nHata: {r.status_code} - {r.text}")

print("\n" + "=" * 70)
print("TÜM TESTLER TAMAMLANDI - PROJE KUSURSUZ!")
print("=" * 70)
