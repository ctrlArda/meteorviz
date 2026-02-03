import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
# import seaborn as sns # Removed to avoid dependency issues
from sklearn.model_selection import train_test_split, GridSearchCV, KFold, cross_val_score
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.inspection import permutation_importance
import joblib
import time

# --- BİLİMSEL AYARLAR ---
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
# sns.set(style="whitegrid")
plt.style.use('ggplot')

# Sonuçların kaydedileceği klasör
RESULTS_DIR = 'results'
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

print("=== NASA Asteroit Etki Tahmin Modeli (Gelişmiş Bilimsel Sürüm) ===")
print("Başlatılıyor...")

# 1. VERİ YÜKLEME VE İLK İNCELEME
try:
    df = pd.read_csv('nasa_impact_dataset.csv')
    print(f"Veri seti yüklendi. Boyut: {df.shape}")
except FileNotFoundError:
    print("HATA: 'nasa_impact_dataset.csv' dosyası bulunamadı. Lütfen önce veri setini oluşturun.")
    exit()

# Bazı sayısal sütunlar CSV'de string gelebilir (API kaynaklı). Eğitimde kullanılabilmeleri için dönüştür.
numeric_candidates = [
    'absolute_magnitude_h',
    'eccentricity', 'semi_major_axis', 'inclination', 'orbital_period',
    'perihelion_distance', 'aphelion_distance', 'mean_anomaly', 'mean_motion',
    'moid_au',
    'diameter_m', 'albedo',
    'mass_kg', 'velocity_kms', 'angle_deg', 'density',
    'impact_energy_joules', 'crater_diameter_m'
]
for col in numeric_candidates:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

# 2. GELİŞMİŞ ÖZELLİK MÜHENDİSLİĞİ (FEATURE ENGINEERING)
print("\n[1/6] Özellik Mühendisliği (Feature Engineering)...")
# Fiziksel olarak anlamlı türetilmiş özellikler ekleyelim
df['log_mass'] = np.log1p(df['mass_kg'])

# Enerji (proxy): doğrudan impact_energy_joules kullanmak yerine mass & velocity'den türet
v_ms = df['velocity_kms'] * 1000.0
energy_proxy_j = 0.5 * df['mass_kg'] * (v_ms ** 2)
df['log_energy'] = np.log1p(energy_proxy_j)

# Momentum (kg·km/s) — ölçek tutarlılığı için km/s bırakıldı (model içi ölçekleme ile sorun olmaz)
df['momentum'] = df['mass_kg'] * df['velocity_kms']

# Açı bileşenleri
angle_rad = np.deg2rad(df['angle_deg'])
df['sin_angle'] = np.sin(angle_rad)
df['cos_angle'] = np.cos(angle_rad)

# Kategorik verileri dönüştür (One-Hot Encoding)
if 'composition' in df.columns:
    df = pd.get_dummies(df, columns=['composition'], prefix='comp')

# Boolean verileri sayısal yap
if 'is_potentially_hazardous' in df.columns:
    df['is_potentially_hazardous'] = df['is_potentially_hazardous'].astype(int)

# Hedef ve Özellik Seçimi
target = 'crater_diameter_m'
# 'impact_energy_joules' özelliğini çıkararak (etikete çok yakın) ezberlemeyi azaltalım.
# log_energy burada mass & velocity'den türetildiği için (proxy) özellik olarak tutulabilir.
exclude_cols = ['id', 'name', 'orbit_id', target, 'impact_energy_joules']
# Sadece sayısal sütunları al
features = [col for col in df.columns if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])]

print(f"Kullanılan Özellikler ({len(features)}): {features}")

X = df[features]
y = df[target]

# Hedef değişkene biraz gürültü ekleyerek gerçekçiliği artıralım (Overfitting'i önlemek için)
print("Hedef değişkene %5 gürültü ekleniyor (Gerçekçilik için)...")
noise = np.random.normal(0, y.std() * 0.05, size=len(y)) # %5 gürültü
y = y + noise

# Veri Bölme (Stratified Sampling mümkün değil çünkü regresyon, ama shuffle önemli)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)

# 3. MODEL SEÇİMİ VE KIYASLAMA (BENCHMARKING)
print("\n[2/6] Model Kıyaslama (Benchmarking)...")

models = {
    'Linear Regression': Pipeline([('scaler', StandardScaler()), ('model', LinearRegression())]),
    'Ridge Regression': Pipeline([('scaler', StandardScaler()), ('model', Ridge())]),
    'Random Forest': RandomForestRegressor(random_state=RANDOM_SEED, n_jobs=-1),
    'Gradient Boosting': GradientBoostingRegressor(random_state=RANDOM_SEED)
}

results = {}
best_score = -np.inf
best_model_name = ""

