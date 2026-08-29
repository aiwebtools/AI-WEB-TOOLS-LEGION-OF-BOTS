"""Document generation + file download ownership + image capability gating tests."""
import base64
import io
import json
import uuid

import pytest
import requests

from conftest import API


def sse_chat(token, payload, timeout=240):
    events = []
    with requests.post(f"{API}/chat/stream", json=payload, timeout=timeout,
                       headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                       stream=True) as r:
        assert r.status_code == 200, f"stream status {r.status_code}: {r.text[:300]}"
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data: "):
                events.append(json.loads(line[6:]))
    return events


def small_jpeg_b64():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (240, 160), (245, 245, 235))
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 110, 140], fill=(200, 30, 30))
    d.ellipse([130, 30, 220, 120], fill=(30, 60, 200))
    d.text((25, 145), "RED SQUARE", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.mark.chat
class TestDocumentGeneration:
    def test_docx_generation_and_download(self, user_auth, user_client, anon_client):
        prompt = ("Create a downloadable DOCX document titled 'TEST Doc' containing exactly two short "
                  "sentences about writing. Use the platform document-generation tool.")
        file_ev = None
        for _ in range(2):
            ev = sse_chat(user_auth["token"], {"bot_slug": "book-writer", "message": prompt})
            errs = [e for e in ev if e["type"] == "error"]
            assert not errs, errs
            file_ev = next((e for e in ev if e["type"] == "file"), None)
            if file_ev:
                break
        assert file_ev, "assistant never emitted a generate-file block / no 'file' SSE event"
        f = file_ev["file"]
        assert f["format"] == "docx", f
        assert f["size"] > 500
        fid = f["id"]

        # download with query token
        r = requests.get(f"{API}/files/{fid}/download", params={"token": user_auth["token"]}, timeout=60)
        assert r.status_code == 200, r.text[:200]
        assert r.content[:2] == b"PK", "not a valid DOCX (zip) payload"
        assert "wordprocessingml" in r.headers.get("content-type", "")

        # download with Bearer header
        r2 = user_client.get(f"{API}/files/{fid}/download")
        assert r2.status_code == 200

        # unauthenticated
        r3 = anon_client.get(f"{API}/files/{fid}/download")
        assert r3.status_code == 401, r3.status_code

        # other user cannot download
        other_email = f"TEST_{uuid.uuid4().hex[:8]}@legionqa.com"
        reg = requests.post(f"{API}/auth/register", json={"email": other_email, "password": "Passw0rd!"}, timeout=30).json()
        r4 = requests.get(f"{API}/files/{fid}/download",
                          headers={"Authorization": f"Bearer {reg['token']}"}, timeout=30)
        assert r4.status_code == 404, f"ownership leak: other user got {r4.status_code}"

    def test_download_unknown_file_404(self, user_client):
        assert user_client.get(f"{API}/files/{uuid.uuid4()}/download").status_code == 404


@pytest.mark.chat
class TestImageGating:
    def test_image_capable_bot_accepts_image(self, anon_client, user_auth):
        bots = anon_client.get(f"{API}/bots", params={"capability": "image"}).json()
        assert bots, "no bots with capabilities.image=true"
        slug = bots[0]["slug"]
        ev = sse_chat(user_auth["token"], {
            "bot_slug": slug,
            "message": "What two shapes and colors do you see? Answer in under 12 words.",
            "images": [small_jpeg_b64()],
        })
        errs = [e for e in ev if e["type"] == "error"]
        assert not errs, errs
        text = "".join(e.get("content", "") for e in ev if e["type"] == "delta").lower()
        assert len(text) > 3, "empty vision reply"
        assert ("red" in text or "square" in text or "blue" in text or "circle" in text), text[:300]

    def test_non_image_bot_drops_images(self, anon_client, user_auth, user_client):
        bots = anon_client.get(f"{API}/bots", params={"limit": 500}).json()
        no_img = next((b for b in bots if not b.get("capabilities", {}).get("image")), None)
        if not no_img:
            pytest.skip("all bots are image-capable; gating not testable")
        ev = sse_chat(user_auth["token"], {
            "bot_slug": no_img["slug"], "message": "Say OK.", "images": [small_jpeg_b64()],
        })
        errs = [e for e in ev if e["type"] == "error"]
        assert not errs, errs
        conv_id = ev[0]["conversation_id"]
        msgs = user_client.get(f"{API}/conversations/{conv_id}").json()["messages"]
        assert msgs[0]["images"] == [], "images were stored for a non-image-capable bot"
        user_client.delete(f"{API}/conversations/{conv_id}")
