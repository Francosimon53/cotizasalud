"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const CSS = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-primary: #08090d;
  --bg-secondary: #0e1018;
  --bg-card: #12141c;
  --bg-card-hover: #181a24;
  --text-primary: #f0f1f5;
  --text-secondary: #8b8fa3;
  --text-muted: #5a5e72;
  --accent: #10b981;
  --accent-glow: rgba(16, 185, 129, 0.15);
  --accent-bright: #34d399;
  --accent-2: #06b6d4;
  --accent-3: #8b5cf6;
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.12);
  --gradient-1: linear-gradient(135deg, #10b981, #06b6d4);
  --gradient-2: linear-gradient(135deg, #8b5cf6, #ec4899);
  --radius: 16px;
  --radius-sm: 10px;
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'Satoshi', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ===== GRAIN OVERLAY ===== */
.ag-grain::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

/* ===== SCROLL REVEAL ===== */
.ag-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.ag-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ===== NAVIGATION ===== */
.ag-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 20px 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(20px) saturate(180%);
  background: rgba(8, 9, 13, 0.7);
  border-bottom: 1px solid var(--border);
  transition: all 0.4s ease;
}
.ag-nav.scrolled {
  padding: 14px 40px;
  background: rgba(8, 9, 13, 0.92);
}
.ag-nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.ag-nav-logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 16px;
  color: #000;
}
.ag-nav-logo-text {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 20px;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
.ag-nav-links {
  display: flex;
  gap: 32px;
  align-items: center;
}
.ag-nav-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.3s;
}
.ag-nav-links a:hover { color: var(--text-primary); }
.ag-nav-cta {
  padding: 10px 24px;
  background: var(--gradient-1);
  color: #000 !important;
  border-radius: 100px;
  font-weight: 700 !important;
  font-size: 14px !important;
  transition: transform 0.3s, box-shadow 0.3s !important;
}
.ag-nav-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(16, 185, 129, 0.3);
}

/* ===== HERO ===== */
.ag-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160px 40px 100px;
  text-align: center;
  overflow: hidden;
}
.ag-hero-glow {
  position: absolute;
  width: 800px;
  height: 800px;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.12;
  pointer-events: none;
}
.ag-hero-glow-1 {
  top: -200px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
}
.ag-hero-glow-2 {
  bottom: -300px;
  right: -200px;
  background: var(--accent-2);
  width: 600px;
  height: 600px;
  opacity: 0.08;
}
.ag-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 100px;
  border: 1px solid var(--border-hover);
  background: rgba(16, 185, 129, 0.06);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-bright);
  margin-bottom: 40px;
  animation: ag-float 3s ease-in-out infinite;
}
.ag-hero-badge .ag-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: ag-pulse-dot 2s ease-in-out infinite;
}
@keyframes ag-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.5); }
}
@keyframes ag-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.ag-hero h1 {
  font-family: var(--font-display);
  font-size: clamp(48px, 7vw, 88px);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.03em;
  max-width: 900px;
  margin-bottom: 28px;
}
.ag-hero h1 em {
  font-style: italic;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ag-hero-sub {
  font-size: 19px;
  color: var(--text-secondary);
  max-width: 560px;
  line-height: 1.7;
  margin-bottom: 48px;
}
.ag-hero-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}
.ag-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 36px;
  background: var(--gradient-1);
  color: #000;
  font-weight: 700;
  font-size: 16px;
  border-radius: 100px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}
.ag-btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.ag-btn-primary:hover::after { opacity: 1; }
.ag-btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(16, 185, 129, 0.35);
}
.ag-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 36px;
  background: transparent;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 16px;
  border-radius: 100px;
  text-decoration: none;
  border: 1px solid var(--border-hover);
  transition: all 0.3s;
}
.ag-btn-secondary:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.2);
}

