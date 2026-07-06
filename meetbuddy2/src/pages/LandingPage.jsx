import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Users,
  Utensils,
  ArrowRight,
  Sparkles,
  Map,
  Link2,
  Star,
  Hotel,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AmbientBackground from "@/components/AmbientBackground";
import ScrollFloat from "@/components/ScrollFloat";
import GlassCard from "@/components/ui/GlassCard";

/* ---------- helpers ---------- */

// Button that leans toward the cursor
const MagneticButton = ({ children, className = "", onClick }) => {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileTap={{ scale: 0.96 }}
      className={`transition-transform duration-150 ease-out cursor-pointer ${className}`}
    >
      {children}
    </motion.button>
  );
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ---------- hero floating itinerary cards ---------- */

const FloatCard = ({ className = "", delay = 0, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`absolute hidden lg:flex items-center gap-3 glass-strong rounded-2xl px-4 py-3 shadow-xl animate-float-slow ${className}`}
  >
    {children}
  </motion.div>
);

/* ---------- data ---------- */

const MARQUEE_ITEMS = [
  "Rooftop Bars", "Hidden Cafés", "Escape Rooms", "Karaoke Nights",
  "Art Museums", "Street Food", "Live Music", "Bowling",
  "Picnic Spots", "Board Game Cafés", "Sunset Points", "Arcades",
];

const STEPS = [
  {
    num: "01",
    title: "Set the vibe",
    desc: "Answer a playful two-minute questionnaire about mood, budget and adventure level.",
  },
  {
    num: "02",
    title: "Pick your spots",
    desc: "Browse curated venues near you, ranked by rating, distance and how well they match your group.",
  },
  {
    num: "03",
    title: "Get the itinerary",
    desc: "Restaurant → activity → stay, mapped and sequenced. Share it with the group and go.",
  },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "Smart Planner",
    desc: "A guided flow that builds your whole evening step by step — dinner, activity, and a place to crash if the night runs long.",
    span: "md:col-span-2",
  },
  {
    icon: Map,
    title: "Live Map View",
    desc: "Every option plotted around your anchor point, so nobody ends up across town.",
    span: "",
  },
  {
    icon: Calendar,
    title: "Easy Scheduling",
    desc: "A built-in calendar keeps every plan on track and everyone on time.",
    span: "",
  },
  {
    icon: Utensils,
    title: "Taste-matched Discovery",
    desc: "Real venues ranked by rating, distance and vibe — filtered through your group's questionnaire, not a generic top-ten list.",
    span: "md:col-span-2",
  },
  {
    icon: Link2,
    title: "One-tap Booking Links",
    desc: "Jump straight from a pick to its booking page. No copy-pasting names into search.",
    span: "",
  },
  {
    icon: Users,
    title: "Built for Groups",
    desc: "Preferences from everyone, one plan that works for all of you.",
    span: "",
  },
];

const STATS = [
  { value: "10k+", label: "meetups planned" },
  { value: "4.8★", label: "avg venue rating" },
  { value: "30+", label: "cities covered" },
  { value: "2 min", label: "to a full plan" },
];

/* ---------- page ---------- */

