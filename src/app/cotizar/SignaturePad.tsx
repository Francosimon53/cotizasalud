"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  onSignature: (dataUrl: string) => void;
  onClear: () => void;
  label: string;
  hint: string;
  clearLabel: string;
}

export default function SignaturePad({ onSignature, onClear, label, hint, clearLabel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return null;
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas for retina
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1E293B";

    let isDown = false;

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDown = true;
      const pos = getPos(e);
      if (pos) { ctx.beginPath(); ctx.moveTo(pos.x / dpr, pos.y / dpr); }
    };

    const move = (e: MouseEvent | TouchEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const pos = getPos(e);
      if (pos) { ctx.lineTo(pos.x / dpr, pos.y / dpr); ctx.stroke(); }
    };

    const end = () => {
      if (!isDown) return;
      isDown = false;
      setHasSignature(true);
      // Export as PNG data URL
      const dataUrl = canvas.toDataURL("image/png");
      onSignature(dataUrl);
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [getPos, onSignature]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onClear();
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#1E293B", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label} <span style={{ color: "#DC2626" }}>*</span>
      </label>
      <div style={{ border: `2px solid ${hasSignature ? "#059669" : "#E2E8F0"}`, borderRadius: 10, overflow: "hidden", background: "#fff", touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 150, display: "block", cursor: "crosshair" }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <span style={{ fontSize: 11, color: "#94A3B8" }}>{hint}</span>
        <button
          type="button"
          onClick={clear}
          style={{ fontSize: 12, color: "#64748B", background: "none", border: "1px solid #CBD5E1", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
        >
          {clearLabel}
        </button>
      </div>
    </div>
  );
}
