// Бриф в подвале: проверка полей на клиенте, состояния «Отправляем…», успех, сбой.
// Пока PUBLIC_FORM=false (до задачи 46), после проверки сразу показываем сбой с запасным путём в Telegram — данные никуда не уходят.
// Переход по #zayavka (липкая кнопка, «Контакты») переводит фокус на заголовок брифа.
const box = document.querySelector<HTMLElement>('[data-brief]');

if (box) {
  const form = box.querySelector('form')!;
  const btn = form.querySelector<HTMLButtonElement>('.bf-btn')!;
  const fail = form.querySelector<HTMLElement>('.bf-fail')!;
  const done = box.querySelector<HTMLElement>('.bf-done')!;
  const formOn = box.dataset.formOn === '1';
  let sending = false;

  const errOf = (el: HTMLInputElement | HTMLTextAreaElement) =>
    document.getElementById(el.getAttribute('aria-describedby') || '');

  function check(el: HTMLInputElement): boolean {
    const ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
    const err = errOf(el);
    if (ok) { el.removeAttribute('aria-invalid'); if (err) err.textContent = ''; }
    else { el.setAttribute('aria-invalid', 'true'); if (err) err.textContent = err.dataset.msg || ''; }
    return ok;
  }

  const required = [...form.querySelectorAll<HTMLInputElement>('[required]')];
  // ошибку снимаем, как только поле исправили; новую не показываем, пока не нажали «Отправить»
  required.forEach((el) => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
    if (el.getAttribute('aria-invalid') === 'true') check(el);
  }));

  function setSending(on: boolean) {
    sending = on;
    btn.textContent = on ? 'Отправляем…' : btn.dataset.label || '';
    if (on) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
  }

  function showFail() {
    box!.classList.add('is-failed');
    fail.hidden = false;
    fail.querySelector<HTMLElement>('a')?.focus();
  }

  function showDone() {
    form.hidden = true;
    done.hidden = false;
    done.querySelector<HTMLElement>('.bf-h')?.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const bad = required.filter((el) => !check(el));
    if (bad.length) { bad[0].focus(); return; }
    if (!formOn) { showFail(); return; }

    // задача 46: api/send.php принимает поля формы и отвечает 2xx, если заявка записана
    setSending(true);
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form) });
      if (!res.ok) throw new Error(String(res.status));
      showDone();
    } catch {
      setSending(false);
      showFail();
    }
  });

  // правка полей после сбоя возвращает кнопку отправки
  form.addEventListener('input', () => {
    if (fail.hidden) return;
    fail.hidden = true;
    box.classList.remove('is-failed');
  });

  // #zayavka: фокус на заголовок, чтобы с клавиатуры сразу попасть в форму
  const focusTitle = () => {
    if (location.hash !== '#zayavka') return;
    box.querySelector<HTMLElement>(form.hidden ? '.bf-done .bf-h' : '#bf-h')?.focus({ preventScroll: true });
  };
  addEventListener('hashchange', focusTitle);
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href$="#zayavka"]');
    if (a && a.pathname === location.pathname) setTimeout(focusTitle, 0);
  });
  focusTitle();
}
