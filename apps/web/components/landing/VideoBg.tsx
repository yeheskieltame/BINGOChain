/// Full-bleed autoplaying background video for the cinematic landing sections.
/// `cover` fills + crops the section; without it the video shows at native size.
export function VideoBg({ src, cover = true, className = "" }: { src: string; cover?: boolean; className?: string }) {
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className={cover ? `absolute inset-0 h-full w-full object-cover ${className}` : `block h-auto w-full ${className}`}
    />
  );
}
