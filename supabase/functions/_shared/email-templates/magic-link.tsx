/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} sign-in link</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Sign in to {siteName}</Heading>
          <Text style={s.text}>
            Tap the button below to sign in. This link expires in 1 hour and can
            only be used once.
          </Text>
          <Button style={s.button} href={confirmationUrl}>Sign in</Button>
          <Text style={s.muted}>
            Didn't request this link? You can safely ignore this email.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
