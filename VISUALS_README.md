# Generate project visuals

This script produces several jury-focused visuals from `nasa_impact_dataset.csv` and saves them into the `results/` folder.

Requirements:

```
pip install -r requirements.txt
```

Run:

```
python make_visuals.py
```

Outputs (in `results/`):
- `hist_crater.png` — distribution of crater diameters
- `scatter_mass_velocity.png` — mass vs velocity scatter (size ~ crater diameter)
- `composition_hazard.png` — composition counts split by hazardous flag
- `top10_energy.png` — top 10 objects by impact energy
- `infographic_jury.png` — a single-page infographic summarizing key metrics

## Jury Evidence Visuals (Criteria-Based)

To address specific project success criteria (Problem, Method, Impact, Results), run:

```
python make_jury_visuals.py
```

Outputs (in `results/`):
- `jury_problem.png` — **Problem Definition**: Visualizes the ratio of hazardous objects, defining the scope of the threat.
- `jury_method.png` — **Methodology**: Feature importance plot showing the model correctly identifies physical drivers (Velocity, Mass).
- `jury_impact.png` — **Creativity & Impact**: Compares asteroid energies to known events (Hiroshima, etc.) to demonstrate potential impact scale.
- `jury_results.png` — **Results**: Predicted vs Actual scatter plot with R² score, proving model accuracy and reproducibility.
- `PROJECT_EVIDENCE_BOARD.png` — **Composite Infographic**: A single high-res board combining all above for the jury.
