/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your {siteName} account</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Confirm your account</Heading>
          <Text style={s.text}>
            Welcome to {siteName}. Confirm your email to activate your account
            and get into the field.
          </Text>
          <Button style={s.button} href={confirmationUrl}>Confirm email</Button>
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
