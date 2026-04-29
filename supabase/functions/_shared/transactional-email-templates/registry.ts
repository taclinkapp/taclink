/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as bookingConfirmation } from './booking-confirmation.tsx'
import { template as depositReceived } from './deposit-received.tsx'
import { template as payoutSent } from './payout-sent.tsx'
import { template as weeklyCeoBrief } from './weekly-ceo-brief.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'booking-confirmation': bookingConfirmation,
  'deposit-received': depositReceived,
  'payout-sent': payoutSent,
  'weekly-ceo-brief': weeklyCeoBrief,
}
