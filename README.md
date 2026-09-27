# Todo

A small to-do list app I made for myself. It runs on your computer as a normal desktop app, with no account or internet connection needed.

## What it does

You can add tasks, give them a due date and a priority, and tick them off when they're done. Tasks that are past their due date turn red, so they're hard to miss.

Tasks are split into two spaces, Personal and Work, and you can switch between them from the top of the window. If a task ends up in the wrong space, you can move it across. Inside each space you can make your own lists, like "Shopping" or "Side project".

Click on any task to open its details. That's where you can write notes or attach files to it. Attached files are copied into the app, so they still open even if you move or delete the original.

There's also a search box, filters for active and finished tasks, and a light and dark mode.

Everything is saved automatically as you go.

## Installing on Windows

You'll need the installer, `Todo Setup 1.0.0.exe`. If you don't have it, see "Building the installer" below.

Double-click the installer and follow the steps. Windows might show a blue "Windows protected your PC" warning because the app isn't signed. If that happens, click "More info" and then "Run anyway". After that you can open Todo from the Start menu like any other app.

## Running it from the code

Install [Node.js](https://nodejs.org) first, then run these in the project folder:

```
npm install
npm start
```

## Building the installer

On Windows:

```
npm run dist
```

For Linux, run this on a Linux machine:

```
npm run dist:linux
```

The finished files end up in the `dist` folder.

## Keyboard shortcuts

| Keys | What it does |
|---|---|
| Ctrl + N | Add a new task |
| Ctrl + F | Search |
| Ctrl + 1 / Ctrl + 2 | Switch to Personal / Work |
| Esc | Close the task panel |

## Where your tasks are saved

On Windows, everything lives in `%APPDATA%\Todo\`. If you move to a new computer, copy that folder across and your tasks, notes and attachments come with it.
