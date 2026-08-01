"""Generation modules: script, scene, prompt, SEO, and caption generators.

Every generator accepts an optional `LLMClient`. When the client has no
working backend (the default, zero-install state), each generator falls
back to deterministic offline templates — the app never hard-fails for
lack of an API key or a local model server.
"""
