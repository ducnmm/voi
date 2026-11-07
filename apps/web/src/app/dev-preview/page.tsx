import { notFound } from "next/navigation";
import { ResponsivePreview } from "@/components/responsive-preview";
export default async function ResponsiveQA({
  searchParams,
}: {
  searchParams: Promise<{ width?: string; height?: string; path?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const width = [320, 375, 390, 430, 767, 768, 844, 1024, 1440].includes(
    Number(query.width),
  )
    ? Number(query.width)
    : 390;
  const height = [320, 390, 400, 568, 667, 768, 844, 900, 932, 1024].includes(
    Number(query.height),
  )
    ? Number(query.height)
    : 844;
  const path =
    query.path?.startsWith("/") &&
    !query.path.startsWith("//") &&
    !query.path.includes("\\") &&
    !query.path.startsWith("/dev-preview")
      ? query.path
      : "/";
  const href = (w: number, h: number) =>
    `/dev-preview?width=${w}&height=${h}&path=${encodeURIComponent(path)}`;
  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        padding: 16,
        background: "#dadade",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {[
          [320, 568],
          [390, 844],
          [844, 390],
          [768, 1024],
          [1024, 768],
          [1440, 900],
        ].map(([w, h]) => (
          <a key={`${w}x${h}`} href={href(w!, h!)}>
            {w}×{h}
          </a>
        ))}
        <strong>
          CSS viewport: {width}×{height}
        </strong>
        <a href="/dev-preview/icons">Icon audit</a>
      </header>
      <ResponsivePreview width={width} height={height} path={path} />
    </div>
  );
}