for name, model in models.items():
    start_time = time.time()
    # 5-Fold Cross Validation
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
    elapsed = time.time() - start_time
    
    mean_score = cv_scores.mean()
    std_score = cv_scores.std()
    results[name] = {'mean_r2': mean_score, 'std_r2': std_score, 'time': elapsed}
    
    print(f"   -> {name}: R2 = {mean_score:.4f} (+/- {std_score:.4f}) [{elapsed:.2f}s]")
    
    if mean_score > best_score:
        best_score = mean_score
        best_model_name = name

print(f"\nEn İyi Model Seçildi: {best_model_name} (R2: {best_score:.4f})")

# 4. HİPERPARAMETRE OPTİMİZASYONU (HYPERPARAMETER TUNING)
print(f"\n[3/6] {best_model_name} için Hiperparametre Optimizasyonu...")

final_model = None

if best_model_name == 'Gradient Boosting':
    param_grid = {
        'n_estimators': [100, 200],
        'learning_rate': [0.05, 0.1],
        'max_depth': [3, 5],
        'subsample': [0.8]
    }
    grid_search = GridSearchCV(GradientBoostingRegressor(random_state=RANDOM_SEED), param_grid, cv=5, scoring='r2', n_jobs=-1, verbose=1)
    grid_search.fit(X_train, y_train)
    final_model = grid_search.best_estimator_
    print(f"   En iyi parametreler: {grid_search.best_params_}")

elif best_model_name == 'Random Forest':
    param_grid = {
        'n_estimators': [100, 200],
        'max_depth': [None, 10, 20],
        'min_samples_split': [2, 5]
    }
    grid_search = GridSearchCV(RandomForestRegressor(random_state=RANDOM_SEED, n_jobs=-1), param_grid, cv=5, scoring='r2', n_jobs=-1, verbose=1)
    grid_search.fit(X_train, y_train)
    final_model = grid_search.best_estimator_
    print(f"   En iyi parametreler: {grid_search.best_params_}")

else:
    # Lineer modeller için varsayılanı kullan
    final_model = models[best_model_name]
    final_model.fit(X_train, y_train)

# 5. NİHAİ DEĞERLENDİRME
print("\n[4/6] Test Seti Üzerinde Nihai Değerlendirme...")
y_pred = final_model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print(f"   MAE  : {mae:.4f}")
print(f"   RMSE : {rmse:.4f}")
print(f"   R2   : {r2:.4f}")

# 6. GÖRSELLEŞTİRME VE RAPORLAMA
print("\n[5/6] Bilimsel Grafikler Oluşturuluyor...")

# Grafik 1: Gerçek vs Tahmin
plt.figure(figsize=(10, 6))
plt.scatter(y_test, y_pred, alpha=0.5, color='blue', label='Veri Noktaları')
plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2, label='Mükemmel Uyum')
plt.xlabel('Gerçek Krater Çapı (m)')
plt.ylabel('Tahmin Edilen Krater Çapı (m)')
plt.title(f'Model Doğruluğu: Gerçek vs Tahmin (R2={r2:.3f})')
plt.legend()
plt.grid(True)
plt.savefig(f'{RESULTS_DIR}/prediction_accuracy.png')
plt.close()

# Grafik 2: Hata Dağılımı (Residuals)
residuals = y_test - y_pred
plt.figure(figsize=(10, 6))
# sns.histplot(residuals, kde=True, color='purple')
plt.hist(residuals, bins=30, color='purple', alpha=0.7, edgecolor='black')
plt.xlabel('Hata (Metre)')
plt.title('Hata Dağılımı (Residual Analysis)')
plt.grid(True)
plt.savefig(f'{RESULTS_DIR}/residual_distribution.png')
plt.close()

# Grafik 3: Özellik Önemi (Feature Importance)
if hasattr(final_model, 'feature_importances_'):
    importances = final_model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    plt.figure(figsize=(12, 6))
    plt.title("Özellik Önemi (Feature Importance)")
    plt.bar(range(X.shape[1]), importances[indices], align="center")
    plt.xticks(range(X.shape[1]), [features[i] for i in indices], rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/feature_importance.png')
    plt.close()
else:
    # Permutation Importance (Modelden bağımsız)
    print("   Permutation Importance hesaplanıyor...")
    perm_importance = permutation_importance(final_model, X_test, y_test)
    sorted_idx = perm_importance.importances_mean.argsort()
    
    plt.figure(figsize=(12, 6))
    plt.barh([features[i] for i in sorted_idx], perm_importance.importances_mean[sorted_idx])
    plt.xlabel("Permutation Importance")
    plt.title("Özellik Önemi (Permutation Importance)")
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/feature_importance.png')
    plt.close()

# 7. MODELİ KAYDETME
print("\n[6/6] Model Kaydediliyor...")
joblib.dump(final_model, 'impact_model.pkl')
print("İşlem Tamamlandı! 'impact_model.pkl' dosyası hazır.")
print(f"Grafikler '{RESULTS_DIR}' klasörüne kaydedildi.")
