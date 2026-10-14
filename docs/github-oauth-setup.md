# GitHub OAuth Callback Configuration

In your GitHub account under **Settings > Developer Settings > OAuth Apps > [Your OAuth App]**, configure the following:

### Homepage URL
- **Development / Preview**: `https://ais-dev-hukhnq77hk4esm4otdhxoj-472441275739.asia-southeast1.run.app`
- **Shared App**: `https://ais-pre-hukhnq77hk4esm4otdhxoj-472441275739.asia-southeast1.run.app`

### Authorization Callback URL
Set the **Authorization callback URL** according to your active environment:

1. **Active Development App (AI Studio Preview)**:
```
https://ais-dev-hukhnq77hk4esm4otdhxoj-472441275739.asia-southeast1.run.app/api/auth/github/callback
```

2. **Shared App (AI Studio Share / Pre-deployment URL)**:
```
https://ais-pre-hukhnq77hk4esm4otdhxoj-472441275739.asia-southeast1.run.app/api/auth/github/callback
```

3. **Public / Custom Domain (when TOKENFORGE_PUBLIC_ORIGIN is configured)**:
```
https://tokenforge.ai.studio/api/auth/github/callback
```

4. **Localhost (for local development outside Cloud Run)**:
```
http://localhost:3000/api/auth/github/callback
```

> **Note**: GitHub OAuth apps allow one callback URL per application. When developing in AI Studio, set the callback URL to the Development App URL (`https://ais-dev-hukhnq77hk4esm4otdhxoj-472441275739.asia-southeast1.run.app/api/auth/github/callback`). For shared/pre-production testing, switch to the Shared App URL or register a separate GitHub OAuth App.

