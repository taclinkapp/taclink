// Shared TacLink brand styles for auth emails.
// Email body background MUST stay white (#ffffff) per spec — accents on inner panel.

export const AMBER = '#f59e0b'
export const AMBER_DARK = '#b45309'
export const TAC_DARK = '#1f2229'
export const TAC_PANEL = '#272a32'
export const TAC_BORDER = '#3a3d46'
export const TAC_MUTED = '#a1a5ad'

export const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Karla', 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: '32px 0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: TAC_DARK,
  borderRadius: '16px',
  overflow: 'hidden',
  border: `1px solid ${TAC_BORDER}`,
}

export const header = {
  padding: '28px 32px 0',
  textAlign: 'center' as const,
}

export const brand = {
  fontSize: '12px',
  letterSpacing: '0.32em',
  textTransform: 'uppercase' as const,
  color: AMBER,
  fontWeight: 700 as const,
  margin: 0,
}

export const inner = {
  padding: '24px 32px 32px',
}

export const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: '#ffffff',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  margin: '8px 0 16px',
}

export const text = {
  fontSize: '14px',
  color: '#e6e7ea',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const muted = {
  fontSize: '12px',
  color: TAC_MUTED,
  lineHeight: '1.5',
  margin: '24px 0 0',
}

export const button = {
  backgroundColor: AMBER,
  color: '#1a1a1a',
  fontSize: '13px',
  fontWeight: 700 as const,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const code = {
  display: 'inline-block',
  backgroundColor: TAC_PANEL,
  border: `1px solid ${TAC_BORDER}`,
  color: AMBER,
  fontSize: '24px',
  fontWeight: 700 as const,
  letterSpacing: '0.4em',
  padding: '14px 24px',
  borderRadius: '12px',
  margin: '8px 0 24px',
  fontFamily: 'monospace',
}

export const divider = {
  borderTop: `1px solid ${TAC_BORDER}`,
  margin: '24px 0 0',
}

export const footer = {
  textAlign: 'center' as const,
  padding: '20px 32px 8px',
  fontSize: '11px',
  color: '#6b6f78',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
}
