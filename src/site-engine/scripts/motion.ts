// Script inline des pages DesignSpec : GSAP + ScrollTrigger depuis le CDN,
// avec repli immédiat (contenu visible) si le CDN ou l'API manque. Aucun pin,
// aucun scroll-jacking, aucune dépendance au réseau pour le contenu.

export const MOTION_SCRIPT = `(function(){
var d=document,root=d.documentElement;
root.classList.add("has-js");
var all=d.querySelectorAll(".reveal,[data-anim]");
var revealed=false;
function revealAll(){for(var i=0;i<all.length;i++)all[i].classList.add("is-visible");revealed=true;}
var header=d.querySelector(".site-header");
function headerState(){if(!header)return;var y=window.scrollY||window.pageYOffset||0;if(y>24)header.classList.add("is-scrolled");else header.classList.remove("is-scrolled");}
headerState();
window.addEventListener("scroll",headerState,{passive:true});
var reduce=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
if(reduce){revealAll();return;}
var fallback=setTimeout(revealAll,2500);
function start(){
clearTimeout(fallback);
if(revealed)return;
var gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;
if(!gsap||!ScrollTrigger){revealAll();return;}
try{
gsap.registerPlugin(ScrollTrigger);
var mode=root.getAttribute("data-motion")||"balanced";
var conf=mode==="expressive"?{y:52,dur:.95,stagger:.11}:mode==="subtle"?{y:18,dur:.65,stagger:.055}:{y:32,dur:.82,stagger:.08};
var hero=d.querySelector(".hero-immersive");
var heroItems=hero?hero.querySelectorAll("[data-anim]"):[];
if(heroItems.length){
for(var h=0;h<heroItems.length;h++)heroItems[h].classList.add("is-visible");
gsap.from(heroItems,{y:conf.y,opacity:0,duration:conf.dur,ease:"power3.out",stagger:conf.stagger,clearProps:"transform,opacity"});
}
var heroImg=hero?hero.querySelector(".hero-immersive-media img"):null;
if(heroImg&&window.innerWidth>767&&mode!=="subtle"){
gsap.to(heroImg,{yPercent:6,ease:"none",scrollTrigger:{trigger:hero,start:"top top",end:"bottom top",scrub:true}});
}
ScrollTrigger.batch(".reveal:not([data-anim])",{
start:"top 88%",
once:true,
onEnter:function(batch){
for(var i=0;i<batch.length;i++)batch[i].classList.add("is-visible");
gsap.from(batch,{y:conf.y,opacity:0,duration:conf.dur,ease:"power2.out",stagger:conf.stagger,clearProps:"transform,opacity",overwrite:true});
}
});
ScrollTrigger.batch(".service-card:not(.reveal),.process-card:not(.reveal),.testimonial-card:not(.reveal),.gallery-item:not(.reveal)",{
start:"top 90%",
once:true,
onEnter:function(batch){
gsap.from(batch,{y:conf.y*0.55,opacity:0,duration:conf.dur*0.8,ease:"power2.out",stagger:conf.stagger*0.6,clearProps:"transform,opacity",overwrite:true});
}
});
ScrollTrigger.refresh();
window.addEventListener("load",function(){ScrollTrigger.refresh();},{once:true});
}catch(e){revealAll();}
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();`;
