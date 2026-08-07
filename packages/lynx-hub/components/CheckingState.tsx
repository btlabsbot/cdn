export default function CheckingState({ label = "Comprobando sesión…" }: { label?: string }) {
  return (
    <main className="page">
      <p className="checking-state">{label}</p>
    </main>
  );
}
