import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function loadAssets() { return Promise.all([
  readFile(join(process.cwd(), "src/assets/share/dm-sans-400.ttf")),
  readFile(join(process.cwd(), "src/assets/share/dm-sans-600.ttf")),
  readFile(join(process.cwd(), "src/assets/share/patrick-hand.ttf")),
  readFile(join(process.cwd(), "src/assets/share/wing-sculptural.png")),
]); }

export async function socialPreview(kind: "course" | "professor", title: string, subtitle: string) {
  const [regular, semibold, hand, wing] = await loadAssets();
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "52px 68px", background: "#541a2a", color: "#fff8e9", fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 600, letterSpacing: -1 }}>
          {/* ImageResponse renders a PNG directly, so Next's image optimizer is not used here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${wing.toString("base64")}`} width={74} height={74} alt="" style={{ marginLeft: -14, marginRight: 6 }} />
          eagleevals
        </div>
        <div style={{ fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: "#dbc9bc" }}>{kind === "course" ? "Course reviews" : "Professor reviews"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", paddingBottom: 12 }}>
        <div style={{ display: "flex", fontSize: kind === "course" ? 98 : title.length > 27 ? 67 : 82, fontWeight: 400, lineHeight: 1.05, letterSpacing: -3, flexWrap: "wrap" }}>{title}</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: subtitle.length > 85 ? 30 : 36, lineHeight: 1.22, color: "#eadbc8", flexWrap: "wrap" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Patrick Hand", fontSize: 40, lineHeight: 1.12, color: "#e4bf70" }}><span>A little advice</span><span>before you register.</span></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "#e3cfbc" }}><span style={{ fontSize: 21 }}>eagleevals.com</span><span style={{ fontSize: 15, marginTop: 10 }}>Independent of Boston College</span></div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [
      { name: "DM Sans", data: regular, weight: 400, style: "normal" },
      { name: "DM Sans", data: semibold, weight: 600, style: "normal" },
      { name: "Patrick Hand", data: hand, weight: 400, style: "normal" },
    ] },
  );
}
