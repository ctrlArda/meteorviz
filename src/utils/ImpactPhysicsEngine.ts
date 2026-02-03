/**
 * @fileoverview ImpactPhysicsEngine - Production-Grade Asteroid Impact Simulator
 * 
 * Scientific References:
 * [1] Collins, G.S., Melosh, H.J., & Marcus, R.A. (2005). "Earth Impact Effects Program."
 *     Meteoritics & Planetary Science, 40(6), 817-840. DOI: 10.1111/j.1945-5100.2005.tb00157.x
 * [2] Glasstone, S., & Dolan, P.J. (1977). "The Effects of Nuclear Weapons." 3rd Ed.
 *     U.S. Department of Defense and Energy Research and Development Administration.
 * [3] Melosh, H.J. (1989). "Impact Cratering: A Geologic Process." Oxford University Press.
 * [4] Chyba, C.F., Thomas, P.J., & Zahnle, K.J. (1993). "The 1908 Tunguska explosion."
 *     Nature, 361, 40-44.
 * 
 * @author MeteorViz Scientific Team
 * @version 3.0.0
 * @license MIT
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Input parameters for impact simulation.
 * All values should be positive; validation is performed internally.
 */
export interface ImpactInput {
    /** Asteroid mass in kilograms */
    mass_kg: number;
    /** Asteroid diameter in kilometers */
    diameter_km: number;
    /** Asteroid bulk density in g/cm³ (e.g., 1.3 for C-Type, 5.3 for M-Type) */
    density_gcm3: number;
    /** Impact velocity in km/s (typical range: 11-72 km/s, default: 17 km/s) */
    impact_velocity_kms: number;
    /** Impact angle from horizontal in degrees (default: 45°) */
    impact_angle_deg: number;
    /** Target surface density in kg/m³ (1000=Water, 2500=Sediment, 2700=Rock) */
    target_density_kgm3: number;
    /** Target latitude in degrees (-90 to 90) */
    target_latitude: number;
    /** Target longitude in degrees (-180 to 180) */
    target_longitude: number;
}

/**
 * Complete simulation output structure for frontend consumption.
 */
export interface SimulationResult {
    /** Energy calculations in multiple units */
    energy: {
        /** Total kinetic energy in Joules */
        joules: number;
        /** Energy in Megatons of TNT equivalent */
        megatons: number;
        /** Equivalent number of Hiroshima bombs (~15 kT each) */
        hiroshima_factor: number;
    };
    /** Impact outcome classification */
    outcome: {
        /** Whether the asteroid exploded in atmosphere or hit ground */
        type: 'Airburst' | 'Surface Impact';
        /** Altitude of atmospheric breakup in meters (null if surface impact) */
        breakup_altitude_m: number | null;
        /** Final crater diameter in meters (0 if airburst) */
        crater_diameter_m: number;
        /** Crater depth in meters (0 if airburst) */
        crater_depth_m: number;
    };
    /** Damage effect radii in meters */
    damage_radii: {
        /** Radius for 3rd degree burns / ignition (with horizon limit) */
        thermal_3rd_degree_m: number;
        /** Radius for 20 psi overpressure (reinforced structures destroyed) */
        airblast_20psi_m: number;
        /** Radius for 5 psi overpressure (most buildings collapse) */
        airblast_5psi_m: number;
        /** Radius for 1 psi overpressure (window breakage) */
        airblast_1psi_m: number;
        /** Seismic damage radius (Mercalli VI+ intensity) */
        earthquake_m: number;
        /** Equivalent earthquake magnitude (Moment Magnitude scale) */
        earthquake_magnitude: number;
    };
    /** Scientific notes explaining assumptions and model choices */
    scientific_notes: string[];
}

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

/**
 * Fundamental physical constants (SI units).
 * @internal
 */
