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
// PHYSICAL CONSTANTS
// ============================================================================

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
};

/**
 * Spectral type to density mapping based on taxonomic classification.
 * Ref: Carry, B. (2012). "Density of asteroids." Planetary and Space Science, 73(1), 98-118.
 */
const SPECTRAL_DENSITY_MAP = {
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
const MATERIAL_STRENGTH = {
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
 */
class ImpactPhysicsEngine {
    constructor() {
        this.modelVersion = '2.0.0-collins2005';
        this.scientificNotes = [];
    }

    // ==========================================================================
    // PUBLIC API
    // ==========================================================================

    /**
     * Main simulation entry point.
     * @param {Object} input - Raw asteroid parameters
     * @returns {Object} Complete simulation results
     */
    simulate(input) {
        this.scientificNotes = [];

        this.validateInput(input);
        const normalized = this.normalizeData(input);
        const energy = this.calculateEnergy(normalized);
        const atmosphericEntry = this.simulateAtmosphericEntry(normalized, energy);
        const damages = this.calculateDamages(normalized, energy, atmosphericEntry);

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
    // DATA NORMALIZATION
    // ==========================================================================

    validateInput(input) {
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
        if (input.mass_kg === null && input.diameter_km === null) {
            throw new Error('At least one of mass_kg or diameter_km must be provided.');
        }
    }

    normalizeData(input) {
        // Determine density
        let density_kgm3;
        if (input.density_gcm3 !== null && input.density_gcm3 > 0) {
            density_kgm3 = input.density_gcm3 * 1000;
            this.scientificNotes.push(`Density provided: ${density_kgm3} kg/m³`);
        } else {
            density_kgm3 = this.inferDensityFromSpectralType(input.spectral_type);
        }

        // Determine diameter
        let diameter_m;
        if (input.diameter_km !== null && input.diameter_km > 0) {
            diameter_m = input.diameter_km * 1000;
            this.scientificNotes.push(`Diameter provided: ${diameter_m.toExponential(3)} m`);
        } else if (input.mass_kg !== null && input.mass_kg > 0) {
            const radius_m = Math.cbrt((3 * input.mass_kg) / (4 * CONSTANTS.PI * density_kgm3));
            diameter_m = 2 * radius_m;
            this.scientificNotes.push(
                `Diameter derived from mass: ${diameter_m.toExponential(3)} m (assuming spherical geometry)`
            );
        } else {
            throw new Error('Cannot determine diameter: insufficient data.');
        }

        // Determine mass
        let mass_kg;
        if (input.mass_kg !== null && input.mass_kg > 0) {
            mass_kg = input.mass_kg;
            this.scientificNotes.push(`Mass provided: ${mass_kg.toExponential(3)} kg`);
        } else {
            const radius_m = diameter_m / 2;
            const volume_m3 = (4 / 3) * CONSTANTS.PI * Math.pow(radius_m, 3);
            mass_kg = density_kgm3 * volume_m3;
            this.scientificNotes.push(
                `Mass derived from diameter and density: ${mass_kg.toExponential(3)} kg`
            );
        }

        return {
            name: input.name.trim(),
            mass_kg,
            diameter_m,
            velocity_ms: input.velocity_kms * 1000,
            impact_angle_rad: input.impact_angle_deg * (Math.PI / 180),
            density_kgm3,
            target_density_kgm3: input.target_density_kgm3,
            latitude: input.latitude,
            longitude: input.longitude,
        };
    }

    inferDensityFromSpectralType(spectralType) {
        if (!spectralType || spectralType.trim() === '') {
            this.scientificNotes.push(
                `Density inferred: ${SPECTRAL_DENSITY_MAP['DEFAULT']} kg/m³ (no spectral type provided)`
            );
            return SPECTRAL_DENSITY_MAP['DEFAULT'];
        }

        const primaryType = spectralType.trim().toUpperCase().charAt(0);

        if (SPECTRAL_DENSITY_MAP[primaryType]) {
            const density = SPECTRAL_DENSITY_MAP[primaryType];
            this.scientificNotes.push(
                `Density inferred from Spectral Type '${spectralType}': ${density} kg/m³ [Ref: Carry 2012]`
            );
            return density;
        }

        this.scientificNotes.push(
            `Density inferred: ${SPECTRAL_DENSITY_MAP['DEFAULT']} kg/m³ (unknown spectral type '${spectralType}')`
        );
        return SPECTRAL_DENSITY_MAP['DEFAULT'];
    }

    getMaterialStrength(spectralType) {
        if (!spectralType) return MATERIAL_STRENGTH['DEFAULT'];
        const primaryType = spectralType.trim().toUpperCase().charAt(0);
        return MATERIAL_STRENGTH[primaryType] || MATERIAL_STRENGTH['DEFAULT'];
    }

    // ==========================================================================
    // ENERGY CALCULATIONS
    // ==========================================================================

    calculateEnergy(asteroid) {
        const joules = 0.5 * asteroid.mass_kg * Math.pow(asteroid.velocity_ms, 2);
        const megatons = joules / CONSTANTS.MEGATON_JOULES;
        const hiroshima_equivalent = joules / CONSTANTS.HIROSHIMA_JOULES;

        this.scientificNotes.push(
            `Kinetic Energy: ${joules.toExponential(3)} J = ${megatons.toFixed(2)} MT TNT = ${Math.round(hiroshima_equivalent).toLocaleString()} Hiroshima bombs`
        );

        return { joules, megatons, hiroshima_equivalent };
    }

    // ==========================================================================
    // ATMOSPHERIC ENTRY MODEL
    // ==========================================================================

    simulateAtmosphericEntry(asteroid, energy) {
        const materialStrength = this.getMaterialStrength(null);
        const CRITICAL_DIAMETER_M = 150;

        if (asteroid.diameter_m > CRITICAL_DIAMETER_M) {
            this.scientificNotes.push(
                `Large impactor (D=${asteroid.diameter_m.toFixed(0)}m > ${CRITICAL_DIAMETER_M}m): Will reach surface with minimal atmospheric deceleration. [Ref: Collins et al. 2005]`
            );

            const dragFactor = 0.98;
            const finalVelocity = asteroid.velocity_ms * dragFactor;

            return {
                impact_type: 'Crater',
                burst_altitude_m: 0,
                broken_up: false,
                final_velocity_ms: finalVelocity,
                final_mass_kg: asteroid.mass_kg * 0.99,
                energy_deposited_atmosphere_percent: (1 - Math.pow(dragFactor, 2)) * 100,
            };
        }

        return this.runDetailedAtmosphericSimulation(asteroid, materialStrength);
    }

    runDetailedAtmosphericSimulation(asteroid, materialStrength) {
        let altitude = 100000;
        let velocity = asteroid.velocity_ms;
        let mass = asteroid.mass_kg;
        let brokenUp = false;
        let breakupAltitude = 0;

        const dt = 0.01;
        const maxSteps = 500000;
        const sinTheta = Math.sin(asteroid.impact_angle_rad);

        let radius = asteroid.diameter_m / 2;
        const rho_impactor = asteroid.density_kgm3;

        for (let step = 0; step < maxSteps; step++) {
            if (altitude <= 0) break;
            if (velocity < 100) break;
            if (mass <= 0) break;

            const rho_air = CONSTANTS.RHO_AIR_SURFACE * Math.exp(-altitude / CONSTANTS.SCALE_HEIGHT_M);
            const area = CONSTANTS.PI * radius * radius;
            const ramPressure = rho_air * velocity * velocity;

            if (!brokenUp && ramPressure > materialStrength) {
                brokenUp = true;
                breakupAltitude = altitude;
                this.scientificNotes.push(
                    `Fragmentation at ${(altitude / 1000).toFixed(1)} km altitude. Ram pressure (${ramPressure.toExponential(2)} Pa) exceeded material strength (${materialStrength.toExponential(2)} Pa)`
                );
            }

            let effectiveRadius = radius;
            if (brokenUp) {
                const expansionFactor = 1 + (breakupAltitude - altitude) / CONSTANTS.SCALE_HEIGHT_M;
                effectiveRadius = radius * Math.min(expansionFactor, 5);
            }
            const effectiveArea = CONSTANTS.PI * effectiveRadius * effectiveRadius;

            const dragForce = 0.5 * CONSTANTS.DRAG_COEFFICIENT * rho_air * effectiveArea * velocity * velocity;
            const deceleration = (dragForce / mass) + CONSTANTS.GRAVITY_MS2 * sinTheta;
            const massLossRate = (CONSTANTS.HEAT_TRANSFER_COEFFICIENT * rho_air * effectiveArea *
                Math.pow(velocity, 3)) / (2 * CONSTANTS.HEAT_OF_ABLATION);
            const altitudeChange = velocity * sinTheta;

            velocity = Math.max(0, velocity - deceleration * dt);
            mass = Math.max(0, mass - massLossRate * dt);
            altitude = altitude - altitudeChange * dt;

            if (mass > 0) {
                radius = Math.cbrt((3 * mass) / (4 * CONSTANTS.PI * rho_impactor));
            }

            if (velocity < 3000 && altitude > 5000 && brokenUp) {
                const energyLossPercent = (1 - Math.pow(velocity / asteroid.velocity_ms, 2)) * 100;

                this.scientificNotes.push(
                    `Airburst at ${(altitude / 1000).toFixed(1)} km altitude. ${energyLossPercent.toFixed(1)}% of kinetic energy deposited to atmosphere.`
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

        const energyLossPercent = (1 - Math.pow(velocity / asteroid.velocity_ms, 2)) * 100;

        if (altitude <= 0 && velocity > 1000) {
            this.scientificNotes.push(
                `Surface impact with ${(velocity / 1000).toFixed(2)} km/s residual velocity. ${(100 - energyLossPercent).toFixed(1)}% of initial energy delivered to surface.`
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
    // DAMAGE CALCULATIONS
    // ==========================================================================

    calculateDamages(asteroid, energy, atmosphericEntry) {
        const effectiveEnergyJoules = energy.joules *
            (1 - atmosphericEntry.energy_deposited_atmosphere_percent / 100);

        const isAirburst = atmosphericEntry.impact_type === 'Airburst';
        const burstHeight = atmosphericEntry.burst_altitude_m;

        const craterDiameter = isAirburst ? 0 : this.calculateCraterDiameter(
            asteroid.diameter_m,
            atmosphericEntry.final_velocity_ms,
            asteroid.density_kgm3,
            asteroid.target_density_kgm3,
            asteroid.impact_angle_rad
        );

        return {
            crater_diameter_m: craterDiameter,
            crater_depth_m: isAirburst ? 0 : this.calculateCraterDepth(craterDiameter),
            thermal_radius_3rd_degree_m: this.calculateThermalRadius(energy.joules, 'third_degree', isAirburst, burstHeight),
            thermal_radius_2nd_degree_m: this.calculateThermalRadius(energy.joules, 'second_degree', isAirburst, burstHeight),
            thermal_radius_1st_degree_m: this.calculateThermalRadius(energy.joules, 'first_degree', isAirburst, burstHeight),
            seismic_magnitude: this.calculateSeismicMagnitude(effectiveEnergyJoules, isAirburst),
            seismic_damage_radius_m: this.calculateSeismicDamageRadius(
                this.calculateSeismicMagnitude(effectiveEnergyJoules, isAirburst)
            ),
            airblast_radius_1psi_m: this.calculateAirblastRadius(energy.megatons, 1, burstHeight),
            airblast_radius_5psi_m: this.calculateAirblastRadius(energy.megatons, 5, burstHeight),
            airblast_radius_20psi_m: this.calculateAirblastRadius(energy.megatons, 20, burstHeight),
            fireball_radius_m: this.calculateFireballRadius(energy.megatons),
            ejecta_thickness_at_1km_m: isAirburst ? 0 : this.calculateEjectaThickness(craterDiameter, 1000),
        };
    }

    // --------------------------------------------------------------------------
    // CRATERING - Ref: Collins et al. (2005), Eq. 20-26
    // --------------------------------------------------------------------------

    calculateCraterDiameter(impactorDiameter_m, impactVelocity_ms, impactorDensity, targetDensity, impactAngle_rad) {
        if (impactorDiameter_m <= 0 || impactVelocity_ms <= 0) return 0;

        const C_D = 1.03;
        const beta = 0.22;
        const Y = 1.0e6;

        const L = impactorDiameter_m;
        const v = impactVelocity_ms;
        const g = CONSTANTS.GRAVITY_MS2;

        const pi2 = (g * L) / (v * v);
        const pi3 = Y / (targetDensity * v * v);

        const densityFactor = Math.pow(impactorDensity / targetDensity, 1 / 3);
        const sinTheta = Math.sin(impactAngle_rad);
        const angleCorrection = Math.pow(sinTheta, 1 / 3);

        const D_transient = C_D * L * densityFactor * Math.pow(pi2 + pi3, -beta) * angleCorrection;
        const D_final = 1.25 * D_transient;

        this.scientificNotes.push(
            `Crater diameter calculated using π-scaling: D_final = ${D_final.toFixed(0)} m [Ref: Collins et al. 2005, Eq. 24]`
        );

        return Math.max(0, D_final);
    }

    calculateCraterDepth(craterDiameter_m) {
        if (craterDiameter_m <= 0) return 0;
        const SIMPLE_COMPLEX_TRANSITION = 4000;

        if (craterDiameter_m < SIMPLE_COMPLEX_TRANSITION) {
            return 0.2 * craterDiameter_m;
        } else {
            const d_simple = 0.2 * SIMPLE_COMPLEX_TRANSITION;
            return d_simple * Math.pow(craterDiameter_m / SIMPLE_COMPLEX_TRANSITION, 0.3);
        }
    }

    // --------------------------------------------------------------------------
    // THERMAL RADIATION - Ref: Glasstone & Dolan (1977), Chapter 7
    // --------------------------------------------------------------------------

    calculateThermalRadius(energyJoules, severity, isAirburst, burstHeight_m) {
        if (energyJoules <= 0) return 0;

        const energyMT = energyJoules / CONSTANTS.MEGATON_JOULES;

        const FLUX_THRESHOLDS = {
            'first_degree': 125e3,
            'second_degree': 250e3,
            'third_degree': 500e3,
        };

        const thermalFraction = isAirburst ? 0.35 : 0.25;
        const thermalEnergy = energyJoules * thermalFraction;

        const threshold = FLUX_THRESHOLDS[severity];
        let theoreticalRadius = Math.sqrt(thermalEnergy / (4 * CONSTANTS.PI * threshold));

        // Atmospheric attenuation
        if (theoreticalRadius > 100000) {
            theoreticalRadius *= 0.75;
        } else if (theoreticalRadius > 50000) {
            theoreticalRadius *= 0.9;
        }

        // HORIZON CHECK - Critical for physical accuracy
        let horizonLimit = Infinity;

        if (isAirburst && burstHeight_m > 0) {
            horizonLimit = Math.sqrt(2 * CONSTANTS.EARTH_RADIUS_M * burstHeight_m);
        } else {
            const fireballRadius = this.calculateFireballRadius(energyMT);
            horizonLimit = Math.sqrt(2 * CONSTANTS.EARTH_RADIUS_M * fireballRadius);
        }

        const finalRadius = Math.min(theoreticalRadius, horizonLimit);

        if (finalRadius < theoreticalRadius && severity === 'third_degree') {
            this.scientificNotes.push(
                `Thermal radius for ${severity} burns limited by horizon: ${(finalRadius / 1000).toFixed(1)} km (theoretical: ${(theoreticalRadius / 1000).toFixed(1)} km)`
            );
        }

        return finalRadius;
    }

    calculateFireballRadius(energyMT) {
        if (energyMT <= 0) return 0;
        return 75 * Math.pow(energyMT, 0.4) * 1000;
    }

    // --------------------------------------------------------------------------
    // AIRBLAST - Ref: Glasstone & Dolan (1977), Chapter 3
    // --------------------------------------------------------------------------

    calculateAirblastRadius(energyMT, overpressurePsi, burstHeight_m) {
        if (energyMT <= 0) return 0;

        const SCALED_DISTANCES = {
            1: 13.0,
            5: 5.0,
            20: 2.0,
        };

        const Z = SCALED_DISTANCES[overpressurePsi] || 5.0;
        let radius_km = Z * Math.pow(energyMT, 1 / 3);

        if (burstHeight_m < 100) {
            radius_km *= 0.8;
        } else if (burstHeight_m > 10000) {
            radius_km *= 1.1;
        }

        return radius_km * 1000;
    }

    // --------------------------------------------------------------------------
    // SEISMIC - Ref: Gutenberg-Richter relation
    // --------------------------------------------------------------------------

    calculateSeismicMagnitude(energyJoules, isAirburst) {
        if (isAirburst) {
            this.scientificNotes.push('Seismic magnitude: minimal (airburst - no significant ground coupling)');
            return 0;
        }
        if (energyJoules <= 0) return 0;

        const SEISMIC_EFFICIENCY = 1e-4;
        const seismicEnergy = energyJoules * SEISMIC_EFFICIENCY;

        if (seismicEnergy <= 0) return 0;

        const magnitude = (Math.log10(seismicEnergy) - 4.8) / 1.5;
        const clampedMagnitude = Math.max(0, magnitude);

        this.scientificNotes.push(
            `Seismic magnitude: Mw ${clampedMagnitude.toFixed(1)} (seismic efficiency η = ${SEISMIC_EFFICIENCY}) [Ref: Gutenberg-Richter relation]`
        );

        return clampedMagnitude;
    }

    calculateSeismicDamageRadius(magnitude) {
        if (magnitude < 4.0) return 0;
        const radius_km = Math.pow(10, 0.5 * magnitude - 1.8);
        return radius_km * 1000;
    }

    // --------------------------------------------------------------------------
    // EJECTA - Ref: Melosh (1989), Eq. 6.2.3
    // --------------------------------------------------------------------------

    calculateEjectaThickness(craterDiameter_m, distance_m) {
        if (craterDiameter_m <= 0 || distance_m <= 0) return 0;

        const R_crater = craterDiameter_m / 2;
        if (distance_m <= R_crater) return 0;

        const t_rim = 0.14 * R_crater;
        const thickness = t_rim * Math.pow(distance_m / R_crater, -3);

        return Math.max(0, thickness);
    }
}

// ============================================================================
// TEST DEMO
// ============================================================================

console.log('='.repeat(80));
console.log('IMPACTPHYSICSENGINE - DEMONSTRATION');
console.log('='.repeat(80));

const engine = new ImpactPhysicsEngine();

// Test Case 1: Bennu
console.log('\n📌 TEST 1: 101955 Bennu');
console.log('-'.repeat(40));
const bennu = engine.simulate({
    name: "101955 Bennu",
    mass_kg: 7.329e10,
    diameter_km: 0.492,
    velocity_kms: 12.86,
    impact_angle_deg: 45,
    density_gcm3: 1.19,
    spectral_type: 'B',
    target_density_kgm3: 2500,
    latitude: 40.7128,
    longitude: -74.0060,
});
console.log(`   Energy: ${bennu.energy.megatons.toFixed(2)} MT TNT`);
console.log(`   Impact Type: ${bennu.physics.impact_type}`);
console.log(`   Crater: ${(bennu.results.crater_diameter_m / 1000).toFixed(2)} km diameter`);
console.log(`   Thermal (3rd°): ${(bennu.results.thermal_radius_3rd_degree_m / 1000).toFixed(2)} km`);
console.log(`   Airblast (5 psi): ${(bennu.results.airblast_radius_5psi_m / 1000).toFixed(2)} km`);

// Test Case 2: Small Asteroid (Tunguska-like)
console.log('\n📌 TEST 2: Tunguska Analog (~60m, C-type)');
console.log('-'.repeat(40));
const tunguska = engine.simulate({
    name: "Tunguska Analog",
    mass_kg: null,
    diameter_km: 0.06,
    velocity_kms: 15,
    impact_angle_deg: 35,
    density_gcm3: 1.3,
    spectral_type: 'C',
    target_density_kgm3: 2500,
    latitude: 60.917,
    longitude: 101.95,
});
console.log(`   Energy: ${tunguska.energy.megatons.toFixed(4)} MT TNT (${Math.round(tunguska.energy.hiroshima_equivalent)} Hiroshimas)`);
console.log(`   Impact Type: ${tunguska.physics.impact_type}`);
console.log(`   Burst Altitude: ${(tunguska.physics.burst_altitude_m / 1000).toFixed(1)} km`);
console.log(`   Airblast (1 psi): ${(tunguska.results.airblast_radius_1psi_m / 1000).toFixed(2)} km`);

// Test Case 3: Chicxulub-scale
console.log('\n📌 TEST 3: Chicxulub Analog (10 km, S-type)');
console.log('-'.repeat(40));
const chicxulub = engine.simulate({
    name: "Chicxulub Analog",
    mass_kg: null,
    diameter_km: 10,
    velocity_kms: 20,
    impact_angle_deg: 60,
    density_gcm3: null,
    spectral_type: 'S',
    target_density_kgm3: 2700,
    latitude: 21.4,
    longitude: -89.5,
});
console.log(`   Energy: ${chicxulub.energy.megatons.toExponential(2)} MT TNT`);
console.log(`   Impact Type: ${chicxulub.physics.impact_type}`);
console.log(`   Crater: ${(chicxulub.results.crater_diameter_m / 1000).toFixed(1)} km diameter`);
console.log(`   Seismic Magnitude: Mw ${chicxulub.results.seismic_magnitude.toFixed(1)}`);
console.log(`   Thermal (3rd°): ${(chicxulub.results.thermal_radius_3rd_degree_m / 1000).toFixed(1)} km`);

console.log('\n' + '='.repeat(80));
console.log('🔬 SCIENTIFIC NOTES (Chicxulub Example):');
chicxulub.scientific_notes.forEach(note => console.log(`   • ${note}`));
console.log('='.repeat(80));
