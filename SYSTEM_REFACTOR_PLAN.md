# MeteorViz System Refactor Plan
## Full-Scope, Uncertainty-Aware, Temporal Decision-Support System

**Document Version:** 1.0  
**Date:** 2026-02-01  
**Objective:** Transform platform from calculation system to competition-grade decision-support system

---

## 1. DATA FUSION & UTILIZATION ANALYSIS

### 1.1 Current Dataset Inventory (51 datasets identified)

| Category | Dataset | Current Status | Utilization Gap |
|----------|---------|----------------|-----------------|
| **Orbital** | `jpl_sentry_threats.csv` | Loaded, displayed | Not integrated into risk chain |
| **Orbital** | `cneos_close_approach.csv` | Loaded, endpoint exists | No temporal evolution model |
| **Orbital** | `orbital_mechanics.json` | Loaded | Not used for trajectory uncertainty |
| **Physical** | `asteroid_internal_structure.json` | Loaded via EnhancedDatasetLoader | Underutilized in fragmentation calc |
| **Physical** | `atmospheric_airburst_model.json` | Loaded | Not chained to casualty timeline |
| **Physical** | `meteorite_physics.json` | Loaded in AdvancedPhysics | Isolated from main pipeline |
| **Uncertainty** | `parameter_uncertainty_distributions.json` | EXISTS but NOT LOADED | **CRITICAL GAP** |
| **Uncertainty** | `model_error_profile_validation.json` | EXISTS but NOT LOADED | **CRITICAL GAP** |
| **Temporal** | `temporal_impact_evolution.json` | EXISTS but NOT LOADED | **CRITICAL GAP** |
| **Policy** | `decision_thresholds_policy_framework.json` | EXISTS but NOT LOADED | **CRITICAL GAP** |
| **Infrastructure** | `infrastructure_dependency_network.json` | Loaded | Cascade logic not implemented |
| **Socioeconomic** | `socioeconomic_vulnerability_index.json` | Loaded | Multiplier not applied to casualties |
| **Detection** | `neo_detection_constraints.json` | Loaded via EnhancedDatasetLoader | Warning time not computed |
| **Mitigation** | `deflection_technologies.json` | Loaded | Not linked to decision thresholds |
| **Mitigation** | `early_warning_mitigation_effectiveness.json` | EXISTS but UNDERUTILIZED | Not in decision chain |

### 1.2 Proposed Unified Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED DATA CHAIN ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘

LAYER 1: DETECTION & WARNING
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ neo_detection_   │────▶│ parameter_          │────▶│ WARNING TIME     │
  │ constraints.json │     │ uncertainty_        │     │ DISTRIBUTION     │
  │                  │     │ distributions.json  │     │ (days ± σ)       │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
LAYER 2: IMPACT PHYSICS (with uncertainty)
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ asteroid_        │     │ atmospheric_        │     │ IMPACT OUTCOME   │
  │ internal_        │────▶│ airburst_           │────▶│ DISTRIBUTION     │
  │ structure.json   │     │ model.json          │     │ (E ± CI, type)   │
  │ meteorite_       │     │ physics_constants   │     │                  │
  │ physics.json     │     │                     │     │                  │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
LAYER 3: TEMPORAL EVOLUTION
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ temporal_impact_ │────▶│ T+0 → T+years      │────▶│ CASUALTY         │
  │ evolution.json   │     │ cascade model       │     │ TIMELINE         │
  │                  │     │                     │     │ [t, N(t), CI]    │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
LAYER 4: INFRASTRUCTURE CASCADE
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ infrastructure_  │     │ power_plants,       │     │ SYSTEM FAILURE   │
  │ dependency_      │────▶│ nuclear, dams,      │────▶│ TIMELINE         │
  │ network.json     │     │ health_facilities   │     │ [t, systems, CI] │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
LAYER 5: SOCIOECONOMIC MULTIPLIER
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ socioeconomic_   │     │ GDP, HDI, health    │     │ ADJUSTED         │
  │ vulnerability_   │────▶│ capacity, evac      │────▶│ CASUALTY         │
  │ index.json       │     │ capability          │     │ ESTIMATE ± CI    │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
