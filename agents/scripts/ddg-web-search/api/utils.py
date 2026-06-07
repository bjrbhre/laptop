from bs4 import BeautifulSoup
from copy import deepcopy
import os
from dotenv import load_dotenv
from html_to_markdown import convert
from curl_cffi import AsyncSession
import random
import asyncio
import sys


load_dotenv()


base_url_html = 'https://html.duckduckgo.com/html'
# base_url_html = 'http://j.poud.ro/'

# see https://duckduckgo.com/params for parameters
# these are default params sent by search in ddg
params = {
    "q": '',
    "b": '',
}

headers = {
    "Referer": "https://html.duckduckgo.com/",
    "Origin": "https://html.duckduckgo.com",
}

MAX_DOWNLOAD_SIZE = 1_000_000
impersonates = ['chrome', 'firefox']


async def perform_search(query: str):
    data = deepcopy(params)
    data['q'] = f'{query}'
    # print("query", data)

    retries = 0
    while True:
        try:
            async with AsyncSession() as session:
                resp = await session.post(
                    base_url_html,
                    data=data,
                    impersonate=random.choice(impersonates),
                    proxy=os.environ['PROXY_URL'],
                    headers=headers,
                )
        except Exception as e:
            retries += 1
            if retries > 5:
                print(f"ERROR: search request failed after 5 tries: {e}", file=sys.stderr)
                return f'ERROR: search request failed after 5 tries: {e}'
            backoff = min(2 ** retries + random.uniform(0, 1), 30)
            print(f"Request failed ({e}), retrying in {backoff:.1f}s (attempt {retries}/5)...", file=sys.stderr)
            await asyncio.sleep(backoff)
            continue

        results = parse_ddg_html(resp.content)

        # parse_ddg_html returns:
        #  - list (may be empty) → valid DDG response, return immediately
        #  - None → couldn't parse (blocked/error), retry
        # print('RESULTS', results)
        if results is not None:
            return results

        retries += 1
        if retries > 5:
            print("ERROR: could not retrieve search results after 5 tries", file=sys.stderr)
            return 'ERROR: could not retrieve search results after 5 tries'

        backoff = min(2 ** retries + random.uniform(0, 1), 30)
        print(f"No response, retrying in {backoff:.1f}s (attempt {retries}/5)...", file=sys.stderr)
        await asyncio.sleep(backoff)


def parse_ddg_html(txt):
    if not txt:
        return None
    # print('='*30)
    # print(txt)
    # print('='*30)
    if b'No results' in txt:
        return []
    soup = BeautifulSoup(txt, 'lxml')
    elements = soup.find_all('div', class_='result__body')
    if not elements:
        # print(txt)
        return None

    results = []
    cache = set()

    for e in elements:
        title_el = e.find('h2', class_='result__title')
        if not title_el:
            return results

        a_el = title_el.find('a')
        if not a_el:
            continue

        href = a_el.get('href')
        if (
            href
            and href not in cache
            and not href.startswith(
                ("http://www.google.com/search", "https://duckduckgo.com/y.js?ad_domain")
            )
        ):
            cache.add(href)
            title = a_el.get_text()
            body_el = e.find('a', class_='result__snippet')
            body = body_el.get_text() if body_el else ''
            results.append({
                    'href': href,
                    'title': title,
                    'summary': body,
                })

    return results


async def perform_fetch(url, as_md=True):
    try:
        async with AsyncSession() as session:
            async with session.stream(
                "GET",
                url,
                allow_redirects=True,
                timeout=15,
                impersonate=random.choice(impersonates),
            ) as response:
                response.raise_for_status()

                content_type = response.headers.get("Content-Type", "").lower()
                if content_type.startswith("text/"):
                    content_chunks = []
                    downloaded_size = 0

                    async for chunk in response.aiter_content():
                        downloaded_size += len(chunk)
                        if downloaded_size > MAX_DOWNLOAD_SIZE:
                            print(f"Download aborted: File size exceeds {MAX_DOWNLOAD_SIZE / 1_000_000}MB limit.")
                            break
                        content_chunks.append(chunk)

                    html_content = b"".join(content_chunks)
                    raw = html_content.decode()

                    if as_md:
                        result = convert(raw)
                        if isinstance(result, str):
                            md = result
                        elif isinstance(result, dict):
                            md = result['content']
                        else:
                            md = result.content
                        return md.strip()
                    else:
                        return raw
                else:
                    # print(f"ERROR: link does not point to an \"text/\" type endpoint, but to {content_type}")
                    return f"ERROR: link does not point to an \"text/\" type endpoint, but to {content_type}"
    except Exception as e:
        # print(f'ERROR: an exception ocurred : {e}')
        return f'ERROR: an exception ocurred : {e}'

