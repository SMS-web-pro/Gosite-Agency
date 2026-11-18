// Script inline des pages générées : marque la page comme JS-enabled (sinon
// le contenu .reveal reste visible) puis révèle les blocs au scroll.
// Zéro dépendance, compatible prefers-reduced-motion (CSS gère l'absence
// d'animation), et fallback immédiat sans IntersectionObserver.

export const REVEAL_SCRIPT = `(function(){var d=document;d.documentElement.classList.add("has-js");var els=d.querySelectorAll(".reveal");if(!els.length)return;if(!("IntersectionObserver"in window)){for(var i=0;i<els.length;i++)els[i].classList.add("is-visible");return;}var io=new IntersectionObserver(function(entries){for(var j=0;j<entries.length;j++){var e=entries[j];if(e.isIntersecting){e.target.classList.add("is-visible");io.unobserve(e.target);}}},{threshold:0.12,rootMargin:"0px 0px -40px 0px"});for(var k=0;k<els.length;k++)io.observe(els[k]);})();`;
