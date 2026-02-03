/**
 * @fileoverview ImpactPhysicsEngine - A Production-Grade Asteroid Impact Simulator
 * 
 * This module implements the scientific models from:
 * - Collins, G.S., Melosh, H.J., & Marcus, R.A. (2005). "Earth Impact Effects Program:
 *   A Web-based computer program for calculating the regional environmental consequences
 *   of a meteoroid impact on Earth." Meteoritics & Planetary Science, 40(6), 817-840.
 * - Glasstone, S., & Dolan, P.J. (1977). "The Effects of Nuclear Weapons." 3rd Edition.
 *   U.S. Department of Defense and Energy Research and Development Administration.
 * - Melosh, H.J. (1989). "Impact Cratering: A Geologic Process." Oxford University Press.
 * 
 * @author MeteorViz Scientific Team
 * @version 2.0.0
 * @license MIT
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Raw asteroid data input structure (based on NASA JPL/SBDB format)
 */
export interface AsteroidInput {
    name: string;
    mass_kg: number | null;
    diameter_km: number | null;
    velocity_kms: number;
    impact_angle_deg: number;
    density_gcm3: number | null;
    spectral_type: string | null;
    target_density_kgm3: number;
    latitude: number;
    longitude: number;
}

/**
 * Normalized asteroid data with all fields populated (SI units)
 */
interface NormalizedAsteroid {
    name: string;
    mass_kg: number;
    diameter_m: number;
    velocity_ms: number;
    impact_angle_rad: number;
    density_kgm3: number;
    target_density_kgm3: number;
    latitude: number;
    longitude: number;
}

/**
 * Energy calculation results
 */
interface EnergyResults {
    joules: number;
    megatons: number;
    hiroshima_equivalent: number;
}

/**
 * Atmospheric entry physics results
 */
interface AtmosphericEntryResults {
    impact_type: 'Airburst' | 'Crater';
    burst_altitude_m: number;
    broken_up: boolean;
    final_velocity_ms: number;
    final_mass_kg: number;
    energy_deposited_atmosphere_percent: number;
}

/**
 * Damage mechanism results
 */
interface DamageResults {
    crater_diameter_m: number;
    crater_depth_m: number;
    thermal_radius_3rd_degree_m: number;
    thermal_radius_2nd_degree_m: number;
    thermal_radius_1st_degree_m: number;
    seismic_magnitude: number;
    seismic_damage_radius_m: number;
    airblast_radius_1psi_m: number;
    airblast_radius_5psi_m: number;
    airblast_radius_20psi_m: number;
    fireball_radius_m: number;
    ejecta_thickness_at_1km_m: number;
}

/**
 * Complete simulation output
 */
export interface SimulationResult {
    input_summary: {
        name: string;
        diameter_m: number;
        velocity_kms: number;
        impact_angle_deg: number;
        density_kgm3: number;
    };
    energy: EnergyResults;
    physics: AtmosphericEntryResults;
    results: DamageResults;
    scientific_notes: string[];
    computation_timestamp: string;
    model_version: string;
}

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

/**
 * Fundamental physical constants used throughout the simulation.
 * All values in SI units unless otherwise noted.
 */
const CONSTANTS = {
    /** Earth's mean radius (m) - WGS84 */
    EARTH_RADIUS_M: 6.371e6,

    /** Standard gravitational acceleration at Earth's surface (m/s²) */
    GRAVITY_MS2: 9.80665,

    /** Sea-level atmospheric density (kg/m³) - ISA standard atmosphere */
    RHO_AIR_SURFACE: 1.225,

    /** Atmospheric scale height (m) - isothermal approximation */
    SCALE_HEIGHT_M: 8500,

    /** 1 Megaton TNT equivalent in Joules */
    MEGATON_JOULES: 4.184e15,

    /** Hiroshima bomb yield in Joules (~15 kilotons) */
    HIROSHIMA_JOULES: 6.276e13,

    /** Speed of light (m/s) - for relativistic checks */
    SPEED_OF_LIGHT_MS: 2.998e8,

    /** Stefan-Boltzmann constant (W/m²/K⁴) */
    STEFAN_BOLTZMANN: 5.67e-8,

    /** Pi constant for geometric calculations */
    PI: Math.PI,

    /** Drag coefficient for sphere (dimensionless) - Ref: Collins et al. 2005 */
    DRAG_COEFFICIENT: 0.47,

    /** Ablation heat transfer coefficient (dimensionless) - Ref: Melosh 1989 */
    HEAT_TRANSFER_COEFFICIENT: 0.1,

    /** Heat of ablation for stony material (J/kg) - Ref: Collins et al. 2005 */
    HEAT_OF_ABLATION: 8.0e6,
} as const;

/**
 * Spectral type to density mapping based on taxonomic classification.
 * Ref: Carry, B. (2012). "Density of asteroids." Planetary and Space Science, 73(1), 98-118.
 */
const SPECTRAL_DENSITY_MAP: Record<string, number> = {
    'M': 5300,  // Metallic (iron-nickel) asteroids
    'X': 5300,  // X-complex (includes M-types)
    'S': 2700,  // Silicaceous (stony) asteroids
    'Q': 2700,  // Q-type (similar to ordinary chondrites)
    'V': 3200,  // Vestoids (basaltic)
    'C': 1300,  // Carbonaceous asteroids
    'B': 1300,  // B-type (carbonaceous)
    'D': 1500,  // D-type (organic-rich, outer belt)
    'P': 1500,  // P-type (primitive, outer belt)
    'A': 2700,  // A-type (olivine-rich)
    'E': 2800,  // Enstatite achondrite-like
    'DEFAULT': 2000, // Conservative default for unknown types
};

