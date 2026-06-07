from mcp.server.fastmcp import FastMCP
from utils import perform_search, perform_fetch

mcp = FastMCP(
    name="web-search",
    instructions="Performs web searches using DuckDuckGo.",
)


@mcp.tool()
async def web_search(query: str):
    """Performs a web search and returns the results."""
    return await perform_search(query)

@mcp.tool()
async def fetch_page(url: str):
    """Fetches a webpage text by it's url."""
    return await perform_fetch(url)


if __name__ == "__main__":
    mcp.run()