LAYER 6: POLICY DECISION
  ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
  │ decision_        │     │ Torino/Palermo      │     │ RECOMMENDED      │
  │ thresholds_      │────▶│ scale computation   │────▶│ ACTION           │
  │ policy_          │     │ + threshold lookup  │     │ + CONFIDENCE     │
  │ framework.json   │     │                     │     │ + ALTERNATIVES   │
  └──────────────────┘     └─────────────────────┘     └──────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │ ANALYTICAL          │
                          │ INTERPRETER         │
                          │ (Claude I/O)        │
                          └─────────────────────┘
```

### 1.3 Critical Datasets to Load (Currently Missing)

```python
# MUST ADD to app.py initialization:
UNCERTAINTY_PARAMS = None       # parameter_uncertainty_distributions.json
MODEL_ERROR_PROFILE = None      # model_error_profile_validation.json  
TEMPORAL_EVOLUTION = None       # temporal_impact_evolution.json
DECISION_FRAMEWORK = None       # decision_thresholds_policy_framework.json
EARLY_WARNING_EFFECTIVENESS = None  # early_warning_mitigation_effectiveness.json
```

---

## 2. SCIENTIFIC PIPELINE OPTIMIZATION

### 2.1 Current Pipeline Deficiencies

| Issue | Current State | Required State |
|-------|---------------|----------------|
| Determinism | Random seeds not fixed | Fixed seed per scenario |
| Uncertainty | Monte Carlo exists but ad-hoc | Explicit CI propagation at every stage |
| Temporal | Static snapshot only | Event-based timeline T+0 to T+years |
| Baseline | No comparison | "Do nothing" baseline mandatory |
| Reproducibility | No versioning | Scenario snapshots with hash |

### 2.2 Revised Pipeline Architecture

```python
class ScientificPipeline:
    """
    DETERMINISTIC, UNCERTAINTY-AWARE, TEMPORAL PIPELINE
    """
    
    def __init__(self, seed: int = 42):
        self.seed = seed
        np.random.seed(seed)
        self.scenario_hash = None
        
    def compute(self, input_params: dict) -> PipelineResult:
        # STAGE 1: Input validation + uncertainty bounds
        validated = self._validate_with_uncertainty(input_params)
        
        # STAGE 2: Detection probability + warning time
        detection = self._compute_detection_probability(validated)
        
        # STAGE 3: Physics simulation (N Monte Carlo samples)
        physics_dist = self._simulate_physics_distribution(validated, n_samples=1000)
        
        # STAGE 4: Temporal evolution (T+0 to T+10years)
        timeline = self._compute_temporal_cascade(physics_dist)
        
        # STAGE 5: Infrastructure cascade
        infra_cascade = self._compute_infrastructure_cascade(timeline)
        
        # STAGE 6: Socioeconomic adjustment
        adjusted_casualties = self._apply_vulnerability_multipliers(infra_cascade)
        
        # STAGE 7: Policy decision mapping
        decision = self._map_to_policy_action(adjusted_casualties, detection)
        
        # STAGE 8: Generate baseline ("do nothing" scenario)
        baseline = self._compute_do_nothing_baseline(validated)
        
        # STAGE 9: Compute ablation sensitivities
        sensitivities = self._compute_parameter_sensitivities(validated)
        
        # STAGE 10: Package result with full provenance
        return PipelineResult(
            input_params=validated,
            detection=detection,
            physics_distribution=physics_dist,
            timeline=timeline,
            infrastructure=infra_cascade,
            casualties=adjusted_casualties,
            decision=decision,
            baseline=baseline,
            sensitivities=sensitivities,
            seed=self.seed,
            scenario_hash=self._compute_hash(validated)
        )
