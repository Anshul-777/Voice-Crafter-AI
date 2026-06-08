#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Voice-Crafter: Download & prepare ML model checkpoints
# Run from: voice-crafter/backend/
# Usage: bash scripts/download_models.sh [--skip-tts] [--skip-detection]
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
MODELS_DIR="./models"
SKIP_TTS=false
SKIP_DETECTION=false

for arg in "$@"; do
  [[ "$arg" == "--skip-tts" ]] && SKIP_TTS=true
  [[ "$arg" == "--skip-detection" ]] && SKIP_DETECTION=true
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Voice-Crafter Model Downloader"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
mkdir -p "$MODELS_DIR"/{aasist,rawnet2,tts}

# ── XTTS-v2 TTS Model ─────────────────────────────────────────────────────────
if [[ "$SKIP_TTS" == "false" ]]; then
  echo ""
  echo "📥 Downloading XTTS-v2 TTS model (~1.8 GB)..."
  echo "   This will be downloaded by the TTS library on first inference."
  echo "   To pre-download manually:"
  echo ""
  echo "   python -c \""
  echo "   from TTS.api import TTS"
  echo "   TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2')"
  echo "   \""
  echo ""
  python3 -c "
import sys
try:
    from TTS.api import TTS
    print('⏳ Downloading XTTS-v2 (this may take several minutes)...')
    tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2', progress_bar=True)
    print('✅ XTTS-v2 downloaded successfully')
except Exception as e:
    print(f'⚠️  TTS download failed: {e}')
    print('   Run manually: pip install TTS && python -c \"from TTS.api import TTS; TTS(model_name=\\\"tts_models/multilingual/multi-dataset/xtts_v2\\\")\"')
" 2>&1 || true
fi

# ── AASIST Detection Model ────────────────────────────────────────────────────
if [[ "$SKIP_DETECTION" == "false" ]]; then
  echo ""
  echo "📥 Downloading AASIST checkpoint..."
  AASIST_URL="https://github.com/clovaai/aasist/releases/download/v1.0/AASIST.pth"
  AASIST_PATH="$MODELS_DIR/aasist/AASIST.pth"
  if [[ ! -f "$AASIST_PATH" ]]; then
    curl -L --progress-bar -o "$AASIST_PATH" "$AASIST_URL" 2>&1 || {
      echo "⚠️  AASIST download failed — system will use heuristic fallback"
      echo "   Manual: curl -L -o $AASIST_PATH $AASIST_URL"
    }
    [[ -f "$AASIST_PATH" ]] && echo "✅ AASIST downloaded: $AASIST_PATH"
  else
    echo "✅ AASIST already exists: $AASIST_PATH"
  fi

  echo ""
  echo "📥 Downloading RawNet2 checkpoint..."
  RAWNET2_URL="https://github.com/eurecom-asp/RawNet2-antispoofing/releases/download/v1.0/RawNet2.pth"
  RAWNET2_PATH="$MODELS_DIR/rawnet2/RawNet2.pth"
  if [[ ! -f "$RAWNET2_PATH" ]]; then
    curl -L --progress-bar -o "$RAWNET2_PATH" "$RAWNET2_URL" 2>&1 || {
      echo "⚠️  RawNet2 download failed — system will use heuristic fallback"
      echo "   Note: Heuristic detectors are still functional for evaluation"
    }
    [[ -f "$RAWNET2_PATH" ]] && echo "✅ RawNet2 downloaded: $RAWNET2_PATH"
  else
    echo "✅ RawNet2 already exists: $RAWNET2_PATH"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Model download complete!"
echo ""
echo "  Detection models: $MODELS_DIR/aasist/ & $MODELS_DIR/rawnet2/"
echo "  TTS model: managed by Coqui TTS library"
echo ""
echo "  If model downloads fail, the system falls back to"
echo "  heuristic-based detection (fully functional for evaluation)."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
