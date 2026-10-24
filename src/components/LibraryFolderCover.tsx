import { useEffect, useRef, useState } from "react";

export function LibraryFolderCover({ src, name }: { src: string; name: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState<string>();

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setFrame((current) => current + 1);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const next = new Image();
    const url = `${src}&coverIndex=${frame}`;
    next.onload = () => { if (!cancelled) setLoadedSrc(url); };
    next.src = url;
    return () => { cancelled = true; next.onload = null; };
  }, [src, frame, visible]);

  return <img ref={imageRef} src={loadedSrc} alt={`Prévia de ${name}`} decoding="async"
    className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${loadedSrc ? "opacity-100" : "opacity-0"}`} />;
}