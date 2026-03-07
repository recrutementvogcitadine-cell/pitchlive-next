export type SellerProduct = {
  id: string;
  name: string;
  priceXof: number;
  imageUrl: string;
  description: string;
};

export type SellerStore = {
  id: string;
  displayName: string;
  avatarUrl: string;
  tagline: string;
  whatsappNumber: string;
  isValidated: boolean;
  products: SellerProduct[];
};

export type SellerStoreProfile = {
  sellerId: string;
  storeName: string;
  tagline: string;
  whatsappNumber: string;
};

export const MAX_PRODUCTS_PER_STORE = 6;

export const SELLER_STORES: SellerStore[] = [
  {
    id: "main-creator",
    displayName: "Awa Store",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    tagline: "Mode femme premium et tendances Abidjan",
    whatsappNumber: "2250701234567",
    isValidated: true,
    products: [
      {
        id: "awa-1",
        name: "Robe Wax Signature",
        priceXof: 35000,
        imageUrl: "https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=1200&h=1200&fit=crop",
        description: "Coupe moderne, tissu wax premium.",
      },
      {
        id: "awa-2",
        name: "Ensemble Soiree Chic",
        priceXof: 49000,
        imageUrl: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1200&h=1200&fit=crop",
        description: "Deux pieces elegantes pour sorties et events.",
      },
      {
        id: "awa-3",
        name: "Sac Main Cuir",
        priceXof: 28000,
        imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&h=1200&fit=crop",
        description: "Finitions premium, format quotidien.",
      },
      {
        id: "awa-4",
        name: "Escarpins Nude",
        priceXof: 26000,
        imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1200&h=1200&fit=crop",
        description: "Talons confortables, style pro et soiree.",
      },
      {
        id: "awa-5",
        name: "Parure Dorree",
        priceXof: 18000,
        imageUrl: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=1200&h=1200&fit=crop",
        description: "Collier + boucles + bracelet assortis.",
      },
      {
        id: "awa-6",
        name: "Veste Tailleur Femme",
        priceXof: 42000,
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&h=1200&fit=crop",
        description: "Look business, coupe ajustee et confortable.",
      },
    ],
  },
  {
    id: "tech-pro",
    displayName: "Tech Pro CI",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    tagline: "Smartphones et accessoires garantis",
    whatsappNumber: "2250509988776",
    isValidated: true,
    products: [
      {
        id: "tech-1",
        name: "iPhone 14 Pro 256 Go",
        priceXof: 520000,
        imageUrl: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1200&h=1200&fit=crop",
        description: "Etat excellent, batterie saine, garantie vendeur.",
      },
      {
        id: "tech-2",
        name: "Samsung S23",
        priceXof: 430000,
        imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=1200&h=1200&fit=crop",
        description: "Version 256 Go, debloque tout reseau.",
      },
      {
        id: "tech-3",
        name: "AirPods Pro",
        priceXof: 130000,
        imageUrl: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=1200&h=1200&fit=crop",
        description: "Reduction de bruit active, boitier MagSafe.",
      },
      {
        id: "tech-4",
        name: "Power Bank 20 000 mAh",
        priceXof: 25000,
        imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1200&h=1200&fit=crop",
        description: "Charge rapide USB-C et USB-A.",
      },
      {
        id: "tech-5",
        name: "Smartwatch Sport",
        priceXof: 60000,
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&h=1200&fit=crop",
        description: "Suivi sante, appels bluetooth, autonomie 5 jours.",
      },
      {
        id: "tech-6",
        name: "Ring Light Pro",
        priceXof: 30000,
        imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1200&h=1200&fit=crop",
        description: "Ideal live, support smartphone inclus.",
      },
    ],
  },
];

export function getValidatedStores() {
  return SELLER_STORES.filter((seller) => seller.isValidated);
}

export function getSellerStoreById(sellerId: string) {
  return SELLER_STORES.find((seller) => seller.id === sellerId);
}

export function getDefaultSellerProfile(sellerId: string): SellerStoreProfile | null {
  const store = getSellerStoreById(sellerId);
  if (!store) return null;

  return {
    sellerId: store.id,
    storeName: store.displayName,
    tagline: store.tagline,
    whatsappNumber: store.whatsappNumber,
  };
}

export function normalizeWhatsappNumber(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

export function getStoreProductsLimited(store: SellerStore) {
  return store.products.slice(0, MAX_PRODUCTS_PER_STORE);
}
