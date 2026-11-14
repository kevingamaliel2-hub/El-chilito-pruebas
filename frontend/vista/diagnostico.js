// Tarjeta del huerto: todo el contenido variable se inserta con textContent.
const GardenDiagnosisViews = (() => {
  const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? {className} : {}, text !== undefined ? {textContent:text} : {});
  function nextAction(text) {
    const box = el('div', 'user-next-action');
    box.append(el('span', '', 'Próxima acción estimada'), el('strong', '', text));
    return box;
  }
  function explanation({state, text, note}) {
    const box = el('div', `user-diagnosis-explanation is-${state}`);
    if(text) box.append(el('p', '', text));
    box.append(el('p', 'user-diagnosis-meta', note));
    return box;
  }
  // Sin resumen se conserva el texto fijo de la plantilla.
  function paint(card, view) {
    if(!view) return;
    card.querySelector('[data-diagnosis-title]').textContent = view.title;
    card.querySelector('[data-diagnosis-text]').textContent = view.message;
    const details = card.querySelector('[data-diagnosis-details]');
    details.replaceChildren(...(view.next ? [nextAction(view.next)] : []), el('p', 'user-diagnosis-meta', view.readings), el('p', 'user-diagnosis-meta', view.origin),
      ...(view.explanation ? [explanation(view.explanation)] : []));
  }
  return Object.freeze({paint});
})();
