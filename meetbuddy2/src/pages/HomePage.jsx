// src/pages/HomePage.jsx
// Signed-in home: your next plan drawn as a route over a night map, its
// ticket, the week ahead, your saved itineraries and a quick start.
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Utensils, Ticket, BedDouble, Coffee, Pause, Play, ArrowRight } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import Footer from "@/components/Footer";
import AccessDeniedModal from "@/components/AccessDeniedModal";
import { api } from "@/lib/api";
import { parseISO, formatWhen } from "@/lib/schedule";
import { humanStepName } from "@/hooks/usePlannerSession";
import "./HomePage.css";

const EASE = [0.16, 1, 0.3, 1];
const STEP_ICON = { restaurant: Utensils, activity: Ticket, stay: BedDouble, cafe: Coffee };
const DAY_MS = 86400000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const cachedCoords = () => {
  try {
    const c = JSON.parse(localStorage.getItem("userPreferences") || "null")?.coords;
    return c && c.lat != null && c.lng != null ? { lat: Number(c.lat), lng: Number(c.lng) } : null;
  } catch {
    return null;
  }
};

// Where the route sits in the hero's 1000 x 400 drawing: the right-hand part,
// clear of the greeting, the ticket and the navigation bar above.
const BOX = { x0: 580, x1: 940, y0: 130, y1: 350 };
// A pleasant default bend for stops without coordinates.
const DEFAULT_PTS = [[590, 340], [700, 260], [820, 220], [930, 140]];

// Real coordinates projected into BOX (one scale for both axes, so the map
// keeps its shape) when at least two are known; otherwise the default bend.
function routePoints(coords, count) {
  const known = coords.filter(Boolean);
  if (known.length < 2) return DEFAULT_PTS.slice(0, Math.max(count, 2));
  const lats = known.map((c) => c.lat), lngs = known.map((c) => c.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const w = BOX.x1 - BOX.x0, h = BOX.y1 - BOX.y0;
  const scale = Math.min(w / (maxLng - minLng || 1e-6), h / (maxLat - minLat || 1e-6));
  const offX = BOX.x0 + (w - (maxLng - minLng) * scale) / 2;
  const offY = BOX.y1 - (h - (maxLat - minLat) * scale) / 2;
  return known.map((c) => [offX + (c.lng - minLng) * scale, offY - (c.lat - minLat) * scale]);
}

// A smooth curve through the points (Catmull-Rom as cubic Béziers).
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function daysToGo(start) {
  const n = Math.round((startOfDay(start) - startOfDay(new Date())) / DAY_MS);
  if (n <= 0) return { big: "Today", small: "" };
  if (n === 1) return { big: "1", small: "day to go" };
  return { big: String(n), small: "days to go" };
}

function headline(next) {
  if (!next) return null;
  const start = parseISO(next.start_at);
  const n = Math.round((startOfDay(start) - startOfDay(new Date())) / DAY_MS);
  if (n <= 0) return "Tonight's sorted.";
  if (n === 1) return "Tomorrow's sorted.";
  if (n < 7) return `${start.toLocaleDateString(undefined, { weekday: "long" })}'s sorted.`;
  return "Your next plan is set.";
}

/* ---------- pieces ---------- */

function Words({ text, delay = 0, reduce }) {
  return text.split(" ").map((w, i) => (
    <motion.span
      key={`${w}-${i}`}
      className="hp-word"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: delay + i * 0.07 }}
    >
      {w}{" "}
    </motion.span>
  ));
}

// On a phone the map is a band of its own under the ticket, framed on the route.
const PHONE = "(max-width: 48rem)";
function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

function RouteMap({ points, reduce, label }) {
  const d = smoothPath(points);
  const phone = usePhone();
  return (
    <svg className="hp-map" viewBox={phone ? "540 100 440 280" : "0 0 1000 400"} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <g className="hp-streets" aria-hidden="true">
        <path d="M0 120 L1000 92" /><path d="M0 268 L1000 300" /><path d="M0 352 L1000 330" />
        <path d="M640 0 L690 400" /><path d="M820 0 L790 400" /><path d="M470 0 L520 400" />
        <path d="M560 0 C 600 120, 760 160, 1000 190" />
      </g>
      {d && (
        <motion.path
          className="hp-route"
          d={d}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.3 }}
        />
      )}
      {points.map(([x, y], i) => (
        <motion.g
          key={i}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.3 + (1.8 * i) / Math.max(points.length - 1, 1) }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        >
          <circle className={`hp-pulse${i === 0 ? " is-origin" : ""}`} cx={x} cy={y} r="9" />
          <circle className={`hp-pin${i === 0 ? " is-origin" : ""}`} cx={x} cy={y} r="7" />
        </motion.g>
      ))}
    </svg>
  );
}

