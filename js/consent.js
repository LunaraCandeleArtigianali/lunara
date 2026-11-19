/* Gestione locale del consenso alle statistiche Lunara */
(() => {
  const KEY = 'lunara_analytics_consent';
  const readChoice = () => {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch (_) {
      return null;
    }
  };
  const updateGoogleConsent = choice => {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: choice === 'granted' ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  };
  const saveChoice = choice => {
    try { localStorage.setItem(KEY, choice); } catch (_) {}
    updateGoogleConsent(choice);
    panel.hidden = true;
  };

  const panel = document.createElement('section');
  panel.className = 'cookie-consent';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'cookie-consent-title');
  panel.setAttribute('aria-describedby', 'cookie-consent-description');
  panel.innerHTML = `
    <h2 id="cookie-consent-title">La tua privacy conta</h2>
    <p id="cookie-consent-description">Lunara utilizza statistiche per capire come viene usato il sito e migliorarlo. Le statistiche Google Analytics restano disattivate finché non scegli di abilitarle. Puoi cambiare idea in qualsiasi momento. <a href="privacy.html">Informativa privacy</a>.</p>
    <div class="cookie-consent__actions">
      <button class="cookie-consent__button cookie-consent__button--primary" type="button" data-consent="granted">Accetta statistiche</button>
      <button class="cookie-consent__button" type="button" data-consent="denied">Rifiuta statistiche</button>
    </div>`;
  document.body.appendChild(panel);

  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-consent]');
    if (button) saveChoice(button.dataset.consent);
  });
  document.querySelectorAll('[data-cookie-settings]').forEach(button => {
    button.addEventListener('click', () => {
      panel.hidden = false;
      panel.querySelector('[data-consent="granted"]').focus();
    });
  });

  if (readChoice()) panel.hidden = true;
})();
