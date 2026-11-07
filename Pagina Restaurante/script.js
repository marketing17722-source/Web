"use strict";

/* ==========================================================
   1. CONSTANTES Y ESTADO
   ========================================================== */
const STORAGE_KEY = "saborBrasa.productos.v1";

const CATEGORIES = ["Entradas", "Platos principales", "Bebidas", "Postres", "Especialidades"];
const AVAILABILITY_OPTIONS = ["Disponible", "No disponible"];

const SAMPLE_PRODUCTS = [
  { code: "EN-001", name: "Bruschetta de tomate", category: "Entradas", price: 320, description: "Pan artesanal tostado con tomate fresco, albahaca y aceite de oliva.", availability: "Disponible" },
  { code: "PP-001", name: "Risotto de hongos", category: "Platos principales", price: 780, description: "Arroz arborio cremoso con hongos silvestres y queso parmesano.", availability: "Disponible" },
  { code: "BE-001", name: "Limonada de jengibre", category: "Bebidas", price: 180, description: "Limonada natural con jengibre fresco y hojas de menta.", availability: "Disponible" },
  { code: "PO-001", name: "Flan de coco", category: "Postres", price: 260, description: "Flan casero de coco con caramelo tostado.", availability: "No disponible" },
  { code: "ES-001", name: "Pulpo a la brasa", category: "Especialidades", price: 1150, description: "Pulpo tierno asado al carbón con puré rústico y pimentón ahumado.", availability: "Disponible" }
];

const priceFormatter = new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP" });

let products = [];
let editingCode = null;
let searchTerm = "";
let toastTimer = null;

/* ==========================================================
   2. REFERENCIAS AL DOM
   ========================================================== */
const dom = {
  form: document.getElementById("product-form"),
  formTitle: document.getElementById("form-title"),
  submitBtn: document.getElementById("submit-btn"),
  cancelBtn: document.getElementById("cancel-btn"),
  fields: {
    code: document.getElementById("code"),
    name: document.getElementById("name"),
    category: document.getElementById("category"),
    price: document.getElementById("price"),
    description: document.getElementById("description"),
    availability: document.getElementById("availability")
  },
  search: document.getElementById("search"),
  list: document.getElementById("product-list"),
  emptyState: document.getElementById("empty-state"),
  resultsInfo: document.getElementById("results-info"),
  statTotal: document.getElementById("stat-total"),
  statAvailable: document.getElementById("stat-available"),
  statUnavailable: document.getElementById("stat-unavailable"),
  toast: document.getElementById("toast"),
  confirmDialog: document.getElementById("confirm-dialog"),
  confirmMessage: document.getElementById("confirm-message")
};

/* ==========================================================
   3. ALMACENAMIENTO (localStorage)
   ========================================================== */
function isValidStoredProduct(item) {
  return item
    && typeof item.code === "string"
    && typeof item.name === "string"
    && typeof item.category === "string"
    && typeof item.price === "number"
    && typeof item.description === "string"
    && typeof item.availability === "string";
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Primera ejecución: se cargan productos ficticios de ejemplo.
      const initial = SAMPLE_PRODUCTS.map((product) => ({ ...product }));
      persistProducts(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidStoredProduct) : [];
  } catch (error) {
    console.error("No se pudieron leer los productos almacenados:", error);
    showToast("No se pudo leer la información guardada. Se inició una lista vacía.", true);
    return [];
  }
}

function persistProducts(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los productos:", error);
    showToast("No se pudo guardar en el navegador (almacenamiento lleno o bloqueado).", true);
    return false;
  }
}

/* ==========================================================
   4. UTILIDADES
   ========================================================== */
function normalizeText(text) {
  return text.trim().toLowerCase();
}

function formatPrice(value) {
  return priceFormatter.format(value);
}

function findProductIndexByCode(code) {
  const target = normalizeText(code);
  return products.findIndex((product) => normalizeText(product.code) === target);
}

function fillSelect(selectElement, options) {
  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option;
    optionElement.textContent = option;
    selectElement.appendChild(optionElement);
  });
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.toggle("toast-error", isError);
  dom.toast.hidden = false;
  toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 3500);
}

function confirmAction(message) {
  if (typeof dom.confirmDialog.showModal !== "function") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    dom.confirmMessage.textContent = message;
    dom.confirmDialog.returnValue = "";
    const handleClose = () => {
      dom.confirmDialog.removeEventListener("close", handleClose);
      resolve(dom.confirmDialog.returnValue === "confirm");
    };
    dom.confirmDialog.addEventListener("close", handleClose);
    dom.confirmDialog.showModal();
  });
}