const PHYS = {
    /** Earth's mean radius in meters (WGS84) */
    EARTH_RADIUS_M: 6.371e6,

    /** Gravitational acceleration at Earth's surface (m/s²) */
    GRAVITY: 9.80665,

    /** Sea-level atmospheric density (kg/m³) - ISA standard */
    RHO_AIR_0: 1.225,

    /** Atmospheric scale height (m) - exponential model */
    SCALE_HEIGHT: 8500,

    /** 1 Megaton TNT in Joules */
    MT_TO_JOULES: 4.184e15,

    /** Hiroshima bomb yield in Joules (~15 kilotons) */
    HIROSHIMA_JOULES: 6.3e13,

    /** Pi constant */
    PI: Math.PI,

    /** Drag coefficient for sphere */
    CD: 0.47,

    /** Heat transfer coefficient for ablation. Ref: Melosh 1989 */
    CH: 0.1,

    /** Heat of ablation for stony material (J/kg). Ref: Collins 2005 */
    Q_ABLATION: 8.0e6,
} as const;

/**
 * Default material strength values in Pascals.
 * Ref: Petrovic (2001), Collins et al. (2005) Table 2.
 * @internal
 */
const MATERIAL_STRENGTH: Record<string, number> = {
    ICE: 1.0e5,        // Comets, very weak
    CARBONACEOUS: 1.0e6, // C-type asteroids
    STONY: 1.0e7,      // S-type asteroids (chondrites)
    IRON: 1.0e8,       // M-type asteroids
};

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * ImpactPhysicsEngine - Calculates asteroid impact effects on Earth.
 * 
 * This class implements peer-reviewed scientific models to simulate:
 * - Atmospheric entry and potential airburst
 * - Crater formation (if surface impact)
 * - Thermal radiation damage
 * - Airblast (shockwave) propagation
 * - Seismic effects
 * 
 * @example
 * ```typescript
 * const engine = new ImpactPhysicsEngine();
 * const result = engine.simulate({
 *   mass_kg: 7.329e10,
 *   diameter_km: 0.492,
 *   density_gcm3: 1.19,
 *   impact_velocity_kms: 12.86,
 *   impact_angle_deg: 45,
 *   target_density_kgm3: 2500,
 *   target_latitude: 40.7128,
 *   target_longitude: -74.006
 * });
 * console.log(`Impact Type: ${result.outcome.type}`);
 * console.log(`Energy: ${result.energy.megatons.toFixed(2)} MT`);
 * ```
 */
export class ImpactPhysicsEngine {
    private notes: string[] = [];

    /**
     * Main simulation entry point.
     * 
     * @param input - Asteroid and target parameters
     * @returns Complete simulation results
     * @throws Error if input validation fails
     */
    public simulate(input: ImpactInput): SimulationResult {
        // Reset notes for this simulation
        this.notes = [];

        // Step 1: Validate and normalize input
        this.validateInput(input);
        const params = this.normalizeInput(input);

        // Step 2: Calculate initial kinetic energy
        const energy = this.calculateEnergy(params.mass_kg, params.velocity_ms);

        // Step 3: Simulate atmospheric entry
        const atmoResult = this.simulateAtmosphericEntry(params);

        // Step 4: Calculate damage effects
        const damages = this.calculateDamageRadii(
            energy,
            atmoResult,
            params.target_density_kgm3,
            params.diameter_m,
            params.density_kgm3,
            params.velocity_ms,
            params.angle_rad
        );

        // Compile final result
        return {
            energy: {
                joules: energy.joules,
                megatons: energy.megatons,
                hiroshima_factor: Math.round(energy.joules / PHYS.HIROSHIMA_JOULES),
            },
            outcome: {
                type: atmoResult.isAirburst ? 'Airburst' : 'Surface Impact',
                breakup_altitude_m: atmoResult.isAirburst ? atmoResult.burstAltitude : null,
                crater_diameter_m: damages.craterDiameter,
                crater_depth_m: damages.craterDepth,
            },
            damage_radii: {
                thermal_3rd_degree_m: damages.thermalRadius,
                airblast_20psi_m: damages.blast20psi,
                airblast_5psi_m: damages.blast5psi,
                airblast_1psi_m: damages.blast1psi,
                earthquake_m: damages.seismicRadius,
                earthquake_magnitude: damages.seismicMagnitude,
            },
            scientific_notes: [...this.notes],
        };
    }

