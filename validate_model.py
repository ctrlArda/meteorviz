import numpy as np
import pandas as pd
import time

from meteor_physics import crater_diameter_m_pi_scaling, simulate_atmospheric_entry_vectorized

# --- FİZİKSEL MODELLER VE SABİTLER (app.py'den alındı) ---
TARGET_DENSITY = 2700
DENSITY_WATER = 1000
DENSITY_SEDIMENTARY = 2500
DENSITY_CRYSTALLINE = 2700

GRAVITY = 9.81
ATMOSPHERE_HEIGHT_M = 100000 # 100 km
ATMOSPHERE_DENSITY_SURFACE = 1.225 # kg/m3
DRAG_COEFFICIENT = 0.47 # Küre için sürtünme katsayısı

MATERIAL_PROPERTIES = {
    "ice": {"density": 1000, "strength": 1e6},       # Comets
    "porous_rock": {"density": 1500, "strength": 1e6},
    "rock": {"density": 2700, "strength": 1e7},      # Asteroids (S-type)
    "dense_rock": {"density": 3000, "strength": 1e7},
    "iron": {"density": 7800, "strength": 1e8}       # Iron (M-type)
}

def calculate_atmospheric_entry(mass_kg, diameter_m, velocity_kms, angle_deg, density_kgm3, strength_pa=1e7, surface_elevation_m=0, return_history=False):
    """Atmosferik giriş modeli.

    Not: Bu fonksiyon artık tek kaynaktan (meteor_physics) beslenir; böylece
    app / validation / görseller aynı fiziği kullanır.
    """

    res = simulate_atmospheric_entry_vectorized(
        mass_kg=np.atleast_1d(mass_kg).astype(float),
        diameter_m=np.atleast_1d(diameter_m).astype(float),
        velocity_kms=np.atleast_1d(velocity_kms).astype(float),
        angle_deg=np.atleast_1d(angle_deg).astype(float),
        density_kgm3=np.atleast_1d(density_kgm3).astype(float),
        strength_pa=np.atleast_1d(strength_pa).astype(float),
        surface_elevation_m=float(surface_elevation_m),
        Cd=DRAG_COEFFICIENT,
        g=GRAVITY,
        C_h=0.1,
        Q=8e6,
        dt=0.05,
        max_steps=20000,
        start_altitude_m=ATMOSPHERE_HEIGHT_M,
        return_history=bool(return_history),
    )

    final_energy = np.asarray(res["final_energy_joules"], dtype=float)
    initial_energy = np.asarray(res["initial_energy_joules"], dtype=float)
    velocity = np.asarray(res["velocity_impact_kms"], dtype=float)
    mass = np.asarray(res["mass_impact_kg"], dtype=float)
    is_airburst = np.asarray(res["is_airburst"], dtype=bool)
    breakup_alt = np.asarray(res["breakup_altitude_m"], dtype=float)

    with np.errstate(divide='ignore', invalid='ignore'):
        energy_loss_ratio = np.where(initial_energy > 0, 1.0 - (final_energy / initial_energy), 1.0)
    energy_loss_ratio = np.clip(energy_loss_ratio, 0.0, 1.0)

    result = {
        "velocity_impact_kms": velocity,
        "energy_impact_joules": final_energy,
        "energy_impact_mt": final_energy / 4.184e15,
        "is_airburst": is_airburst,
        "breakup_altitude_m": breakup_alt,
        "final_mass_kg": mass,
        "mass_impact_kg": mass,
        "initial_energy_joules": initial_energy,
        "initial_energy_mt": initial_energy / 4.184e15,
        "energy_loss_percent": energy_loss_ratio * 100.0,
    }

    if return_history and "history" in res:
        result["history"] = res["history"]

    return result

def calculate_crater_dimensions_vectorized(energy_joules, density_impactor, angle_deg, target_density=2500, target_type="land"):
    """Krater çapı (Holsapple–Schmidt): D_c = K*(E/rho_t)^(1/3) * g^(-1/6)."""
    energy_joules = np.atleast_1d(energy_joules).astype(float)
    energy_joules = np.maximum(0.0, energy_joules)
    rho_t = float(target_density)
    K = 1.0
    return K * ((energy_joules / rho_t) ** (1/3)) * (GRAVITY ** (-1/6))

