import { Hero } from "../components/landing/Hero";
import { About } from "../components/landing/About";
import { Collection } from "../components/landing/Collection";
import { Cta } from "../components/landing/Cta";

/// Cinematic, space-themed landing: four full-bleed sections over looping video,
/// liquid-glass UI, Anton/Condiment type, a neon accent, and a film-grain overlay.
/// The TopNav/BottomNav are hidden on "/" so this reads as an immersive gateway;
/// every CTA routes into the gold app (lobby/arena/cup).
export default function Home() {
  return (
    <div className="relative bg-navy text-cream">
      <div className="grain-overlay" aria-hidden />
      <Hero />
      <About />
      <Collection />
      <Cta />
    </div>
  );
}
