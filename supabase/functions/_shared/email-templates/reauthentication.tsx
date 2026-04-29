/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; token: string }

export const ReauthenticationEmail = ({ siteName, token }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Verification code</Heading>
          <Text style={s.text}>
            Enter this code in {siteName} to confirm it's you. The code expires
            in 5 minutes.
          </Text>
          <Text style={s.code}>{token}</Text>
          <Text style={s.muted}>
            Didn't request this code? You can safely ignore this email — but if
            you see repeated requests, change your password.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
