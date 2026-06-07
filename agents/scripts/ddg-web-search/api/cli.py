# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "beautifulsoup4",
#   "lxml",
#   "httpx",
#   "python-dotenv",
#   "mcp",
#   "html-to-markdown>=3.1.0",
#   "curl_cffi",
#   "click",
# ]
# ///


import click
import asyncio
import json

from utils import perform_fetch, perform_search


@click.group()
def cli():
    """Web search and page fetching CLI tool using DuckDuckGo."""
    pass


@cli.command()
@click.argument('query', required=True)
@click.option('--json-output', '-j', is_flag=True, help='Output results as JSON')
@click.option('--limit', '-l', type=int, default=10, help='Maximum number of results (default: 10)')
def search(query, json_output, limit):
    """Perform a web search using DuckDuckGo."""
    results = asyncio.run(perform_search(query))

    if results is None or isinstance(results, str):
        click.echo(f"Error: {results if isinstance(results, str) else 'Search failed or no results found.'}", err=True)
        raise SystemExit(1)

    if not results:
        click.echo("No results found.")
        return

    # Limit results
    results = results[:limit]

    if json_output:
        click.echo(json.dumps(results, indent=2))
    else:
        for i, result in enumerate(results, 1):
            click.echo(f"\n{i}. {result['title']}")
            click.echo(f"   URL: {result['href']}")
            click.echo(f"   Summary: {result['summary'][:200]}{'...' if len(result['summary']) > 200 else ''}")


@cli.command()
@click.argument('url', nargs=-1, required=True)
@click.option('--raw', is_flag=True, help='Output raw HTML instead of markdown')
def fetch(url, raw):
    url = ' '.join(url)
    """Fetch and convert a webpage to markdown or raw HTML."""
    content = asyncio.run(perform_fetch(url, as_md=not raw))

    if content.startswith('ERROR:'):
        click.echo(f"Error: {content}", err=True)
        raise SystemExit(1)

    click.echo(content)


@cli.command()
@click.argument('query', required=True)
@click.option('--format', '-f', type=click.Choice(['json', 'text']), default='text', help='Output format')
def quick(query, format):
    """Quick search that shows only URLs (useful for piping)."""
    results = asyncio.run(perform_search(query))

    if results is None or isinstance(results, str):
        click.echo(f"Error: {results if isinstance(results, str) else 'Search failed.'}", err=True)
        raise SystemExit(1)

    if not results:
        click.echo("No results found.")
        return

    if format == 'json':
        urls = [{'title': r['title'], 'url': r['href']} for r in results[:3]]
        click.echo(json.dumps(urls, indent=2))
    else:
        for result in results[:5]:
            click.echo(result['href'])


if __name__ == '__main__':
    cli()
