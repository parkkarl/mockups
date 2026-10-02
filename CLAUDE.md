# Mockups — juhised Claudele

See on Mockupsi töölauarakenduse lähtekoodiprojekt (Tauri 2 + Rust + React/TypeScript). Rakenduses on vasakul joonistusala ja lehepuu ning paremal päris terminal, kus võib töötada Claude Code.

## Kus on joonistus?

Rakenduses kuvatav projekt EI asu selles lähtekoodikaustas. Windowsis asub see kaustas `%LOCALAPPDATA%\ee.mockups.desktop\project`. Parempoolne terminal käivitub automaatselt selles kaustas, kus on eraldi `CLAUDE.md`.

- `project.json`: lehepuu (`pages`) ja aktiivse lehe ID (`activeId`).
- `canvas.png`: viimati salvestatud **aktiivse** lehe pilt. Ava see pildina, kui kasutaja küsib joonistuse väljanägemise kohta.
- `canvas.json`: aktiivse lehe redigeeritavad jooned, kujundid, tekstid ja grupid.
- `pages/<id>.png` ja `pages/<id>.json`: teiste lehtede pildid ja joonistused. Leia ID `project.json` failist.

Kui kasutaja küsib parajasti avatud joonise kohta, loe failid **uuesti**: need muutuvad töötamise ajal. Rakendus salvestab umbes 450 ms pärast lõpetatud muudatust. Sa ei näe otse ekraani, kursori liikumist ega pooleli olevaid tõmbeid; ära väida, et näed. Ära muuda salvestusfaile käsitsi avatud rakenduse all: rakendus võib need üle kirjutada. Joonise muutmiseks loe samas projektikaustas `AGENT-API.md` ning saada `agent-inbox/` kaudu lisamise, asendamise või kustutamise käsk; kontrolli vastust kaustas `agent-results/`. Need käsud rakendatakse avatud lõuendile koos tagasivõtmise ja autosalvestusega.

## Koodi muutmine

- `src/main.tsx`: lehed, valik, tööriistariba, salvestamise ajastamine.
- `src/canvas.tsx`: joonistamine, valimine, kujutamine.
- `src/templates.ts`: valmisvormid.
- `src/PageTree.tsx`: jooniste failipuu.
- `src/TerminalPanel.tsx`: sisseehitatud terminal.
- `src-tauri/src/lib.rs`: terminali PTY ja projektifailide salvestamine.
- `tests/`: käitumise testid.

Kontrolli muudatusi käskudega `npm run build` ja `npm test`. Windowsis saab arendusrakenduse käivitada `start-dev.cmd` abil. Säilita olemasolevate projektifailide ühilduvus ja ära kirjuta kasutaja joonistust üle. Vasta kasutajale eesti keeles, kui ta ei palu teisiti.
