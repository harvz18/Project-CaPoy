import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./motion-tokens.css";
import "./MotionButton.css";

/**
 * Minimal dependency-free feedback button. Real navigation/submission still
 * belongs to the caller; this component never delays or fakes completion.
 */
export interface MotionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pending?: boolean;
  tone?: "primary" | "secondary";
}

export function MotionButton({
  children,
  pending = false,
  tone = "primary",
  disabled,
  type = "button",
  className = "",
  ...buttonProps
}: MotionButtonProps) {
  const unavailable = Boolean(disabled || pending);

  return (
    <button
      {...buttonProps}
      type={type}
      className={`ux-motion-button ux-motion-button--${tone} ${className}`.trim()}
      disabled={unavailable}
      aria-busy={pending || undefined}
    >
      <span className="ux-motion-button__label">{children}</span>
      {pending ? <span className="ux-motion-button__pending" aria-hidden="true" /> : null}
    </button>
  );
}
