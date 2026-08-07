import Footer from "./Footer";

export default function AuthCard({
  title,
  subtitle,
  children,
  as: As = "div",
  onSubmit,
}: {
  title: string;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
  as?: "form" | "div";
  onSubmit?: (e: React.FormEvent) => void;
}) {
  return (
    <main className="auth-page">
      <div className="radar-sweep-bg" aria-hidden="true" />

      <div className="auth-content">
        <As className="auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true" />
            LynxNodes
          </div>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </As>
      </div>

      <div className="footer-wrap">
        <Footer minimal />
      </div>
    </main>
  );
}
