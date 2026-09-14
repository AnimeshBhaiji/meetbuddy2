"""The analyzer has to read the text SerpAPI actually sends, and match whole
words. Measured on 185 cached places: SerpAPI local results carry no snippet
or review text, and all 37 "indoor" tags came from 'ac' inside words like
"space", "terrace" and "snacks"."""
import place_analyzer as pa


def _place(**kw):
    p = {"title": "", "type": "", "description": "", "snippet": "", "reviews": []}
    p.update(kw)
    return p


def test_mood_fit_reads_title_and_type():
    place = _place(title="Candlelight Rooftop Bistro", type="Romantic restaurant")
    assert pa.analyze_mood_fit(place, "Romantic")["mood_match_score"] >= 2


def test_keywords_inside_other_words_do_not_match():
    place = _place(description="Spacious hall, snacks at the back, great reviews")
    atm = pa.detect_atmosphere(place)
    assert not atm["is_indoor"], "'ac' matched inside space/snacks/back"
    assert not atm["has_view"], "'view' matched inside reviews"


def test_whole_words_and_plurals_still_match():
    atm = pa.detect_atmosphere(_place(description="AC dining room with city views"))
    assert atm["is_indoor"]
    assert atm["has_view"]
