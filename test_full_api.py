import requests
import json

print("=" * 60)
print("METEORVIZ BILIMSEL VERI TESTI")
print("=" * 60)

# Test 1: Veri seti listesi
print("\n[1] VERI SETI LISTESI")
r = requests.get('http://127.0.0.1:5001/get_dataset_asteroids')
data = r.json()
print(f"   Asteroit sayisi: {len(data)}")
# İlk 3 asteroiti göster
first_3 = data[:3]
for a in first_3:
    print(f"   - {a['name']} (ID: {a['id']})")

# Test 2: Full simulation (Okyanus)
print("\n[2] OKYANUS CARPISMASI SIMULASYONU (Japonya Aciklari)")
payload = {
    'latitude': 35.0, 
    'longitude': 140.0,
    'mass_kg': 7.3e10, 
    'velocity_kms': 14, 
    'angle_deg': 45, 
    'density': 1200, 
    'composition': 'rubble',
    'orbital_data': {
        'eccentricity': '0.2',
        'semi_major_axis': '1.126',
        'inclination': '6.03',
        'orbital_period': '436.6',
        'perihelion_distance': '0.9',
        'aphelion_distance': '1.4'
    }
}

r = requests.post('http://127.0.0.1:5001/calculate_human_impact', json=payload)
d = r.json()

# Fizik sonuclari
phys = d.get('physical_impact', {})
print(f"   Impact Type: {phys.get('impact_type')}")
print(f"   Enerji: {phys.get('impact_energy_megatons_tnt', 0):.2f} MT")
print(f"   Krater: {phys.get('crater_diameter_km', 0)*1000:.0f} m")
print(f"   Tsunami Dalga: {phys.get('tsunami_wave_height_m', 0):.1f} m")

# Tsunami detay
tsunami = phys.get('tsunami_analysis', {})
if tsunami:
    print(f"   Tsunami Kaynak: {tsunami.get('source_wave_height_m', 0):.1f} m")
    print(f"   Green's Law Faktoru: {tsunami.get('greens_law', {}).get('shoaling_factor', 0):.3f}")

# ML
ml = d.get('ml_analysis', {})
print("\n[3] ML ANALIZI")
print(f"   Model aktif: {ml.get('model_available')}")
if ml.get('prediction'):
    pred = ml['prediction']
    print(f"   ML Krater Tahmini: {pred.get('crater_diameter_m', 0):.0f} m")
    print(f"   Model Tipi: {pred.get('model_type')}")
    print(f"   Ozellik Sayisi: {pred.get('features_used')}")
if ml.get('comparison_with_physics'):
    comp = ml['comparison_with_physics']
    print(f"   Fizik vs ML Uyumu: {comp.get('agreement_level')}")
    print(f"   Fark: %{comp.get('difference_percent', 0):.1f}")

# Veri kaynaklari
ds = d.get('data_sources', {})
print("\n[4] KULLANILAN VERI KAYNAKLARI")
print(f"   Nufus: {ds.get('population', {}).get('source')} - Aktif: {ds.get('population', {}).get('available')}")
print(f"   Batimetri: {ds.get('bathymetry', {}).get('source')} - {ds.get('bathymetry', {}).get('tiles_loaded')} tile")
print(f"   Altyapi: {ds.get('infrastructure', {}).get('source')} - {ds.get('infrastructure', {}).get('total_plants')} tesis")
print(f"   Asteroit: {ds.get('asteroid_data', {}).get('primary_source')} - {ds.get('asteroid_data', {}).get('local_dataset_size')} kayit")

# Fizik modelleri
physics_models = ds.get('physics_model', {})
print("\n[5] FIZIK MODELLERI")
for key, val in physics_models.items():
    print(f"   {key}: {val}")

# Guvenilirlik
conf = d.get('scientific_confidence', {})
print("\n[6] BILIMSEL GUVENILIRLIK")
for key, val in conf.items():
    print(f"   {key}: {val}")

# Altyapi etkisi
human = d.get('human_impact_assessment', {})
infra = human.get('infrastructure_impact', [])
print(f"\n[7] KRITIK ALTYAPI ETKISI")
print(f"   Etkilenen tesis sayisi: {len(infra)}")
if infra:
    for plant in infra[:3]:
        print(f"   - {plant['name']} ({plant['primary_fuel']}, {plant['capacity_mw']} MW) - {plant['distance_km']} km")

print("\n" + "=" * 60)
print("TUM TESTLER TAMAMLANDI!")
print("=" * 60)