/* ===== STATS BAR ===== */
.ag-stats-bar {
  display: flex;
  justify-content: center;
  gap: 80px;
  padding: 60px 40px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.ag-stat { text-align: center; }
.ag-stat-value {
  font-family: var(--font-display);
  font-size: 48px;
  font-style: italic;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ag-stat-label {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ===== AI ADVISOR FEATURE ===== */
.ag-ai-section {
  padding: 140px 40px;
  position: relative;
  overflow: hidden;
}
.ag-ai-section .ag-section-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ag-ai-section .ag-section-label::before {
  content: '';
  width: 24px;
  height: 1px;
  background: var(--accent);
}
.ag-ai-section h2 {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
  max-width: 700px;
}
.ag-ai-section h2 em {
  font-style: italic;
  background: var(--gradient-2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ag-ai-section .ag-section-desc {
  font-size: 18px;
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 560px;
  margin-bottom: 60px;
}
.ag-ai-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}
.ag-ai-demo {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px;
  position: relative;
  overflow: hidden;
}
.ag-ai-demo::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-2);
}
.ag-ai-demo-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.ag-ai-demo-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--gradient-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.ag-ai-demo-name {
  font-weight: 700;
  font-size: 15px;
}
.ag-ai-demo-tag {
  font-size: 12px;
  color: var(--accent-3);
  background: rgba(139, 92, 246, 0.1);
  padding: 3px 10px;
  border-radius: 100px;
  font-weight: 600;
  margin-left: auto;
}
.ag-ai-chat-msg {
  padding: 16px 20px;
  border-radius: 14px;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.7;
  animation: ag-msg-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ag-ai-chat-msg.user {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  margin-left: 40px;
}
.ag-ai-chat-msg.ai {
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.12);
  margin-right: 40px;
  color: var(--text-secondary);
}
.ag-ai-chat-msg.ai strong { color: var(--text-primary); }
@keyframes ag-msg-in {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.ag-ai-features-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ag-ai-feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  transition: all 0.4s;
  cursor: default;
}
.ag-ai-feature-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  transform: translateX(6px);
}
.ag-ai-feature-card h4 {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ag-ai-feature-card p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ===== BENTO FEATURES ===== */
.ag-bento-section {
  padding: 140px 40px;
  max-width: 1200px;
  margin: 0 auto;
}
.ag-bento-section .ag-section-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-2);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
  text-align: center;
}
.ag-bento-section h2 {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  text-align: center;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 64px;
}
.ag-bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto;
  gap: 20px;
}
.ag-bento-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 36px;
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}
.ag-bento-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: transparent;
  transition: background 0.5s;
}
.ag-bento-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.ag-bento-card:hover::before { background: var(--gradient-1); }
.ag-bento-card.wide { grid-column: span 2; }
.ag-bento-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 20px;
}
.ag-bento-icon.green { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.15); }
.ag-bento-icon.cyan { background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.15); }
.ag-bento-icon.purple { background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.15); }
.ag-bento-icon.amber { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.15); }
.ag-bento-icon.red { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.15); }
.ag-bento-card h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: -0.02em;
}
.ag-bento-card p {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
}

/* ===== SOCIAL PROOF ===== */
.ag-social-section {
  padding: 140px 40px;
  position: relative;
}
.ag-social-section .ag-section-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-bright);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
  text-align: center;
}
.ag-social-section h2 {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  text-align: center;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 64px;
}
.ag-testimonials-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
.ag-testimonial {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px;
  transition: all 0.4s;
}
.ag-testimonial:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
}
.ag-testimonial-stars {
  color: #f59e0b;
  font-size: 16px;
  margin-bottom: 16px;
  letter-spacing: 2px;
}
.ag-testimonial-text {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: 24px;
  font-style: italic;
}
.ag-testimonial-author {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ag-testimonial-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--gradient-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 16px;
  color: #000;
}
.ag-testimonial-info h4 {
  font-size: 15px;
  font-weight: 700;
}
.ag-testimonial-info p {
  font-size: 13px;
  color: var(--text-muted);
}

