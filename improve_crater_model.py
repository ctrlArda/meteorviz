"""
HIZLI ML İYİLEŞTİRME SCRIPTI
============================
Krater çapı tahmin doğruluğunu artırmak için:
1. Gerçek krater verisi entegrasyonu (historical_impacts.csv)
2. XGBoost/LightGBM gibi güçlü modeller
3. Hedef yüzey özellikleri (litoloji)
4. Gelişmiş özellik mühendisliği

Hedef: R² 0.357 → 0.70-0.80
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, cross_val_score, KFold
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, StackingRegressor
from sklearn.linear_model import Ridge
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import warnings

warnings.filterwarnings('ignore')

# Gelişmiş modeller (opsiyonel - yoksa sklearn ile devam eder)
try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
    print("OK XGBoost yuklendi")
except ImportError:
    XGBOOST_AVAILABLE = False
    print("UYARI: XGBoost yok (pip install xgboost ile kurabilirsiniz)")

try:
    from lightgbm import LGBMRegressor
    LIGHTGBM_AVAILABLE = True
    print("OK LightGBM yuklendi")
except ImportError:
    LIGHTGBM_AVAILABLE = False
    print("UYARI: LightGBM yok (pip install lightgbm ile kurabilirsiniz)")

try:
    from catboost import CatBoostRegressor
    CATBOOST_AVAILABLE = True
    print("OK CatBoost yuklendi")
except ImportError:
    CATBOOST_AVAILABLE = False
    print("UYARI: CatBoost yok (pip install catboost ile kurabilirsiniz)")

print("=" * 80)
print("KRATER TAHMİN MODELİNİ İYİLEŞTİRME")
print("Gerçek Veri + Güçlü Modeller + Fizik Özellikleri")
print("=" * 80)

# ============================================================================
# 1. VERİ YÜKLEME
# ============================================================================

print("\n[1/6] Veri yükleniyor...")

# Ana eğitim verisi (sentetik)
if not os.path.exists('nasa_impact_dataset.csv'):
    print("❌ HATA: nasa_impact_dataset.csv bulunamadı!")
    print("Önce 'python create_dataset_from_nasa.py' çalıştırın.")
    exit(1)

df_raw = pd.read_csv('nasa_impact_dataset.csv')
print(f"  NASA veri seti: {len(df_raw)} kayıt")

# Sentetik krater değerleri oluştur (fizik formülleri ile)
def create_synthetic_craters(df):
    """NASA SBDB verisinden sentetik krater değerleri oluştur."""
    records = []
    
    for _, row in df.iterrows():
        # Çap bilgisi (km)
        diameter_km = row.get('diameter')
        if pd.isna(diameter_km) or diameter_km <= 0:
            continue
        
        diameter_m = diameter_km * 1000
        
        # Yoğunluk (spektral tipten tahmin)
        spec = str(row.get('spec_T', row.get('spec_B', 'S'))).strip().upper()
        if spec.startswith('C'):
            density = 1500  # C-type (karbon)
        elif spec.startswith('M') or spec.startswith('X'):
            density = 5000  # M-type (metal)
        else:
            density = 2700  # S-type (taş - varsayılan)
        
        # Kütle
        radius_m = diameter_m / 2
        volume_m3 = (4/3) * np.pi * (radius_m ** 3)
        mass_kg = volume_m3 * density
        
        # Hız (tipik NEO: 15-25 km/s, ortalama 20)
        velocity_kms = np.random.normal(20, 3)
        velocity_kms = np.clip(velocity_kms, 12, 30)
        
        # Açı (45° en olası, normal dağılım)
        angle_deg = np.random.normal(45, 15)
        angle_deg = np.clip(angle_deg, 15, 90)
        
        # Enerji
        velocity_ms = velocity_kms * 1000
        energy_j = 0.5 * mass_kg * velocity_ms ** 2
        energy_mt = energy_j / 4.184e15
        
        # Krater çapı (Pi-scaling)
        # D_crater ≈ 1.8 × D_projectile × (ρ_proj/ρ_target)^(1/3) × (v/12)^(2/3) × sin(θ)^(1/3)
        target_density = 2650
        angle_rad = np.radians(angle_deg)
        
        crater_diameter_m = (1.8 * diameter_m * 
                             (density / target_density) ** (1/3) * 
                             (velocity_kms / 12) ** (2/3) * 
                             (np.sin(angle_rad)) ** (1/3))
        
        # Gerçekçi varyasyon ekle
        crater_diameter_m *= np.random.normal(1.0, 0.15)
        crater_diameter_m = max(crater_diameter_m, diameter_m * 5)  # En az 5x projectile
        
        records.append({
            'mass_kg': mass_kg,
            'velocity_kms': velocity_kms,
            'angle_deg': angle_deg,
            'density': density,
            'diameter_m': diameter_m,
            'crater_diameter_m': crater_diameter_m,
            'impact_energy_joules': energy_j,
            'spectral_type': spec,
            'neo': row.get('neo', 'N') == 'Y',
            'pha': row.get('pha', 'N') == 'Y'
        })
    
    return pd.DataFrame(records)

print("  Sentetik krater değerleri oluşturuluyor...")
df_synthetic = create_synthetic_craters(df_raw)
print(f"  Sentetik veri: {len(df_synthetic)} kayıt")

# Gerçek krater verisi
if os.path.exists('datasets/historical_impacts.csv'):
    df_real = pd.read_csv('datasets/historical_impacts.csv')
    print(f"  Gerçek krater verisi: {len(df_real)} kayıt")
    
    # Gerçek krater verisini NASA format'ına dönüştür
    df_real_processed = []
    
    for _, row in df_real.iterrows():
        # Krater çapından impactor çapı ve parametreleri türet
        crater_km = row['diameter_km']
        crater_m = crater_km * 1000
        
        # Geri mühendislik: D_crater ≈ 1.8 * (E_MT)^0.25 * (scaling factors)
        # Enerji biliyorsak kullan, yoksa krater çapından tersine hesapla
        if pd.notna(row.get('impact_energy_mt')):
            energy_mt = row['impact_energy_mt']
        else:
            # Rough estimate: D_crater (km) ≈ 0.1 * E_MT^0.25
            # E_MT ≈ (D_crater / 0.1)^4
            energy_mt = (crater_km / 0.1) ** 4
        
        # Kinetik enerji: E = 0.5 * m * v^2
        # E_joules = energy_mt * 4.184e15
        energy_j = energy_mt * 4.184e15
        
        # Tipik asteroit hızı: 15-25 km/s (ortalama 20)
        velocity_kms = 20.0
        velocity_ms = velocity_kms * 1000
        
        # Kütle: m = 2 * E / v^2
        mass_kg = 2 * energy_j / (velocity_ms ** 2)
        
        # Impactor çapı: V = m / ρ, d = (6V/π)^(1/3)
        density = 2700  # Tipik taş asteroit
        volume = mass_kg / density
        diameter_m = ((6 * volume / np.pi) ** (1/3))
        
        # Tipik giriş açısı: 45° (en olası)
        angle_deg = 45
        
        record = {
            'mass_kg': mass_kg,
            'velocity_kms': velocity_kms,
            'angle_deg': angle_deg,
            'density': density,
            'crater_diameter_m': crater_m,
            'impact_energy_joules': energy_j,
            'diameter_m': diameter_m,
            'is_real_crater': True,
            'crater_name': row['crater_name'],
            'location': row['location']
        }
        
        df_real_processed.append(record)
    
    df_real_combined = pd.DataFrame(df_real_processed)
    print(f"  Gerçek krater verisi işlendi: {len(df_real_combined)} kayıt")
    
    # Gerçek krater verisine ağırlık ver (5x replikasyon)
    df_real_weighted = pd.concat([df_real_combined] * 5, ignore_index=True)
    print(f"  Gerçek veri ağırlıklandırıldı: {len(df_real_weighted)} kayıt (5x)")
    
else:
    df_real_weighted = None
    print("  ⚠ Gerçek krater verisi bulunamadı (datasets/historical_impacts.csv)")

# ============================================================================
# 2. ÖZELLİK MÜHENDİSLİĞİ
# ============================================================================

print("\n[2/6] Gelişmiş özellik mühendisliği...")

def engineer_features(df):
    """Gelişmiş fizik tabanlı özellikler oluştur."""
    
    # Temizlik ve tip dönüşümü
    numeric_cols = ['mass_kg', 'velocity_kms', 'angle_deg', 'density', 
                    'crater_diameter_m', 'impact_energy_joules', 'diameter_m']
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Eksik değerleri doldur
    df['mass_kg'] = df['mass_kg'].fillna(df['mass_kg'].median())
    df['velocity_kms'] = df['velocity_kms'].fillna(20.0)
    df['angle_deg'] = df['angle_deg'].fillna(45.0)
    df['density'] = df['density'].fillna(2700.0)
    
    # === TEMEL FİZİK ÖZELLİKLERİ ===
    
    # Logaritmik ölçekler (geniş aralıklı değişkenler için)
    df['log_mass'] = np.log10(df['mass_kg'].clip(lower=1))
    df['log_velocity'] = np.log10(df['velocity_kms'].clip(lower=1))
    df['log_density'] = np.log10(df['density'].clip(lower=1))
    
    # Kinetik enerji (double-check)
    velocity_ms = df['velocity_kms'] * 1000
    df['energy_j_calc'] = 0.5 * df['mass_kg'] * velocity_ms ** 2
    df['energy_mt_calc'] = df['energy_j_calc'] / 4.184e15
    df['log_energy_j'] = np.log10(df['energy_j_calc'].clip(lower=1))
    df['log_energy_mt'] = np.log10(df['energy_mt_calc'].clip(lower=1e-10))
    
    # Momentum
    df['momentum'] = df['mass_kg'] * velocity_ms
    df['log_momentum'] = np.log10(df['momentum'].clip(lower=1))
    
    # === GEOMETRİK ÖZELLİKLER ===
    
    angle_rad = np.radians(df['angle_deg'])
    df['sin_angle'] = np.sin(angle_rad)
    df['cos_angle'] = np.cos(angle_rad)
    df['tan_angle'] = np.tan(angle_rad.clip(upper=np.pi/2 - 0.01))
    
    # Hız bileşenleri
    df['vertical_velocity'] = df['velocity_kms'] * df['sin_angle']
    df['horizontal_velocity'] = df['velocity_kms'] * df['cos_angle']
    
    # === BALİSTİK ÖZELLİKLER ===
    
    radius_m = df['diameter_m'] / 2
    area = np.pi * radius_m ** 2
    df['ballistic_coefficient'] = df['mass_kg'] / area.clip(lower=0.01)
    df['log_ballistic_coeff'] = np.log10(df['ballistic_coefficient'].clip(lower=1))
    
    # === Pİ-SCALING GRUPLARI (Holsapple & Schmidt) ===
    
    # Hedef yoğunluğu (varsayılan: ortalama kıtasal kabuk)
    target_density = 2650.0
    df['density_ratio'] = df['density'] / target_density
    df['log_density_ratio'] = np.log10(df['density_ratio'].clip(lower=0.01))
    
    # Pi-grubu 1: (ρ_projectile / ρ_target)^(1/3)
    df['pi_group_1'] = df['density_ratio'] ** (1/3)
    
    # Pi-grubu 2: Froude number ~ v / √(g × d)
    g = 9.81
    df['froude_number'] = df['velocity_kms'] * 1000 / np.sqrt(g * df['diameter_m'].clip(lower=1))
    df['log_froude'] = np.log10(df['froude_number'].clip(lower=1))
    
    # Pi-grubu 3: Enerji ölçeklendirmesi
    df['specific_energy'] = df['energy_j_calc'] / df['mass_kg']
    df['log_specific_energy'] = np.log10(df['specific_energy'].clip(lower=1))
    
    # === KRATER TAHMIN ÖZELLİKLERİ ===
    
    # Basit ölçeklendirme: D_crater ≈ k × E^(1/4)
    df['crater_estimate_km'] = 0.1 * (df['energy_mt_calc'] ** 0.25)
    df['crater_estimate_m'] = df['crater_estimate_km'] * 1000
    df['log_crater_estimate'] = np.log10(df['crater_estimate_m'].clip(lower=1))
    
    # Momentum transfer
    df['momentum_transfer'] = df['momentum'] * df['sin_angle']
    df['log_momentum_transfer'] = np.log10(df['momentum_transfer'].clip(lower=1))
    
    # === İNTERAKSİYON TERİMLERİ ===
    
    df['mass_velocity_product'] = df['log_mass'] * df['log_velocity']
    df['density_velocity_product'] = df['log_density'] * df['log_velocity']
    df['mass_angle_product'] = df['log_mass'] * df['sin_angle']
    df['energy_angle_product'] = df['log_energy_mt'] * df['sin_angle']
    
    # === RİSK ÖZELLİKLERİ ===
    
    # Torino scale estimate
    energy_mt = df['energy_mt_calc']
    df['torino_scale_estimate'] = np.select(
        [energy_mt < 0.001, energy_mt < 1, energy_mt < 10, 
         energy_mt < 100, energy_mt < 1000],
        [0, 1, 2, 3, 5],
        default=8
    )
    
    # Palermo scale (logaritmik risk)
    background_rate = 0.03 * (energy_mt.clip(lower=0.001) ** -0.8)
    df['palermo_scale_estimate'] = np.log10(1.0 / background_rate.clip(lower=1e-10)).clip(-10, 10)
    
    # Normalized risk
    df['normalized_risk'] = (energy_mt / 1000).clip(0, 1)
    
    return df

# Sentetik veriyi işle
df_synthetic_processed = engineer_features(df_synthetic.copy())
print(f"  Sentetik veri işlendi: {df_synthetic_processed.shape[1]} özellik")

# Gerçek veriyi işle (varsa)
if df_real_weighted is not None:
    df_real_processed_full = engineer_features(df_real_weighted.copy())
    
    # Birleştir (gerçek veri fazladan kolonlara sahip olabilir, temizle)
    common_cols = list(set(df_synthetic_processed.columns) & set(df_real_processed_full.columns))
    
    df_combined = pd.concat([
        df_synthetic_processed[common_cols],
        df_real_processed_full[common_cols]
    ], ignore_index=True)
    
    print(f"  Toplam veri: {len(df_combined)} kayıt ({len(df_real_weighted)} gerçek, {len(df_synthetic_processed)} sentetik)")
else:
    df_combined = df_synthetic_processed
    print(f"  Toplam veri: {len(df_combined)} kayıt (sadece sentetik)")

# ============================================================================
# 3. MODEL EĞİTİMİ
# ============================================================================

print("\n[3/6] Model eğitiliyor...")

# Hedef ve özellikler
target_col = 'crater_diameter_m'

# Özellik seçimi (numerik kolonlar, inf/nan temizliği)
feature_cols = [
    'log_mass', 'log_velocity', 'log_density', 'log_energy_j', 'log_energy_mt',
    'momentum', 'log_momentum', 'sin_angle', 'cos_angle', 'tan_angle',
    'vertical_velocity', 'horizontal_velocity', 'ballistic_coefficient', 
    'log_ballistic_coeff', 'density_ratio', 'log_density_ratio',
    'pi_group_1', 'froude_number', 'log_froude', 'specific_energy', 
    'log_specific_energy', 'crater_estimate_m', 'log_crater_estimate',
    'momentum_transfer', 'log_momentum_transfer', 'mass_velocity_product',
    'density_velocity_product', 'mass_angle_product', 'energy_angle_product',
    'torino_scale_estimate', 'palermo_scale_estimate', 'normalized_risk'
]

# Sadece mevcut kolonları al
feature_cols = [col for col in feature_cols if col in df_combined.columns]

X = df_combined[feature_cols].copy()
y = df_combined[target_col].copy()

# Inf ve NaN temizliği
X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(X.median())
y = y.fillna(y.median())

# Log-space'te eğitim (daha iyi ölçeklendirme)
y_log = np.log1p(y)

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y_log, test_size=0.2, random_state=42
)

print(f"  Eğitim seti: {len(X_train)} kayıt")
print(f"  Test seti: {len(X_test)} kayıt")
print(f"  Özellik sayısı: {len(feature_cols)}")

# === MODEL ENSEMBLELİ OLUŞTUR ===

base_models = []

# Gradient Boosting (sklearn)
base_models.append(('gb1', GradientBoostingRegressor(
    n_estimators=300, 
    learning_rate=0.05, 
    max_depth=7,
    subsample=0.8,
    random_state=42
)))

base_models.append(('gb2', GradientBoostingRegressor(
    n_estimators=200, 
    learning_rate=0.1, 
    max_depth=5,
    subsample=0.9,
    random_state=43
)))

# Random Forest
base_models.append(('rf', RandomForestRegressor(
    n_estimators=300,
    max_depth=15,
    min_samples_leaf=3,
    random_state=42,
    n_jobs=-1
)))

# XGBoost (en güçlü - varsa)
if XGBOOST_AVAILABLE:
    base_models.append(('xgb', XGBRegressor(
        n_estimators=400,
        learning_rate=0.05,
        max_depth=7,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )))
    print("  + XGBoost eklendi")

# LightGBM (hızlı - varsa)
if LIGHTGBM_AVAILABLE:
    base_models.append(('lgbm', LGBMRegressor(
        n_estimators=400,
        learning_rate=0.05,
        max_depth=7,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1
    )))
    print("  + LightGBM eklendi")

# CatBoost (robust - varsa)
if CATBOOST_AVAILABLE:
    base_models.append(('catboost', CatBoostRegressor(
        iterations=400,
        learning_rate=0.05,
        depth=7,
        random_state=42,
        verbose=0
    )))
    print("  + CatBoost eklendi")

print(f"\n  Toplam {len(base_models)} model ensemble'da")

# Stacking Regressor
stacking_model = StackingRegressor(
    estimators=base_models,
    final_estimator=Ridge(alpha=1.0),
    cv=5
)

print("\n  Eğitim başlıyor (bu birkaç dakika sürebilir)...")
stacking_model.fit(X_train, y_train)
print("  + Egitim tamamlandi")

# ============================================================================
# 4. DEĞERLENDİRME
# ============================================================================

print("\n[4/6] Model değerlendiriliyor...")

# Tahminler
y_pred_log_train = stacking_model.predict(X_train)
y_pred_log_test = stacking_model.predict(X_test)

# Log-space'ten geri dönüş
y_pred_train = np.expm1(y_pred_log_train)
y_pred_test = np.expm1(y_pred_log_test)
y_train_orig = np.expm1(y_train)
y_test_orig = np.expm1(y_test)

# Metrikler
r2_train = r2_score(y_train_orig, y_pred_train)
r2_test = r2_score(y_test_orig, y_pred_test)

mae_train = mean_absolute_error(y_train_orig, y_pred_train)
mae_test = mean_absolute_error(y_test_orig, y_pred_test)

rmse_train = np.sqrt(mean_squared_error(y_train_orig, y_pred_train))
rmse_test = np.sqrt(mean_squared_error(y_test_orig, y_pred_test))

# MAPE (Mean Absolute Percentage Error)
mape_train = np.mean(np.abs((y_train_orig - y_pred_train) / y_train_orig.clip(lower=1))) * 100
mape_test = np.mean(np.abs((y_test_orig - y_pred_test) / y_test_orig.clip(lower=1))) * 100

print("\n  SONUCLAR:")
print("  " + "=" * 70)
print(f"  {'Metrik':<20} {'Train':<20} {'Test':<20}")
print("  " + "-" * 70)
print(f"  {'R² Score':<20} {r2_train:>18.4f}  {r2_test:>18.4f}")
print(f"  {'MAE (m)':<20} {mae_train:>18.0f}  {mae_test:>18.0f}")
print(f"  {'RMSE (m)':<20} {rmse_train:>18.0f}  {rmse_test:>18.0f}")
print(f"  {'MAPE (%)':<20} {mape_train:>18.2f}  {mape_test:>18.2f}")
print("  " + "=" * 70)

# Cross-validation
print("\n  Cross-Validation (5-fold)...")
cv_scores = cross_val_score(stacking_model, X, y_log, cv=5, scoring='r2')
print(f"     R² ortalama: {cv_scores.mean():.4f} (± {cv_scores.std():.4f})")

# ============================================================================
# 5. MODEL KAYDETME
# ============================================================================

print("\n[5/6] Model kaydediliyor...")

model_package = {
    'model': stacking_model,
    'feature_columns': feature_cols,
    'metrics': {
        'r2_train': r2_train,
        'r2_test': r2_test,
        'mae_test': mae_test,
        'mape_test': mape_test,
        'cv_r2_mean': cv_scores.mean(),
        'cv_r2_std': cv_scores.std()
    },
    'version': 'improved_v1',
    'num_models': len(base_models),
    'real_craters_used': df_real_weighted is not None
}

joblib.dump(model_package, 'improved_crater_model.pkl')
print("  + Model kaydedildi: improved_crater_model.pkl")

# ============================================================================
# 6. GÖRSELLEŞTİRME
# ============================================================================

print("\n[6/6] Görselleştirmeler oluşturuluyor...")

# Prediction vs Actual
plt.figure(figsize=(12, 5))

plt.subplot(1, 2, 1)
plt.scatter(y_test_orig / 1000, y_pred_test / 1000, alpha=0.5, s=20)
plt.plot([0, y_test_orig.max() / 1000], [0, y_test_orig.max() / 1000], 'r--', lw=2, label='Perfect')
plt.xlabel('Gerçek Krater Çapı (km)', fontsize=11)
plt.ylabel('Tahmin Edilen Krater Çapı (km)', fontsize=11)
plt.title(f'Test Seti - R² = {r2_test:.3f}, MAPE = {mape_test:.1f}%', fontsize=12, fontweight='bold')
plt.legend()
plt.grid(alpha=0.3)

plt.subplot(1, 2, 2)
residuals = y_test_orig - y_pred_test
plt.hist(residuals / 1000, bins=50, edgecolor='black', alpha=0.7)
plt.xlabel('Hata (km)', fontsize=11)
plt.ylabel('Frekans', fontsize=11)
plt.title('Hata Dağılımı', fontsize=12, fontweight='bold')
plt.axvline(0, color='r', linestyle='--', linewidth=2)
plt.grid(alpha=0.3)

plt.tight_layout()
plt.savefig('results/improved_crater_model_accuracy.png', dpi=150, bbox_inches='tight')
print("  + Gorsel kaydedildi: results/improved_crater_model_accuracy.png")

print("\n" + "=" * 80)
print("OK IYILESTIRME TAMAMLANDI!")
print("=" * 80)
print(f"\nMODEL PERFORMANSI:")
print(f"   R² Score: {r2_test:.4f} ({'%.1f' % ((r2_test - 0.357) / 0.357 * 100)}% iyileşme)")
print(f"   MAPE: {mape_test:.2f}%")
print(f"   Model: improved_crater_model.pkl")
print("\nBu modeli app.py'de kullanmak için:")
print("   IMPACT_MODEL = joblib.load('improved_crater_model.pkl')['model']")
print("=" * 80)
