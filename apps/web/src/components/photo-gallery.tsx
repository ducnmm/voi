"use client";
import { mediaSource } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useRef, useState } from "react";
import { Dialog } from "./dialog";
import { Cover } from "./primitives";
import { Icon } from "./icon";
export function PhotoGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const { t } = useI18n();

  const touchStart = useRef<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <button
        className="gallery-cover"
        onClick={() => {
          if (images.length) setSelected(0);
        }}
        aria-label={t("Xem ảnh buổi chơi")}
        disabled={!images.length}
      >
        <Cover images={images} title={title} />
        {images.length > 0 && (
          <span className="gallery-count">
            <Icon name="photo" size={15} />
            {images.length} {t("ảnh")}
          </span>
        )}
      </button>
      {images.length > 1 && (
        <div className="photo-strip">
          {images.map((url, index) => (
            <button
              key={`${url}:${index}`}
              onClick={() => setSelected(index)}
              aria-label={t("Xem ảnh {0}", [index + 1])}
            >
              <img src={mediaSource(url)} alt={`${title} · ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={title}
        className="gallery-sheet"
      >
        {selected !== null && (
          <div
            className="gallery-view"
            onTouchStart={(event) => {
              touchStart.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              if (touchStart.current !== null) {
                const delta =
                  (event.changedTouches[0]?.clientX ?? touchStart.current) -
                  touchStart.current;
                if (Math.abs(delta) > 50)
                  setSelected(
                    (selected + (delta < 0 ? 1 : images.length - 1)) %
                      images.length,
                  );
              }
              touchStart.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft")
                setSelected((selected + images.length - 1) % images.length);
              if (event.key === "ArrowRight")
                setSelected((selected + 1) % images.length);
            }}
          >
            <img
              src={mediaSource(images[selected]!)}
              alt={`${title} · ${selected + 1}`}
            />
            <div className="row spread">
              <button
                className="icon-btn"
                aria-label={t("Ảnh trước")}
                onClick={() =>
                  setSelected((selected + images.length - 1) % images.length)
                }
              >
                <Icon name="arrow" />
              </button>
              <span>
                {selected + 1} {t(" / ")}
                {images.length}
              </span>
              <button
                className="icon-btn"
                aria-label={t("Ảnh tiếp theo")}
                onClick={() => setSelected((selected + 1) % images.length)}
              >
                <Icon name="chevron" />
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