/* ===== ROI SECTION ===== */
.ag-roi-section {
  padding: 140px 40px;
  max-width: 1000px;
  margin: 0 auto;
  text-align: center;
}
.ag-roi-section .ag-section-label {
  font-size: 13px;
  font-weight: 700;
  color: #f59e0b;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 20px;
}
.ag-roi-section h2 {
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 56px);
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 64px;
}
.ag-roi-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.ag-roi-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 40px 28px;
  transition: all 0.4s;
}
.ag-roi-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
}
.ag-roi-number {
  font-family: var(--font-display);
  font-size: 56px;
  font-style: italic;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
  margin-bottom: 12px;
}
.ag-roi-card h4 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}
.ag-roi-card p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* ===== CTA SECTION ===== */
.ag-cta-section {
  padding: 140px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.ag-cta-section::before {
  content: '';
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: var(--accent);
  filter: blur(200px);
  opacity: 0.08;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.ag-cta-section h2 {
  font-family: var(--font-display);
  font-size: clamp(40px, 6vw, 72px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
  position: relative;
}
.ag-cta-section h2 em {
  font-style: italic;
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.ag-cta-section .ag-cta-desc {
  font-size: 19px;
  color: var(--text-secondary);
  max-width: 500px;
  margin: 0 auto 40px;
  line-height: 1.7;
  position: relative;
}

/* ===== FOOTER ===== */
.ag-footer {
  padding: 60px 40px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}
.ag-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ag-footer-logo-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--gradient-1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 12px;
  color: #000;
}
.ag-footer-text {
  font-size: 13px;
  color: var(--text-muted);
}
.ag-footer-links {
  display: flex;
  gap: 24px;
}
.ag-footer-links a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.3s;
}
.ag-footer-links a:hover { color: var(--text-primary); }

/* ===== RESPONSIVE ===== */
@media (max-width: 900px) {
  .ag-ai-grid, .ag-bento-grid, .ag-testimonials-grid, .ag-roi-cards {
    grid-template-columns: 1fr;
  }
  .ag-bento-card.wide { grid-column: span 1; }
  .ag-stats-bar {
    flex-direction: column;
    gap: 32px;
    align-items: center;
  }
  .ag-nav { padding: 16px 20px; }
  .ag-nav-links { display: none; }
  .ag-hero { padding: 140px 24px 80px; }
  .ag-ai-section, .ag-bento-section, .ag-social-section, .ag-roi-section, .ag-cta-section {
    padding: 80px 24px;
  }
  .ag-footer {
    flex-direction: column;
    gap: 20px;
    text-align: center;
  }
}

/* ===== ANIMATED BORDER ===== */
.ag-animated-border {
  position: relative;
}
.ag-animated-border::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: var(--radius);
  padding: 1px;
  background: conic-gradient(from var(--angle, 0deg), transparent 70%, var(--accent) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: ag-spin-border 4s linear infinite;
  pointer-events: none;
}
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@keyframes ag-spin-border {
  to { --angle: 360deg; }
}
`;

const ArrowIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <path d="M5 12h14m-6-6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
    <polygon points="5,3 19,12 5,21" fill="currentColor" opacity="0.8"/>
  </svg>
);

export default function AgentesPage() {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Nav scroll morph
    const onScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll);

    // Scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".ag-reveal").forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = `${i * 0.05}s`;
      observer.observe(el);
    });

    // Counter animation
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const text = el.textContent || "";
            const match = text.match(/([\d.]+)/);
            if (match) {
              const target = parseFloat(match[1]);
              const isDecimal = text.includes(".");
              let current = 0;
              const duration = 1500;
              const steps = 60;
              const increment = target / steps;
              const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                  current = target;
                  clearInterval(timer);
                }
                const display = isDecimal ? current.toFixed(1) : String(Math.ceil(current));
                el.textContent = text.replace(match[0], display);
              }, duration / steps);
            }
            counterObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll(".ag-stat-value, .ag-roi-number").forEach((el) => {
      counterObserver.observe(el);
    });

    // Smooth scroll for hash links
    const handleHashClick = (e: Event) => {
      const anchor = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
      if (anchor?.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(anchor);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", handleHashClick);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      counterObserver.disconnect();
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.removeEventListener("click", handleHashClick);
      });
    };
  }, []);

  return (
    <div className="ag-grain">
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Satoshi:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAVIGATION */}
      <nav ref={navRef} className="ag-nav" id="ag-nav">
        <a href="#" className="ag-nav-logo">
          <div className="ag-nav-logo-icon">CS</div>
          <span className="ag-nav-logo-text">CotizaSalud</span>
        </a>
        <div className="ag-nav-links">
          <a href="#ai-advisor">AI Advisor</a>
          <a href="#features">Funciones</a>
          <a href="#testimonials">Testimonios</a>
          <a href="#roi">ROI</a>
          <Link href="/cotizar" className="ag-nav-cta">Empezar Gratis &rarr;</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="ag-hero">
        <div className="ag-hero-glow ag-hero-glow-1" />
        <div className="ag-hero-glow ag-hero-glow-2" />

        <div className="ag-hero-badge ag-reveal">
          <span className="ag-dot" />
          Potenciado por Inteligencia Artificial
        </div>

        <h1 className="ag-reveal">
          Cotiza, explica y cierra<br /><em>en minutos</em>
        </h1>

        <p className="ag-hero-sub ag-reveal">
          La primera plataforma de cotización ACA con IA que le explica cada plan
          a tu cliente como si fueras tú — en español e inglés.
        </p>

        <div className="ag-hero-actions ag-reveal">
          <Link href="/cotizar" className="ag-btn-primary">
            Probar CotizaSalud
            <ArrowIcon />
          </Link>
          <a href="#ai-advisor" className="ag-btn-secondary">
            <PlayIcon />
            Ver AI Advisor en acción
          </a>
        </div>
      </section>

      {/* STATS BAR */}
      <div className="ag-stats-bar ag-reveal">
        <div className="ag-stat">
          <div className="ag-stat-value">2 min</div>
          <div className="ag-stat-label">Cotización completa</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">5.6x</div>
          <div className="ag-stat-label">ROI para agentes</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">100%</div>
          <div className="ag-stat-label">Bilingüe ES/EN</div>
        </div>
        <div className="ag-stat">
          <div className="ag-stat-value">22M</div>
          <div className="ag-stat-label">Afectados por el Subsidy Cliff</div>
        </div>
      </div>

      {/* AI ADVISOR SECTION */}
      <section className="ag-ai-section" id="ai-advisor">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="ag-section-label ag-reveal">Función estrella</div>
          <h2 className="ag-reveal">Tu <em>asistente de IA</em> que explica cada plan</h2>
          <p className="ag-section-desc ag-reveal">
            El AI Plan Advisor analiza el perfil de tu cliente y explica cada plan
            con escenarios reales — copagos, deducibles, costos de emergencia —
            en el idioma que tu cliente entienda mejor.
          </p>

          <div className="ag-ai-grid">
            {/* Demo Chat */}
            <div className="ag-ai-demo ag-animated-border ag-reveal">
              <div className="ag-ai-demo-header">
                <div className="ag-ai-demo-avatar">🧠</div>
                <div>
                  <div className="ag-ai-demo-name">AI Plan Advisor</div>
                </div>
                <div className="ag-ai-demo-tag">● En vivo</div>
              </div>

              <div className="ag-ai-chat-msg user" style={{ animationDelay: "0.3s" }}>
                Mi cliente gana $63,000 al año, familia de 1. ¿Qué opciones tiene?
              </div>

              <div className="ag-ai-chat-msg ai" style={{ animationDelay: "0.8s" }}>
                ⚠️ <strong>Atención:</strong> Con $63,000 tu cliente está justo sobre el Subsidy Cliff (400% FPL = $62,600). Pierde <strong>TODO</strong> el subsidio APTC.<br /><br />
                💡 <strong>Estrategia:</strong> Si abre una HSA y contribuye $4,300, su MAGI baja a $58,700 — vuelve a calificar para subsidio.<br /><br />
                Con subsidio recuperado, el plan <strong>Ambetter Bronze HSA</strong> le costaría <strong>~$0/mes</strong> en vez de $450/mes. Ahorro anual: <strong>~$5,400</strong>.<br /><br />
                <em>¿Quieres que le muestre los planes HSA-elegibles?</em>
              </div>
            </div>

            {/* Feature Cards */}
            <div className="ag-ai-features-list ag-reveal">
              <div className="ag-ai-feature-card">
                <h4>🎯 Escenarios personalizados</h4>
                <p>La IA calcula costos reales basándose en el perfil familiar — embarazos, condiciones crónicas, niños, medicamentos frecuentes.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>🌐 Bilingüe nativo</h4>
                <p>Explica en español o inglés con terminología que tu cliente realmente entiende. Nada de jerga de seguros.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>⚡ Respuestas en segundos</h4>
                <p>Tu cliente pregunta, la IA responde al instante. Sin esperas, sin "déjame revisar". Cierra más rápido.</p>
              </div>
              <div className="ag-ai-feature-card">
                <h4>🏦 Educación HSA integrada</h4>
                <p>Tu cliente pregunta &ldquo;¿Qué es una HSA?&rdquo; y la plataforma le explica en español simple con ejemplos reales. Ahórrales 15 minutos por cliente.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section className="ag-bento-section" id="features">
        <div className="ag-section-label ag-reveal">Todo lo que necesitas</div>
        <h2 className="ag-reveal">Una plataforma, todo tu flujo de trabajo</h2>

        <div className="ag-bento-grid">
          <div className="ag-bento-card wide ag-reveal">
            <div className="ag-bento-icon green">📋</div>
            <h3>Cotizador con Subsidio APTC</h3>
            <p>Ingresa código postal, composición familiar e ingreso. CotizaSalud calcula el subsidio estimado y muestra planes reales del Marketplace ACA con precios after-subsidy en tiempo real.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon cyan">✍️</div>
            <h3>Consent CMS Digital</h3>
            <p>Formulario de consentimiento CMS integrado con firma digital. Se activa después de seleccionar plan — todo guardado y compliance-ready.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon purple">🔗</div>
            <h3>Links Personalizados</h3>
            <p>Cada agente tiene su URL única. Comparte tu link y tus prospectos cotizan directamente — el lead llega a tu pipeline automáticamente.</p>
          </div>
          <div className="ag-bento-card ag-reveal">
            <div className="ag-bento-icon amber">📊</div>
            <h3>Dashboard de Leads</h3>
            <p>Ve quién cotizó, qué plan eligió, y si firmó el consent. Pipeline visual para que no se te escape ningún prospecto.</p>
          </div>
          <div className="ag-bento-card wide ag-reveal">
            <div className="ag-bento-icon red">🚨</div>
            <h3>Subsidy Cliff Alert 2026</h3>
            <p>Detecta automáticamente si tu cliente está cerca del límite del 400% FPL. Sugiere estrategias legales como HSA y contribuciones pre-tax para mantener el subsidio. Ningún otro cotizador tiene esto.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="ag-social-section" id="testimonials">
        <div className="ag-section-label ag-reveal">Agentes que confían en nosotros</div>
        <h2 className="ag-reveal">Lo que dicen los agentes</h2>

        <div className="ag-testimonials-grid">
          <div className="ag-testimonial ag-reveal">
            <div className="ag-testimonial-stars">★★★★★</div>
            <p className="ag-testimonial-text">&ldquo;Antes pasaba 20 minutos explicando cada plan. Ahora el AI Advisor lo hace en segundos y mis clientes lo entienden mejor que cuando yo les explicaba.&rdquo;</p>
            <div className="ag-testimonial-author">
              <div className="ag-testimonial-avatar">MR</div>
              <div className="ag-testimonial-info">
                <h4>María Rodríguez</h4>
                <p>Agente Licenciada · Miami, FL</p>
              </div>
            </div>
          </div>
          <div className="ag-testimonial ag-reveal">
            <div className="ag-testimonial-stars">★★★★★</div>
            <p className="ag-testimonial-text">&ldquo;El link personalizado es oro. Lo mando por WhatsApp y mis prospectos cotizan solos. Yo solo recibo la notificación cuando eligen plan.&rdquo;</p>
            <div className="ag-testimonial-author">
              <div className="ag-testimonial-avatar">CP</div>
              <div className="ag-testimonial-info">
                <h4>Carlos Pérez</h4>
                <p>Agente Independiente · Orlando, FL</p>
              </div>
            </div>
          </div>
          <div className="ag-testimonial ag-reveal">
            <div className="ag-testimonial-stars">★★★★★</div>
            <p className="ag-testimonial-text">&ldquo;En OEP cerré 40% más clientes que el año pasado. La velocidad de cotización más la explicación de la IA es una combinación imbatible.&rdquo;</p>
            <div className="ag-testimonial-author">
              <div className="ag-testimonial-avatar">LG</div>
              <div className="ag-testimonial-info">
                <h4>Laura García</h4>
                <p>Agency Owner · Tampa, FL</p>
              </div>
            </div>
          </div>
          <div className="ag-testimonial ag-reveal">
            <div className="ag-testimonial-stars">★★★★★</div>
            <p className="ag-testimonial-text">&ldquo;La alerta del Subsidy Cliff me salvó con 3 clientes que iban a perder su subsidio. Les recomendé abrir una HSA y mantuvieron sus planes a $0/mes. Eso no lo hace ninguna otra herramienta.&rdquo;</p>
            <div className="ag-testimonial-author">
              <div className="ag-testimonial-avatar">RM</div>
              <div className="ag-testimonial-info">
                <h4>Roberto Méndez</h4>
                <p>Agente Senior · Fort Myers, FL</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI SECTION */}
      <section className="ag-roi-section" id="roi">
        <div className="ag-section-label ag-reveal">El negocio tiene sentido</div>
        <h2 className="ag-reveal">Números que hablan solos</h2>

        <div className="ag-roi-cards">
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">45</div>
            <h4>Días de OEP 2027</h4>
            <p>El OEP 2027 se acorta a solo 45 días (Nov 1 – Dec 15). CotizaSalud te prepara para cerrar más en menos tiempo.</p>
          </div>
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">5.6x</div>
            <h4>ROI comprobado</h4>
            <p>Por cada dólar que inviertes, recuperas $5.60 en tiempo ahorrado y clientes adicionales cerrados.</p>
          </div>
          <div className="ag-roi-card ag-reveal">
            <div className="ag-roi-number">$0</div>
            <h4>Para empezar</h4>
            <p>Empieza gratis. Escala cuando quieras. Sin contratos, sin sorpresas.</p>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="ag-cta-section">
        <h2 className="ag-reveal">¿Listo para cotizar<br /><em>más rápido?</em></h2>
        <p className="ag-cta-desc ag-reveal">Únete a los agentes que están cerrando más con menos esfuerzo. Empieza en 30 segundos.</p>
        <div className="ag-reveal">
          <Link href="/cotizar" className="ag-btn-primary" style={{ fontSize: 18, padding: "20px 48px" }}>
            Empezar Gratis Ahora
            <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ag-footer">
        <div className="ag-footer-left">
          <div className="ag-footer-logo-icon">CS</div>
          <span className="ag-footer-text">© 2026 CotizaSalud. Todos los derechos reservados.</span>
        </div>
        <div className="ag-footer-links">
          <a href="#">Privacidad</a>
          <a href="#">Términos</a>
          <a href="#">Contacto</a>
        </div>
      </footer>
    </div>
  );
}
