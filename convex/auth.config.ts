/**
 * Convex deployment-level auth configuration.
 *
 * This file tells the Convex deployment to trust JWTs issued by Clerk.
 *
 * Setup requirements (manual steps — cannot be automated):
 *
 * 1. Create a JWT template named exactly "convex" in the Clerk Dashboard:
 *    Clerk Dashboard → JWT Templates → Add Template → Choose "Convex"
 *    The `applicationID` below must match this template name exactly.
 *
 * 2. Set CLERK_JWT_ISSUER_DOMAIN on the Convex deployment:
 *    npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-frontend-api.clerk.accounts.dev
 *
 *    The issuer domain is the Clerk Frontend API URL found at:
 *    Clerk Dashboard → API Keys → Frontend API URL
 *    (format: https://verb-noun-00.clerk.accounts.dev)
 *
 * 3. Sync the config to the deployment:
 *    npx convex dev   (or npx convex deploy for prod)
 *
 * Without step 1, ConvexProviderWithClerk will throw auth errors even
 * though Clerk sign-in works — the JWT template name must match exactly.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",  // MUST match the Clerk JWT template name exactly
    },
  ],
}
