/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  studentName?: string
  courseTitle?: string
  amount?: string
}

const DepositReceivedEmail = ({ studentName, courseTitle, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Deposit received</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}><Text style={s.brand}>TACLINK</Text></Section>
        <Section style={s.inner}>
          <Heading style={s.h1}>Deposit received</Heading>
          <Text style={s.text}>
            {studentName ? `Thanks, ${studentName}.` : 'Thanks.'} We received your
            {amount ? ` ${amount}` : ''} deposit{courseTitle ? ` for ${courseTitle}` : ''}.
            Your seat is being held while the instructor reviews it.
          </Text>
          <Text style={s.muted}>
            You'll get another email as soon as the instructor confirms your booking.
          </Text>
        </Section>
        <Section style={s.footer}>Tactical training, locked in.</Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DepositReceivedEmail,
  subject: 'Deposit received — TacLink',
  displayName: 'Deposit received',
  previewData: {
    studentName: 'Alex',
    courseTitle: 'Intro to Defensive Pistol',
    amount: '$50',
  },
} satisfies TemplateEntry

export default DepositReceivedEmail
