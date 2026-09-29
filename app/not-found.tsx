import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-sm text-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Stranica ne postoji</h1>
      <p className="mt-2 text-sm text-muted">Poveznica je možda istekla ili zapis više ne postoji.</p>
      <ButtonLink href="/app" variant="primary" className="mt-6">
        Na naloge
      </ButtonLink>
    </main>
  );
}
