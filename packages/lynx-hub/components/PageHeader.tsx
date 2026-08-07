import Link from "next/link";

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  backHref = "/dashboard",
}: {
  eyebrow: string;
  title: string;
  subtitle: React.ReactNode;
  backHref?: string;
}) {
  return (
    <>
      <Link href={backHref} className="back-link">
        ← Volver
      </Link>
      <header className="page-header">
        <div className="page-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </header>
    </>
  );
}
