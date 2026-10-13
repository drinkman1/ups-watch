# ups-watch

Monitoring cen dziesięciu zasilaczy UPS do szafy rack. Skan co 3 godziny na GitHub Actions,
alert przez Issue (GitHub wysyła za nie maila) i Telegram, dashboard z historią cen na
GitHub Pages. Bot działa 30 dni, do 12.11.2026, a potem sam się wyłącza.

Bliźniak `gen-watch` (ceny agregatów): ten sam układ gałęzi, te same wyzwalacze alertu,
ta sama zasada „bot nigdy nie dotyka `main`". Kod skopiowany i przerobiony, nie współdzielony:
gen-watch jest wyłączony od 13.10.2026 (agregat kupiony).

## Do czego UPS

Szafa rack w garażu: brama, switch 48 PoE, 2 AP, 4 kamery PoE, wideodomofon, NVR, NAS.
Ok. 110–160 W w dzień, do 250 W w nocy. Agregat bez automatycznego przełączania, więc UPS
musi utrzymać szafę co najmniej 10 minut, cel to 30 minut przy 200 W.

Kryteria: czysta sinusoida, topologia online albo line-interactive, USB HID (NAS Synology
steruje wyłączaniem przez DSM), rack 1U/2U albo tower do ok. 30 cm wysokości na dnie szafy
o głębokości 450–600 mm. Tylko nowe egzemplarze.

## Co śledzi

| Model | Typ | Obudowa | Min przy 200 W | Baza | Próg |
|---|---|---|---|---|---|
| CyberPower OLS1000EA / -DE | online | tower | 35 | 1 450 zł | < 1 000 zł |
| CyberPower PR1000ELCD | line-interactive | tower | 49 | 1 840 zł | < 1 650 zł |
| CyberPower PR1000ERT2U | line-interactive | rack 2U | 66 | 2 640 zł | < 2 400 zł |
| CyberPower OLS1000ERT2UA | online | rack 2U | 35 | 2 330 zł | < 2 100 zł |
| Eaton 9E 1000i | online | tower | 25 | 1 770 zł | < 1 600 zł |
| Eaton 9E 1000i Rack 2U | online | rack 2U | 28 | 2 300 zł | < 2 100 zł |
| Eaton 5P 1150i G2 | line-interactive | tower | 34 | 2 520 zł | < 2 300 zł |
| Eaton 5SC 1000i | line-interactive | tower | 25 | 2 100 zł | < 1 900 zł |
| APC Smart-UPS SMT1000IC | line-interactive | tower | ~37 (szac.) | 2 600 zł | < 2 350 zł |
| CyberPower OLS1500ERT2UA | online | rack 2U | 30 (niepewne) | 2 120 zł | < 1 900 zł |

Czas przy 200 W pochodzi z wykresów producenta, interpolowany między punktami:
CyberPower publikuje krzywą w kodzie strony produktu, Eaton na `eg.eaton.com/ups-battery-runtime/`.
Trzy wyjątki są opisane w `config/products.json` (`runtime200W.note`):

- **Eaton 9E1000IR** ma wykres identyczny z 9SX, choć mniejsze baterie, więc liczę dolną granicę;
- **APC SMT1000IC** to szacunek z czasu przy połowie obciążenia;
- **OLS1500ERT2UA** ma wykres nierealnie płaski.

**OLS1000EA i OLS1000EA-DE są scalone jawnie.** Ta sama elektronika i baterie, różnią się
gniazdami (IEC C13 albo Schuko). Każde źródło ma pole `variant`, więc wariant widać przy
każdej ofercie w dashboardzie, w Issue i na Telegramie.

Odrzucone z listy startowej:
- **Eaton 9SX 1000i:** od ok. 3 900 zł, czyli poza budżetem 2–3 tys. zł.
- **Eaton 5P 1150iR (rack):** 3 400–4 600 zł, głębokość 509 mm.
- **APC Easy UPS SRV:** są zgłoszenia, że DSM go nie widzi.
- **FSP Champ 1K:** brak potwierdzonego USB HID, 8,9 min przy połowie obciążenia.
- **CyberPower OLS1500EA:** nie ma go w katalogu CyberPower EU.

## Zł za minutę

Spadek ceny mówi „ten model staniał". Nie mówi, czy to najlepsza okazja na całej liście.
Dlatego każdy model ma wskaźnik **zł/min = najniższa cena / minuty podtrzymania przy 200 W**,
a modele są w rankingu od najtańszej minuty:

