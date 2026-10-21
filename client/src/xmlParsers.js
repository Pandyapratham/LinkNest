import { SaxesParser } from 'saxes'

export function parseDom(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('The XML is not well-formed.')
  return [...doc.querySelectorAll('links > link')].map(node => ({ title: node.querySelector('title')?.textContent || '', destinationUrl: node.querySelector('destinationUrl')?.textContent || '' }))
}

export function parseSax(xml) {
  const parser = new SaxesParser({ xmlns: false })
  const links = []
  let current = null
  let field = ''
  parser.on('opentag', tag => {
    field = tag.name
    if (tag.name === 'link') current = {}
  })
  parser.on('text', value => { if (current && (field === 'title' || field === 'destinationUrl')) current[field] = (current[field] || '') + value })
  parser.on('closetag', tag => {
    const name = typeof tag === 'string' ? tag : tag.name
    if (name === 'link' && current) { links.push(current); current = null }
    field = ''
  })
  parser.write(xml).close()
  return links
}
