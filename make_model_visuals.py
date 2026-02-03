import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from scipy import stats

# --- AYARLAR ---
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
sns.set(style="whitegrid")
RESULTS_DIR = 'results'
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

def load_and_process_data():
    print("Veri yükleniyor ve işleniyor...")
    try:
        df = pd.read_csv('nasa_impact_dataset.csv')
    except FileNotFoundError:
        print("HATA: 'nasa_impact_dataset.csv' bulunamadı.")
        return None, None, None, None

    # --- FEATURE ENGINEERING (train_model.py ile AYNI OLMALI) ---
    # 1. Türetilmiş Özellikler
    df['log_mass'] = np.log1p(df['mass_kg'])
    # df['log_energy'] = np.log1p(df['impact_energy_joules']) # train_model.py'de çıkarıldı
    df['momentum'] = df['mass_kg'] * df['velocity_kms']

    # 2. One-Hot Encoding
    if 'composition' in df.columns:
        df = pd.get_dummies(df, columns=['composition'], prefix='comp')

    # 3. Boolean Dönüşümü
    if 'is_potentially_hazardous' in df.columns:
        df['is_potentially_hazardous'] = df['is_potentially_hazardous'].astype(int)

    # 4. Hedef ve Özellik Seçimi
    target = 'crater_diameter_m'
    # train_model.py'deki exclude listesi:
    exclude_cols = ['id', 'name', 'orbit_id', target, 'impact_energy_joules', 'log_energy']
    
    features = [col for col in df.columns if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])]
    
    print(f"Kullanılan Özellikler: {features}")

    X = df[features]
    y = df[target]

    # train_model.py'de gürültü eklenmişti, burada test seti için orijinal veriyi kullanmak daha doğru olabilir
    # ANCAK model gürültülü veriyle eğitildi. Test setinin de aynı dağılımdan gelmesi beklenir mi?
    # Genellikle test seti "gerçek" veridir. train_model.py'de y'ye gürültü eklendi.
    # Tutarlılık için burada da ekleyelim veya orijinali kullanalım.
    # Modelin genelleme yeteneğini ölçmek için orijinal (temiz) veriyi kullanmak daha iyidir.
    # Ancak train_model.py'de split işleminden ÖNCE gürültü eklendiği için, 
    # X_test, y_test ayrımını birebir tutturmak için aynı işlemi yapmalıyız.
    
    # train_model.py mantığı:
    # noise = np.random.normal(0, y.std() * 0.05, size=len(y))
    # y = y + noise
    # X_train, X_test, y_train, y_test = train_test_split(...)
    
    # Biz burada modeli dışarıdan yüklüyoruz. Model zaten eğitildi.
    # Amacımız modelin performansını görselleştirmek.
    # Eğer train_model.py'deki test setini birebir yeniden oluşturamazsak (random seed aynı olsa bile numpy state değişebilir),
    # sonuçlar biraz farklı olabilir.
    # En iyisi: Veriyi yükle, aynı işlemi uygula.
    
    noise = np.random.normal(0, y.std() * 0.05, size=len(y))
    y = y + noise

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)
    
    return X_test, y_test, features

def plot_actual_vs_predicted(y_test, y_pred):
    plt.figure(figsize=(10, 6))
    plt.scatter(y_test, y_pred, alpha=0.6, color='#3498db', edgecolor='k', s=50)
    
    min_val = min(y_test.min(), y_pred.min())
    max_val = max(y_test.max(), y_pred.max())
    plt.plot([min_val, max_val], [min_val, max_val], 'r--', lw=3, label='Mükemmel Uyum (Ideal)')
    
    plt.xlabel('Gerçek Değerler (Actual)', fontsize=12)
    plt.ylabel('Tahmin Edilen Değerler (Predicted)', fontsize=12)
    plt.title('Gerçek vs Tahmin Edilen Krater Çapı', fontsize=14)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/model_actual_vs_predicted.png', dpi=300)
    plt.close()