function TicketCard({ plan, detail, onOpen, reduce }) {
  const start = parseISO(plan.start_at);
  const togo = daysToGo(start);
  const steps = (detail?.stops || []).map((s) => s.step);
  return (
    <motion.button
      type="button"
      className="hp-ticket"
      onClick={onOpen}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
      aria-label={`Open ${plan.title}`}
    >
      <span className="hp-ticket__main">
        <span className="hp-ticket__when">Next up, {formatWhen(plan)}</span>
        <span className="hp-ticket__title">{plan.title}</span>
        <span className="hp-chips">
          {steps.length > 0
            ? steps.map((s, i) => {
                const Icon = STEP_ICON[s] || MapPin;
                return <span key={i} className="hp-chip"><Icon aria-hidden="true" />{humanStepName(s).split(" / ")[0]}</span>;
              })
            : <span className="hp-chip">{plan.stop_count} stop{plan.stop_count === 1 ? "" : "s"}</span>}
        </span>
      </span>
      <span className="hp-ticket__stub">
        <motion.span
          className="hp-ticket__count"
          initial={reduce ? false : { rotateX: 90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.0 }}
        >
          {togo.big}
        </motion.span>
        {togo.small && <span className="hp-ticket__small">{togo.small}</span>}
      </span>
    </motion.button>
  );
}

