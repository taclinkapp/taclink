/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  instructorName?: string
  amount?: string
  payoutMethod?: string
  expectedDate?: string
}

const PayoutSentEmail = ({ instructorName, amount, payoutMethod, expectedDate }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your TacLink payout is on the way</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Text style={s.brand}>TACLINK</Text></Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Payout sent</Heading>
          <Text style={s.text}>
            {instructorName ? `${instructorName}, your` : 'Your'}{' '}
            {amount ? `${amount} ` : ''}payout has been sent
            {payoutMethod ? ` via ${payoutMethod}` : ''}.
          </Text>
          {expectedDate && (
            <Section style={s.detailRow}>
              <Text style={s.detailLabel}>Expected arrival</Text>
              <Text style={s.detailValue}>{expectedDate}</Text>
            </Section>
          )}
          <Text style={s.muted}>
            Full payout history is available in your TacLink instructor dashboard.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PayoutSentEmail,
  subject: 'Your TacLink payout is on the way',
  displayName: 'Payout sent',
  previewData: {
    instructorName: 'SGT Reyes',
    amount: '$420.00',
    payoutMethod: 'ACH (Bank ****1234)',
    expectedDate: 'Mon, May 19, 2026',
  },
} satisfies TemplateEntry

export default PayoutSentEmail
