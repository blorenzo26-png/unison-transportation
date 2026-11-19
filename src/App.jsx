import React, { useEffect, useMemo, useRef, useState } from 'react';

/* global BUILD_YEAR */


/* =========================================================
   BUSINESS DETAILS — edit here, used everywhere on the page
   ========================================================= */
const BUSINESS = {
  name: 'Unison Transportation',
  street: '1720 West End Avenue, Suite 320',
  cityLine: 'Nashville, TN 37203',
  phoneDisplay: '629.259.5327',
  phoneHref: 'tel:+16292595327',
  email: 'Info@unisontransportation.com',
  mapsHref: 'https://www.google.com/maps/search/?api=1&query=1720+West+End+Avenue+Suite+320+Nashville+TN+37203',
  capacity: 9,           // seats up to 9 guests in the back (DJ); say 8 comfortably
  comfortable: 8,
  socials: [
    { name: 'Instagram', href: 'https://www.instagram.com/unisontransportation' },
    { name: 'TikTok',    href: 'https://www.tiktok.com/@unisontransportation' },
    { name: 'Facebook',  href: 'https://www.facebook.com/profile.php?id=61596900830218' },
  ],
};

/* =========================================================
   RATES — from the Unison price list. The estimator uses
   these; change a number here and the whole page updates.
   ========================================================= */
const RATES = {
  vanShortDay: 750,      // van, service days up to SHORT_DAY_MAX_HOURS
  vanSixHour: 875,       // van, 6-hour day (smooths the step from a short to a full day)
  vanFullDay: 1000,      // van, 7 to 12 hours
  shortDayMaxHours: 5,
  driverHourly: 50,      // chauffeur, per hour
  hotelPerNight: 325,    // chauffeur hotel + meals per night, from GSA per diem (Nashville FY27: $230 lodging + $86 M&IE); actual hotel rate confirmed in the quote
  fuelPer110Miles: 100,  // est. fuel per travel day, per ~110 miles one-way (Nashville to Huntsville)
  minHours: 4,           // booking minimum; the short-day van block still covers up to 5 hours
  maxHours: 12,
  maxDays: 5,
  gratuityPct: 20,       // chauffeur gratuity, its own line; removable if the guest tips in person (DJ, 2026-11-17)
  transferFlat: 650,     // point-to-point transfer within Nashville, all-in (DJ, 2026-11-17)
};



const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/* Booking terms DJ confirmed on 2026-11-17 (same wording Carson uses in quotes). */
const TERMS = [
  { k: 'Deposit', v: '50% holds your date. The balance is settled before the trip.' },
  { k: 'Cancellation', v: 'Cancel 7 or more days before pickup for a full deposit refund. Inside 7 days the deposit is non-refundable but can be moved once to another open date.' },
  { k: 'Same day & no-shows', v: 'Charged in full. Holiday and major-event dates are non-refundable once booked.' },
  { k: 'Date changes', v: 'Free with 7 or more days’ notice, subject to availability.' },
  { k: 'Gratuity', v: `${RATES.gratuityPct}% for your chauffeur, shown as its own line. Rather tip in person? Tell us before the trip and we’ll remove it.` },
  { k: 'Transfers', v: `Airport and point-to-point transfers within Nashville are a flat ${money(RATES.transferFlat)} all-in, gratuity included. Over about 90 minutes door to door is booked hourly.` },
  { k: 'Waiting', v: '15 minutes free (60 at the airport from landing), then $50 per 15 minutes.' },
  { k: 'Extras', v: 'Extra stops are free. Parking and tolls at cost, and $250 if the cabin needs special cleaning.' },
  { k: 'Payment', v: 'By the QuickBooks invoice we send (card and the other methods it offers), or Zelle, Cash App, Venmo or Apple Pay.' },
];

// Van price and label for one service day.
function vanTier(hours) {
  if (hours <= RATES.shortDayMaxHours) return { amount: RATES.vanShortDay, label: `up to ${RATES.shortDayMaxHours} hrs`, kind: 'short day' };
  if (hours === RATES.shortDayMaxHours + 1) return { amount: RATES.vanSixHour, label: `${hours} hrs`, kind: 'extended day' };
  return { amount: RATES.vanFullDay, label: `up to ${RATES.maxHours} hrs`, kind: 'full day' };
}

function estimateTrip({ days, nights, miles }) {
  const lines = [];
  days.forEach((asked, i) => {
    const hours = Math.max(asked, RATES.minHours);
    const van = vanTier(hours);
    lines.push({ label: `Day ${i + 1} · Maybach Sprinter (${van.label})`, amount: van.amount });
    lines.push({ label: `Day ${i + 1} · Chauffeur (${hours} hrs × ${money(RATES.driverHourly)})`, amount: hours * RATES.driverHourly });
  });
  if (nights > 0) lines.push({ label: `Chauffeur hotel & meals (${nights} night${nights > 1 ? 's' : ''}, from ${money(RATES.hotelPerNight)})`, amount: nights * RATES.hotelPerNight });
  const fuelPerDay = Math.round((miles / 110) * RATES.fuelPer110Miles);
  if (fuelPerDay > 0) lines.push({ label: `Estimated fuel (${days.length} day${days.length > 1 ? 's' : ''})`, amount: fuelPerDay * days.length });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  // Same rule as Carson's quotes: 20% of the whole trip, its own line.
  lines.push({ label: `Chauffeur gratuity (${RATES.gratuityPct}%, removable)`, amount: Math.round(subtotal * RATES.gratuityPct / 100) });
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total };
}

const EXAMPLE_TRIPS = [
  {
    title: 'Huntsville day trip',
    route: 'Nashville ↔ Huntsville, AL',
    detail: 'One 12-hour service day, out and back.',
    trip: { days: [12], nights: 0, miles: 110 },
  },
  {
    title: 'Huntsville overnight',
    route: 'Nashville → Huntsville → Nashville',
    detail: 'A 12-hour day out, an overnight stay, a 5-hour day home.',
    trip: { days: [12, 5], nights: 1, miles: 110 },
  },
];

/* ---------- Text-animation gate (hero) ----------
   Hero copy starts cascading 3 s after the video begins playing,
   with a 5 s fallback so it never stays hidden. */
