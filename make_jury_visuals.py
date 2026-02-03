import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.preprocessing import LabelEncoder
from PIL import Image, ImageDraw, ImageFont

# Set style
sns.set_style("whitegrid")
plt.rcParams.update({'font.size': 12})

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def load_and_prep_data(csv_path):
    df = pd.read_csv(csv_path)
    
    # Numeric conversion
    cols = ["mass_kg", "velocity_kms", "impact_energy_joules", "crater_diameter_m", "absolute_magnitude_h"]
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            
    # Drop NaNs in critical columns
    df = df.dropna(subset=cols + ['is_potentially_hazardous'])
    
    # Feature Engineering for Model
    df['log_mass'] = np.log1p(df['mass_kg'])
    df['log_energy'] = np.log1p(df['impact_energy_joules'])
    
    # Encode categorical
    le = LabelEncoder()
    if 'composition' in df.columns:
        df['composition_code'] = le.fit_transform(df['composition'].astype(str))
        
    return df

def train_model(df):
    # Features and Target
    features = ['velocity_kms', 'absolute_magnitude_h', 'log_mass', 'log_energy']
    if 'composition_code' in df.columns:
        features.append('composition_code')
        
    target = 'crater_diameter_m'
    
    X = df[features]
    y = df[target]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    
    return model, features, X_test, y_test, y_pred, r2, mae

