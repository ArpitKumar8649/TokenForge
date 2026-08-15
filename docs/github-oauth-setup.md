# GitHub OAuth Callback Configuration

TokenForge always sends GitHub OAuth callbacks to its stable public origin instead of the internal deployment runtime hostname. In the GitHub OAuth App settings, set the **Authorization callback URL** to:

```
https://tokengate-cqt9ivzs.manus.space/api/auth/github/callback
```

The callback URL must match the value sent in the authorization request exactly. When TokenForge is moved to a custom HTTPS domain, set the server-only `TOKENFORGE_PUBLIC_ORIGIN` environment variable to that origin and update the GitHub OAuth App callback URL to the corresponding `/api/auth/github/callback` path.
