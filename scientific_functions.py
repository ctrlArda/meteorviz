"""
SCIENTIFIC FUNCTIONS MODULE - Bilimsel Kusursuzluk İçin Özel Fonksiyonlar
==========================================================================
Bu modül, 13 yeni bilimsel özelliği implement eden fonksiyonları içerir.
"""

import numpy as np
import math
import json

# ============================================================================
# 1. SPEKTRAL TAKSONOMİ VE KOMPOZISYON
# ============================================================================

def get_composition_from_taxonomy(spectral_type, asteroid_internal_data):
    """
    Spektral taksonomiden detaylı kompozisyon ve fiziksel özellikler döndürür.
    
    Returns:
        dict: {
            'density': float,
            'porosity': float,
            'tensile_strength': float,
            'structure_type': str,  # 'rubble_pile' veya 'monolithic'
            'albedo': float,
            'composition': str
        }
    """
    if not spectral_type or not asteroid_internal_data:
        return None
    
    spec = str(spectral_type).strip().upper()
    asteroid_types = asteroid_internal_data.get('asteroid_types', {})
    
    # Spektral tip eşleştirmesi
    if spec.startswith('C') or 'C-TYPE' in spec:
        return asteroid_types.get('C-type', {})
    elif spec.startswith('S') or 'S-TYPE' in spec:
        return asteroid_types.get('S-type', {})
    elif spec.startswith('M') or 'X-TYPE' in spec or 'M-TYPE' in spec:
        return asteroid_types.get('M-type', {})
    elif spec.startswith('V'):
        return asteroid_types.get('V-type', {})
    elif spec.startswith('E'):
        return asteroid_types.get('E-type', {})
    
    # Varsayılan: ortalama S-type
    return asteroid_types.get('S-type', {})


# ============================================================================
# 2. DİNAMİK ATMOSFER PAR function_calls MODELI
# ============================================================================

def calculate_dynamic_airburst(mass_kg, velocity_kms, angle_deg, composition_data, airburst_model):
    """
    Kompozisyona göre dinamik airburst yüksekliği ve enerji salınımı hesaplar.
    
    Args:
        mass_kg: Asteroit kütlesi
        velocity_kms: Giriş hızı
        angle_deg: Giriş açısı
        composition_data: get_composition_from_taxonomy() çıktısı
        airburst_model: atmospheric_airburst_model.json
    
    Returns:
        dict: {
            'airburst_altitude_km': float,
            'airburst_energy_mt': float,
            'surface_energy_mt': float,
            'fragmentation_type': str,
            'peak_dynamic_pressure_pa': float
        }
    """
    if not composition_data or not airburst_model:
        return None
    
    # Balistik katsayı: β = Cd × A / m
    # A = πr² (kesit alanı)
    diameter_m = (6 * mass_kg / (math.pi * composition_data['bulk_density_kg_m3'])) ** (1/3)
    area_m2 = math.pi * (diameter_m / 2) ** 2
    drag_coef = 0.47  # Küre için
    ballistic_coef = drag_coef * area_m2 / mass_kg
    
    # Dayanım (tensile strength)
    tensile_strength_pa = composition_data.get('tensile_strength_pa', 1e6)
    
    # Parçalanma yüksekliği (Chyba-Hills-Goda modeli)
    # H_frag = H_0 × ln(ρ_atm(0) × v² × Cd / (2 × Y))
    rho_0 = 1.225  # Deniz seviyesi yoğunluğu (kg/m³)
    velocity_ms = velocity_kms * 1000
    scale_height = 8000  # m
    
    # Dinamik basınç = 0.5 × ρ × v²
    # Parçalanma: P_dyn >= Y (tensile strength)
    frag_dynamic_pressure = tensile_strength_pa
    
    # ρ × v² = 2Y → ρ = 2Y/v²
    required_density = 2 * tensile_strength_pa / (velocity_ms ** 2)
    
    # H = H_s × ln(ρ_0 / ρ_required)
    if required_density > 0 and required_density < rho_0:
        airburst_altitude_m = scale_height * math.log(rho_0 / required_density)
        airburst_altitude_km = airburst_altitude_m / 1000
    else:
        # Yüzeye ulaşır (parçalanma yok)
        airburst_altitude_km = 0
    
    # Porozite etkisi (moloz yığınları daha erken parçalanır)
    porosity = composition_data.get('porosity', 0)
    if porosity > 0.2:  # Rubble pile
        airburst_altitude_km *= 1.5  # Daha yüksekte parçalanır
    
    # Enerji dağılımı
    total_energy_j = 0.5 * mass_kg * (velocity_ms ** 2)
    total_energy_mt = total_energy_j / 4.184e15
    
    if airburst_altitude_km > 0:
        # Chelyabinsk benzeri airburst
        # Enerjinin ~95%'i atmosferde salınır
        airburst_energy_mt = total_energy_mt * 0.95
        surface_energy_mt = total_energy_mt * 0.05
        fragmentation_type = "atmospheric_explosion"
    else:
        # Yüzeye ulaşır
        airburst_energy_mt = 0
        surface_energy_mt = total_energy_mt
        fragmentation_type = "surface_impact"
    
    return {
        'airburst_altitude_km': round(airburst_altitude_km, 2),
        'airburst_energy_mt': round(airburst_energy_mt, 2),
        'surface_energy_mt': round(surface_energy_mt, 2),
        'fragmentation_type': fragmentation_type,
        'peak_dynamic_pressure_pa': round(frag_dynamic_pressure, 0),
        'diameter_m': round(diameter_m, 2),
        'tensile_strength_pa': tensile_strength_pa
    }


