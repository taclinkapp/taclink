import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export const VerifiedBadge = ({ className }: { className?: string }) => (
  <BadgeCheck className={cn('h-4 w-4 fill-primary text-background', className)} />
);
