from fastapi import FastAPI

from .utils import perform_search, perform_fetch


app = FastAPI()


@app.get('/query')
async def web_search(query: str):
    """Performs a DuckDuckGo web search and returns the results."""
    return await perform_search(query)

@app.get('/fetch')
async def fetch_page(url: str):
    """Fetches a webpage text by it's url."""
    return await perform_fetch(url)
