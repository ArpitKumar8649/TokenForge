# GitHub Login Setup for TokenForge

## Recommendation

For **sign-in only**, use a dedicated **GitHub OAuth App** and keep TokenForge’s existing signed session and user-account tables. GitHub OAuth Apps use the browser authorization-code flow: the user is sent to GitHub, GitHub returns a short-lived code to the registered callback, and the server exchanges that code for a token before resolving the user identity.[1] TokenForge should treat the GitHub token as transient identity-verification material and issue its normal first-party session after the account is matched or created.

> Do not request repository permissions for simple account login. If TokenForge later needs to access a user’s repositories or automate GitHub work, evaluate a **GitHub App** instead; GitHub recommends it for fine-grained permissions and short-lived tokens.[1]

| Decision | Recommended choice | Reason |
|---|---|---|
| Identity product | GitHub OAuth App | Appropriate for browser sign-in only. |
| Authorization flow | Authorization code with **PKCE** and `state` | GitHub supports this web flow and documents PKCE as a protection for the code exchange.[2] |
| Requested permissions | `read:user user:email` | Retrieves an identifiable profile and verified email without requesting repository access.[3] |
| Account matching | Match a GitHub account by stable GitHub user ID; only link an existing TokenForge email after the signed-in user explicitly confirms it | Prevents accidental account takeover through a shared or changed email address. |
| Token retention | Do not persist GitHub access tokens for login-only use | TokenForge needs its own signed session, not ongoing GitHub API access. |

## What the Project Owner Must Provide

Before implementation, please provide the following non-secret decisions and configuration.

| Required item | What to provide | Notes |
|---|---|---|
| Production public URL | The final TokenForge HTTPS domain | Use this for the app homepage and callback registration. |
| GitHub OAuth App | An OAuth App created in **GitHub → Settings → Developer settings → OAuth apps** | Create a separate development app if a local callback is also needed: an OAuth App has one callback URL.[1] |
| Callback choice | Either `https://YOUR-DOMAIN/api/auth/github/callback` for a new native TokenForge adapter, or confirmation that GitHub will be configured through the existing Manus OAuth integration | Do not register the current `/api/oauth/callback` with GitHub unless the managed OAuth provider explicitly instructs it. |
| Client credentials | GitHub **Client ID** and **Client Secret**, supplied through the secure project-secrets panel | Never place either value in the frontend or Git repository. |
| Account-linking policy | Confirm whether GitHub sign-in may attach to an existing password account with the same verified email, or whether users must confirm linking while signed in | Explicit confirmation is safer. |
| Legal copy | Approval to add GitHub login wording to the privacy policy and terms | Explain the identity data collected and the account-linking behavior. |

## Implementation Plan

TokenForge already recognizes `github` as an OAuth login method and its existing callback safely creates a signed user session. A direct GitHub implementation would add a GitHub-specific start route and callback, store `state` and PKCE verifier in short-lived secure cookies, exchange the code server-side, retrieve the GitHub user and verified email, then upsert a TokenForge account and issue the current local session. The existing password login remains available as a separate method.

The callback must validate the returned `state`, validate the identity after every sign-in, and handle a missing or unverified email safely. GitHub’s web-flow documentation specifically requires matching the returned state and recommends using the redirect URI during the code exchange.[2]

## References

[1]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app "GitHub Docs — Creating an OAuth app"
[2]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps "GitHub Docs — Authorizing OAuth apps"
[3]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps "GitHub Docs — Scopes for OAuth apps"
