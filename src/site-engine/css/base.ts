// CSS de base (spec refonte 2.3) — exporté en constante TS afin d'être inliné
// dans le <style> des pages générées (aucun CDN, aucun fichier externe).

export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}
body{margin:0;font-family:var(--font-body);font-size:var(--font-size-base);line-height:var(--line-height-body);color:var(--color-text);background:var(--color-bg);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%;height:auto;display:block}
svg{display:inline-block;vertical-align:middle}
h1,h2,h3,h4,h5,h6{font-family:var(--font-heading);line-height:var(--line-height-heading);margin:0 0 var(--space-sm);font-weight:700;letter-spacing:-.01em}
h1{font-size:var(--font-size-h1)}
h2{font-size:var(--font-size-h2)}
h3{font-size:var(--font-size-h3)}
p{margin:0 0 var(--space-sm)}
p:last-child{margin-bottom:0}
a{color:var(--color-primary);text-decoration:none;transition:color var(--transition-fast)}
a:hover{text-decoration:underline}
ul,ol{margin:0;padding:0;list-style:none}
button{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--color-accent);outline-offset:2px;border-radius:var(--radius-sm)}
.container{width:100%;max-width:var(--container-max);margin-inline:auto;padding-inline:clamp(1rem,4vw,2rem)}
.container-narrow{max-width:var(--container-narrow)}
.section{padding:var(--section-padding)}
section[id]{scroll-margin-top:84px}
.section-head{max-width:720px;margin:0 auto var(--space-md);text-align:center}
.section-sub{color:color-mix(in srgb,var(--color-text) 70%,transparent);font-size:1.05rem;max-width:60ch;margin-inline:auto}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.skip-link{position:absolute;left:-9999px;top:0;z-index:1000;background:var(--color-primary);color:var(--color-text-light);padding:.75rem 1.25rem;border-radius:0 0 var(--radius-md) 0}
.skip-link:focus{left:0}
/* Révélation au scroll — activée uniquement si le JS a posé .has-js (sinon
   le contenu reste visible avec JS désactivé). */
html.has-js .reveal{opacity:0;transform:translateY(18px);transition:opacity .6s ease,transform .6s ease}
html.has-js .reveal.is-visible{opacity:1;transform:none}
html.has-js .hero-immersive [data-anim]{opacity:0;transform:translateY(22px);transition:opacity .7s ease,transform .7s ease}
html.has-js .hero-immersive [data-anim].is-visible{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){
  html.has-js .reveal,
  html.has-js .hero-immersive [data-anim]{opacity:1!important;transform:none!important;transition:none!important}
}
/* Dégradés de repli quand une image ne charge pas (onerror masque l'img). */
.hero-media,.hero-bg,.about-media,.gallery-item{background:linear-gradient(135deg,color-mix(in srgb,var(--color-primary) 82%,#000) 0%,var(--color-primary) 45%,var(--color-accent) 100%)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.85rem 1.6rem;border-radius:var(--radius-full);font-family:var(--font-heading);font-weight:700;font-size:.95rem;letter-spacing:.01em;line-height:1;border:2px solid transparent;cursor:pointer;transition:transform var(--transition-fast),box-shadow var(--transition-fast),background-color var(--transition-fast),border-color var(--transition-fast);text-decoration:none;white-space:nowrap}
.btn:hover{text-decoration:none;transform:translateY(-2px)}
.btn:active{transform:translateY(0)}
.btn-accent{background:var(--color-accent-ui,var(--color-accent));color:var(--color-on-accent,#fff);box-shadow:var(--shadow-md)}
.btn-accent:hover{background:var(--color-accent-ui,var(--color-accent));color:var(--color-on-accent,#fff);box-shadow:var(--shadow-lg)}
.btn-primary{background:var(--color-primary);color:var(--color-text-light);box-shadow:var(--shadow-md)}
.btn-primary:hover{background:color-mix(in srgb,var(--color-primary) 85%,#000);color:var(--color-text-light);box-shadow:var(--shadow-lg)}
.btn-ghost{border-color:color-mix(in srgb,var(--color-text) 25%,transparent);color:var(--color-text);background:transparent}
.btn-ghost:hover{border-color:var(--color-text);background:color-mix(in srgb,var(--color-text) 5%,transparent)}
.btn-glass{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.45);color:#fff;backdrop-filter:blur(8px)}
.btn-glass:hover{background:rgba(255,255,255,.26);color:#fff}
.btn-block{width:100%}
@media (prefers-reduced-motion: reduce){.btn:hover{transform:none}}
`;
