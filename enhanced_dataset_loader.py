"""
ENHANCED SCIENTIFIC DATASETS LOADER
====================================
Utility module to load and query the 8 new scientific datasets.
Integrates with existing physics_engine.py and app.py

Author: Enhanced Dataset Integration
Date: 2026-02-01
"""

import json
import os
from pathlib import Path
from typing import Dict, Optional, Tuple, Any


class EnhancedDatasetLoader:
    """Load and query enhanced scientific datasets"""
    
    def __init__(self, datasets_dir: str = "datasets"):
        self.datasets_dir = Path(datasets_dir)
        self.data = {}
        self._load_all_datasets()
    
    def _load_all_datasets(self):
        """Load all 8 enhanced datasets"""
        dataset_files = {
            'asteroid_structure': 'asteroid_internal_structure.json',
            'airburst': 'atmospheric_airburst_model.json',
            'topography': 'topography_slope_aspect.json',
            'historical': 'historical_impact_damage_losses.json',
            'detection': 'neo_detection_constraints.json',
            'tsunami': 'tsunami_propagation_physics.json',
            'infrastructure': 'infrastructure_dependency_network.json',
            'vulnerability': 'socioeconomic_vulnerability_index.json'
        }
        
        for key, filename in dataset_files.items():
            filepath = self.datasets_dir / filename
            if filepath.exists():
                with open(filepath, 'r', encoding='utf-8') as f:
                    self.data[key] = json.load(f)
                print(f"✅ Loaded: {filename}")
            else:
                print(f"⚠️  Missing: {filename}")
                self.data[key] = None
    
    # ========== ASTEROID INTERNAL STRUCTURE ==========
    
    def get_asteroid_properties(self, asteroid_type: str) -> Dict:
        """
        Get asteroid physical properties by type
        
        Args:
            asteroid_type: One of 'C-type', 'S-type', 'M-type', 'V-type', 'D-type', 'X-type'
        
        Returns:
            Dictionary with grain_density, bulk_density, porosity, strength, etc.
        """
        if not self.data['asteroid_structure']:
            return self._fallback_asteroid_properties(asteroid_type)
        
        types = self.data['asteroid_structure']['asteroid_types']
        return types.get(asteroid_type, types.get('S-type'))
    
    def calculate_effective_density(self, grain_density: float, porosity_percent: float) -> float:
        """Calculate effective bulk density from grain density and porosity"""
        return grain_density * (1 - porosity_percent / 100)
    
    def get_fragmentation_multiplier(self, internal_structure: str) -> float:
        """Get fragmentation energy multiplier for internal structure type"""
        if not self.data['asteroid_structure']:
            return 1.0
        
        models = self.data['asteroid_structure']['internal_structure_models']
        return models.get(internal_structure, {}).get('fragmentation_energy_multiplier', 1.0)
    
    def _fallback_asteroid_properties(self, asteroid_type: str) -> Dict:
        """Fallback values if dataset not loaded"""
        fallbacks = {
            'C-type': {'bulk_density_kg_m3': 1380, 'strength_mpa': 1.0},
            'S-type': {'bulk_density_kg_m3': 2700, 'strength_mpa': 10.0},
            'M-type': {'bulk_density_kg_m3': 5300, 'strength_mpa': 100.0},
        }
        return fallbacks.get(asteroid_type, fallbacks['S-type'])
    
    # ========== ATMOSPHERIC AIRBURST ==========
    
    def calculate_fragmentation_altitude(
        self, 
        velocity_km_s: float, 
        strength_mpa: float,
        atmospheric_density_func=None
    ) -> float:
        """
        Calculate altitude where asteroid fragments due to dynamic pressure
        
        Args:
            velocity_km_s: Entry velocity (km/s)
            strength_mpa: Material tensile strength (MPa)
            atmospheric_density_func: Function(altitude_km) -> density_kg_m3
        
        Returns:
            Fragmentation altitude in km
        """
        if not self.data['airburst']:
            return self._approximate_fragmentation_altitude(velocity_km_s, strength_mpa)
        
        # Dynamic pressure = 0.5 * rho * v^2
        # Fragments when dynamic_pressure >= strength
        strength_pa = strength_mpa * 1e6
        velocity_m_s = velocity_km_s * 1000
        
        # Search for altitude where P_dyn = strength
        for altitude_km in range(0, 100):
            if atmospheric_density_func:
                rho = atmospheric_density_func(altitude_km)
            else:
                # Exponential atmosphere approximation
                rho = 1.225 * (2.71828 ** (-altitude_km / 8.0))
            
            dynamic_pressure = 0.5 * rho * velocity_m_s ** 2
            
            if dynamic_pressure >= strength_pa:
                return altitude_km
        
        return 0  # Reaches ground
    
    def _approximate_fragmentation_altitude(self, velocity_km_s: float, strength_mpa: float) -> float:
        """Approximate fragmentation altitude using lookup table"""
        # Simple interpolation from dataset table
        if strength_mpa <= 0.5:
            return 70  # Weak comet
        elif strength_mpa <= 2.0:
            return 40  # Carbonaceous
        elif strength_mpa <= 20.0:
            return 30  # Ordinary chondrite
        elif strength_mpa <= 75.0:
            return 20  # Strong monolith
        else:
            return 10  # Iron
    
    def get_blast_altitude_factor(self, altitude_km: float) -> float:
        """Get blast wave attenuation factor for detonation altitude"""
        if not self.data['airburst']:
            return max(0.05, 2.0 * (30 / (altitude_km + 1)))
        
        factors = self.data['airburst']['energy_deposition_model']['blast_wave_altitude_scaling']['altitude_factors']
        
        # Interpolate
        for entry in factors:
            if altitude_km <= entry['altitude_km']:
                return entry.get('altitude_factor', entry.get('ground_burst_factor', 1.0))
        
        return 0.05  # Very high altitude
    
    # ========== TOPOGRAPHY & TSUNAMI ==========
    
    def get_tsunami_amplification(self, coastal_slope_percent: float) -> float:
        """Get tsunami height amplification factor from coastal slope"""
        if not self.data['topography']:
            return 1.0 + (5.0 / (coastal_slope_percent + 1))
        
        # Lookup from terrain classification
        terrain_classes = self.data['topography']['terrain_classification_by_slope']
        for terrain_type, props in terrain_classes.items():
            slope_range = props.get('slope_range_percent', [0, 999])
            if slope_range[0] <= coastal_slope_percent <= slope_range[1]:
                return props.get('tsunami_amplification', 1.0)
        
        return 1.0
    
    def calculate_greens_law_shoaling(
        self, 
        deep_ocean_height_m: float, 
        deep_depth_m: float, 
        coastal_depth_m: float
    ) -> float:
        """
        Apply Green's Law for tsunami shoaling
        H_final / H_initial = (h_initial / h_final)^(1/4)
        """
        amplification = (deep_depth_m / coastal_depth_m) ** 0.25
        return deep_ocean_height_m * amplification
    
    def calculate_tsunami_runup(
        self, 
        wave_height_m: float, 
        slope_percent: float, 
        roughness_factor: float = 1.0
    ) -> Tuple[float, float]:
        """
        Calculate tsunami run-up height and distance
        
        Returns:
            (run_up_height_m, inundation_distance_m)
        """
        slope_radians = (slope_percent / 100)  # Approximate for small angles
        run_up_height = wave_height_m * (1 / slope_radians) ** 0.5 * roughness_factor
        inundation_distance = run_up_height / slope_radians if slope_radians > 0 else 0
        return run_up_height, inundation_distance
    
    # ========== HISTORICAL VALIDATION ==========
    
    def get_historical_event(self, event_name: str) -> Optional[Dict]:
        """Get historical impact event data for validation"""
        if not self.data['historical']:
            return None
        
        events = self.data['historical']['modern_impact_events']
        for event in events:
            if event_name.lower() in event['event'].lower():
                return event
        
        return None
    
    def get_expected_casualties_by_size(self, diameter_m: float) -> Dict:
        """Get expected casualties from statistical frequency table"""
        if not self.data['historical']:
            return {'expected_casualties_per_event': 0, 'frequency_years': 1000}
        
        freq_table = self.data['historical']['statistical_impact_frequency']['frequency_table']
        
        # Find closest size
        closest = None
        min_diff = float('inf')
        for entry in freq_table:
            size = entry.get('diameter_m', entry.get('diameter_km', 1) * 1000)
            diff = abs(size - diameter_m)
            if diff < min_diff:
                min_diff = diff
                closest = entry
        
        return closest or {}
    
    # ========== DETECTION CONSTRAINTS ==========
    
    def calculate_detection_probability(
        self, 
        diameter_m: float, 
        albedo: float = 0.15, 
        solar_elongation_deg: float = 90
    ) -> float:
        """
        Calculate probability asteroid would be detected before impact
        
        Args:
            diameter_m: Asteroid diameter (meters)
            albedo: Surface reflectivity (0-1)
            solar_elongation_deg: Angular distance from Sun (degrees)
        
        Returns:
            Detection probability (0-1)
        """
        if not self.data['detection']:
            return self._simple_detection_probability(diameter_m)
        
        # Size-based completeness
        completeness_data = self.data['detection']['detection_probability_factors']['size_dependent_completeness']['data']
        
        base_probability = 0.001  # Default for very small
        for entry in completeness_data:
            size = entry.get('diameter_m', entry.get('diameter_km', 1) * 1000)
            if diameter_m <= size * 1.5:  # Within range
                base_probability = entry.get('completeness', 0.001)
                break
        
        # Solar elongation modifier
        elongation_factors = self.data['detection']['detection_probability_factors']['solar_elongation']['detection_probability']
        elongation_mod = 0.01
        if solar_elongation_deg >= 180:
            elongation_mod = 1.0
        elif solar_elongation_deg >= 120:
            elongation_mod = 0.95
        elif solar_elongation_deg >= 90:
            elongation_mod = 0.75
        elif solar_elongation_deg >= 60:
            elongation_mod = 0.15
        
        # Albedo modifier (dark asteroids harder to detect optically)
        albedo_mod = (albedo / 0.15) ** 0.5  # Normalized to typical S-type
        
        total_probability = base_probability * elongation_mod * albedo_mod
        return min(1.0, max(0.0, total_probability))
    
    def _simple_detection_probability(self, diameter_m: float) -> float:
        """Simple detection probability model"""
        if diameter_m >= 1000:
            return 0.95
        elif diameter_m >= 140:
            return 0.40
        elif diameter_m >= 50:
            return 0.025
        elif diameter_m >= 20:
            return 0.00025
        else:
            return 0.000005
    
    def estimate_warning_time_days(self, diameter_m: float, detection_prob: float) -> float:
        """Estimate warning time before impact if detected"""
        if detection_prob < 0.01:
            return 0  # Essentially no warning
        
        if not self.data['detection']:
            return diameter_m  # Rough approximation
        
        scenarios = self.data['detection']['warning_time_estimation']['scenarios']
        for scenario in scenarios:
            size = scenario.get('asteroid_size_m', scenario.get('asteroid_size_km', 1) * 1000)
            if diameter_m <= size * 1.5:
                return scenario.get('typical_warning_days', 1)
        
        return 365  # Large asteroids: long warning
    
    # ========== VULNERABILITY INDEX ==========
    
    def get_country_vulnerability(self, country_name: str) -> Dict:
        """Get vulnerability index for a country"""
        if not self.data['vulnerability']:
            return {'casualty_mult': 1.0, 'recovery_speed': 'moderate'}
        
        # Check pre-calculated database
        country_db = self.data['vulnerability'].get('country_vulnerability_database', {}).get('sample_data', [])
        for entry in country_db:
            if country_name.lower() in entry.get('country', '').lower():
                return entry
        
        # Default moderate vulnerability
        return {
            'hdi': 0.70,
            'vulnerability_index': 3.0,
            'casualty_mult': 1.5,
            'recovery_speed': 'moderate'
        }
    
    def calculate_casualty_multiplier(self, hdi: float, population_density: float) -> float:
        """
        Calculate casualty multiplier based on HDI and population density
        
        Args:
            hdi: Human Development Index (0-1)
            population_density: People per km²
        
        Returns:
            Casualty multiplier (0.5 = half casualties, 2.0 = double casualties)
        """
        # HDI effect: higher HDI = lower casualties
        hdi_factor = (0.85 / hdi) if hdi > 0.1 else 5.0
        
        # Density effect: higher density = more casualties (but with diminishing returns)
        density_factor = 1.0 + (population_density / 10000) ** 0.5
        
        # Combined (normalized to baseline = 1.0 for HDI=0.75, density=5000)
        multiplier = (hdi_factor * density_factor) / 1.5
        
        return max(0.3, min(10.0, multiplier))
    
    # ========== INFRASTRUCTURE CASCADE ==========
    
    def estimate_infrastructure_cascade_multiplier(
        self, 
        direct_casualties: int,
        infrastructure_destroyed: list
    ) -> float:
        """
        Estimate additional casualties from infrastructure cascade
        
        Args:
            direct_casualties: Immediate impact casualties
            infrastructure_destroyed: List of infrastructure types destroyed
        
        Returns:
            Total casualty multiplier (e.g., 2.5 means 2.5x direct casualties)
        """
        if not self.data['infrastructure']:
            return 1.0 + 0.1 * len(infrastructure_destroyed)
        
        # Check for critical infrastructure
        cascade_factor = 1.0
        
        if 'power' in infrastructure_destroyed:
            cascade_factor += 0.5  # Power causes major cascade
        if 'hospital' in infrastructure_destroyed:
            cascade_factor += 0.3  # Medical system failure
        if 'water' in infrastructure_destroyed:
            cascade_factor += 0.2  # Water system failure
        if 'telecom' in infrastructure_destroyed:
            cascade_factor += 0.1  # Communication loss
        
        # Multiple failures compound
        if len(infrastructure_destroyed) >= 3:
            cascade_factor *= 1.5  # System collapse
        
        return min(5.0, cascade_factor)  # Cap at 5x
    
    # ========== HELPER FUNCTIONS ==========
    
    def get_all_dataset_status(self) -> Dict[str, bool]:
        """Return status of all datasets (loaded or not)"""
        return {
            'Asteroid Internal Structure': self.data['asteroid_structure'] is not None,
            'Atmospheric Airburst Model': self.data['airburst'] is not None,
            'Topography Slope/Aspect': self.data['topography'] is not None,
            'Historical Damage Data': self.data['historical'] is not None,
            'NEO Detection Constraints': self.data['detection'] is not None,
            'Tsunami Propagation': self.data['tsunami'] is not None,
            'Infrastructure Dependencies': self.data['infrastructure'] is not None,
            'Socioeconomic Vulnerability': self.data['vulnerability'] is not None,
        }
    
    def print_dataset_summary(self):
        """Print summary of loaded datasets"""
        print("\n" + "="*60)
        print("ENHANCED SCIENTIFIC DATASETS - STATUS")
        print("="*60)
        
        status = self.get_all_dataset_status()
        loaded_count = sum(status.values())
        
        for name, loaded in status.items():
            icon = "✅" if loaded else "❌"
            print(f"{icon} {name}")
        
        print("="*60)
        print(f"Loaded: {loaded_count}/8 datasets")
        print("="*60 + "\n")


