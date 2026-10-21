import { useEffect, useRef, useState } from 'react'
import $ from 'jquery'
import { API_BASE_URL, api } from './api'
import { parseDom, parseSax } from './xmlParsers'
import './SyllabusLab.css'

const exampleXml = `<?xml version="1.0"?>\n<linknest version="1">\n  <profile><displayName>Study Creator</displayName><slug>study-creator</slug></profile>\n  <links>\n    <link><title>Portfolio</title><destinationUrl>https://example.com</destinationUrl></link>\n    <link><title>Notes</title><destinationUrl>https://example.org/notes</destinationUrl></link>\n  </links>\n</linknest>`

function XhrDemo() {
  const [status, setStatus] = useState('Press the button to request the public health endpoint.')
  const [payload, setPayload] = useState(null)
  const [busy, setBusy] = useState(false)
  function run() {
    setBusy(true); setPayload(null); setStatus('Requesting…')
    const request = new XMLHttpRequest()
    request.open('GET', `${API_BASE_URL}/api/health`)
    request.onload = () => {
      setBusy(false)
      try {
        const result = JSON.parse(request.responseText)
        if (request.status < 200 || request.status >= 300) throw new Error(`HTTP ${request.status}`)
        setPayload(result); setStatus(`HTTP ${request.status} · XMLHttpRequest load event`)
      } catch (error) { setStatus(error.message || 'The response was not valid JSON.') }
    }
    request.onerror = () => { setBusy(false); setStatus('Network request failed. Confirm the API is running and CORS allows this origin.') }
    request.send()
  }
  return <section className="lab-card"><h3>AJAX with XMLHttpRequest</h3><p>A read-only XHR call to <code>GET /api/health</code>, with explicit loading and error states.</p><button className="button button-light" onClick={run} disabled={busy}>{busy ? 'Loading…' : 'Run XMLHttpRequest'}</button><p className="lab-status" role="status">{status}</p>{payload && <pre>{JSON.stringify(payload, null, 2)}</pre>}</section>
}

function JQueryDemo() {
  const host = useRef(null)
  useEffect(() => {
    const $host = $(host.current)
    $host.html('<form class="jquery-demo-form"><label for="jquery-demo-name">Type a name</label><input id="jquery-demo-name" maxlength="50" /><button class="button button-light" type="submit">Run jQuery event + AJAX</button><output class="jquery-output" aria-live="polite"></output></form>')
    const onSubmit = event => {
      event.preventDefault()
      const name = $host.find('#jquery-demo-name').val().trim()
      $host.find('.jquery-output').text(name ? `Hello, ${name}. Requesting health…` : 'Add a name first.')
      if (!name) return
      $.ajax({ url: `${API_BASE_URL}/api/health`, method: 'GET', dataType: 'json' })
        .done(data => $host.find('.jquery-output').text(`Hello, ${name}. API health: ${data.application || 'available'}.`))
        .fail(() => $host.find('.jquery-output').text('XHR failed; check the API and its CORS allowlist.'))
    }
    $host.on('submit', '.jquery-demo-form', onSubmit)
    return () => { $host.off('submit', '.jquery-demo-form', onSubmit); $host.empty() }
  }, [])
  return <section className="lab-card"><h3>Isolated jQuery example</h3><p>This dedicated sandbox handles its own form event and jQuery AJAX call; jQuery does not mutate dashboard-owned elements.</p><div ref={host} className="jquery-host" /></section>
}

