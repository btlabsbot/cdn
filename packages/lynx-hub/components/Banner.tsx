export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return <div className="banner banner-error">{children}</div>;
}

export function SuccessBanner({ children }: { children: React.ReactNode }) {
  return <div className="banner banner-success">{children}</div>;
}