```

### 2.3 Mandatory Outputs at Each Stage

| Stage | Output | Format | Uncertainty Representation |
|-------|--------|--------|---------------------------|
| Detection | Warning time | `{mean_days, ci_95: [lo, hi], detection_prob}` | Beta distribution |
| Physics | Energy, crater, airburst | `{mean, std, percentiles: [5,25,50,75,95]}` | Log-normal |
| Temporal | Casualty timeline | `[(t_hours, casualties, ci_95)]` | Poisson process |
| Infrastructure | System failures | `[(system, t_fail, prob_fail)]` | Markov chain |
| Socioeconomic | Adjusted casualties | `{raw, multiplier, adjusted, ci_95}` | Multiplicative |
| Decision | Recommended action | `{action, confidence, threshold_source}` | Categorical |

---

## 3. WEB PLATFORM RESTRUCTURE

### 3.1 Three Modes Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MODE SELECTION BAR                          │
│  [🔬 SCIENTIFIC]    [⚡ DECISION]    [🧪 SCENARIO]                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 SCIENTIFIC MODE

**Purpose:** Full technical transparency for researchers and competition judges.

**Data Shown:**
- Full probability distributions (histograms, CDFs)
- Model error profiles from validation datasets
- Parameter sensitivity rankings
- Uncertainty propagation visualization
- Raw Monte Carlo samples
- Comparison with historical events
- Model limitations statement

**Computations Feeding This Mode:**
```javascript
// API Endpoint: /api/scientific_analysis
{
  physics_distribution: {
    energy_mt: {mean, std, percentiles, histogram_bins},
    crater_km: {mean, std, percentiles, histogram_bins},
    airburst_prob: float,
    ground_impact_prob: float
  },
  validation_metrics: {
    chelyabinsk_error_pct: float,
    tunguska_error_pct: float,
    overall_rmse: float
  },
  sensitivity_ranking: [
    {param: "velocity", normalized_effect: 0.45},
    {param: "diameter", normalized_effect: 0.35},
    {param: "angle", normalized_effect: 0.12},
    {param: "density", normalized_effect: 0.08}
  ],
  model_limitations: [
    "Airburst altitude ±18% for stony bodies",
    "Tsunami propagation not validated for >100MT",
    "Infrastructure cascade assumes average connectivity"
  ]
}
```

**Allowed Conclusions:**
- "Energy is X ± Y MT (95% CI)"
- "Model validated against Chelyabinsk with Z% error"
- "Velocity is the dominant driver of uncertainty"

**Prohibited Conclusions:**
- Single-point predictions without intervals
- Recommendations without confidence levels

---

### 3.3 DECISION MODE

**Purpose:** Single-page actionable report for policymakers.

**Data Shown (One Page Only):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ PLANETARY DEFENSE DECISION REPORT                                  │
│ Scenario: [Asteroid Name/ID]  |  Generated: [Timestamp]           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ RISK LEVEL:  ████████░░  TORINO 4 / PALERMO -0.5                   │
│                                                                     │
│ KEY METRICS (95% Confidence Intervals):                            │
│   • Impact Energy:     15-45 MT                                    │
│   • Affected Population: 2.1-5.8 million                           │
│   • Warning Time:       180-540 days                               │
│   • Infrastructure Cascade: 12-48 hour delay                       │
│                                                                     │
│ TIMELINE:                                                          │
│   T+0      T+1hr    T+24hr   T+7d     T+30d                       │
│   ●────────●────────●────────●────────●                            │
│   Impact  Peak     Medical  Supply   Recovery                      │
│           Casualty Surge    Crisis   Begins                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ RECOMMENDED ACTION: INTENSIVE OBSERVATION + CONTINGENCY PLANNING   │
│ Confidence: 78%                                                    │
│                                                                     │
│ Action Justification:                                              │
│   ✓ Impact probability (8%) exceeds observation threshold (1%)    │
│   ✓ Warning time (>180d) allows refinement before commitment      │
│   ✗ Deflection not warranted: probability below 30% threshold     │
│   ✗ Evacuation premature: location uncertainty >500km             │
│                                                                     │
│ ALTERNATIVE ACTIONS REJECTED:                                       │
│   • "Do Nothing" - Risk exceeds background by factor 15           │
│   • "Immediate Deflection" - Cost:benefit ratio unfavorable       │
│   • "Evacuation Order" - Impact corridor not constrained          │
├─────────────────────────────────────────────────────────────────────┤
│ DATA SOURCES: [7/8 datasets active] | Model Confidence: HIGH      │
│ Report Hash: a3f7c2d1 | Reproducible with seed 42                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Computations Feeding This Mode:**
```javascript
// API Endpoint: /api/decision_report
{
  torino_scale: int,
  palermo_scale: float,
  risk_metrics: {
    energy_ci_95: [lo, hi],
    population_ci_95: [lo, hi],
    warning_days_ci_95: [lo, hi]
  },
  timeline_events: [
    {t_hours: 0, event: "Impact", casualties_ci: [lo, hi]},
    {t_hours: 1, event: "Peak Casualties", casualties_ci: [lo, hi]},
    ...
  ],
  recommended_action: {
    action: string,
    confidence: float,
    threshold_source: "decision_thresholds_policy_framework.json"
  },
  action_justification: {
    supporting: [{criterion, status, source}],
    opposing: [{criterion, status, source}]
  },
  rejected_alternatives: [
    {action, reason, quantitative_basis}
  ]
}
```

---

### 3.4 SCENARIO MODE

**Purpose:** Controlled what-if exploration using existing parameters only.

**Allowed Modifications:**
- Asteroid physical parameters (within dataset ranges)
- Impact location (any coordinate)
- Warning time assumption
- Mitigation technology selection

**NOT Allowed:**
- Inventing new physics models
- Adding datasets
- Modifying model internals

**Interface:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ SCENARIO EXPLORER                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ BASE SCENARIO: Apophis 2029 Approach (Loaded from Sentry)          │
│                                                                     │
│ PARAMETER OVERRIDES:                                                │
│   Diameter:    [====●====] 340m  (Dataset range: 200-400m)        │
│   Velocity:    [====●====] 12.6 km/s  (Fixed from orbital data)   │
│   Composition: [▼ S-type (silicate)]                               │
│   Impact Lat:  [35.6°N]  Impact Lon: [139.7°E]  (Click map)       │
│                                                                     │
│ MITIGATION SCENARIO:                                                │
│   [▼ Kinetic Impactor]  Applied: [5 years before impact]          │
│   Expected ΔV: 1.2 cm/s (from DART calibration)                    │
│                                                                     │
│ [COMPARE TO BASELINE] [RUN SCENARIO] [EXPORT]                      │
├─────────────────────────────────────────────────────────────────────┤
│ SCENARIO VS BASELINE COMPARISON:                                    │
│                                                                     │
│                    Baseline        This Scenario    Δ              │
│   Energy (MT):     85 ± 15         85 ± 15          0%             │
│   Casualties:      2.1M ± 0.8M     0 (miss)         -100%          │
│   Econ. Damage:    $450B ± $120B   $0.3B (mission)  -99.9%         │
│   Deflection:      N/A             Successful       ✓              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. CLAUDE I/O SCHEMA (ANALYTICAL INTERPRETER)

### 4.1 Design Philosophy

Claude is NOT:
- A calculator (physics engine handles computation)
- A chatbot (no open-ended dialogue)
- A hallucinator (no invented data)

Claude IS:
- An analytical interpreter of structured outputs
- A decision synthesizer with explicit sourcing
- An uncertainty communicator

### 4.2 Input Schema

```typescript
interface ClaudeInput {
  // Metadata
  scenario_id: string;
  timestamp: string;
  seed: number;
  
