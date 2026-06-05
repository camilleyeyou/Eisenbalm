/**
 * Email render seam — Plan 20-03 placeholder, Plan 20-04 replaces body.
 *
 * SIGNATURE IS STABLE: Plan 20-04 swaps the body for React Email render().
 * - File is .tsx from day 1 so Plan 20-04 can use JSX without renaming.
 * - The barrel import specifier stays './render' (no extension change).
 * - Keep the function async + keep the RenderData interface unchanged.
 */

export interface RenderData {
  order: {
    customerEmail?: string | null
    charitySlug?: string | null
    amountTotal: number
    createdAt: number
  }
  charity?: {
    name: string
    location?: string
    focusArea?: string
    missionStatement?: string
  } | null
  others?: Array<{ name: string }> | null
  fundedMoreCount?: number | null
  unsubscribeToken?: string | null
  postalAddress?: string | null
}

/**
 * Render a single email step to an HTML string.
 *
 * PLACEHOLDER — Plan 20-04 replaces this with:
 *   return render(<StepTemplate step={step} data={data} />)
 *
 * Keep async + keep signature stable — callers await this.
 */
export async function renderEmailStep(
  step: number,
  _data: RenderData,
): Promise<string> {
  // PLACEHOLDER — Plan 20-04 swaps this for React Email render()
  return `<p>step ${step}</p>`
}
