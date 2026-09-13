# class.0xomer.com

Generates the daily progress update that Team CFI (Code For India Foundation) posts after each cohort session.

## Pages

| Path | What it does |
| --- | --- |
| `/` | The generator. Pick a cohort, fill in the session details, click students to mark them present, then copy the update as plain text or Markdown. |
| `/login/` | Login screen for the generator. |
| `/hash/` | Computes the salted SHA-256 hash used when changing the password. |

## Running locally

This is a static site with no build step or dependencies. Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk doesn't work well, because the redirects point at folders like `login/`.

## Where data lives

Cohorts, student lists and each cohort's most recent form inputs are saved in the browser's `localStorage`. Nothing is sent to a server, so every browser keeps its own copy, and clearing site data erases it.

## Changing the password

1. Open `/hash/`, enter the new password and leave the default salt.
2. Paste the result into `STORED_PASSWORD_HASH` in `auth.js`.

The login runs entirely in the browser, so it keeps casual visitors out but isn't real access control.