- dashboard ma na górze tabelę rankingu, a karty modeli idą w tej samej kolejności;
- alert (Issue i Telegram) podaje zł/min i miejsce modelu, a na końcu najlepszą okazję całej listy;
- raport dzienny na Telegramie jest posortowany po zł/min.

Wskaźnik nie uwzględnia starzenia baterii ani różnicy online / line-interactive. To narzędzie
do porównania cen, nie ocena, który UPS kupić.

## Kiedy leci alert

Trzy niezależne wyzwalacze, alert przy **którymkolwiek**:

1. **Próg sztywny** — cena poniżej kwoty z tabeli wyżej.
2. **Mediana** — cena o 7% niżej niż mediana z 30 dni. Rusza po ośmiu pomiarach.
3. **Nowe minimum** — taniej niż kiedykolwiek wcześniej w historii.

Ta sama cena w tym samym sklepie nie alarmuje ponownie przez 24 h. Pierwszy przebieg nigdy
nie alarmuje.

**Alert porównuje cenę katalogową, nie koszt końcowy.** Koszt z dostawą jest w dashboardzie
i w treści alertu, ale ocenia go człowiek.

## Telegram

Ten sam bot co gen-watch. Wiadomości zaczynają się od „ups-watch", więc nie mieszają się
z innymi botami.

| Wiadomość | Kiedy | Ile razy |
|---|---|---|
| **Alert** | któryś z trzech wyzwalaczy | ta sama cena w tym samym sklepie najwyżej raz na 24 h |
| **Zmiana ceny** 📉📈 | najniższa cena modelu zmieniła się; z zł/min i miejscem w rankingu | przy każdej zmianie |
| **Raport dzienny** | pierwszy przebieg po 7:00 czasu polskiego, posortowany po zł/min | raz dziennie |
| **Awaria źródeł** | padło źródło, które nie jest `bestEffort` | ten sam zestaw awarii raz na 24 h |
| **Koniec obserwacji** | pierwszy przebieg po `meta.stopAfter` | raz |
| **Test** | ręcznie: Actions → „telegram test” → Run workflow | na żądanie |

Sekrety (Settings → Secrets and variables → Actions): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
Token bota `Agregaty_bot` z gen-watch (@BotFather → /mybots → API Token), chat_id ten sam.
Bez sekretów krok Telegrama cicho się pomija, a Issue działa dalej.

**Uwaga na laptopie:** zmienne Windows `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` należą do
car-watch (bot Forestera). Tor B ups-watch czyta najpierw `UPS_WATCH_TELEGRAM_BOT_TOKEN`
i `UPS_WATCH_TELEGRAM_CHAT_ID`, a wspólne zmienne tylko wtedy, gdy własnych nie ma.

## 30 dni i koniec

`meta.stopAfter` w `config/products.json` to ostatni dzień pracy (czas polski, włącznie).
Pierwszy przebieg po tej dacie nie skanuje, wysyła na Telegram „koniec obserwacji" z ostatnią
najlepszą okazją i wyłącza workflow (`gh workflow disable`). Historia na gałęzi `data`
i dashboard zostają. Przedłużenie: przesuń datę i Actions → ups-watch → Enable workflow.

## Skąd biorą się ceny

**Tor A (GitHub Actions)** czyta karty produktów z zamkniętej listy URL-i, warstwowo:
JSON-LD → microdata → `og:price` → regex z konfiguracji. Każda cena ma widełki 0,45×–2×
ceny bazowej, co odcina m.in. same baterie zamienne. Strona musi zawierać EAN albo token
modelu, inaczej wynik to `mismatch`, a nie cena.

Gdy zwykłe zapytanie odbije się od ochrony (403 albo strona pośrednia), bot otwiera **pełnego
Chrome'a z oknem na wirtualnym ekranie** (`xvfb-run`), a nie headless. To wzór z car-watch:
headless dostawał od Cloudflare 403, okno przechodziło nieinteraktywne sprawdzenie.
**Captchy bot nie rozwiązuje** i ochrony nie obchodzi. Strona z captchą kończy jako `blocked`.

Stan źródeł z pierwszego zapisu stron (13.10.2026, runner Actions):

| Źródło | Wynik |
|---|---|
| Morele, ITnes, Sferis, Proline, Netland24, Senetic, Cebit | cena z JSON-LD lub `og:price`, zwykłe zapytanie |
| Empik | cena przez Chrome |
| x-kom, Komputronik, Proshop, Premiumserwer | Cloudflare Turnstile („Cierpliwości…”) także dla Chrome'a, więc usunięte z toru A |
| Ceneo | captcha, tylko tor B z polskiego łącza |

