import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Calendar, MapPin, Users, Utensils, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import DarkVeil from "@/components/DarkVeil/DarkVeil";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const FeatureCard = ({ icon: Icon, title, description }) => (
  <motion.div 
    variants={fadeInUp}
    className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:border-blue-400/30 transition-all duration-300 hover:-translate-y-1"
  >
    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-blue-400" />
    </div>
    <h3 className="text-2xl font-semibold text-white mb-3">{title}</h3>
    <p className="text-gray-300 text-lg">{description}</p>
  </motion.div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const controls = useAnimation();
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  const handlePlanMeetup = () => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      navigate("/questionnaire-stage1");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* DarkVeil as a fixed background */}
      <div className="fixed inset-0 z-0">
        <DarkVeil 
          hueShift={0}
          noiseIntensity={0.02}
          scanlineIntensity={0.4}  // Increased for better visibility
          speed={2.0}
          scanlineFrequency={1.5}  // Adjusted for better line spacing
          warpAmount={0.1}
          debug={false}
        />
      </div>
      
      {/* Main content with semi-transparent background */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <Navbar />
        {/* Hero Section */}
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="inline-block mb-6 px-4 py-2 bg-blue-500/10 rounded-full border border-blue-400/20"
            >
              <p className="text-sm font-medium text-blue-400">Meet. Plan. Enjoy. 🎉</p>
            </motion.div>
            
            <motion.h1 
              className="text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Welcome to <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">MeetBuddy</span>
            </motion.h1>
            
            <motion.p 
              className="text-2xl text-gray-300 max-w-3xl mx-auto mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Your ultimate planner for seamless meetups, curated restaurant discovery,
              personalized planning, and smooth bookings — all in one place.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button 
                onClick={handlePlanMeetup}
                className="px-8 py-6 text-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Plan Your Meetup
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                className="px-8 py-6 text-lg border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
                onClick={() => {
                  document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Learn More
              </Button>
            </motion.div>
          </motion.div>
          
          <motion.div 
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
            animate={{
              y: [0, 10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          >
            <div className="w-10 h-16 border-2 border-white/30 rounded-full flex justify-center p-1">
              <motion.div 
                className="w-1 h-4 bg-white/60 rounded-full"
                animate={{
                  y: [0, 20],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "loop",
                }}
              />
            </div>
          </motion.div>
        </div>
        
        {/* Features Section */}
        <section id="features" className="py-20 px-4 bg-gradient-to-b from-black/0 via-black/30 to-black/80">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              ref={ref}
              initial="hidden"
              animate={controls}
              variants={staggerContainer}
              className="text-center mb-16"
            >
              <motion.h2 
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
              >
                Why Choose MeetBuddy?
              </motion.h2>
              <motion.p 
                variants={fadeInUp}
                className="text-gray-400 max-w-2xl mx-auto text-lg"
              >
                We make planning meetups effortless and enjoyable with our powerful features
              </motion.p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={Calendar}
                title="Easy Scheduling"
                description="Find the perfect time that works for everyone in your group with our smart scheduling tools."
              />
              <FeatureCard
                icon={MapPin}
                title="Smart Location Finder"
                description="Discover the best meeting spots based on everyone's preferences and locations."
              />
              <FeatureCard
                icon={Users}
                title="Group Collaboration"
                description="Keep everyone in the loop with real-time updates and easy sharing options."
              />
              <FeatureCard
                icon={Utensils}
                title="Restaurant Discovery"
                description="Explore curated restaurant options that match your group's tastes and dietary needs."
              />
              <FeatureCard
                icon={Calendar}
                title="Reminders & Notifications"
                description="Never miss a meetup with timely reminders and updates."
              />
              <FeatureCard
                icon={Users}
                title="Seamless Experience"
                description="From planning to execution, we've got every step of your meetup covered."
              />
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-b from-black/80 via-black to-black">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-8 rounded-2xl border border-white/10"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to plan your next meetup?</h2>
              <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
                Join thousands of users who are already making their meetups memorable with MeetBuddy.
              </p>
              <Button 
                onClick={handlePlanMeetup}
                className="px-8 py-6 text-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Get Started - It's Free
              </Button>
            </motion.div>
          </div>
        </section>
        
        {/* Footer */}
        <footer className="bg-black/80 border-t border-white/10 py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">MeetBuddy</h3>
                <p className="text-gray-400">Making meetups simple, fun, and memorable.</p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Features</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Scheduling</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Location Finder</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Restaurant Discovery</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Group Planning</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                  <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</a></li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-white/10">
              <p className="text-center text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} MeetBuddy. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
