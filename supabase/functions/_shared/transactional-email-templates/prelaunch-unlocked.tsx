/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  instructorName?: string
  subscriptionUrl?: string
  monthlyPriceUsd?: string
}

const PrelaunchUnlockedEmail = ({
  instructorName,
  subscriptionUrl,
  monthlyPriceUsd,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>TacLink Pro is live — your monthly subscription is unlocked</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Text style={s.brand}>TACLINK</Text></Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Pro is unlocked 🎉</Heading>
          <Text style={s.text}>
            {instructorName ? `${instructorName}, the` : 'The'} pre-launch period is over.
            You can now upgrade to TacLink Pro and unlock unlimited course publishing,
            advanced insights, and priority support
            {monthlyPriceUsd ? ` for ${monthlyPriceUsd}/month` : ''}.
          </Text>
          <Text style={s.text}>
            Your Free tier remains exactly as it is — upgrade only when you're ready.
          </Text>
          {subscriptionUrl && (
            <Section style={{ marginTop: '24px' }}>
              <Button style={s.button} href={subscriptionUrl}>Upgrade to Pro</Button>
            </Section>
          )}
          <Text style={s.muted}>
            Thanks for being an early TacLink instructor. Let's go.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PrelaunchUnlockedEmail,
  subject: 'TacLink Pro is live — your monthly subscription is unlocked',
  displayName: 'Pre-launch unlocked (instructor)',
  previewData: {
    instructorName: 'SGT Reyes',
    subscriptionUrl: 'https://taclinkapp.com/instructor/subscription',
    monthlyPriceUsd: '$29',
  },
} satisfies TemplateEntry

export default PrelaunchUnlockedEmail