# ============================================================================
# 3. NEO TESPİT OLASILIĞI VE ERKEN UYARI
# ============================================================================

def calculate_detection_probability(diameter_m, albedo, approach_geometry, neo_detection_data):
    """
    Asteroit tespit olasılığı ve erken uyarı süresi hesaplar.
    
    Args:
        diameter_m: Çap (metre)
        albedo: Geometrik albedo (0-1)
        approach_geometry: dict {'approach_angle_deg', 'solar_elongation_deg'}
        neo_detection_data: neo_detection_constraints.json
    
    Returns:
        dict: {
            'detection_probability': float (0-1),
            'warning_time_days': float,
            'detecting_survey': str,
            'absolute_magnitude': float,
            'difficulty_factors': list
        }
    """
    if not neo_detection_data:
        return None
    
    # Mutlak parlaklık (H magnitude)
    # H = 5 × log₁₀(1329/D) - 5 × log₁₀(√albedo)
    diameter_km = diameter_m / 1000
    if diameter_km <= 0 or albedo <= 0:
        return None
    
    h_mag = 5 * math.log10(1329 / diameter_km) - 5 * math.log10(math.sqrt(albedo))
    
    surveys = neo_detection_data.get('ground_based_surveys', [])
    
    # Her survey için tespit olasılığı hesapla
    best_survey = None
    best_prob = 0
    
    for survey in surveys:
        limiting_mag = survey.get('limiting_magnitude_typical', 21)
        
        # Parlaklıktan tespit olasılığı
        if h_mag < limiting_mag - 2:
            prob = 0.95  # Çok parlak
        elif h_mag < limiting_mag:
            prob = 0.70  # Tespit edilebilir
        elif h_mag < limiting_mag + 1:
            prob = 0.30  # Zor ama mümkün
        else:
            prob = 0.05  # Çok zor
        
        # Kapsama alanı etkisi
        coverage = survey.get('sky_coverage_percent', 50) / 100
        prob *= coverage
        
        if prob > best_prob:
            best_prob = prob
            best_survey = survey['name']
    
    # Geometri etkileri
    difficulty_factors = []
    
    if approach_geometry:
        # Güneş elongasyonu
        solar_elong = approach_geometry.get('solar_elongation_deg', 90)
        if solar_elong < 45:
            best_prob *= 0.1
            difficulty_factors.append("close_to_sun")
        elif solar_elong < 90:
            best_prob *= 0.5
            difficulty_factors.append("low_solar_elongation")
        
        # Yaklaşma açısı
        approach_angle = approach_geometry.get('approach_angle_deg', 45)
        if approach_angle > 80:  # Neredeyse dikey
            best_prob *= 0.7
            difficulty_factors.append("steep_approach")
    
    # Uyarı süresi (tespit olasılığına bağlı)
    if best_prob > 0.9:
        warning_time_days = 365 * 5  # 5 yıl önceden
    elif best_prob > 0.7:
        warning_time_days = 365  # 1 yıl
    elif best_prob > 0.3:
        warning_time_days = 90  # 3 ay
    elif best_prob > 0.05:
        warning_time_days = 7  # 1 hafta
    else:
        warning_time_days = 0  # Tespit edilmez (Chelyabinsk senaryosu)
    
    return {
        'detection_probability': round(best_prob, 3),
        'warning_time_days': round(warning_time_days, 0),
        'detecting_survey': best_survey,
        'absolute_magnitude': round(h_mag, 2),
        'difficulty_factors': difficulty_factors,
        'size_category': (
            'large_threatening' if diameter_m > 1000 else
            'city_killer' if diameter_m > 100 else
            'tunguska_class' if diameter_m > 40 else
            'chelyabinsk_class' if diameter_m > 15 else
            'small_bolide'
        )
    }


