/* custom-select.js – rewrite com lógica de fecho robusta */
(function () {
  const registry = new WeakMap();

  // Fecha todos os dropdowns abertos excepto o indicado
  function closeAllExcept(except) {
    document.querySelectorAll('.custom-select-options.open').forEach(ul => {
      if (ul !== except) ul.classList.remove('open');
    });
  }

  function buildOptions(originalSelect, optionsList, selected) {
    optionsList.innerHTML = '';

    Array.from(originalSelect.options).forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'custom-select-option';
      li.textContent = opt.textContent;
      li.dataset.value = opt.value;
      if (opt.disabled) li.classList.add('disabled');
      if (opt.selected) {
        selected.textContent = opt.textContent;
        li.classList.add('selected');
      }

      // Usar mousedown para capturar a selecção ANTES de qualquer evento click
      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // previne perda de foco e eventos subsequentes
        e.stopPropagation();

        if (li.classList.contains('disabled')) return;

        // Actualizar o select nativo
        originalSelect.value = li.dataset.value;
        originalSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // Actualizar o UI
        selected.textContent = li.textContent;
        optionsList.querySelectorAll('.custom-select-option.selected')
          .forEach(s => s.classList.remove('selected'));
        li.classList.add('selected');

        // Fechar imediatamente
        optionsList.classList.remove('open');
      });

      optionsList.appendChild(li);
    });

    // Garantir que o texto do botão está preenchido
    if (!selected.textContent.trim()) {
      const selOpt = originalSelect.options[originalSelect.selectedIndex];
      selected.textContent = selOpt ? selOpt.textContent : '';
    }
  }

  function createCustomSelect(originalSelect) {
    if (originalSelect.dataset.custom === 'true') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    const selected = document.createElement('div');
    selected.className = 'custom-select-selected';
    selected.tabIndex = 0;

    const optionsList = document.createElement('ul');
    optionsList.className = 'custom-select-options';
    optionsList.style.cssText = 'position:fixed;z-index:99999;';

    buildOptions(originalSelect, optionsList, selected);

    wrapper.appendChild(selected);
    originalSelect.style.display = 'none';
    originalSelect.parentNode.insertBefore(wrapper, originalSelect.nextSibling);
    document.body.appendChild(optionsList);
    originalSelect.dataset.custom = 'true';

    function positionOptions() {
      const rect = wrapper.getBoundingClientRect();
      optionsList.style.left   = rect.left + 'px';
      optionsList.style.top    = (rect.bottom + 4) + 'px';
      optionsList.style.width  = rect.width + 'px';
    }

    function closeOptions() {
      optionsList.classList.remove('open');
      document.removeEventListener('mousedown', onOutsideClick);
    }

    function openOptions() {
      closeAllExcept(optionsList);
      positionOptions();
      optionsList.classList.add('open');
      // Adicionar listener de fecho externo num timeout para não capturar o próprio clique
      setTimeout(() => {
        document.addEventListener('mousedown', onOutsideClick);
      }, 0);
    }

    function onOutsideClick(e) {
      // Fechar se o clique foi fora do wrapper e fora da lista
      if (!wrapper.contains(e.target) && !optionsList.contains(e.target)) {
        closeOptions();
      }
    }

    selected.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (optionsList.classList.contains('open')) {
        closeOptions();
      } else {
        openOptions();
      }
    });

    selected.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (optionsList.classList.contains('open')) closeOptions();
        else openOptions();
      }
      if (e.key === 'Escape') closeOptions();
    });

    window.addEventListener('scroll', () => {
      if (optionsList.classList.contains('open')) positionOptions();
    }, true);

    window.addEventListener('resize', () => {
      if (optionsList.classList.contains('open')) positionOptions();
    });

    window.addEventListener('beforeunload', () => {
      try { optionsList.remove(); } catch (e) {}
    });

    const controller = {
      refresh() {
        closeOptions();
        selected.textContent = '';
        buildOptions(originalSelect, optionsList, selected);
      },
      setDisabled(val) {
        selected.style.opacity = val ? '0.5' : '1';
        selected.style.pointerEvents = val ? 'none' : '';
      }
    };

    registry.set(originalSelect, controller);
    return controller;
  }

  window.CustomSelect = {
    refresh(selectEl) {
      const ctrl = registry.get(selectEl);
      if (ctrl) ctrl.refresh();
    },
    setDisabled(selectEl, val) {
      const ctrl = registry.get(selectEl);
      if (ctrl) ctrl.setDisabled(val);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.filter-group select, .form-group select')
      .forEach(s => createCustomSelect(s));
  });
})();
