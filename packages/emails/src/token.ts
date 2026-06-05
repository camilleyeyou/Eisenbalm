import { randomBytes } from 'node:crypto'

export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString('hex')
}
