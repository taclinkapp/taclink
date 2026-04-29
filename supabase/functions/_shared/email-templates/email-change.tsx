/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props {
  siteName: string
  confirmationUrl: string
  email?: string
  newEmail?: string
}

export const EmailChangeEmail = ({ siteName, confirmationUrl, email, newEmail }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new {siteName} email</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Confirm email change</Heading>
          <Text style={s.text}>
            Confirm the email change on your {siteName} account
            {email && newEmail ? ` from ${email} to ${newEmail}` : ''}.
          </Text>
          <Button style={s.button} href={confirmationUrl}>Confirm change</Button>
          <Text style={s.muted}>
            Didn't request this change? Contact support immediately — your account
            may be at risk.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
