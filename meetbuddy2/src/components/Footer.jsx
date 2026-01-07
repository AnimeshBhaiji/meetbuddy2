import React from "react";
import { Github, Twitter, Linkedin, Heart } from "lucide-react";

const Footer = () => {
    return (
        <footer className="w-full bg-white/5 backdrop-blur-md border-t border-white/10 py-12 mt-auto">
            <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    {/* Brand & Social */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">MeetBuddy</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">Making meetups simple, fun, and memorable.</p>
                        </div>
                        {/* Social Links from original Footer */}
                        <div className="flex gap-4 pt-2">
                            <a href="#" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors border border-white/5 hover:border-white/20">
                                <Github className="w-5 h-5" />
                            </a>
                            <a href="#" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-400 transition-colors border border-white/5 hover:border-white/20">
                                <Twitter className="w-5 h-5" />
                            </a>
                            <a href="#" className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-600 transition-colors border border-white/5 hover:border-white/20">
                                <Linkedin className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Features</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Scheduling</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Location Finder</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Restaurant Discovery</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Group Planning</a></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-400 text-sm">
                        &copy; {new Date().getFullYear()} MeetBuddy. All rights reserved.
                    </p>

                    {/* Made with Love from original Footer */}
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <span>Made with</span>
                        <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
                        <span>for explorers everywhere.</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
