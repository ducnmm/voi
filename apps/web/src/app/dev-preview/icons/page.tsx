import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
const names: IconName[] = [
  "badminton",
  "court",
  "chat",
  "bell",
  "person",
  "plus",
  "search",
  "filter",
  "pin",
  "calendar",
  "clock",
  "arrow",
  "check",
  "bookmark",
  "people",
  "settings",
  "sun",
  "logout",
  "close",
  "send",
  "chevron",
  "star",
  "map",
  "share",
  "copy",
  "photo",
  "refresh",
  "qr",
  "globe",
  "info",
  "trash",
];
export default function IconAudit() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div style={{ padding: 24, overflow: "auto", height: "100dvh" }}>
      <h1>Icon audit</h1>
      <p>
        Cupertino Icons (MIT), outlined and filled variants. Native Voi brand asset.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        {names.map((name) => (
          <div
            key={name}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <Icon name={name} size={20} />
              <Icon name={name} size={24} active />
            </div>
            <span style={{ fontSize: 12 }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
