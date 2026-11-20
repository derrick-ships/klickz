import type { CSSProperties } from "react";

/** Decorative loading shape; the surrounding region announces its loading state. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export function HistorySkeleton() {
  return <div className="skeleton-history" role="status" aria-label="Loading chats"><Skeleton className="skeleton-search" />{Array.from({ length: 5 }, (_, i) => <div className="skeleton-history-row" key={i}><Skeleton className="skeleton-icon"/><Skeleton className="skeleton-line"/></div>)}</div>;
}

export function GridSkeleton() {
  return <div className="creation-grid" role="status" aria-label="Loading creations">{Array.from({ length: 6 }, (_, i) => <div className="creation-card skeleton-card" key={i}><Skeleton className="skeleton-image"/><div className="skeleton-card-info"><Skeleton className="skeleton-line"/><Skeleton className="skeleton-short"/></div></div>)}</div>;
}

export function ScoreSkeleton() {
  return <aside className="score-panel review-inspector skeleton-score" role="status" aria-label="Scoring thumbnail"><Skeleton className="skeleton-short"/><Skeleton className="skeleton-score-number"/>{Array.from({ length: 5 }, (_, i) => <div className="skeleton-score-row" key={i}><Skeleton className="skeleton-line"/><Skeleton className="skeleton-short"/></div>)}</aside>;
}

export function ProfileSkeleton() {
  return <div className="profile-collection" role="status" aria-label="Loading profiles">{Array.from({ length: 3 }, (_, i) => <div className="profile-item skeleton-profile" key={i}><Skeleton className="skeleton-profile-image"/><div><Skeleton className="skeleton-line"/><Skeleton className="skeleton-short"/></div></div>)}</div>;
}