# ========== EXAMPLE USAGE ==========

if __name__ == "__main__":
    # Initialize loader
    loader = EnhancedDatasetLoader()
    loader.print_dataset_summary()
    
    # Example 1: Get asteroid properties
    print("\n--- Example 1: Asteroid Properties ---")
    c_type = loader.get_asteroid_properties('C-type')
    print(f"C-type asteroid:")
    print(f"  Bulk density: {c_type.get('bulk_density_kg_m3')} kg/m³")
    print(f"  Porosity: {c_type.get('porosity_percent')}%")
    print(f"  Strength: {c_type.get('strength_mpa')} MPa")
    
    # Example 2: Calculate fragmentation altitude (Chelyabinsk-like)
    print("\n--- Example 2: Fragmentation Altitude ---")
    frag_alt = loader.calculate_fragmentation_altitude(19.0, 1.0)
    print(f"19 km/s asteroid with 1 MPa strength fragments at: {frag_alt} km")
    print(f"(Chelyabinsk historical: 29.7 km)")
    
    # Example 3: Tsunami amplification
    print("\n--- Example 3: Tsunami Amplification ---")
    flat_coast = loader.get_tsunami_amplification(0.5)
    steep_coast = loader.get_tsunami_amplification(20.0)
    print(f"Flat coast (0.5% slope): {flat_coast}x amplification")
    print(f"Steep coast (20% slope): {steep_coast}x amplification")
    
    # Example 4: Detection probability
    print("\n--- Example 4: Detection Probability ---")
    chelyabinsk_detection = loader.calculate_detection_probability(
        diameter_m=19,
        albedo=0.15,
        solar_elongation_deg=20
    )
    print(f"Chelyabinsk-like asteroid: {chelyabinsk_detection*100:.3f}% detection probability")
    
    # Example 5: Vulnerability multiplier
    print("\n--- Example 5: Vulnerability by Country ---")
    usa = loader.get_country_vulnerability("USA")
    india = loader.get_country_vulnerability("India")
    print(f"USA casualty multiplier: {usa.get('casualty_mult')}x")
    print(f"India casualty multiplier: {india.get('casualty_mult')}x")
    
    # Example 6: Historical validation
    print("\n--- Example 6: Historical Event ---")
    chelyabinsk = loader.get_historical_event("Chelyabinsk")
    if chelyabinsk:
        print(f"Chelyabinsk 2013:")
        print(f"  Diameter: {chelyabinsk['impactor']['diameter_m']} m")
        print(f"  Velocity: {chelyabinsk['impactor']['velocity_km_s']} km/s")
        print(f"  Airburst altitude: {chelyabinsk['event_physics']['airburst_altitude_km']} km")
        print(f"  Casualties: {chelyabinsk['damage_assessment']['casualties_total']}")
        print(f"  Economic loss: ${chelyabinsk['damage_assessment']['economic_loss_usd']:,}")