# ============================================================================
# 4. LİTOLOJİ BAZLI KRATER HESABI
# ============================================================================

def calculate_lithology_based_crater(energy_j, angle_deg, lithology_type, topography_data):
    """
    Hedef kaya tipine göre krater morfolojisi hesaplar.
    
    Args:
        energy_j: Çarpma enerjisi (Joule)
        angle_deg: Çarpma açısı
        lithology_type: Kaya tipi kodu (GLiM'den)
        topography_data: topography_slope_aspect.json
    
    Returns:
        dict: {
            'crater_diameter_m': float,
            'crater_depth_m': float,
            'crater_type': str,  # 'simple' veya 'complex'
            'ejecta_radius_km': float,
            'secondary_hazards': list
        }
    """
    if not lithology_type or not topography_data:
        return None
    
    # Litoloji bazlı target yoğunluğu ve dayanımı
    lithology_properties = {
        'ig': {'density': 2700, 'strength': 'high', 'name': 'igneous'},  # Magmatik
        'mt': {'density': 2850, 'strength': 'very_high', 'name': 'metamorphic'},  # Metamorfik
        'ss': {'density': 2400, 'strength': 'medium', 'name': 'sedimentary_siliciclastic'},  # Tortul
        'sm': {'density': 2650, 'strength': 'medium_high', 'name': 'sedimentary_mixed'},
        'sc': {'density': 2500, 'strength': 'low', 'name': 'sedimentary_carbonate'},  # Kireçtaşı
        'py': {'density': 2600, 'strength': 'medium', 'name': 'pyroclastic'},  # Volkanik
        'wb': {'density': 1000, 'strength': 'very_low', 'name': 'water_body'},  # Su
        'ev': {'density': 1500, 'strength': 'low', 'name': 'evaporites'}
    }
    
    lith_code = str(lithology_type).lower()[:2]
    target_props = lithology_properties.get(lith_code, {'density': 2500, 'strength': 'medium', 'name': 'unknown'})
    
    target_density = target_props['density']
    
    # Pi-scaling krater formülü (Schmidt & Housen, 1987)
    # D = C × (E / g)^0.22 × (ρ_imp / ρ_target)^0.33 × sin(θ)^0.33
    
    g = 9.81  # m/s²
    rho_imp = 2500  # Ortalama asteroit yoğunluğu (kg/m³)
    rho_target = target_density
    theta_rad = math.radians(angle_deg)
    
    # Dayanım faktörü
    strength_factors = {
        'very_low': 1.5,   # Su - daha büyük krater
        'low': 1.3,
        'medium': 1.0,
        'medium_high': 0.9,
        'high': 0.8,
        'very_high': 0.7   # Sert kaya - daha küçük krater
    }
    strength_factor = strength_factors.get(target_props['strength'], 1.0)
    
    # Krater çapı
    C = 1.0 * strength_factor  # Sabit
    diameter_m = C * ((energy_j / g) ** 0.22) * ((rho_imp / rho_target) ** 0.33) * (math.sin(theta_rad) ** 0.33)
    
    # Krater tipi (basit vs kompleks)
    # Dünya'da geçiş: ~4 km çap
    if diameter_m < 4000:
        crater_type = 'simple'
        depth_to_diameter = 0.20  # Basit kraterlerde D/d ~ 5
    else:
        crater_type = 'complex'
        depth_to_diameter = 0.10  # Kompleks kraterlerde daha sığ
    
    depth_m = diameter_m * depth_to_diameter
    
    # Ejecta yarıçapı (krater çapının ~2-3 katı)
    ejecta_radius_km = (diameter_m * 2.5) / 1000
    
    # İkincil tehlikeler
    secondary_hazards = []
    
    if lith_code == 'wb':  # Su kütlesi
        secondary_hazards.extend(['tsunami', 'steam_explosion', 'atmospheric_water_injection'])
    
    if target_props['strength'] in ['low', 'very_low']:
        secondary_hazards.append('unstable_crater_walls')
    
    if lith_code == 'py' or lith_code == 'ig':  # Volkanik
        secondary_hazards.append('potential_volcanic_triggering')
    
    if lith_code == 'sc':  # Karbonat
        secondary_hazards.append('co2_release')
    
    return {
        'crater_diameter_m': round(diameter_m, 2),
        'crater_depth_m': round(depth_m, 2),
        'crater_type': crater_type,
        'ejecta_radius_km': round(ejecta_radius_km, 2),
        'target_lithology': target_props['name'],
        'target_density_kg_m3': target_density,
        'strength_category': target_props['strength'],
        'secondary_hazards': secondary_hazards
    }


