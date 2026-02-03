/**
 * @fileoverview Test & Demo Script for ImpactPhysicsEngine
 * 
 * This file demonstrates the usage of ImpactPhysicsEngine with real asteroid data.
 * Run with: npx ts-node test_impact_engine.ts
 */

import ImpactPhysicsEngine, { AsteroidInput, SimulationResult } from './ImpactPhysicsEngine';

// ============================================================================
// TEST CASES
// ============================================================================

const testCases: AsteroidInput[] = [
    // Case 1: Bennu (B-type, well-characterized asteroid)
    {
        name: "101955 Bennu",
        mass_kg: 7.329e10, // Known mass
        diameter_km: 0.492,
        velocity_kms: 12.86, // Relative velocity at close approach
        impact_angle_deg: 45,
        density_gcm3: 1.19, // Measured by OSIRIS-REx
        spectral_type: 'B',
        target_density_kgm3: 2500,
        latitude: 40.7128,
        longitude: -74.0060, // New York City
    },

    // Case 2: Small S-type asteroid (diameter only, no mass)
    {
        name: "2024 PT5",
        mass_kg: null, // Must be calculated
        diameter_km: 0.01, // 10 meters
        velocity_kms: 15,
        impact_angle_deg: 45,
        density_gcm3: null, // Must be inferred from spectral type
        spectral_type: 'S',
        target_density_kgm3: 2500,
        latitude: 51.5074,
        longitude: -0.1278, // London
    },

    // Case 3: Iron meteorite (M-type)
    {
        name: "Hypothetical M-Type",
        mass_kg: null,
        diameter_km: 0.05, // 50 meters
        velocity_kms: 20,
        impact_angle_deg: 60,
        density_gcm3: null,
        spectral_type: 'M',
        target_density_kgm3: 2700,
        latitude: 35.6762,
        longitude: 139.6503, // Tokyo
    },

    // Case 4: Tunguska-like event (C-type, ~50m)
    {
        name: "Tunguska Analog",
        mass_kg: null,
        diameter_km: 0.06, // ~60 meters
        velocity_kms: 15,
        impact_angle_deg: 35,
        density_gcm3: 1.3,
        spectral_type: 'C',
        target_density_kgm3: 2500,
        latitude: 60.917,
        longitude: 101.95, // Tunguska region
    },

    // Case 5: Large Chicxulub-scale impactor
    {
        name: "Chicxulub Analog",
        mass_kg: null,
        diameter_km: 10, // 10 km
        velocity_kms: 20,
        impact_angle_deg: 60,
        density_gcm3: null,
        spectral_type: 'S',
        target_density_kgm3: 2700,
        latitude: 21.4,
        longitude: -89.5, // Yucatan
    },
];

// ============================================================================
// RUN TESTS
// ============================================================================

function runTests(): void {
    const engine = new ImpactPhysicsEngine();

    console.log('='.repeat(80));
    console.log('IMPACTPHYSICSENGINE - TEST SUITE');
    console.log('='.repeat(80));
    console.log();

    for (const testCase of testCases) {
        console.log('-'.repeat(80));
        console.log(`TEST: ${testCase.name}`);
        console.log('-'.repeat(80));

        try {
            const result = engine.simulate(testCase);
            printResult(result);
        } catch (error) {
            console.error(`ERROR: ${(error as Error).message}`);
        }

        console.log();
    }
}