const TEXT_GATE_EVENT = 'hero:text-gate';
const TEXT_GATE_OFFSET_MS = 3000;
const getTextGateAt = () => window.__heroTextGateAt || 0;
const useTextGateReady = (extraDelay = 0) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let t = null;
    const arm = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setReady(true), extraDelay);
    };
    if (getTextGateAt()) {
      arm();
    } else {
      const onGate = () => arm();
      window.addEventListener(TEXT_GATE_EVENT, onGate, { once: true });
      return () => {
        window.removeEventListener(TEXT_GATE_EVENT, onGate);
        if (t) clearTimeout(t);
      };
    }
    return () => { if (t) clearTimeout(t); };
  }, [extraDelay]);
  return ready;
};

function HeroVideo({ src, poster }) {
  const fireGate = () => {
    if (window.__heroTextGateAt) return;
    window.__heroTextGateAt = performance.now();
    window.dispatchEvent(new CustomEvent(TEXT_GATE_EVENT));
  };
  const handlePlaying = () => {
    if (window.__heroTextGateArmed) return;
    window.__heroTextGateArmed = true;
    setTimeout(fireGate, TEXT_GATE_OFFSET_MS);
  };
  useEffect(() => {
    const fallback = setTimeout(fireGate, 5000);
    return () => clearTimeout(fallback);
  }, []);
  return (
    <video
      className="absolute inset-0 w-full h-full object-cover"
      src={src}
      poster={poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      onPlaying={handlePlaying}
      aria-hidden="true"
    />
  );
}

function FadeIn({ delay = 0, duration = 1000, children, className = '', style = {} }) {
  const visible = useTextGateReady(delay);
  return (
    <div className={`transition-opacity ${className}`} style={{ opacity: visible ? 1 : 0, transitionDuration: `${duration}ms`, ...style }}>
      {children}
    </div>
  );
}

function AnimatedHeading({ text, className = '', style = {}, charDelay = 30, initialDelay = 200 }) {
  const started = useTextGateReady(initialDelay);
  const lines = text.split('\n');
  return (
    <h1 className={className} style={style} aria-label={text.replace('\n', ' ')}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} style={{ display: 'block' }} aria-hidden="true">
          {line.split(' ').map((word, wordIndex, words) => {
            // Offset of this word's first character within the line
            const startChar = words.slice(0, wordIndex).reduce((n, w) => n + w.length + 1, 0);
            return (
              <React.Fragment key={wordIndex}>
                {/* Each word is unbreakable so lines wrap between words, never mid-word */}
                <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {Array.from(word).map((ch, i) => {
                    const d = (lineIndex * lines[0].length * charDelay) + ((startChar + i) * charDelay);
                    return (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          opacity: started ? 1 : 0,
                          transform: started ? 'translateX(0)' : 'translateX(-18px)',
                          transition: `opacity 500ms ease ${d}ms, transform 500ms ease ${d}ms`,
                        }}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </span>
                {wordIndex < words.length - 1 ? ' ' : null}
              </React.Fragment>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* ---------- Scroll reveal ---------- */
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

function SectionHeader({ eyebrow, title, intro, align = 'left' }) {
  return (
    <Reveal className={`max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mt-5 text-3xl md:text-5xl font-normal text-white" style={{ letterSpacing: '-0.035em', lineHeight: 1.05 }}>
        {title}
      </h2>
      {intro && <p className="mt-5 text-base md:text-lg text-champagne/70 font-light leading-relaxed">{intro}</p>}
    </Reveal>
  );
}

/* ---------- Icons (inline, stroke) ---------- */
const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const icons = {
  seat:    <><path d="M6 4v9a3 3 0 0 0 3 3h7" /><path d="M6 13h9a2 2 0 0 1 2 2v5" /><path d="M9 20h8" /></>,
  light:   <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></>,
  sound:   <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>,
  shield:  <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  people:  <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5 5.5" /></>,
  wheel:   <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3v7M5 16l5.3-3M19 16l-5.3-3" /></>,
  arrow:   <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  star:    <><path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" /></>,
  screen:  <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /></>,
  glass:   <><path d="M7 3h10l-1 8a4 4 0 0 1-8 0L7 3Z" /><path d="M12 15v6M9 21h6" /></>,
  snow:    <><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18" /><path d="m9 4 3 2 3-2M9 20l3-2 3 2" /></>,
  phone:   <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></>,
  mail:    <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  pin:     <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  menu:    <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  close:   <><path d="M6 6l12 12M18 6 6 18" /></>,
  check:   <><path d="m5 12 4.5 4.5L19 7" /></>,
  plus:    <><path d="M12 5v14M5 12h14" /></>,
  minus:   <><path d="M5 12h14" /></>,
};

/* ---------- Navbar ---------- */
const NAV_LINKS = [
  { href: '#van', label: 'The Van' },
  { href: '#experiences', label: 'Experiences' },
  { href: '#rates', label: 'Rates' },
  { href: '#nashville', label: 'Nashville' },
  { href: '#reserve', label: 'Contact' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 px-4 md:px-12 lg:px-16 transition-all duration-500 ${scrolled ? 'pt-3' : 'pt-6'}`}>
      <nav className="liquid-glass rounded-xl px-4 py-2 flex items-center justify-between" aria-label="Main">
        <a href="#top" className="flex items-center gap-3 select-none" aria-label="Unison Transportation, back to top">
          <span className="text-2xl font-semibold tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>UNISON</span>
          <span className="hidden sm:inline-block text-[10px] font-light text-champagne/70 tracking-[0.28em] border-l border-white/15 pl-3">TRANSPORTATION</span>
        </a>

        <div className="hidden xl:flex items-center gap-8 text-sm text-white/85">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href} className="nav-link">{l.label}</a>)}
        </div>

        <div className="flex items-center gap-2">
          <a href={BUSINESS.phoneHref} className="hidden xl:inline-flex items-center gap-2 text-sm text-champagne/80 nav-link px-3">
            <Icon d={icons.phone} className="w-4 h-4" /> {BUSINESS.phoneDisplay}
          </a>
          <a href="#reserve" className="cta-primary px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap">Get a quote</a>
          <button
            type="button"
            className="xl:hidden text-white/90 p-2 -mr-1"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon d={open ? icons.close : icons.menu} className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="xl:hidden liquid-glass rounded-xl mt-2 px-5 py-4" style={{ background: 'rgba(10,10,10,0.88)' }}>
          <div className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="nav-link py-3 text-base text-white/90 border-b hairline last:border-0">
                {l.label}
              </a>
            ))}
            <a href={BUSINESS.phoneHref} className="nav-link pt-4 text-sm text-champagne/80 inline-flex items-center gap-2">
              <Icon d={icons.phone} className="w-4 h-4" /> Call {BUSINESS.phoneDisplay}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section id="top" className="relative w-full h-screen min-h-[720px] overflow-hidden text-white">
      <HeroVideo src="assets/hero-loop.mp4" poster="assets/hero-poster.jpg" />
      <div className="hero-vignette" aria-hidden="true" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-6 md:px-12 lg:px-16 flex-1 flex flex-col justify-end pb-10 lg:pb-14">
          <div className="lg:grid lg:grid-cols-2 lg:items-end lg:gap-10">
            <div>
              <AnimatedHeading
                text={"Private luxury,\nNashville to anywhere."}
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4 text-white"
                style={{ letterSpacing: '-0.04em', lineHeight: 1.02 }}
              />
              <FadeIn delay={800} duration={1000}>
                <p className="text-base md:text-lg text-champagne/80 mb-6 max-w-xl font-light">
                  A chauffeured Mercedes-Maybach Sprinter for up to {BUSINESS.capacity} guests ({BUSINESS.comfortable} ride comfortably),
                  with a discreet chauffeur who knows this city. For arrivals that
                  deserve more than a ride.
                </p>
              </FadeIn>
              <FadeIn delay={1200} duration={1000}>
                <div className="flex flex-wrap gap-4">
                  <a href="#reserve" className="cta-primary px-8 py-3 rounded-lg font-medium text-sm tracking-wide">Request a quote</a>
                  <a href="#rates" className="cta-secondary liquid-glass border border-white/15 px-8 py-3 rounded-lg font-medium text-sm tracking-wide">Estimate your trip</a>
                </div>
              </FadeIn>
            </div>

            <div className="flex items-end justify-start lg:justify-end mt-10 lg:mt-0">
              <FadeIn delay={1400} duration={1000}>
                <div className="liquid-glass px-6 py-3 rounded-xl">
                  <div className="flex items-center gap-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_10px_2px_rgba(212,175,55,0.6)]"></span>
                    <span className="text-lg md:text-xl lg:text-2xl font-light text-white tracking-wide">
                      Chauffeur<span className="text-champagne/50 mx-2">·</span>Concierge<span className="text-champagne/50 mx-2">·</span>Maybach
                    </span>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>

          <FadeIn delay={1600} duration={1000}>
            <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px] tracking-[0.28em] uppercase text-champagne/50 font-light">
              <span>West End · Nashville, Tennessee</span>
              <span className="hidden md:inline-block">Mercedes-Maybach Sprinter · Up to {BUSINESS.capacity} guests</span>
              <a href={BUSINESS.phoneHref} className="nav-link">Concierge · {BUSINESS.phoneDisplay}</a>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* ---------- The Van ---------- */
const VAN_FEATURES = [
  { icon: 'seat',   title: 'Quilted captain’s chairs', body: 'Power-adjustable, diamond-quilted leather seats with fold-down armrests. A lounge, not a row of bench seats.' },
  { icon: 'star',   title: 'Starlight ceiling', body: 'A starlit suede headliner with dimmable ceiling and wall lighting that sets the tone before you pull away.' },
  { icon: 'screen', title: 'Streaming entertainment', body: 'A large-format screen with your streaming apps and a premium speaker system. Your show, your playlist.' },
  { icon: 'shield', title: 'Privacy partition', body: 'Raise the partition for a confidential call, a quiet moment, or a surprise.' },
  { icon: 'glass',  title: 'Refreshment console', body: 'A granite-topped console with an ice well and cup holders within reach of every seat.' },
  { icon: 'snow',   title: 'Rear cabin climate', body: 'Independent heat and air for the cabin, so the back stays comfortable on a July night.' },
  { icon: 'people', title: `Up to ${BUSINESS.capacity} guests`, body: `${BUSINESS.comfortable} ride comfortably. Everyone arrives together. No split cars, no surge pricing, no one left waiting on the curb.` },
  { icon: 'wheel',  title: 'Professional chauffeur', body: 'Professional, discreet and punctual, and fluent in Nashville traffic, venues and back routes.' },
];

/* Gallery: `grid` sets the tile size in the desktop bento layout (12 columns).
   Photos without `grid` appear only in the full-screen viewer. */
const VAN_PHOTOS = [
  { src: 'assets/van/cabin.jpg', w: 964, h: 1510, alt: 'The cabin: quilted leather captain’s chairs, wood-plank floor and a rear entertainment screen', caption: 'The cabin', grid: 'col-span-2 row-span-3 lg:col-span-4 lg:row-span-3' },
  { src: 'assets/van/star-ceiling.jpg', w: 1169, h: 792, alt: 'Starlight suede ceiling with recessed lights above the entertainment screen', caption: 'Starlight ceiling', grid: 'col-span-2 row-span-2 lg:col-span-8 lg:row-span-2', pos: 'center 72%' },
  { src: 'assets/van/refreshment-console.jpg', w: 1169, h: 782, alt: 'Granite refreshment console with ice well and cup holders beside the lounge bench', caption: 'Refreshment console', grid: 'col-span-1 row-span-1 lg:col-span-4 lg:row-span-1' },
  { src: 'assets/van/seat-controls.jpg', w: 1169, h: 782, alt: 'Power seat controls on a captain’s chair', caption: 'Power-adjustable seating', grid: 'col-span-1 row-span-1 lg:col-span-4 lg:row-span-1' },
  { src: 'assets/van/captain-chair.jpg', w: 1169, h: 1758, alt: 'Diamond-quilted leather captain’s chair with armrests', caption: 'Captain’s chair', grid: 'col-span-1 row-span-2 lg:col-span-3 lg:row-span-2' },
  { src: 'assets/van/rear-lounge.jpg', w: 1169, h: 792, alt: 'Rear lounge bench in quilted leather beneath a wide screen and speakers', caption: 'Rear lounge', grid: 'col-span-2 row-span-2 lg:col-span-6 lg:row-span-2 order-last lg:order-none' },
  { src: 'assets/van/cabin-controls.jpg', w: 1169, h: 1754, alt: 'Cabin control panel for ceiling, wall and starlight lighting, partition and climate', caption: 'Lighting, partition and climate controls', grid: 'col-span-1 row-span-2 lg:col-span-3 lg:row-span-2' },
  { src: 'assets/van/captain-chair-side.jpg', w: 1169, h: 1764, alt: 'Captain’s chair by the window with wood accents', caption: 'Window seating with wood accents' },
  { src: 'assets/van/entertainment-remote.jpg', w: 1170, h: 788, alt: 'Streaming remote resting on a leather armrest', caption: 'Streaming entertainment' },
  { src: 'assets/van/maybach-emblem.jpg', w: 1169, h: 1754, alt: 'Maybach emblem on a leather interior panel', caption: 'Maybach detailing' },
];

function Lightbox({ index, onClose, onStep }) {
  const closeRef = useRef(null);
  const photo = VAN_PHOTOS[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose, onStep]);
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${VAN_PHOTOS.length}: ${photo.caption}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 md:px-8 py-4 text-sm text-champagne/70">
        <span className="tabular-nums">{index + 1} / {VAN_PHOTOS.length}</span>
        <button ref={closeRef} type="button" onClick={onClose} className="p-2 -mr-2 text-white/90 hover:text-gold" aria-label="Close photo viewer">
          <Icon d={icons.close} className="w-6 h-6" />
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 md:px-20" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img src={photo.src} alt={photo.alt} width={photo.w} height={photo.h} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
        <button type="button" onClick={() => onStep(-1)} className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 stepper-btn !w-11 !h-11 bg-black/40" aria-label="Previous photo">
          <Icon d={<path d="m15 6-6 6 6 6" />} className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => onStep(1)} className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 stepper-btn !w-11 !h-11 bg-black/40" aria-label="Next photo">
          <Icon d={<path d="m9 6 6 6-6 6" />} className="w-5 h-5" />
        </button>
      </div>
      <p className="px-4 py-5 text-center text-sm text-champagne/80 font-light">{photo.caption}</p>
    </div>
  );
}