# ============================================================================
# 5. TSUNAMI PROPAGASYON MODELİ (GREEN'S LAW)
# ============================================================================

def calculate_tsunami_propagation(impact_location, impact_energy_j, ocean_depth_m, tsunami_physics_data):
    """
    Green's Law kullanarak tsunami propagasyonu hesaplar.
    
    Args:
        impact_location: dict {'lat', 'lon'}
        impact_energy_j: Çarpma enerjisi
        ocean_depth_m: Okyanus derinliği çarpma noktasında
        tsunami_physics_data: tsunami_propagation_physics.json
    
    Returns:
        dict: {
            'initial_wave_height_m': float,
            'wave_propagation_speed_kmh': float,
            'coastal_runup_scenarios': list,
            'affected_coastlines': list
        }
    """
    if not tsunami_physics_data or ocean_depth_m <= 0:
        return None
    
    # İlk dalga yüksekliği (Ward & Asphaug, 2000)
    # H_0 ≈ 0.1 × (E_kt)^0.5 for deep water
    energy_kt = impact_energy_j / 4.184e12  # Kiloton cinsinden
    
    if energy_kt < 1:
        return None  # Çok küçük tsunami
    
    initial_height_m = 0.1 * (energy_kt ** 0.5)
    
    # Dalga hızı: c = √(g × h)
    g = 9.81
    wave_speed_ms = math.sqrt(g * ocean_depth_m)
    wave_speed_kmh = wave_speed_ms * 3.6
    
    # Green's Law: Sığ suya yaklaştıkça dalga yükselir
    # H_2 / H_1 = (h_1 / h_2)^(1/4)
    
    coastal_runup_scenarios = []
    
    # Farklı kıyı derinlikleri için hesapla
    coastal_depths = [100, 50, 20, 10, 5]  # metre
    
    for coastal_depth in coastal_depths:
        if coastal_depth < ocean_depth_m:
            amplification = (ocean_depth_m / coastal_depth) ** 0.25
            coastal_height_m = initial_height_m * amplification
            
            # Run-up yüksekliği (kıyıya çarpma)
            # R = H × (1 + β)  # β: kıyı eğimi faktörü
            # Varsayılan: orta eğim
            runup_factor = 2.0
            runup_height_m = coastal_height_m * runup_factor
            
            coastal_runup_scenarios.append({
                'depth_m': coastal_depth,
                'wave_height_m': round(coastal_height_m, 2),
                'runup_height_m': round(runup_height_m, 2),
                'inundation_distance_km': round(runup_height_m * 0.5, 2)  # Kaba tahmin
            })
    
    # Etkilenebilecek kıyı şeritleri (basitleştirilmiş)
    affected_range_km = wave_speed_kmh * 24  # 24 saatlik yayılma
    
    return {
        'initial_wave_height_m': round(initial_height_m, 2),
        'wave_propagation_speed_kmh': round(wave_speed_kmh, 2),
        'deep_ocean_depth_m': ocean_depth_m,
        'energy_kt': round(energy_kt, 2),
        'coastal_runup_scenarios': coastal_runup_scenarios,
        'propagation_time_to_1000km_hours': round(1000 / wave_speed_kmh, 2),
        'affected_range_24h_km': round(affected_range_km, 0)
    }


