#!/bin/bash
# Propósito: Renderizar y previsualizar composiciones de video con Remotion
# Origen: Claude Code Creative Pipeline Starter
# API Keys necesarias: Ninguna
# Cómo ejecutar: Correr desde la raíz del proyecto Remotion; reemplazar ReelComposition con el nombre de tu composición

# Renderizar video final
npx remotion render src/index.ts ReelComposition output.mp4

# Previsualizar en browser con hot reload
npx remotion preview
