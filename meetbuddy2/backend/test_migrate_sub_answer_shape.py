"""Mapping logic for the flat-list -> {sub_question_id: answer} repair.

Pure function, no database: the live run was verified against the real row,
what matters here is that values land on the right question."""
import pytest

from migrate_sub_answer_shape import OPTION_INDEX, _rebuild


def test_single_choice_answers_get_their_ids_back():
    rebuilt, unmapped = _rebuild("mood", ["Business-y"],
                                 ["Casual", "Private area / room"])
    assert rebuilt == {"by_formality": "Casual", "by_seating": "Private area / room"}
    assert unmapped == []


def test_multi_choice_answers_collect_into_a_list():
    rebuilt, unmapped = _rebuild("planningStyle", ["Surprise me"],
                                 ["Food quality", "Ambience"])
    assert rebuilt == {"sm_prior": ["Food quality", "Ambience"]}
    assert unmapped == []


def test_the_same_value_resolves_per_branch():
    """'Either' belongs to a different question in each mood branch, which is
    why the account's main answer scopes the lookup."""
    assert _rebuild("mood", ["Fun & Energetic"], ["Either"])[0] == {"fe_outdoor": "Either"}
    assert _rebuild("mood", ["Chill & Relaxed"], ["Either"])[0] == {"cr_setting": "Either"}


def test_unplaceable_values_are_reported_not_guessed():
    """Free-text answers have no options to match, so they cannot be recovered."""
    rebuilt, unmapped = _rebuild("mood", ["Business-y"], ["Casual", "something typed"])
    assert rebuilt == {"by_formality": "Casual"}
    assert unmapped == ["something typed"]


def test_unknown_category_or_branch_maps_nothing():
    assert _rebuild("nope", ["Business-y"], ["Casual"]) == ({}, ["Casual"])
    assert _rebuild("mood", ["Not A Real Answer"], ["Casual"]) == ({}, ["Casual"])


@pytest.mark.parametrize("category", sorted(OPTION_INDEX))
def test_no_option_value_is_ambiguous_inside_a_branch(category):
    """The premise the repair rests on: within one branch, a value identifies
    exactly one sub-question. If subQuestionMap ever breaks this, so does the
    recovery."""
    for branch, options in OPTION_INDEX[category].items():
        seen = {}
        for value, (sub_id, _type) in options.items():
            assert value not in seen or seen[value] == sub_id, (
                f"{category}/{branch}: {value!r} maps to two questions")
            seen[value] = sub_id