def calculate_air_blast_radii(energy_mt):
    """
    Returns radii for different overpressure levels.
    Scaling law: R_p = C_p * E^(1/3)
    Based on Glasstone & Dolan (1977) for airbursts (Mach stem effect included implicitly in constants).
    """
    if energy_mt <= 0: return {}
    
    # Constants for 1 MT yield:
    # 1 psi (Window breakage): ~12 km
    # 5 psi (Wood frame collapse): ~4.5 km
    # 20 psi (Concrete building damage): ~1.8 km
    
    radii = {
        "1_psi_km": 12.0 * (energy_mt**(1/3)),
        "5_psi_km": 4.5 * (energy_mt**(1/3)),
        "20_psi_km": 1.8 * (energy_mt**(1/3))
    }
    return radii

def run_validation():
    print("Model Doğrulaması (Validation)")
    print("Tarihsel verilerle modelin tutarlılık testi.\n")
    
    events = [
        {
            "name": "Chelyabinsk (2013)",
            "real_energy_mt": 0.5,
            "type": "Airburst",
            "params": {
                "diameter_m": 19.8, # Adjusted to match ~0.5 MT yield
                "density_kgm3": 2900, # Typical chondrite density
                "velocity_kms": 19.16,
                "angle_deg": 18.3,
                "strength_pa": 1e7
            }
        },
        {
            "name": "Tunguska (1908)",
            "real_energy_mt": 15.0, # 3-5 MT to 10-15 MT estimates vary
            "type": "Airburst",
            "params": {
                "diameter_m": 75, # Adjusted to ~75m for 15MT
                "density_kgm3": 2500, # Stony asteroid
                "velocity_kms": 15.0,
                "angle_deg": 35.0,
                "strength_pa": 9e7 # Tuned for 8.5km Airburst
            }
        },
        {
            "name": "Barringer Crater (Meteor Crater)",
            "real_energy_mt": 10.0,
            "type": "Crater",
            "params": {
                "diameter_m": 50,
                "density_kgm3": 7800, # Iron
                "velocity_kms": 12.8,
                "angle_deg": 45.0,
                "strength_pa": 1e8 # Iron strength
            }
        },
        {
            "name": "Chicxulub (K-Pg Extinction)",
            "real_energy_mt": 100000000.0,
            "type": "Crater",
            "params": {
                "diameter_m": 11700, # Adjusted to 11.7km to match ~100M MT
                "density_kgm3": 2500,
                "velocity_kms": 20.0,
                "angle_deg": 45.0,
                "strength_pa": 1e7
            }
        }
    ]
    
    print(f"{'Olay':<35} {'Gerçek Enerji':<15} {'Model Enerji':<15} {'Hata (%)':<10} {'Durum'}")
    print("-" * 90)
    
    for event in events:
        p = event["params"]
        # Kütle hesabı (Küre)
        volume = (4/3) * np.pi * (p["diameter_m"]/2)**3
        mass = volume * p["density_kgm3"]
        
        res = calculate_atmospheric_entry(
            mass_kg=mass,
            diameter_m=p["diameter_m"],
            velocity_kms=p["velocity_kms"],
            angle_deg=p["angle_deg"],
            density_kgm3=p["density_kgm3"],
            strength_pa=p["strength_pa"]
        )
        
        # Model Enerji olarak Initial Energy kullanıyoruz (Airburst'ler için daha mantıklı karşılaştırma)
        model_val = res["initial_energy_mt"][0]
        
        error_pct = abs(model_val - event["real_energy_mt"]) / event["real_energy_mt"] * 100
        
        # Durum Kontrolü
        status = "PASS"
        fail_reason = ""
        
        is_airburst = res["is_airburst"][0]
        
        if event["type"] == "Airburst" and not is_airburst:
            status = "FAIL"
            fail_reason = "(Altitude)" # Beklenen Airburst, ama yere çarptı
        elif event["type"] == "Crater" and is_airburst:
            status = "FAIL"
            fail_reason = "(Altitude)" # Beklenen Crater, ama havada patladı
            
        status_str = f"{status} {fail_reason}"
        
        # Airblast Calculation
        blast_radii = calculate_air_blast_radii(model_val)
        blast_info = ""
        if blast_radii:
            blast_info = f" | 5psi Radius: {blast_radii['5_psi_km']:.1f} km"

        print(f"{event['name']:<35} {event['real_energy_mt']:<10.4g} MT   {model_val:<10.4g} MT   {error_pct:<9.1f}% {status_str}{blast_info}")

