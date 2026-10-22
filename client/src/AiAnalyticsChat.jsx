import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import './AiAnalyticsChat.css'

const QUICK_PROMPTS = [
  { icon: '↗', label: 'Top-performing links', prompt: 'Which of my links perform best, and what does the data show?' },
  { icon: '◷', label: 'Recent activity', prompt: 'Summarize my profile activity and click trends for this period.' },
  { icon: '✦', label: 'Growth ideas', prompt: 'Based on my actual analytics, suggest three practical ways to improve engagement.' },
]

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Hey there! I’m your Pinpoint analytics copilot. ✨\n\nAsk me about your link performance, click trends, or ideas to improve engagement. I’ll use your real analytics—not made-up numbers.',
}

function ChatIcon({ name, size = 18 }) {
  const paths = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    reset: <><path d="M3 11a9 9 0 0 1 15.4-6.4L21 7" /><path d="M21 2v5h-5" /><path d="M21 13a9 9 0 0 1-15.4 6.4L3 17" /><path d="M3 22v-5h5" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function renderMessage(text) {
  return text.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)
}

export default function AiAnalyticsChat() {
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState('7d')
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const feedRef = useRef(null)
  const inputRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages, busy, open])

  async function sendMessage(value = draft) {
    const content = value.trim()
    if (!content || busy) return
    const nextMessages = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setDraft('')
    setError('')
    setBusy(true)
    try {
      const result = await api.analyticsChat({ range, messages: nextMessages.filter(message => message !== INITIAL_MESSAGE).slice(-12).map(({ role, content: text }) => ({ role, content: text })) })
      setMessages(current => [...current, { role: 'assistant', content: result.reply }])
    } catch (requestError) {
      setError(requestError.message || 'I couldn’t reach the analytics assistant. Please try again.')
      setMessages(current => [...current, { role: 'assistant', content: 'I couldn’t complete that answer just now. Your conversation is still here—please try again in a moment.' }])
    } finally {
      setBusy(false)
    }
  }

  function resetConversation() {
    setMessages([INITIAL_MESSAGE])
    setDraft('')
    setError('')
    inputRef.current?.focus()
  }

  return <div className="ai-chat-root">
    {open && <section className="ai-chat-panel" aria-label="AI analytics assistant">
      <header className="ai-chat-header">
        <div className="ai-chat-brand-icon"><ChatIcon name="spark" size={21} /></div>
        <div className="ai-chat-heading"><strong>Pinpoint AI</strong><span><i /> Analytics copilot</span></div>
        <div className="ai-chat-header-actions">
          <button type="button" className="ai-chat-header-button" aria-label="Reset conversation" title="New conversation" onClick={resetConversation}><ChatIcon name="reset" size={16} /></button>
          <button type="button" className="ai-chat-header-button" aria-label="Close assistant" onClick={() => setOpen(false)}><ChatIcon name="close" size={18} /></button>
        </div>
      </header>
      <div className="ai-chat-context">
        <span className="ai-chat-context-dot" />
        Answers grounded in your profile analytics
        <label className="ai-chat-range">
          <span className="sr-only">Analytics period</span>
          <select value={range} onChange={event => setRange(event.target.value)} aria-label="Analytics period">
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </label>
      </div>
      <div className="ai-chat-feed" ref={feedRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message, index) => <article className={`ai-chat-message ai-chat-message-${message.role}`} key={index}>
          {message.role === 'assistant' && <span className="ai-chat-avatar"><ChatIcon name="spark" size={15} /></span>}
          <div className="ai-chat-bubble">{renderMessage(message.content)}</div>
        </article>)}
        {messages.length === 1 && <div className="ai-chat-suggestions"><span className="ai-chat-suggestions-label">TRY ASKING</span>{QUICK_PROMPTS.map(item => <button type="button" className="ai-chat-suggestion" key={item.label} onClick={() => sendMessage(item.prompt)} disabled={busy}><span>{item.icon}</span>{item.label}<b>↗</b></button>)}</div>}
        {busy && <div className="ai-chat-message ai-chat-message-assistant"><span className="ai-chat-avatar"><ChatIcon name="spark" size={15} /></span><div className="ai-chat-bubble ai-chat-typing" aria-label="Assistant is thinking"><i /><i /><i /><span>Reviewing your analytics…</span></div></div>}
        <div ref={endRef} />
      </div>
      {error && <p className="ai-chat-error" role="status">{error}</p>}
      <form className="ai-chat-composer" onSubmit={event => { event.preventDefault(); sendMessage() }}>
        <textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Ask about your performance…" rows="1" maxLength={2000} aria-label="Message the analytics assistant" disabled={busy} />
        <button type="submit" className="ai-chat-send" aria-label="Send message" disabled={!draft.trim() || busy}><ChatIcon name="send" size={17} /></button>
      </form>
      <footer className="ai-chat-footer">AI can make mistakes. Check important insights against your dashboard.</footer>
    </section>}
    <button type="button" className={`ai-chat-launcher ${open ? 'ai-chat-launcher-open' : ''}`} aria-label={open ? 'Close AI analytics assistant' : 'Open AI analytics assistant'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? <ChatIcon name="close" size={22} /> : <><ChatIcon name="spark" size={23} /><span className="ai-chat-launcher-label">Ask AI</span><i className="ai-chat-launcher-dot" /></>}
    </button>
  </div>
}
