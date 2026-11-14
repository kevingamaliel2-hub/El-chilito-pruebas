const PrivacyController = (() => {
  function mount({root}) {
    root.innerHTML = PrivacyViews.account();
    const mine = MyPrivacyController.mount(root.querySelector('[data-my-privacy]'));
    return {dispose() { mine.dispose(); }};
  }
  return {mount};
})();
