"use client";
import { useEffect, useRef, useState } from "react";
export function ResponsivePreview({
  width,
  height,
  path,
}: {
  width: number;
  height: number;
  path: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const resize = () =>
      setScale(
        Math.min(1, node.clientWidth / width, node.clientHeight / height),
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height]);
  return (
    <div
      ref={stage}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ width: width * scale, height: height * scale }}>
        <iframe
          title={`Voi ${width}×${height}`}
          src={path}
          style={{
            width,
            height,
            border: 0,
            display: "block",
            borderRadius: width < 768 ? 24 : 12,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "white",
            boxShadow: "0 12px 45px #0002",
          }}
        />
      </div>
    </div>
  );
}
