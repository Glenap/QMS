import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Truck, TestTube, ArrowRight, CheckCircle,
  Zap, Globe, Lock, Play, Building2,
  FileText, Bot, Box
} from 'lucide-react';
import './LandingPage.css';

const WORKFLOW = [
  { icon: <Building2 size={32} />, step: '01', title: 'Project Setup', desc: 'Super admin configures towers, floors, grade specs and assigns contractors.' },
  { icon: <Truck size={32} />, step: '02', title: 'RMC Dispatch', desc: 'Supplier generates challan with QR. Truck carries concrete to the site.' },
  { icon: <Box size={32} />, step: '03', title: 'Gate Scan', desc: 'Guard scans QR. System notifies quality team instantly of truck arrival.' },
  { icon: <FileText size={32} />, step: '04', title: 'Pour Card', desc: 'Supervisor fills pour card on-site per truck. Cube samples collected.' },
  { icon: <TestTube size={32} />, step: '05', title: 'Lab Testing', desc: 'Cubes dispatched with QR labels. Lab uploads 7, 14, 28-day results online.' },
  { icon: <Bot size={32} />, step: '06', title: 'Auto Validation', desc: 'System validates vs IS 456. Failures auto-raise NCRs and notify stakeholders.' },
];

const FEATURES = [
  {
    icon: <Truck size={32} />,
    title: 'Real-Time Gate Tracking',
    desc: 'QR-based challan verification at the gate. Instant notifications to quality team the moment concrete arrives on site.',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    icon: <TestTube size={32} />,
    title: 'Digital Pour Cards',
    desc: 'Replace paper-based pour cards with structured digital forms. Per-truck records, slump tests and pre-pour checklists in one place.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    icon: <ShieldCheck size={32} />,
    title: 'Cube Test Automation',
    desc: 'Labs upload test results directly. System auto-validates against IS 456:2000 and flags failures without manual review.',
    color: '#F59E0B',
    bg: '#FEF3C7',
  }
];

const STATS = [
  { value: '10,000+', label: 'Pours Tracked' },
  { value: '98.3%', label: 'Pass Rate Accuracy' },
  { value: '250+', label: 'Projects Managed' },
  { value: '4 min', label: 'Avg. Issue Response' },
];

const CLIENTS = [
  { name: 'LARSEN & TOUBRO', img: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Larsen_and_Toubro_Logo.svg' },
  { name: 'Shapoorji Pallonji', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Shapoorji_Pallonji_Group_Logo.svg/1024px-Shapoorji_Pallonji_Group_Logo.svg.png' },
  { name: 'DLF', img: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/DLF_logo.svg' },
  { name: 'GAMMON', img: 'https://upload.wikimedia.org/wikipedia/en/f/f6/Gammon_India_logo.png' },
  { name: 'Godrej PROPERTIES', img: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Godrej_Logo.svg' },
  { name: 'TATA PROJECTS', img: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Tata_logo.svg' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lp-root">
      {/* NAV */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
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
          </div>
          <div className="lp-nav-cta">
            <button className="lp-btn lp-btn--ghost" onClick={() => setShowLogin(true)}>Log In</button>
            <button className="lp-btn lp-btn--primary" onClick={() => setShowLogin(true)}>Request a Demo</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-content">
            <h1 className="lp-hero-h1">
              Concrete Quality.<br />
              <span className="lp-gradient-text">Fully Traceable.</span>
            </h1>
            <p className="lp-hero-desc">
              From the RMC plant to the structural slab — QMS gives you end-to-end
              visibility of every cubic metre poured on site. Automated validation,
              real-time dashboards and a chatbot that knows your project inside out.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn lp-btn--hero" onClick={() => setShowLogin(true)}>
                Get Started Free
              </button>
              <button className="lp-btn lp-btn--outline" onClick={() => setShowLogin(true)}>
                <Play size={16} fill="currentColor" /> Watch Demo
              </button>
            </div>
            <div className="lp-hero-trust">
              <CheckCircle size={16} className="lp-trust-check" /> IS 456:2000 compliant
              <CheckCircle size={16} className="lp-trust-check" /> No hardware needed
              <CheckCircle size={16} className="lp-trust-check" /> Works offline on site
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
        <div className="lp-clients-row">
          {CLIENTS.map(c => (
            <div key={c.name} className="lp-client-logo">
              <img src={c.img} alt={c.name} className="lp-client-img" onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block'; }} />
              <span className="lp-client-fallback" style={{ display: 'none' }}>{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2 className="lp-section-h2">Powerful Features for Smarter Construction</h2>
          </div>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon-wrap" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
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
          </div>
          <div className="lp-workflow-steps">
            {WORKFLOW.map((w) => (
              <div key={w.step} className="lp-wf-step">
                <div className="lp-wf-num">{w.step}</div>
                <div className="lp-wf-icon">{w.icon}</div>
                <h4 className="lp-wf-title">{w.title}</h4>
                <p className="lp-wf-desc">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY STRIP */}
      <section className="lp-section lp-section--white" style={{ paddingTop: 0 }}>
        <div className="lp-section-inner">
          <div className="lp-security-strip">
            <div className="lp-sec-item"><Lock size={20} /> Role-based access control</div>
            <div className="lp-sec-item"><Globe size={20} /> Works on any device, any browser</div>
            <div className="lp-sec-item"><ShieldCheck size={20} /> IS 456 & IS 1199 compliance built-in</div>
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
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta-section">
        <div className="lp-cta-inner">
          <h2 className="lp-cta-h2">Ready to bring quality control into the 21st century?</h2>
          <p className="lp-cta-sub">Join hundreds of project teams who've replaced paper-based QA with QMS.</p>
          <div className="lp-cta-actions">
            <button className="lp-btn lp-btn--hero" onClick={() => setShowLogin(true)}>
              Start Your Project <ArrowRight size={18} />
            </button>
            <button className="lp-btn lp-btn--outline" onClick={() => setShowLogin(true)}>
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
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Product</div>
            <a href="#features">Features</a>
            <a href="#workflow">How It Works</a>
            <a href="#stats">Results</a>
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Platform</div>
            <a href="#">Dashboard</a>
            <a href="#">Pour Cards</a>
            <a href="#">Lab Results</a>
          </div>
          <div className="lp-footer-col">
            <div className="lp-footer-col-title">Company</div>
            <a href="#">Contact</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2024 QMS Platform. All rights reserved.</span>
          <span>IS 456:2000 · IS 1199 · BIS Compliant</span>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="lp-modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="lp-modal" onClick={e => e.stopPropagation()}>
            <div className="lp-modal-close" onClick={() => setShowLogin(false)}>×</div>
            
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
                <input type="email" className="lp-form-input" placeholder="admin@construction.com" required />
              </div>
              
              <div className="lp-form-group">
                <label className="lp-form-label">Password</label>
                <input type="password" className="lp-form-input" placeholder="••••••••" required />
              </div>
              
              <button type="submit" className="lp-btn lp-btn--hero" style={{ width: '100%' }}>
                Sign In to QMS
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
