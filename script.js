const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.target;

    tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
    panels.forEach((panel) => {
      const shouldShow = panel.id === targetId;
      panel.classList.toggle('is-active', shouldShow);
    });
  });
});

const navigationTargets = {
  'start-game-one': 'cupgame/cupgame.html',
  'start-game-two': 'ddongP/ddongP.html',
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action } = button.dataset;
  const target = navigationTargets[action];
  if (!target) return;

  window.location.href = target;
});
