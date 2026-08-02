"""
Kiongozi AI — Flask Backend
Gemini-powered: simplify, translate, caption, UI suggestion
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from dotenv import load_dotenv
import os, json, requests

load_dotenv()

app = Flask(__name__)
CORS(app)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

READING_LEVELS = {
    1: "very simple English, short sentences, Grade 3 reading level — avoid all jargon",
    2: "clear, plain English at a Grade 6 reading level — short sentences, minimal jargon",
    3: "standard English with moderate detail — avoid unnecessary jargon but allow some technical terms",
}


# ── Health check ──────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "Kiongozi AI backend is running ✓", "version": "2.0"})


# ── Simplify ──────────────────────────────────────────────────────────────────
@app.route("/simplify", methods=["POST"])
def simplify():
    data = request.get_json()
    text = (data.get("text") or "").strip()
    reading_level = int(data.get("reading_level", 1))
    level_desc = READING_LEVELS.get(reading_level, READING_LEVELS[1])

    if not text:
        return jsonify({"error": "No text provided"}), 400

    prompt = f"""You are Kiongozi AI, an accessibility assistant. Your users are elderly 
Kenyan internet users who need web content simplified.

PART 1: Rewrite the text below using {level_desc}. 
Be warm, friendly, and conversational. Keep it short.

PART 2: Extract 3-5 key bullet-point takeaways.

Return ONLY valid JSON (no markdown fences):
{{
  "result": "<simplified text>",
  "key_points": ["point 1", "point 2", "point 3"]
}}

Text to simplify:
{text[:3500]}
"""

    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    raw = response.text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()

    try:
        return jsonify(json.loads(raw))
    except Exception:
        return jsonify({"result": response.text.strip(), "key_points": []})


# ── Translate ─────────────────────────────────────────────────────────────────
@app.route("/translate", methods=["POST"])
def translate():
    data = request.get_json()
    text = (data.get("text") or "").strip()
    language = data.get("language", "Swahili")

    if not text:
        return jsonify({"error": "No text provided"}), 400

    prompt = f"""You are Kiongozi AI. Translate the following text into {language}.
Make the translation natural, accurate, and easy for an elderly person to understand.
Return ONLY the translated text — no preamble, no explanation.

Text:
{text[:3500]}
"""
    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    return jsonify({"result": response.text.strip()})


# ── Caption (image description) ───────────────────────────────────────────────
@app.route("/caption", methods=["POST"])
def caption():
    data = request.get_json()
    image_url = (data.get("image_url") or "").strip()

    if not image_url:
        return jsonify({"error": "No image URL provided"}), 400

    try:
        img_resp = requests.get(image_url, timeout=6)
        img_bytes = img_resp.content
        mime = img_resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()

        if mime not in ("image/jpeg", "image/png", "image/gif", "image/webp"):
            return jsonify({"error": f"Unsupported image type: {mime}"}), 400

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": img_bytes}},
                    {"text": (
                        "Describe this image in 1-2 simple, friendly sentences "
                        "for an elderly user who cannot see it. "
                        "Be warm, clear, and avoid technical language."
                    )}
                ]
            }]
        )
        return jsonify({"result": response.text.strip()})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Summarise (bonus: quick TL;DR for very long pages) ────────────────────────
@app.route("/summarise", methods=["POST"])
def summarise():
    data = request.get_json()
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    prompt = f"""You are Kiongozi AI. Give a 3-sentence TL;DR summary of the following 
web page content. Write for an elderly reader in very simple, clear English.
Return only the summary — no labels, no preamble.

Content:
{text[:3500]}
"""
    response = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    return jsonify({"result": response.text.strip()})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port)