**Senetic podaje w JSON-LD cenę netto.** Jego źródła mają `priceIsNet: true`, więc bot dolicza
23% VAT. Bez tego każdy model wyglądał tam o ok. 19% taniej i leciały fałszywe alerty.

## Tor B — skan lokalny i Allegro

| | Tor B1 — skan lokalny | Tor B2 — Allegro |
|---|---|---|
| Gdzie działa | `skan-lokalny.bat` z Harmonogramu zadań | Chrome z sesją Claude, na żądanie |
| Co obejmuje | Ceneo, Amazon | Allegro (tylko nowe, sprzedawcy z fakturą) |
| Zapis | gałąź `data`, poświadczeniami gita | Issue `UPS_Scan` → workflow `ingest` |
| Wyzwalacz alertu | tylko próg sztywny | tylko próg sztywny |

**Tor B1 jest wyłączony (`meta.localTrack: false`) do 18.10.2026.** Laptop jest poza Polską,
a z zagranicznego adresu Ceneo pokazuje captchę, a Komputronik 403. W logu gen-watch blokada
zaczyna się 05.10 wieczorem, dokładnie od wyjazdu; wcześniej oba działały z domowego łącza.
Po powrocie:

1. `node src/save-fixtures.mjs --track b` po dopisaniu `localSources` (Ceneo, Amazon) do modeli;
2. `meta.localTrack: true`;
3. `powershell -ExecutionPolicy Bypass -File scripts\zainstaluj-harmonogram.ps1 -Nazwa "ups-watch skan lokalny" -Godziny "07:10,18:10"`.

Przy wyłączonym torze B nie ma też sygnału „tor B milczy". Jego cisza nie jest wtedy wydarzeniem.

Tor B2 (Allegro) opisuje `BROWSER-SCAN.md`. Używane UPS-y są odrzucane już przy imporcie
(zużyte baterie).

## Uruchomienie od zera

1. Repo `drinkman1/ups-watch` (publiczne), `git push -u origin main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Sekrety Telegrama (wyżej).
4. Actions → **fixtures** → Run workflow; przejrzyj ceny w podsumowaniu, rozpakuj artefakt
   do `test/fixtures`, commit.
5. Actions → **ups-watch** → Run workflow z `dry_run` = podgląd bez zapisu i alertów.
6. Actions → ups-watch → Run workflow bez `dry_run`: pierwszy przebieg zbuduje baseline.
7. Dashboard: `https://drinkman1.github.io/ups-watch/`

## Testy

```
npm run check
```

Testy offline: parser cen, wyzwalacze, ranking zł/min, termin pracy, Telegram, ingest
(tylko nowe egzemplarze) i konfiguracja. Sprawdzają też, że w konfiguracji nie ma
lokalizacji ani danych sieci, bo repo jest publiczne.

`test/fixtures/` trzyma prawdziwą stronę **każdego** źródła toru A. `npm run check` przepuszcza
ją przez pełny `scrapeSource` i porównuje wynik co do grosza. Źródło bez zapisanej strony to
czerwony test. Odświeżenie po zmianie strony sklepu: Actions → fixtures z polem `only`
(np. `x-kom,morele`). Przed commitem porównaj `expect` z ceną widoczną w sklepie.

## Czego ten bot NIE robi

- **Nie obchodzi captchy ani blokad.** Źródło z captchą jest `blocked` i tyle.
- **Nie czyta specyfikacji ze sklepów.** Czas podtrzymania i wymiary są od producenta,
  a link jest przy każdym modelu.
- **Nie ocenia, który UPS kupić.** Podaje cenę, zł/min i historię. Decyzja jest po stronie człowieka.
- **Nie zapisuje niczego o domu ani sieci.** Repo jest publiczne: żadnych adresów IP, nazw
  hostów, lokalizacji. Sekrety tylko w GitHub Secrets.

## Diagnostyka

`status: degraded` znaczy „padło źródło, które nie jest `bestEffort`". `status: error` znaczy
„któryś model nie ma w ogóle ceny" i kończy przebieg kodem 1. Zero ofert przy statusie `ok`
to „sprawdzone, nie ma", a zero ofert przy `blocked` to „nie wiemy".

```
npm run dry                          # podgląd lokalny bez zapisu
npm run scan:one -- ols1000ea        # jeden model
```
