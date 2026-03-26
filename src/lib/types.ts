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

// A single line item in the nemlig.com basket (from GET /webapi/basket/GetBasket)
export interface BasketLine {
	Id: string;
	Name: string;
	Description: string | null;
	PrimaryImage: string | null;
	Price: number;         // line total (Price * Quantity)
	ItemPrice: number;     // unit price
	UnitPrice: string;     // formatted unit price, e.g. "15,00"
	UnitPriceLabel: string; // e.g. "kr./Stk."
	Quantity: number;
}
