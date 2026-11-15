# Gestionale Lunara · Google Sheets

Sorgenti della Web App Google Apps Script collegata al foglio Google (ID configurato in Code.gs). L'app viene eseguita come utente che la apre: nessuna password o chiave privata è pubblicata nel repository.

## Pubblicazione iniziale
1. Accedi a https://script.google.com/ con l'account autorizzato sul foglio.
2. Crea un progetto **Lunara Gestionale**.
3. Copia Code.gs in un file Script e Index.html in un file HTML chiamato Index.
4. Esegui getDashboard dall'editor e autorizza l'accesso.
5. Distribuisci come App web, esegui come **utente che accede all'app** e limita l'accesso agli account Google autorizzati.
6. Apri l'URL generato. Ogni salvataggio scrive nel foglio; Aggiorna rilegge i dati.

## Protezioni e limiti della prima versione
- KPIs è in sola lettura.
- Le colonne in cui vengono rilevate formule sono protette.
- Non vengono eliminate righe.
- Sono mostrate al massimo 250 righe.
- Il rilevamento delle intestazioni è automatico: va verificato su una copia del foglio prima di usare il pannello con dati reali.
- Sincronizzazione al salvataggio e al refresh, non aggiornamento live continuo.
- Ogni utente deve avere accesso Google al foglio. Non rendere il foglio pubblico.

I sorgenti sono nel branch dev. La distribuzione Apps Script deve essere effettuata dall'account Google che ha accesso al foglio.
