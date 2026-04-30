/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import * as s from './_brand.ts'
import type { TemplateEntry } from './registry.ts'

interface Props {
  studentName?: string
  courseTitle?: string
  instructorName?: string
  date?: string
  location?: string
  bookingUrl?: string
  /** Hours after booking the student can cancel for a full refund. 0 = no grace. */
  cancelGraceHours?: number
  /** Pre-formatted deadline string (e.g. "Sat, May 17 · 9:00 AM"). */
  cancelDeadline?: string
}

const graceCardStyle = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderLeft: '3px solid #22c55e',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '20px 0 8px',
}

const graceCardLateStyle = { ...graceCardStyle, borderLeftColor: '#ef4444' }

const BookingConfirmationEmail = ({
  studentName, courseTitle, instructorName, date, location, bookingUrl,
  cancelGraceHours, cancelDeadline,
}: Props) => {
  const hasGrace = typeof cancelGraceHours === 'number' && cancelGraceHours > 0
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your TacLink booking is confirmed</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <Section style={s.header}><Text style={s.brand}>TACLINK</Text></Section>
          <Section style={s.inner}>
            <Heading style={s.h1}>Booking confirmed</Heading>
            <Text style={s.text}>
              {studentName ? `${studentName}, you're` : "You're"} locked in for{' '}
              {courseTitle || 'your course'}{instructorName ? ` with ${instructorName}` : ''}.
            </Text>
            {(date || location) && (
              <Section>
                {date && (
                  <Section style={s.detailRow}>
                    <Text style={s.detailLabel}>Date</Text>
                    <Text style={s.detailValue}>{date}</Text>
                  </Section>
                )}
                {location && (
                  <Section style={s.detailRow}>
                    <Text style={s.detailLabel}>Location</Text>
                    <Text style={s.detailValue}>{location}</Text>
                  </Section>
                )}
              </Section>
            )}

            {/* Cancellation grace window */}
            {typeof cancelGraceHours === 'number' && (
              <Section style={hasGrace ? graceCardStyle : graceCardLateStyle}>
                <Text style={{ ...s.detailLabel, margin: 0 }}>
                  {hasGrace ? 'Cancel for a full refund' : 'No grace window'}
                </Text>
                <Text style={{ ...s.detailValue, margin: '4px 0 0', fontSize: '14px' }}>
                  {hasGrace
                    ? `You have ${cancelGraceHours} hours from booking${cancelDeadline ? ` (until ${cancelDeadline})` : ''} to cancel and get your platform fee + 10% deposit back in full.`
                    : 'This course was booked under 24 hours before start, so cancellations are not eligible for a refund.'}
                </Text>
              </Section>
            )}

            {bookingUrl && (
              <Section style={{ marginTop: '24px' }}>
                <Button style={s.button} href={bookingUrl}>View booking</Button>
              </Section>
            )}
            <Text style={s.muted}>
              Need to make changes? Open the booking in the app or message your instructor.
              Full cancellation policy at taclinkapp.com/legal/cancellations.
            </Text>
          </Section>
          <Section style={s.footer}>Tactical training, locked in.</Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BookingConfirmationEmail,
  subject: 'Your TacLink booking is confirmed',
  displayName: 'Booking confirmation',
  previewData: {
    studentName: 'Alex',
    courseTitle: 'Intro to Defensive Pistol',
    instructorName: 'SGT Reyes',
    date: 'Saturday, May 17, 2026 · 9:00 AM',
    location: 'Range 4, Phoenix AZ',
    bookingUrl: 'https://taclinkapp.com/student/bookings/sample',
    cancelGraceHours: 72,
    cancelDeadline: 'Mon, May 5 · 2:30 PM',
  },
} satisfies TemplateEntry

export default BookingConfirmationEmail
