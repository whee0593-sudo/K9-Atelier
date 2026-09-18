"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#C4A882", "#C8B8D8", "#A8C4D4", "#9B7648", "#FAF7F2", "#D8D0DD"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  life: number;
};

export function BookingConfetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.scale(dpr, dpr);

    const particles: Particle[] = Array.from({ length: 140 }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.3,
      vx: (Math.random() - 0.5) * 6,
      vy: 4 + Math.random() * 6,
      size: 6 + Math.random() * 8,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#C4A882",
      life: 1,
    }));

    let raf = 0;
    const start = performance.now();

    function draw(now: number) {
      if (!context) return;
      const elapsed = now - start;
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.08;
        particle.rotation += particle.rotationSpeed;
        particle.life = Math.max(0, 1 - elapsed / 2800);
        context.save();
        context.globalAlpha = particle.life;
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
        context.restore();
      }
      if (elapsed < 3000) {
        raf = window.requestAnimationFrame(draw);
      } else {
        context.clearRect(0, 0, width, height);
      }
    }

    raf = window.requestAnimationFrame(draw);
    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[80]"
    />
  );
}
