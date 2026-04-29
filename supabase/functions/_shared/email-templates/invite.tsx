/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'

interface Props { siteName: string; confirmationUrl: string }

export const InviteEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to {siteName}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Text style={s.brand}>{siteName}</Text>
        </Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>You're invited</Heading>
          <Text style={s.text}>
            You've been invited to join {siteName}. Accept the invitation below
            to set up your account.
          </Text>
          <Button style={s.button} href={confirmationUrl}>Accept invitation</Button>
          <Text style={s.muted}>
            If you weren't expecting this invite, you can ignore this email.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
