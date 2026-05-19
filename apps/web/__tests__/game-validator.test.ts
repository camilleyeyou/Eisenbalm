import { describe, it } from 'vitest'

// Plan 07-02 fills these in. Stubs land in Wave 0 so the runner
// collects the file without errors and downstream plans only
// need to flesh out the body.
describe('game-validator', () => {
  describe('validateEmbedCode (GAM-02)', () => {
    it.todo('rejects each of the 10 banned patterns')
  })
  describe('injectCsp (GAM-04)', () => {
    it.todo('injects meta tag with connect-src none and script-src unsafe-inline')
    it.todo('injects viewport meta and CSS reset for mobile (GAM-06 substrate)')
  })
})
