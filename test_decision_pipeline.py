"""
Test the Decision Support Pipeline with Chelyabinsk-like parameters.
"""

from decision_support_engine import DecisionSupportEngine
import json

# Test full pipeline with Chelyabinsk-like parameters
engine = DecisionSupportEngine()

print("=" * 60)
print("DECISION SUPPORT PIPELINE TEST")
print("=" * 60)
print()

result = engine.run_full_pipeline(
    scenario_id='test_chelyabinsk',
    mass_kg=12000000,  # ~12,000 tons
    velocity_kms=19.16,
    angle_deg=18,
    density_kgm3=3300,
    diameter_m=20,
    lat=55.09,
    lon=61.40,
    is_ocean=False,
    country='Russia',
    impact_probability=1.0,
    affected_plants=[],
    base_population=1000000,
    observation_arc_days=0
)

print(f"Scenario: {result.scenario_id}")
print(f"Hash: {result.scenario_hash}")
print(f"Overall Confidence: {result.overall_confidence}")
print(f"Datasets Active: {result.datasets_active}/{result.datasets_total}")
print()

print("DETECTION ASSESSMENT:")
print(f"  Detection Probability: {result.detection.detection_probability:.4f}")
print(f"  Warning Time: {result.detection.warning_time_days.mean:.1f} days")
print(f"    CI: [{result.detection.warning_time_days.ci_lower:.1f}, {result.detection.warning_time_days.ci_upper:.1f}]")
print(f"  Survey Coverage: {result.detection.survey_coverage}")
print()

print("PHYSICS DISTRIBUTION:")
print(f"  Energy: {result.physics.energy_mt.mean:.2f} MT")
print(f"    CI: [{result.physics.energy_mt.ci_lower:.2f}, {result.physics.energy_mt.ci_upper:.2f}]")
print(f"  Impact Type: {result.physics.impact_type}")
if result.physics.airburst_altitude_km:
    print(f"  Airburst Altitude: {result.physics.airburst_altitude_km.mean:.1f} km")
print(f"  Validation Error: {result.physics.validation_error_pct}%")
print(f"  Model Used: {result.physics.model_used}")
print()

print("TEMPORAL EVOLUTION:")
print(f"  Peak Casualty Time: T+{result.temporal.peak_casualty_time_hours:.0f}h")
print(f"  Recovery Start: T+{result.temporal.recovery_start_days} days")
print("  Timeline:")
for event in result.temporal.timeline[:3]:
    print(f"    T+{event.t_hours:.0f}h: {event.phase}")
print()

print("POLICY DECISION:")
print(f"  Torino Scale: {result.policy.torino_scale}")
print(f"  Palermo Scale: {result.policy.palermo_scale:.2f}")
print(f"  Recommended Action: {result.policy.recommended_action}")
print(f"  Confidence: {result.policy.confidence_pct}%")
print()

print("SENSITIVITY ANALYSIS:")
print(f"  Dominant Driver: {result.sensitivity.dominant_driver}")
for p in result.sensitivity.parameter_ranking:
    print(f"    {p['parameter']}: {p['normalized_effect']*100:.1f}% ({p['direction']})")
print()

print("BASELINE COMPARISON:")
print(f"  Baseline Casualties: {result.baseline.baseline_casualties.mean:.0f}")
print(f"  With Action: {result.baseline.action_casualties.mean:.0f}")
print(f"  Lives Saved: {result.baseline.casualties_avoided.mean:.0f}")
print(f"  Cost-Benefit Ratio: {result.baseline.cost_benefit_ratio:.2f}x")
print()

print("MODEL LIMITATIONS:")
for lim in result.model_limitations:
    print(f"  - {lim}")
print()

# Output full JSON for inspection
print("=" * 60)
print("FULL JSON OUTPUT (first 2000 chars)")
print("=" * 60)
full_output = json.dumps(result.to_dict(), indent=2, default=str)
print(full_output[:2000])
if len(full_output) > 2000:
    print("...")
