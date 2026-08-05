/** Hard navigate to cart so add-to-cart always lands on /cart. */
export function goToCart() {
  if (typeof window === "undefined") return;
  // Defer one tick so the cart localStorage write commits before unload.
  // Use href (not Next soft nav) so shoppers never stay on the product/shop page.
  window.setTimeout(() => {
    try {
      window.location.href = "/cart";
    } catch {
      window.location.assign("/cart");
    }
  }, 10);
}

export function brandsMatch(productBrand: string, filterBrand: string) {
  return productBrand.trim().toLowerCase() === filterBrand.trim().toLowerCase();
}

export function categoriesMatch(productCategory: string, filterCategory: string) {
  return (
    productCategory.trim().toLowerCase() === filterCategory.trim().toLowerCase()
  );
}

const BRAND_IMAGES: Record<string, string> = {
  storm: "/images/brands/storm.jpg",
  "roto grip": "/images/brands/roto-grip.jpg",
  "900 global": "/images/brands/900-global.png",
  "ballard's bowling": "/images/logo.png",
  "ballards bowling": "/images/logo.png",
};

export function brandImage(brand: string) {
  return BRAND_IMAGES[brand.trim().toLowerCase()] || "/images/logo.png";
}

/** Preferred brand order for shop tiles */
export const FEATURED_BRANDS = ["Storm", "Roto Grip", "900 Global"] as const;
