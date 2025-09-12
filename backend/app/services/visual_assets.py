import os
from typing import Any, Dict, List
import httpx

STABLE_DIFFUSION_URL = "https://api.stability.ai/v1/generation/stable-diffusion-v1-5/text-to-image"
PEXELS_URL = "https://api.pexels.com/v1/search"
CANVA_RENDER_URL = "https://api.canva.com/v1/render"  # placeholder endpoint

def optimize_prompt(prompt: str) -> str:
    """Enhance prompts with Indian aesthetic cues."""
    return f"{prompt}, Indian style, Bollywood visuals, vibrant colors"

def generate_ai_images(prompt: str, samples: int = 1) -> List[str]:
    """Call Stable Diffusion API and return base64 images. Fallback to placeholders."""
    api_key = os.getenv("STABILITY_API_KEY")
    if not api_key:
        return ["placeholder_ai_image.png"] * samples
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"text_prompts": [{"text": prompt}], "cfg_scale": 7, "samples": samples}
    try:
        resp = httpx.post(STABLE_DIFFUSION_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
    except Exception:
        return ["placeholder_ai_image.png"] * samples
    images: List[str] = []
    for artifact in resp.json().get("artifacts", []):
        base64_data = artifact.get("base64")
        if base64_data:
            images.append(f"data:image/png;base64,{base64_data}")
    return images or ["placeholder_ai_image.png"] * samples

def fetch_stock_images(query: str, limit: int = 5) -> List[str]:
    """Search Indian stock photos using Pexels (or similar) API."""
    api_key = os.getenv("STOCK_API_KEY")
    if not api_key:
        return []
    headers = {"Authorization": api_key}
    params = {"query": query, "per_page": limit}
    try:
        resp = httpx.get(PEXELS_URL, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
    except Exception:
        return []
    data = resp.json()
    return [photo["src"].get("original") for photo in data.get("photos", []) if photo.get("src")]

def render_template(template_id: str, images: List[str], text: Dict[str, str]) -> str:
    """Render assets into a Canva template. Returns URL to rendered asset."""
    api_key = os.getenv("CANVA_API_KEY")
    if not api_key:
        return "template_placeholder.png"
    payload = {"template_id": template_id, "images": images, "text": text}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        resp = httpx.post(CANVA_RENDER_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
    except Exception:
        return "template_placeholder.png"
    return resp.json().get("url", "template_placeholder.png")

def generate_visual_brief(description: str) -> Dict[str, Any]:
    """Create mood board and references for a project."""
    prompt = optimize_prompt(description)
    ai_images = generate_ai_images(prompt, samples=3)
    stock_images = fetch_stock_images(description)
    mood_board = ai_images + stock_images
    return {
        "mood_board": mood_board,
        "art_direction_notes": prompt,
        "reference_images": stock_images,
    }