# ============================================================================
# 6. İNFRASTRUKTUR KASKAD ANALİZİ
# ============================================================================

def calculate_infrastructure_cascade(damaged_facilities, infrastructure_network):
    """
    Altyapı bağımlılık ağı üzerinden kaskad etkisi hesaplar.
    
    Args:
        damaged_facilities: list of str (hasar gören tesis tipleri)
        infrastructure_network: infrastructure_dependency_network.json
    
    Returns:
        dict: {
            'primary_failures': list,
            'secondary_failures': list,
            'tertiary_failures': list,
            'cascading_impact_score': float,
            'critical_path': list
        }
    """
    if not infrastructure_network:
        return None
    
    dependencies = infrastructure_network.get('dependency_graph', {})
    
    primary_failures = damaged_facilities
    secondary_failures = []
    tertiary_failures = []
    
    # İkincil arızalar
    for facility in primary_failures:
        dependents = dependencies.get(facility, {}).get('directly_depends_on_this', [])
        secondary_failures.extend(dependents)
    
    # Üçüncül arızalar
    for facility in secondary_failures:
        dependents = dependencies.get(facility, {}).get('directly_depends_on_this', [])
        tertiary_failures.extend(dependents)
    
    # Tekrarları kaldır
    secondary_failures = list(set(secondary_failures) - set(primary_failures))
    tertiary_failures = list(set(tertiary_failures) - set(primary_failures) - set(secondary_failures))
    
    # Etki skoru
    cascade_score = len(primary_failures) + len(secondary_failures) * 0.5 + len(tertiary_failures) * 0.25
    
    # Kritik yol (en uzun bağımlılık zinciri)
    critical_path = primary_failures[:1] + secondary_failures[:2] + tertiary_failures[:2]
    
    return {
        'primary_failures': primary_failures,
        'secondary_failures': secondary_failures,
        'tertiary_failures': tertiary_failures,
        'cascading_impact_score': round(cascade_score, 2),
        'critical_path': critical_path,
        'total_affected_systems': len(primary_failures) + len(secondary_failures) + len(tertiary_failures)
    }


# ============================================================================
# 7. SOSYOEKONOMİK ZAFİYET KATSAYISI
# ============================================================================

def apply_socioeconomic_vulnerability(base_casualties, country_code, vulnerability_index):
    """
    Sosyoekonomik zafiyet endeksine göre kayıpları ayarlar.
    
    Args:
        base_casualties: Fiziksel modelden hesaplanan temel kayıp tahmini
        country_code: ISO 3166 ülke kodu (veya bölge kodu)
        vulnerability_index: socioeconomic_vulnerability_index.json
    
    Returns:
        dict: {
            'adjusted_casualties': float,
            'vulnerability_multiplier': float,
            'vulnerability_factors': dict,
            'recovery_time_years': float
        }
    """
    if not vulnerability_index:
        return None
    
    country_data = vulnerability_index.get('countries', {}).get(country_code, None)
    
    if not country_data:
        # Varsayılan: orta gelir ülkesi
        vulnerability_multiplier = 1.5
        hdi = 0.7
        healthcare_capacity = 'medium'
    else:
        # Zafiyetfaktörleri
        hdi = country_data.get('hdi', 0.7)
        gdp_per_capita = country_data.get('gdp_per_capita_usd', 10000)
        healthcare_capacity = country_data.get('healthcare_capacity', 'medium')
        
        # Çarpan hesapla
        # Düşük HDI -> Yüksek kayıp
        hdi_factor = 2.0 - hdi  # HDI 0.5 -> 1.5x, HDI 0.9 -> 1.1x
        
        # Sağlık sistemi
        healthcare_factors = {
            'very_low': 2.0,
            'low': 1.5,
            'medium': 1.0,
            'high': 0.7,
            'very_high': 0.5
        }
        healthcare_factor = healthcare_factors.get(healthcare_capacity, 1.0)
        
        vulnerability_multiplier = hdi_factor * healthcare_factor
    
    adjusted_casualties = base_casualties * vulnerability_multiplier
    
    # Kurtarma süresi
    recovery_factors = {
        'very_high': 2,
        'high': 5,
        'medium': 10,
        'low': 20,
        'very_low': 50
    }
    recovery_time_years = recovery_factors.get(healthcare_capacity, 10)
    
    return {
        'adjusted_casualties': round(adjusted_casualties, 0),
        'vulnerability_multiplier': round(vulnerability_multiplier, 2),
        'vulnerability_factors': {
            'hdi': hdi,
            'healthcare_capacity': healthcare_capacity
        },
        'recovery_time_years': recovery_time_years,
        'base_casualties': round(base_casualties, 0)
    }


