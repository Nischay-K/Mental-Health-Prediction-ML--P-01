from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, OrdinalEncoder, StandardScaler

ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / 'Mental_Health_Model.pkl'
DATA_PATH = ROOT / 'Student Social Media And Mental Health Impact.csv'


def train_model():
    df = pd.read_csv(DATA_PATH)
    X = df.drop(columns=['Mental_Health_Score'])
    y = df['Mental_Health_Score']

    skewed_cols = ['Study_Hours']
    other_numeric_cols = [
        col for col in X.select_dtypes(include=[np.number]).columns if col not in skewed_cols
    ]
    ordinal_col = ['Stress_Level']
    nominal_cols = [
        col for col in X.columns if col not in ['Mental_Health_Score', *skewed_cols, *other_numeric_cols, *ordinal_col]
    ]

    skewed_pipeline = Pipeline([
        ('log_transform', FunctionTransformer(np.log1p)),
        ('scale', StandardScaler()),
    ])

    plain_pipeline = Pipeline([
        ('scale', StandardScaler()),
    ])

    ordinal_pipeline = Pipeline([
        ('ordinal_encoding', OrdinalEncoder(categories=[['Low', 'Medium', 'High', 'Very High']]))
    ])

    nominal_pipeline = Pipeline([
        ('one_hot_encoding', OneHotEncoder(handle_unknown='ignore')),
    ])

    preprocess = ColumnTransformer([
        ('Skewed_Pipeline', skewed_pipeline, skewed_cols),
        ('Plain_Pipeline', plain_pipeline, other_numeric_cols),
        ('Ordinal_Pipeline', ordinal_pipeline, ordinal_col),
        ('Nominal_Pipeline', nominal_pipeline, nominal_cols),
    ])

    pipeline = Pipeline([
        ('preprocess', preprocess),
        ('regressor', RandomForestRegressor(random_state=42)),
    ])

    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_PATH)
    print(f'Model saved to {MODEL_PATH}')
    return pipeline


if __name__ == '__main__':
    train_model()
