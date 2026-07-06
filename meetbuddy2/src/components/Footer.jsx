import React from "react";
import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin, Heart, Sparkles } from "lucide-react";

const SOCIALS = [
  { icon: Github, href: "https://github.com", label: "GitHub" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

const COLUMNS = [
  {
    title: "Features",
    links: [
      { label: "Smart Planner", to: "/planner" },
      { label: "Calendar", to: "/calendar" },
      { label: "Restaurant Discovery", to: "/planner" },
      { label: "Group Planning", to: "/planner" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Careers", to: "/about" },
      { label: "Blog", to: "/about" },
      { label: "Contact", to: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/about" },
      { label: "Terms of Service", to: "/about" },
      { label: "Cookie Policy", to: "/about" },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="relative w-full mt-auto">
      {/* Gradient hairline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

      <div className="glass py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand & Social */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand-2 glow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </span>
                  <h3 className="text-xl font-bold font-display text-gradient">MeetBuddy</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Making meetups simple, fun, and memorable.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                {SOCIALS.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-2.5 glass rounded-xl text-muted-foreground hover:text-white hover:border-brand/50 hover:glow-sm transition-all duration-300"
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </a>
                ))}
              </div>
            </div>

            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold font-display mb-4">{col.title}</h4>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="text-muted-foreground hover:text-brand-3 transition-colors duration-200"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} MeetBuddy. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span>Made with</span>
              <Heart className="w-4 h-4 text-brand-2 fill-current animate-pulse" />
              <span>for explorers everywhere.</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