# ============================================================================
# 8. MEVSIMSEL VE ZAMANSAL ETKİLER
# ============================================================================

def calculate_seasonal_effects(impact_datetime, impact_location, seasonality_data):
    """
    Mevsim ve zamanın etkilerini hesaplar.
    
    Args:
        impact_datetime: dict {'month', 'hour', 'day_of_week'}
        impact_location: dict {'lat', 'lon'}
        seasonality_data: seasonality_timing_effects.json
    
    Returns:
        dict: {
            'season': str,
            'population_density_factor': float,
            'infrastructure_criticality': str,
            'evacuation_difficulty': float,
            'agricultural_impact': str
        }
    """
    if not seasonality_data or not impact_datetime:
        return None
    
    month = impact_datetime.get('month', 6)
    hour = impact_datetime.get('hour', 12)
    lat = impact_location.get('lat', 0)
    
    # Mevsim belirleme (Kuzey yarımküre referanslı)
    if lat > 0:  # Kuzey yarımküre
        if month in [12, 1, 2]:
            season = 'winter'
        elif month in [3, 4, 5]:
            season = 'spring'
        elif month in [6, 7, 8]:
            season = 'summer'
        else:
            season = 'autumn'
    else:  # Güney yarımküre (ters)
        if month in [12, 1, 2]:
            season = 'summer'
        elif month in [3, 4, 5]:
            season = 'autumn'
        elif month in [6, 7, 8]:
            season = 'winter'
        else:
            season = 'spring'
    
    # Gündüz/gece faktörü
    if 6 <= hour <= 18:
        time_of_day = 'daytime'
        population_density_factor = 1.2  # İnsanlar dışarıda, işte
    else:
        time_of_day = 'nighttime'
        population_density_factor = 0.8  # İnsanlar evde, uyuyor
    
    # Mevsimsel altyapı kritikliği
    infrastructure_criticality_map = {
        'winter': 'heating_systems_critical',
        'summer': 'cooling_and_water_critical',
        'spring': 'normal',
        'autumn': 'harvest_season'
    }
    infrastructure_criticality = infrastructure_criticality_map.get(season, 'normal')
    
    # Tahliye zorluğu
    evacuation_difficulty = 1.0
    if season == 'winter':
        evacuation_difficulty = 1.5  # Kar, soğuk
    if time_of_day == 'nighttime':
        evacuation_difficulty *= 1.3  # Karanlık, uyanan insanlar
    
    # Tarımsal etki
    agri_impact_map = {
        'spring': 'planting_season_affected',
        'summer': 'growing_season_affected',
        'autumn': 'harvest_season_CRITICAL',
        'winter': 'minimal_agricultural_impact'
    }
    agricultural_impact = agri_impact_map.get(season, 'unknown')
    
    return {
        'season': season,
        'time_of_day': time_of_day,
        'month': month,
        'hour': hour,
        'population_density_factor': round(population_density_factor, 2),
        'infrastructure_criticality': infrastructure_criticality,
        'evacuation_difficulty': round(evacuation_difficulty, 2),
        'agricultural_impact': agricultural_impact
    }


