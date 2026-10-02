# Who's Free? — Web App v8

A privacy-first static web app for comparing Marianopolis schedules.

## Fork update — October 2, 2026

This fork adds on-device schedule picture recognition and an editable weekly grid.

- **Picture import:** JPG/JPEG, PNG and WebP screenshots are read locally with English/French OCR. Pictures and recognized schedule data are not sent to an OCR server or AI API.
- **Editable grid:** Detection fills a seven-day timetable. Select a busy block to correct its wording, day or times, add missing blocks, or remove incorrect ones before saving. Saved schedules can be reopened with **Edit**.
- **Manual entry:** **Enter schedule manually** opens a blank grid without running recognition. Labels, course codes, rooms and instructor names are optional.
- **Break detection:** Availability follows occupied times, so unfamiliar course names do not prevent break detection. Athlete and conflict blocks count as busy time. Gaps of 10 minutes or less are passing time, so people remain unavailable between back-to-back classes. Only longer gaps count as breaks. Overlapping busy spans do not create false breaks; unclear or merged entries remain available for correction.
- **Class and break times:** Cards show **This class ends at**, followed by the next real break’s start time. After the last class, they show when the person becomes free for the day.
- **Weekend support:** Saturday and Sunday entries affect availability and next-class details.

### Using a schedule picture

Crop as tightly as possible around the full timetable. Keep all grid borders, the times on the left and the day headings at the top, including any weekend columns. Remove extra space without cutting off schedule content, and keep the picture upright.

Recognition can make mistakes. Compare the detected busy times with the picture before selecting **Save schedule**. If a PDF contains only an image, use the picture importer instead.

### Running this fork

Deploy the updated app files at the repository root, including `schedule-image-parser.js`, `schedule-availability.js` and the complete `assets/ocr/` folder. Use HTTPS hosting such as GitHub Pages, or `http://localhost` for computer testing; opening `index.html` directly from Files may block recognition.

The first import loads bundled recognition files from the website. Later imports can work offline on supported browsers after those files have been cached and browser storage is retained. This fork uses the `whos-free-shell-v13` cache; the original deployment and version notes below describe the earlier app.

Three supplied schedules were checked. Automated tests cover short passing gaps, longer breaks and chains of back-to-back classes. Tests cover detection, corrections, manual entry, validation, cancellation and offline caching. The fork has also been reported working on an iPhone.

## What's new in v8

- Fixed the iPhone time-control overflow by stacking Day and Time on narrow screens and removing Safari's stubborn native minimum width.
- Light/dark controls remain in **Settings → Themes**.
- Five saved full-app theme templates: **Ocean, Lavender, Rose, Forest, and Sunset**. Each recolors backgrounds, panels, cards, inputs, buttons, borders, timelines, badges and accents.
- Per-person **nicknames** that replace the full name throughout the main UI and notifications.
- Per-person **pins** so favorites stay at the top of the list.
- Existing break-notification bells remain available beside pin controls.
- More subtle GSAP polish: app entrance, settings-section stagger, theme selection, refresh feedback, pin interactions, plus the existing card/detail/timeline/toast animations.
- Mobile settings cards now stack cleanly with 44px-ish touch targets and no horizontal page overflow.
- Service-worker cache bumped to **v8**.

## Privacy model

Schedule PDFs and `schedules.json` stay on the user's device. The app stores the local schedule database in IndexedDB (with a localStorage fallback).

The hosted GitHub Pages site does **not** need a `schedules.json` file.

PDF parsing happens in the browser. PDF.js is loaded from jsDelivr only when a user adds a PDF; the selected PDF itself is not uploaded by the app.

Nicknames, pins, color theme, notification settings, and muted bells are device-specific local preferences. They are **not** included when sharing `schedules.json`.

## People personalization

Open **Settings → People** to:

- type a nickname (clear it to return to the full name),
- tap **📌** to pin or unpin someone,
- tap **🔔 / 🔕** to control only that person's break notifications.

Pinned people appear first. In **Show everyone**, pinned people are kept at the top even if one is currently in class.

## Themes

Open **Settings → Themes** to choose light/dark mode and a full color theme:

- Light or Dark mode
- Ocean
- Lavender
- Rose
- Forest
- Sunset

Theme settings are remembered locally on that device.

## Notifications

When enabled, Who's Free? looks for breaks between two classes where the gap is **more than 10 minutes**. Time before the first class and after the last class is not treated as a break.

If several unmuted people start a qualifying break in the same minute, Who's Free? sends one grouped notification.

### Current limitation

This is still a static GitHub Pages app. Break alerts are checked while the app is open/running. A static site cannot reliably wake itself later after the browser/PWA has been fully closed.

On iPhone, users should add Who's Free? to the Home Screen for the best notification support.

## Files to deploy

Upload these to the **root** of the GitHub repository:

```text
index.html
app.js
schedule-parser.js
styles.css
service-worker.js
manifest.webmanifest
assets/
```

Do **not** upload `schedules.json`.

GitHub Pages:

```text
Branch: main
Folder: / (root)
```

## Updating an existing install

v8 uses versioned files and `whos-free-shell-v8`, so previous installs should update automatically after GitHub Pages redeploys.

If a device still shows an older version, close the page/Home Screen app completely and reopen it.

## GSAP

GSAP 3.13.0 is loaded from jsDelivr and is used only for small UI transitions. The app still works if GSAP fails to load. Users with **Reduce Motion** enabled do not get the motion effects.

## Sharing

The **Share schedules.json** button shares/downloads only the schedule database. Device-specific preferences such as nicknames, pins, theme, notification settings, muted bells, and notification history are not included.

## v9 changes

- The browser PDF parser now recognizes Marianopolis Omnivox schedules in **English or French**.
  - Weekdays such as `Monday` / `Lundi`, `Tuesday` / `Mardi`, `Wednesday` / `Mercredi`, `Thursday` / `Jeudi`, and `Friday` / `Vendredi` are normalized to the same internal weekday names.
  - Room labels accept English `Classroom` plus French forms such as `Local`, `Classe`, and `Salle de classe`.
  - Section labels accept `sec.`, `sect.`, and `section`.
  - Time text accepts both `08:15` and French-style `08 h 15`, including ranges using `à`.
- Shared `schedules.json` files now carry the Who's Free? website URL (`https://xander444.github.io/Whos-Free/`).
- On devices with the Web Share API, the share sheet includes the website link alongside the JSON file.
