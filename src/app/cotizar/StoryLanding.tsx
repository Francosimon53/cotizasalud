"use client";

import { useMemo } from "react";
import { getStoryCampaign } from "@/lib/story-campaigns";

interface StoryLandingProps {
  campaign?: string;
  lang: string;
  onContinue: () => void;
}

export default function StoryLanding({ campaign, lang, onContinue }: StoryLandingProps) {
  const story = useMemo(() => getStoryCampaign(campaign), [campaign]);
  const isEs = lang !== "en";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px 32px", background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 4px 18px rgba(15,23,42,.06)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#0D9488", marginBottom: 18 }}>
        {isEs ? "Una historia que puede resultar familiar" : "A story that may feel familiar"}
      </div>
      <h1 style={{ margin: 0, fontSize: 29, lineHeight: 1.16, letterSpacing: -0.6, color: "#1E3A5F" }}>{isEs ? story.title : story.titleEn}</h1>
      <p style={{ margin: "18px 0 0", fontSize: 17, lineHeight: 1.65, color: "#374151" }}>{isEs ? story.scene : story.sceneEn}</p>
      <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.65, color: "#64748B" }}>{isEs ? story.tension : story.tensionEn}</p>
      <div style={{ margin: "22px 0", padding: "16px 18px", borderLeft: "3px solid #5EEAD4", background: "#F0FDFA", color: "#134E4A", fontSize: 16, lineHeight: 1.6 }}>
        {isEs ? story.turningPoint : story.turningPointEn}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 11, lineHeight: 1.5, color: "#94A3B8" }}>
        {isEs ? "Historia compuesta a partir de situaciones comunes; no representa a un cliente específico." : "Composite story based on common situations; it does not represent a specific client."}
      </p>
      <button type="button" onClick={onContinue} style={{ width: "100%", minHeight: 50, padding: "14px 20px", border: 0, borderRadius: 10, background: "#0D9488", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
        {isEs ? story.cta + " →" : story.ctaEn + " →"}
      </button>
      <div style={{ marginTop: 12, textAlign: "center", fontSize: 11, color: "#94A3B8" }}>
        {isEs ? "El siguiente paso explica qué información se solicitará y por qué." : "The next step explains what information will be requested and why."}
      </div>
    </div>
  );
}
