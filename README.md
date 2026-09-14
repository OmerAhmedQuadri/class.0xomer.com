# class.0xomer.com

Generates a daily progress update for a class cohort: session details, topics, tasks, attendance and a footer of your choice, ready to paste as plain text or Markdown. Any institute can use it.

## Pages

| Path | What it does |
| --- | --- |
| `/` | The generator. Pick a cohort (drag cohorts in the list by their handle to reorder them; the first one opens on load), fill in the session details, click students to mark them present, then copy the update as plain text or Markdown. |
| `/login/` | Login screen for the generator. |
| `/hash/` | Computes the salted SHA-256 hash used when changing the password. |

## Running locally

This is a static site with no build step or dependencies. Serve the folder with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk doesn't work well, because the redirects point at folders like `login/`.

## Where data lives

Everything is saved in the browser's `localStorage` under one key, `dailyProgress.data`:

```js
{
  version: 2,
  cohorts: [{
    id, name, footer,
    hiddenFields: ['week', ...],  // fields left out of the output
    students: [{ id, name }],
    lastSession: { week, day, sessionDate, sessionTime, topics, tasks, resources, note, presentStudentIds }
  }]
}
```

Cohort names are unique (ignoring case and extra spaces), and so are student names within a cohort. Only the last generated session is kept for each cohort. The eye button next to each field label leaves that field out of the output (the form still keeps its value), and that choice is saved per cohort too. Which form sections are expanded (topics, tasks, resources, note, students, footer) is remembered per browser under `dailyProgress.openSections`, like the theme.

Nothing is sent to a server, so every browser keeps its own copy, and clearing site data erases it. Data saved by older versions of the app is converted to this format the first time the page opens.

## Changing the password

1. Open `/hash/`, enter the new password and leave the default salt.
2. Paste the result into `STORED_PASSWORD_HASH` in `auth.js`.

The login runs entirely in the browser, so it keeps casual visitors out but isn't real access control.
