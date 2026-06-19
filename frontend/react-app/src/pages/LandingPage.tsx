import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Truck, TestTube, ArrowRight, CheckCircle,
  Zap, Globe, Lock, Play, Building2,
  FileText, Box, Link, AlertTriangle, MessageSquare,
  ChevronDown, Menu, X, Clock
} from 'lucide-react';
import './LandingPage.css';

import ltLogo from '../assets/logos/lt.png';
import shapoorjiLogo from '../assets/logos/shapoorji.png';
import dlfLogo from '../assets/logos/dlf.png';
import gammonLogo from '../assets/logos/gammon.png';
import godrejLogo from '../assets/logos/godrej.png';
import tataLogo from '../assets/logos/tata.png';

const CLIENTS = [
  { name: 'Larsen & Toubro', img: ltLogo },
  { name: 'Shapoorji Pallonji', img: shapoorjiLogo },
  { name: 'DLF', img: dlfLogo },
  { name: 'Gammon India', img: gammonLogo },
  { name: 'Godrej Properties', img: godrejLogo },
  { name: 'Tata Projects', img: tataLogo },
];

const WORKFLOW = [
  { icon: <Building2 size={32} />, step: '01', title: 'Project Setup', desc: 'Super admin configures towers, floors, grade specs and assigns contractors.', time: '~15 min' },
  { icon: <Truck size={32} />, step: '02', title: 'RMC Dispatch', desc: 'Supplier generates challan with QR. Truck carries concrete to the site.', time: '~5 min' },
  { icon: <Box size={32} />, step: '03', title: 'Gate Scan', desc: 'Guard scans QR. System notifies quality team instantly of truck arrival.', time: '< 30 sec' },
  { icon: <FileText size={32} />, step: '04', title: 'Pour Card', desc: 'Supervisor fills pour card on-site per truck. Cube samples collected.', time: '~3 min' },
  { icon: <TestTube size={32} />, step: '05', title: 'Lab Testing', desc: 'Cubes dispatched with QR labels. Lab uploads 7, 14, 28-day results online.', time: 'Automated' },
  { icon: <ShieldCheck size={32} />, step: '06', title: 'Auto Classification + NCR', desc: 'System validates vs IS 456. Failures auto-raise NCRs and notify stakeholders.', time: 'Instant' },
];