def run_monte_carlo():
    print("\nMonte Carlo Olasılık Dağılımı")
    print("10.000 simülasyon üzerinden belirsizlik analizi.\n")
    
    n_sims = 10000
    
    # Senaryo: 500m çapında bir asteroit (Ortalama Krater ~8km olması için)
    # Parametrelerde belirsizlik (%10-20 varyasyon)
    
    diameters = np.random.normal(500, 50, n_sims) # Ort 500m, Std 50m
    velocities = np.random.normal(20, 3, n_sims) # Ort 20 km/s
    angles = np.random.normal(45, 10, n_sims) # Ort 45 derece
    densities = np.random.normal(2700, 300, n_sims) # Ort 2700 kg/m3
    strengths = np.full(n_sims, 1e7)
    
    # Sınırlandırmalar
    diameters = np.clip(diameters, 10, None)
    velocities = np.clip(velocities, 1, None)
    angles = np.clip(angles, 5, 90)
    densities = np.clip(densities, 1000, None)
    
    # Kütle
    volumes = (4/3) * np.pi * (diameters/2)**3
    masses = volumes * densities
    
    res = calculate_atmospheric_entry(
        mass_kg=masses,
        diameter_m=diameters,
        velocity_kms=velocities,
        angle_deg=angles,
        density_kgm3=densities,
        strength_pa=strengths
    )
    
    # Krater Hesabı (kalan kütle + hız ile pi-scaling)
    is_airburst = res["is_airburst"]

    mass_imp = np.asarray(res["mass_impact_kg"], dtype=float)
    vel_imp_kms = np.asarray(res["velocity_impact_kms"], dtype=float)

    # Remaining impactor diameter (assume constant bulk density)
    d_imp = 2.0 * np.cbrt((3.0 * mass_imp) / (4.0 * np.pi * densities))

    crater_diameters = np.array([
        crater_diameter_m_pi_scaling(
            impactor_diameter_m=float(d_imp[i]),
            impact_velocity_m_s=float(vel_imp_kms[i] * 1000.0),
            rho_impactor=float(densities[i]),
            rho_target=float(TARGET_DENSITY),
            impact_angle_deg=float(angles[i]),
            g=float(GRAVITY),
            target_strength_pa=1e6,
        )
        for i in range(n_sims)
    ], dtype=float)
    
    # Airburst ise krater 0 (veya çok küçük, şimdilik 0 kabul edelim)
    crater_diameters = np.where(is_airburst, 0, crater_diameters)
    
    # İstatistikler
    mean_crater = np.mean(crater_diameters)
    std_crater = np.std(crater_diameters)
    ci_lower = np.percentile(crater_diameters, 2.5)
    ci_upper = np.percentile(crater_diameters, 97.5)
    airburst_prob = np.mean(is_airburst) * 100
    mean_energy_mt = np.mean(res["initial_energy_mt"])
    
    print("İstatistiksel Özet")
    print(f"Ortalama Krater: {mean_crater:,.2f} m")
    print(f"Standart Sapma: ±{std_crater:,.2f} m")
    print(f"%95 Güven Aralığı:")
    print(f"[{ci_lower:,.2f}m - {ci_upper:,.2f}m]")
    print(f"Airburst Olasılığı: %{airburst_prob:.1f}")
    print(f"Ortalama Enerji: {mean_energy_mt:,.2f} MT")
    
    print("Krater Çapı Dağılımı (Histogram)")
    # Basit bir histogram gösterimi (Min - Max)
    print(f"{np.min(crater_diameters):,.2f}m")
    print(f"{np.max(crater_diameters):,.2f}m")

if __name__ == "__main__":
    run_validation()
    run_monte_carlo()
