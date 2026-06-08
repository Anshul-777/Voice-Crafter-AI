"""
Voice-Crafter TTS Pipeline
XTTS-v2 based text-to-speech with voice cloning, streaming, multi-language.

Uses Coqui TTS library (https://github.com/coqui-ai/TTS).
XTTS-v2 supports 17 languages and zero-shot voice cloning.
"""

import asyncio
import io
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import AsyncIterator, Optional, Tuple, List
import numpy as np

from app.config import settings
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)

# Supported languages in XTTS-v2
SUPPORTED_LANGUAGES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "it": "Italian", "pt": "Portuguese", "pl": "Polish", "tr": "Turkish",
    "ru": "Russian", "nl": "Dutch", "cs": "Czech", "ar": "Arabic",
    "zh": "Chinese", "hu": "Hungarian", "ko": "Korean", "ja": "Japanese",
    "hi": "Hindi",
}

# Emotion/style mappings (prompt modifications for XTTS)
EMOTION_PROMPTS = {
    "neutral": "",
    "happy": "Speaking with a warm, cheerful tone.",
    "sad": "Speaking with a somber, melancholic voice.",
    "excited": "Speaking with high energy and enthusiasm!",
    "calm": "Speaking softly and peacefully.",
    "professional": "Speaking in a clear, authoritative business tone.",
    "storytelling": "Speaking in an engaging, narrative style.",
    "news": "Speaking in a clear, journalistic news anchor tone.",
    "angry": "Speaking with tension and force.",
    "whisper": "Speaking quietly and gently.",
}