    // ==========================================================================
    // INPUT VALIDATION & NORMALIZATION
    // ==========================================================================

    /**
     * Validates input parameters for physical plausibility.
     * @throws Error if any parameter is invalid
     */
    private validateInput(input: ImpactInput): void {
        if (input.mass_kg <= 0) {
            throw new Error(`Invalid mass: ${input.mass_kg} kg. Must be positive.`);
        }
        if (input.diameter_km <= 0) {
            throw new Error(`Invalid diameter: ${input.diameter_km} km. Must be positive.`);
        }
        if (input.density_gcm3 <= 0 || input.density_gcm3 > 8) {
            throw new Error(`Invalid density: ${input.density_gcm3} g/cm³. Expected 0.5-8.0.`);
        }
        if (input.impact_velocity_kms <= 0) {
            throw new Error(`Invalid velocity: ${input.impact_velocity_kms} km/s. Must be positive.`);
        }
        if (input.impact_velocity_kms > 72) {
            this.notes.push('Warning: Velocity exceeds solar system escape velocity (72 km/s). Results may be extrapolated.');
        }
        if (input.impact_angle_deg <= 0 || input.impact_angle_deg > 90) {
            throw new Error(`Invalid angle: ${input.impact_angle_deg}°. Must be 0° < angle ≤ 90°.`);
        }
        if (input.target_density_kgm3 <= 0) {
            throw new Error(`Invalid target density: ${input.target_density_kgm3} kg/m³.`);
        }
    }

    /**
     * Normalizes input to SI units and derives secondary parameters.
     */
    private normalizeInput(input: ImpactInput): {
        mass_kg: number;
        diameter_m: number;
        density_kgm3: number;
        velocity_ms: number;
        angle_rad: number;
        target_density_kgm3: number;
        materialStrength: number;
    } {
        const density_kgm3 = input.density_gcm3 * 1000;
        const diameter_m = input.diameter_km * 1000;
        const velocity_ms = input.impact_velocity_kms * 1000;
        const angle_rad = (input.impact_angle_deg * Math.PI) / 180;

        // Infer material strength from density
        let materialStrength: number;
        if (density_kgm3 < 1500) {
            materialStrength = MATERIAL_STRENGTH.CARBONACEOUS;
            this.notes.push(`Low density (${input.density_gcm3} g/cm³) suggests carbonaceous composition. Yield strength: 1 MPa.`);
        } else if (density_kgm3 < 4000) {
            materialStrength = MATERIAL_STRENGTH.STONY;
            this.notes.push(`Moderate density (${input.density_gcm3} g/cm³) suggests stony composition. Yield strength: 10 MPa.`);
        } else {
            materialStrength = MATERIAL_STRENGTH.IRON;
            this.notes.push(`High density (${input.density_gcm3} g/cm³) suggests iron-nickel composition. Yield strength: 100 MPa.`);
        }

        return {
            mass_kg: input.mass_kg,
            diameter_m,
            density_kgm3,
            velocity_ms,
            angle_rad,
            target_density_kgm3: input.target_density_kgm3,
            materialStrength,
        };
    }

    // ==========================================================================
    // ENERGY CALCULATION
    // ==========================================================================

    /**
     * Calculates kinetic energy.
     * 
     * Formula: E = ½mv²
     * 
     * @param mass_kg - Mass in kilograms
     * @param velocity_ms - Velocity in m/s
     * @returns Energy in Joules and Megatons
     */
    private calculateEnergy(mass_kg: number, velocity_ms: number): { joules: number; megatons: number } {
        const joules = 0.5 * mass_kg * velocity_ms * velocity_ms;
        const megatons = joules / PHYS.MT_TO_JOULES;

        this.notes.push(
            `Kinetic Energy: ${joules.toExponential(3)} J = ${megatons.toFixed(2)} MT TNT ` +
            `(${Math.round(joules / PHYS.HIROSHIMA_JOULES).toLocaleString()} Hiroshima bombs)`
        );

        return { joules, megatons };
    }

