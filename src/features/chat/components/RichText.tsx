import { Fragment } from 'react'

/**
 * 챗봇 답변 표시: **굵게** → <strong>, [1] 같은 근거 번호 → 작은 표시.
 * HTML을 그대로 넣지 않고 React 요소로만 만들어 안전하다.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\](?:\s*\[\d+\])*)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        const refs = part.match(/\d+/g)
        if (/^\[\d+\]/.test(part) && refs) {
          return (
            <span key={index} className="kubi-refs" aria-label={`근거 ${refs.join(', ')}번`}>
              {refs.map((n) => <sup key={n}>{n}</sup>)}
            </span>
          )
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}

export default RichText