def plot_residuals_vs_predicted(y_test, y_pred):
    residuals = y_test - y_pred
    plt.figure(figsize=(10, 6))
    plt.scatter(y_pred, residuals, alpha=0.6, color='#9b59b6', edgecolor='k', s=50)
    plt.axhline(y=0, color='r', linestyle='--', lw=3)
    
    plt.xlabel('Tahmin Edilen Değerler (Predicted)', fontsize=12)
    plt.ylabel('Hatalar (Residuals)', fontsize=12)
    plt.title('Residuals vs Predicted (Hata Varyans Kontrolü)', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/model_residuals_vs_predicted.png', dpi=300)
    plt.close()

def plot_residuals_histogram(y_test, y_pred):
    residuals = y_test - y_pred
    plt.figure(figsize=(10, 6))
    sns.histplot(residuals, kde=True, color='#e74c3c', bins=30)
    plt.xlabel('Hata Miktarı (Residuals)', fontsize=12)
    plt.title('Hata Dağılımı (Normallik Kontrolü)', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/model_residuals_hist.png', dpi=300)
    plt.close()

def plot_qq_plot(y_test, y_pred):
    residuals = y_test - y_pred
    plt.figure(figsize=(10, 6))
    stats.probplot(residuals, dist="norm", plot=plt)
    plt.title('Q-Q Plot (Hataların Normalliği)', fontsize=14)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(f'{RESULTS_DIR}/model_qq_plot.png', dpi=300)
    plt.close()

def plot_feature_importance(model, features):
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1]
        
        plt.figure(figsize=(12, 8))
        sns.barplot(x=importances[indices], y=[features[i] for i in indices], palette='viridis')
        plt.title('Özellik Önemi (Feature Importance)', fontsize=14)
        plt.xlabel('Önem Derecesi', fontsize=12)
        plt.tight_layout()
        plt.savefig(f'{RESULTS_DIR}/model_feature_importance_detailed.png', dpi=300)
        plt.close()

def main():
    print("=== Model Doğruluk Görselleştirme Aracı ===")
    
    # 1. Modeli Yükle
    model_path = 'impact_model.pkl'
    if not os.path.exists(model_path):
        print(f"HATA: '{model_path}' bulunamadı. Önce modeli eğitin.")
        return

    print(f"Model yükleniyor: {model_path}")
    model = joblib.load(model_path)

    # 2. Veriyi Hazırla
    X_test, y_test, features = load_and_process_data()
    if X_test is None:
        return

    # 3. Tahmin Yap
    print("Tahminler yapılıyor...")
    y_pred = model.predict(X_test)

    # 4. Metrikleri Hesapla
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"\n--- Model Performansı ---")
    print(f"R2 Score: {r2:.4f}")
    print(f"MAE: {mae:.4f}")
    print(f"RMSE: {rmse:.4f}")

    # 5. Görselleştirmeleri Oluştur
    print("\nGrafikler oluşturuluyor...")
    
    plot_actual_vs_predicted(y_test, y_pred)
    print(f"1. Actual vs Predicted -> {RESULTS_DIR}/model_actual_vs_predicted.png")
    
    plot_residuals_vs_predicted(y_test, y_pred)
    print(f"2. Residuals vs Predicted -> {RESULTS_DIR}/model_residuals_vs_predicted.png")
    
    plot_residuals_histogram(y_test, y_pred)
    print(f"3. Residuals Histogram -> {RESULTS_DIR}/model_residuals_hist.png")
    
    plot_qq_plot(y_test, y_pred)
    print(f"4. Q-Q Plot -> {RESULTS_DIR}/model_qq_plot.png")
    
    plot_feature_importance(model, features)
    print(f"5. Feature Importance -> {RESULTS_DIR}/model_feature_importance_detailed.png")

    print("\nİşlem tamamlandı.")

if __name__ == "__main__":
    main()