function VanGallery() {
  const [open, setOpen] = useState(null);
  const onClose = React.useCallback(() => setOpen(null), []);
  const onStep = React.useCallback((d) => setOpen((i) => (i + d + VAN_PHOTOS.length) % VAN_PHOTOS.length), []);
  const tiles = VAN_PHOTOS.map((p, i) => ({ ...p, i })).filter((p) => p.grid);
  return (
    <>
      <div className="mt-16 grid grid-cols-2 lg:grid-cols-12 auto-rows-[150px] sm:auto-rows-[200px] lg:auto-rows-[190px] gap-3 md:gap-4">
        {tiles.map((p, k) => (
          <Reveal key={p.src} delay={(k % 4) * 70} className={p.grid}>
            <button
              type="button"
              onClick={() => setOpen(p.i)}
              className="group relative block w-full h-full overflow-hidden rounded-2xl border hairline bg-charcoal/40"
              aria-label={`View photo: ${p.caption}`}
            >
              <img
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                style={p.pos ? { objectPosition: p.pos } : undefined}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-80 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              <span className="absolute left-4 bottom-3 right-4 text-left text-xs md:text-sm text-white/90 font-light tracking-wide">{p.caption}</span>
            </button>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => setOpen(0)} className="inline-flex items-center gap-2 text-sm text-champagne nav-link">
          View all {VAN_PHOTOS.length} photos <Icon d={icons.arrow} className="w-4 h-4" />
        </button>
      </div>
      {open !== null && <Lightbox index={open} onClose={onClose} onStep={onStep} />}
    </>
  );
}

function TheVan() {
  return (
    <section id="van" className="relative px-6 md:px-12 lg:px-16 py-24 md:py-32 ambient-gold">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-end">
          <div className="lg:col-span-7">
            <SectionHeader
              eyebrow="The Van"
              title={<>Most Sprinters are built for capacity.<br className="hidden md:block" /> <span className="font-serif italic text-champagne">This one was built for arrival.</span></>}
              intro="This isn’t a shuttle. Step inside and the city slows down: a starlit ceiling, quilted leather, a quiet cabin and room to breathe."
            />
          </div>
          <Reveal delay={150} className="lg:col-span-5">
            <div className="liquid-glass rounded-2xl p-6 md:p-8">
              <dl className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <dt className="text-[10px] tracking-[0.25em] uppercase text-champagne/50">Guests</dt>
                  <dd className="mt-2 text-3xl md:text-4xl font-light text-white">{BUSINESS.comfortable}–{BUSINESS.capacity}</dd>
                </div>
                <div className="border-x hairline">
                  <dt className="text-[10px] tracking-[0.25em] uppercase text-champagne/50">Private</dt>
                  <dd className="mt-2 text-3xl md:text-4xl font-light text-white">1 group</dd>
                </div>
                <div>
                  <dt className="text-[10px] tracking-[0.25em] uppercase text-champagne/50">From</dt>
                  <dd className="mt-2 text-3xl md:text-4xl font-light text-white">{money(RATES.vanShortDay + RATES.minHours * RATES.driverHourly)}</dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </div>

        <VanGallery />

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {VAN_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 80}>
              <article className="card rounded-2xl p-6 md:p-7 h-full">
                <div className="w-10 h-10 rounded-full border border-gold/40 text-gold flex items-center justify-center">
                  <Icon d={icons[f.icon]} />
                </div>
                <h3 className="mt-5 text-lg font-medium text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-champagne/65 font-light leading-relaxed">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Experiences ---------- */
const EXPERIENCES = [
  { tag: 'Nights Out', title: 'Nashville Nights & Bachelorettes', body: 'From pickup to Broadway, The Gulch and back. One vehicle, the whole crew, and a lounge between stops. When the van is the highlight of the night, you booked right.', occasion: 'Bachelorette / Night out', accent: 'from-neonred/25' },
  { tag: 'Weddings', title: 'Wedding Day Arrivals', body: 'Your wedding deserves more than a sedan. The bridal party arrives together, on time and photo-ready, with the door held open.', occasion: 'Wedding', accent: 'from-champagne/20' },
  { tag: 'Concerts & Events', title: 'Concerts, Games & Galas', body: 'Ryman, Bridgestone, Nissan Stadium. Dropped as close as the venue allows, and a pickup that’s waiting when the encore ends. No rideshare scramble.', occasion: 'Concert / Event', accent: 'from-amber/20' },
  { tag: 'Corporate', title: 'Roadshows & Executive Travel', body: 'Six stops, one vehicle, zero stress. A mobile meeting room with a privacy partition for clients, teams and visiting executives.', occasion: 'Corporate', accent: 'from-twilight/40' },
  { tag: 'BNA', title: 'Airport Transfers', body: 'Nashville International arrivals and departures. Tell us your flight and we plan the pickup around it, with room for the whole group.', occasion: 'Airport transfer', accent: 'from-platinum/15' },
  { tag: 'Discretion', title: 'Artists & Athletes', body: 'Discreet movement for talent, entourage and VIP guests. Tinted privacy, a quiet chauffeur, and we never say who rode with us.', occasion: 'VIP / Talent', accent: 'from-gold/25' },
  { tag: 'Out of Town', title: 'Nashville to Anywhere', body: 'Huntsville and other regional cities, day trips or overnight. Overnights add from ' + money(RATES.hotelPerNight) + ' a night for your chauffeur’s hotel and meals, confirmed in your quote. Nothing hidden.', occasion: 'Out-of-town trip', accent: 'from-sage/35' },
];

function Experiences({ onPick }) {
  return (
    <section id="experiences" className="relative px-6 md:px-12 lg:px-16 py-24 md:py-32 ambient-neon">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Experiences"
          title={<>It starts <span className="font-serif italic text-champagne">the moment the door opens.</span></>}
          intro="Whatever the occasion, the same promise: one vehicle, everyone together, and a chauffeur who treats your schedule like it matters."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {EXPERIENCES.map((e, i) => (
            <Reveal key={e.title} delay={(i % 4) * 90} className={i === 0 ? 'sm:col-span-2 lg:row-span-2' : i >= 5 ? 'lg:col-span-2' : ''}>
              <article className={`card group rounded-2xl p-6 md:p-7 h-full flex flex-col relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${e.accent} to-transparent opacity-60 pointer-events-none`} aria-hidden="true" />
                <div className="relative flex-1 flex flex-col">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-gold">{e.tag}</span>
                  <h3 className={`mt-4 font-normal text-white ${i === 0 ? 'text-3xl md:text-4xl' : 'text-xl'}`} style={{ letterSpacing: '-0.02em' }}>{e.title}</h3>
                  <p className={`mt-3 text-champagne/70 font-light leading-relaxed ${i === 0 ? 'text-base md:text-lg max-w-md' : 'text-sm'}`}>{e.body}</p>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => onPick(e.occasion)}
                    className="mt-6 self-start inline-flex items-center gap-2 text-sm text-champagne nav-link"
                  >
                    Plan this <Icon d={icons.arrow} className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Rates & estimator ---------- */
function Stepper({ label, value, min, max, onChange, suffix }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="field-label !mb-0">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className="stepper-btn" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Icon d={icons.minus} className="w-4 h-4" />
        </button>
        <span className="w-16 text-center text-lg font-light text-white" aria-live="polite">{value}{suffix ? ` ${suffix}` : ''}</span>
        <button type="button" className="stepper-btn" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          <Icon d={icons.plus} className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Rates({ trip, setTrip, onRequest }) {
  const est = useMemo(() => estimateTrip(trip), [trip]);
  const setDays = (n) => {
    const days = [...trip.days];
    while (days.length < n) days.push(days[days.length - 1] || 5);
    days.length = n;
    setTrip({ ...trip, days, nights: Math.min(trip.nights, n - 1) });
  };
  const setHours = (i, h) => {
    const days = [...trip.days];
    days[i] = h;
    setTrip({ ...trip, days });
  };

  const rateCards = [
    { k: 'Short service day', v: money(RATES.vanShortDay), s: `Maybach Sprinter, up to ${RATES.shortDayMaxHours} hours` },
    { k: 'Full service day', v: money(RATES.vanFullDay), s: `Maybach Sprinter, up to ${RATES.maxHours} hours (6 hours: ${money(RATES.vanSixHour)})` },
    { k: 'Chauffeur', v: money(RATES.driverHourly), s: `per hour, ${RATES.minHours}-hour minimum` },
    { k: 'Chauffeur hotel & meals', v: 'from ' + money(RATES.hotelPerNight), s: 'overnight trips, per night, confirmed in your quote' },
  ];

  return (
    <section id="rates" className="relative px-6 md:px-12 lg:px-16 py-24 md:py-32">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          eyebrow="Rates"
          title={<>Transparent pricing. <span className="font-serif italic text-champagne">No surprises.</span></>}
          intro="Our rates are simple: the vehicle, the chauffeur’s time, and estimated fuel. Build an estimate below, then send it to us for a confirmed quote."
        />

        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {rateCards.map((r, i) => (
            <Reveal key={r.k} delay={i * 80}>
              <div className="card rounded-2xl p-5 md:p-7 h-full">
                <div className="text-[10px] tracking-[0.25em] uppercase text-champagne/55">{r.k}</div>
                <div className="mt-3 text-3xl md:text-4xl font-light text-white" style={{ letterSpacing: '-0.03em' }}>{r.v}</div>
                <div className="mt-2 text-xs md:text-sm text-champagne/60 font-light">{r.s}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid lg:grid-cols-12 gap-5">
          {/* Estimator controls */}
          <Reveal className="lg:col-span-7">
            <div className="card rounded-2xl p-6 md:p-8 h-full">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-xl font-medium text-white">Trip estimator</h3>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_TRIPS.map((ex) => (
                    <button
                      key={ex.title}
                      type="button"
                      onClick={() => setTrip({ ...ex.trip, days: [...ex.trip.days] })}
                      className="text-xs px-3 py-1.5 rounded-full border border-white/15 text-champagne/80 hover:border-gold hover:text-gold transition-colors"
                    >
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <Stepper label="Service days" value={trip.days.length} min={1} max={RATES.maxDays} onChange={setDays} />

                {trip.days.map((h, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <label htmlFor={`hours-${i}`} className="field-label !mb-0">Day {i + 1} hours</label>
                      <span className="text-sm text-white font-light">{h} hrs · <span className="text-champagne/60">{vanTier(h).kind}</span></span>
                    </div>
                    <input
                      id={`hours-${i}`}
                      type="range"
                      min={RATES.minHours}
                      max={RATES.maxHours}
                      value={h}
                      onChange={(e) => setHours(i, Number(e.target.value))}
                      className="mt-3"
                    />
                  </div>
                ))}

                {trip.days.length > 1 && (
                  <Stepper label="Overnight stays" value={trip.nights} min={0} max={trip.days.length - 1} onChange={(n) => setTrip({ ...trip, nights: n })} />
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="miles" className="field-label !mb-0">Distance from Nashville (one way)</label>
                    <span className="text-sm text-white font-light">{trip.miles} mi</span>
                  </div>
                  <input id="miles" type="range" min={0} max={400} step={5} value={trip.miles} onChange={(e) => setTrip({ ...trip, miles: Number(e.target.value) })} className="mt-3" />
                  {/* Landmarks sit at their true position on the 0–400 mi track */}
                  <div className="mt-2 relative h-4 text-[11px] text-champagne/40 tracking-wide">
                    <span className="absolute left-0">Around town</span>
                    <span className="absolute -translate-x-1/2" style={{ left: `${(110 / 400) * 100}%` }}>│ Huntsville</span>
                    <span className="absolute right-0">400 mi</span>
                  </div>
                </div>

                <p className="text-xs text-champagne/55 font-light leading-relaxed">
                  Bookings start at {RATES.minHours} hours. Just a ride from the airport or to a venue? Transfers within
                  Nashville are a flat {money(RATES.transferFlat)}, gratuity included. Other short trips: email DJ at{' '}
                  <a className="text-gold nav-link" href={`mailto:${BUSINESS.email}?subject=${encodeURIComponent('Short trip rate')}`}>{BUSINESS.email}</a>{' '}
                  and he’ll quote a short-trip rate when the schedule allows.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Estimate summary */}
          <Reveal delay={120} className="lg:col-span-5">
            <div className="liquid-glass rounded-2xl p-6 md:p-8 h-full flex flex-col">
              <div className="text-[10px] tracking-[0.3em] uppercase text-gold">Your estimate</div>
              <div className="mt-3 text-5xl md:text-6xl font-light text-white" style={{ letterSpacing: '-0.04em' }} aria-live="polite">{money(est.total)}</div>
              <ul className="mt-6 space-y-2.5 text-sm">
                {est.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4 border-b hairline pb-2.5">
                    <span className="text-champagne/70 font-light">{l.label}</span>
                    <span className="text-white tabular-nums">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex-1" />
              <p className="mt-6 text-xs text-champagne/45 font-light leading-relaxed">
                An estimate, not a final quote. Fuel is estimated up front, parking and tolls are
                at cost, and we confirm the final price with you before anything is booked.
                A 50% deposit holds your date.
              </p>
              <button type="button" onClick={onRequest} className="cta-primary mt-6 px-6 py-3 rounded-lg text-sm font-medium tracking-wide inline-flex items-center justify-center gap-2">
                Request this quote <Icon d={icons.arrow} className="w-4 h-4" />
              </button>
            </div>
          </Reveal>
        </div>

        {/* Example trips */}
        <div className="mt-6 grid md:grid-cols-2 gap-5">
          {EXAMPLE_TRIPS.map((ex, i) => {
            const e = estimateTrip(ex.trip);
            return (
              <Reveal key={ex.title} delay={i * 100}>
                <div className="card rounded-2xl p-6 md:p-7 flex items-center justify-between gap-6">
                  <div>
                    <div className="text-[10px] tracking-[0.25em] uppercase text-champagne/50">Example trip</div>
                    <div className="mt-2 text-lg text-white">{ex.route}</div>
                    <div className="mt-1 text-sm text-champagne/60 font-light">{ex.detail}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-light text-white">{money(e.total)}</div>
                    <button type="button" onClick={() => setTrip({ ...ex.trip, days: [...ex.trip.days] })} className="mt-1 text-xs text-gold nav-link">Load in estimator</button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Booking terms */}
        <Reveal>
          <div id="terms" className="mt-6 card rounded-2xl p-6 md:p-8">
            <h3 className="text-xl font-medium text-white">Booking terms</h3>
            <dl className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5 text-sm">
              {TERMS.map((t) => (
                <div key={t.k}>
                  <dt className="text-[10px] tracking-[0.25em] uppercase text-gold">{t.k}</dt>
                  <dd className="mt-1.5 text-champagne/70 font-light leading-relaxed">{t.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Nashville ---------- */
const NEIGHBORHOODS = [
  { name: 'Broadway', note: 'Neon, honky-tonks, and a pickup that finds you.' },
  { name: 'The Gulch', note: 'Murals, rooftops, and energy you can’t fake.' },
  { name: 'Midtown', note: 'Where the locals go after Broadway.' },
  { name: 'East Nashville', note: 'Five Points, small stages, late kitchens.' },
  { name: '12South', note: 'Tree-lined, walkable, golden at sunset.' },
  { name: 'Germantown', note: 'Warehouse brick, chef-driven dinners.' },
  { name: 'Music Row & West End', note: 'Our home base, minutes from downtown.' },
  { name: 'BNA', note: 'Arrivals and departures, planned around your flight.' },
];

function Nashville() {
  return (
    <section id="nashville" className="relative px-6 md:px-12 lg:px-16 py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 120%, rgba(111,78,55,0.35), rgba(10,10,10,0) 70%)' }} />
      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeader
            eyebrow="Nashville"
            title={<>Broadway is the opening act. <span className="font-serif italic text-champagne">We’ll show you where Nashville lives.</span></>}
            intro="We know these streets: which entrance is quiet, where the line moves, and the route that skips the traffic. Ask us anything."
          />
          <Reveal delay={150}>
            <p className="mt-8 text-sm text-champagne/50 font-light">
              Serving Nashville and Middle Tennessee, with regional trips on request.
            </p>
          </Reveal>
        </div>
        <div className="lg:col-span-7">
          <ul className="grid sm:grid-cols-2 border-t hairline">
            {NEIGHBORHOODS.map((n, i) => (
              <Reveal as="li" key={n.name} delay={(i % 2) * 80} className={`border-b hairline py-6 ${i % 2 === 0 ? 'sm:pr-8' : 'sm:pl-8 sm:border-l'}`}>
                <div className="flex items-baseline gap-4">
                  <span className="text-xs text-gold tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-xl font-normal text-white" style={{ letterSpacing: '-0.02em' }}>{n.name}</h3>
                    <p className="mt-1 text-sm text-champagne/60 font-light">{n.note}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Promise ---------- */
const PROMISES = [
  { title: 'Privacy first', body: 'Your night is yours. We never show identifiable guests: no faces, no names, no tags, unless you ask us to.' },
  { title: 'Spotless, every time', body: 'Detailed inside and out before every booking.' },
  { title: 'One point of contact', body: 'A real person plans your route, timing and stops, from first message to final drop-off.' },
];

function PromiseSection() {
  return (
    <section className="relative px-6 md:px-12 lg:px-16 py-20 md:py-28 border-y hairline" style={{ background: 'linear-gradient(180deg, #0c0c0e, #0A0A0A)' }}>
      <div className="max-w-7xl mx-auto">
        <Reveal className="text-center max-w-3xl mx-auto">
          <span className="eyebrow">The Unison standard</span>
          <p className="mt-6 font-serif italic text-2xl md:text-4xl text-champagne leading-snug">
            “You’re not just getting a ride. You’re arriving.”
          </p>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-8 md:gap-10">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <div className="flex gap-4">
                <span className="mt-1 w-8 h-8 shrink-0 rounded-full border border-gold/40 text-gold flex items-center justify-center"><Icon d={icons.check} className="w-4 h-4" /></span>
                <div>
                  <h3 className="text-lg font-medium text-white">{p.title}</h3>
                  <p className="mt-2 text-sm text-champagne/65 font-light leading-relaxed">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Reserve / Concierge ---------- */
const OCCASIONS = ['Bachelorette / Night out', 'Wedding', 'Concert / Event', 'Corporate', 'Airport transfer', 'VIP / Talent', 'Out-of-town trip', 'Something else'];

function describeTrip(trip) {
  const est = estimateTrip(trip);
  const days = trip.days.map((h, i) => `Day ${i + 1}: ${h} hrs`).join(', ');
  return {
    summary: `${days}${trip.nights ? `, ${trip.nights} overnight` : ''}, ~${trip.miles} mi one way`,
    total: est.total,
    lines: est.lines,
  };
}

function Reserve({ trip, occasion, setOccasion, includeEstimate, setIncludeEstimate }) {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const tripInfo = describeTrip(trip);
  const [today, setToday] = useState(undefined);
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    data.occasion = occasion;
    if (includeEstimate) {
      data.estimate = { summary: tripInfo.summary, total: tripInfo.total, lines: tripInfo.lines };
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Something went wrong.');
      setStatus('sent');
      form.reset();
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Something went wrong.');
    }
  };

  return (
    <section id="reserve" className="relative px-6 md:px-12 lg:px-16 py-24 md:py-32 ambient-gold">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeader
            eyebrow="Concierge"
            title={<>This is the van. <span className="font-serif italic text-champagne">Where do you want to go?</span></>}
            intro="Tell us the date, the plan and the people. We reply with a confirmed quote."
          />
          <Reveal delay={120}>
            <ul className="mt-10 space-y-5 text-sm">
              <li>
                <a href={BUSINESS.phoneHref} className="flex items-center gap-4 nav-link text-white/90">
                  <span className="w-10 h-10 rounded-full border border-gold/40 text-gold flex items-center justify-center"><Icon d={icons.phone} className="w-4 h-4" /></span>
                  <span><span className="block text-[10px] tracking-[0.25em] uppercase text-champagne/50">Call</span>{BUSINESS.phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${BUSINESS.email}`} className="flex items-center gap-4 nav-link text-white/90 break-all">
                  <span className="w-10 h-10 shrink-0 rounded-full border border-gold/40 text-gold flex items-center justify-center"><Icon d={icons.mail} className="w-4 h-4" /></span>
                  <span><span className="block text-[10px] tracking-[0.25em] uppercase text-champagne/50">Email</span>{BUSINESS.email}</span>
                </a>
              </li>
              <li>
                <a href={BUSINESS.mapsHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 nav-link text-white/90">
                  <span className="w-10 h-10 shrink-0 rounded-full border border-gold/40 text-gold flex items-center justify-center"><Icon d={icons.pin} className="w-4 h-4" /></span>
                  <span><span className="block text-[10px] tracking-[0.25em] uppercase text-champagne/50">Office</span>{BUSINESS.street}, {BUSINESS.cityLine}</span>
                </a>
              </li>
            </ul>
            <p className="mt-8 text-sm text-champagne/55 font-light">
              Prefer to message? <a href={BUSINESS.socials[0].href} target="_blank" rel="noopener noreferrer" className="text-gold nav-link">DM us on Instagram</a>.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100} className="lg:col-span-7">
          <div className="liquid-glass rounded-2xl p-6 md:p-10">
            {status === 'sent' ? (
              <div className="py-16 text-center" role="status">
                <div className="mx-auto w-14 h-14 rounded-full border border-gold/50 text-gold flex items-center justify-center"><Icon d={icons.check} className="w-6 h-6" /></div>
                <h3 className="mt-6 text-2xl font-normal text-white">Request received.</h3>
                <p className="mt-3 text-champagne/70 font-light max-w-sm mx-auto">We’ll be in touch shortly with a confirmed quote. Need it sooner? Call <a className="text-gold" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>.</p>
                <button type="button" onClick={() => setStatus('idle')} className="mt-8 text-sm text-champagne nav-link">Send another request</button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-5" noValidate={false}>
                {/* Honeypot: hidden from people, tempting to bots */}
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="company_website">Leave this empty</label>
                  <input id="company_website" name="company_website" type="text" tabIndex={-1} autoComplete="off" />
                </div>

                <div>
                  <label htmlFor="name" className="field-label">Name</label>
                  <input id="name" name="name" required maxLength={120} autoComplete="name" className="field" placeholder="Your full name" />
                </div>
                <div>
                  <label htmlFor="phone" className="field-label">Phone</label>
                  <input id="phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" className="field" placeholder="(615) 555-0123" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="field-label">Email</label>
                  <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className="field" placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="occasion" className="field-label">Occasion</label>
                  <select id="occasion" name="occasion" className="field" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                    {OCCASIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="passengers" className="field-label">Passengers</label>
                  <select id="passengers" name="passengers" className="field" defaultValue="6">
                    {Array.from({ length: BUSINESS.capacity }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="date" className="field-label">Date</label>
                  <input id="date" name="date" type="date" required min={today} className="field" />
                </div>
                <div>
                  <label htmlFor="time" className="field-label">Pickup time</label>
                  <input id="time" name="time" type="time" className="field" />
                </div>
                <div>
                  <label htmlFor="pickup" className="field-label">Pickup</label>
                  <input id="pickup" name="pickup" maxLength={200} className="field" placeholder="Hotel, address or BNA" />
                </div>
                <div>
                  <label htmlFor="destination" className="field-label">Destination</label>
                  <input id="destination" name="destination" maxLength={200} className="field" placeholder="Venue, city or ‘a few stops’" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="field-label">The plan</label>
                  <textarea id="message" name="message" rows={4} maxLength={3000} className="field resize-y" placeholder="Stops, timing, special requests, anything we should know." />
                </div>

                <label className="sm:col-span-2 flex items-start gap-3 text-sm text-champagne/75 font-light cursor-pointer">
                  <input type="checkbox" checked={includeEstimate} onChange={(e) => setIncludeEstimate(e.target.checked)} className="mt-1 accent-[#D4AF37]" />
                  <span>
                    Include my estimate: <span className="text-white">{money(tripInfo.total)}</span>
                    <span className="text-champagne/50"> ({tripInfo.summary})</span>{' '}
                    <a href="#rates" className="text-gold nav-link whitespace-nowrap">Adjust</a>
                  </span>
                </label>

                {status === 'error' && (
                  <p className="sm:col-span-2 text-sm text-neonred" role="alert">
                    {error} You can also call <a className="underline" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a> or email <a className="underline" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
                  </p>
                )}

                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-champagne/45 font-light">We only use your details to reply to this request. <a href="/privacy" className="underline nav-link">Privacy policy</a></p>
                  <button type="submit" disabled={status === 'sending'} className="cta-primary px-8 py-3 rounded-lg text-sm font-medium tracking-wide">
                    {status === 'sending' ? 'Sending…' : 'Request a quote'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  const [year, setYear] = useState(BUILD_YEAR);
  useEffect(() => { setYear(new Date().getFullYear()); }, []);
  return (
    <footer className="px-6 md:px-12 lg:px-16 pt-16 pb-10 border-t hairline">
      <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>UNISON</span>
            <span className="text-[10px] font-light text-champagne/70 tracking-[0.28em] border-l border-white/15 pl-3">TRANSPORTATION</span>
          </div>
          <p className="mt-4 text-sm text-champagne/55 font-light max-w-sm">
            Chauffeured Mercedes-Maybach Sprinter service in Nashville, Tennessee. Private luxury, Nashville to anywhere.
          </p>
          <div className="mt-6 flex gap-3">
            {BUSINESS.socials.map((s) => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="text-xs px-4 py-2 rounded-full border border-white/15 text-champagne/80 hover:border-gold hover:text-gold transition-colors">
                {s.name}
              </a>
            ))}
          </div>
        </div>
        <div className="md:col-span-4 text-sm font-light">
          <div className="text-[10px] tracking-[0.3em] uppercase text-gold">Office</div>
          <address className="mt-4 not-italic text-champagne/70 leading-relaxed">
            Unison Transportation, LLC<br />
            {BUSINESS.street}<br />
            {BUSINESS.cityLine}
          </address>
        </div>
        <div className="md:col-span-3 text-sm font-light">
          <div className="text-[10px] tracking-[0.3em] uppercase text-gold">Contact</div>
          <ul className="mt-4 space-y-2 text-champagne/70">
            <li><a href={BUSINESS.phoneHref} className="nav-link">{BUSINESS.phoneDisplay}</a></li>
            <li><a href={`mailto:${BUSINESS.email}`} className="nav-link break-all">{BUSINESS.email}</a></li>
            <li><a href="#reserve" className="nav-link">Request a quote</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-14 pt-6 border-t hairline flex flex-wrap justify-between gap-4 text-[11px] tracking-[0.2em] uppercase text-champagne/35">
        <span>© {year} Unison Transportation, LLC</span>
        <span className="flex gap-6"><a href="/privacy" className="nav-link">Privacy</a><span>Nashville · Tennessee</span></span>
      </div>
    </footer>
  );
}

/* ---------- Mobile sticky call/reserve bar ---------- */
function MobileBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 p-3 transition-transform duration-500 ${show ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="liquid-glass rounded-xl p-2 flex gap-2" style={{ background: 'rgba(10,10,10,0.85)' }}>
        <a href={BUSINESS.phoneHref} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg border border-white/15 text-sm text-white">
          <Icon d={icons.phone} className="w-4 h-4" /> Call
        </a>
        <a href="#reserve" className="flex-1 cta-primary inline-flex items-center justify-center py-3 rounded-lg text-sm font-medium">Get a quote</a>
      </div>
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [trip, setTrip] = useState({ days: [5], nights: 0, miles: 15 });
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [includeEstimate, setIncludeEstimate] = useState(true);

  const goReserve = () => document.getElementById('reserve')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TheVan />
        <Experiences onPick={(o) => { setOccasion(o); goReserve(); }} />
        <Rates trip={trip} setTrip={setTrip} onRequest={() => { setIncludeEstimate(true); goReserve(); }} />
        <Nashville />
        <PromiseSection />
        <Reserve trip={trip} occasion={occasion} setOccasion={setOccasion} includeEstimate={includeEstimate} setIncludeEstimate={setIncludeEstimate} />
      </main>
      <Footer />
      <MobileBar />
    </>
  );
}
