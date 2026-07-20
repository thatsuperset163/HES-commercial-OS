"use client";

type Props = {
  initials: string;
  size?: "sm" | "md";
};

export default function ClientInitialsAvatar({ initials, size = "sm" }: Props) {
  return (
    <span
      className={`client-avatar client-avatar-${size}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
