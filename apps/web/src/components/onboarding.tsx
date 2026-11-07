"use client";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Dialog } from "./dialog";
import { Icon, type IconName } from "./icon";
const slides: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "badminton",
    title: "Một kèo hay đang chờ",
    description:
      "Tìm những buổi cầu lông phù hợp với trình độ và thời gian của bạn. Chọn một kèo, giữ một chỗ, cùng nhau ra sân.",
  },
  {
    icon: "people",
    title: "Chơi cùng nhau, vui hơn",
    description:
      "Rủ bạn bằng link hoặc QR, trò chuyện trong nhóm, xếp sân và chia chi phí rõ ràng.",
  },
  {
    icon: "star",
    title: "Mỗi buổi chơi, thêm kết nối",
    description:
      "Lưu kèo yêu thích, theo dõi người chơi và chia sẻ đánh giá sau những buổi cầu lông.",
  },
];
export function Onboarding({
  open,
  onFinish,
}: {
  open: boolean;
  onFinish: () => void;
}) {
  const { t } = useI18n();

  const [page, setPage] = useState(0);
  const slide = slides[page]!;
  return (
    <Dialog open={open} onClose={onFinish} title={t("Chào mừng đến Voi")}>
      <div className="stack onboarding-content">
        <div className="onboarding-symbol">
          <Icon name={slide.icon} size={46} />
        </div>
        <h2>{t(slide.title)}</h2>
        <p>{t(slide.description)}</p>
        <div className="onboarding-dots" aria-label={t("Trang giới thiệu")}>
          {slides.map((_, i) => (
            <button
              key={i}
              className={i === page ? "active" : ""}
              onClick={() => setPage(i)}
              aria-label={`Trang ${i + 1}`}
              aria-current={i === page ? "step" : undefined}
            />
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => (page === 2 ? onFinish() : setPage(page + 1))}
        >
          {page === 2 ? t("Bắt đầu ra sân") : t("Tiếp tục")}
          <Icon name="chevron" size={16} />
        </button>
        <button className="btn btn-ghost" onClick={onFinish}>
          {t("Bỏ qua giới thiệu")}
        </button>
      </div>
    </Dialog>
  );
}
