# Dashboard Local

Dashboard interattiva con funzionalità di calcolatrice, visualizzazione valute e calendario.

## Pubblicazione Automatica su GitHub Pages

Questo repository è configurato per la pubblicazione automatica su GitHub Pages tramite GitHub Actions.

### Come Attivare GitHub Pages

Per attivare la pubblicazione automatica del sito, segui questi passaggi:

1. Vai alle **Settings** (Impostazioni) del repository su GitHub
2. Nel menu laterale, clicca su **Pages**
3. Nella sezione **Source** (Origine), seleziona:
   - **Source**: Deploy from a branch → cambia in **GitHub Actions**
4. Salva le modificazioni

### Funzionamento

Dopo la configurazione:
- Ogni commit pushato sul branch `main` attiverà automaticamente il workflow di deployment
- Il workflow si trova in `.github/workflows/deploy.yml`
- Il sito verrà pubblicato su `https://<username>.github.io/dashboard.local/`
- Puoi monitorare lo stato del deployment nella tab **Actions** del repository

### Struttura del Progetto

- `index.html` - Pagina principale
- `styles.css` - Stili principali
- `calculator.css` - Stili calcolatrice
- `calc-sheet.css` - Stili foglio di calcolo
- `script.js` - Script principale
- `calculator.js` - Logica calcolatrice
- `calculator-engine.js` - Engine calcolatrice
- `calc-sheet.js` - Logica foglio di calcolo
- `moon.js` - Visualizzazione fasi lunari
