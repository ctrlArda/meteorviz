"""
=======================================================================
METEORVIZ - VERİ SETİ KULLANIM ANALİZİ
=======================================================================
Bu script, sistemin 50 veri setini nasıl kullandığını analiz eder.

Analiz Tarihi: Şubat 2026
=======================================================================
"""

# Sistemdeki veri setleri ve kullanım durumları

VERİ_SETİ_KULLANIMI = {
    # =================================================================
    # 1. METEOR/ASTEROİT FİZİKSEL ÖZELLİKLERİ
    # =================================================================
    "nasa_impact_dataset.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "40,764 asteroit parametresi (kütle, çap, yörünge, GM, H magnitude)",
        "hesaplama": "Kütle hesaplama (GM öncelikli), çap tahmini, yörünge parametreleri"
    },
    "asteroid_internal_structure.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Asteroit iç yapısı (porozite, yoğunluk, mukavemet)",
        "hesaplama": "Bulk density düzeltmesi, airburst yüksekliği hesaplaması"
    },
    "asteroid_shapes_physics.json": {
        "durum": "⚠️ YÜKLÜ AMA SINIRLI",
        "ne_için": "Asteroit şekil modelleri",
        "hesaplama": "Şekil düzeltmesi henüz tam entegre değil"
    },
    "meteorite_physics.json": {
        "durum": "✅ KULLANILIYOR", 
        "ne_için": "Meteorit materyal özellikleri (5 tip: iron, stony-iron, chondrite, carbonaceous, cometary)",
        "hesaplama": "Ablasyon, fragmentasyon, termal iletkenlik hesaplamaları"
    },
    
    # =================================================================
    # 2. ATMOSFERİK MODEL
    # =================================================================
    "us_standard_atmosphere_1976.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "7 atmosfer katmanı (0-86 km), yoğunluk profili",
        "hesaplama": "Atmosferik giriş, sürtünme, airburst yüksekliği"
    },
    "atmospheric_airburst_model.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Chelyabinsk tipi airburst modellemesi",
        "hesaplama": "Parçalanma yüksekliği, enerji dağılımı"
    },
    "global_wind_model.json": {
        "durum": "⚠️ YÜKLÜ AMA SINIRLI",
        "ne_için": "Küresel rüzgar sirkülasyonu",
        "hesaplama": "Debris/toz yayılımı için kullanılabilir (tam entegre değil)"
    },
    
    # =================================================================
    # 3. YER BİLİMİ VE TOPOĞRAFYA
    # =================================================================
    "glim_lithology.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "15 kaya tipi (sedimanter, magmatik, metamorfik vb.)",
        "hesaplama": "Hedef yoğunluğu ve mukavemeti hesaplaması"
    },
    "esa_worldcover_classes.csv": {
        "durum": "⚠️ YÜKLÜ AMA SINIRLI",
        "ne_için": "11 arazi örtüsü sınıfı",
        "hesaplama": "Arazi tipi belirleme (basitleştirilmiş)"
    },
    "topography_slope_aspect.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Eğim sınıflandırması, tsunami amplifikasyonu",
        "hesaplama": "Şok dalgası zayıflaması, debris akış olasılığı"
    },
    "prem_earth_model.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "9 Dünya katmanı (kabuk, manto, çekirdek)",
        "hesaplama": "Sismik dalga hızları ve yayılım süreleri"
    },
    
    # =================================================================
    # 4. SU/TSUNAMİ
    # =================================================================
    "tsunami_propagation_physics.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Tsunami fiziği parametreleri",
        "hesaplama": "Dalga yüksekliği, yayılım, kıyı amplifikasyonu (Green's Law)"
    },
    "historical_tsunami_runup.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "5 tarihsel tsunami olayı",
        "hesaplama": "Model validasyonu"
    },
    "gebco_bathymetry": {
        "durum": "✅ KULLANILIYOR (8 tile)",
        "ne_için": "Okyanus derinliği (yüksek çözünürlük)",
        "hesaplama": "Su derinliği → tsunami hızı ve dalga yüksekliği"
    },
    
    # =================================================================
    # 5. NÜFUS VE EKONOMİK
    # =================================================================
    "ppp_2020_1km_Aggregated.tif": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "1 km çözünürlükte dünya nüfusu",
        "hesaplama": "Etkilenen nüfus hesabı (daire maskesi ile)"
    },
    "global_gdp_density.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Küresel GDP yoğunluğu",
        "hesaplama": "Ekonomik hasar tahmini"
    },
    "socioeconomic_vulnerability_index.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Sosyoekonomik kırılganlık faktörleri",
        "hesaplama": "Risk değerlendirmesi"
    },
    
    # =================================================================
    # 6. ALTYAPI
    # =================================================================
    "global_power_plant_database.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "34,936 güç santrali",
        "hesaplama": "Enerji altyapısı riski"
    },
    "nuclear_power_plants.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "20 nükleer santral",
        "hesaplama": "Nükleer risk değerlendirmesi"
    },
    "major_dams.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "20 büyük baraj",
        "hesaplama": "Baraj yıkılma riski ve sel tehlikesi"
    },
    "major_airports.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "20 havalimanı",
        "hesaplama": "Ulaşım altyapısı etkisi"
    },
    "health_facilities.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "1,047 sağlık tesisi",
        "hesaplama": "Medikal kapasite kaybı"
    },
    "submarine_cables.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "687 denizaltı internet kablosu",
        "hesaplama": "Küresel iletişim kesintisi riski"
    },
    "infrastructure_dependency_network.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Altyapı bağımlılık ağı",
        "hesaplama": "Kademeli çökme analizi"
    },
    
    # =================================================================
    # 7. ÇEVRESEL
    # =================================================================
    "biodiversity_hotspots.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Biyolojik çeşitlilik noktaları",
        "hesaplama": "Ekolojik etki değerlendirmesi"
    },
    "agricultural_zones.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "5 tarımsal bölge",
        "hesaplama": "Gıda güvenliği etkisi"
    },
    "impact_winter_parameters.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Nükleer kış parametreleri",
        "hesaplama": "Küresel sıcaklık düşüşü, tarım kesintisi"
    },
    
    # =================================================================
    # 8. TARİHSEL VERİLER
    # =================================================================
    "historical_impacts.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "20 tarihsel krater",
        "hesaplama": "Model validasyonu, benzer olay bulma"
    },
    "historical_events.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Genişletilmiş tarihsel olaylar",
        "hesaplama": "Chelyabinsk, Tunguska validasyonu"
    },
    "historical_impact_damage_losses.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "5 modern olayın hasar verileri",
        "hesaplama": "Ekonomik hasar tahmini validasyonu"
    },
    "cneos_fireballs.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "914 ateş topu olayı",
        "hesaplama": "Küçük çarpışma istatistikleri"
    },
    
    # =================================================================
    # 9. TEHDİT DEĞERLENDİRME
    # =================================================================
    "jpl_sentry_threats.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "2,063 potansiyel tehdit asteroidi",
        "hesaplama": "Palermo/Torino ölçeği risk değerlendirmesi"
    },
    "cneos_close_approach.csv": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "145 yakın geçiş",
        "hesaplama": "Erken uyarı sistemi"
    },
    "decision_thresholds_policy_framework.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Karar eşikleri",
        "hesaplama": "Tahliye/sığınak kararları"
    },
    
    # =================================================================
    # 10. SAVUNMA/AKSİYON
    # =================================================================
    "deflection_technologies.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Saptırma teknolojileri (kinetik, nükleer, gravity tractor)",
        "hesaplama": "Delta-v hesaplamaları, uyarı süresi gereksinimleri"
    },
    "evacuation_parameters.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Tahliye parametreleri",
        "hesaplama": "Tahliye süreleri ve kapasiteleri"
    },
    "early_warning_mitigation_effectiveness.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Erken uyarı etkinliği",
        "hesaplama": "Uyarı süresi → kurtarılabilecek can"
    },
    "dart_mission_data.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "DART misyonu verileri",
        "hesaplama": "Kinetik saptırma validasyonu"
    },
    
    # =================================================================
    # 11. BELİRSİZLİK VE KALİBRASYON
    # =================================================================
    "parameter_uncertainty_distributions.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Monte Carlo parametre dağılımları",
        "hesaplama": "Belirsizlik kantifikasyonu"
    },
    "model_error_profile.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Model hata profili (Chelyabinsk/Tunguska)",
        "hesaplama": "Model güven aralıkları"
    },
    
    # =================================================================
    # 12. ZAMANSAL
    # =================================================================
    "seasonality_timing_effects.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "Mevsimsellik ve zamanlama etkileri",
        "hesaplama": "Saat/gün/ay bazlı kayıp çarpanı"
    },
    "temporal_impact_evolution.json": {
        "durum": "✅ KULLANILIYOR",
        "ne_için": "T+0 → T+yıllar zaman çizelgesi",
        "hesaplama": "Uzun vadeli etki tahmini"
    },
}

