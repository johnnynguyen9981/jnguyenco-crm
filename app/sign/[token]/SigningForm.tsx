"use client";

import { useRef, useState, useEffect } from "react";

interface Props {
  token:      string;
  clientName: string;
}

type Tab = "draw" | "type";

export function SigningForm({ token, clientName }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [tab, setTab]         = useState<Tab>("draw");
  const [typedName, setTyped] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [agreed, setAgreed]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getCanvas() { return canvasRef.current!; }
  function getCtx()    { return getCanvas().getContext("2d")!; }

  useEffect(() => {
    // Set canvas resolution = display size
    const canvas  = getCanvas();
    const rect    = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = getCtx();
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = "#083a4f";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointerPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = getCanvas().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    drawing.current = true;
    lastPos.current = pointerPos(e);
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = pointerPos(e);
    const ctx = getCtx();
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  }

  function onPointerUp() { drawing.current = false; }

  function clearCanvas() {
    const canvas = getCanvas();
    const ctx    = getCtx();
    const rect   = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  }

  // ── Build signature data URI ───────────────────────────────────────────────
  async function buildSignatureDataUri(): Promise<string | null> {
    if (tab === "draw") {
      if (!hasDrawn) return null;
      return getCanvas().toDataURL("image/png");
    }
    // Typed: render to canvas, return PNG
    if (!typedName.trim()) return null;
    const canvas  = document.createElement("canvas");
    canvas.width  = 360;
    canvas.height = 100;
    const ctx     = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle   = "#083a4f";
    ctx.font        = "italic 42px Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(typedName.trim(), 16, 50);
    return canvas.toDataURL("image/png");
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreed) { setError("Please tick the agreement checkbox before signing."); return; }

    const sigDataUri = await buildSignatureDataUri();
    if (!sigDataUri) {
      setError(tab === "draw" ? "Please draw your signature in the box above." : "Please type your name above.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ signature_data_uri: sigDataUri, signed_name: typedName.trim() || clientName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ background: "#fff", border: "1px solid #6fcf97", borderRadius: 8, padding: "28px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2 style={{ color: "#083a4f", margin: "12px 0 8px" }}>Contract Signed!</h2>
        <p style={{ color: "#555", lineHeight: 1.7 }}>
          Thank you! A signed copy of your contract has been emailed to you.<br />
          We'll be in touch soon with your invoice and next steps.
        </p>
        <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>
          Questions? <a href="mailto:johnny.nguyen@jnguyen.co" style={{ color: "#407e8c" }}>johnny.nguyen@jnguyen.co</a>
        </p>
      </div>
    );
  }

  const canSubmit = agreed && (tab === "draw" ? hasDrawn : typedName.trim().length > 0);

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ background: "#fff", border: "1px solid #c0d5d6", borderRadius: 8, padding: "20px 24px" }}>
        <h2 style={{ color: "#083a4f", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Your Signature</h2>
        <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
          Choose how you'd like to sign — drawn or typed.
        </p>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["draw", "type"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "6px 18px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                background: tab === t ? "#407e8c" : "#e5e1dd",
                color:      tab === t ? "#fff"     : "#555",
                transition: "background 0.15s",
              }}
            >
              {t === "draw" ? "✏️ Draw" : "⌨️ Type"}
            </button>
          ))}
        </div>

        {/* Draw tab */}
        {tab === "draw" && (
          <div>
            <div style={{ position: "relative", border: "2px dashed #c0d5d6", borderRadius: 8, overflow: "hidden", background: "#fafaf8" }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: 140, touchAction: "none", cursor: "crosshair" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
              {!hasDrawn && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none", color: "#bbb", fontSize: 14,
                }}>
                  Sign here…
                </div>
              )}
            </div>
            {hasDrawn && (
              <button type="button" onClick={clearCanvas} style={{ marginTop: 8, fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                ↺ Clear and redraw
              </button>
            )}
          </div>
        )}

        {/* Type tab */}
        {tab === "type" && (
          <div>
            <input
              type="text"
              placeholder="Type your full name…"
              value={typedName}
              onChange={e => setTyped(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "14px 16px",
                border: "2px dashed #c0d5d6",
                borderRadius: 8,
                fontSize: 28,
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
                color: "#083a4f",
                background: "#fafaf8",
                outline: "none",
              }}
            />
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
              Your typed name will be rendered as a signature on the contract.
            </p>
          </div>
        )}

        {/* Agreement checkbox */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: "#407e8c", flexShrink: 0, width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
            I, <strong>{clientName}</strong>, have read and agree to all the terms and conditions of this Photography &amp; Videography Service Agreement. I understand this constitutes a legally binding electronic signature.
          </span>
        </label>

        {/* Error message */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #f5c6cb", borderRadius: 6, padding: "10px 14px", marginTop: 16, color: "#b91c1c", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{
            display: "block", width: "100%", marginTop: 20,
            padding: "14px 0",
            background: canSubmit && !loading ? "#407e8c" : "#c0d5d6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 700,
            cursor: canSubmit && !loading ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          {loading ? "Signing…" : "✍️ Sign Contract"}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginTop: 12 }}>
          🔒 Your signature is transmitted securely and embedded in the contract PDF.
        </p>
      </div>
    </form>
  );
}
