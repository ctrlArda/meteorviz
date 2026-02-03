import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from PIL import Image, ImageDraw, ImageFont


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def load_data(csv_path):
    df = pd.read_csv(csv_path)
    # Convert numeric columns safely
    for col in ["mass_kg", "velocity_kms", "impact_energy_joules", "crater_diameter_m"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def plot_hist_crater(df, out_path):
    plt.figure(figsize=(8,5))
    data = df['crater_diameter_m'].dropna()
    sns.histplot(data, bins=50, log_scale=(True, False), color='#2a9d8f')
    plt.xlabel('Crater diameter (m)')
    plt.title('Distribution of Crater Diameters')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_scatter_mass_velocity(df, out_path):
    plt.figure(figsize=(8,6))
    sub = df.dropna(subset=['mass_kg','velocity_kms'])
    sizes = (sub['crater_diameter_m'].fillna(sub['crater_diameter_m'].median()) / sub['crater_diameter_m'].median()) * 50
    sns.scatterplot(data=sub, x='mass_kg', y='velocity_kms', hue='is_potentially_hazardous', size=sizes, palette=['#264653','#e76f51'], legend='brief', alpha=0.7)
    plt.xscale('log')
    plt.xlabel('Mass (kg, log scale)')
    plt.ylabel('Velocity (km/s)')
    plt.title('Mass vs Velocity (size ~ crater diameter)')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_bar_hazard_composition(df, out_path):
    plt.figure(figsize=(8,5))
    comp = df.groupby(['composition','is_potentially_hazardous']).size().reset_index(name='count')
    pivot = comp.pivot(index='composition', columns='is_potentially_hazardous', values='count').fillna(0)
    pivot.columns = ['Non-hazardous','Hazardous']
    pivot = pivot.sort_values(by='Hazardous', ascending=False)
    pivot.plot(kind='bar', stacked=True, color=['#66c2a5','#fc8d62'])
    plt.ylabel('Count')
    plt.title('Composition by Hazardous Flag')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()


def plot_top10_energy(df, out_path):
    import numpy as np
    
    # 1 Megaton TNT = 4.184e15 Joules
    MT_TO_JOULES = 4.184e15
    
    plt.figure(figsize=(14, 10))
    
    # Tarihi felaketler ve insan yapımı patlamalar (Megaton TNT cinsinden)
    referanslar = {
        'Hiroşima Bombası (1945)': 0.015,
        'Çar Bombası (1961)': 50,
        'Krakatoa Yanardağı (1883)': 200,
        'Tunguska Olayı (1908)': 15,
        'Tüm Nükleer Cephanelik': 6400,
        'Chicxulub - Dinozor Katili (65 My)': 100_000_000,  # 100 milyon MT
    }
    
    # Dünya'ya Yakın Asteroitler (NEO) - Potansiyel tehlikeli olanlar
    neo_df = df[df['is_potentially_hazardous'] == True].copy()
    neo_df['energy_mt'] = neo_df['impact_energy_joules'] / MT_TO_JOULES
    
    # En tehlikeli 8 NEO'yu al (daha fazla gösterelim)
    top_neos = neo_df.nlargest(8, 'energy_mt')[['name', 'energy_mt']]
    
    # Tüm verileri birleştir
    tum_veriler = []
    
    # Referansları ekle
    for isim, enerji in referanslar.items():
        tum_veriler.append({
            'isim': isim,
            'enerji_mt': enerji,
            'tur': 'referans' if 'Chicxulub' not in isim else 'chicxulub'
        })
    
    # NEO'ları ekle
    for _, row in top_neos.iterrows():
        tum_veriler.append({
            'isim': f"[NEO] {row['name']}",
            'enerji_mt': row['energy_mt'],
            'tur': 'neo'
        })
    
    # DataFrame oluştur ve sırala
    plot_df = pd.DataFrame(tum_veriler)
    plot_df = plot_df.sort_values('enerji_mt', ascending=True)
    
    # Renk paleti
    renkler = []
    for _, row in plot_df.iterrows():
        if row['tur'] == 'neo':
            renkler.append('#e74c3c')  # Kırmızı - NEO'lar
        elif row['tur'] == 'chicxulub':
            renkler.append('#8e44ad')  # Mor - Dinozor katili
        elif 'Nükleer' in row['isim'] or 'Çar' in row['isim'] or 'Hiroşima' in row['isim']:
            renkler.append('#2c3e50')  # Koyu gri - Nükleer
        elif 'Yanardağı' in row['isim'] or 'Krakatoa' in row['isim']:
            renkler.append('#d35400')  # Turuncu - Yanardağ
        else:
            renkler.append('#e67e22')  # Açık turuncu - Diğer
    
    # Grafik çizimi
    bars = plt.barh(plot_df['isim'], plot_df['enerji_mt'], color=renkler, edgecolor='black', linewidth=0.5)
    
    plt.xscale('log')
    plt.xlabel('Çarpma Enerjisi (Megaton TNT) - Logaritmik Ölçek', fontsize=12, fontweight='bold')
    plt.title('Olası Dünya Çarpma Tehditleri vs. Tarihi Felaketler\n(Dünya\'ya Yakın Asteroitler - NEO Karşılaştırması)', 
              fontsize=14, fontweight='bold')
    
    # Değer etiketleri
    for bar, (_, row) in zip(bars, plot_df.iterrows()):
        enerji = row['enerji_mt']
        if enerji >= 1e9:
            etiket = f'{enerji/1e9:.1f} Milyar MT'
        elif enerji >= 1e6:
            etiket = f'{enerji/1e6:.0f} Milyon MT'
        elif enerji >= 1000:
            etiket = f'{enerji/1000:.1f}K MT'
        elif enerji >= 1:
            etiket = f'{enerji:.0f} MT'
        else:
            etiket = f'{enerji:.3f} MT'
        plt.text(bar.get_width() * 1.15, bar.get_y() + bar.get_height()/2, 
                 etiket, va='center', fontsize=9, fontweight='bold')
    
    # Açıklama kutusu
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#e74c3c', edgecolor='black', label='Dünya\'ya Yakın Asteroit (NEO)'),
        Patch(facecolor='#8e44ad', edgecolor='black', label='Tarihi Asteroit Çarpması'),
        Patch(facecolor='#d35400', edgecolor='black', label='Yanardağ Patlaması'),
        Patch(facecolor='#2c3e50', edgecolor='black', label='Nükleer Patlama'),
        Patch(facecolor='#e67e22', edgecolor='black', label='Diğer Olaylar'),
    ]
    plt.legend(handles=legend_elements, loc='lower right', fontsize=10, framealpha=0.9)
    
    # Uyarı notu
    plt.figtext(0.02, 0.02, 
                'Not: NEO = Near-Earth Object (Dünya\'ya Yakın Cisim). Enerji değerleri varsayımsal çarpma senaryolarına dayanmaktadır.',
                fontsize=8, style='italic', alpha=0.7)
    
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    plt.close()