class TTSPipeline:
    """
    Text-to-Speech pipeline using XTTS-v2.
    Supports voice cloning from embeddings, streaming, and multi-language.
    """

    def __init__(self):
        self.tts = None
        self.device = settings.DEVICE
        self.sample_rate = settings.TTS_SAMPLE_RATE
        self._loading = False
        self._loaded = False

    async def ensure_loaded(self):
        """Lazy-load the TTS model on first use."""
        if self._loaded:
            return
        if self._loading:
            while self._loading:
                await asyncio.sleep(0.1)
            return

        self._loading = True
        try:
            await asyncio.get_event_loop().run_in_executor(None, self._load_model)
            self._loaded = True
            logger.info("TTS model loaded successfully")
        except Exception as e:
            logger.error(f"TTS model load failed: {e}")
            raise
        finally:
            self._loading = False

    def _load_model(self):
        """Load XTTS-v2 model (blocking, run in executor)."""
        try:
            from TTS.api import TTS
            self.tts = TTS(model_name=settings.TTS_MODEL, progress_bar=False)
            if self.device != "cpu":
                self.tts.to(self.device)
            self.sample_rate = self.tts.synthesizer.output_sample_rate
            logger.info(f"XTTS-v2 loaded on {self.device}, sample_rate={self.sample_rate}")
        except ImportError:
            logger.warning("TTS library not installed. Using espeak fallback.")
            self._use_fallback = True
        except Exception as e:
            logger.warning(f"XTTS-v2 load error: {e}. Using espeak fallback.")
            self._use_fallback = True

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speaker_wav: Optional[str] = None,
        language: str = "en",
        emotion: str = "neutral",
        speed: float = 1.0,
        temperature: float = 0.7,
        output_format: str = "wav",
    ) -> Tuple[bytes, int]:
        """
        Generate speech from text.
        Returns (audio_bytes, sample_rate).
        """
        await self.ensure_loaded()

        # Prepend emotion style if applicable
        emotion_prefix = EMOTION_PROMPTS.get(emotion, "")
        if emotion_prefix:
            full_text = f"{emotion_prefix} {text}"
        else:
            full_text = text

        # Handle long text by chunking
        if len(full_text) > settings.TTS_MAX_TEXT_LENGTH:
            chunks = self._chunk_text(full_text, max_len=500)
            audio_parts = []
            for chunk in chunks:
                part, sr = await self._synthesize_chunk(chunk, speaker_wav, language, speed, temperature)
                audio_parts.append(part)
            combined = np.concatenate(audio_parts)
            audio_bytes = self._numpy_to_bytes(combined, self.sample_rate, output_format)
            return audio_bytes, self.sample_rate
        else:
            audio_np, sr = await self._synthesize_chunk(full_text, speaker_wav, language, speed, temperature)
            audio_bytes = self._numpy_to_bytes(audio_np, sr, output_format)
            return audio_bytes, sr

    async def _synthesize_chunk(
        self, text: str, speaker_wav: Optional[str], language: str, speed: float, temperature: float
    ) -> Tuple[np.ndarray, int]:
        """Synthesize a single text chunk."""
        loop = asyncio.get_event_loop()

        def _synth():
            if getattr(self, '_use_fallback', False) or self.tts is None:
                return self._espeak_fallback(text, language, speed)

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                out_path = f.name

            try:
                kwargs = {
                    "text": text,
                    "file_path": out_path,
                    "language": language,
                    "speed": speed,
                }
                if speaker_wav and os.path.exists(speaker_wav):
                    kwargs["speaker_wav"] = speaker_wav

                self.tts.tts_to_file(**kwargs)

                import soundfile as sf
                audio, sr = sf.read(out_path)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                return audio.astype(np.float32), sr
            finally:
                try:
                    os.unlink(out_path)
                except Exception:
                    pass

        return await loop.run_in_executor(None, _synth)

    async def stream(
        self,
        text: str,
        voice_id: Optional[str] = None,
        language: str = "en",
        speed: float = 1.0,
        temperature: float = 0.7,
        chunk_size_chars: int = 200,
    ) -> AsyncIterator[Tuple[bytes, int]]:
        """
        Stream TTS output as audio chunks.
        Yields (audio_bytes, sample_rate) for each chunk.
        """
        await self.ensure_loaded()

        # Split text into streamable chunks at sentence boundaries
        text_chunks = self._chunk_text_sentences(text, max_chars=chunk_size_chars)

        for i, chunk_text in enumerate(text_chunks):
            try:
                audio_np, sr = await self._synthesize_chunk(
                    chunk_text, voice_id, language, speed, temperature
                )
                audio_bytes = self._numpy_to_bytes(audio_np, sr, "wav")
                yield audio_bytes, sr
                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.01)
            except Exception as e:
                logger.error(f"Streaming chunk {i} error: {e}")
                continue

    def _espeak_fallback(self, text: str, language: str = "en", speed: float = 1.0):
        """
        Fallback TTS using espeak-ng (system dependency).
        Produces robotic but functional speech for development.
        """
        try:
            import subprocess
            import soundfile as sf
            sr = 22050
            wpm = int(175 * speed)
            lang_map = {"en": "en", "es": "es", "fr": "fr", "de": "de", "it": "it"}
            espeak_lang = lang_map.get(language, "en")

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                out_path = f.name

            result = subprocess.run([
                "espeak-ng", "-v", espeak_lang,
                "-s", str(wpm),
                "-w", out_path,
                text[:500],  # espeak has limits
            ], capture_output=True, timeout=30)

            if result.returncode == 0 and os.path.exists(out_path):
                audio, file_sr = sf.read(out_path)
                os.unlink(out_path)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                return audio.astype(np.float32), file_sr
            else:
                # Generate silence as last resort
                return np.zeros(int(sr * len(text) * 0.1), dtype=np.float32), sr
        except Exception as e:
            logger.warning(f"espeak fallback failed: {e}")
            sr = 22050
            return np.zeros(int(sr * 0.5), dtype=np.float32), sr

    def _chunk_text(self, text: str, max_len: int = 500) -> List[str]:
        """Split text into chunks for processing."""
        words = text.split()
        chunks = []
        current = []
        current_len = 0

        for word in words:
            if current_len + len(word) + 1 > max_len and current:
                chunks.append(" ".join(current))
                current = [word]
                current_len = len(word)
            else:
                current.append(word)
                current_len += len(word) + 1

        if current:
            chunks.append(" ".join(current))
        return chunks

    def _chunk_text_sentences(self, text: str, max_chars: int = 200) -> List[str]:
        """Split text at sentence boundaries for streaming."""
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current = ""
        for sent in sentences:
            if len(current) + len(sent) > max_chars and current:
                chunks.append(current.strip())
                current = sent
            else:
                current += " " + sent if current else sent
        if current:
            chunks.append(current.strip())
        return chunks if chunks else [text]

    def _numpy_to_bytes(self, audio: np.ndarray, sample_rate: int, format: str = "wav") -> bytes:
        """Convert numpy audio array to bytes in requested format."""
        import soundfile as sf
        buf = io.BytesIO()
        sf_format = format.upper()
        if sf_format == "MP3":
            # soundfile doesn't support MP3 write; convert via pydub if available
            try:
                from pydub import AudioSegment
                wav_buf = io.BytesIO()
                sf.write(wav_buf, audio, sample_rate, format="WAV")
                wav_buf.seek(0)
                seg = AudioSegment.from_wav(wav_buf)
                seg.export(buf, format="mp3")
            except Exception:
                # Fall back to WAV
                sf.write(buf, audio, sample_rate, format="WAV")
        elif sf_format == "OGG":
            sf.write(buf, audio, sample_rate, format="OGG", subtype="VORBIS")
        elif sf_format == "FLAC":
            sf.write(buf, audio, sample_rate, format="FLAC")
        else:
            sf.write(buf, audio, sample_rate, format="WAV")
        buf.seek(0)
        return buf.read()

    async def extract_speaker_embedding(self, audio_path: str) -> Optional[str]:
        """
        Extract speaker embedding from audio file.
        Returns path to saved embedding file.
        """
        await self.ensure_loaded()

        if getattr(self, '_use_fallback', False) or self.tts is None:
            logger.warning("Cannot extract embedding: TTS model not available")
            return None

        loop = asyncio.get_event_loop()

        def _extract():
            try:
                if hasattr(self.tts, 'synthesizer') and hasattr(self.tts.synthesizer, 'tts_model'):
                    # XTTS-v2 style embedding
                    gpt_cond_latent, speaker_embedding = self.tts.synthesizer.tts_model.get_conditioning_latents(
                        audio_path=[audio_path]
                    )
                    emb_path = audio_path.replace(".wav", "_embedding.pt")
                    import torch
                    torch.save({
                        "gpt_cond_latent": gpt_cond_latent,
                        "speaker_embedding": speaker_embedding,
                    }, emb_path)
                    return emb_path
                return None
            except Exception as e:
                logger.warning(f"Embedding extraction failed: {e}")
                return None

        return await loop.run_in_executor(None, _extract)


# ─── Singleton ────────────────────────────────────────────────────────────────

_tts_pipeline: Optional[TTSPipeline] = None


def get_tts_pipeline() -> TTSPipeline:
    global _tts_pipeline
    if _tts_pipeline is None:
        _tts_pipeline = TTSPipeline()
    return _tts_pipeline
