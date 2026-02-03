import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from validate_model import calculate_atmospheric_entry, MATERIAL_PROPERTIES

# Set style
sns.set_style("whitegrid")
plt.rcParams.update({'font.size': 12})

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def load_data(csv_path):
    df = pd.read_csv(csv_path)
    # Numeric conversion
    cols = ["mass_kg", "velocity_kms", "impact_energy_joules", "crater_diameter_m", "angle_deg", "density"]
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=cols)

def plot_ablation_profile(history, name, out_path):
    # Extract single object history (assuming index 0)
    alt = np.array([h[0] for h in history['altitude']]) / 1000.0 # km
    mass = np.array([h[0] for h in history['mass']])
    mass_pct = mass / mass[0] * 100
    
    plt.figure(figsize=(8, 6))
    plt.plot(mass_pct, alt, linewidth=2, color='#d32f2f')
    plt.xlabel('Remaining Mass (%)')
    plt.ylabel('Altitude (km)')
    plt.title(f'Ablation Profile: {name}', fontsize=14)
    plt.gca().invert_yaxis() # Altitude goes down, but usually we plot altitude on Y. 
    # Actually, standard is Y=Altitude, X=Value. So 100km at top.
    plt.ylim(0, 100)
    plt.xlim(0, 105)
    plt.grid(True, which='both', linestyle='--')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_deceleration_profile(history, name, out_path):
    alt = np.array([h[0] for h in history['altitude']]) / 1000.0 # km
    vel = np.array([h[0] for h in history['velocity']]) / 1000.0 # km/s
    
    plt.figure(figsize=(8, 6))
    plt.plot(vel, alt, linewidth=2, color='#1976d2')
    plt.xlabel('Velocity (km/s)')
    plt.ylabel('Altitude (km)')
    plt.title(f'Deceleration Profile: {name}', fontsize=14)
    plt.ylim(0, 100)
    plt.grid(True, which='both', linestyle='--')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_energy_deposition(history, name, out_path):
    alt = np.array([h[0] for h in history['altitude']]) / 1000.0 # km
    energy = np.array([h[0] for h in history['energy']])
    
    # Calculate dE/dh (Energy deposited per km)
    # Actually dE/dt is power, but we want to show where energy is released.
    # Let's plot Energy Loss Rate vs Altitude
    dE = -np.diff(energy)
    alt_mid = (alt[:-1] + alt[1:]) / 2
    
    # Normalize dE
    if dE.max() > 0:
        dE_norm = dE / dE.max()
    else:
        dE_norm = dE
        
    plt.figure(figsize=(8, 6))
    plt.plot(dE_norm, alt_mid, linewidth=2, color='#fbc02d')
    plt.fill_betweenx(alt_mid, 0, dE_norm, alpha=0.3, color='#fbc02d')
    plt.xlabel('Normalized Energy Deposition Rate')
    plt.ylabel('Altitude (km)')
    plt.title(f'Airburst Profile: {name}', fontsize=14)
    plt.ylim(0, 100)
    plt.grid(True, which='both', linestyle='--')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_material_comparison(out_path):
    # Simulate identical objects with different materials
    materials = ['ice', 'rock', 'iron']
    colors = {'ice': '#90caf9', 'rock': '#795548', 'iron': '#607d8b'}
    
    mass = 1e8 # 100,000 tons
    diameter = 50 # m
    velocity = 20 # km/s
    angle = 45
    
    plt.figure(figsize=(10, 6))
    
    for mat in materials:
        props = MATERIAL_PROPERTIES[mat]
        res = calculate_atmospheric_entry(
            mass, diameter, velocity, angle, 
            props['density'], props['strength'], 
            return_history=True
        )
        hist = res['history']
        alt = np.array([h[0] for h in hist['altitude']]) / 1000.0
        mass_arr = np.array([h[0] for h in hist['mass']])
        mass_pct = mass_arr / mass * 100
        
        plt.plot(mass_pct, alt, label=mat.capitalize(), linewidth=2, color=colors[mat])
        
    plt.xlabel('Remaining Mass (%)')
    plt.ylabel('Altitude (km)')
    plt.title('Survival by Material Type (Simulation)', fontsize=14)
    plt.ylim(0, 100)
    plt.legend()
    plt.grid(True, linestyle='--')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def plot_mass_loss_scatter(df, out_path):
    # Run batch simulation for a subset
    sample = df.sample(min(500, len(df)), random_state=42)
    
    # We need to map composition to density/strength if possible, or use generic
    # For simplicity, use 'rock' properties if unknown, or map from 'composition' col
    
    densities = []
    strengths = []
    
    for _, row in sample.iterrows():
        comp = str(row.get('composition', 'rock')).lower()
        if 'ice' in comp: mat = 'ice'
        elif 'iron' in comp: mat = 'iron'
        else: mat = 'rock'
        
        densities.append(MATERIAL_PROPERTIES[mat]['density'])
        strengths.append(MATERIAL_PROPERTIES[mat]['strength'])
        
    res = calculate_atmospheric_entry(
        sample['mass_kg'].values,
        (sample['mass_kg'].values / 3000 * 3 / 4 / np.pi)**(1/3) * 2, # Approx diameter
        sample['velocity_kms'].values,
        sample['angle_deg'].values,
        np.array(densities),
        np.array(strengths),
        return_history=False
    )
    
    final_mass = res['final_mass_kg']
    initial_mass = sample['mass_kg'].values
    loss_pct = (1 - final_mass / initial_mass) * 100
    
    plt.figure(figsize=(10, 6))
    sc = plt.scatter(initial_mass, loss_pct, c=sample['velocity_kms'], cmap='viridis', alpha=0.7)
    plt.colorbar(sc, label='Velocity (km/s)')
    plt.xscale('log')
    plt.xlabel('Initial Mass (kg)')
    plt.ylabel('Mass Loss (%)')
    plt.title('Atmospheric Mass Loss vs Initial Mass', fontsize=14)
    plt.grid(True, linestyle='--')
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()