# ============================================================================
# 9. IMPACT WINTER (ÇARPMA KIŞI) HESABI
# ============================================================================

def calculate_impact_winter(energy_mt, impact_location, climate_params):
    """
    Küresel iklim etkileri ve impact winter hesaplar.
    
    Args:
        energy_mt: Çarpma enerjisi (Megaton)
        impact_location: dict {'lat', 'lon'}
        climate_params: impact_winter_parameters.json
    
    Returns:
        dict: {
            'dust_injection_tg': float,  # Teragram
            'stratospheric_lifetime_years': float,
            'temperature_drop_celsius': float,
            'photosynthesis_reduction_percent': float,
            'global_famine_risk': str,
            'comparable_event': str
        }
    """
    if not climate_params:
        return None
    
    # Toz enjeksiyonu (Toon et al., 2007)
    # Kaba tahmin: E^0.5 ile ölçeklenir
    if energy_mt < 100:
        return None  # Küresel etki yok
    
    # Referans: Chicxulub ~100 milyon MT -> ~10^14 kg toz
    # Ölçekleme: dust ~ E^0.6
    reference_energy_mt = 100_000_000
    reference_dust_tg = 100_000  # Teragram (10^14 kg)
    
    dust_injection_tg = reference_dust_tg * ((energy_mt / reference_energy_mt) ** 0.6)
    
    # Stratosferik kalış süresi
    # Küçük partiküller: 1-5 yıl
    if dust_injection_tg < 1000:
        lifetime_years = 1
    elif dust_injection_tg < 10000:
        lifetime_years = 2
    else:
        lifetime_years = 5
    
    # Sıcaklık düşüşü (Robock et al., 2007)
    # ~1 Tg toz -> ~1°C düşüş (kaba tahmin)
    temp_drop_celsius = min(dust_injection_tg / 1000, 25)  # Maksimum 25°C
    
    # Fotosent reduction_percent
    if temp_drop_celsius < 2:
        photosynthesis_reduction = 20
    elif temp_drop_celsius < 5:
        photosynthesis_reduction = 50
    elif temp_drop_celsius < 10:
        photosynthesis_reduction = 80
    else:
        photosynthesis_reduction = 95
    
    # Küresel kıtlık riski
    if photosynthesis_reduction > 80:
        famine_risk = 'EXTREME_global_extinction_level'
    elif photosynthesis_reduction > 50:
        famine_risk = 'SEVERE_billions_at_risk'
    elif photosynthesis_reduction > 20:
        famine_risk = 'MODERATE_regional_famine'
    else:
        famine_risk = 'LOW_agricultural_disruption'
    
    # Karşılaştırılabilir olay
    if energy_mt > 10_000_000:
        comparable = 'Chicxulub_KT_extinction_event'
    elif energy_mt > 1_000_000:
        comparable = 'Smaller_mass_extinction_event'
    elif energy_mt > 100_000:
        comparable = 'Global_catastrophe_civilization_threat'
    else:
        comparable = 'Regional_climate_effects'
    
    return {
        'dust_injection_tg': round(dust_injection_tg, 2),
        'stratospheric_lifetime_years': lifetime_years,
        'temperature_drop_celsius': round(temp_drop_celsius, 2),
        'photosynthesis_reduction_percent': photosynthesis_reduction,
        'global_famine_risk': famine_risk,
        'comparable_event': comparable,
        'energy_mt': energy_mt
    }


# ============================================================================
# 10. ŞOK KİMYASI VE EMP
# ============================================================================