def plot_problem_definition(df, out_path):
    # 1. Hazardous Distribution (Donut Chart)
    plt.figure(figsize=(6, 6))
    counts = df['is_potentially_hazardous'].value_counts()
    labels = ['Tehlikesiz', 'Tehlikeli']
    colors = ['#4caf50', '#f44336']
    
    plt.pie(counts, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90, pctdistance=0.85, explode=(0, 0.1))
    centre_circle = plt.Circle((0,0),0.70,fc='white')
    fig = plt.gcf()
    fig.gca().add_artist(centre_circle)
    
    plt.title('Problem Tanımı: Tehlikeli Nesne Oranı', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_impact_scale(df, out_path):
    # 2. Impact Scale Comparison (Log Scale Bar Chart)
    plt.figure(figsize=(10, 6))
    
    # Reference energies (Joules)
    refs = {
        'Hiroşima Bombası': 6.3e13,
        'Çar Bombası': 2.1e17,
        'Küresel Enerji Tüketimi (Yıllık)': 6e20,
        'Dinozor Katili Asteroit (Tah.)': 1e24
    }
    
    # Get max asteroid energy from data
    max_asteroid = df['impact_energy_joules'].max()
    refs['Veri Setindeki En Büyük Asteroit'] = max_asteroid
    
    names = list(refs.keys())
    values = list(refs.values())
    
    # Sort
    sorted_indices = np.argsort(values)
    names = [names[i] for i in sorted_indices]
    values = [values[i] for i in sorted_indices]
    
    colors = ['#90caf9' if 'Asteroit' not in n else '#ef5350' for n in names]
    
    bars = plt.barh(names, values, color=colors)
    plt.xscale('log')
    plt.xlabel('Enerji (Joule) - Logaritmik Ölçek')
    plt.title('Çarpma Potansiyeli: Enerji Karşılaştırması', fontsize=14, fontweight='bold')
    
    # Add value labels
    for i, v in enumerate(values):
        plt.text(v, i, f' {v:.1e} J', va='center')
        
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_feature_importance(model, feature_names, out_path):
    # 3. Methodology: Feature Importance
    plt.figure(figsize=(8, 6))
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    
    plt.bar(range(len(indices)), importances[indices], align='center', color='#ff9800')
    plt.xticks(range(len(indices)), [feature_names[i] for i in indices], rotation=45)
    plt.ylabel('Göreceli Önem')
    plt.title('Metodoloji: Krater Boyutunun Temel Belirleyicileri', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_model_performance(y_test, y_pred, r2, out_path):
    # 4. Results: Predicted vs Actual
    plt.figure(figsize=(8, 8))
    plt.scatter(y_test, y_pred, alpha=0.5, color='#2196f3')
    
    # Perfect prediction line
    max_val = max(y_test.max(), y_pred.max())
    min_val = min(y_test.min(), y_pred.min())
    plt.plot([min_val, max_val], [min_val, max_val], 'r--', lw=2, label='Mükemmel Tahmin')
    
    plt.xlabel('Gerçek Krater Çapı (m)')
    plt.ylabel('Tahmin Edilen Krater Çapı (m)')
    plt.title(f'Sonuçlar: Model Doğruluğu (R² = {r2:.3f})', fontsize=14, fontweight='bold')
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def create_jury_infographic(images, metrics, out_path):
    # Create a layout: 2x2 grid with header
    # Image size target: 800x600 each -> 1600x1200 + header
    
    w, h = 800, 600
    header_h = 250
    footer_h = 100
    total_w = w * 2
    total_h = h * 2 + header_h + footer_h
    
    canvas = Image.new('RGB', (total_w, total_h), 'white')
    draw = ImageDraw.Draw(canvas)
    
    # Load and resize images
    pil_images = [Image.open(p).resize((w, h)) for p in images]
    
    # Paste images
    # Top Left: Problem
    canvas.paste(pil_images[0], (0, header_h))
    # Top Right: Impact
    canvas.paste(pil_images[1], (w, header_h))
    # Bottom Left: Method
    canvas.paste(pil_images[2], (0, header_h + h))
    # Bottom Right: Results
    canvas.paste(pil_images[3], (w, header_h + h))
    
    # Draw Header
    draw.rectangle([(0, 0), (total_w, header_h)], fill='#1a237e')
    
    try:
        title_font = ImageFont.truetype("arial.ttf", 60)
        subtitle_font = ImageFont.truetype("arial.ttf", 30)
        text_font = ImageFont.truetype("arial.ttf", 24)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        text_font = ImageFont.load_default()
        
    draw.text((50, 50), "PROJE BAŞARI KANITLARI", fill='white', font=title_font)
    draw.text((50, 130), "Kriter ve Gösterge Analizi: Problem, Yöntem, Etki, Sonuçlar", fill='#bbdefb', font=subtitle_font)
    
    # Draw Metrics in Header
    metrics_text = f"Model R2 Skoru: {metrics['r2']:.3f} | MAE: {metrics['mae']:.1f} m | Toplam Örnek: {metrics['n_samples']}"
    draw.text((50, 180), metrics_text, fill='#ffeb3b', font=subtitle_font)
    
    # Draw Footer
    draw.rectangle([(0, total_h - footer_h), (total_w, total_h)], fill='#eeeeee')
    footer_text = "NASA Çarpma Analizi Projesi Tarafından Oluşturuldu | 2025"
    draw.text((50, total_h - footer_h + 30), footer_text, fill='black', font=text_font)
    
    # Add Labels to quadrants
    labels = ["1. PROBLEM TANIMI", "2. YARATICILIK & ETKİ", "3. METODOLOJİ", "4. SONUÇLAR & TARTIŞMA"]
    coords = [(20, header_h + 20), (w + 20, header_h + 20), (20, header_h + h + 20), (w + 20, header_h + h + 20)]
    
    for label, coord in zip(labels, coords):
        # Draw background for label
        bbox = draw.textbbox(coord, label, font=subtitle_font)
        draw.rectangle([(bbox[0]-10, bbox[1]-10), (bbox[2]+10, bbox[3]+10)], fill='white', outline='black')
        draw.text(coord, label, fill='black', font=subtitle_font)

    canvas.save(out_path)

def main():
    csv_path = 'nasa_impact_dataset.csv'
    out_dir = 'results'
    ensure_dir(out_dir)
    
    print("Loading data...")
    df = load_and_prep_data(csv_path)
    
    print("Training model for evidence...")
    model, features, X_test, y_test, y_pred, r2, mae = train_model(df)
    
    print(f"Model R2: {r2:.4f}")
    
    # Paths
    p1 = os.path.join(out_dir, 'jury_problem.png')
    p2 = os.path.join(out_dir, 'jury_impact.png')
    p3 = os.path.join(out_dir, 'jury_method.png')
    p4 = os.path.join(out_dir, 'jury_results.png')
    p_final = os.path.join(out_dir, 'PROJECT_EVIDENCE_BOARD.png')
    
    print("Generating plots...")
    plot_problem_definition(df, p1)
    plot_impact_scale(df, p2)
    plot_feature_importance(model, features, p3)
    plot_model_performance(y_test, y_pred, r2, p4)
    
    print("Creating infographic...")
    metrics = {'r2': r2, 'mae': mae, 'n_samples': len(df)}
    create_jury_infographic([p1, p2, p3, p4], metrics, p_final)
    
    print(f"Done! Evidence board saved to {p_final}")

if __name__ == '__main__':
    main()
