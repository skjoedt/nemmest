// Shared types for products, recipes and favorites

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

// A single product line within a recipe in the basket
export interface BasketRecipeLineItem {
	Id: string;
	Name: string;
	Description: string | null;
	PrimaryImage: string | null;
	Quantity: number;
	ItemPrice: number;
	Price: number;
	Url: string | null;
}

// A recipe in the basket (from GET /webapi/basket/GetBasket → Recipes[])
export interface BasketRecipe {
	Id: string;
	Title: string;
	PrimaryImage: string | null;
	Url: string | null;
	Persons: number;
	Sorting: string;
	RecipeTotalPrice: number;
	RecipeLineItems: BasketRecipeLineItem[];
}

// ── Recipe types ─────────────────────────────────────────────────────────────

// A recipe from the Nemlig recipe search gateway
export interface NemligRecipe {
	id: string;           // UUID
	name: string;
	description: string | null;
	imageUrl: string | null;
	preparationTime: number | null; // minutes
	url: string | null;
}

// Shape stored in recipe_favorites DB table.
// description is always null — the Nemlig search gateway does not return one.
// sortOrder is always present; the DB column has DEFAULT 'default' (migration 0003).
export interface FavoriteRecipe {
	recipeId: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	preparationTime: number | null;
	url: string | null;
	sortOrder: RecipeSortOrder;
	deselectedIngredientIds?: string[];
}

// A single ingredient line from Recipe/GetProductSelections
export interface RecipeIngredient {
	productSelectionId: string;
	productGroupId: string;
	title: string;
	productId: string;
	productName: string;
	productImageUrl: string | null;
	productUrl: string | null;
	price: number;
	unitPrice: string;
	amount: number;
	isSupplementProduct: boolean;
	isNecessary: boolean;
}

// Sorting options for recipe product selections
export type RecipeSortOrder = 'default' | 'recommended' | 'priceasc' | 'organic';

export const VALID_SORT_ORDERS = new Set<RecipeSortOrder>([
	'default',
	'recommended',
	'priceasc',
	'organic',
]);