function WeekStrip({ items, onOpen, reduce }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + i * DAY_MS));
  return (
    <ol className="hp-week">
      {days.map((day, i) => {
        const plans = items.filter((it) => it.start_at && sameDay(parseISO(it.start_at), day));
        const first = plans[0];
        const inner = (
          <>
            <span className="hp-day__name">{i === 0 ? "Today" : day.toLocaleDateString(undefined, { weekday: "short" })}</span>
            <span className="hp-day__num">{day.getDate()}</span>
            {first && <span className="hp-day__plan">{plans.length > 1 ? `${plans.length} plans` : first.title}</span>}
            {first && (
              <motion.span
                className="hp-day__bar"
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.8 + i * 0.05 }}
                aria-hidden="true"
              />
            )}
          </>
        );
        return (
          <motion.li
            key={i}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.2 + i * 0.05 }}
          >
            {first ? (
              <button type="button" className="hp-day has-plan" onClick={() => onOpen(first.id)}>{inner}</button>
            ) : (
              <div className="hp-day">{inner}</div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

function SavedCarousel({ items, onOpen, reduce }) {
  const [paused, setPaused] = useState(false);
  // A drifting row needs enough cards to loop; fewer sit still.
  const drifting = !reduce && items.length >= 4;
  const row = drifting ? [...items, ...items] : items;
  return (
    <div className="hp-saved">
      {drifting && (
        <button
          type="button"
          className="hp-pause"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play the saved plans row" : "Pause the saved plans row"}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      )}
      <div className={`hp-rail${drifting ? " is-drifting" : ""}${paused ? " is-paused" : ""}`}>
        <ul className="hp-track" style={drifting ? { "--hp-loop": `${items.length * 4}s` } : undefined}>
          {row.map((it, i) => (
            <li key={`${it.id}-${i}`} aria-hidden={i >= items.length || undefined}>
              <button type="button" className="hp-plan" onClick={() => onOpen(it.id)} tabIndex={i >= items.length ? -1 : 0}>
                <span className="hp-plan__title">{it.title}</span>
                <span className="hp-plan__meta">
                  {it.stop_count} stop{it.stop_count === 1 ? "" : "s"}
                  {it.start_at ? `, ${formatWhen(it)}` : ", not scheduled"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

const HomePage = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [showAccessModal, setShowAccessModal] = useState(false);

  const [items, setItems] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState(null);
  const [flow, setFlow] = useState([]);

  const load = () => {
    setLoadError(false);
    setItems(null);
    api.get("/itineraries")
      .then((rows) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => { setItems([]); setLoadError(true); });
  };
  useEffect(load, []);

  const next = useMemo(() => {
    if (!items) return null;
    const today = startOfDay(new Date());
    return items
      .filter((it) => it.start_at && parseISO(it.start_at) >= today)
      .sort((a, b) => parseISO(a.start_at) - parseISO(b.start_at))[0] || null;
  }, [items]);

  // The ticket and the route need the next plan's stops; a new user's hero
  // draws the planned flow instead.
  useEffect(() => {
    let live = true;
    if (next) {
      api.get(`/itineraries/${next.id}`).then((d) => live && setDetail(d)).catch(() => {});
    } else if (items && items.length === 0) {
      api.get("/planner/flow").then((r) => live && setFlow(Array.isArray(r.flow) ? r.flow : [])).catch(() => {});
    }
    return () => { live = false; };
  }, [next, items]);

  const origin = cachedCoords();
  const points = useMemo(() => {
    if (next) {
      const stops = detail?.stops || [];
      const coords = [origin, ...stops.map((s) =>
        s.place?.lat != null && s.place?.lng != null ? { lat: Number(s.place.lat), lng: Number(s.place.lng) } : null)];
      return routePoints(coords.every(Boolean) ? coords : [], Math.max(stops.length, next.stop_count || 0) + 1);
    }
    return routePoints([], (flow.length || 3) + 1);
  }, [next, detail, flow, origin?.lat, origin?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPlanner = () => {
    const hasPrefs =
      localStorage.getItem("userPreferences") || localStorage.getItem("questionnaireAnswers");
    if (!hasPrefs) {
      setShowAccessModal(true);
      return;
    }
    navigate("/planner");
  };
  const openPlan = (id) => navigate("/planner", { state: { itineraryId: id } });

  const firstName = user?.first_name || "there";
  const loading = items === null;
  const isNew = !loading && !loadError && items.length === 0;
  const line2 = loading ? "" : next ? headline(next) : isNew ? "Your first meetup starts here." : "Pick a plan, or start a new one.";
  const routeLabel = next
    ? `Route of ${next.title}`
    : `Your planned flow: start, ${(flow.length ? flow : ["restaurant", "activity", "stay"]).map(humanStepName).join(", ")}`;

  return (
    <div className="hp">
      <AccessDeniedModal isOpen={showAccessModal} onClose={() => setShowAccessModal(false)} />

      <section className="hp-hero" aria-labelledby="hp-greeting">
        <RouteMap points={points} reduce={reduce} label={routeLabel} />
        <div className="hp-hero__inner">
          <h1 id="hp-greeting" className="hp-greeting">
            <Words text={`Hey ${firstName},`} reduce={reduce} />
            {line2 && <><br /><span className="hp-greeting__line2"><Words text={line2} delay={0.2} reduce={reduce} /></span></>}
          </h1>

          {next && <TicketCard plan={next} detail={detail} onOpen={() => openPlan(next.id)} reduce={reduce} />}

          {isNew && (
            <motion.div
              className="hp-first"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.6 }}
            >
              <p>Tell us the vibe and we'll line up {flow.length ? flow.map((s) => humanStepName(s).split(" / ")[0].toLowerCase()).join(", then ") : "the places"} near you.</p>
              <button type="button" className="hp-btn" onClick={openPlanner}>Plan your first meetup <ArrowRight aria-hidden="true" /></button>
            </motion.div>
          )}
        </div>
      </section>

      <div className="hp-body">
        {loading && <div className="hp-skeleton" role="status" aria-label="Loading your plans" />}

        {loadError && (
          <div className="hp-error" role="alert">
            <p>Your plans didn't load. Check your connection and try again.</p>
            <button type="button" className="hp-btn hp-btn--quiet" onClick={load}>Try again</button>
          </div>
        )}

        {!loading && !loadError && items.length > 0 && (
          <>
            <section aria-labelledby="hp-week">
              <h2 id="hp-week" className="hp-h2">Your week</h2>
              <WeekStrip items={items} onOpen={openPlan} reduce={reduce} />
            </section>
            <section aria-labelledby="hp-saved">
              <h2 id="hp-saved" className="hp-h2">Saved itineraries</h2>
              <SavedCarousel items={items} onOpen={openPlan} reduce={reduce} />
            </section>
          </>
        )}

        <motion.div
          className="hp-bar"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.7 }}
        >
          <span className="hp-bar__text">Where to next?</span>
          <button type="button" className="hp-btn" onClick={openPlanner}>Plan it</button>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