    // ==========================================================================
    // ATMOSPHERIC ENTRY MODEL
    // ==========================================================================

    /**
     * Simulates atmospheric entry using the pancake fragmentation model.
     * 
     * Physics:
     * - Ram Pressure: P_ram = ρ_air × v²
     * - Breakup occurs when P_ram > σ_yield (material strength)
     * - After breakup, debris cloud expands, increasing drag
     * 
     * Ref: Collins et al. (2005), Section 3; Chyba et al. (1993)
     * 
     * @returns Airburst status and final impact parameters
     */
    private simulateAtmosphericEntry(params: {
        mass_kg: number;
        diameter_m: number;
        density_kgm3: number;
        velocity_ms: number;
        angle_rad: number;
        materialStrength: number;
    }): {
        isAirburst: boolean;
        burstAltitude: number;
        finalVelocity: number;
        finalMass: number;
        energyDeliveredToGround: number;
    } {
        // Large impactors (>200m) pass through atmosphere with minimal deceleration
        // Ref: Collins 2005, empirical threshold
        const LARGE_IMPACTOR_THRESHOLD = 200;

        if (params.diameter_m > LARGE_IMPACTOR_THRESHOLD) {
            const dragLoss = 0.02; // ~2% speed loss
            this.notes.push(
                `Large impactor (D=${(params.diameter_m).toFixed(0)}m > ${LARGE_IMPACTOR_THRESHOLD}m): ` +
                `Minimal atmospheric deceleration. [Ref: Collins 2005]`
            );
            return {
                isAirburst: false,
                burstAltitude: 0,
                finalVelocity: params.velocity_ms * (1 - dragLoss),
                finalMass: params.mass_kg * 0.99,
                energyDeliveredToGround: 1 - dragLoss * 2,
            };
        }

        // For smaller objects, run detailed simulation
        return this.runAtmosphericSimulation(params);
    }

