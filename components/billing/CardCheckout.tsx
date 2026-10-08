'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';

type PaddleJs = {
  Environment: { set: (env: string) => void };
  Initialize: (options: { token: string; eventCallback?: (e: { name?: string }) => void }) => void;
  Checkout: { open: (options: Record<string, unknown>) => void };
};

let loading: Promise<PaddleJs> | null = null;
let ready = false;

// Paddle.js once per page, from Paddle's own address.
function loadPaddle(token: string, environment: string, onEvent: (name: string) => void): Promise<PaddleJs> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.onload = () => resolve((window as unknown as { Paddle: PaddleJs }).Paddle);
    s.onerror = () => {
      loading = null;
      reject(new Error('Plaćanje karticom se ne može otvoriti. Provjerite vezu.'));
    };
    document.head.appendChild(s);
  });
  return loading.then((paddle) => {
    if (!ready) {
      if (environment === 'sandbox') paddle.Environment.set('sandbox');
      paddle.Initialize({ token, eventCallback: (e) => e.name && onEvent(e.name) });
      ready = true;
    }
    return paddle;
  });
}

// "Plati karticom": Paddle's own checkout over the page. The card never
// touches Poslar; Paddle tells the server when the payment went through.
export function CardCheckout({
  config,
  priceId,
  tenantId,
  email,
  label = 'Plati karticom',
  variant = 'primary',
}: {
  config: { clientToken: string; environment: string };
  priceId: string;
  tenantId: string;
  email: string | null;
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const paddle = await loadPaddle(config.clientToken, config.environment, (name) => {
        if (name === 'checkout.completed') {
          toast.success('Plaćeno. Pretplata se osvježava, za koji trenutak.');
          window.setTimeout(() => router.refresh(), 4000);
        }
      });
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(email ? { customer: { email } } : {}),
        customData: { tenant_id: tenantId },
        settings: { displayMode: 'overlay', theme: 'dark', allowLogout: false },
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} disabled={busy} onClick={open}>
      <CreditCard className="size-4" /> {label}
    </Button>
  );
}
