"use client";
// app/enquire/embed/page.tsx — The enquiry form as shown inside the Squarespace Contact page
// (www.jnguyen.co/contact) through an iframe. The form itself lives in EnquiryWizard.
import { useEffect, useRef } from "react";
import { EnquiryWizard } from "@/components/enquire/EnquiryWizard";

export default function EnquireEmbedPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Report height to the parent page so the iframe resizes as the steps change.
  useEffect(() => {
    function reportHeight() {
      const h = containerRef.current?.scrollHeight ?? document.body.scrollHeight;
      window.parent.postMessage({ type: "jn-embed-height", height: h }, "*");
    }
    reportHeight();
    const ro = new ResizeObserver(reportHeight);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="bg-transparent">
      <EnquiryWizard embedded />
    </div>
  );
}
