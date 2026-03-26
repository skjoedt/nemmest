// Shared types for products and favorites

export interface NemligProduct {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	brand: string | null;
	price: number;
	campaignPrice: number | null;
	discountSavings: number | null;
	unitPrice: string | null;
	unitPriceLabel: string | null;
	isOnSale: boolean;
	url: string | null;
}

// Shape used when rendering from DB favorites (no price fields)
export interface FavoriteProduct {
	productId: number;
	name: string;
	description: string | null;
	imageUrl: string | null;
	brand: string | null;
	url: string | null;
}