    /**
     * Detailed atmospheric entry simulation using Euler integration.
     * 
     * Equations of motion (Ref: Melosh 1989, Eq. 8.2):
     * - dv/dt = -(ρ_air × A × C_d × v²) / (2m) - g×sin(θ)
     * - dm/dt = -(C_h × ρ_air × A × v³) / (2Q)
     * - dh/dt = -v × sin(θ)
     * 
     * Breakup condition: ρ_air × v² > σ_yield
     */
    private runAtmosphericSimulation(params: {
        mass_kg: number;
        diameter_m: number;
        density_kgm3: number;
        velocity_ms: number;
        angle_rad: number;
        materialStrength: number;
    }): {
        isAirburst: boolean;
        burstAltitude: number;
        finalVelocity: number;
        finalMass: number;
        energyDeliveredToGround: number;
    } {
        // Initial conditions
        let h = 100000; // Start at 100 km (Kármán line)
        let v = params.velocity_ms;
        let m = params.mass_kg;
        let r = params.diameter_m / 2;

        const dt = 0.005; // 5ms time step
        const sinTheta = Math.sin(params.angle_rad);
        const rho_impactor = params.density_kgm3;
        const sigma = params.materialStrength;

        let brokenUp = false;
        let breakupAlt = 0;
        const v0 = v;

        // Maximum iterations (safety limit)
        const MAX_ITER = 2_000_000;

        for (let i = 0; i < MAX_ITER; i++) {
            // Termination conditions
            if (h <= 0) break; // Hit ground
            if (v < 100) break; // Effectively stopped
            if (m <= 0) break;  // Completely ablated

            // Atmospheric density: ρ(h) = ρ₀ × exp(-h/H)
            const rho_air = PHYS.RHO_AIR_0 * Math.exp(-h / PHYS.SCALE_HEIGHT);

            // Current cross-section
            const A = PHYS.PI * r * r;

            // Ram (stagnation) pressure: P = ρ × v²
            const P_ram = rho_air * v * v;

            // Check for breakup
            if (!brokenUp && P_ram > sigma) {
                brokenUp = true;
                breakupAlt = h;
                this.notes.push(
                    `Fragmentation at ${(h / 1000).toFixed(1)} km: ` +
                    `Ram pressure (${(P_ram / 1e6).toFixed(1)} MPa) exceeded yield strength ` +
                    `(${(sigma / 1e6).toFixed(1)} MPa). [Ref: Collins 2005, Eq. 8]`
                );
            }

            // Post-breakup: debris cloud expands (pancake model)
            let A_eff = A;
            if (brokenUp) {
                const spread = 1 + (breakupAlt - h) / (2 * PHYS.SCALE_HEIGHT);
                A_eff = A * Math.min(spread * spread, 25); // Cap at 5x radius expansion
            }

            // Drag force: F_d = ½ × C_d × ρ × A × v²
            const F_drag = 0.5 * PHYS.CD * rho_air * A_eff * v * v;

            // Deceleration: dv/dt = -F_d/m - g×sin(θ)
            const dv = (-F_drag / m - PHYS.GRAVITY * sinTheta) * dt;

            // Mass ablation rate: dm/dt = -(C_h × ρ × A × v³) / (2Q)
            const dm = ((-PHYS.CH * rho_air * A_eff * v * v * v) / (2 * PHYS.Q_ABLATION)) * dt;

            // Altitude change: dh/dt = -v × sin(θ)
            const dh = -v * sinTheta * dt;

            // Update state
            v = Math.max(0, v + dv);
            m = Math.max(0, m + dm);
            h = h + dh;

            // Update radius from remaining mass
            if (m > 0) {
                r = Math.cbrt((3 * m) / (4 * PHYS.PI * rho_impactor));
            }

            // Airburst check: velocity dropped significantly while still high up
            if (brokenUp && v < 3000 && h > 5000) {
                const energyLost = 1 - (v * v) / (v0 * v0);
                this.notes.push(
                    `Airburst at ${(h / 1000).toFixed(1)} km altitude. ` +
                    `${(energyLost * 100).toFixed(0)}% of energy deposited to atmosphere. [Ref: Chyba 1993]`
                );
                return {
                    isAirburst: true,
                    burstAltitude: h,
                    finalVelocity: v,
                    finalMass: m,
                    energyDeliveredToGround: 1 - energyLost,
                };
            }
        }

        // Reached ground
        const energyRemaining = (v * v) / (v0 * v0);

        if (v > 1000 && h <= 0) {
            this.notes.push(
                `Surface impact at ${(v / 1000).toFixed(2)} km/s. ` +
                `${(energyRemaining * 100).toFixed(0)}% of initial energy delivered to surface.`
            );
        }

        return {
            isAirburst: false,
            burstAltitude: brokenUp ? breakupAlt : 0,
            finalVelocity: v,
            finalMass: m,
            energyDeliveredToGround: energyRemaining,
        };
    }

    // ==========================================================================
    // DAMAGE CALCULATION
    // ==========================================================================

    /**
     * Calculates all damage mechanism radii.
     */
    private calculateDamageRadii(
        energy: { joules: number; megatons: number },
        atmo: { isAirburst: boolean; burstAltitude: number; finalVelocity: number; finalMass: number; energyDeliveredToGround: number },
        targetDensity: number,
        diameter_m: number,
        impactorDensity: number,
        velocity_ms: number,
        angle_rad: number
    ): {
        craterDiameter: number;
        craterDepth: number;
        thermalRadius: number;
        blast20psi: number;
        blast5psi: number;
        blast1psi: number;
        seismicRadius: number;
        seismicMagnitude: number;
    } {
        const isAirburst = atmo.isAirburst;
        const burstHeight = atmo.burstAltitude;

        // Effective energy for ground effects
        const E_ground = energy.joules * atmo.energyDeliveredToGround;
        const E_mt = energy.megatons;

        // ----- CRATER (only for surface impact) -----
        let craterDiameter = 0;
        let craterDepth = 0;

        if (!isAirburst) {
            craterDiameter = this.calculateCraterDiameter(
                diameter_m,
                atmo.finalVelocity,
                impactorDensity,
                targetDensity,
                angle_rad
            );
            craterDepth = this.calculateCraterDepth(craterDiameter);
        }

        // ----- THERMAL RADIATION -----
        const thermalRadius = this.calculateThermalRadius(energy.joules, isAirburst, burstHeight);

        // ----- AIRBLAST -----
        const blast20psi = this.calculateAirblastRadius(E_mt, 20, burstHeight);
        const blast5psi = this.calculateAirblastRadius(E_mt, 5, burstHeight);
        const blast1psi = this.calculateAirblastRadius(E_mt, 1, burstHeight);

        // ----- SEISMIC -----
        const seismicMagnitude = this.calculateSeismicMagnitude(E_ground, isAirburst);
        const seismicRadius = this.calculateSeismicDamageRadius(seismicMagnitude);

        return {
            craterDiameter,
            craterDepth,
            thermalRadius,
            blast20psi,
            blast5psi,
            blast1psi,
            seismicRadius,
            seismicMagnitude,
        };
    }

