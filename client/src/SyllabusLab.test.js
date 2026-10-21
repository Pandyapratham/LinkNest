import { describe, expect, it } from 'vitest'
import { parseDom, parseSax } from './xmlParsers'

const xml = '<linknest><links><link><title>Portfolio</title><destinationUrl>https://example.com</destinationUrl></link><link><title>Notes</title><destinationUrl>https://example.org/notes</destinationUrl></link></links></linknest>'

describe('syllabus XML parsing examples', () => {
  it('DOM and streaming SAX demonstrations return equivalent link data', () => {
    expect(parseDom(xml)).toEqual(parseSax(xml))
    expect(parseSax(xml)).toHaveLength(2)
  })

  it('DOM example reports malformed XML', () => {
    expect(() => parseDom('<linknest><links></linknest>')).toThrow('not well-formed')
  })
})
