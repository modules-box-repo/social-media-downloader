/* Custom dropdown pickers */

function setupSimplePicker(inputId, triggerId, menuId, options) {
  const input = $(`#${inputId}`);
  const trigger = $(`#${triggerId}`);
  const menu = $(`#${menuId}`);

  menu.innerHTML = options.map(option =>
    `<button type="button" class="format-option" data-value="${option.value}">
      <span class="format-main">${option.label}</span>
      <small>${option.note}</small>
    </button>`
  ).join("");

  trigger.onclick = () => {
    document.querySelectorAll(".format-menu").forEach(item => {
      if (item !== menu) item.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
  };

  menu.querySelectorAll(".format-option").forEach(item =>
    item.onclick = () => {
      input.value = item.dataset.value;
      trigger.innerHTML = `${item.dataset.value.toUpperCase()} <span>⌄</span>`;
      menu.classList.add("hidden");
    }
  );
}
