import pandas as pd
import numpy as np

def check_dataset(file_path):
    print(f"Checking dataset: {file_path}")
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    print(f"Shape: {df.shape}")
    print("-" * 20)

    # Top 5 largest mass
    print("Top 5 largest objects by mass:")
    top_mass = df.sort_values(by='mass_kg', ascending=False).head(5)
    print(top_mass[['id', 'name', 'absolute_magnitude_h', 'mass_kg', 'crater_diameter_m']])
    print("-" * 20)

    # Top 5 smallest H (brightest/largest)
    print("Top 5 objects with smallest absolute magnitude (H):")
    top_h = df.sort_values(by='absolute_magnitude_h', ascending=True).head(5)
    print(top_h[['id', 'name', 'absolute_magnitude_h', 'mass_kg']])

if __name__ == "__main__":
    check_dataset("nasa_impact_dataset.csv")