def create_infographic(images, summary_text, out_path):
    # Compose images into a single A4-like image
    widths, heights = zip(*(i.size for i in images))
    max_w = max(widths)
    total_h = sum(heights) + 200
    canvas = Image.new('RGB', (max_w, total_h), 'white')
    y = 0
    for im in images:
        canvas.paste(im, (0,y))
        y += im.size[1]
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype('arial.ttf', 18)
    except Exception:
        font = ImageFont.load_default()
    draw.rectangle([(0, y),(max_w, y+200)], fill='#1f77b4')
    draw.text((20, y+20), summary_text, fill='white', font=font)
    canvas.save(out_path)


def main():
    csv_path = 'nasa_impact_dataset.csv'
    out_dir = 'results'
    ensure_dir(out_dir)

    df = load_data(csv_path)

    # Generate plots
    hist_path = os.path.join(out_dir, 'hist_crater.png')
    scatter_path = os.path.join(out_dir, 'scatter_mass_velocity.png')
    comp_path = os.path.join(out_dir, 'composition_hazard.png')
    energy_path = os.path.join(out_dir, 'top10_energy.png')

    plot_hist_crater(df, hist_path)
    plot_scatter_mass_velocity(df, scatter_path)
    plot_bar_hazard_composition(df, comp_path)
    plot_top10_energy(df, energy_path)

    # Compose infographic
    images = [Image.open(p).resize((900,400)) for p in [hist_path, scatter_path, energy_path]]
    total = len(df)
    hazardous = df['is_potentially_hazardous'].sum() if 'is_potentially_hazardous' in df.columns else 0
    max_energy = df['impact_energy_joules'].max() if 'impact_energy_joules' in df.columns else 0
    avg_crater = df['crater_diameter_m'].mean() if 'crater_diameter_m' in df.columns else 0
    summary = f"Total records: {int(total)}\nHazardous count: {int(hazardous)}\nMax impact energy: {max_energy:.3e} J\nAverage crater diameter: {avg_crater:.1f} m\n\nKey visuals: crater distribution, mass vs velocity, top impact energies."
    infographic_path = os.path.join(out_dir, 'infographic_jury.png')
    create_infographic(images, summary, infographic_path)

    print('Generated visuals in:', out_dir)


if __name__ == '__main__':
    main()
