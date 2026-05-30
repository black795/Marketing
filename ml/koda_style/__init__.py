"""koda_style — motor de aprendizaje del estilo de edición de Tim Koda.

Capas (cada una independiente y reemplazable):
  schema   → forma canónica de los datos
  dataset  → adaptadores: dataset crudo → Example
  features → Example → vectores numéricos
  models   → cabezas por decisión (re-ranker hoy; XGBoost/transformer mañana)
  training → entrenar + evaluar
  inference→ export a style_profile.json para el motor TS
"""

__version__ = "0.1.0"
