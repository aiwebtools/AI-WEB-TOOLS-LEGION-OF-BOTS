import { useEffect, useRef } from "react";

export default function MatrixRain({ className = "", opacity = 0.4 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, w, h, cols, drops;
    const chars = "アイウエオカキクケコ01ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/{}#$".split("");
    const font = 14;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      cols = Math.floor(w / font);
      drops = Array(cols).fill(1).map(() => Math.random() * -50);
    };
    resize();
    window.addEventListener("resize", resize);

    let last = 0;
    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 55) return;
      last = t;
      ctx.fillStyle = "rgba(5,5,5,0.09)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#00FF41";
      ctx.font = `${font}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * font;
        const y = drops[i] * font;
        ctx.fillStyle = Math.random() > 0.975 ? "#c6ffcf" : "#00FF41";
        ctx.fillText(text, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className={className} style={{ opacity }} data-testid="matrix-rain" />;
}