const FEATURES = [
  {
    icon: <Truck size={28} />,
    title: 'Real-Time Gate Tracking',
    desc: 'QR-based challan verification at the gate. Instant notifications to quality team the moment concrete arrives on site.',
    metric: 'Zero missed trucks. 100% arrival logged.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
  {
    icon: <FileText size={28} />,
    title: 'Digital Pour Cards',
    desc: 'Replace paper-based pour cards with structured digital forms. Per-truck records, slump tests and pre-pour checklists in one place.',
    metric: 'Avg. 3 min per pour card. Zero paper loss.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
  {
    icon: <TestTube size={28} />,
    title: 'Cube Test Automation',
    desc: 'Labs upload test results directly. System auto-validates against IS 456:2000 and flags failures without manual review.',
    metric: '91%+ average pass rate across tracked projects.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
  {
    icon: <Link size={28} />,
    title: 'Traceability Chain',
    desc: 'Every pour linked: RMC plant → challan → pour card → cube result. One click to see the full story of any structural element.',
    metric: 'Full chain from plant to slab, always accessible.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
  {
    icon: <AlertTriangle size={28} />,
    title: 'NCR Escalation',
    desc: 'Non-conformance reports auto-raised on test failure. Escalation paths configured per project. No failure goes unnoticed.',
    metric: 'Avg. 4-min issue response time.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
  {
    icon: <MessageSquare size={28} />,
    title: 'AI Project Chatbot',
    desc: "Ask your project data anything. \"How many pours failed this week?\" or \"What's the slump trend for Tower B?\" Answers in seconds.",
    metric: 'Instant answers. No report-building needed.',
    color: '#1A56DB',
    bg: '#E6F1FB',
  },
];

const STATS = [
  { value: '10,000+', label: 'Pours Tracked' },
  { value: '91%+', label: 'Avg. Pass Rate', footnote: 'as of June 2024' },
  { value: '250+', label: 'Projects Managed' },
  { value: '4 min', label: 'Avg. Issue Response' },
];

const TESTIMONIALS = [
  {
    quote: "We used to have QA managers running around with clipboards. Now everything is on QMS — from the RMC challan to the cube result. Our IS 456 audit took 2 hours instead of 2 days.",
    name: "Rajiv Mehta",
    role: "QA Head, Tier-1 Contractor",
    project: "32-tower residential project, Pune",
  },
  {
    quote: "The gate scan feature alone saved us from 3 mix-ups in the first month. The driver scans the QR, the system confirms the grade, and my quality team gets a ping. Simple and bulletproof.",
    name: "Priya Sharma",
    role: "Site Engineer",
    project: "Commercial complex, Hyderabad",
  },
  {
    quote: "I asked the chatbot 'which elements are at risk of falling below M30 at 28 days?' and it gave me a list in 10 seconds. That would have taken my team half a day to pull from spreadsheets.",
    name: "Anand Krishnamurthy",
    role: "Project Director",
    project: "Infrastructure project, Chennai",
  },
];

const FAQS = [
  {
    q: "Do we need to install any hardware or app?",
    a: "No hardware required. QMS runs entirely in the browser — on any phone, tablet or laptop. Guards use a phone camera to scan QR codes. Labs access the portal from any browser. Nothing to install or maintain.",
  },
  {
    q: "Does it work without internet on site?",
    a: "Pour cards and gate scans are designed to work with intermittent connectivity. Data syncs automatically when the connection is restored. You won't lose a record due to poor site internet.",
  },
  {
    q: "How does the IS 456:2000 validation actually work?",
    a: "When a lab uploads a cube result, QMS automatically compares it against the acceptance criteria in IS 456:2000 for the specified grade. If it fails, an NCR is raised automatically and the assigned stakeholders are notified within seconds.",
  },
  {
    q: "Can we use our existing RMC supplier's challan format?",
    a: "Yes. QMS generates a QR-coded digital challan that your RMC supplier attaches to every truck. Alternatively, QMS can integrate with your supplier's existing system. Setup typically takes 1–2 hours per supplier.",
  },
  {
    q: "How long does it take to go live on a new project?",
    a: "A new project is typically live within 1 working day. Project configuration (towers, floors, elements, grades, user roles) takes 15–30 minutes. Training for site staff takes under 1 hour.",
  },
  {
    q: "Is our project data secure and private?",
    a: "All data is stored on Indian servers (data residency compliant). Role-based access control means each user only sees what they need to. Project data is never shared across clients. We provide a data processing agreement on request.",
  },
];

const ROLES = [
  {
    label: 'Project Manager',
    headline: 'Know your pour status without picking up the phone.',
    points: [
      'Real-time dashboard showing all active pours across every tower',
      'Instant alert when a cube result comes back borderline or fail',
      'Full NCR history with resolution status — no chasing people',
    ],
  },
  {
    label: 'Quality Head',
    headline: 'Every failure traced and NCR raised in under 60 seconds.',
    points: [
      'Automated IS 456:2000 validation — no manual result checks',
      'NCR auto-raised and assigned to responsible party on failure',
      'Audit-ready traceability chain from batch plant to structural slab',
    ],
  },
  {
    label: 'Supervisor',
    headline: 'Fill pour cards on your tablet. Offline. In 5 minutes.',
    points: [
      'Works without internet — syncs when you are back in range',
      'QR-tagged cube labels printed from the same pour card form',
      'No double entry — pour card auto-links to challan and gate record',
    ],
  },
  {
    label: 'Contractor Admin',
    headline: 'Full quality visibility across all towers, all suppliers, all grades.',
    points: [
      'All projects, all sites — one login, one dashboard',
      'Supplier performance scores calculated from actual test data',
      'Export compliance reports in PDF for client or auditor in one click',
    ],
  },
];

const CHAT_EXCHANGE = [
  { role: 'user', text: 'Which supplier provided M40 for Tower T1, Floor 5?' },
  { role: 'bot', text: 'UltraTech RMC Whitefield — Batch BATCH-20240601-042, poured 01-Jun-2024, 83.5 m³. 28-day result: 48.3 MPa — PASS.' },
];

const COMPARISON_ROWS = [
  { feature: 'Per-truck pour records', qms: true, paper: false, whatsapp: false },
  { feature: 'Automated IS 456 validation', qms: true, paper: false, whatsapp: false },
  { feature: 'Real-time NCR escalation', qms: true, paper: false, whatsapp: false },
  { feature: 'Full traceability chain', qms: true, paper: false, whatsapp: false },
  { feature: 'Audit-ready reports', qms: true, paper: '~2 days manual', whatsapp: false },
  { feature: 'Works without hardware', qms: true, paper: true, whatsapp: true },
  { feature: 'Searchable history', qms: true, paper: false, whatsapp: false },
  { feature: 'AI chatbot on your data', qms: true, paper: false, whatsapp: false },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeRole, setActiveRole] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lp-root">
      {/* NAV */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`} aria-label="Main navigation">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <div className="lp-logo-mark">QM</div>
            <div>
              <div className="lp-logo-name">QMS</div>
              <div className="lp-logo-tag">Quality Management</div>
            </div>
          </div>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">How It Works</a>
            <a href="#stats">Results</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-nav-cta">
            <button className="lp-btn lp-btn--ghost" onClick={() => setShowLogin(true)} aria-label="Log in to your account">Log In</button>
            <button className="lp-btn lp-btn--primary" onClick={() => setShowLogin(true)} aria-label="Book a live demo">Book a Live Demo</button>
          </div>
          <button className="lp-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="lp-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="lp-drawer" onClick={e => e.stopPropagation()}>
            <button className="lp-drawer-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu"><X size={24} /></button>
            <nav className="lp-drawer-links">
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#workflow" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#stats" onClick={() => setMobileMenuOpen(false)}>Results</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            </nav>
            <button className="lp-btn lp-btn--hero lp-drawer-cta" onClick={() => { setShowLogin(true); setMobileMenuOpen(false); }}>Book a Live Demo</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <h1 className="lp-hero-h1">
              Concrete Quality.<br />
              <span className="lp-gradient-text">Fully Traceable.</span>
            </h1>
            <p className="lp-hero-qualifier">Built for contractors managing 5 or more towers and 100 or more pours per month.</p>
            <p className="lp-hero-desc">
              From the RMC plant to the structural slab — QMS gives you end-to-end
              visibility of every cubic metre poured on site. Automated validation,
              real-time dashboards and a chatbot that knows your project inside out.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn lp-btn--hero" onClick={() => setShowLogin(true)} aria-label="Book a live demo">
                Book a Live Demo
              </button>
              <button className="lp-btn lp-btn--outline" onClick={() => setShowLogin(true)} aria-label="See how it works">
                <Play size={16} fill="currentColor" /> See How It Works
              </button>
            </div>
            <div className="lp-hero-trust">
              <span className="lp-trust-item"><CheckCircle size={16} className="lp-trust-check" /> IS 456:2000 compliant</span>
              <span className="lp-trust-item"><CheckCircle size={16} className="lp-trust-check" /> No hardware needed</span>
              <span className="lp-trust-item"><CheckCircle size={16} className="lp-trust-check" /> Works offline on site</span>
              <span className="lp-trust-item"><CheckCircle size={16} className="lp-trust-check" /> Data stored in India</span>
            </div>
          </div>

          <div className="lp-hero-visual lp-hero-pipeline">
            <h3 className="lp-pipeline-title">Process Pipeline</h3>
            <div className="lp-pipeline-container">
              {WORKFLOW.map((step, index) => (
                <div key={step.step} className="lp-pipe-node">
                  <div className="lp-pipe-circle">
                    {step.icon}
                  </div>
                  <div className="lp-pipe-label">
                    <span className="lp-pipe-num">{index + 1}.</span> {step.title}
                  </div>
                  {index < WORKFLOW.length - 1 && <div className="lp-pipe-line" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CLIENTS */}
      <section className="lp-clients">
        <p className="lp-clients-label">TRUSTED BY INDIA'S LEADING CONSTRUCTION COMPANIES</p>
        <div className="lp-clients-marquee">
          <div className="lp-clients-track">
            {[...CLIENTS, ...CLIENTS].map((c, i) => (
              <div key={`${c.name}-${i}`} className="lp-client-logo">
                <img src={c.img} alt={c.name} className="lp-client-img" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'; }} />
                <span className="lp-client-fallback" style={{ display: 'none' }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">Everything Your QA Team Needs, Nothing They Don't</h2>
            <p className="lp-section-sub">Six tools, one platform. Built around the way concrete quality actually works on Indian construction sites.</p>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon-wrap" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
                <p className="lp-feature-metric">{f.metric}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="lp-section lp-section--white" id="workflow">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">How It Works</h2>
            <p className="lp-section-sub">Six steps. End-to-end. From concrete leaving the plant to a validated cube result in the lab.</p>
          </div>
          <div className="lp-workflow-steps">
            {WORKFLOW.map((w) => (
              <div key={w.step} className="lp-wf-step">
                <div className="lp-wf-num">{w.step}</div>
                <div className="lp-wf-icon">{w.icon}</div>
                <h4 className="lp-wf-title">{w.title}</h4>
                <p className="lp-wf-desc">{w.desc}</p>
                <div className="lp-wf-time"><Clock size={12} /> {w.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ROLE TABS ─── Section 6C */}
      <section className="lp-section lp-section--features" id="roles">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">Built for every role on your site.</h2>
            <p className="lp-section-sub">Different dashboards. Same single source of truth.</p>
          </div>
          <div className="lp-role-tabs">
            <div className="lp-role-tab-list" role="tablist">
              {ROLES.map((r, i) => (
                <button
                  key={r.label}
                  className={`lp-role-tab-btn ${activeRole === i ? 'lp-role-tab-btn--active' : ''}`}
                  onClick={() => setActiveRole(i)}
                  role="tab"
                  aria-selected={activeRole === i}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="lp-role-panel">
              <h3 className="lp-role-headline">{ROLES[activeRole].headline}</h3>
              <ul className="lp-role-points">
                {ROLES[activeRole].points.map((p, i) => (
                  <li key={i}><CheckCircle size={16} className="lp-role-check" />{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI CHATBOT DEMO ─── Section 6D */}
      <section className="lp-section lp-section--white" id="chatbot">
        <div className="lp-section-inner lp-chatbot-inner">
          <div className="lp-chatbot-text">
            <h2 className="lp-section-h2">QMS knows your project.<br />Ask it anything.</h2>
            <p className="lp-section-sub" style={{ textAlign: 'left', marginTop: 16 }}>
              Ask about any pour, batch, supplier, failure or NCR in plain language. Get an answer from your live project data in seconds.
            </p>
          </div>
          <div className="lp-chat-box">
            {CHAT_EXCHANGE.map((msg, i) => (
              <div key={i} className={`lp-chat-msg lp-chat-msg--${msg.role}`}>
                <div className={`lp-chat-bubble lp-chat-bubble--${msg.role}`}>{msg.text}</div>
              </div>
            ))}
            <div className="lp-chat-input-row">
              <input className="lp-chat-input" placeholder="Ask about any pour, batch or NCR..." readOnly />
              <button className="lp-chat-send" aria-label="Send message">
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── Section bg: #E6F1FB */}
      <section className="lp-trust-strip-section">
        <div className="lp-section-inner">
          <div className="lp-security-strip">
            <div className="lp-sec-item"><Lock size={20} /> Role-based access control</div>
            <div className="lp-sec-item"><Globe size={20} /> Works on any device, any browser</div>
            <div className="lp-sec-item"><ShieldCheck size={20} /> IS 456 &amp; IS 1199 compliance built-in</div>
            <div className="lp-sec-item"><Zap size={20} /> Real-time notifications</div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="lp-stats-section" id="stats">
        <div className="lp-stats-grid">
          {STATS.map(s => (
            <div key={s.label} className="lp-stat-item">
              <div className="lp-stat-val">{s.value}</div>
              <div className="lp-stat-label">{s.label}</div>
              {s.footnote && <div className="lp-stat-footnote">{s.footnote}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="lp-section lp-section--white" id="testimonials">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">What Project Teams Are Saying</h2>
            <p className="lp-section-sub">From site engineers to QA heads — here's what changed when they switched to QMS.</p>
          </div>
          <div className="lp-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="lp-testimonial-card">
                <div className="lp-testimonial-quote">"</div>
                <p className="lp-testimonial-text">{t.quote}</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.name[0]}</div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                    <div className="lp-testimonial-project">{t.project}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="lp-section" id="comparison">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">QMS vs. The Way It's Done Now</h2>
            <p className="lp-section-sub">Paper records and WhatsApp groups can't give you the traceability IS 456 demands.</p>
          </div>
          <div className="lp-comparison-table">
            <div className="lp-comparison-header">
              <div className="lp-comparison-feature-col">Feature</div>
              <div className="lp-comparison-col lp-comparison-col--qms">QMS</div>
              <div className="lp-comparison-col">Paper Records</div>
              <div className="lp-comparison-col">WhatsApp / Excel</div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={i} className="lp-comparison-row">
                <div className="lp-comparison-feature">{row.feature}</div>
                <div className="lp-comparison-cell lp-comparison-cell--qms">
                  {row.qms === true ? <CheckCircle size={18} className="lp-comp-yes" /> : <span className="lp-comp-no">✗</span>}
                </div>
                <div className="lp-comparison-cell">
                  {row.paper === true ? <CheckCircle size={18} className="lp-comp-yes" /> : row.paper === false ? <span className="lp-comp-no">✗</span> : <span className="lp-comp-partial">{row.paper}</span>}
                </div>
                <div className="lp-comparison-cell">
                  {row.whatsapp === true ? <CheckCircle size={18} className="lp-comp-yes" /> : <span className="lp-comp-no">✗</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section lp-section--white" id="faq">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">Frequently Asked Questions</h2>
          </div>
          <div className="lp-faq-list">
            {FAQS.map((faq, i) => (
              <div key={i} className={`lp-faq-item ${openFaq === i ? 'lp-faq-item--open' : ''}`}>
                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  {faq.q}
                  <ChevronDown size={20} className="lp-faq-chevron" />
                </button>
                {openFaq === i && <p className="lp-faq-a">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-h2">Stop managing quality in spreadsheets.</h2>
          <p className="lp-cta-sub">Book a 30-minute live demo. We'll walk through your project type, your current QA process, and show you exactly how QMS fits in.</p>
          <div className="lp-cta-actions">
            <button className="lp-btn lp-btn--hero" onClick={() => setShowLogin(true)} aria-label="Book a live demo">
              Book a Live Demo <ArrowRight size={18} />
            </button>
            <button className="lp-btn lp-btn--outline" onClick={() => setShowLogin(true)} aria-label="Log in to dashboard">
              Log In to Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <div className="lp-logo">
              <div className="lp-logo-mark">QM</div>
              <div>
                <div className="lp-logo-name">QMS</div>
              </div>
            </div>
            <p className="lp-footer-desc">End-to-end concrete quality traceability for construction projects of all scales.</p>
            <div className="lp-footer-badges">
              <span className="lp-footer-badge">IS 456:2000</span>
              <span className="lp-footer-badge">IS 1199</span>
              <span className="lp-footer-badge">Data Residency: India</span>
            </div>
            <div className="lp-footer-contact">
              <div>Support: <a href="mailto:support@qms.in">support@qms.in</a></div>
            </div>
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Product</div>
            <a href="#features">Features</a>
            <a href="#workflow">How It Works</a>
            <a href="#stats">Results</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Platform</div>
            <a href="#">Dashboard</a>
            <a href="#">Pour Cards</a>
            <a href="#">Lab Results</a>
            <a href="#">NCR Tracking</a>
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Company</div>
            <a href="#">Contact</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 QMS Platform. All rights reserved.</span>
          <span>IS 456:2000 · IS 1199 · BIS Compliant</span>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="lp-modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="lp-modal" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-close" onClick={() => setShowLogin(false)} role="button" aria-label="Close login modal">×</div>

            <div className="lp-modal-header">
              <div className="lp-logo-mark" style={{ margin: '0 auto 16px' }}>QM</div>
              <h2 className="lp-modal-title">Welcome back</h2>
              <p className="lp-modal-sub">Log in to your QMS account</p>
            </div>

            <form className="lp-modal-form" onSubmit={(e) => {
              e.preventDefault();
              navigate('/app');
            }}>
              <div className="lp-form-group">
                <label className="lp-form-label">Email address</label>
                <input type="email" className="lp-form-input" placeholder="admin@construction.com" required aria-label="Email address" />
              </div>

              <div className="lp-form-group">
                <label className="lp-form-label">Password</label>
                <input type="password" className="lp-form-input" placeholder="••••••••" required aria-label="Password" />
              </div>

              <button type="submit" className="lp-btn lp-btn--hero" style={{ width: '100%' }} aria-label="Sign in to QMS">
                Sign In to QMS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