/**
 * Material strength values (Pa) based on composition.
 * Ref: Petrovic, J.J. (2001). "Mechanical properties of meteorites and their constituents."
 */
const MATERIAL_STRENGTH: Record<string, number> = {
    'M': 1.0e8,      // Iron meteorites - very strong
    'S': 1.0e7,      // Stony meteorites - moderate
    'C': 1.0e6,      // Carbonaceous - weak, porous
    'COMET': 1.0e5,  // Cometary nuclei - very weak
    'DEFAULT': 1.0e7,
};

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ImpactPhysicsEngine - A comprehensive asteroid impact simulation engine.
 * 
 * This class implements the complete chain of physical calculations required
 * to estimate the effects of an asteroid impact on Earth, from atmospheric
 * entry through crater formation and damage propagation.
 * 
 * @example
 * ```typescript
 * const engine = new ImpactPhysicsEngine();
 * const result = engine.simulate({
 *   name: "2024 PT5",
 *   mass_kg: null,
 *   diameter_km: 0.5,
 *   velocity_kms: 20,
 *   impact_angle_deg: 45,
 *   density_gcm3: null,
 *   spectral_type: 'S',
 *   target_density_kgm3: 2500,
 *   latitude: 40.7128,
 *   longitude: -74.0060
 * });
 * console.log(result.energy.megatons);
 * ```
 */
export class ImpactPhysicsEngine {
    private readonly modelVersion = '2.0.0-collins2005';
    private scientificNotes: string[] = [];

