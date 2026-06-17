# BigQuery Release Monitor 🚀

Nowoczesna aplikacja webowa napisana w języku **Python (Flask)** oraz czystym **HTML5, CSS3 i JavaScript**, służąca do monitorowania, filtrowania oraz udostępniania na platformie X (Twitter) oficjalnych informacji o wydaniach (Release Notes) usługi **Google Cloud BigQuery**.

---

## 🌟 Główne Funkcje

1. **Szczegółowe Parsowanie Kanału XML (Atom)**
   - Pobiera oficjalny kanał RSS/Atom Google Cloud z informacjami o wydaniach BigQuery.
   - Automatycznie analizuje zawartość HTML (CDATA) i rozbija zbiorcze wpisy z poszczególnych dni na osobne, czytelne karty (np. jako osobne zgłoszenia dotyczące nowej funkcji, błędu czy wycofania funkcjonalności).

2. **Inteligentny Serwerowy Cache**
   - Wbudowany w backend mechanizm buforowania danych (czas życia cache: 5 minut) eliminuje zbędne zapytania sieciowe, zapobiega blokadom typu *rate-limiting* ze strony Google i skraca czas ładowania strony do minimum.

3. **Ciemny, Nowoczesny Interfejs (Dark Mode)**
   - Spójny, profesjonalny design inspirowany konsolą Google Cloud.
   - Kolorystyczne kodowanie typów aktualizacji (fioletowy dla *Feature*, żółty dla *Issue*, czerwony dla *Deprecation* itd.).
   - Płynne animacje liczników statystyk w panelu bocznym oraz szkielety kart (*skeleton loaders*) podczas ładowania danych.

4. **Wyszukiwanie i Dynamiczne Filtrowanie**
   - Wyszukiwarka tekstowa działająca w czasie rzeczywistym po stronie klienta.
   - Możliwość filtrowania wyświetlanych informacji na osi czasu poprzez zaznaczanie lub odznaczanie kategorii wpisów.

5. **Kreator Postów na platformie X (Twitter)**
   - Pozwala wybrać dowolny wpis z osi czasu i automatycznie przygotować treść tweeta.
   - **Precyzyjne zliczanie znaków:** Uwzględnia algorytm platformy X, gdzie każdy link (URL) jest traktowany jako dokładnie 23 znaki, niezależnie od jego rzeczywistej długości.
   - Automatycznie dodaje powiązane hasztagi (`#BigQuery #GoogleCloud`) oraz bezpośredni odnośnik do dokumentacji wydania.
   - Zabezpiecza przed przekroczeniem limitu 280 znaków (dynamiczny pasek postępu i blokada wysyłania).

---

## 📂 Struktura Projektu

```text
bq-releases-notes/
├── app.py                # Serwer Flask (routing, parsowanie XML, pamięć podręczna)
├── requirements.txt      # Zależności Pythona (Flask, requests, beautifulsoup4)
├── README.md             # Dokumentacja projektu (ten plik)
├── .gitignore            # Reguły wykluczeń dla systemu kontroli wersji Git
├── templates/
│   └── index.html        # Struktura strony (Dashboard, osie czasu, moduł modalny X)
└── static/
    ├── css/
    │   └── style.css     # Style CSS (responsywność, kolory, efekty, szkielety)
    └── js/
        └── main.js       # Logika JS (zapytania API, animacje, filtry, walidacja X)
```

---

## 🛠️ Wymagania i Uruchomienie

### Wymagania systemowe
- Python 3.8 lub nowszy
- Połączenie internetowe (do pobierania aktualnych danych z serwerów Google)

### Kroki do uruchomienia lokalnego

1. **Klonowanie / Wejście do katalogu projektu:**
   ```bash
   cd C:\Users\Hp\source\repos\agy-cli-projects\bq-releases-notes
   ```

2. **Tworzenie i aktywacja wirtualnego środowiska (opcjonalnie, jeśli konfigurujesz od zera):**
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Instalacja zależności:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Uruchomienie serwera Flask:**
   ```bash
   python app.py
   ```

5. **Korzystanie z aplikacji:**
   Otwórz przeglądarkę internetową i przejdź pod adres:
   👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 💻 Wykorzystane Technologie
- **Backend:** Python 3.13, Flask, Requests (HTTP Client), BeautifulSoup4 (HTML Parser), Xml.Etree.ElementTree (XML Parser).
- **Frontend:** HTML5, CSS3 (Flexbox, Grid, CSS Variables, Keyframe Animations), Vanilla JS (ES6+, Async/Await, Fetch API, RegEx).
- **Ikony:** FontAwesome 6.4.0.
- **Fonty:** Inter, Outfit (Google Fonts).
