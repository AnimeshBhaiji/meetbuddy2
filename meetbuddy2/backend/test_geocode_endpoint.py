import pytest
from fastapi import HTTPException

import main


def test_geocode_returns_coords(monkeypatch):
    monkeypatch.setattr(main, "geocode_address", lambda q: (12.97, 77.59))
    assert main.geocode(q="MG Road Bangalore") == {"lat": 12.97, "lng": 77.59}


def test_geocode_miss_404(monkeypatch):
    monkeypatch.setattr(main, "geocode_address", lambda q: None)
    with pytest.raises(HTTPException) as exc:
        main.geocode(q="zzz nowhere")
    assert exc.value.status_code == 404


def test_geocode_blank_400():
    with pytest.raises(HTTPException) as exc:
        main.geocode(q="   ")
    assert exc.value.status_code == 400
