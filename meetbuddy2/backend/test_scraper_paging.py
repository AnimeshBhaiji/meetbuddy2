"""A second results page is its own SerpAPI request and its own cache entry;
page 1 keeps the cache key it always had, so nothing already cached goes stale."""
import scraper


class _Resp:
    status_code = 200

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


def test_first_page_cache_key_is_unchanged():
    assert scraper._cache_key("Cafes", (12.971, 77.591), 2500) == "search:cafes:12.97:77.59:2500"


def test_second_page_has_its_own_cache_entry_and_request(monkeypatch):
    store, fetched = {}, []
    monkeypatch.setattr(scraper.cache, "get", lambda k: store.get(k))
    monkeypatch.setattr(scraper.cache, "set", lambda k, v, ttl: store.__setitem__(k, v))
    monkeypatch.setattr(scraper, "fetch_places_page",
                        lambda q, c, r, start=0: fetched.append(start) or [{"title": f"page@{start}"}])

    p1 = scraper.search_places("cafes", (12.97, 77.59), 2500)
    p2 = scraper.search_places("cafes", (12.97, 77.59), 2500, start=20)
    again = scraper.search_places("cafes", (12.97, 77.59), 2500, start=20)

    assert fetched == [0, 20]  # the repeat of page 2 came from the cache
    assert p1 != p2 and again == p2
    assert "search:cafes:12.97:77.59:2500:p20" in store


def test_serpapi_request_carries_the_offset(monkeypatch):
    sent = []
    monkeypatch.setattr(scraper, "SERPAPI_KEY", "test-key")
    monkeypatch.setattr(scraper.http, "get",
                        lambda url, params, timeout: sent.append(dict(params)) or _Resp({"local_results": []}))

    scraper.fetch_places_page("cafes", (12.97, 77.59), 2500)
    scraper.fetch_places_page("cafes", (12.97, 77.59), 2500, start=20)

    assert "start" not in sent[0]
    assert sent[1]["start"] == "20"
