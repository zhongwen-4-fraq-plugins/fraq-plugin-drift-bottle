interface PasswordVisibilityButtonProps {
  visible: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function PasswordVisibilityButton({ visible, disabled, onToggle }: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      className="password-toggle"
      aria-label={visible ? '隐藏密码' : '查看密码'}
      aria-pressed={visible}
      onClick={onToggle}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.75 12s3.25-5 9.25-5 9.25 5 9.25 5-3.25 5-9.25 5-9.25-5-9.25-5Z" />
        <circle cx="12" cy="12" r="2.25" />
        {visible ? <path d="m4 4 16 16" /> : null}
      </svg>
    </button>
  );
}
