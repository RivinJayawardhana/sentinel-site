"""
Web crawler service for extracting content from websites.

Provides:
- SafeguardIoTWebCrawler: Playwright-based async crawler for JS-rendered sites
- Content extraction with BeautifulSoup
- Markdown conversion with markdownify
- Polite crawling with depth control and rate limiting
"""

from typing import List, Dict, Any, Set, Callable, Optional
from collections import deque
import re
import asyncio
import sys
import threading
import os
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from markdownify import markdownify as md


class SafeguardIoTWebCrawler:
    """
    Async web crawler using Playwright for JavaScript-rendered content.

    Features:
    - Respects depth limits and exclude patterns
    - Handles SPA/React apps with proper JS rendering waits
    - Extracts clean markdown content
    - Discovers internal links for BFS traversal
    - Polite crawling with configurable delays

    Usage:
        crawler = SafeguardIoTWebCrawler(
            base_url="http://localhost:8081/",
            max_depth=3,
            exclude_patterns=["/login", "/admin"]
        )
        documents = crawler.crawl(start_urls)
    """

    def __init__(
        self,
        base_url: str,
        max_depth: int,
        exclude_patterns: List[str],
        login_email: Optional[str] = None,
        login_password: Optional[str] = None,
        login_url: Optional[str] = None,
    ):
        self.base_url = self._canonicalize_url(base_url)
        parsed_base = urlparse(self.base_url)
        if not parsed_base.scheme or not parsed_base.netloc:
            raise ValueError(f"Invalid base_url: {base_url}")

        self.base_domain = parsed_base.netloc
        self.base_path = parsed_base.path.rstrip("/") or "/"
        self.max_depth = max_depth
        self.exclude_patterns = exclude_patterns
        self.visited: Set[str] = set()
        self.documents: List[Dict[str, Any]] = []
        self.login_email = login_email or os.getenv("CRAWL_LOGIN_EMAIL")
        self.login_password = login_password or os.getenv("CRAWL_LOGIN_PASSWORD")
        configured_login_url = login_url or os.getenv("CRAWL_LOGIN_URL")
        self.login_url = self._canonicalize_url(configured_login_url) if configured_login_url else self.base_url

    def _run_async_sync(self, coroutine_factory: Callable[[], Any]) -> Any:
        """
        Run async code from sync contexts, including Jupyter on Windows.

        Playwright needs subprocess support, which breaks if a notebook forces
        `WindowsSelectorEventLoopPolicy`. To avoid that, Windows runs use a
        dedicated worker thread with a Proactor event loop.
        """
        if sys.platform != "win32":
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                return asyncio.run(coroutine_factory())

        outcome: Dict[str, Any] = {}

        def runner() -> None:
            loop = (
                asyncio.ProactorEventLoop()
                if sys.platform == "win32" and hasattr(asyncio, "ProactorEventLoop")
                else asyncio.new_event_loop()
            )
            asyncio.set_event_loop(loop)

            try:
                outcome["result"] = loop.run_until_complete(coroutine_factory())
            except BaseException as exc:
                outcome["error"] = exc
            finally:
                try:
                    pending = asyncio.all_tasks(loop)
                    for task in pending:
                        task.cancel()
                    if pending:
                        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                    loop.run_until_complete(loop.shutdown_asyncgens())
                finally:
                    asyncio.set_event_loop(None)
                    loop.close()

        worker = threading.Thread(target=runner, daemon=True)
        worker.start()
        worker.join()

        if "error" in outcome:
            raise outcome["error"]

        return outcome["result"]

    @staticmethod
    def _canonicalize_url(url: str) -> str:
        """Normalize URL for consistent deduplication and matching."""
        parsed = urlparse(url)
        path = parsed.path or "/"
        if path != "/":
            path = path.rstrip("/")
        cleaned = parsed._replace(path=path, query="", fragment="")
        return cleaned.geturl()

    def _is_internal_url(self, url: str) -> bool:
        """Check whether URL belongs to the configured site scope."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        if parsed.netloc != self.base_domain:
            return False
        if self.base_path != "/" and not parsed.path.startswith(self.base_path):
            return False
        return True

    def should_crawl(self, url: str) -> bool:
        """Check if URL should be crawled based on rules."""
        normalized_url = self._canonicalize_url(url)

        if normalized_url in self.visited:
            return False

        # Must be within configured domain/path scope.
        if not self._is_internal_url(normalized_url):
            return False

        # When authenticated crawling is enabled, skip the login page itself.
        if self.login_email and self.login_password and normalized_url == self.login_url:
            return False

        # Check exclude patterns.
        for pattern in self.exclude_patterns:
            if pattern in normalized_url:
                return False

        # Skip media files.
        if re.search(r"\.(jpg|jpeg|png|gif|pdf|zip|exe)$", normalized_url, re.I):
            return False

        return True

    def extract_content(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """
        Extract clean content from HTML soup.

        Returns dict with:
        - title: Page title
        - headings: List of h1-h4 text
        - content: Clean markdown
        - links: List of internal URLs
        """
        # Get title.
        title = soup.title.string if soup.title else url.split("/")[-1]
        title = title.strip() if title else "Untitled"

        # Extract headings.
        headings = [h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3", "h4"])]

        # Extract links.
        normalized_current_url = self._canonicalize_url(url)
        links = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if not href:
                continue

            if href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            resolved_url = self._canonicalize_url(urljoin(normalized_current_url, href))

            # Only include internal links.
            if self._is_internal_url(resolved_url) and resolved_url != normalized_current_url:
                links.append(resolved_url)

        # Remove noise elements for content extraction after link discovery.
        for element in soup(["script", "style", "nav", "footer", "aside", "noscript", "iframe"]):
            element.decompose()

        # Find main content (try different selectors for React/SPA).
        main_content = (
            soup.find("div", {"id": "root"})
            or soup.find("main")
            or soup.find("article")
            or soup.find("div", {"class": re.compile("content|main|container", re.I)})
            or soup.body
        )

        if main_content:
            content_md = md(str(main_content), heading_style="ATX")
        else:
            content_md = md(str(soup), heading_style="ATX")

        # Clean up markdown.
        content_md = re.sub(r"You need to enable JavaScript.*?\.", "", content_md, flags=re.IGNORECASE)
        content_md = re.sub(r"\n{3,}", "\n\n", content_md)
        content_md = content_md.strip()

        return {
            "title": title,
            "headings": headings,
            "content": content_md,
            "links": list(set(links)),
        }

    async def _wait_for_page_ready(self, page) -> None:
        """Wait for JS-rendered content and lazy-loaded sections."""
        try:
            await page.wait_for_selector("body", timeout=10000)
            await page.wait_for_timeout(3000)
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1000)
        except Exception:
            await page.wait_for_timeout(5000)

    async def _first_existing_selector(self, page, selectors: List[str]) -> Optional[str]:
        """Return first selector that exists in DOM."""
        for selector in selectors:
            try:
                if await page.query_selector(selector):
                    return selector
            except Exception:
                continue
        return None

    async def _login_and_get_entry_url(self, page) -> Optional[str]:
        """
        Authenticate before crawling and return post-login entry URL.

        Returns None when credentials are not configured.
        """
        if not (self.login_email and self.login_password):
            return None

        print(f"[AUTH] Logging in at {self.login_url}")
        await page.goto(self.login_url, wait_until="domcontentloaded", timeout=60000)
        await self._wait_for_page_ready(page)

        email_selector = await self._first_existing_selector(
            page,
            [
                "input[type='email']",
                "input[name='email']",
                "input[id*='email' i]",
                "input[placeholder*='email' i]",
            ],
        )
        password_selector = await self._first_existing_selector(
            page,
            [
                "input[type='password']",
                "input[name='password']",
                "input[id*='password' i]",
                "input[placeholder*='password' i]",
            ],
        )

        if not email_selector or not password_selector:
            raise RuntimeError("Login form not found. Check login_url/selectors.")

        await page.fill(email_selector, self.login_email)
        await page.fill(password_selector, self.login_password)

        clicked = False
        for label in (r"sign in", r"log in", r"login", r"submit"):
            button = page.get_by_role("button", name=re.compile(label, re.I))
            try:
                if await button.count() > 0:
                    await button.first.click()
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            submit_selector = await self._first_existing_selector(
                page, ["button[type='submit']", "input[type='submit']"]
            )
            if submit_selector:
                await page.click(submit_selector)
                clicked = True

        if not clicked:
            await page.press(password_selector, "Enter")

        try:
            await page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            await page.wait_for_timeout(3000)

        await self._wait_for_page_ready(page)
        entry_url = self._canonicalize_url(page.url)
        print(f"[AUTH] Authenticated, starting crawl from {entry_url}")
        return entry_url

    async def crawl_async(self, start_urls: List[str], request_delay: float = 2.0) -> List[Dict[str, Any]]:
        """
        BFS crawl with Playwright for JS rendering.

        Args:
            start_urls: List of seed URLs to start crawling
            request_delay: Seconds to wait between requests (politeness)

        Returns:
            List of document dicts with url, title, content, links, depth_level
        """
        seeds = [self._canonicalize_url(url) for url in start_urls]
        queue = deque([(url, 0) for url in seeds])

        async with async_playwright() as p:
            # Launch browser (headless mode).
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            page.set_default_timeout(30000)  # 30 seconds.

            login_entry_url = await self._login_and_get_entry_url(page)
            if login_entry_url:
                seed_set = {
                    url for url in seeds if url not in {self.login_url, login_entry_url}
                }
                queue = deque([(login_entry_url, 0)] + [(url, 0) for url in seed_set])

            while queue:
                url, depth = queue.popleft()
                url = self._canonicalize_url(url)

                if depth > self.max_depth or not self.should_crawl(url):
                    continue

                try:
                    print(f"[CRAWL:{depth}] {url}")
                    self.visited.add(url)

                    # Navigate and wait for page load.
                    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

                    # Wait for React/SPA to render.
                    await self._wait_for_page_ready(page)

                    # Get rendered HTML.
                    html = await page.content()
                    soup = BeautifulSoup(html, "html.parser")

                    # Extract content.
                    doc_data = self.extract_content(soup, url)
                    doc_data["url"] = url
                    doc_data["depth_level"] = depth

                    # Only save if content is substantial.
                    if len(doc_data["content"]) >= 100:
                        self.documents.append(doc_data)
                        print(
                            f"   [OK] Saved ({len(doc_data['content'])} chars, "
                            f"{len(doc_data['links'])} links found)"
                        )
                    else:
                        print(f"   [SKIP] Content too short: {len(doc_data['content'])} chars")

                    # Add links to queue if depth allows.
                    if depth < self.max_depth:
                        links_added = 0
                        queued_urls = {item[0] for item in queue}
                        for link in doc_data["links"]:
                            if link not in self.visited and link not in queued_urls:
                                queue.append((link, depth + 1))
                                links_added += 1
                        if links_added > 0:
                            print(f"   [QUEUE] Added {links_added} new URLs (depth {depth + 1})")

                    # Progress update.
                    print(
                        f"   [PROGRESS] {len(self.documents)} saved, "
                        f"{len(self.visited)} visited, {len(queue)} queued"
                    )

                    # Polite delay.
                    await asyncio.sleep(request_delay)

                except Exception as e:
                    error_msg = str(e)
                    if "404" in error_msg or "net::ERR_" in error_msg:
                        print("   [SKIP] Page not found (404)")
                    else:
                        print(f"   [ERROR] {error_msg[:100]}")
                    continue

            await browser.close()

        return self.documents

    def crawl(self, start_urls: List[str], request_delay: float = 2.0) -> List[Dict[str, Any]]:
        """
        Synchronous wrapper for async crawl (for Jupyter compatibility).

        Args:
            start_urls: List of seed URLs
            request_delay: Seconds between requests

        Returns:
            List of crawled documents
        """
        self.visited.clear()
        self.documents.clear()
        return self._run_async_sync(lambda: self.crawl_async(start_urls, request_delay))


# Backward-compatible alias for existing imports.
NawalokaWebCrawler = SafeguardIoTWebCrawler

__all__ = ["SafeguardIoTWebCrawler", "NawalokaWebCrawler"]