    // --------------------------------------------------------------------------
    // CRATER SCALING - Ref: Collins et al. (2005), Eq. 20-26
    // --------------------------------------------------------------------------

    /**
     * Calculates final crater diameter using π-scaling laws.
     * 
     * Uses gravity-regime scaling from Holsapple (1993):
     * 
     *   D_tc = 1.161 × (ρ_i/ρ_t)^(1/3) × L^0.78 × v^0.44 × g^(-0.22) × sin(θ)^(1/3)
     *   D_final ≈ 1.25 × D_tc (simple crater collapse)
     * 
     * Ref: Collins et al. (2005), Eq. 24.
     */
    private calculateCraterDiameter(
        L: number,         // Impactor diameter (m)
        v: number,         // Impact velocity (m/s)
        rho_i: number,     // Impactor density (kg/m³)
        rho_t: number,     // Target density (kg/m³)
        theta: number      // Impact angle (radians)
    ): number {
        if (L <= 0 || v <= 0) return 0;

        const g = PHYS.GRAVITY;

        // Pi-scaling formula (gravity regime)
        // Ref: Collins 2005, Eq. 24
        const densityRatio = Math.pow(rho_i / rho_t, 1 / 3);
        const sizeScale = Math.pow(L, 0.78);
        const velocityScale = Math.pow(v, 0.44);
        const gravityScale = Math.pow(g, -0.22);
        const angleScale = Math.pow(Math.sin(theta), 1 / 3);

        const D_transient = 1.161 * densityRatio * sizeScale * velocityScale * gravityScale * angleScale;

        // Simple-to-complex transition: D_final ≈ 1.25 × D_tc
        const D_final = 1.25 * D_transient;

        this.notes.push(
            `Crater diameter: ${(D_final / 1000).toFixed(2)} km ` +
            `(Transient: ${(D_transient / 1000).toFixed(2)} km). [Ref: Collins 2005, Eq. 24]`
        );

        return Math.max(0, D_final);
    }

    /**
     * Calculates crater depth from diameter.
     * 
     * Simple craters: d/D ≈ 0.2
     * Complex craters (D > 4km on Earth): shallower due to rebound
     * 
     * Ref: Melosh (1989), Chapter 5; Pike (1977)
     */
    private calculateCraterDepth(D: number): number {
        if (D <= 0) return 0;

        const TRANSITION_D = 4000; // Simple-to-complex transition on Earth

        if (D < TRANSITION_D) {
            return 0.2 * D;
        } else {
            // Complex crater depth scales as D^0.3
            const d_simple = 0.2 * TRANSITION_D;
            return d_simple * Math.pow(D / TRANSITION_D, 0.3);
        }
    }

    // --------------------------------------------------------------------------
    // THERMAL RADIATION - Ref: Glasstone & Dolan (1977), Chapter 7
    // --------------------------------------------------------------------------

