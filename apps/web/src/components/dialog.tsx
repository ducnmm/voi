"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { Icon } from "./icon";
export function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.body.style.overflow;
    const trigger =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      requestAnimationFrame(() => {
        if (trigger?.isConnected && !document.querySelector("dialog[open]"))
          trigger.focus({ preventScroll: true });
      });
    };
  }, [open, returnFocusRef]);
  return (
    <dialog
      className={`sheet ${className}`}
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <header className="sheet-header">
        <div className="sheet-handle" />
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label={t("Đóng")}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
