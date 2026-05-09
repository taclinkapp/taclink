/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; token: string }

export const SignupEmail = ({ siteName, token }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} verification code is {token}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Your verification code</Heading>
          <Text style={s.text}>
            Welcome to {siteName}. Enter this code in the app to activate your
            account and keep onboarding right where you left off.
          </Text>
          <Text style={s.code}>{token}</Text>
          <Text style={s.muted}>
            Didn't sign up? You can ignore this email and the account won't be created.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