/* ==========================================================
   5. VALIDACIÓN DEL FORMULARIO
   ========================================================== */
function readFormData() {
  return {
    code: dom.fields.code.value.trim(),
    name: dom.fields.name.value.trim(),
    category: dom.fields.category.value,
    price: dom.fields.price.value.trim(),
    description: dom.fields.description.value.trim(),
    availability: dom.fields.availability.value
  };
}

function validateProduct(data) {
  const errors = {};

  if (!data.code) {
    errors.code = "El código es obligatorio.";
  } else {
    const existingIndex = findProductIndexByCode(data.code);
    const isOwnCode = editingCode !== null && normalizeText(editingCode) === normalizeText(data.code);
    if (existingIndex !== -1 && !isOwnCode) {
      errors.code = "Ya existe un producto con ese código.";
    }
  }

  if (!data.name) errors.name = "El nombre es obligatorio.";

  if (!CATEGORIES.includes(data.category)) errors.category = "Seleccione una categoría.";

  if (data.price === "") {
    errors.price = "El precio es obligatorio.";
  } else {
    const numericPrice = Number(data.price);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      errors.price = "Ingrese un número mayor que cero.";
    }
  }

  if (!data.description) errors.description = "La descripción es obligatoria.";

  if (!AVAILABILITY_OPTIONS.includes(data.availability)) {
    errors.availability = "Seleccione la disponibilidad.";
  }

  return errors;
}

function clearFieldErrors() {
  Object.keys(dom.fields).forEach((fieldName) => {
    dom.fields[fieldName].closest(".field").classList.remove("has-error");
    document.getElementById(`error-${fieldName}`).textContent = "";
  });
}

function showFieldErrors(errors) {
  clearFieldErrors();
  Object.entries(errors).forEach(([fieldName, message]) => {
    dom.fields[fieldName].closest(".field").classList.add("has-error");
    document.getElementById(`error-${fieldName}`).textContent = message;
  });
  const firstInvalid = Object.keys(errors)[0];
  if (firstInvalid) dom.fields[firstInvalid].focus();
}

/* ==========================================================
   6. REGISTRO Y EDICIÓN
   ========================================================== */
function buildProductFromForm(data) {
  return {
    code: data.code,
    name: data.name,
    category: data.category,
    price: Number(data.price),
    description: data.description,
    availability: data.availability
  };
}

function registerProduct(product) {
  const updatedList = [...products, product];
  if (!persistProducts(updatedList)) return false;
  products = updatedList;
  return true;
}

function updateProduct(originalCode, product) {
  const index = findProductIndexByCode(originalCode);
  if (index === -1) {
    showToast("No se encontró el producto a editar.", true);
    return false;
  }
  const updatedList = products.map((item, itemIndex) => (itemIndex === index ? product : item));
  if (!persistProducts(updatedList)) return false;
  products = updatedList;
  return true;
}

function handleFormSubmit(event) {
  event.preventDefault();

  const data = readFormData();
  const errors = validateProduct(data);

  if (Object.keys(errors).length > 0) {
    showFieldErrors(errors);
    return;
  }

  clearFieldErrors();
  const product = buildProductFromForm(data);
  const isEditing = editingCode !== null;
  const success = isEditing ? updateProduct(editingCode, product) : registerProduct(product);

  if (!success) return;

  showToast(isEditing
    ? `Producto "${product.name}" actualizado correctamente.`
    : `Producto "${product.name}" registrado correctamente.`);
  resetForm();
  renderAll();
}

function startEditing(code) {
  const index = findProductIndexByCode(code);
  if (index === -1) return;
  const product = products[index];

  editingCode = product.code;
  dom.fields.code.value = product.code;
  dom.fields.name.value = product.name;
  dom.fields.category.value = product.category;
  dom.fields.price.value = product.price;
  dom.fields.description.value = product.description;
  dom.fields.availability.value = product.availability;

  clearFieldErrors();
  dom.formTitle.textContent = "Editar producto";
  dom.submitBtn.textContent = "Guardar cambios";
  dom.cancelBtn.hidden = false;

  renderProducts();
  dom.form.scrollIntoView({ behavior: "smooth", block: "start" });
  dom.fields.name.focus();
}