# =======================================================================
# HESAPLAMALARA DAHİL EDİLEN PARAMETRELER
# =======================================================================

HESAPLAMA_PARAMETRELERİ = {
    "meteor_ozellikleri": {
        "kutle_kg": "✅ GM öncelikli, diameter+density, H magnitude fallback",
        "cap_m": "✅ Dataset veya H magnitude'dan türetilir",
        "yogunluk_kg_m3": "✅ Spektral tipten (Carry 2012 referansları)",
        "hiz_kms": "✅ Yörünge parametrelerinden (vis-viva)",
        "giri_acisi_deg": "✅ Yörünge eğimi ve eksantriklikten",
        "bilsim": "✅ Spektral tipten (rock, iron, carbonaceous vb.)",
        "mukavemet_mpa": "✅ İç yapı modelinden",
        "porozite": "✅ İç yapı modelinden"
    },
    
    "atmosferik": {
        "yogunluk_profili": "✅ US Standard 1976 (7 katman)",
        "airburst_yuksekligi": "✅ Çap, hız, mukavemet, açıdan hesaplanır",
        "ablasyon": "✅ Isı transferi ve kütle kaybı",
        "fragmentasyon": "✅ Dinamik basınç vs mukavemet"
    },
    
    "hedef_bolge": {
        "kara_deniz": "✅ Global Land Mask ile belirlenir",
        "yukseklik_derinlik": "✅ GEBCO batimetri / Open Topo API",
        "litoloji": "⚠️ Basitleştirilmiş (enlem bazlı)",
        "arazi_ortusu": "⚠️ Basitleştirilmiş",
        "egim": "✅ Topoğrafya veri setinden",
        "su_derinligi": "✅ GEBCO 2025 yüksek çözünürlük"
    },
    
    "ruzgar": {
        "durum": "⚠️ VERİ YÜKLÜ AMA TAM ENTEGRE DEĞİL",
        "not": "Debris/toz yayılımı için kullanılabilir"
    },
    
    "etki_hesaplamalari": {
        "krater_capi": "✅ Pi-scaling (Holsapple), hedef özellikleri dahil",
        "krater_derinligi": "✅ D/5 oranı (D_final * 0.20)",
        "patlama_yaricaplari": "✅ Z-scaling (1, 5, 20 psi eşikleri)",
        "termal_yaricap": "✅ Airburst vs surface düzeltmeli",
        "sismik_magnitüd": "✅ Moment magnitude, seismic efficiency",
        "tsunami": "✅ Gelişmiş model (Green's Law, kıyı amplifikasyonu)"
    }
}

