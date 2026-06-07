from mcp.server.fastmcp import FastMCP
from utils import perform_search, perform_fetch
import os


mcp = FastMCP(
    name="ddg-web-search-server",
    instructions="A server that performs web searches using DuckDuckGo.",
    host=os.environ.get('MCP_HOST', '127.0.0.1'),
    port=os.environ.get('MCP_PORT', '8000'),
)


@mcp.tool()
async def web_search(query: str):
    """Performs a DuckDuckGo web search and returns the results."""
    return await perform_search(query)

@mcp.tool()
async def fetch_page(url: str):
    """Fetches a webpage text by it's url."""
    return await perform_fetch(url)

if __name__ == "__main__":
    # mcp.run()
    mcp.run(transport="streamable-http")
