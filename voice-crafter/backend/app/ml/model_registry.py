"""Voice-Crafter Model Registry"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class ModelRegistry:
    def __init__(self):
        self._models: Dict[str, Any] = {}
        self._versions: Dict[str, str] = {}

    async def initialize(self):
        """Pre-warm key models."""
        try:
            # Skip pre-warming detection models when detection feature is disabled
            from app.config import settings
            if not settings.FEATURE_DETECTION:
                logger.info("Feature detection disabled; skipping model pre-warm")
                return

            from app.ml.detection_pipeline import get_detection_pipeline
            pipeline = get_detection_pipeline()
            for det in pipeline.detectors:
                self._models[det.name] = det
                self._versions[det.name] = det.version
            logger.info(f"Registered {len(self._models)} detection models")
        except Exception as e:
            logger.warning(f"Model pre-warm failed: {e}")

    async def get_loaded_models(self) -> List[str]:
        return list(self._models.keys())

    def get_version(self, name: str) -> str:
        return self._versions.get(name, "unknown")
