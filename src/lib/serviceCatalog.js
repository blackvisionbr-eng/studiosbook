const CATEGORY_ALIASES = {
  lash_extension: "lash_design",
};

export function canonicalCategoryId(categoryId) {
  const value = String(categoryId || "").trim();
  return CATEGORY_ALIASES[value] || value;
}

export function uniqueCategoryIds(categories = []) {
  return [...new Set((categories || []).map(canonicalCategoryId).filter(Boolean))];
}

function safeNumber(value, fallback, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function slug(value) {
  return String(value || "service")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "service";
}

export function normalizeServiceCatalog(services = [], categories = []) {
  const categoryIds = uniqueCategoryIds(categories);
  const selected = new Set(categoryIds);

  return (services || []).flatMap((service, index) => {
    const name = String(service?.name || "").trim();
    if (!name) return [];

    let category = canonicalCategoryId(service?.category);
    if (!category && categoryIds.length === 1) category = categoryIds[0];
    if (!selected.has(category)) return [];

    return [{
      id: service.id || `catalog-${category}-${slug(name)}-${index}`,
      category,
      name,
      price: safeNumber(service.price, 0),
      duration_minutes: safeNumber(service.duration_minutes, 60, 1),
      maintenance_days: safeNumber(service.maintenance_days, 0),
      active: service.active !== false,
      image_path: String(service.image_path || "").trim(),
      image_url: String(service.image_url || "").trim(),
    }];
  });
}

export function reconcileServiceCatalog({
  services = [],
  currentCategories = [],
  nextCategories = [],
  defaultsForCategories,
}) {
  const previous = uniqueCategoryIds(currentCategories);
  const next = uniqueCategoryIds(nextCategories);
  const retained = normalizeServiceCatalog(services, next);
  const added = next.filter((categoryId) => !previous.includes(categoryId));
  const defaults = typeof defaultsForCategories === "function"
    ? normalizeServiceCatalog(defaultsForCategories(added), next)
    : [];

  const merged = [...retained];
  defaults.forEach((service) => {
    const duplicate = merged.some(
      (item) => item.category === service.category && item.name.toLocaleLowerCase("pt-BR") === service.name.toLocaleLowerCase("pt-BR")
    );
    if (!duplicate) merged.push(service);
  });

  return merged;
}

export function serviceBelongsToCatalog(serviceForm, catalog = []) {
  if (!serviceForm) return false;
  if (serviceForm.catalog_service_id) {
    return catalog.some((service) => service.id === serviceForm.catalog_service_id);
  }
  return catalog.some(
    (service) => service.category === canonicalCategoryId(serviceForm.service_category) && service.name === serviceForm.service_name
  );
}
