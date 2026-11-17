/* Classico, sincrono e piccolo: parte prima dei fogli e del bundle del catalogo. */
(function () {
  'use strict';
  var root = document.documentElement, query = new URLSearchParams(location.search);
  var now = Date.now(), transferred = Number(query.get('apollonStart'));
  var start = transferred > 0 && transferred <= now && now - transferred < 120000 ? transferred : now;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var completed = query.get('apollonIntro') === 'done', readyPromise, watchdog;
  try { if (query.get('apollonLaunch') !== '1') completed = completed || sessionStorage.getItem('apollon:intro') === 'done'; } catch (e) {}
  if (!completed) {
    root.classList.add('booting');
    root.style.setProperty('--apollon-delay', '-' + Math.min(1850, now - start) + 'ms');
    watchdog = setTimeout(function () {
      var status = document.getElementById('apollon-boot-status');
      var retry = document.getElementById('apollon-boot-retry');
      if (status) status.textContent = 'La raccolta non risponde. Controlla la rete di casa e riprova.';
      if (retry) { retry.hidden = false; retry.focus(); }
    }, 12000);
  }
  // Il timestamp si consuma: un normale ricaricamento non è un nuovo avvio del guscio.
  if (query.has('apollonStart') || query.has('apollonLaunch') || query.has('apollonIntro')) {
    query.delete('apollonStart'); query.delete('apollonLaunch'); query.delete('apollonIntro');
    try { history.replaceState(history.state, '', location.pathname + (query.toString() ? '?' + query.toString() : '') + location.hash); } catch (e) {}
  }
  function finish() {
    clearTimeout(watchdog);
    var intro = document.getElementById('apollon-intro');
    if (intro) intro.hidden = true;
    root.classList.remove('booting');
    try { sessionStorage.setItem('apollon:intro', 'done'); } catch (e) {}
    completed = true;
  }
  window.ApollonBoot = {
    ready: function () {
      if (readyPromise) return readyPromise;
      clearTimeout(watchdog);
      readyPromise = new Promise(function (resolve) {
        if (completed || reduced) { finish(); resolve(); return; }
        setTimeout(function () {
          var intro = document.getElementById('apollon-intro');
          if (intro) intro.classList.add('leaving');
          setTimeout(function () { finish(); resolve(); }, 220);
        }, Math.max(0, 2100 - (Date.now() - start)));
      });
      return readyPromise;
    }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var retry = document.getElementById('apollon-boot-retry');
    if (retry) retry.addEventListener('click', function () { location.reload(); });
  });
}());
