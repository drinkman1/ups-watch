# Tor B2 — Allegro przez przeglądarkę

Instrukcja dla sesji Claude z Chrome'em, uruchamianej na żądanie. Ten plik jest kontraktem:
sesja czyta go i wykonuje krok po kroku, zamiast improwizować.

## Dlaczego osobny tor

Allegro blokuje adresy IP centrów danych, a runnery GitHub Actions stoją w Azure. Chrome na
laptopie ma zwykły adres i zalogowaną sesję. Tylko z tego powodu ten tor istnieje.

## Co sprawdzić

Modele i progi bierz z `config/products.json` (repo publiczne, czytaj surowy plik z
`raw.githubusercontent.com/drinkman1/ups-watch/main/config/products.json`). Nie przepisuj ich
do promptu, bo rozjadą się przy pierwszej zmianie.

Dla każdego modelu: Allegro, wyszukiwanie po kodzie modelu (`OLS1000EA`, `PR1000ERT2U`,
`9E1000IR`…), filtr **Stan: nowe**.

## Reguły oceny

1. **Tylko nowe egzemplarze.** Używany UPS ma zużyte baterie, a komplet kosztuje kilkaset
   złotych. Ingest odrzuca `used` i `unknown`.
2. **Uważaj na same baterie i akcesoria.** „RBP0128 do PR1000ERT2U”, „bateria do SMT1000IC”,
   „karta sieciowa”, „szyny” to nie UPS. Cena kilkaset złotych przy modelu za 2 tys. to sygnał.
3. **Wariant musi się zgadzać.** `OLS1000EA` i `OLS1000EA-DE` to jedna pozycja (różnią się
   gniazdami), ale `OLS1000ERT2UA-B`, `PR1000ERT2UC`, `5SC1000IR` (rack) przy `5SC1000I` to inne
   produkty. Wariant zapisz w `note`.
4. **Sprzedawca firmowy z fakturą VAT i gwarancją producenta.** Oferty prywatne pomijaj.

## Co zrobić z wynikiem — Issue jako skrzynka podawcza

1. Zbuduj ładunek w dokładnie takim kształcie:

   ~~~
   ```json
   {
     "scan": "2026-10-20T08:00:00Z",
     "offers": [
       {
         "productId": "ols1000ea",
         "site": "allegro",
         "price": 989,
         "condition": "new",
         "url": "https://allegro.pl/oferta/...",
         "note": "OLS1000EA-DE, sprzedawca firmowy, faktura VAT"
       }
     ]
   }
   ```
   ~~~

   `productId` z `config/products.json`. `site`: `allegro`, `ceneo`, `amazon` albo `inne`.
   `condition`: tylko `new` przechodzi.

2. Otwórz w Chrome adres z wypełnionym formularzem, sprawdź podgląd i kliknij **Submit new issue**:

   ```
   https://github.com/drinkman1/ups-watch/issues/new?labels=UPS_Scan&title=Skan+Allegro&body=<ładunek zakodowany URL-em>
   ```

   Etykieta `UPS_Scan` jest obowiązkowa, bez niej workflow nie ruszy.

3. Workflow `ingest` odpowie komentarzem: ile ofert przyjął, co odrzucił i dlaczego, które
   schodzą poniżej progu. Przy udanym imporcie sam zamyka zgłoszenie.

4. Jeśli coś schodzi poniżej progu, napisz o tym w rozmowie od razu.

## Bezpieczeństwo

Repo jest publiczne, więc Issue może założyć każdy. Workflow przetwarza wyłącznie zgłoszenia
właściciela repo z etykietą `UPS_Scan`. Treść idzie przez `JSON.parse`, jest walidowana pole
po polu i nigdy nie trafia do polecenia powłoki. Adresy inne niż `https://` są odrzucane.
W ładunku nie ma miejsca na lokalizację i nie wpisuj jej do `note`.
