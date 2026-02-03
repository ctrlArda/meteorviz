import pandas as pd
import os
import numpy as np


def _safe_to_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors='coerce')


def winsorize_upper(series: pd.Series, z_thresh: float = 3.0, upper_q: float = 0.99) -> pd.Series:
    """Clip extreme high outliers using Z-score>threshold to 99th percentile (upper-only winsorization)."""
    if series.dtype.kind not in 'if':
        return series
    s = series.astype(float)
    if s.isna().all():
        return s
    mean = s.mean(skipna=True)
    std = s.std(skipna=True)
    if std == 0 or not np.isfinite(std):
        return s
    z = (s - mean) / std
    upper_cap = s.quantile(upper_q)
    s = s.mask(z.abs() > z_thresh, other=np.minimum(s, upper_cap))
    return s

def clean_dataset():
    file_path = 'nasa_impact_dataset.csv'
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    print(f"Reading {file_path}...")
    df = pd.read_csv(file_path)
    initial_count = len(df)
    print(f"Initial row count: {initial_count}")

    # 1) Kapsam dışı “dev” manuel eklenenleri filtrele
    df['id_numeric'] = pd.to_numeric(df['id'], errors='coerce')
    df_clean = df[(df['id_numeric'] < 9000000) | (df['id_numeric'].isna())].copy()
    df_clean = df_clean.drop(columns=['id_numeric'])

    # 2) Tip dönüşümleri: sayısal olması gereken bazı sütunlar string gelebiliyor
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
        if col in df_clean.columns:
            df_clean[col] = _safe_to_numeric(df_clean[col])

    # 3) Eksik veri imputasyonu
    # Sayısal -> medyan, kategorik -> mod (yoksa varsayılan "rock")
    for col in df_clean.columns:
        if col in ('id', 'name'):
            continue

        if pd.api.types.is_numeric_dtype(df_clean[col]):
            if df_clean[col].isna().any():
                med = df_clean[col].median(skipna=True)
                df_clean[col] = df_clean[col].fillna(med)
        else:
            if df_clean[col].isna().any():
                mode_vals = df_clean[col].mode(dropna=True)
                fill_val = mode_vals.iloc[0] if len(mode_vals) else None
                if fill_val is None and col == 'composition':
                    fill_val = 'rock'
                df_clean[col] = df_clean[col].fillna(fill_val)

    if 'composition' in df_clean.columns:
        df_clean['composition'] = df_clean['composition'].fillna('rock')

    # 4) Aykırı değer yönetimi: |Z|>3 olanları 99. persentile kırp
    for col in df_clean.select_dtypes(include=[np.number]).columns:
        if col in ('id',):
            continue
        df_clean[col] = winsorize_upper(df_clean[col], z_thresh=3.0, upper_q=0.99)

    # 5) Fiziksel “tamamen saçma” uç durumlara karşı güvenlik freni
    if 'crater_diameter_m' in df_clean.columns:
        df_clean = df_clean[df_clean['crater_diameter_m'] >= 0].copy()
    
    final_count = len(df_clean)
    removed_count = initial_count - final_count
    
    print(f"Final row count: {final_count}")
    print(f"Removed {removed_count} rows.")
    
    if removed_count > 0:
        print("Saving cleaned dataset...")
        df_clean.to_csv(file_path, index=False)
        print("Dataset cleaned and saved.")
    else:
        # Yine de imputasyon/winsorization uygulanmış olabilir; kaydı güncelleyelim.
        print("No rows removed, but cleaning steps may have updated values. Saving...")
        df_clean.to_csv(file_path, index=False)
        print("Dataset saved.")

if __name__ == "__main__":
    clean_dataset()
