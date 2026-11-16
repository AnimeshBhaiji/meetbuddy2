// src/components/planner/PlannerHome.jsx
// Planner home: your saved answers, where you are, and the route the plan
// will follow from there. The route is the screen's centre: it shows what
// pressing Generate itinerary will do before you press it.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, LocateFixed, Sparkles, Utensils, Ticket, BedDouble, Coffee } from "lucide-react";
import { PREF_META, humanStepName } from "@/hooks/usePlannerSession";
import { api } from "@/lib/api";
import { ErrorBanner } from "./StepExplorer";
import "./PlannerHome.css";

const STEP_ICON = { restaurant: Utensils, activity: Ticket, stay: BedDouble, cafe: Coffee };

const displayPref = (val) => {
  if (!val || (Array.isArray(val) && val.length === 0)) return null;
  return Array.isArray(val) ? val.join(", ") : String(val);
};

export default function PlannerHome({ P }) {
  const navigate = useNavigate();
  const {
    userPrefs, placeText, setPlaceText, coords, locLoading, useMyLocation,
    handlePlaceTextBlur, plannerError, startSession, sessionLoading,
    resetSession,
  } = P;

  // Nothing is in progress on this screen, so no confirmation is needed. Your
  // saved answers come back pre-filled — this reopens them for editing rather
  // than wiping them.
  const startNewPlanner = () => {
    resetSession();
    navigate("/questionnaire-stage1");
  };

  // The steps this account's answers produce, from the same function the
  // planner runs. This used to show a fixed "Restaurant → Activity → Stay".
  const [plannedFlow, setPlannedFlow] = useState(null); // null = loading, [] = unavailable
  useEffect(() => {
    let live = true;
    api.get("/planner/flow")
      .then((res) => { if (live) setPlannedFlow(Array.isArray(res.flow) ? res.flow : []); })
      .catch(() => { if (live) setPlannedFlow([]); });
    return () => { live = false; };
  }, []);

  const startLabel = coords
    ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    : placeText
    ? placeText
    : "No location set";
  const canStart = !sessionLoading && (coords || placeText || (userPrefs && userPrefs.location));

  return (
    <div className="ph">
      <header className="ph__head">
        <div>
          <h1 className="ph__title">Plan your perfect meetup</h1>
          <p className="ph__lead">Personalized recommendations based on your preferences</p>
        </div>
        <button type="button" className="ph-btn ph-btn--quiet" onClick={startNewPlanner}>
          <Sparkles aria-hidden="true" /> Start a new planner
        </button>
      </header>

      <div className="ph__grid">
        <div className="ph__main">
          {/* Location */}
          <section aria-labelledby="ph-location">
            <h2 id="ph-location" className="ph__label">Select location</h2>
            <div className="ph__field">
              <div className="ph__input-wrap">
                <MapPin className="ph__input-icon" aria-hidden="true" />
                <input
                  value={placeText}
                  onChange={(e) => setPlaceText(e.target.value)}
                  onBlur={handlePlaceTextBlur}
                  placeholder="Enter city or area…"
                  aria-labelledby="ph-location"
                  autoComplete="address-level2"
                  className="ph__input"
                />
              </div>
              <button
                type="button"
                className="ph-btn ph-btn--quiet"
                onClick={useMyLocation}
                disabled={locLoading}
                aria-busy={locLoading || undefined}
                aria-label="Use GPS location"
              >
                <LocateFixed className={locLoading ? "ph__locating" : undefined} aria-hidden="true" />
                <span>GPS</span>
              </button>
            </div>
          </section>

          {/* The route: from where you are, through each stop the plan will choose */}
          <section aria-labelledby="ph-flow">
            <h2 id="ph-flow" className="ph__label">Your planned flow</h2>
            <figure className="ph-route" aria-label="Route of your plan">
              <div className="ph-route__line">
                <div className="ph-route__node ph-route__node--origin">
                  <span className="ph-route__dot"><MapPin aria-hidden="true" /></span>
                  <span className="ph-route__name">Start</span>
                  <span className="ph-route__note">{startLabel}</span>
                </div>
                <span className="ph-route__link" aria-hidden="true">→</span>
                <ol
                  className="ph-route__stops"
                  // the tracks share the row evenly: one before the first stop, one between each pair
                  style={{ flexGrow: Math.max((plannedFlow?.length || 1) - 1, 0) }}
                  data-testid="planned-flow"
                  data-state={plannedFlow === null ? "loading" : "ready"}
                >
                  {plannedFlow === null ? (
                    <li className="ph-route__status" role="status">Working out your stops…</li>
                  ) : plannedFlow.length === 0 ? (
                    <li className="ph-route__status">Your stops are set when the plan starts</li>
                  ) : (
                    plannedFlow.map((step, i) => {
                      const Icon = STEP_ICON[step] || MapPin;
                      return (
                        <li key={step} className="ph-route__stop">
                          {i > 0 && <span className="ph-route__link" aria-hidden="true">→</span>}
                          <span className="ph-route__node">
                            <span className="ph-route__dot"><Icon aria-hidden="true" /></span>
                            <span className="ph-route__name">{humanStepName(step)}</span>
                          </span>
                        </li>
                      );
                    })
                  )}
                </ol>
              </div>
            </figure>
          </section>

          <div>
            <div className="ph__error"><ErrorBanner message={plannerError} /></div>
            <button
              type="button"
              className="ph-btn ph-btn--primary ph-btn--wide"
              onClick={startSession}
              disabled={!canStart}
              aria-busy={sessionLoading || undefined}
            >
              {sessionLoading ? (
                <>
                  <span className="ph__spinner" aria-hidden="true" />
                  Starting…
                </>
              ) : (
                "Generate itinerary"
              )}
            </button>
          </div>
        </div>

        {/* Saved answers */}
        <aside className="ph__answers" aria-labelledby="ph-prefs">
          <div className="ph__answers-head">
            <h2 id="ph-prefs" className="ph__label">Your preferences</h2>
          </div>
          <dl className="ph__dl">
            {PREF_META.map(({ key, label }) => {
              const value = displayPref(userPrefs?.[key]);
              return (
                <div key={key} className="ph__row">
                  <dt>{label}</dt>
                  <dd className={value ? undefined : "is-empty"}>{value || "Not answered"}</dd>
                </div>
              );
            })}
          </dl>
        </aside>
      </div>
    </div>
  );
}