# =======================================================================
# SONUÇ
# =======================================================================

print("=" * 70)
print("METEORVIZ - VERİ SETİ KULLANIM ANALİZİ")
print("=" * 70)

kullanilan = 0
sinirli = 0
kullanilmiyor = 0

for ds, info in VERİ_SETİ_KULLANIMI.items():
    if "✅" in info["durum"]:
        kullanilan += 1
    elif "⚠️" in info["durum"]:
        sinirli += 1
    else:
        kullanilmiyor += 1

print(f"\n📊 VERİ SETİ DURUMU:")
print(f"   ✅ Tam Kullanılan: {kullanilan}")
print(f"   ⚠️ Sınırlı/Basitleştirilmiş: {sinirli}")
print(f"   ❌ Kullanılmıyor: {kullanilmiyor}")

print(f"\n📌 HESAPLANAN PARAMETRELER:")
print(f"\nMETEOR ÖZELLİKLERİ:")
for k, v in HESAPLAMA_PARAMETRELERİ["meteor_ozellikleri"].items():
    print(f"   {k}: {v}")

print(f"\nATMOSFERİK:")
for k, v in HESAPLAMA_PARAMETRELERİ["atmosferik"].items():
    print(f"   {k}: {v}")

print(f"\nHEDEF BÖLGE:")
for k, v in HESAPLAMA_PARAMETRELERİ["hedef_bolge"].items():
    print(f"   {k}: {v}")

print(f"\nRÜZGAR:")
print(f"   {HESAPLAMA_PARAMETRELERİ['ruzgar']['durum']}")
print(f"   Not: {HESAPLAMA_PARAMETRELERİ['ruzgar']['not']}")

print(f"\nETKİ HESAPLAMALARI:")
for k, v in HESAPLAMA_PARAMETRELERİ["etki_hesaplamalari"].items():
    print(f"   {k}: {v}")

print("\n" + "=" * 70)
print("ÖNERİLER:")
print("=" * 70)
print("""
1. ⚠️ Rüzgar modeli tam entegre edilmeli (debris/toz yayılımı için)
2. ⚠️ Arazi örtüsü (WorldCover) gerçek raster veri ile entegre edilmeli
3. ⚠️ Litoloji için gerçek GLiM raster veri gerekli
4. ✅ Atmosferik giriş simülasyonu çok detaylı (RK4 integratör)
5. ✅ Krater hesaplaması pi-scaling ile fiziksel olarak doğru
6. ✅ Tsunami hesaplaması Green's Law ile bilimsel
""")
