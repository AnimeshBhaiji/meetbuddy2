import React from "react";
import { motion } from "framer-motion";
import { Users, MapPin, Sparkles, Heart, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Aurora from "@/components/Aurora";

const AboutUs = () => {
  const features = [
    {
      icon: <MapPin className="w-8 h-8 text-blue-400" />,
      title: "What We Do",
      description: "We streamline the chaos of planning by providing personalized venue recommendations, availability tracking, and integration with booking services — all in one platform.",
      gradient: "from-blue-500/10 to-blue-600/10",
      border: "border-blue-500/20"
    },
    {
      icon: <Sparkles className="w-8 h-8 text-purple-400" />,
      title: "Our Mission",
      description: "To make planning get-togethers and professional meetings as seamless and fun as the events themselves — one curated suggestion at a time.",
      gradient: "from-purple-500/10 to-indigo-600/10",
      border: "border-purple-500/20"
    },
    {
      icon: <Users className="w-8 h-8 text-pink-400" />,
      title: "Why MeetBuddy",
      description: "We go beyond generic maps or listings — by factoring in preferences, reviews, price, and vibe, we bring you smarter choices that actually work for your context.",
      gradient: "from-pink-500/10 to-rose-600/10",
      border: "border-pink-500/20"
    }
  ];

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <Aurora colorStops={['#5227FF', '#bf4bfd', '#5227FF']} />
      <div className="relative z-10 min-h-screen flex flex-col pt-24">
        <Navbar />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative pt-24 pb-16 md:pt-32 md:pb-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto text-center"
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
                  About MeetBuddy
                </h1>
                <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-10">
                  Your ultimate meeting planner — simplifying the way you discover venues,
                  customize meetups, and coordinate with friends, teams, or clients effortlessly.
                </p>

                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  <a
                    href="/planner"
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 shadow-lg font-medium flex items-center gap-2"
                  >
                    Start Planning <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`bg-white/5 backdrop-blur-sm border ${feature.border} rounded-2xl p-6 hover:shadow-2xl transition-all duration-300`}
                  >
                    <div className={`w-14 h-14 rounded-xl ${feature.gradient} flex items-center justify-center mb-4`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-400">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Team Section */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-3xl mx-auto text-center mb-16"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Built With <span className="text-pink-400">❤️</span> By Our Team
                </h2>
                <p className="text-lg text-gray-400">
                  MeetBuddy is created by a passionate team of developers and designers who understand
                  how painful planning can be. We're building tech to solve real-world coordination
                  chaos — so you can just show up and enjoy.
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {[
                  { name: 'Sree Devi', role: 'Founder', bio: 'Visionary leader driving MeetBuddy\'s mission forward' },
                  { name: 'Darrel', role: 'Co-Founder', bio: 'Passionate about creating meaningful connections' },
                  { name: 'Animesh Bhaiji', role: 'Lead Developer', bio: 'Full-stack engineer building seamless experiences' }
                ].map((member, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 mb-4 flex items-center justify-center">
                      <Users className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{member.name}</h3>
                    <p className="text-blue-400 mb-3">{member.role}</p>
                    <p className="text-gray-400 text-sm">{member.bio}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto text-center bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-sm"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Ready to Plan Your Next Meetup?
                </h2>
                <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                  Join thousands of users who are already making their meetups happen with ease.
                </p>
                <a
                  href="/signup"
                  className="inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5 shadow-lg font-medium"
                >
                  Get Started for Free
                </a>
              </motion.div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AboutUs;