const LandingPage = () => {
  const navigate = useNavigate();

  const handlePlanMeetup = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      navigate("/home");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <AmbientBackground intensity="hero" />
      <Navbar />

      {/* ---------- HERO ---------- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-28 pb-20">
        {/* Floating itinerary cards */}
        <FloatCard className="top-[24%] left-[8%]" delay={0.9}>
          <span className="text-2xl">🍜</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Izakaya Ten</p>
            <p className="text-xs text-muted-foreground">Dinner · 4.8 <Star className="inline w-3 h-3 -mt-0.5 text-yellow-400 fill-current" /></p>
          </div>
        </FloatCard>
        <FloatCard className="top-[38%] right-[7%]" delay={1.1}>
          <span className="text-2xl">🎳</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Neon Bowl</p>
            <p className="text-xs text-muted-foreground">Activity · 350 m away</p>
          </div>
        </FloatCard>
        <FloatCard className="bottom-[22%] left-[13%]" delay={1.3}>
          <Hotel className="w-6 h-6 text-brand-3" />
          <div className="text-left">
            <p className="text-sm font-semibold text-white">The Foundry Hotel</p>
            <p className="text-xs text-muted-foreground">Stay · weekend escape</p>
          </div>
        </FloatCard>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 glass rounded-full"
          >
            <Sparkles className="w-4 h-4 text-brand-3" />
            <p className="text-sm font-medium text-brand-3">Meet. Plan. Enjoy.</p>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-8 leading-[1.05]"
          >
            Great meetups,
            <br />
            <span className="text-gradient">planned in minutes.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12"
          >
            Tell MeetBuddy the vibe. It finds the restaurants, activities and
            stays your group will love — and strings them into one seamless plan.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <MagneticButton
              onClick={handlePlanMeetup}
              className="px-8 py-4 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-brand to-brand-2 glow-md inline-flex items-center justify-center gap-2"
            >
              Start planning — it's free
              <ArrowRight className="h-5 w-5" />
            </MagneticButton>
            <MagneticButton
              onClick={() =>
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
              }
              className="px-8 py-4 text-lg font-semibold text-white rounded-2xl glass hover:bg-white/10 inline-flex items-center justify-center"
            >
              See how it works
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-9 h-14 border-2 border-white/25 rounded-full flex justify-center p-1.5">
            <motion.div
              className="w-1 h-3.5 bg-gradient-to-b from-brand to-brand-2 rounded-full"
              animate={{ y: [0, 18], opacity: [0.4, 1, 0.2] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* ---------- MARQUEE ---------- */}
      <section className="relative py-6 overflow-hidden border-y border-white/5">
        <div className="flex w-max animate-marquee gap-4 pr-4">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex items-center gap-2 whitespace-nowrap px-5 py-2 glass rounded-full text-sm text-muted-foreground"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-3" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how-it-works" className="relative py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <ScrollFloat
              containerClassName="text-4xl md:text-5xl lg:text-6xl font-bold text-white"
              textClassName="font-display"
            >
              Three steps. One great night.
            </ScrollFloat>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-muted-foreground max-w-xl mx-auto text-lg mt-4"
            >
              From "where should we go?" to a full itinerary — faster than the
              group chat can argue about it.
            </motion.p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {STEPS.map((step) => (
              <motion.div key={step.num} variants={fadeUp}>
                <GlassCard hover variant="gradient" className="p-8 h-full">
                  <span className="text-6xl font-display font-bold text-gradient opacity-90">
                    {step.num}
                  </span>
                  <h3 className="text-2xl font-semibold text-white mt-5 mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- FEATURES BENTO ---------- */}
      <section id="features" className="relative py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <ScrollFloat
              containerClassName="text-4xl md:text-5xl lg:text-6xl font-bold text-white"
              textClassName="font-display"
            >
              Why choose MeetBuddy?
            </ScrollFloat>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-muted-foreground max-w-xl mx-auto text-lg mt-4"
            >
              Everything a great meetup needs, in one glassy little app.
            </motion.p>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className={f.span}>
                <GlassCard hover className="p-8 h-full group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10 flex items-center justify-center mb-5 group-hover:glow-sm transition-shadow duration-300">
                    <f.icon className="w-6 h-6 text-brand-3" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2.5">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <section className="relative py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {STATS.map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="text-center">
                <p className="text-4xl md:text-5xl font-display font-bold text-gradient mb-2">
                  {s.value}
                </p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <GlassCard variant="gradient" className="p-12 glow-sm">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
                Your next great night out
                <br />
                <span className="text-gradient">starts here.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of groups already skipping the "so… where do we
                meet?" debate.
              </p>
              <MagneticButton
                onClick={handlePlanMeetup}
                className="px-9 py-4 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-brand to-brand-2 glow-md inline-flex items-center justify-center gap-2"
              >
                Get started — it's free
                <ArrowRight className="h-5 w-5" />
              </MagneticButton>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
