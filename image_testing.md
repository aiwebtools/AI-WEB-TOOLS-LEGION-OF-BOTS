# Image attachment testing rules (emergentintegrations)
- Accepted MIME types: image/jpeg, image/png, image/webp only.
- Send base64 (without data: prefix) via body.images to POST /api/chat/stream.
- Only bots with capabilities.image=true accept images; UI disables attach otherwise.
- Use a small real JPEG/PNG (resize before encoding). Do not send blank/solid images.
- Vision works on all 3 models (Claude Sonnet 4.6, GPT-5.4, Gemini 3.1 Pro).
