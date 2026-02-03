import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Veri setini yükle
df = pd.read_csv('nasa_impact_dataset.csv')

# PHA (Potentially Hazardous Asteroid) kolonunu kontrol et
# PHA = Y ise risk var, N ise risk yok
if 'pha' in df.columns:
    # Risk durumlarını say
    risk_var = len(df[df['pha'] == 'Y'])
    risk_yok = len(df[df['pha'] == 'N'])
    
    # Toplam
    toplam = risk_var + risk_yok
    
    # Yüzdeler
    risk_var_yuzde = (risk_var / toplam) * 100
    risk_yok_yuzde = (risk_yok / toplam) * 100
    
    # Kare görsel oluştur
    fig, ax = plt.subplots(figsize=(10, 10))
    
    # Renkler
    colors = ['#FF6B6B', '#4ECDC4']  # Kırmızı (risk var), Turkuaz (risk yok)
    
    # Pasta grafiği oluştur
    wedges, texts, autotexts = ax.pie(
        [risk_var, risk_yok],
        labels=['Dünya Düşme Riski VAR\n(PHA)', 'Dünya Düşme Riski YOK\n(Non-PHA)'],
        autopct=lambda pct: f'{pct:.1f}%\n({int(pct/100*toplam):,} meteor)',
        startangle=90,
        colors=colors,
        textprops={'fontsize': 14, 'weight': 'bold'},
        explode=(0.05, 0)  # Risk olan kısmı biraz dışarı çıkar
    )
    
    # Başlık
    plt.title('Meteor/Asteroidlerin Dünya Düşme Risk Analizi\n' + 
              f'(Toplam {toplam:,} Meteor/Asteroid)',
              fontsize=18, weight='bold', pad=20)
    
    # Otomatik yazıların stilini ayarla
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(12)
        autotext.set_weight('bold')
    
    # Etiket stilini ayarla
    for text in texts:
        text.set_fontsize(14)
        text.set_weight('bold')
    
    # Ek bilgi kutusu
    info_text = f'''
    ═══════════════════════════════════
    RİSK ANALİZİ DETAYLARI
    ═══════════════════════════════════
    
    🔴 RİSK VAR (PHA):
       • Sayı: {risk_var:,}
       • Yüzde: {risk_var_yuzde:.2f}%
       • PHA (Potentially Hazardous Asteroid)
    
    🟢 RİSK YOK (Non-PHA):
       • Sayı: {risk_yok:,}
       • Yüzde: {risk_yok_yuzde:.2f}%
    
    📊 TOPLAM: {toplam:,}
    ═══════════════════════════════════
    
    Not: PHA, Dünya'ya yakın geçen ve potansiyel
    tehlike oluşturan asteroidlerdir.
    '''
    
    plt.figtext(0.5, -0.05, info_text, ha='center', fontsize=10,
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5),
                family='monospace')
    
    # Grafik ayarları
    plt.axis('equal')  # Dairenin yuvarlak olması için
    plt.tight_layout()
    
    # Kaydet
    plt.savefig('meteor_risk_percentage.png', dpi=300, bbox_inches='tight')
    print('✅ Görsel başarıyla oluşturuldu: meteor_risk_percentage.png')
    
    # Konsol çıktısı
    print('\n' + '='*50)
    print('METEOR/ASTEROİD RİSK ANALİZİ')
    print('='*50)
    print(f'🔴 Dünya Düşme Riski VAR (PHA):  {risk_var:>8,} ({risk_var_yuzde:.2f}%)')
    print(f'🟢 Dünya Düşme Riski YOK:        {risk_yok:>8,} ({risk_yok_yuzde:.2f}%)')
    print(f'📊 TOPLAM:                       {toplam:>8,}')
    print('='*50)
    
    # Göster
    plt.show()
    
else:
    print('❌ Hata: Veri setinde "pha" kolonu bulunamadı!')
    print('Mevcut kolonlar:', df.columns.tolist())