function SignatureDemo() {
  const [result, setResult] = useState('Creates a temporary ECDSA key pair in this browser; it is a learning demo, not account identity proof.')
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      if (!crypto.subtle) throw new Error('Web Crypto is unavailable in this browser context. Use localhost or HTTPS.')
      const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
      const message = new TextEncoder().encode('Pinpoint syllabus lab signature demo')
      const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, message)
      const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, signature, message)
      const exported = await crypto.subtle.exportKey('spki', pair.publicKey)
      setResult(`ECDSA P-256 · SHA-256 · signature ${verified ? 'verified' : 'not verified'} · public key ${exported.byteLength} bytes. This ephemeral key is trusted only because this same demo generated it.`)
    } catch (error) { setResult(error.message) } finally { setBusy(false) }
  }
  return <section className="lab-card"><h3>Digital signature and certificate concept</h3><p>HTTPS certificates authenticate a server connection. This separate example signs and verifies a message with an ephemeral public/private key pair.</p><button className="button button-light" onClick={run} disabled={busy}>{busy ? 'Signing…' : 'Generate and verify signature'}</button><p className="lab-status" role="status">{result}</p></section>
}

export default function SyllabusLab({ onImportComplete }) {
  const [xml, setXml] = useState('')
  const [preview, setPreview] = useState(null)
  const [xmlError, setXmlError] = useState('')
  const [xmlBusy, setXmlBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const fileRef = useRef(null)

  async function validateXml(source = xml) {
    setXmlError(''); setPreview(null); setConfirmed(false); setXmlBusy(true)
    try { const result = await api.validateXml(source); setPreview(result.preview) } catch (error) { setXmlError(error.message) } finally { setXmlBusy(false) }
  }
  async function exportXml() {
    setXmlError(''); setXmlBusy(true)
    try {
      const file = await api.exportXml()
      const href = URL.createObjectURL(file)
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = 'pinpoint-export.xml'; anchor.click(); URL.revokeObjectURL(href)
    } catch (error) { setXmlError(error.message) } finally { setXmlBusy(false) }
  }
  async function confirmImport() {
    if (!confirmed || !preview) return
    setXmlBusy(true); setXmlError('')
    try { await api.importXml(xml); setXmlError('Import completed. Your profile and links were replaced with the validated XML data.'); setPreview(null); setXml(''); setConfirmed(false); await onImportComplete?.() } catch (error) { setXmlError(error.message) } finally { setXmlBusy(false) }
  }
  async function loadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 64 * 1024) { setXmlError('XML files must be 64 KB or smaller.'); return }
    const source = await file.text(); setXml(source); await validateXml(source)
  }
  function demoParsing() {
    try { setParseResult({ dom: parseDom(exampleXml), sax: parseSax(exampleXml), error: '' }) } catch (error) { setParseResult({ error: error.message }) }
  }
  async function demoXsl() {
    try {
      const result = await api.validateXml(await fetch(`${API_BASE_URL}/api/lab/sample.xml`).then(response => response.text()))
      setParseResult(current => ({ ...current, xslReady: Boolean(result.success), xslMessage: 'The bundled XML fixture validates; run the documented Java XSLT command to produce transformed HTML.' }))
    } catch (error) { setParseResult(current => ({ ...current, xslMessage: error.message })) }
  }

  return <div className="syllabus-lab"><header className="lab-heading"><div className="section-kicker">PRACTICAL WEB TECHNOLOGY</div><h1>Web Technology Lab</h1><p>Runnable examples connected to Pinpoint’s API and data model. The dashboard remains React-driven.</p></header>
    <section className="lab-card xml-lab"><div className="lab-card-heading"><div><h3>XML profile transfer</h3><p>Export, preview XSD validation, and explicitly confirm before replacing this account’s profile and links.</p></div><button className="button button-light" onClick={exportXml} disabled={xmlBusy}>Export XML</button></div><label htmlFor="xml-import-file">Choose an XML file</label><input ref={fileRef} id="xml-import-file" type="file" accept=".xml,application/xml,text/xml" onChange={loadFile} /><label htmlFor="xml-source">Or paste XML</label><textarea id="xml-source" rows="8" value={xml} onChange={event => { setXml(event.target.value); setPreview(null); setConfirmed(false) }} placeholder="Paste a Pinpoint XML export here" /><div className="lab-actions"><button className="button button-light" onClick={() => validateXml()} disabled={xmlBusy || !xml.trim()}>{xmlBusy ? 'Validating…' : 'Validate and preview'}</button>{preview && <><label className="lab-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I reviewed this preview and confirm replacing my current profile and links.</label><button className="button button-primary" onClick={confirmImport} disabled={xmlBusy || !confirmed}>Confirm import</button></>}</div>{xmlError && <p className="lab-status" role="status">{xmlError}</p>}{preview && <div className="xml-preview"><strong>Validated preview</strong><p>{preview.profile.displayName} · /u/{preview.profile.slug} · {preview.profile.theme} theme</p><p>{preview.links.length} links · {preview.profile.socialLinks.length} social links · {preview.profile.enabled ? 'published' : 'unpublished'}</p><ol>{preview.links.map((item, index) => <li key={`${item.title}-${index}`}>{item.title} — {item.destinationUrl} ({item.enabled ? 'enabled' : 'disabled'})</li>)}</ol></div>}<div className="lab-schema-links"><a href={`${API_BASE_URL}/api/lab/linknest.dtd`} target="_blank" rel="noreferrer">Download DTD</a><a href={`${API_BASE_URL}/api/lab/linknest.xsd`} target="_blank" rel="noreferrer">Download XSD</a></div><small>Imports are capped at 64 KB, reject DOCTYPE and entity declarations, validate against a fixed local XSD, and cannot set account IDs or credentials.</small></section>

    <div className="lab-grid"><section className="lab-card"><h3>DOM and streaming SAX</h3><p>Both demonstrations read the same sample links. DOM builds a document tree; SAX emits events while the document streams.</p><button className="button button-light" onClick={demoParsing}>Parse sample XML both ways</button>{parseResult?.dom && <div className="parse-columns"><div><strong>DOM tree result</strong><pre>{JSON.stringify(parseResult.dom, null, 2)}</pre></div><div><strong>SAX event result</strong><pre>{JSON.stringify(parseResult.sax, null, 2)}</pre></div></div>}{parseResult?.error && <p role="alert" className="lab-status">{parseResult.error}</p>}</section>
      <section className="lab-card"><h3>XSLT transformation</h3><p>The server repository includes a trusted XSLT 1.0 stylesheet and a Java command-line transform with secure processing and external access disabled.</p><button className="button button-light" onClick={demoXsl}>Validate transformation fixture</button>{parseResult?.xslMessage && <p role="status" className="lab-status">{parseResult.xslMessage}</p>}<code>java server/labs/TransformXml.java server/labs/sample-linknest.xml output.html</code></section>
      <XhrDemo /><JQueryDemo /><SignatureDemo />
      <section className="lab-card"><h3>HTTP, JSON and REST API</h3><p>Examples use the same HTTP methods and JSON request/response patterns as the working application.</p><div className="endpoint-list"><div><b>POST</b><code>/api/auth/login</code><span>JSON email/password · sets HttpOnly cookie</span></div><div><b>GET</b><code>/api/profile/me</code><span>Cookie required · profile JSON</span></div><div><b>PATCH</b><code>/api/profile/me/links/:id</code><span>Cookie required · updates owned link</span></div><div><b>GET</b><code>/api/analytics?range=7d</code><span>Cookie required · database aggregation</span></div><div><b>GET</b><code>/api/redirect/:slug/:linkId</code><span>Public click event followed by HTTP 302</span></div></div><a href={`${API_BASE_URL}/api/health`} target="_blank" rel="noreferrer">Open the read-only JSON health response</a></section></div>
    <div className="lab-lesson"><strong>HTML5, CSS3, JavaScript and performance</strong><p>The application uses semantic forms, labels, links, buttons and tabular link rows; responsive CSS Grid/Flexbox; React events and state; JSON REST requests; bounded XML uploads; indexed analytics queries; and an optimized Vite production build. Production deployments must serve the frontend and API over HTTPS with a valid certificate chain. Local HTTP is not TLS.</p></div>
  </div>
}