    /**
     * Creates a new instance of the ImpactPhysicsEngine.
     */
    constructor() {
        this.scientificNotes = [];
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Main simulation entry point. Takes raw asteroid data and returns
     * comprehensive impact analysis results.
     * 
     * @param input - Raw asteroid parameters (may contain null values)
     * @returns Complete simulation results with all damage mechanisms
     * @throws Error if critical parameters cannot be determined
     */
    public simulate(input: AsteroidInput): SimulationResult {
        // Reset notes for fresh simulation
        this.scientificNotes = [];

        // Validate critical input
        this.validateInput(input);

        // Step 1: Normalize and gap-fill the input data
        const normalized = this.normalizeData(input);

        // Step 2: Calculate kinetic energy
        const energy = this.calculateEnergy(normalized);

        // Step 3: Simulate atmospheric entry
        const atmosphericEntry = this.simulateAtmosphericEntry(normalized, energy);

        // Step 4: Calculate all damage mechanisms
        const damages = this.calculateDamages(normalized, energy, atmosphericEntry);

        // Compile final result
        return {
            input_summary: {
                name: normalized.name,
                diameter_m: normalized.diameter_m,
                velocity_kms: normalized.velocity_ms / 1000,
                impact_angle_deg: normalized.impact_angle_rad * (180 / Math.PI),
                density_kgm3: normalized.density_kgm3,
            },
            energy,
            physics: atmosphericEntry,
            results: damages,
            scientific_notes: [...this.scientificNotes],
            computation_timestamp: new Date().toISOString(),
            model_version: this.modelVersion,
        };
    }

    // ==========================================================================
    // DATA NORMALIZATION (The "Perfection" Algorithm)
    // ==========================================================================

    /**
     * Validates the input data for critical errors.
     * 
     * @param input - Raw asteroid input
     * @throws Error if validation fails
     */
    private validateInput(input: AsteroidInput): void {
        if (!input.name || input.name.trim() === '') {
            throw new Error('Asteroid name is required.');
        }

        if (input.velocity_kms <= 0) {
            throw new Error('Velocity must be positive. Received: ' + input.velocity_kms);
        }

        if (input.velocity_kms * 1000 > CONSTANTS.SPEED_OF_LIGHT_MS * 0.1) {
            throw new Error('Velocity exceeds 10% of light speed - relativistic effects not modeled.');
        }

        if (input.impact_angle_deg <= 0 || input.impact_angle_deg > 90) {
            throw new Error('Impact angle must be between 0° (exclusive) and 90° (inclusive).');
        }

        if (input.mass_kg !== null && input.mass_kg < 0) {
            throw new Error('Mass cannot be negative.');
        }

        if (input.diameter_km !== null && input.diameter_km < 0) {
            throw new Error('Diameter cannot be negative.');
        }

        // Must have at least one of mass or diameter
        if (input.mass_kg === null && input.diameter_km === null) {
            throw new Error('At least one of mass_kg or diameter_km must be provided.');
        }
    }

    /**
     * Normalizes input data by filling gaps and converting to SI units.
     * Implements the "Perfection Algorithm" for data completeness.
     * 
     * @param input - Raw asteroid input
     * @returns Fully normalized asteroid data in SI units
     */
    private normalizeData(input: AsteroidInput): NormalizedAsteroid {
        // Step 1: Determine density
        let density_kgm3: number;
        if (input.density_gcm3 !== null && input.density_gcm3 > 0) {
            // Convert g/cm³ to kg/m³
            density_kgm3 = input.density_gcm3 * 1000;
            this.scientificNotes.push(`Density provided: ${density_kgm3} kg/m³`);
        } else {
            // Infer from spectral type
            density_kgm3 = this.inferDensityFromSpectralType(input.spectral_type);
        }

        // Step 2: Determine diameter (convert km to m)
        let diameter_m: number;
        if (input.diameter_km !== null && input.diameter_km > 0) {
            diameter_m = input.diameter_km * 1000;
            this.scientificNotes.push(`Diameter provided: ${diameter_m.toExponential(3)} m`);
        } else if (input.mass_kg !== null && input.mass_kg > 0) {
            // Calculate diameter from mass and density (assuming sphere)
            // V = (4/3)πr³, m = ρV → r = ∛(3m / 4πρ)
            const radius_m = Math.cbrt((3 * input.mass_kg) / (4 * CONSTANTS.PI * density_kgm3));
            diameter_m = 2 * radius_m;
            this.scientificNotes.push(
                `Diameter derived from mass: ${diameter_m.toExponential(3)} m ` +
                `(assuming spherical geometry)`
            );
        } else {
            throw new Error('Cannot determine diameter: insufficient data.');
        }

        // Step 3: Determine mass
        let mass_kg: number;
        if (input.mass_kg !== null && input.mass_kg > 0) {
            mass_kg = input.mass_kg;
            this.scientificNotes.push(`Mass provided: ${mass_kg.toExponential(3)} kg`);
        } else {
            // Calculate mass from diameter and density
            const radius_m = diameter_m / 2;
            const volume_m3 = (4 / 3) * CONSTANTS.PI * Math.pow(radius_m, 3);
            mass_kg = density_kgm3 * volume_m3;
            this.scientificNotes.push(
                `Mass derived from diameter and density: ${mass_kg.toExponential(3)} kg ` +
                `[V = (4/3)πr³ = ${volume_m3.toExponential(2)} m³]`
            );
        }

        // Step 4: Convert velocity to m/s
        const velocity_ms = input.velocity_kms * 1000;

        // Step 5: Convert angle to radians
        const impact_angle_rad = input.impact_angle_deg * (Math.PI / 180);

        return {
            name: input.name.trim(),
            mass_kg,
            diameter_m,
            velocity_ms,
            impact_angle_rad,
            density_kgm3,
            target_density_kgm3: input.target_density_kgm3,
            latitude: input.latitude,
            longitude: input.longitude,
        };
    }

    /**
     * Infers asteroid density from spectral classification.
     * 
     * Ref: Carry, B. (2012). "Density of asteroids." P&SS, 73(1), 98-118.
     * Ref: DeMeo, F.E. et al. (2009). "An extension of the Bus asteroid taxonomy."
     * 
     * @param spectralType - Asteroid spectral classification (e.g., 'S', 'C', 'M')
     * @returns Density in kg/m³
     */
    private inferDensityFromSpectralType(spectralType: string | null): number {
        if (!spectralType || spectralType.trim() === '') {
            this.scientificNotes.push(
                `Density inferred: ${SPECTRAL_DENSITY_MAP['DEFAULT']} kg/m³ ` +
                `(no spectral type provided, using conservative default)`
            );
            return SPECTRAL_DENSITY_MAP['DEFAULT'];
        }

        // Extract primary classification letter (first character, uppercase)
        const primaryType = spectralType.trim().toUpperCase().charAt(0);

        if (SPECTRAL_DENSITY_MAP[primaryType]) {
            const density = SPECTRAL_DENSITY_MAP[primaryType];
            this.scientificNotes.push(
                `Density inferred from Spectral Type '${spectralType}': ${density} kg/m³ ` +
                `[Ref: Carry 2012]`
            );
            return density;
        }

        this.scientificNotes.push(
            `Density inferred: ${SPECTRAL_DENSITY_MAP['DEFAULT']} kg/m³ ` +
            `(unknown spectral type '${spectralType}')`
        );
        return SPECTRAL_DENSITY_MAP['DEFAULT'];
    }

    /**
     * Gets material strength based on spectral type.
     * 
     * @param spectralType - Asteroid spectral type
     * @returns Material strength in Pascals
     */
    private getMaterialStrength(spectralType: string | null): number {
        if (!spectralType) return MATERIAL_STRENGTH['DEFAULT'];

        const primaryType = spectralType.trim().toUpperCase().charAt(0);
        return MATERIAL_STRENGTH[primaryType] || MATERIAL_STRENGTH['DEFAULT'];
    }

    // ==========================================================================
    // ENERGY CALCULATIONS
    // ==========================================================================

    /**
     * Calculates kinetic energy and unit conversions.
     * 
     * Formula: E = ½mv² (Classical kinetic energy)
     * 
     * @param asteroid - Normalized asteroid data
     * @returns Energy in multiple units
     */
    private calculateEnergy(asteroid: NormalizedAsteroid): EnergyResults {
        // E = 0.5 * m * v²
        const joules = 0.5 * asteroid.mass_kg * Math.pow(asteroid.velocity_ms, 2);

        // Convert to Megatons TNT equivalent
        const megatons = joules / CONSTANTS.MEGATON_JOULES;

        // Convert to Hiroshima bomb equivalents
        const hiroshima_equivalent = joules / CONSTANTS.HIROSHIMA_JOULES;

        this.scientificNotes.push(
            `Kinetic Energy: ${joules.toExponential(3)} J = ${megatons.toFixed(2)} MT TNT ` +
            `= ${Math.round(hiroshima_equivalent).toLocaleString()} Hiroshima bombs`
        );

        return { joules, megatons, hiroshima_equivalent };
    }

    // ==========================================================================
    // ATMOSPHERIC ENTRY MODEL
    // ==========================================================================

    /**
     * Simulates atmospheric entry to determine impact type (Airburst vs Crater).
     * 
     * Uses the "pancake model" for atmospheric fragmentation:
     * - Ram pressure: P_ram = ρ_air * v²
     * - Breakup occurs when P_ram > σ_yield (material strength)
     * - After breakup, the object spreads and decelerates rapidly
     * 
     * Ref: Collins et al. (2005), Section 3.1
     * Ref: Chyba, C.F. et al. (1993). "The 1908 Tunguska explosion."
     * 
     * @param asteroid - Normalized asteroid data
     * @param energy - Pre-calculated energy
     * @returns Atmospheric entry analysis
     */
    private simulateAtmosphericEntry(
        asteroid: NormalizedAsteroid,
        energy: EnergyResults
    ): AtmosphericEntryResults {
        const materialStrength = this.getMaterialStrength(null); // Use default for now

        // Critical size threshold: Objects >150m diameter typically reach surface
        // Ref: Collins et al. (2005), empirical observation
        const CRITICAL_DIAMETER_M = 150;

        // Large impactors (>80m) retain most momentum and reach the surface
        // This is a simplified check before detailed simulation
        if (asteroid.diameter_m > CRITICAL_DIAMETER_M) {
            this.scientificNotes.push(
                `Large impactor (D=${asteroid.diameter_m.toFixed(0)}m > ${CRITICAL_DIAMETER_M}m): ` +
                `Will reach surface with minimal atmospheric deceleration. [Ref: Collins et al. 2005]`
            );

            // Apply minimal atmospheric drag for large objects
            const dragFactor = 0.98;
            const finalVelocity = asteroid.velocity_ms * dragFactor;

            return {
                impact_type: 'Crater',
                burst_altitude_m: 0,
                broken_up: false,
                final_velocity_ms: finalVelocity,
                final_mass_kg: asteroid.mass_kg * 0.99, // Minimal ablation
                energy_deposited_atmosphere_percent: (1 - Math.pow(dragFactor, 2)) * 100,
            };
        }

        // For smaller objects, simulate atmospheric entry in detail
        return this.runDetailedAtmosphericSimulation(asteroid, materialStrength);
    }

    /**
     * Runs detailed atmospheric entry simulation using iterative integration.
     * 
     * Implements the single-body equations of motion:
     * dv/dt = -(ρ_air * A * C_d * v²) / (2m) - g·sin(θ)
     * dm/dt = -(C_h * ρ_air * A * v³) / (2Q)
     * dh/dt = -v·sin(θ)
     * 
     * Breakup condition: ρ_air * v² > σ_yield
     * 
     * Ref: Melosh, H.J. (1989), Eq. 8.2.1-8.2.3
     * Ref: Collins et al. (2005), Eq. 4-9
     * 
     * @param asteroid - Normalized asteroid data
     * @param materialStrength - Yield strength (Pa)
     * @returns Atmospheric entry results
     */
    private runDetailedAtmosphericSimulation(
        asteroid: NormalizedAsteroid,
        materialStrength: number
    ): AtmosphericEntryResults {
        // Initial conditions
        let altitude = 100000; // Start at 100 km (edge of atmosphere)
        let velocity = asteroid.velocity_ms;
        let mass = asteroid.mass_kg;
        let brokenUp = false;
        let breakupAltitude = 0;

        // Time step for integration (smaller = more accurate)
        const dt = 0.01; // seconds
        const maxSteps = 500000;
        const sinTheta = Math.sin(asteroid.impact_angle_rad);

        // Running radius (changes with ablation)
        let radius = asteroid.diameter_m / 2;
        const rho_impactor = asteroid.density_kgm3;

        for (let step = 0; step < maxSteps; step++) {
            // Check termination conditions
            if (altitude <= 0) break; // Reached surface
            if (velocity < 100) break; // Effectively stopped
            if (mass <= 0) break; // Completely ablated

            // Atmospheric density (isothermal approximation)
            // ρ(h) = ρ₀ * exp(-h/H)
            const rho_air = CONSTANTS.RHO_AIR_SURFACE * Math.exp(-altitude / CONSTANTS.SCALE_HEIGHT_M);

            // Cross-sectional area
            const area = CONSTANTS.PI * radius * radius;

            // Ram (dynamic) pressure
            const ramPressure = rho_air * velocity * velocity;

            // Check for breakup
            if (!brokenUp && ramPressure > materialStrength) {
                brokenUp = true;
                breakupAltitude = altitude;
                this.scientificNotes.push(
                    `Fragmentation at ${(altitude / 1000).toFixed(1)} km altitude. ` +
                    `Ram pressure (${ramPressure.toExponential(2)} Pa) exceeded ` +
                    `material strength (${materialStrength.toExponential(2)} Pa)`
                );
            }

            // Apply pancake model spreading after breakup
            // Ref: Collins et al. 2005, Eq. 12-14
            let effectiveRadius = radius;
            if (brokenUp) {
                // Debris cloud expands, increasing effective area
                const expansionFactor = 1 + (breakupAltitude - altitude) / CONSTANTS.SCALE_HEIGHT_M;
                effectiveRadius = radius * Math.min(expansionFactor, 5); // Cap at 5x
            }
            const effectiveArea = CONSTANTS.PI * effectiveRadius * effectiveRadius;

            // Drag force: F_d = ½ * C_d * ρ_air * A * v²
            const dragForce = 0.5 * CONSTANTS.DRAG_COEFFICIENT * rho_air * effectiveArea * velocity * velocity;

            // Deceleration: dv/dt = -F_d/m - g·sin(θ)
            const deceleration = (dragForce / mass) + CONSTANTS.GRAVITY_MS2 * sinTheta;

            // Mass ablation rate: dm/dt = -(C_h * ρ_air * A * v³) / (2Q)
            const massLossRate = (CONSTANTS.HEAT_TRANSFER_COEFFICIENT * rho_air * effectiveArea *
                Math.pow(velocity, 3)) / (2 * CONSTANTS.HEAT_OF_ABLATION);

            // Altitude change: dh/dt = -v·sin(θ)
            const altitudeChange = velocity * sinTheta;

            // Update state (Euler integration)
            velocity = Math.max(0, velocity - deceleration * dt);
            mass = Math.max(0, mass - massLossRate * dt);
            altitude = altitude - altitudeChange * dt;

            // Update radius based on mass loss (maintaining density)
            if (mass > 0) {
                radius = Math.cbrt((3 * mass) / (4 * CONSTANTS.PI * rho_impactor));
            }

            // Airburst check: if velocity drops below ~3 km/s and still above ground
            // the object has deposited most energy to atmosphere
            if (velocity < 3000 && altitude > 5000 && brokenUp) {
                const energyLossPercent = (1 - Math.pow(velocity / asteroid.velocity_ms, 2)) * 100;

                this.scientificNotes.push(
                    `Airburst at ${(altitude / 1000).toFixed(1)} km altitude. ` +
                    `${energyLossPercent.toFixed(1)}% of kinetic energy deposited to atmosphere.`
                );

                return {
                    impact_type: 'Airburst',
                    burst_altitude_m: altitude,
                    broken_up: true,
                    final_velocity_ms: velocity,
                    final_mass_kg: mass,
                    energy_deposited_atmosphere_percent: energyLossPercent,
                };
            }
        }

        // Reached surface (or close to it)
        const energyLossPercent = (1 - Math.pow(velocity / asteroid.velocity_ms, 2)) * 100;

        if (altitude <= 0 && velocity > 1000) {
            this.scientificNotes.push(
                `Surface impact with ${(velocity / 1000).toFixed(2)} km/s residual velocity. ` +
                `${(100 - energyLossPercent).toFixed(1)}% of initial energy delivered to surface.`
            );
        }

        return {
            impact_type: altitude <= 0 && velocity > 1000 ? 'Crater' : 'Airburst',
            burst_altitude_m: altitude <= 0 ? 0 : altitude,
            broken_up: brokenUp,
            final_velocity_ms: velocity,
            final_mass_kg: mass,
            energy_deposited_atmosphere_percent: energyLossPercent,
        };
    }

    // ==========================================================================
    // DAMAGE PROPAGATION MECHANISMS
    // ==========================================================================

    /**
     * Calculates all damage mechanisms based on impact parameters.
     * 
     * @param asteroid - Normalized asteroid data
     * @param energy - Energy calculations
     * @param atmosphericEntry - Atmospheric entry results
     * @returns Comprehensive damage analysis
     */
    private calculateDamages(
        asteroid: NormalizedAsteroid,
        energy: EnergyResults,
        atmosphericEntry: AtmosphericEntryResults
    ): DamageResults {
        // Determine effective ground-level energy
        // Airburst delivers energy through shockwave; crater delivers directly
        const effectiveEnergyJoules = energy.joules *
            (1 - atmosphericEntry.energy_deposited_atmosphere_percent / 100);
        const effectiveEnergyMT = effectiveEnergyJoules / CONSTANTS.MEGATON_JOULES;

        const isAirburst = atmosphericEntry.impact_type === 'Airburst';
        const burstHeight = atmosphericEntry.burst_altitude_m;

        return {
            crater_diameter_m: isAirburst ? 0 : this.calculateCraterDiameter(
                asteroid.diameter_m,
                atmosphericEntry.final_velocity_ms,
                asteroid.density_kgm3,
                asteroid.target_density_kgm3,
                asteroid.impact_angle_rad
            ),
            crater_depth_m: isAirburst ? 0 : this.calculateCraterDepth(
                this.calculateCraterDiameter(
                    asteroid.diameter_m,
                    atmosphericEntry.final_velocity_ms,
                    asteroid.density_kgm3,
                    asteroid.target_density_kgm3,
                    asteroid.impact_angle_rad
                )
            ),
            thermal_radius_3rd_degree_m: this.calculateThermalRadius(
                energy.joules,
                'third_degree',
                isAirburst,
                burstHeight
            ),
            thermal_radius_2nd_degree_m: this.calculateThermalRadius(
                energy.joules,
                'second_degree',
                isAirburst,
                burstHeight
            ),
            thermal_radius_1st_degree_m: this.calculateThermalRadius(
                energy.joules,
                'first_degree',
                isAirburst,
                burstHeight
            ),
            seismic_magnitude: this.calculateSeismicMagnitude(effectiveEnergyJoules, isAirburst),
            seismic_damage_radius_m: this.calculateSeismicDamageRadius(
                this.calculateSeismicMagnitude(effectiveEnergyJoules, isAirburst)
            ),
            airblast_radius_1psi_m: this.calculateAirblastRadius(energy.megatons, 1, burstHeight),
            airblast_radius_5psi_m: this.calculateAirblastRadius(energy.megatons, 5, burstHeight),
            airblast_radius_20psi_m: this.calculateAirblastRadius(energy.megatons, 20, burstHeight),
            fireball_radius_m: this.calculateFireballRadius(energy.megatons),
            ejecta_thickness_at_1km_m: isAirburst ? 0 : this.calculateEjectaThickness(
                this.calculateCraterDiameter(
                    asteroid.diameter_m,
                    atmosphericEntry.final_velocity_ms,
                    asteroid.density_kgm3,
                    asteroid.target_density_kgm3,
                    asteroid.impact_angle_rad
                ),
                1000 // 1 km distance
            ),
        };
    }

    // --------------------------------------------------------------------------
    // CRATERING
    // --------------------------------------------------------------------------

    /**
     * Calculates final (simple) crater diameter using π-scaling laws.
     * 
     * Uses the gravity-regime scaling from Holsapple (1993) and Collins et al. (2005):
     * 
     * π_D = C_D * (ρ_i/ρ_t)^(1/3) * (π_2 + π_3)^(-β)
     * 
     * Where:
     * - π_2 = gL/v² (gravity-scaled size)
     * - π_3 = Y/(ρ_t * v²) (strength-scaled size)
     * - C_D ≈ 1.03, β ≈ 0.22 for competent rock
     * 
     * Ref: Collins et al. (2005), Eq. 20-26
     * Ref: Holsapple, K.A. (1993). "The Scaling of Impact Processes in Planetary Sciences."
     * 
     * @param impactorDiameter_m - Impactor diameter (m)
     * @param impactVelocity_ms - Impact velocity (m/s)
     * @param impactorDensity - Impactor density (kg/m³)
     * @param targetDensity - Target density (kg/m³)
     * @param impactAngle_rad - Impact angle from horizontal (radians)
     * @returns Final crater diameter (m)
     */
    private calculateCraterDiameter(
        impactorDiameter_m: number,
        impactVelocity_ms: number,
        impactorDensity: number,
        targetDensity: number,
        impactAngle_rad: number
    ): number {
        if (impactorDiameter_m <= 0 || impactVelocity_ms <= 0) return 0;

        // Scaling constants (for competent rock/sediment)
        const C_D = 1.03;
        const beta = 0.22;
        const Y = 1.0e6; // Target strength (Pa) - competent rock

        // Dimensionless groups
        const L = impactorDiameter_m;
        const v = impactVelocity_ms;
        const g = CONSTANTS.GRAVITY_MS2;

        const pi2 = (g * L) / (v * v);
        const pi3 = Y / (targetDensity * v * v);

        // Density ratio factor
        const densityFactor = Math.pow(impactorDensity / targetDensity, 1 / 3);

        // Angle correction (most craters maintain circular shape down to ~15°)
        const sinTheta = Math.sin(impactAngle_rad);
        const angleCorrection = Math.pow(sinTheta, 1 / 3);

        // Transient crater diameter
        const D_transient = C_D * L * densityFactor * Math.pow(pi2 + pi3, -beta) * angleCorrection;

        // Final crater diameter (simple crater collapse multiplier ≈ 1.25)
        const D_final = 1.25 * D_transient;

        this.scientificNotes.push(
            `Crater diameter calculated using π-scaling: D_final = ${D_final.toFixed(0)} m ` +
            `[Ref: Collins et al. 2005, Eq. 24]`
        );

        return Math.max(0, D_final);
    }

    /**
     * Calculates crater depth from diameter.
     * 
     * Simple craters have depth/diameter ratio of ~0.2-0.3.
     * Complex craters (D > 4 km on Earth) are shallower.
     * 
     * Ref: Melosh (1989), Chapter 5
     * 
     * @param craterDiameter_m - Crater diameter (m)
     * @returns Crater depth (m)
     */
    private calculateCraterDepth(craterDiameter_m: number): number {
        if (craterDiameter_m <= 0) return 0;

        // Simple crater transition diameter on Earth ≈ 4 km
        const SIMPLE_COMPLEX_TRANSITION = 4000;

        if (craterDiameter_m < SIMPLE_COMPLEX_TRANSITION) {
            // Simple crater: depth ≈ 0.2 * diameter
            return 0.2 * craterDiameter_m;
        } else {
            // Complex crater: depth scales as D^0.3
            // Ref: Pike, R.J. (1977)
            const d_simple = 0.2 * SIMPLE_COMPLEX_TRANSITION;
            return d_simple * Math.pow(craterDiameter_m / SIMPLE_COMPLEX_TRANSITION, 0.3);
        }
    }

    // --------------------------------------------------------------------------
    // THERMAL RADIATION
    // --------------------------------------------------------------------------

    /**
     * Calculates thermal radiation damage radius with horizon correction.
     * 
     * CRITICAL: Thermal radiation travels in straight lines. Due to Earth's
     * curvature, ground observers cannot see beyond the horizon unless the
     * burst is at altitude.
     * 
     * Horizon distance: d_h = √(2 * R_earth * h_burst)
     * 
     * Thermal scaling: R ~ Y^0.5 (for fireball temperature effects)
     * 
     * Ref: Glasstone & Dolan (1977), Chapter 7
     * Ref: Collins et al. (2005), Eq. 42-45
     * 
     * @param energyJoules - Total energy (J)
     * @param severity - Burn severity level
     * @param isAirburst - Whether this is an airburst
     * @param burstHeight_m - Burst altitude (m)
     * @returns Damage radius (m)
     */
    private calculateThermalRadius(
        energyJoules: number,
        severity: 'first_degree' | 'second_degree' | 'third_degree',
        isAirburst: boolean,
        burstHeight_m: number
    ): number {
        if (energyJoules <= 0) return 0;

        const energyMT = energyJoules / CONSTANTS.MEGATON_JOULES;

        // Thermal flux thresholds (J/m²) from Glasstone & Dolan
        // These represent the integrated thermal exposure for each burn level
        const FLUX_THRESHOLDS: Record<string, number> = {
            'first_degree': 125e3,   // ~125 kJ/m² - minor burn
            'second_degree': 250e3,  // ~250 kJ/m² - blistering
            'third_degree': 500e3,   // ~500 kJ/m² - charring
        };

        // Thermal energy fraction (typically 30-50% of total for nuclear/impact)
        const thermalFraction = isAirburst ? 0.35 : 0.25;
        const thermalEnergy = energyJoules * thermalFraction;

        // Theoretical radius: R = √(E_thermal / (4π * q_threshold))
        const threshold = FLUX_THRESHOLDS[severity];
        let theoreticalRadius = Math.sqrt(thermalEnergy / (4 * CONSTANTS.PI * threshold));

        // Apply atmospheric attenuation for large distances (>100 km)
        // Beer-Lambert-like correction
        if (theoreticalRadius > 100000) {
            theoreticalRadius *= 0.75; // ~25% loss for very long paths
        } else if (theoreticalRadius > 50000) {
            theoreticalRadius *= 0.9;
        }

        // HORIZON CHECK - This is CRITICAL for physical accuracy
        // Thermal radiation cannot curve around Earth
        let horizonLimit = Infinity;

        if (isAirburst && burstHeight_m > 0) {
            // Airburst: use burst height for horizon calculation
            horizonLimit = Math.sqrt(2 * CONSTANTS.EARTH_RADIUS_M * burstHeight_m);
        } else {
            // Surface burst: use estimated fireball height
            // Fireball rises to roughly R_fireball height
            const fireballRadius = this.calculateFireballRadius(energyMT);
            horizonLimit = Math.sqrt(2 * CONSTANTS.EARTH_RADIUS_M * fireballRadius);
        }

        // Final radius is minimum of theoretical and horizon limit
        const finalRadius = Math.min(theoreticalRadius, horizonLimit);

        if (finalRadius < theoreticalRadius && severity === 'third_degree') {
            this.scientificNotes.push(
                `Thermal radius for ${severity} burns limited by horizon: ` +
                `${(finalRadius / 1000).toFixed(1)} km (theoretical: ${(theoreticalRadius / 1000).toFixed(1)} km) ` +
                `[d_horizon = √(2·R_earth·h)]`
            );
        }

        return finalRadius;
    }

    /**
     * Calculates fireball radius from yield.
     * 
     * Empirical scaling: R_fireball ≈ 75 * Y^0.4 (Y in MT, R in meters)
     * 
     * Ref: Glasstone & Dolan (1977), Chapter 2
     * 
     * @param energyMT - Energy in megatons
     * @returns Fireball radius (m)
     */
    private calculateFireballRadius(energyMT: number): number {
        if (energyMT <= 0) return 0;

        // Empirical scaling for maximum fireball radius
        // This is a fit to nuclear test data adapted for impacts
        return 75 * Math.pow(energyMT, 0.4) * 1000; // Result in meters
    }

    // --------------------------------------------------------------------------
    // AIRBLAST (SHOCKWAVE)
    // --------------------------------------------------------------------------

    /**
     * Calculates airblast damage radius using cube-root yield scaling.
     * 
     * Uses Hopkinson-Cranz scaling: R = Z * Y^(1/3)
     * Where Z is the scaled distance for a given overpressure.
     * 
     * Overpressure effects:
     * - 1 psi (~7 kPa): Glass breakage, minor structural damage
     * - 5 psi (~35 kPa): Most buildings destroyed, widespread injuries
     * - 20 psi (~140 kPa): Reinforced structures destroyed, mostly fatal
     * 
     * Ref: Glasstone & Dolan (1977), Chapter 3
     * Ref: Collins et al. (2005), Eq. 48-51
     * 
     * @param energyMT - Energy in megatons
     * @param overpressurePsi - Target overpressure (psi)
     * @param burstHeight_m - Burst altitude (m)
     * @returns Damage radius (m)
     */
    private calculateAirblastRadius(
        energyMT: number,
        overpressurePsi: number,
        burstHeight_m: number
    ): number {
        if (energyMT <= 0) return 0;

        // Scaled distance constants (km per MT^(1/3)) from Glasstone & Dolan
        // These are for sea-level, optimum burst height
        const SCALED_DISTANCES: Record<number, number> = {
            1: 13.0,   // 1 psi
            5: 5.0,    // 5 psi
            20: 2.0,   // 20 psi
        };

        const Z = SCALED_DISTANCES[overpressurePsi] || 5.0;

        // Base radius from scaling law
        let radius_km = Z * Math.pow(energyMT, 1 / 3);

        // Height-of-burst correction
        // For surface bursts, the ground reflection enhances close-in effects
        // but limits far-field propagation
        if (burstHeight_m < 100) {
            // Surface burst: reduce radius by ~20% due to ground absorption
            radius_km *= 0.8;
        } else if (burstHeight_m > 10000) {
            // Very high burst: some enhancement from Mach stem reflection
            radius_km *= 1.1;
        }

        return radius_km * 1000; // Convert to meters
    }

    // --------------------------------------------------------------------------
    // SEISMIC EFFECTS
    // --------------------------------------------------------------------------

    /**
     * Calculates equivalent earthquake magnitude from impact energy.
     * 
     * Uses modified Gutenberg-Richter relation:
     * log₁₀(E_seismic) = 1.5 * M_w + 4.8
     * 
     * Where E_seismic is the seismic energy (a small fraction of impact energy).
     * Seismic efficiency η ≈ 10⁻⁴ for impacts (0.01%).
     * 
     * Note: Airbursts do NOT produce significant seismic waves.
     * 
     * Ref: Kanamori, H. (1977). "The energy release in great earthquakes."
     * Ref: Collins et al. (2005), Section 6
     * 
     * @param energyJoules - Impact energy (J)
     * @param isAirburst - Whether this is an airburst
     * @returns Moment magnitude (Mw)
     */
    private calculateSeismicMagnitude(energyJoules: number, isAirburst: boolean): number {
        // Airbursts don't couple energy to ground effectively
        if (isAirburst) {
            this.scientificNotes.push(
                'Seismic magnitude: minimal (airburst - no significant ground coupling)'
            );
            return 0;
        }

        if (energyJoules <= 0) return 0;

        // Seismic coupling efficiency (very low for impacts)
        const SEISMIC_EFFICIENCY = 1e-4;
        const seismicEnergy = energyJoules * SEISMIC_EFFICIENCY;

        if (seismicEnergy <= 0) return 0;

        // Gutenberg-Richter: log₁₀(E) = 1.5*M + 4.8
        // Solving for M: M = (log₁₀(E) - 4.8) / 1.5
        const magnitude = (Math.log10(seismicEnergy) - 4.8) / 1.5;

        const clampedMagnitude = Math.max(0, magnitude);

        this.scientificNotes.push(
            `Seismic magnitude: Mw ${clampedMagnitude.toFixed(1)} ` +
            `(seismic efficiency η = ${SEISMIC_EFFICIENCY}, E_seismic = ${seismicEnergy.toExponential(2)} J) ` +
            `[Ref: Gutenberg-Richter relation]`
        );

        return clampedMagnitude;
    }

    /**
     * Calculates the radius of significant seismic damage (MMI VI+).
     * 
     * MMI VI ("Strong") = felt by all, some heavy furniture moved, minor damage.
     * 
     * Empirical attenuation: R ≈ 10^(0.5*M - 1.8) km for shallow sources.
     * 
     * @param magnitude - Moment magnitude
     * @returns Damage radius (m)
     */
    private calculateSeismicDamageRadius(magnitude: number): number {
        if (magnitude < 4.0) return 0; // Below threshold for structural damage

        const radius_km = Math.pow(10, 0.5 * magnitude - 1.8);
        return radius_km * 1000;
    }

    // --------------------------------------------------------------------------
    // EJECTA
    // --------------------------------------------------------------------------

    /**
     * Calculates ejecta blanket thickness at a given distance from crater.
     * 
     * t(r) = t_rim * (r / R_crater)^(-3)
     * 
     * Where t_rim ≈ 0.14 * R_crater (rim thickness).
     * 
     * Ref: Melosh (1989), Eq. 6.2.3
     * Ref: Collins et al. (2005), Eq. 55
     * 
     * @param craterDiameter_m - Crater diameter (m)
     * @param distance_m - Distance from crater center (m)
     * @returns Ejecta thickness (m)
     */
    private calculateEjectaThickness(craterDiameter_m: number, distance_m: number): number {
        if (craterDiameter_m <= 0 || distance_m <= 0) return 0;

        const R_crater = craterDiameter_m / 2;

        // Must be outside the crater
        if (distance_m <= R_crater) {
            return 0; // Inside crater - no ejecta blanket
        }

        // Rim ejecta thickness
        const t_rim = 0.14 * R_crater;

        // Power-law decay with distance
        const thickness = t_rim * Math.pow(distance_m / R_crater, -3);

        return Math.max(0, thickness);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts degrees to radians.
 */
export function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}

/**
 * Formats large numbers with engineering notation.
 */
export function formatScientific(value: number, decimals: number = 2): string {
    return value.toExponential(decimals);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ImpactPhysicsEngine;