  // Detection Layer
  detection: {
    probability: number;              // 0-1
    warning_time_days: {
      mean: number;
      ci_95: [number, number];
    };
    limiting_factor: string;          // e.g., "solar_elongation"
    source: "neo_detection_constraints.json";
  };
  
  // Physics Layer
  physics: {
    energy_mt: {
      mean: number;
      ci_95: [number, number];
      percentiles: Record<number, number>;  // 5, 25, 50, 75, 95
    };
    impact_type: "airburst" | "land" | "ocean";
    airburst_altitude_km?: {
      mean: number;
      ci_95: [number, number];
    };
    crater_km?: {
      mean: number;
      ci_95: [number, number];
    };
    tsunami_height_m?: {
      at_100km: number;
      at_coast: number;
    };
    source: "physics_engine.py + historical_validation";
    validation_error_pct: number;     // from model_error_profile_validation.json
  };
  
  // Temporal Layer
  temporal: {
    timeline: Array<{
      t_hours: number;
      phase: string;
      casualties: {
        mean: number;
        ci_95: [number, number];
      };
      infrastructure_status: string[];
    }>;
    source: "temporal_impact_evolution.json";
  };
  
  // Infrastructure Layer
  infrastructure: {
    systems_at_risk: Array<{
      system_type: string;
      count: number;
      cascade_delay_hours: number;
    }>;
    critical_facilities: Array<{
      name: string;
      type: string;
      distance_km: number;
      impact_probability: number;
    }>;
    source: "infrastructure_dependency_network.json + power_plants + nuclear + dams";
  };
  
