"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Dialog } from "./dialog";
import { Icon } from "./icon";
import { ErrorNote } from "./ui";
export function QRCode({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();

  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setImage("");
    setError(false);
    import("qrcode")
      .then((module) =>
        module.toDataURL(value, {
          width: 640,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#12261e", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [value]);
  return error ? (
    <ErrorNote message={t("Không tạo được mã QR.")} />
  ) : image ? (
    <div className="qr-frame">
      <img src={image} width={240} height={240} alt={label} />
      <a download="voi-qr.png" href={image} className="btn btn-ghost">
        {t("Lưu mã QR")}
      </a>
    </div>
  ) : (
    <div className="loading" role="status">
      {t("Đang tạo mã QR…")}
    </div>
  );
}
export function ShareSheet({
  open,
  onClose,
  url,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
  description: string;
}) {
  const { t } = useI18n();

  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="stack share-content">
        <p className="muted">{description}</p>
        <QRCode value={url} label={t("Quét mã QR để nhận lời mời")} />
        <label className="share-url">
          {t("Đường link lời mời")}
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
        <div className="share-actions">
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setError(t("Hãy chọn và sao chép đường link phía trên."));
              }
            }}
          >
            <Icon name="copy" size={18} />
            {copied ? t("Đã sao chép") : t("Sao chép link")}
          </button>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                if (navigator.share)
                  await navigator.share({ title, text: description, url });
                else {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                }
              } catch (err) {
                if (!(err instanceof Error && err.name === "AbortError"))
                  setError(
                    t("Không thể chia sẻ. Bạn có thể sao chép đường link."),
                  );
              }
            }}
          >
            <Icon name="share" size={18} />
            {t("Chia sẻ")}
          </button>
        </div>
        {error && <ErrorNote message={error} />}
      </div>
    </Dialog>
  );
}
