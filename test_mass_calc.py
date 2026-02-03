"""
Kütle hesaplama fonksiyonunu test eden script.
GM öncelikli hesaplama sistemi doğrulaması.
"""
import pandas as pd
import numpy as np

# Sabit
GRAVITATIONAL_CONSTANT_G = 6.67430e-11  # m³/(kg·s²)

# Dataset'i yükle
df = pd.read_csv('nasa_impact_dataset.csv', low_memory=False)

# GM değeri olan asteroitler
gm_asteroids = df[df['GM'].notna()][['spkid', 'full_name', 'GM', 'diameter', 'H']]

print("=" * 60)
print("KÜTLE HESAPLAMA TESTİ - GM ÖNCELİKLİ SİSTEM")
print("=" * 60)

for _, row in gm_asteroids.iterrows():
    gm_km3_s2 = row['GM']  # km³/s² cinsinde
    gm_m3_s2 = gm_km3_s2 * 1e9  # m³/s² cinsine çevir
    
    # Kütle hesapla
    mass_kg = gm_m3_s2 / GRAVITATIONAL_CONSTANT_G
    
    # Çap ve yoğunluktan kütle hesapla (karşılaştırma için)
    diameter_km = row['diameter']
    if pd.notna(diameter_km):
        radius_m = (diameter_km * 1000) / 2
        volume_m3 = (4/3) * np.pi * radius_m**3
        density_approx = mass_kg / volume_m3  # kg/m³
    else:
        density_approx = None
    
    print(f"\n{row['full_name']}:")
    print(f"  GM (km³/s²): {gm_km3_s2:.4e}")
    print(f"  GM (m³/s²): {gm_m3_s2:.4e}")
    print(f"  Kütle = GM/G: {mass_kg:.4e} kg")
    if density_approx:
        print(f"  Çap: {diameter_km:.3f} km")
        print(f"  Türetilen yoğunluk: {density_approx:.0f} kg/m³")

print("\n" + "=" * 60)
print("BEKLENEN DEĞERLER (Literatür):")
print("=" * 60)
print("Bennu: ~7.33e10 kg (OSIRIS-REx)")
print("Ryugu: ~4.50e11 kg (Hayabusa2)")
print("Itokawa: ~3.50e10 kg (Hayabusa)")
print("Eros: ~6.69e15 kg (NEAR Shoemaker)")
