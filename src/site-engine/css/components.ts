// Styles des composants (spec refonte 2.3) — mobile-first, breakpoints
// 640 / 768 / 1024 px, tokens du thème (generate-theme.ts).

export const COMPONENTS_CSS = `
/* ===== Header ===== */
.site-header{position:sticky;top:0;z-index:100;background:color-mix(in srgb,var(--color-bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid color-mix(in srgb,var(--color-text) 8%,transparent)}
.header-inner{display:flex;align-items:center;gap:1rem;min-height:68px;position:relative}
.brand{font-family:var(--font-heading);font-weight:800;font-size:1.15rem;color:var(--color-text);text-decoration:none;white-space:nowrap;z-index:2}
.brand:hover{text-decoration:none;color:var(--color-primary)}
.nav-toggle{position:absolute;opacity:0;pointer-events:none}
.nav-burger{display:flex;flex-direction:column;justify-content:center;gap:5px;margin-inline-start:auto;width:44px;height:44px;padding:10px;cursor:pointer;border-radius:var(--radius-sm)}
.burger-line{display:block;width:22px;height:2px;background:var(--color-text);transition:transform var(--transition-fast),opacity var(--transition-fast)}
.nav-toggle:checked~.nav-burger .burger-line:nth-last-of-type(3){transform:translateY(7px) rotate(45deg)}
.nav-toggle:checked~.nav-burger .burger-line:nth-last-of-type(2){opacity:0}
.nav-toggle:checked~.nav-burger .burger-line:nth-last-of-type(1){transform:translateY(-7px) rotate(-45deg)}
.site-nav{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;background:var(--color-bg);border-bottom:1px solid color-mix(in srgb,var(--color-text) 10%,transparent);box-shadow:var(--shadow-lg);padding:.5rem 1rem 1rem}
.site-nav a{display:block;padding:.8rem .5rem;font-weight:600;color:var(--color-text);border-radius:var(--radius-sm)}
.site-nav a:hover{background:color-mix(in srgb,var(--color-primary) 7%,transparent);text-decoration:none}
.nav-toggle:checked~.site-nav{display:flex}
.header-cta{display:none}
@media (min-width:900px){
  .nav-burger{display:none}
  .site-nav{position:static;display:flex;flex-direction:row;align-items:center;gap:.25rem;margin-inline-start:auto;background:transparent;border:0;box-shadow:none;padding:0}
  .site-nav a{padding:.5rem .75rem;font-size:.95rem;color:color-mix(in srgb,var(--color-text) 82%,transparent)}
  .site-nav a:hover{background:transparent;color:var(--color-primary)}
  .header-cta{display:inline-flex;padding:.65rem 1.15rem;font-size:.9rem}
}

/* ===== Hero ===== */
.hero{position:relative;overflow:hidden}
.hero h1{max-width:20ch}
.hero-sub{font-size:clamp(1.05rem,1rem + .4vw,1.25rem);color:color-mix(in srgb,var(--color-text) 74%,transparent);max-width:56ch;margin-bottom:var(--space-md)}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:var(--space-md)}
.chips li{background:color-mix(in srgb,var(--color-primary) 8%,transparent);border:1px solid color-mix(in srgb,var(--color-primary) 22%,transparent);color:var(--color-primary);font-weight:600;font-size:.85rem;padding:.4rem .9rem;border-radius:var(--radius-full)}
.chips-center{justify-content:center}
.hero-actions{display:flex;flex-wrap:wrap;gap:.75rem}
.hero-split{padding:clamp(2.5rem,6vw,5rem) 0}
.hero-split .hero-grid{display:grid;gap:var(--space-lg);align-items:center}
.hero-media{border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);aspect-ratio:4/3;display:flex;align-items:stretch;justify-content:stretch}
.hero-media img{width:100%;height:100%;object-fit:cover}
@media (min-width:900px){.hero-split .hero-grid{grid-template-columns:1.05fr .95fr}}
.hero-centered{padding:clamp(3rem,8vw,6rem) 0;background:linear-gradient(180deg,color-mix(in srgb,var(--color-primary) 7%,var(--color-bg)) 0%,var(--color-bg) 100%);text-align:center}
.hero-centered .hero-sub,.hero-centered h1{margin-inline:auto}
.hero-kicker{text-transform:uppercase;letter-spacing:.14em;font-weight:700;font-size:.8rem;color:var(--color-accent);margin-bottom:var(--space-sm)}
.hero-centered-inner{display:flex;flex-direction:column;align-items:center}
.hero-fullwidth{min-height:76vh;display:flex;align-items:center;color:#fff}
.hero-bg{position:absolute;inset:0;z-index:0}
.hero-bg img{width:100%;height:100%;object-fit:cover}
.hero-overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.38) 0%,rgba(0,0,0,.62) 100%)}
.hero-fullwidth-inner{position:relative;z-index:2;text-align:center;padding-block:var(--space-xl)}
.hero-fullwidth h1,.hero-fullwidth .hero-sub{margin-inline:auto}
.hero-fullwidth .hero-sub{color:rgba(255,255,255,.88)}
.hero-fullwidth .chips li{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.4);color:#fff}
.hero-minimal{padding:clamp(2rem,5vw,4rem) 0;border-bottom:1px solid color-mix(in srgb,var(--color-text) 8%,transparent)}

/* ===== Sections services ===== */
.services-grid{display:grid;gap:1rem}
.service-card{position:relative;background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 8%,transparent);border-radius:var(--radius-md);padding:1.5rem;box-shadow:var(--shadow-sm);transition:transform var(--transition-base),box-shadow var(--transition-base);display:flex;flex-direction:column;gap:.6rem;align-items:flex-start}
.service-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg)}
.service-card h3{margin:0;font-size:1.1rem}
.service-card h3 a{color:var(--color-text)}
.service-card h3 a:hover{color:var(--color-primary);text-decoration:none}
.service-card p{color:color-mix(in srgb,var(--color-text) 72%,transparent);font-size:.94rem;margin:0}
.icon-badge{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:var(--radius-md);background:linear-gradient(135deg,var(--color-primary),var(--color-accent));color:#fff;font-family:var(--font-heading);font-weight:800;font-size:1.15rem;box-shadow:var(--shadow-sm);flex-shrink:0}
.service-arrow{position:absolute;right:1.25rem;bottom:1.1rem;font-size:1.2rem;color:var(--color-accent);transition:transform var(--transition-fast)}
.service-card:hover .service-arrow{transform:translateX(4px)}
@media (min-width:640px){.services-grid-3,.services-grid-2{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1024px){.services-grid-3{grid-template-columns:repeat(3,1fr)}}
.services-list{display:grid;gap:0}
.services-list-item{display:flex;gap:1.25rem;align-items:flex-start;padding:1.35rem 0;border-bottom:1px solid color-mix(in srgb,var(--color-text) 10%,transparent)}
.services-list-num{font-family:var(--font-heading);font-weight:800;color:var(--color-accent);font-size:1rem;min-width:2.4rem;padding-top:.2rem}
.services-list-item h3{margin:0 0 .25rem;font-size:1.1rem}
.services-list-item h3 a{color:var(--color-text)}
.services-list-item p{margin:0;color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:.95rem}
.services-h{display:grid;gap:1rem}
.service-h-card{position:relative;display:flex;align-items:center;gap:1.1rem;background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 8%,transparent);border-radius:var(--radius-md);padding:1.25rem 3rem 1.25rem 1.25rem;box-shadow:var(--shadow-sm);transition:box-shadow var(--transition-base),transform var(--transition-base)}
.service-h-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-3px)}
.service-h-body h3{margin:0 0 .2rem;font-size:1.05rem}
.service-h-body h3 a{color:var(--color-text)}
.service-h-body p{margin:0;color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:.92rem}
@media (min-width:1024px){.services-h{grid-template-columns:repeat(2,1fr)}}

/* ===== Process ===== */
.timeline{position:relative;display:grid;gap:var(--space-md);max-width:760px;margin-inline:auto;padding-inline-start:1.5rem;border-inline-start:2px solid color-mix(in srgb,var(--color-primary) 25%,transparent)}
.timeline-step{position:relative}
.timeline-dot{position:absolute;left:-2.35rem;top:.15rem;width:1.65rem;height:1.65rem;border-radius:var(--radius-full);background:var(--color-primary);color:var(--color-text-light);font-weight:700;font-size:.8rem;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px color-mix(in srgb,var(--color-primary) 15%,transparent)}
.timeline-body h3{margin:0 0 .25rem;font-size:1.1rem}
.timeline-body p{margin:0;color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:.95rem}
.process-numbered{display:grid;gap:1rem}
.process-card{background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 8%,transparent);border-radius:var(--radius-md);padding:1.5rem;box-shadow:var(--shadow-sm)}
.process-num{display:block;font-family:var(--font-heading);font-weight:800;font-size:2rem;color:color-mix(in srgb,var(--color-accent) 80%,var(--color-text));margin-bottom:.5rem}
.process-card h3{margin:0 0 .3rem;font-size:1.05rem}
.process-card p{margin:0;color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:.94rem}
@media (min-width:768px){.process-numbered{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1024px){.process-numbered{grid-template-columns:repeat(3,1fr)}}
.process-icons{display:grid;gap:1.5rem;text-align:center}
.process-icon{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:var(--radius-full);background:linear-gradient(135deg,var(--color-primary),var(--color-accent));color:#fff;font-family:var(--font-heading);font-weight:800;font-size:1.2rem;margin-bottom:.75rem;box-shadow:var(--shadow-md)}
.process-icon-step h3{margin:0 0 .25rem;font-size:1.05rem}
.process-icon-step p{margin:0;color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:.92rem}
@media (min-width:768px){.process-icons{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1024px){.process-icons{grid-template-columns:repeat(4,1fr)}}

/* ===== About ===== */
.about-grid{display:grid;gap:var(--space-lg);align-items:center}
.about-media{border-radius:var(--radius-lg);overflow:hidden;aspect-ratio:4/3;box-shadow:var(--shadow-lg)}
.about-media img{width:100%;height:100%;object-fit:cover}
.para{color:color-mix(in srgb,var(--color-text) 78%,transparent);max-width:64ch}
.highlights{display:flex;flex-wrap:wrap;gap:var(--space-md);margin-top:var(--space-md)}
.highlight{display:flex;flex-direction:column;gap:.15rem;padding-inline-start:1rem;border-inline-start:3px solid var(--color-accent)}
.highlight-value{font-family:var(--font-heading);font-weight:800;font-size:1.7rem;color:var(--color-primary);line-height:1}
.highlight-label{font-size:.88rem;color:color-mix(in srgb,var(--color-text) 65%,transparent)}
@media (min-width:900px){.about-grid{grid-template-columns:1.05fr .95fr}}

/* ===== FAQ ===== */
.faq-list{display:grid;gap:.75rem}
.faq-item{background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 9%,transparent);border-radius:var(--radius-md);padding:0;overflow:hidden;box-shadow:var(--shadow-sm)}
.faq-item summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1.1rem 1.25rem;font-weight:700;font-family:var(--font-heading)}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:"+";font-size:1.35rem;color:var(--color-accent);line-height:1;transition:transform var(--transition-fast)}
.faq-item[open] summary::after{transform:rotate(45deg)}
.faq-item p{padding:0 1.25rem 1.2rem;margin:0;color:color-mix(in srgb,var(--color-text) 74%,transparent)}

/* ===== Testimonials ===== */
.testimonials-grid{display:grid;gap:1rem}
.testimonial-card{margin:0;background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 8%,transparent);border-radius:var(--radius-md);padding:1.5rem;box-shadow:var(--shadow-sm);display:flex;flex-direction:column;gap:.75rem}
.stars{color:var(--color-accent);font-size:1rem;letter-spacing:.08em}
.stars-dim{color:color-mix(in srgb,var(--color-text) 18%,transparent)}
.testimonial-card blockquote{margin:0}
.testimonial-card blockquote p{margin:0;color:color-mix(in srgb,var(--color-text) 80%,transparent);font-size:.98rem}
.testimonial-card figcaption{display:flex;flex-direction:column;gap:.1rem;margin-top:auto}
.testimonial-name{font-weight:700;font-family:var(--font-heading);font-size:.95rem}
.testimonial-role{font-size:.85rem;color:color-mix(in srgb,var(--color-text) 60%,transparent)}
@media (min-width:768px){.testimonials-grid{grid-template-columns:repeat(2,1fr)}}
@media (min-width:1024px){.testimonials-grid{grid-template-columns:repeat(3,1fr)}}

/* ===== Gallery ===== */
.gallery-item{position:relative;margin:0;border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-sm)}
.gallery-item img{width:100%;height:100%;object-fit:cover;transition:transform var(--transition-slow)}
.gallery-item:hover img{transform:scale(1.04)}
.gallery-item figcaption{position:absolute;inset-inline:0;bottom:0;padding:2.2rem .9rem .7rem;color:#fff;font-size:.85rem;font-weight:600;background:linear-gradient(180deg,transparent,rgba(0,0,0,.66))}
.gallery-masonry{columns:2;column-gap:.8rem}
.gallery-masonry-item{break-inside:avoid;margin-bottom:.8rem;aspect-ratio:1/1}
.gallery-masonry-item:nth-child(3n+2){aspect-ratio:4/5}
.gallery-grid-2x2{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.gallery-grid-2x2 .gallery-item{aspect-ratio:1/1}
.gallery-slider{display:flex;gap:.8rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.5rem;-webkit-overflow-scrolling:touch}
.gallery-slider .gallery-item{flex:0 0 78%;scroll-snap-align:start;aspect-ratio:4/3}
.gallery-full{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.gallery-full .gallery-item{aspect-ratio:16/10}
@media (min-width:768px){.gallery-masonry{columns:3}}
@media (min-width:1024px){.gallery-masonry{columns:4}.gallery-slider .gallery-item{flex-basis:38%}}

/* ===== Contact ===== */
.contact-grid{display:grid;gap:var(--space-lg)}
.contact-line{color:color-mix(in srgb,var(--color-text) 78%,transparent);margin-bottom:.6rem}
.contact-map{margin-top:var(--space-md);border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-md)}
.contact-map iframe{width:100%;height:280px;border:0;display:block}
.contact-form{display:grid;gap:1rem;background:color-mix(in srgb,var(--color-bg) 55%,#fff);border:1px solid color-mix(in srgb,var(--color-text) 8%,transparent);border-radius:var(--radius-lg);padding:clamp(1.25rem,3vw,2rem);box-shadow:var(--shadow-md)}
.form-field{display:flex;flex-direction:column;gap:.35rem;font-size:.9rem;font-weight:600}
.form-field input,.form-field textarea,.form-field select{width:100%;padding:.75rem .9rem;border:1px solid color-mix(in srgb,var(--color-text) 18%,transparent);border-radius:var(--radius-sm);background:#fff;font:inherit;font-weight:400;color:var(--color-text);transition:border-color var(--transition-fast),box-shadow var(--transition-fast)}
.form-field input:focus,.form-field textarea:focus,.form-field select:focus{outline:none;border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--color-primary) 18%,transparent)}
.form-field-full{grid-column:1/-1}
.hp-field{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;overflow:hidden}
@media (min-width:768px){.contact-form{grid-template-columns:repeat(2,1fr)}.contact-form .btn,.contact-form .form-field-full{grid-column:1/-1}}
@media (min-width:900px){.contact-grid{grid-template-columns:.95fr 1.05fr;align-items:start}}

/* ===== Trust ===== */
.trust-title{text-align:center;text-transform:uppercase;letter-spacing:.12em;font-size:.8rem;font-weight:700;color:color-mix(in srgb,var(--color-text) 60%,transparent);margin-bottom:var(--space-sm)}
.trust-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;text-align:center;padding:var(--space-md) 0}
.trust-item{display:flex;flex-direction:column;gap:.2rem}
.trust-value{font-family:var(--font-heading);font-weight:800;font-size:1.6rem;color:var(--color-primary);line-height:1}
.trust-label{font-size:.85rem;color:color-mix(in srgb,var(--color-text) 65%,transparent)}

/* ===== Footer ===== */
.site-footer{margin-top:var(--space-xl);background:color-mix(in srgb,var(--color-text) 94%,#000);color:color-mix(in srgb,var(--color-text-light) 88%,transparent);padding-top:var(--space-lg)}
.footer-grid{display:grid;gap:var(--space-md);padding-bottom:var(--space-lg)}
.footer-brand{font-family:var(--font-heading);font-weight:800;font-size:1.25rem;color:#fff;margin-bottom:.4rem}
.footer-tagline{font-size:.92rem;color:color-mix(in srgb,var(--color-text-light) 65%,transparent)}
.site-footer h4{color:#fff;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.6rem}
.site-footer p,.site-footer a{color:color-mix(in srgb,var(--color-text-light) 78%,transparent);font-size:.92rem;line-height:1.7}
.site-footer a:hover{color:var(--color-accent)}
.footer-hours{white-space:pre-line}
.footer-bottom{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:space-between;align-items:center;padding-block:1.1rem;border-top:1px solid color-mix(in srgb,var(--color-text-light) 14%,transparent);font-size:.85rem}
.footer-bottom p{color:color-mix(in srgb,var(--color-text-light) 55%,transparent)}
@media (min-width:768px){.footer-grid{grid-template-columns:2fr 1fr 1fr 1fr}}

/* ===== Mobile bar ===== */
.mobile-bar{position:fixed;inset-inline:0;bottom:0;z-index:200;display:flex;gap:.6rem;padding:.55rem .8rem calc(.55rem + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--color-bg) 94%,transparent);backdrop-filter:blur(10px);border-top:1px solid color-mix(in srgb,var(--color-text) 10%,transparent)}
.mbar-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:.45rem;padding:.8rem .5rem;border-radius:var(--radius-full);font-weight:700;font-size:.92rem;color:#fff;text-decoration:none}
.mbar-btn:hover{text-decoration:none;opacity:.92}
.mbar-call{background:var(--color-primary)}
.mbar-wa{background:#1f9d55}
.mbar-contact{background:var(--color-accent)}
body{padding-bottom:calc(64px + env(safe-area-inset-bottom))}
@media (min-width:900px){.mobile-bar{display:none}body{padding-bottom:0}}
`;