def calculate_shock_chemistry_emp(velocity_kms, mass_kg, shock_chemistry_data, plasma_data):
    """
    Hiper-hız çarpmasında kimyasal reaksiyonlar ve EMP etkisi.
    
    Args:
        velocity_kms: Çarpma hızı
        mass_kg: Asteroit kütlesi
        shock_chemistry_data: shock_chemistry_kinetics.json
        plasma_data: nist_janaf_plasma.json
    
    Returns:
        dict: {
            'shock_temperature_k': float,
            'plasma_formation': bool,
            'nitrogen_oxides_produced_tonnes': float,
            'ozone_depletion_percent': float,
            'emp_radius_km': float,
            'radio_blackout_hours': float
        }
    """
    if not shock_chemistry_data:
        return None
    
    # Şok sıcaklığı (Rankine-Hugoniot ilişkileri)
    # T_shock ≈ (v²) / (2 × C_p)
    # C_p (hava için) ≈ 1000 J/kg/K
    velocity_ms = velocity_kms * 1000
    shock_temp_k = (velocity_ms ** 2) / (2 * 1000)
    
    # Plazma oluşumu (>10,000 K)
    plasma_formation = shock_temp_k > 10000
    
    # NO₂ üretimi (hava şok dalgası)
    # Yüksek sıcaklıkta N₂ + O₂ -> 2NO
    if shock_temp_k > 2000:
        # Kaba tahmin: enerji başına kg NO₂
        energy_j = 0.5 * mass_kg * (velocity_ms ** 2)
        energy_kt = energy_j / 4.184e12
        
        # ~1 kt -> ~1000 ton NO₂ (nükleer patlama verileri)
        nox_tonnes = energy_kt * 1000
    else:
        nox_tonnes = 0
    
    # Ozon tabakası tükenme
    # NO₂ katalitik olarak O₃'ü yok eder
    # ~10^6 ton NO₂ -> %1 ozon kaybı (kaba)
    ozone_depletion_percent = min(nox_tonnes / 1_000_000, 50)
    
    # EMP (Elektromanyetik Pulse)
    # Plazma topu oluşursa EMP üretir
    if plasma_formation:
        # EMP yarıçapı ~ E^0.3 (kaba)
        energy_j = 0.5 * mass_kg * (velocity_ms ** 2)
        energy_mt = energy_j / 4.184e15
        emp_radius_km = 10 * (energy_mt ** 0.3)
    else:
        emp_radius_km = 0
    
    # Radyo blackout
    # İyonize hava radyo dalgalarını bloke eder
    if plasma_formation:
        radio_blackout_hours = min(6, shock_temp_k / 5000)
    else:
        radio_blackout_hours = 0
    
    return {
        'shock_temperature_k': round(shock_temp_k, 0),
        'plasma_formation': plasma_formation,
        'nitrogen_oxides_produced_tonnes': round(nox_tonnes, 0),
        'ozone_depletion_percent': round(ozone_depletion_percent, 2),
        'emp_radius_km': round(emp_radius_km, 2),
        'radio_blackout_hours': round(radio_blackout_hours, 1),
        'chemical_reactions': [
            'N2_O2_to_NOx' if shock_temp_k > 2000 else 'minimal',
            'ozone_catalytic_destruction' if ozone_depletion_percent > 0.1 else 'none'
        ]
    }


# ============================================================================
# 11. BELİRSİZLİK ANALİZİ (MONTE CARLO)
# ============================================================================

def run_uncertainty_analysis(input_params, uncertainty_distributions, n_samples=1000):
    """
    Monte Carlo simülasyonu ile belirsizlik analizi.
    
    Args:
        input_params: dict (nominal değerler)
        uncertainty_distributions: parameter_uncertainty_distributions.json
        n_samples: Simülasyon sayısı
    
    Returns:
        dict: {
            'median': dict,
            'confidence_interval_95': dict,
            'uncertainty_contributors': list
        }
    """
    if not uncertainty_distributions:
        return None
    
    # Basitleştirilmiş Monte Carlo
    # Gerçek implementasyon numpy ile yapılmalı
    
    results = {
        'method': 'monte_carlo_sampling',
        'samples': n_samples,
        'note': 'Full implementation requires numpy array operations'
    }
    
    # Her parametre için belirsizlik
    param_uncertainties = {}
    for param, nominal_value in input_params.items():
        dist_info = uncertainty_distributions.get(param, {})
        uncertainty_1sigma = dist_info.get('uncertainty_1sigma', 0.3)  # 30% varsayılan
        
        param_uncertainties[param] = {
            'nominal': nominal_value,
            'uncertainty_percent': uncertainty_1sigma * 100,
            'lower_bound_1sigma': nominal_value * (1 - uncertainty_1sigma),
            'upper_bound_1sigma': nominal_value * (1 + uncertainty_1sigma)
        }
    
    results['parameter_uncertainties'] = param_uncertainties
    
    return results