function resetForm() {
  editingCode = null;
  dom.form.reset();
  clearFieldErrors();
  dom.formTitle.textContent = "Registrar producto";
  dom.submitBtn.textContent = "Registrar producto";
  dom.cancelBtn.hidden = true;
}

function handleCancelEdit() {
  resetForm();
  renderProducts();
}

/* ==========================================================
   7. ELIMINACIÓN
   ========================================================== */
async function handleDelete(code) {
  const index = findProductIndexByCode(code);
  if (index === -1) return;
  const product = products[index];

  const confirmed = await confirmAction(`¿Desea eliminar "${product.name}" (${product.code})? Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  const updatedList = products.filter((item) => normalizeText(item.code) !== normalizeText(code));
  if (!persistProducts(updatedList)) return;
  products = updatedList;

  if (editingCode !== null && normalizeText(editingCode) === normalizeText(code)) resetForm();

  showToast(`Producto "${product.name}" eliminado.`);
  renderAll();
}

/* ==========================================================
   8. BÚSQUEDA
   ========================================================== */
function getFilteredProducts() {
  const term = normalizeText(searchTerm);
  if (!term) return products;
  return products.filter((product) => normalizeText(product.name).includes(term));
}

function handleSearchInput(event) {
  searchTerm = event.target.value;
  renderProducts();
}

/* ==========================================================
   9. RENDERIZADO (consulta)
   ========================================================== */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createProductCard(product) {
  const isAvailable = product.availability === "Disponible";
  const card = createElement("article", "product-card");
  if (!isAvailable) card.classList.add("is-unavailable");
  if (editingCode !== null && normalizeText(editingCode) === normalizeText(product.code)) {
    card.classList.add("is-editing");
  }

  const top = createElement("div", "card-top");
  top.append(
    createElement("span", "product-code", product.code),
    createElement("span", `badge ${isAvailable ? "badge-ok" : "badge-off"}`, product.availability)
  );

  const bottom = createElement("div", "card-bottom");
  bottom.append(
    createElement("span", "product-price", formatPrice(product.price)),
    createElement("span", "product-category", product.category)
  );

  const actions = createElement("div", "card-actions");
  const editButton = createElement("button", "btn btn-accent btn-small", "Editar");
  editButton.type = "button";
  editButton.setAttribute("aria-label", `Editar ${product.name}`);
  editButton.dataset.action = "edit";
  editButton.dataset.code = product.code;

  const deleteButton = createElement("button", "btn btn-ghost btn-small", "Eliminar");
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Eliminar ${product.name}`);
  deleteButton.dataset.action = "delete";
  deleteButton.dataset.code = product.code;

  actions.append(editButton, deleteButton);

  card.append(
    top,
    createElement("h3", "product-name", product.name),
    createElement("p", "product-description", product.description),
    bottom,
    actions
  );
  return card;
}

function renderProducts() {
  const visibleProducts = getFilteredProducts();
  dom.list.replaceChildren(...visibleProducts.map(createProductCard));

  const hasProducts = products.length > 0;
  const hasResults = visibleProducts.length > 0;
  dom.emptyState.hidden = hasResults;

  if (!hasProducts) {
    dom.emptyState.textContent = "Aún no hay productos registrados. Use el formulario para agregar el primero.";
  } else if (!hasResults) {
    dom.emptyState.textContent = `No se encontraron productos que coincidan con "${searchTerm.trim()}".`;
  }

  dom.resultsInfo.textContent = hasProducts
    ? `Mostrando ${visibleProducts.length} de ${products.length} producto(s).`
    : "";
}

function renderStats() {
  const total = products.length;
  const available = products.filter((product) => product.availability === "Disponible").length;
  dom.statTotal.textContent = total;
  dom.statAvailable.textContent = available;
  dom.statUnavailable.textContent = total - available;
}

function renderAll() {
  renderStats();
  renderProducts();
}

function handleListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, code } = button.dataset;
  if (action === "edit") startEditing(code);
  if (action === "delete") handleDelete(code);
}

/* ==========================================================
   10. INICIALIZACIÓN
   ========================================================== */
function init() {
  fillSelect(dom.fields.category, CATEGORIES);
  products = loadProducts();

  dom.form.addEventListener("submit", handleFormSubmit);
  dom.cancelBtn.addEventListener("click", handleCancelEdit);
  dom.search.addEventListener("input", handleSearchInput);
  dom.list.addEventListener("click", handleListClick);

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);