def main():
    csv_path = 'nasa_impact_dataset.csv'
    out_dir = 'results'
    ensure_dir(out_dir)
    
    print("Loading data...")
    df = load_data(csv_path)
    
    # 1. Detailed Simulation for one interesting object (e.g., Chelyabinsk-like)
    # Chelyabinsk: ~12000 tons (1.2e7 kg), ~20m, ~19 km/s, ~18 deg
    print("Simulating Chelyabinsk-like object...")
    chely_mass = 1.2e7
    chely_diam = 20
    chely_vel = 19
    chely_angle = 18
    chely_rho = 3300 # LL chondrite
    chely_str = 1e7
    
    res = calculate_atmospheric_entry(
        chely_mass, chely_diam, chely_vel, chely_angle, chely_rho, chely_str, return_history=True
    )
    
    plot_ablation_profile(res['history'], "Chelyabinsk-like", os.path.join(out_dir, 'sim_ablation_chelyabinsk.png'))
    plot_deceleration_profile(res['history'], "Chelyabinsk-like", os.path.join(out_dir, 'sim_decel_chelyabinsk.png'))
    plot_energy_deposition(res['history'], "Chelyabinsk-like", os.path.join(out_dir, 'sim_airburst_chelyabinsk.png'))
    
    # 2. Material Comparison
    print("Simulating material comparison...")
    plot_material_comparison(os.path.join(out_dir, 'sim_material_comparison.png'))
    
    # 3. Batch Scatter
    print("Running batch simulation for scatter plot...")
    plot_mass_loss_scatter(df, os.path.join(out_dir, 'sim_mass_loss_scatter.png'))
    
    print("Simulation visuals generated in 'results/'")

if __name__ == '__main__':
    main()
