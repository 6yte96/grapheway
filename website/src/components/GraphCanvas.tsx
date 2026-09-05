"use client";

import { useEffect, useRef } from "react";

/**
 * GraphCanvas: a quiet, slowly drifting knowledge graph painted on the
 * page-wide background, behind everything. Ink lines on paper, nodes and
 * edges with occasional traversal pulses, in the spirit of the project
 * itself.
 *
 * Mounted once in the root layout. The canvas is fixed to the viewport;
 * the graph scrolls subtly with the document (parallax) so the page
 * feels like it moves over a larger graph.
 *
 * Behavior:
 * - Nodes drift gently; edges connect nearby nodes (proximity graph)
 * - A pulse occasionally travels along an edge, like an agent walking the graph
 * - Respects prefers-reduced-motion: static render, no drift, no pulses
 * - DPR-aware, resizes with the viewport, pauses when the tab is hidden
 */
export function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;
    const canvasEl = canvas;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let running = true;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Node = {
      x: number; y: number;
      vx: number; vy: number;
      r: number;
    };
    type Pulse = { a: Node; b: Node; t: number; speed: number };

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];

    // counts scale with area, capped so phones stay cheap
    function populate() {
      const area = width * height;
      const count = Math.max(14, Math.min(46, Math.round(area / 26000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 1.2 + Math.random() * 1.8,
      }));
      pulses = [];
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      populate();
    }

    function palette() {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        ink: isDark ? "242, 248, 252" : "0, 0, 0",
        edgeAlpha: isDark ? 0.09 : 0.08,
        nodeAlpha: isDark ? 0.26 : 0.28,
        pulseAlpha: isDark ? 0.5 : 0.45,
      };
    }

    function linkDistance() {
      return Math.min(190, Math.max(120, width / 8));
    }

    function step() {
      const p = palette();
      const link = linkDistance();

      // drift
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // spawn a traversal pulse occasionally
      if (!reduced && pulses.length < 2 && Math.random() < 0.006) {
        const a = nodes[Math.floor(Math.random() * nodes.length)];
        let best: Node | null = null;
        let bestD = Infinity;
        for (const b of nodes) {
          if (b === a) continue;
          const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d < bestD && d < link * link) {
            bestD = d;
            best = b;
          }
        }
        if (best) pulses.push({ a, b: best, t: 0, speed: 0.010 + Math.random() * 0.012 });
      }

      // advance pulses
      pulses = pulses.filter((pu) => (pu.t += pu.speed) <= 1);

      return { p, link };
    }

    function draw() {
      const { p, link } = running || reduced ? step() : { p: palette(), link: linkDistance() };
      g.clearRect(0, 0, width, height);

      // paper first: the canvas carries the page background itself so
      // no element's background can ever paint over the graph
      const isDark = document.documentElement.classList.contains("dark");
      g.fillStyle = isDark ? "#24221f" : "#F2F8FC";
      g.fillRect(0, 0, width, height);

      // edges
      g.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > link) continue;
          const alpha = p.edgeAlpha * (1 - d / link);
          g.strokeStyle = `rgba(${p.ink}, ${alpha})`;
          g.beginPath();
          g.moveTo(a.x, a.y);
          g.lineTo(b.x, b.y);
          g.stroke();
        }
      }

      // nodes
      for (const n of nodes) {
        g.fillStyle = `rgba(${p.ink}, ${p.nodeAlpha})`;
        g.beginPath();
        g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        g.fill();
      }

      // pulses: a dot traveling along an edge, with a fading tail
      for (const pu of pulses) {
        const t = pu.t;
        const x = pu.a.x + (pu.b.x - pu.a.x) * t;
        const y = pu.a.y + (pu.b.y - pu.a.y) * t;

        g.strokeStyle = `rgba(${p.ink}, ${p.pulseAlpha * 0.5})`;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(pu.a.x + (pu.b.x - pu.a.x) * Math.max(0, t - 0.12), pu.a.y + (pu.b.y - pu.a.y) * Math.max(0, t - 0.12));
        g.lineTo(x, y);
        g.stroke();

        g.fillStyle = `rgba(${p.ink}, ${p.pulseAlpha})`;
        g.beginPath();
        g.arc(x, y, 2.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    function frame() {
      if (running) draw();
      raf = requestAnimationFrame(frame);
    }

    resize();

    if (reduced) {
      // single static render, no animation loop
      draw();
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reduced) draw();
    };
    window.addEventListener("resize", onResize);

    // pause when the tab is hidden
    const onVisibility = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="page-graph-canvas"
      aria-hidden="true"
    />
  );
}