    /**
     * Calculates thermal radiation damage radius for 3rd-degree burns.
     * 
     * CRITICAL: Implements "Horizon Check" - thermal radiation travels
     * in straight lines and cannot curve around Earth.
     * 
     * Horizon distance: d_h = √(2 × R_earth × h)
     * 
     * Scaling: R_thermal ∝ √E (square-root of yield)
     * 
     * Ref: Glasstone & Dolan (1977), Eq. 7.68
     */
    private calculateThermalRadius(
        E_joules: number,
        isAirburst: boolean,
        burstHeight_m: number
    ): number {
        if (E_joules <= 0) return 0;

        const E_mt = E_joules / PHYS.MT_TO_JOULES;

        // Thermal flux threshold for 3rd-degree burns: ~500 kJ/m²
        // Ref: Glasstone 1977, Table 12.29
        const Q_3RD_DEGREE = 5.0e5; // J/m²

        // Thermal energy fraction (higher for airbursts)
        const thermalFraction = isAirburst ? 0.35 : 0.25;
        const E_thermal = E_joules * thermalFraction;

        // Theoretical radius: R = √(E_thermal / (4π × Q))
        let R_theory = Math.sqrt(E_thermal / (4 * PHYS.PI * Q_3RD_DEGREE));

        // Atmospheric attenuation for very long paths (>100km)
        if (R_theory > 100000) {
            R_theory *= 0.7;
        } else if (R_theory > 50000) {
            R_theory *= 0.85;
        }

        // ===== HORIZON CHECK (CRITICAL) =====
        // Thermal radiation travels in straight lines.
        // It cannot reach observers beyond the geometric horizon.
        // d_horizon = √(2 × R_earth × h_source)

        let sourceHeight: number;
        if (isAirburst && burstHeight_m > 0) {
            sourceHeight = burstHeight_m;
        } else {
            // For surface bursts, use fireball rise height
            // Empirical: h_fireball ≈ 75 × Y^0.4 (km, for Y in MT)
            sourceHeight = 75 * Math.pow(E_mt, 0.4) * 1000;
        }

        const horizonLimit = Math.sqrt(2 * PHYS.EARTH_RADIUS_M * sourceHeight);

        const R_final = Math.min(R_theory, horizonLimit);

        if (R_final < R_theory) {
            this.notes.push(
                `Thermal radius limited by horizon: ${(R_final / 1000).toFixed(1)} km ` +
                `(theoretical: ${(R_theory / 1000).toFixed(1)} km). ` +
                `[Horizon formula: d = √(2Rh), Glasstone 1977]`
            );
        }

        return R_final;
    }

    // --------------------------------------------------------------------------
    // AIRBLAST - Ref: Glasstone & Dolan (1977), Chapter 3
    // --------------------------------------------------------------------------

    /**
     * Calculates airblast damage radius for given overpressure.
     * 
     * Uses Hopkinson-Cranz cube-root scaling:
     *   R = Z × Y^(1/3)
     * 
     * Where Z is scaled distance for target overpressure.
     * 
     * Overpressure effects:
     * - 20 psi (140 kPa): Reinforced concrete destroyed, nearly 100% fatalities
     * - 5 psi (35 kPa): Most buildings collapse, 50% fatalities
     * - 1 psi (7 kPa): Window breakage, light damage
     * 
     * Ref: Glasstone & Dolan (1977), Fig. 3.73
     */
    private calculateAirblastRadius(
        E_mt: number,
        overpressure_psi: number,
        burstHeight_m: number
    ): number {
        if (E_mt <= 0) return 0;

        // Scaled distances in km per MT^(1/3) for sea-level air
        // Derived from Glasstone & Dolan (1977), Fig. 3.73
        const SCALED_DISTANCE: Record<number, number> = {
            20: 2.0,   // Heavy destruction
            5: 5.0,    // Building collapse
            1: 13.0,   // Window breakage
        };

        const Z = SCALED_DISTANCE[overpressure_psi] ?? 5.0;
        let R_km = Z * Math.pow(E_mt, 1 / 3);

        // Height-of-burst correction
        // Surface bursts lose ~20% range due to ground absorption
        // High airbursts gain ~10% from Mach stem enhancement
        if (burstHeight_m < 100) {
            R_km *= 0.8;
        } else if (burstHeight_m > 10000) {
            R_km *= 1.1;
        }

        return R_km * 1000; // Convert to meters
    }

