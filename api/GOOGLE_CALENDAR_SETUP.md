# Setting up Google Calendar sync

Calendar Sync is fully built and wired up, but stays inactive until you do this **one-time** setup (you do this once, as the developer — each user still connects their own personal Google Calendar afterward, they never touch this part).

## 1. Create a Google Cloud project (if you don't have one)

Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (any name).

## 2. Enable the Calendar API

In the project, go to **APIs & Services → Library**, search for "Google Calendar API", and enable it.

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**:
- User type: External (unless you have a Google Workspace org)
- App name: "Becoming" (or whatever you want users to see)
- Add the scope `.../auth/calendar.events`
- While in testing mode, add your own Google account (and any test users) under "Test users" — otherwise Google will block the consent screen for anyone not explicitly added

## 4. Create an OAuth Client ID

**APIs & Services → Credentials → Create Credentials → OAuth client ID**:
- Application type: **Web application**
- Authorized redirect URIs: add your API's callback URL, e.g.
  `https://your-api-domain.com/api/calendar/callback`
  (for local dev with a tunnel, use that tunnel's URL + `/api/calendar/callback`)

Google gives you a **Client ID** and **Client Secret**.

## 5. Add the credentials to `api/.env`

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-api-domain.com/api/calendar/callback
```

`GOOGLE_REDIRECT_URI` must **exactly** match what you entered in step 4, including the protocol and trailing path.

Restart the API server after adding these — that's it. The Profile → Calendar Sync screen will now actually connect.