  // Socioeconomic Layer
  socioeconomic: {
    raw_casualty_estimate: number;
    vulnerability_multiplier: number;
    adjusted_casualty_estimate: {
      mean: number;
      ci_95: [number, number];
    };
    affected_region: string;
    source: "socioeconomic_vulnerability_index.json";
  };
  
  // Policy Layer
  policy: {
    torino_scale: number;
    palermo_scale: number;
    thresholds_triggered: Array<{
      threshold_name: string;
      value: number;
      comparison: ">" | "<" | "=";
      threshold_value: number;
      action_implied: string;
    }>;
    source: "decision_thresholds_policy_framework.json";
  };
  
  // Baseline Comparison
  baseline: {
    do_nothing_outcome: {
      casualties: {mean: number; ci_95: [number, number]};
      economic_damage_usd: {mean: number; ci_95: [number, number]};
    };
    comparison_delta: {
      casualties_avoided: number;
      damage_avoided_usd: number;
      cost_of_action_usd: number;
      cost_benefit_ratio: number;
    };
  };
  
  // Sensitivity Analysis
  sensitivity: {
    parameter_ranking: Array<{
      parameter: string;
      normalized_effect: number;  // 0-1, sums to 1
      direction: "positive" | "negative";
    }>;
    source: "ablation_analysis";
  };
  
  // Data Quality
  data_quality: {
    datasets_active: number;
    datasets_total: number;
    missing_critical: string[];
    overall_confidence: "HIGH" | "MODERATE" | "LOW";
  };
}
```

### 4.3 Output Schema

```typescript
interface ClaudeOutput {
  // Risk Summary (MANDATORY)
  risk_summary: {
    headline: string;           // Max 15 words
    torino_interpretation: string;
    palermo_interpretation: string;
    confidence_statement: string;
  };
  
  // Dominant Drivers (MANDATORY, ranked)
  dominant_drivers: Array<{
    rank: number;
    factor: string;
    contribution_pct: number;
    source_dataset: string;
    interpretation: string;
  }>;
  
  // Confidence Assessment (MANDATORY)
  confidence: {
    overall_level: "HIGH" | "MODERATE" | "LOW";
    limiting_factors: string[];
    data_gaps: string[];
    model_limitations: string[];
  };
  
  // Recommended Action (MANDATORY)
  recommended_action: {
    action: string;
    justification: string;
    supporting_evidence: Array<{
      claim: string;
      source: string;
      value: string;
    }>;
    confidence_pct: number;
  };
  
  // Rejected Alternatives (MANDATORY)
  rejected_alternatives: Array<{
    action: string;
    rejection_reason: string;
    quantitative_basis: string;
    source: string;
  }>;
  
