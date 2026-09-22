import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeServiceCatalog,
  reconcileServiceCatalog,
  serviceBelongsToCatalog,
} from "../src/lib/serviceCatalog.js";

const defaults = (categories) => categories.flatMap((category) => (
  category === "massage_therapy"
    ? [{ id: "massage-default", category, name: "Massagem relaxante", price: 120, duration_minutes: 60, maintenance_days: 15 }]
    : [{ id: "lash-default", category, name: "Volume Brasileiro", price: 130, duration_minutes: 120, maintenance_days: 20 }]
));

test("remove serviços de categorias que deixaram de ser selecionadas", () => {
  const result = normalizeServiceCatalog([
    { id: "lash", category: "lash_design", name: "Volume Brasileiro" },
    { id: "massage", category: "massage_therapy", name: "Massagem relaxante" },
  ], ["massage_therapy"]);

  assert.deepEqual(result.map((service) => service.id), ["massage"]);
});

test("não converte serviço de lash em serviço de massoterapia", () => {
  const result = normalizeServiceCatalog([
    { id: "lash", category: "lash_design", name: "Foxy Eyes" },
  ], ["massage_therapy"]);

  assert.equal(result.length, 0);
});

test("adiciona padrões apenas para uma categoria recém-selecionada", () => {
  const result = reconcileServiceCatalog({
    services: [{ id: "lash-custom", category: "lash_design", name: "Meu volume" }],
    currentCategories: ["lash_design"],
    nextCategories: ["lash_design", "massage_therapy"],
    defaultsForCategories: defaults,
  });

  assert.deepEqual(result.map((service) => service.name), ["Meu volume", "Massagem relaxante"]);
});

test("identifica seleção antiga como inválida após mudança de categoria", () => {
  const catalog = defaults(["massage_therapy"]);
  const valid = serviceBelongsToCatalog({
    catalog_service_id: "lash-default",
    service_category: "lash_design",
    service_name: "Volume Brasileiro",
  }, catalog);

  assert.equal(valid, false);
});

test("preserva serviço sem retorno em zero dias", () => {
  const [service] = normalizeServiceCatalog([
    { id: "express", category: "lash_design", name: "Volume Express", maintenance_days: 0 },
  ], ["lash_design"]);

  assert.equal(service.maintenance_days, 0);
});

test("preserva a foto vinculada ao serviço do catálogo", () => {
  const [service] = normalizeServiceCatalog([{
    id: "lash-photo",
    category: "lash_design",
    name: "Foxy Eyes",
    image_path: "users/owner/catalog/lash-photo/cover.webp",
    image_url: "https://firebasestorage.googleapis.com/v0/b/project/o/catalog%2Fcover.webp?alt=media&token=test",
  }], ["lash_design"]);

  assert.equal(service.image_path, "users/owner/catalog/lash-photo/cover.webp");
  assert.match(service.image_url, /^https:\/\/firebasestorage\.googleapis\.com\//);
});
