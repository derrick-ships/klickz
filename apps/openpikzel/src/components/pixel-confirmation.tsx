/** Four brand pixels settle into a finished tile only after a successful save. */
export function PixelConfirmation() {
  return (
    <svg className="pixel-confirmation" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  );
}