  // Insufficient Data Declaration (when applicable)
  insufficient_data?: {
    required_for: string;
    missing: string[];
    fallback_used: string;
  };
  
  // Provenance (MANDATORY)
  provenance: {
    datasets_cited: string[];
    models_cited: string[];
    assumptions_made: string[];
    reproducibility_hash: string;
  };
}
```

### 4.4 Example Claude Interaction

**INPUT (abbreviated):**
```json
{
  "physics": {
    "energy_mt": {"mean": 25, "ci_95": [15, 45]},
    "impact_type": "land"
  },
  "socioeconomic": {
    "adjusted_casualty_estimate": {"mean": 3500000, "ci_95": [2100000, 5800000]}
  },
  "policy": {
    "torino_scale": 4,
    "palermo_scale": -0.5,
    "thresholds_triggered": [
      {"threshold_name": "intensive_observation", "action_implied": "24/7 monitoring"}
    ]
  }
}
```

**OUTPUT:**
```json
{
  "risk_summary": {
    "headline": "Regional devastation threat requiring immediate intensive observation",
    "torino_interpretation": "Torino 4 indicates 1-10% probability of regional devastation; merits public attention",
    "palermo_interpretation": "Palermo -0.5 exceeds background hazard; warrants monitoring resources",
    "confidence_statement": "Assessment based on 7/8 active datasets with HIGH overall confidence"
  },
  "dominant_drivers": [
    {
      "rank": 1,
      "factor": "Impactor velocity (19 km/s)",
      "contribution_pct": 45,
      "source_dataset": "orbital_mechanics.json",
      "interpretation": "High velocity dominates energy calculation; well-constrained by radar observations"
    },
    {
      "rank": 2,
      "factor": "Population density at impact site",
      "contribution_pct": 30,
      "source_dataset": "WorldPop 2020",
      "interpretation": "Tokyo metropolitan area; vulnerability multiplier 0.8x (high development)"
    }
  ],
  "confidence": {
    "overall_level": "HIGH",
    "limiting_factors": ["Airburst altitude prediction ±18%"],
    "data_gaps": ["Real-time atmospheric conditions not modeled"],
    "model_limitations": ["Chelyabinsk validation error 6% for airburst altitude"]
  },
  "recommended_action": {
    "action": "INTENSIVE OBSERVATION + CONTINGENCY PLANNING",
    "justification": "Impact probability (8%) exceeds intensive observation threshold (1%); warning time (540 days) allows orbit refinement before deflection commitment",
    "supporting_evidence": [
      {"claim": "Probability exceeds threshold", "source": "decision_thresholds_policy_framework.json", "value": "8% > 1%"},
      {"claim": "Warning time sufficient", "source": "neo_detection_constraints.json", "value": "540 days > 180 day minimum"}
    ],
    "confidence_pct": 78
  },
  "rejected_alternatives": [
    {
      "action": "Immediate deflection mission",
      "rejection_reason": "Impact probability (8%) below deflection threshold (30%)",
      "quantitative_basis": "decision_thresholds_policy_framework.json: mission_authorization.probability > 30%",
      "source": "decision_thresholds_policy_framework.json"
    },
    {
      "action": "Do nothing",
      "rejection_reason": "Risk exceeds background by factor 15 (Palermo -0.5 vs typical -3)",
      "quantitative_basis": "Palermo scale interpretation: P > -2 merits monitoring",
      "source": "decision_thresholds_policy_framework.json"
    }
  ],
  "provenance": {
    "datasets_cited": ["orbital_mechanics.json", "WorldPop 2020", "decision_thresholds_policy_framework.json", "neo_detection_constraints.json"],
    "models_cited": ["Pi-scaling crater model (Holsapple)", "Chyba-Hills airburst model"],
    "assumptions_made": ["Stony composition assumed from S-type spectral classification"],
    "reproducibility_hash": "a3f7c2d1"
  }
}
```

---

## 5. COMPETITION-LEVEL SCIENTIFIC MATURITY CHECKLIST

### 5.1 Reliability Demonstration

| Requirement | Implementation | File/Location |
|-------------|----------------|---------------|
| Historical validation | Chelyabinsk, Tunguska, Barringer benchmark | `/validate_model` endpoint |
| Error quantification | RMSE, MAE, relative error per event | `model_error_profile_validation.json` |
| Known failure modes | Document where model breaks down | Model limitations in output |
| Validation data separation | Test set not used in training | `validate_model.py` |

### 5.2 Weakness Acknowledgment

| Weakness | Documentation | Mitigation |
|----------|---------------|------------|
| Airburst altitude ±18% | `model_error_profile_validation.json` | Confidence interval provided |
| Tsunami >100MT unvalidated | Scientific mode warning | Flag in output |
| Infrastructure cascade average | Assumption documented | Regional adjustment option |
| Composition uncertainty | Spectral type mapping uncertainty | Monte Carlo sampling |

### 5.3 Defensibility

| Claim | Support Required | Source |
|-------|------------------|--------|
| Every casualty estimate | CI + source dataset + model error | Structured output |
| Every recommendation | Policy threshold citation | `decision_thresholds_policy_framework.json` |
| Every rejected alternative | Quantitative rejection criterion | Same |
| Every sensitivity claim | Ablation analysis result | Parameter ranking |

### 5.4 Uncertainty-Informed Decision Making

**Key Principle:** Uncertainty does NOT invalidate decisions when:
1. Confidence intervals don't span decision boundaries
2. Cost of wrong decision is asymmetric (precautionary principle)
3. Actions are reversible or staged

**Example:**
- CI: 2.1M - 5.8M casualties
- Threshold for intensive observation: >100K casualties
- Decision: Even lower bound exceeds threshold → observation warranted despite uncertainty

---

## 6. IMPLEMENTATION PRIORITY

### Phase 1: Critical Data Loading (Week 1)
- [ ] Load `parameter_uncertainty_distributions.json`
- [ ] Load `model_error_profile_validation.json`
- [ ] Load `temporal_impact_evolution.json`
- [ ] Load `decision_thresholds_policy_framework.json`
- [ ] Load `early_warning_mitigation_effectiveness.json`

### Phase 2: Pipeline Refactor (Week 2)
- [ ] Implement `ScientificPipeline` class
- [ ] Add deterministic seeding
- [ ] Implement uncertainty propagation at each stage
- [ ] Add baseline comparison computation
- [ ] Add parameter sensitivity calculation

### Phase 3: Web Modes (Week 3)
- [ ] Create mode switcher component
- [ ] Build Scientific Mode view
- [ ] Build Decision Mode single-page report
- [ ] Build Scenario Mode comparison interface

### Phase 4: Claude Integration (Week 4)
- [ ] Create `/api/analytical_interpretation` endpoint
- [ ] Implement input schema validation
- [ ] Implement output schema enforcement
- [ ] Test with edge cases

### Phase 5: Polish (Week 5)
- [ ] Ablation analysis visualization
- [ ] Historical replay hooks
- [ ] Export/reproducibility features
- [ ] Documentation

---

## 7. COMPETITION SUCCESS CRITERIA

A system competitive for 1st place must demonstrate:

1. **Scientific Rigor**
   - [ ] Every output has uncertainty quantification
   - [ ] Every model validated against historical data
   - [ ] Every limitation explicitly documented

2. **Decision Quality**
   - [ ] Clear action recommendation with confidence
   - [ ] Explicit rejection of alternatives with reasons
   - [ ] Baseline comparison for context

3. **Interpretability**
   - [ ] Parameter sensitivity ranking
   - [ ] Dominant driver identification
   - [ ] Provenance for every claim

4. **Reproducibility**
   - [ ] Fixed seed support
   - [ ] Scenario hash for verification
   - [ ] Version-controlled outputs

5. **Integration**
   - [ ] All datasets contribute to decision chain
   - [ ] No siloed calculations
   - [ ] Temporal dynamics explicit

---

*Document prepared for MeteorViz planetary defense platform refactoring*
