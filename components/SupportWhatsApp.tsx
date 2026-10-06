import { MessageCircle } from 'lucide-react';
import { buttonClass } from '@/components/ui';
import { supportWhatsApp } from '@/lib/billing';

// A button that opens WhatsApp to Poslar support with the message ready.
// Shows nothing while no support number is set (SUPPORT_PHONE).
export function SupportWhatsApp({
  message,
  label = 'WhatsApp',
  variant = 'secondary',
  size = 'md',
  className,
}: {
  message: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const href = supportWhatsApp(message);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)}>
      <MessageCircle className="size-4" /> {label}
    </a>
  );
}
