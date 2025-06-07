import os
import time
import base64
import re
from urllib.parse import urljoin, urlparse

from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bs4 import BeautifulSoup
import google.generativeai as genai
from dotenv import load_dotenv
import httpx
import cssutils
import asyncio

load_dotenv()

API_KEY = os.getenv("API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in environment variables")

genai.configure(api_key=GEMINI_API_KEY)
# for m in genai.list_models():
#     print(m.name, "  ->  ", m.supported_generation_methods)

app = FastAPI()

origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_TTL_SECONDS = 3600  # 1 hour
cache = {}  # Simple in-memory cache


def get_cached_clone(url: str):
    entry = cache.get(url)
    if entry and time.time() - entry["timestamp"] < CACHE_TTL_SECONDS:
        return entry["html"]
    return None


def set_cache(url: str, html: str):
    cache[url] = {"html": html, "timestamp": time.time()}


class CloneRequest(BaseModel):
    url: str


def call_llm_clone(html_content: str) -> str:
    prompt = f"""
You are a skilled front-end developer. Your job is to recreate a website's design using only HTML and inline CSS.
Here is the scraped content of a public website:

{html_content}

Example expected output:

<html>
  <head><style>body {{ font-family: Arial; background: #fff; }}</style></head>
  <body>
    <header style="background-color:#333;color:#fff;padding:20px;text-align:center;">My Site</header>
    <main style="padding:20px;">
      <h1 style="font-size:24px;">Welcome to my website</h1>
      <p style="font-size:16px;color:#555;">This is a cloned page.</p>
    </main>
  </body>
</html>

Your goal is to recreate a simplified version of the webpage's layout and style in a single HTML file.
Don't include any JavaScript. Only use HTML and inline CSS.

Make it mobile responsive and use semantic HTML5 elements where possible.
Keep it clean and readable.
"""
    model = genai.GenerativeModel(model_name="gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text


async def fetch_page_content(url: str) -> str:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


def remove_scripts_and_iframes(soup: BeautifulSoup) -> BeautifulSoup:
    for tag in soup(["script", "iframe", "noscript", "meta", "link"]):
        tag.decompose()
    return soup


async def inline_css_and_assets(soup: BeautifulSoup, base_url: str) -> BeautifulSoup:
    async with httpx.AsyncClient(timeout=10) as client:
        # Inline external CSS files
        for link in soup.find_all("link", rel="stylesheet"):
            href = link.get("href")
            if href:
                full_url = urljoin(base_url, href)
                try:
                    css_resp = await client.get(full_url)
                    css_resp.raise_for_status()
                    css_text = css_resp.text
                    css_text = await inline_urls_in_css(css_text, full_url, client)
                    style_tag = soup.new_tag("style")
                    style_tag.string = css_text
                    link.replace_with(style_tag)
                except Exception:
                    # If any failure, just remove the link to avoid broken references
                    link.decompose()

        # Inline images in <img> tags
        for img in soup.find_all("img"):
            src = img.get("src")
            if src:
                full_url = urljoin(base_url, src)
                try:
                    img_resp = await client.get(full_url)
                    img_resp.raise_for_status()
                    b64_data = base64.b64encode(img_resp.content).decode("utf-8")
                    ext = full_url.split('.')[-1].lower()
                    mime = f"image/{ext}" if ext in ['png', 'jpg', 'jpeg', 'gif', 'svg'] else 'image/png'
                    img['src'] = f"data:{mime};base64,{b64_data}"
                except Exception:
                    continue
    return soup


async def inline_urls_in_css(css_text: str, base_url: str, client: httpx.AsyncClient) -> str:
    parser = cssutils.CSSParser()
    sheet = parser.parseString(css_text)

    url_pattern = re.compile(r'url\((.*?)\)')

    for rule in sheet:
        if rule.type == rule.STYLE_RULE:
            for property in rule.style:
                urls = url_pattern.findall(property.value)
                for url_raw in urls:
                    url_clean = url_raw.strip('\'"')
                    abs_url = urljoin(base_url, url_clean)
                    try:
                        resp = await client.get(abs_url)
                        resp.raise_for_status()
                        b64_data = base64.b64encode(resp.content).decode('utf-8')
                        ext = abs_url.split('.')[-1].lower()
                        mime = f"image/{ext}" if ext in ['png', 'jpg', 'jpeg', 'gif', 'svg'] else 'application/octet-stream'
                        data_url = f"url('data:{mime};base64,{b64_data}')"
                        property.value = property.value.replace(f"url({url_raw})", data_url)
                    except Exception:
                        continue

    return sheet.cssText.decode('utf-8')


@app.post("/clone")
async def clone_website(
    req: CloneRequest,
    x_api_key: str = Header(None)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    url = req.url.strip()

    # Validate URL scheme
    parsed_url = urlparse(url)
    if parsed_url.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme. Use http or https.")

    cached_html = get_cached_clone(url)
    if cached_html:
        return {"html": cached_html}

    try:
        raw_html = await fetch_page_content(url)
        soup = BeautifulSoup(raw_html, "html.parser")

        # soup = remove_scripts_and_iframes(soup)
        # soup = await inline_css_and_assets(soup, url)

        clean_html = str(soup.find("body"))

        cloned_html = call_llm_clone(clean_html)

        set_cache(url, cloned_html)

        return {"html": cloned_html}

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"HTTP error: {e}")
    except Exception as e:
        return {"html": f"<h1>Error cloning website</h1><p>{str(e)}</p>"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
