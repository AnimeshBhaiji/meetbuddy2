import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, MapPin, Sparkles, ArrowRight, Compass, HeartHandshake } from "lucide-react";
import Footer from "@/components/Footer";
import ScrollFloat from "@/components/ScrollFloat";
import GlassCard from "@/components/ui/GlassCard";

const FEATURES = [
  {
    icon: MapPin,
    title: "What we do",
    description:
      "We streamline the chaos of planning with personalized venue recommendations, availability tracking, and booking links — all in one platform.",
  },
  {
    icon: Sparkles,
    title: "Our mission",
    description:
      "To make planning get-togethers and professional meetings as seamless and fun as the events themselves — one curated suggestion at a time.",
  },
  {
    icon: Users,
    title: "Why MeetBuddy",
    description:
      "We go beyond generic maps and listings. Preferences, reviews, price and vibe all factor in, so every choice actually fits your group.",
  },
];

const VALUES = [
  {
    icon: Compass,
    title: "Curation over lists",
    text: "Ten thoughtful options beat ten thousand search results. We rank, filter and match — you just pick.",
  },
  {
    icon: HeartHandshake,
    title: "Groups, not just users",
    text: "Every feature is built around the messy, wonderful reality of deciding things together.",
  },
  {
    icon: Sparkles,
    title: "Delight in the details",
    text: "From the first questionnaire to the final itinerary, the journey should feel as good as the destination.",
  },
];

const TEAM = [
  { name: "Sree Devi", role: "Founder", bio: "Visionary leader driving MeetBuddy's mission forward" },
  { name: "Darrel", role: "Co-Founder", bio: "Passionate about creating meaningful connections" },
  { name: "Animesh Bhaiji", role: "Lead Developer", bio: "Full-stack engineer building seamless experiences" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const initialsOf = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const AboutUs = () => {
  return (
    <div className="relative min-h-screen overflow-x-clip">

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative pt-44 pb-20 px-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto text-center"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 mb-8 px-4 py-2 glass rounded-full"
            >
              <Sparkles className="w-4 h-4 text-brand-3" />
              <p className="text-sm font-medium text-brand-3">The story behind the plans</p>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-7 leading-[1.06]"
            >
              We make showing up
              <br />
              <span className="text-gradient">the easy part.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10"
            >
              MeetBuddy simplifies how you discover venues, customize meetups, and
              coordinate with friends, teams, or clients — effortlessly.
            </motion.p>

            <motion.div variants={fadeUp}>
              <Link
                to="/planner"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-brand to-brand-2 text-white rounded-2xl glow-md font-semibold text-lg hover:scale-[1.03] active:scale-[0.97] transition-transform"
              >
                Start planning <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ---------- Feature cards ---------- */}
        <section className="py-20 px-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={fadeUp}>
                <GlassCard hover variant="gradient" className="p-8 h-full group">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10 flex items-center justify-center mb-5 group-hover:glow-sm transition-shadow duration-300">
                    <f.icon className="w-7 h-7 text-brand-3" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-3">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ---------- Values (scroll story) ---------- */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <ScrollFloat
                containerClassName="text-4xl md:text-5xl font-bold text-white"
                textClassName="font-display"
              >
                What we believe
              </ScrollFloat>
            </div>

            <div className="space-y-6">
              {VALUES.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -36 : 36 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <GlassCard
                    variant="strong"
                    className={`p-7 flex items-start gap-5 md:max-w-[85%] ${
                      i % 2 === 0 ? "" : "md:ml-auto"
                    }`}
                  >
                    <span className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand/30 to-brand-2/30 border border-white/10">
                      <v.icon className="w-6 h-6 text-brand-3" />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1.5">{v.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{v.text}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Team ---------- */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <ScrollFloat
                containerClassName="text-4xl md:text-5xl font-bold text-white"
                textClassName="font-display"
              >
                Built by our team
              </ScrollFloat>
            </div>
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-16"
            >
              A passionate crew of developers and designers who know exactly how painful
              planning can be — building tech to solve real-world coordination chaos, so
              you can just show up and enjoy.
            </motion.p>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {TEAM.map((member) => (
                <motion.div key={member.name} variants={fadeUp}>
                  <GlassCard hover variant="strong" className="p-8 text-center h-full group">
                    <div className="relative w-24 h-24 mx-auto rounded-full p-[3px] bg-gradient-to-br from-brand via-brand-2 to-brand-3 mb-5 group-hover:glow-sm transition-shadow duration-300">
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold font-display text-white"
                        style={{ background: "oklch(0.16 0.025 275)" }}
                      >
                        {initialsOf(member.name)}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{member.name}</h3>
                    <p className="text-brand-3 mb-3 text-sm font-medium">{member.role}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{member.bio}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="py-24 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto"
          >
            <GlassCard variant="gradient" className="p-10 md:p-14 text-center glow-sm">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
                Ready to plan your
                <br />
                <span className="text-gradient">next meetup?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-9 max-w-2xl mx-auto">
                Join thousands of groups already making their meetups happen with ease.
              </p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-9 py-4 bg-gradient-to-r from-brand to-brand-2 text-white rounded-2xl glow-md font-semibold text-lg hover:scale-[1.03] active:scale-[0.97] transition-transform"
              >
                Get started for free <ArrowRight className="w-5 h-5" />
              </Link>
            </GlassCard>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutUs;
