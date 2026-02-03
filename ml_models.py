"""
Machine Learning Models for Impact Prediction
==============================================
Reusable ML classes for training and inference.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingRegressor, 
    RandomForestRegressor,
    ExtraTreesRegressor
)
from sklearn.linear_model import BayesianRidge
from sklearn.preprocessing import RobustScaler
from sklearn.model_selection import cross_val_predict
from sklearn.metrics import r2_score


class UncertaintyEnsemble:
    """
    Ensemble of diverse models that provides uncertainty estimates
    through model disagreement.
    
    Combines:
    - 2 Gradient Boosting models with different hyperparameters
    - 1 Random Forest
    - 1 Extra Trees
    - 1 Bayesian Ridge (for probabilistic baseline)
    """
    
    def __init__(self, n_estimators=5, random_state=42):
        self.n_estimators = n_estimators
        self.random_state = random_state
        self.models = []
        self.scalers = []
        self.feature_names = None
        
    def fit(self, X, y):
        """Fit ensemble of diverse models."""
        self.feature_names = list(X.columns) if hasattr(X, 'columns') else None
        X_arr = np.array(X)
        y_arr = np.array(y)
        
        # Create diverse base models
        model_configs = [
            GradientBoostingRegressor(
                n_estimators=200, 
                learning_rate=0.1, 
                max_depth=5,
                subsample=0.8,
                random_state=self.random_state
            ),
            GradientBoostingRegressor(
                n_estimators=150, 
                learning_rate=0.05, 
                max_depth=7,
                subsample=0.9,
                random_state=self.random_state + 1
            ),
            RandomForestRegressor(
                n_estimators=200,
                max_depth=15,
                min_samples_leaf=5,
                random_state=self.random_state + 2,
                n_jobs=-1
            ),
            ExtraTreesRegressor(
                n_estimators=200,
                max_depth=20,
                min_samples_leaf=3,
                random_state=self.random_state + 3,
                n_jobs=-1
            ),
            BayesianRidge(
                alpha_1=1e-6,
                alpha_2=1e-6,
                lambda_1=1e-6,
                lambda_2=1e-6
            )
        ]
        
        self.models = []
        self.scalers = []
        
        for i, model in enumerate(model_configs[:self.n_estimators]):
            scaler = RobustScaler()
            X_scaled = scaler.fit_transform(X_arr)
            
            model.fit(X_scaled, y_arr)
            
            self.models.append(model)
            self.scalers.append(scaler)
        
        return self
    
    def predict(self, X):
        """Predict with mean of ensemble."""
        predictions = self._get_all_predictions(X)
        return np.mean(predictions, axis=0)
    
    def predict_with_uncertainty(self, X):
        """Predict with uncertainty estimates."""
        predictions = self._get_all_predictions(X)
        
        mean_pred = np.mean(predictions, axis=0)
        std_pred = np.std(predictions, axis=0)
        
        # 95% confidence interval
        ci_lower = mean_pred - 1.96 * std_pred
        ci_upper = mean_pred + 1.96 * std_pred
        
        return {
            'mean': mean_pred,
            'std': std_pred,
            'ci_lower': ci_lower,
            'ci_upper': ci_upper,
            'all_predictions': predictions
        }
    
    def _get_all_predictions(self, X):
        """Get predictions from all models."""
        X_arr = np.array(X)
        predictions = []
        
        for model, scaler in zip(self.models, self.scalers):
            X_scaled = scaler.transform(X_arr)
            pred = model.predict(X_scaled)
            predictions.append(pred)
        
        return np.array(predictions)
    
    def get_feature_importance(self):
        """Get aggregated feature importance."""
        if not self.feature_names:
            return None
        
        importance_sum = np.zeros(len(self.feature_names))
        count = 0
        
        for model in self.models:
            if hasattr(model, 'feature_importances_'):
                importance_sum += model.feature_importances_
                count += 1
        
        if count > 0:
            avg_importance = importance_sum / count
            return dict(zip(self.feature_names, avg_importance))
        
        return None


class MultiOutputImpactPredictor:
    """
    Predicts multiple impact outcomes simultaneously:
    - Crater diameter (m)
    - Impact energy (MT)
    - Airburst probability
    """
    
    def __init__(self, random_state=42):
        self.random_state = random_state
        self.models = {}
        self.feature_engine = None
        self.target_scalers = {}
        self.feature_names = None
        
    def fit(self, df, targets):
        """
        Fit multi-output model.
        
        Args:
            df: DataFrame with features
            targets: Dict mapping target names to columns
        """
        print("\n[PHASE 3] Training Multi-Output Ensemble...")
        
        # Get feature columns - exclude targets, identifiers, and object columns
        exclude = list(targets.values()) + [
            'id', 'name', 'orbit_id', 'full_name', 'spkid', 'pdes',
            'spec_B', 'spec_T', 'class', 'epoch_cal', 'tp_cal'
        ]
        
        feature_cols = [
            c for c in df.columns 
            if c not in exclude 
            and df[c].dtype in ['float64', 'int64', 'float32', 'int32']
            and not c.startswith('sigma_')  # Exclude uncertainty columns for now
        ]
        
        print(f"  Using {len(feature_cols)} features")
        
        self.feature_names = feature_cols
        X = df[feature_cols].copy()
        
        # Fill NaN with median
        for col in X.columns:
            median_val = X[col].median()
            if pd.isna(median_val):
                median_val = 0
            X[col] = X[col].fillna(median_val)
        
        for target_name, target_col in targets.items():
            print(f"\n  Training model for: {target_name}")
            
            if target_col not in df.columns:
                print(f"    ⚠ Target column '{target_col}' not found, skipping")
                continue
            
            y = df[target_col].fillna(df[target_col].median())
            
            # Scale target for better training
            y_log = np.log1p(y)
            
            # Create and train ensemble
            model = UncertaintyEnsemble(n_estimators=5, random_state=self.random_state)
            model.fit(X, y_log)
            
            self.models[target_name] = model
            self.target_scalers[target_name] = 'log1p'
            
            # Cross-validation score
            cv_preds = cross_val_predict(
                GradientBoostingRegressor(n_estimators=100, random_state=self.random_state),
                X, y_log, cv=5
            )
            cv_r2 = r2_score(y_log, cv_preds)
            print(f"    CV R²: {cv_r2:.4f}")
        
        return self
    
    def predict(self, X):
        """Predict all outputs with uncertainty."""
        results = {}
        
        # Ensure all features present
        X_aligned = X.reindex(columns=self.feature_names, fill_value=0)
        
        for target_name, model in self.models.items():
            pred = model.predict_with_uncertainty(X_aligned)
            
            # Inverse transform
            if self.target_scalers.get(target_name) == 'log1p':
                results[target_name] = {
                    'mean': np.expm1(pred['mean']),
                    'std': np.expm1(pred['std']),
                    'ci_lower': np.expm1(pred['ci_lower']),
                    'ci_upper': np.expm1(pred['ci_upper'])
                }
            else:
                results[target_name] = pred
        
        return results
    
    def get_feature_importance(self):
        """Get aggregated feature importance across all targets."""
        all_importance = {}
        
        for target_name, model in self.models.items():
            imp = model.get_feature_importance()
            if imp:
                for feat, val in imp.items():
                    if feat not in all_importance:
                        all_importance[feat] = []
                    all_importance[feat].append(val)
        
        # Average importance
        avg_importance = {k: np.mean(v) for k, v in all_importance.items()}
        return dict(sorted(avg_importance.items(), key=lambda x: x[1], reverse=True))


class PhysicsInformedFeatureEngine:
    """
    Creates physics-informed features from raw input data.
    """
    
    def __init__(self, fuser=None):
        self.fuser = fuser
        
    def engineer_features(self, df):
        """Apply all feature engineering to dataframe - works with synthesized data."""
        result = df.copy()
        
        print(f"    Input columns: {list(df.columns)[:10]}...")
        
        # Check if we have the synthesized columns or need to handle raw data
        has_mass = 'mass_kg' in df.columns
        has_velocity = 'velocity_kms' in df.columns
        has_energy = 'energy_mt' in df.columns
        
        # Basic log transforms (only if columns exist)
        if has_mass:
            result['log_mass'] = np.log1p(df['mass_kg'].clip(1, None))
        if has_velocity:
            result['log_velocity'] = np.log1p(df['velocity_kms'].clip(0.1, None))
        if 'density_kgm3' in df.columns:
            result['log_density'] = np.log1p(df['density_kgm3'])
        
        # Energy features
        if has_mass and has_velocity:
            result['energy_j_calc'] = 0.5 * df['mass_kg'] * (df['velocity_kms'] * 1000) ** 2
            result['energy_mt_calc'] = result['energy_j_calc'] / 4.184e15
            result['log_energy_j'] = np.log1p(result['energy_j_calc'].clip(1e10, None))
            result['log_energy_mt'] = np.log10(result['energy_mt_calc'].clip(1e-10, None))
        elif has_energy:
            result['energy_j_calc'] = df['energy_mt'] * 4.184e15
            result['log_energy_j'] = np.log1p(result['energy_j_calc'].clip(1e10, None))
            result['log_energy_mt'] = np.log10(df['energy_mt'].clip(1e-10, None))
        
        # Momentum features
        if has_mass and has_velocity:
            result['momentum'] = df['mass_kg'] * df['velocity_kms'] * 1000
            result['log_momentum'] = np.log1p(result['momentum'].clip(1e6, None))
        
        # Ballistic coefficient
        if has_mass and 'diameter_m' in df.columns:
            area = np.pi * (df['diameter_m'] / 2) ** 2
            result['ballistic_coefficient'] = df['mass_kg'] / (area.clip(0.01, None))
            result['log_ballistic_coeff'] = np.log1p(result['ballistic_coefficient'])
        
        # Angle trigonometry
        if 'angle_deg' in df.columns:
            angle_rad = np.deg2rad(df['angle_deg'])
            result['sin_angle'] = np.sin(angle_rad)
            result['cos_angle'] = np.cos(angle_rad)
            result['tan_angle'] = np.tan(np.clip(angle_rad, 0.01, 1.55))
            if has_velocity:
                result['vertical_velocity'] = df['velocity_kms'] * np.sin(angle_rad)
                result['horizontal_velocity'] = df['velocity_kms'] * np.cos(angle_rad)
        
        # Crater scaling features
        if has_energy or 'energy_mt_calc' in result.columns:
            energy_mt = df['energy_mt'] if has_energy else result['energy_mt_calc']
            # Pi-scaling crater estimate
            result['crater_estimate_km'] = 0.1 * (energy_mt ** 0.25)
            result['log_crater_estimate'] = np.log1p(result['crater_estimate_km'])
        
        # Density ratio for cratering
        if 'density_kgm3' in df.columns:
            result['density_ratio'] = df['density_kgm3'] / 2500  # Normalized to rock
        
        # Risk features
        if has_energy or 'energy_mt_calc' in result.columns:
            energy_mt = df['energy_mt'] if has_energy else result['energy_mt_calc']
            
            # Torino scale approximation
            def calc_torino(e):
                if pd.isna(e) or e <= 0:
                    return 0
                elif e < 0.001:
                    return 0
                elif e < 1:
                    return 1
                elif e < 10:
                    return 2
                elif e < 100:
                    return 3
                elif e < 1000:
                    return 5
                else:
                    return 8
            
            result['torino_scale_estimate'] = energy_mt.apply(calc_torino)
            
            # Palermo scale approximation
            background_rate = 0.03 * (energy_mt.clip(0.001, None) ** -0.8)
            result['palermo_scale_estimate'] = np.log10(1.0 / background_rate.clip(1e-10, None))
            result['palermo_scale_estimate'] = result['palermo_scale_estimate'].clip(-10, 10)
            
            # Normalized risk
            result['normalized_risk'] = (energy_mt / 1000).clip(0, 1)
        
        # Orbital features
        if 'moid_au' in df.columns:
            result['log_moid'] = np.log10(df['moid_au'].clip(1e-5, None))
            result['moid_risk'] = np.exp(-df['moid_au'] * 10)
        
        if 'semi_major_axis' in df.columns and 'eccentricity' in df.columns:
            result['perihelion'] = df['semi_major_axis'] * (1 - df['eccentricity'])
            result['aphelion'] = df['semi_major_axis'] * (1 + df['eccentricity'])
            result['orbital_energy'] = -1 / (2 * df['semi_major_axis'].clip(0.1, None))
            result['earth_crossing'] = (
                (result['perihelion'] < 1.017) & (result['aphelion'] > 0.983)
            ).astype(int)
        
        # Hazard score
        if 'is_neo' in df.columns and 'is_pha' in df.columns:
            result['hazard_score'] = df['is_neo'] + 2 * df['is_pha']
        
        # Interaction features
        if has_mass and has_velocity:
            result['mass_velocity_product'] = df['mass_kg'] * df['velocity_kms']
            result['mass_velocity_ratio'] = df['mass_kg'] / (df['velocity_kms'] + 0.01)
        
        if 'density_kgm3' in df.columns and has_velocity:
            result['density_velocity_product'] = df['density_kgm3'] * df['velocity_kms']
        
        # Fill NaN with median for numeric columns
        for col in result.columns:
            if result[col].dtype in ['float64', 'int64', 'float32', 'int32']:
                median_val = result[col].median()
                if pd.isna(median_val):
                    median_val = 0
                result[col] = result[col].fillna(median_val)
        
        print(f"    Output features: {len(result.columns)}")
        return result