    // --------------------------------------------------------------------------
    // SEISMIC EFFECTS - Ref: Gutenberg-Richter relation
    // --------------------------------------------------------------------------

    /**
     * Calculates equivalent earthquake magnitude from impact energy.
     * 
     * Uses modified Gutenberg-Richter relation:
     *   log₁₀(E_seismic) = 1.5 × M_w + 4.8
     * 
     * Seismic coupling efficiency η ≈ 10⁻⁴ (0.01%) for impacts.
     * 
     * Note: Airbursts produce minimal seismic effects.
     * 
     * Ref: Kanamori (1977); Collins et al. (2005), Section 6
     */
    private calculateSeismicMagnitude(E_joules: number, isAirburst: boolean): number {
        if (isAirburst) {
            this.notes.push('Seismic effects minimal: airburst does not couple energy to ground.');
            return 0;
        }

        if (E_joules <= 0) return 0;

        // Seismic efficiency: ~10⁻⁴ for impacts
        const SEISMIC_EFF = 1e-4;
        const E_seismic = E_joules * SEISMIC_EFF;

        // Gutenberg-Richter: log₁₀(E) = 1.5×Mw + 4.8
        // Solving: Mw = (log₁₀(E) - 4.8) / 1.5
        const Mw = (Math.log10(E_seismic) - 4.8) / 1.5;

        const Mw_clamped = Math.max(0, Mw);

        this.notes.push(
            `Seismic equivalent: Mw ${Mw_clamped.toFixed(1)} ` +
            `(η = 10⁻⁴). [Ref: Gutenberg-Richter]`
        );

        return Mw_clamped;
    }

    /**
     * Calculates radius of strong shaking (Modified Mercalli Intensity VI+).
     * 
     * MMI VI: "Felt by all, heavy furniture may move, plaster cracks."
     * 
     * Empirical attenuation: R ≈ 10^(0.5×Mw - 1.8) km
     */
    private calculateSeismicDamageRadius(Mw: number): number {
        if (Mw < 4.0) return 0; // Below damage threshold

        const R_km = Math.pow(10, 0.5 * Mw - 1.8);
        return R_km * 1000; // Convert to meters
    }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// Example: Simulate asteroid Bennu impact

import { ImpactPhysicsEngine, ImpactInput } from './ImpactPhysicsEngine';

const engine = new ImpactPhysicsEngine();

const bennuImpact: ImpactInput = {
  mass_kg: 7.329e10,           // Known mass from OSIRIS-REx
  diameter_km: 0.492,           // 492 meters
  density_gcm3: 1.19,           // Measured bulk density
  impact_velocity_kms: 12.86,   // Close approach velocity
  impact_angle_deg: 45,         // Most probable angle
  target_density_kgm3: 2500,    // Sedimentary rock
  target_latitude: 40.7128,     // New York City
  target_longitude: -74.006,
};

const result = engine.simulate(bennuImpact);

console.log('=== BENNU IMPACT SIMULATION ===');
console.log(`Energy: ${result.energy.megatons.toFixed(2)} Megatons (${result.energy.hiroshima_factor.toLocaleString()} Hiroshimas)`);
console.log(`Outcome: ${result.outcome.type}`);
if (result.outcome.crater_diameter_m > 0) {
  console.log(`Crater: ${(result.outcome.crater_diameter_m / 1000).toFixed(2)} km diameter, ${result.outcome.crater_depth_m.toFixed(0)} m deep`);
}
console.log(`Thermal (3rd° burns): ${(result.damage_radii.thermal_3rd_degree_m / 1000).toFixed(1)} km`);
console.log(`Airblast (5 psi): ${(result.damage_radii.airblast_5psi_m / 1000).toFixed(1)} km`);
console.log(`Earthquake: Mw ${result.damage_radii.earthquake_magnitude.toFixed(1)}`);
console.log('\nScientific Notes:');
result.scientific_notes.forEach(note => console.log(`  • ${note}`));
*/

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default ImpactPhysicsEngine;
