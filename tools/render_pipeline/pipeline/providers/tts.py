import subprocess
from abc import ABC, abstractmethod


class TTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, out_path: str) -> str:
        """Write narration audio to out_path (wav or mp3) and return it."""


class EspeakTTSProvider(TTSProvider):
    """
    Zero-API-key fallback using the local espeak-ng binary. Robotic, but
    it proves the timing/assembly pipeline end-to-end with no network
    calls or paid keys -- swap to OpenAI or ElevenLabs for real narration.
    """

    def __init__(self, voice="en-us", speed_wpm=155):
        self.voice = voice
        self.speed_wpm = speed_wpm

    def synthesize(self, text, out_path):
        subprocess.run(
            ["espeak-ng", "-v", self.voice, "-s", str(self.speed_wpm), "-w", out_path, text],
            check=True, capture_output=True,
        )
        return out_path


class OpenAITTSProvider(TTSProvider):
    def __init__(self, api_key, model, voice):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.voice = voice

    def synthesize(self, text, out_path):
        with self.client.audio.speech.with_streaming_response.create(
            model=self.model, voice=self.voice, input=text
        ) as response:
            response.stream_to_file(out_path)
        return out_path


class ElevenLabsTTSProvider(TTSProvider):
    def __init__(self, api_key, voice_id):
        self.api_key = api_key
        self.voice_id = voice_id

    def synthesize(self, text, out_path):
        import requests

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {"text": text, "model_id": "eleven_monolingual_v1"}
        resp = requests.post(url, json=payload, headers=headers, timeout=120)
        resp.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(resp.content)
        return out_path


def get_tts_provider(name, config):
    if name == "openai":
        if not config.OPENAI_API_KEY:
            raise RuntimeError("TTS_PROVIDER=openai requires OPENAI_API_KEY")
        return OpenAITTSProvider(config.OPENAI_API_KEY, config.OPENAI_TTS_MODEL, config.OPENAI_TTS_VOICE)
    if name == "elevenlabs":
        if not config.ELEVENLABS_API_KEY or not config.ELEVENLABS_VOICE_ID:
            raise RuntimeError("TTS_PROVIDER=elevenlabs requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID")
        return ElevenLabsTTSProvider(config.ELEVENLABS_API_KEY, config.ELEVENLABS_VOICE_ID)
    return EspeakTTSProvider()
