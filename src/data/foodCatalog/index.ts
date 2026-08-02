/**
 * คลังอาหารไทย deterministic — รวมทุกหมวด
 * ใช้โดยสคริปต์ seed (scripts/seed-food-catalog.js ผ่าน tsx/next) และสคริปต์ QC
 */
import type { FoodSeed } from "./types";
import { riceDishes } from "./riceDishes";
import { noodles } from "./noodles";
import { curries } from "./curries";
import { isaan } from "./isaan";
import { grilledFried } from "./grilledFried";
import { breakfast } from "./breakfast";
import { thaiDesserts } from "./thaiDesserts";
import { bakery } from "./bakery";
import { drinks } from "./drinks";
import { alcohol } from "./alcohol";
import { dairy } from "./dairy";
import { fruits } from "./fruits";
import { snacks } from "./snacks";
import { fastfood } from "./fastfood";
import { asian } from "./asian";
import { seafood } from "./seafood";
import { clean } from "./clean";

export * from "./types";

export const FOOD_CATALOG_SEED: FoodSeed[] = [
  ...riceDishes,
  ...noodles,
  ...curries,
  ...isaan,
  ...grilledFried,
  ...breakfast,
  ...thaiDesserts,
  ...bakery,
  ...drinks,
  ...alcohol,
  ...dairy,
  ...fruits,
  ...snacks,
  ...fastfood,
  ...asian,
  ...seafood,
  ...clean,
];
