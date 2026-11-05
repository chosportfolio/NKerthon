import type { SuggestionIcon } from '../types/assistant'

const paths: Record<SuggestionIcon, string[]> = {
  graduation: ['M2 9.5 12 5l10 4.5L12 14 2 9.5Z', 'M6 11.4V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.6', 'M22 9.5V15'],
  calendar: ['M4 6.5h16v13H4z', 'M4 10.5h16', 'M8.5 4v4', 'M15.5 4v4', 'M8 14h2.5', 'M13.5 14H16'],
  scholarship: ['M12 3.5v17', 'M16.5 7.2c-.8-1.2-2.4-1.9-4.4-1.9-2.6 0-4.2 1.2-4.2 3s1.6 2.5 4.2 3.1c2.7.6 4.4 1.4 4.4 3.3s-1.8 3.2-4.5 3.2c-2.2 0-3.9-.8-4.7-2.2'],
  bus: ['M5.5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v11h-16V6a1.5 1.5 0 0 1 1.5-1.5Z', 'M4 11h16', 'M7.5 20v-3', 'M16.5 20v-3', 'M7.5 14.2h.01', 'M16.5 14.2h.01'],
  health: ['M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10C19.5 15.6 12 20 12 20Z', 'M12 10v5', 'M9.5 12.5h5'],
  book: ['M5 5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2v-14Z', 'M5 19.5a2 2 0 0 0 2 2h12v-4', 'M9 7.5h6'],
  card: ['M3.5 6.5h17v11h-17z', 'M3.5 10h17', 'M7 14.2h4'],
}

export function SuggestionGlyph({ icon }: { icon: SuggestionIcon }) {
  return (
    <svg className="kubi-glyph" viewBox="0 0 24 24" aria-hidden="true">
      {paths[icon].map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

export function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  )
}

export function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function ThumbGlyph({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={down ? { transform: 'scaleY(-1)' } : undefined}>
      <path d="M7 10.5v9.5H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7Z" />
      <path d="M7 10.5 11 3.5a2.2 2.2 0 0 1 2.6 2.6L13 10h5.6a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H7" />
    </svg>
  )
}

export function NewChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}
