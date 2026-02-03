import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image, ImageDraw, ImageFont
import math

# --- AYARLAR ---
sns.set_style("whitegrid")
plt.rcParams.update({'font.family': 'sans-serif', 'font.size': 12})
RESULTS_DIR = 'results'
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

def load_data():
    try:
        df = pd.read_csv('nasa_impact_dataset.csv')
        return df
    except FileNotFoundError:
        print("Veri seti bulunamadı.")
        return None

# 1. ASTEROİT BOYUT KARŞILAŞTIRMASI (Jüri için çok etkileyici)
def plot_size_comparison(df):
    # Veri setinden temsili asteroitler seç (Küçük, Orta, Büyük, Devasa)
    # Min, %25, %50, %75, Max
    sizes = df['estimated_diameter_max_m'] if 'estimated_diameter_max_m' in df.columns else df['crater_diameter_m'] / 20 # Tahmini
    
    # Eğer estimated_diameter yoksa, kütle ve yoğunluktan hesapla veya crater'dan geri git
    # Veri setinde 'mass_kg' ve 'density' var.
    if 'mass_kg' in df.columns and 'density' in df.columns:
        # V = m / d -> r = (3V/4pi)^(1/3) -> d = 2r
        volume = df['mass_kg'] / df['density']
        diameter = 2 * (3 * volume / (4 * np.pi))**(1/3)
    else:
        diameter = sizes # Fallback

    # Örnekler
    examples = [
        {'name': 'Okul Otobüsü', 'size': 12, 'color': '#f1c40f', 'type': 'ref'},
        {'name': 'Chelyabinsk', 'size': 20, 'color': '#e67e22', 'type': 'asteroid'},
        {'name': 'Futbol Sahası', 'size': 105, 'color': '#2ecc71', 'type': 'ref'},
        {'name': 'Eyfel Kulesi', 'size': 330, 'color': '#95a5a6', 'type': 'ref'},
        {'name': 'Burj Khalifa', 'size': 828, 'color': '#34495e', 'type': 'ref'},
        {'name': 'Everest Dağı', 'size': 8849, 'color': '#ecf0f1', 'type': 'ref'},
        {'name': 'Chicxulub (Dinozor Katili)', 'size': 10000, 'color': '#c0392b', 'type': 'asteroid'}
    ]
    
    # Veri setinden ortalama bir "Tehlikeli" asteroit ekle
    if 'is_potentially_hazardous' in df.columns:
        avg_haz_size = diameter[df['is_potentially_hazardous'] == 1].mean()
        examples.append({'name': 'Ort. Tehlikeli Asteroit', 'size': avg_haz_size, 'color': '#8e44ad', 'type': 'asteroid'})

    # Sırala
    examples.sort(key=lambda x: x['size'])
    
    names = [x['name'] for x in examples]
    sizes_m = [x['size'] for x in examples]
    colors = [x['color'] for x in examples]
    
    plt.figure(figsize=(12, 8))
    bars = plt.barh(names, sizes_m, color=colors)
    
    # Logaritmik ölçek kullan çünkü Everest ile Otobüs aynı grafikte zor
    plt.xscale('log')
    plt.xlabel('Çap (metre) - Logaritmik Ölçek', fontsize=12)
    plt.title('Asteroit Boyut Karşılaştırması', fontsize=16, fontweight='bold')
    
    # Değerleri yaz
    for i, v in enumerate(sizes_m):
        plt.text(v * 1.1, i, f"{v:.1f} m", va='center', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/jury_size_comparison.png', dpi=300)
    plt.close()

# 2. ENERJİ KARŞILAŞTIRMASI (TNT Eşdeğeri)
def plot_energy_comparison(df):
    # Enerji Joules -> Megatons TNT
    # 1 MT TNT = 4.184e15 Joules
    df['energy_mt'] = df['impact_energy_joules'] / 4.184e15
    
    # Referanslar
    refs = [
        {'name': 'Hiroşima (Little Boy)', 'energy': 0.015, 'color': '#7f8c8d'},
        {'name': 'Tunguska (1908)', 'energy': 15, 'color': '#e67e22'},
        {'name': 'St. Helens Yanardağı (1980)', 'energy': 24, 'color': '#95a5a6'},
        {'name': 'Çar Bombası (En Büyük Nükleer)', 'energy': 50, 'color': '#c0392b'},
        {'name': 'Krakatoa Yanardağı', 'energy': 200, 'color': '#d35400'},
        {'name': 'Tüm Nükleer Cephanelik', 'energy': 6400, 'color': '#2c3e50'},
        {'name': 'Chicxulub (Dinozor Katili)', 'energy': 100000000, 'color': '#8e44ad'} # 100 milyon MT
    ]
    
    # Veri setinden en büyük asteroit
    max_ast_energy = df['energy_mt'].max()
    refs.append({'name': 'Veri Setindeki En Büyük Asteroit', 'energy': max_ast_energy, 'color': '#27ae60'})
    
    refs.sort(key=lambda x: x['energy'])
    
    names = [x['name'] for x in refs]
    energies = [x['energy'] for x in refs]
    colors = [x['color'] for x in refs]
    
    plt.figure(figsize=(12, 8))
    plt.barh(names, energies, color=colors)
    plt.xscale('log')
    plt.xlabel('Çarpma Enerjisi (Megaton TNT) - Logaritmik Ölçek', fontsize=12)
    plt.title('Çarpma Enerjisi Ölçeği: Felaketler vs Asteroitler', fontsize=16, fontweight='bold')
    
    for i, v in enumerate(energies):
        plt.text(v * 1.1, i, f"{v:,.2f} MT", va='center')
        
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/jury_energy_comparison.png', dpi=300)
    plt.close()

# 3. "KILL CURVE" / ETKİ YARIÇAPI (Teorik)
def plot_impact_effects():
    # Farklı mesafelerdeki etkileri gösteren teorik bir grafik
    # Senaryo: 10km çapında asteroit (Chicxulub benzeri)
    
    distances = np.linspace(0, 5000, 100) # km
    
    # Basitleştirilmiş etki modelleri (Tamamen görsel amaçlı, bilimsel trendi yansıtır)
    # Thermal Radiation: 1/r^2
    thermal = 100 * np.exp(-distances / 500)
    
    # Seismic: 1/r
    seismic = 100 * np.exp(-distances / 1000)
    
    # Air Blast: 1/r^3 (yakın), 1/r (uzak)
    blast = 100 * np.exp(-distances / 300)
    
    # Ejecta: 1/r^2.5
    ejecta = 100 * np.exp(-distances / 200)
    
    plt.figure(figsize=(12, 6))
    plt.plot(distances, thermal, label='Termal Radyasyon (Yangın)', linewidth=3, color='#e74c3c')
    plt.plot(distances, seismic, label='Sismik Sarsıntı (Deprem)', linewidth=3, color='#8e44ad')
    plt.plot(distances, blast, label='Hava Patlaması (Şok Dalgası)', linewidth=3, color='#3498db')
    plt.plot(distances, ejecta, label='Enkaz Örtüsü (Döküntü)', linewidth=3, color='#7f8c8d')
    
    plt.title('Hayatta Kalma Profili: Mesafeye Göre Etkiler (10km Asteroit Senaryosu)', fontsize=16, fontweight='bold')
    plt.xlabel('Çarpma Noktasından Mesafe (km)', fontsize=12)
    plt.ylabel('Yoğunluk / Hasar Potansiyeli (%)', fontsize=12)
    plt.legend(fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.fill_between(distances, 0, 100, where=(distances < 200), color='black', alpha=0.1, label='Tam Yıkım Bölgesi')
    
    plt.text(100, 50, 'TAM YIKIM', rotation=90, verticalalignment='center', alpha=0.5, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/jury_impact_effects.png', dpi=300)
    plt.close()

# 4. RADAR CHART (TEHLİKELİ ASTEROİT PROFİLİ)
def plot_asteroid_radar(df):
    # En tehlikeli (Potentially Hazardous) asteroitlerden birini seç
    if 'is_potentially_hazardous' not in df.columns:
        return

    hazardous = df[df['is_potentially_hazardous'] == 1]
    if hazardous.empty:
        return
        
    # Rastgele bir tehlikeli asteroit seç
    target = hazardous.iloc[0]
    
    # Veri setinin ortalamalarını al (Normalize etmek için)
    means = df.mean(numeric_only=True)
    
    # Kategoriler
    categories = ['Hız', 'Kütle', 'Enerji', 'Çap', 'Krater Boyutu']
    
    # Değerleri normalize et (Log scale gerekebilir çünkü kütle çok büyük fark eder)
    # Basitlik için 0-100 arası puanlama yapalım (Percentile)
    
    values = []
    for col in ['velocity_kms', 'mass_kg', 'impact_energy_joules', 'estimated_diameter_max_m', 'crater_diameter_m']:
        # Eğer sütun yoksa hesapla
        val = 0
        if col in df.columns:
            # Percentile rank bul
            val = stats.percentileofscore(df[col].dropna(), target[col])
        values.append(val)
        
    # Radar Chart çizimi
    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    values += values[:1]
    angles += angles[:1]
    
    plt.figure(figsize=(8, 8))
    ax = plt.subplot(111, polar=True)
    
    # Eksenler
    plt.xticks(angles[:-1], categories, color='grey', size=10)
    
    # Y ekseni
    ax.set_rlabel_position(0)
    plt.yticks([25, 50, 75, 100], ["25%", "50%", "75%", "100%"], color="grey", size=7)
    plt.ylim(0, 100)
    
    # Çizim
    ax.plot(angles, values, linewidth=2, linestyle='solid', color='#c0392b')
    ax.fill(angles, values, '#c0392b', alpha=0.4)
    
    plt.title(f"Tehlike Profili: {target['name']}", size=16, color='#c0392b', y=1.1, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/jury_asteroid_radar.png', dpi=300)
    plt.close()

def main():
    print("Jüri için etkileyici görseller hazırlanıyor...")
    df = load_data()
    
    # Gerekli kütüphaneyi import et (stats burada lazım)
    global stats
    from scipy import stats
    
    if df is not None:
        plot_size_comparison(df)
        print("1. Boyut Karşılaştırması -> jury_size_comparison.png")
        
        plot_energy_comparison(df)
        print("2. Enerji Karşılaştırması -> jury_energy_comparison.png")
        
        plot_impact_effects()
        print("3. Etki Analizi (Kill Curve) -> jury_impact_effects.png")
        
        plot_asteroid_radar(df)
        print("4. Asteroit Radar Profili -> jury_asteroid_radar.png")
        
    print("Tüm görseller 'results' klasörüne kaydedildi.")

if __name__ == "__main__":
    main()
