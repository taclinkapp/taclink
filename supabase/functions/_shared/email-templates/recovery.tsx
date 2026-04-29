/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Reset your password</Heading>
          <Text style={s.text}>
            We received a request to reset the password on your {siteName} account.
            Tap the button below to set a new one. This link expires in 1 hour.
          </Text>
          <Button style={s.button} href={confirmationUrl}>Reset password</Button>
          <Text style={s.muted}>
            Didn't request this? You can safely ignore this email — your password
            won't change until you create a new one.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