function printResult(result: SimulationResult): void {
    console.log('\n📊 INPUT SUMMARY:');
    console.log(`   Name: ${result.input_summary.name}`);
    console.log(`   Diameter: ${result.input_summary.diameter_m.toFixed(1)} m`);
    console.log(`   Velocity: ${result.input_summary.velocity_kms.toFixed(2)} km/s`);
    console.log(`   Impact Angle: ${result.input_summary.impact_angle_deg.toFixed(1)}°`);
    console.log(`   Density: ${result.input_summary.density_kgm3.toFixed(0)} kg/m³`);

    console.log('\n⚡ ENERGY:');
    console.log(`   Total: ${result.energy.joules.toExponential(3)} J`);
    console.log(`   TNT Equivalent: ${result.energy.megatons.toFixed(4)} MT`);
    console.log(`   Hiroshima Equivalent: ${Math.round(result.energy.hiroshima_equivalent).toLocaleString()} bombs`);

    console.log('\n🌀 ATMOSPHERIC PHYSICS:');
    console.log(`   Impact Type: ${result.physics.impact_type}`);
    console.log(`   Burst Altitude: ${(result.physics.burst_altitude_m / 1000).toFixed(2)} km`);
    console.log(`   Fragmented: ${result.physics.broken_up ? 'Yes' : 'No'}`);
    console.log(`   Final Velocity: ${(result.physics.final_velocity_ms / 1000).toFixed(2)} km/s`);
    console.log(`   Energy to Atmosphere: ${result.physics.energy_deposited_atmosphere_percent.toFixed(1)}%`);

    console.log('\n💥 DAMAGE RESULTS:');
    if (result.physics.impact_type === 'Crater') {
        console.log(`   Crater Diameter: ${result.results.crater_diameter_m.toFixed(0)} m (${(result.results.crater_diameter_m / 1000).toFixed(2)} km)`);
        console.log(`   Crater Depth: ${result.results.crater_depth_m.toFixed(0)} m`);
    }
    console.log(`   Fireball Radius: ${(result.results.fireball_radius_m / 1000).toFixed(2)} km`);
    console.log(`   Thermal (3rd° Burns): ${(result.results.thermal_radius_3rd_degree_m / 1000).toFixed(2)} km`);
    console.log(`   Airblast (1 psi): ${(result.results.airblast_radius_1psi_m / 1000).toFixed(2)} km`);
    console.log(`   Airblast (5 psi): ${(result.results.airblast_radius_5psi_m / 1000).toFixed(2)} km`);
    console.log(`   Airblast (20 psi): ${(result.results.airblast_radius_20psi_m / 1000).toFixed(2)} km`);
    console.log(`   Seismic Magnitude: Mw ${result.results.seismic_magnitude.toFixed(1)}`);
    if (result.results.seismic_damage_radius_m > 0) {
        console.log(`   Seismic Damage Radius: ${(result.results.seismic_damage_radius_m / 1000).toFixed(2)} km`);
    }

    console.log('\n📝 SCIENTIFIC NOTES:');
    for (const note of result.scientific_notes) {
        console.log(`   • ${note}`);
    }

    console.log(`\n🕐 Computed: ${result.computation_timestamp}`);
    console.log(`📦 Model Version: ${result.model_version}`);
}

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

function runEdgeCaseTests(): void {
    const engine = new ImpactPhysicsEngine();

    console.log('\n');
    console.log('='.repeat(80));
    console.log('EDGE CASE TESTS');
    console.log('='.repeat(80));

    // Test 1: Zero velocity (should throw)
    console.log('\n[TEST] Zero velocity...');
    try {
        engine.simulate({
            name: "Zero Velocity",
            mass_kg: 1000,
            diameter_km: 0.001,
            velocity_kms: 0,
            impact_angle_deg: 45,
            density_gcm3: 3.0,
            spectral_type: 'S',
            target_density_kgm3: 2500,
            latitude: 0,
            longitude: 0,
        });
        console.log('   ❌ FAILED - Should have thrown error');
    } catch (e) {
        console.log(`   ✅ PASSED - Error: ${(e as Error).message}`);
    }

    // Test 2: Missing both mass and diameter (should throw)
    console.log('\n[TEST] Missing mass and diameter...');
    try {
        engine.simulate({
            name: "Missing Data",
            mass_kg: null,
            diameter_km: null,
            velocity_kms: 15,
            impact_angle_deg: 45,
            density_gcm3: 3.0,
            spectral_type: 'S',
            target_density_kgm3: 2500,
            latitude: 0,
            longitude: 0,
        });
        console.log('   ❌ FAILED - Should have thrown error');
    } catch (e) {
        console.log(`   ✅ PASSED - Error: ${(e as Error).message}`);
    }

    // Test 3: Invalid angle (should throw)
    console.log('\n[TEST] Invalid impact angle (0°)...');
    try {
        engine.simulate({
            name: "Bad Angle",
            mass_kg: 1000,
            diameter_km: 0.001,
            velocity_kms: 15,
            impact_angle_deg: 0,
            density_gcm3: 3.0,
            spectral_type: 'S',
            target_density_kgm3: 2500,
            latitude: 0,
            longitude: 0,
        });
        console.log('   ❌ FAILED - Should have thrown error');
    } catch (e) {
        console.log(`   ✅ PASSED - Error: ${(e as Error).message}`);
    }

    // Test 4: Unknown spectral type (should use default)
    console.log('\n[TEST] Unknown spectral type...');
    try {
        const result = engine.simulate({
            name: "Unknown Type",
            mass_kg: null,
            diameter_km: 0.01,
            velocity_kms: 15,
            impact_angle_deg: 45,
            density_gcm3: null,
            spectral_type: 'Z', // Unknown
            target_density_kgm3: 2500,
            latitude: 0,
            longitude: 0,
        });
        const usedDefault = result.scientific_notes.some(n => n.includes("unknown spectral type"));
        console.log(`   ${usedDefault ? '✅ PASSED' : '❌ FAILED'} - Used default density for unknown type`);
    } catch (e) {
        console.log(`   ❌ FAILED - Error: ${(e as Error).message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('ALL TESTS COMPLETE');
    console.log('='.repeat(80));
}

// Run all tests
runTests();
runEdgeCaseTests();
