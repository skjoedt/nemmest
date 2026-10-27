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

export interface FavoriteProduct {
	productId: number;
	name: string;
	description: string | null;
	imageUrl: string | null;
	brand: string | null;
	url: string | null;
}

export interface BasketLine {
	Id: string;
	Name: string;
	Description: string | null;
	PrimaryImage: string | null;
	Price: number;
	ItemPrice: number;
	UnitPrice: string;
	UnitPriceLabel: string;
	Quantity: number;
}

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

export interface NemligRecipe {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	preparationTime: number | null;
	url: string | null;
}

export interface FavoriteRecipe {
	recipeId: string;
	name: string;
	description: string | null;
	imageUrl: string | null;
	preparationTime: number | null;
	url: string | null;
	persons: number;
	sortOrder: RecipeSortOrder;
	ingredients: FavoriteIngredient[];
}

export interface RecipeBasketAddResult {
	addedProductIds: string[];
	missingProductIds: string[];
	failedProductIds: string[];
}

export type IngredientAvailabilityStatus = 'available' | 'unavailable' | 'unknown';

export interface IngredientAvailability {
	ingredientId: number;
	status: IngredientAvailabilityStatus;
	replacement: NemligProduct | null;
	replacementUrl: string | null;
	checkedAt: string | null;
	retryAfter: string | null;
	fromCache: boolean;
}

export interface RecipeAvailabilityResult {
	recipeId: string;
	ingredients: IngredientAvailability[];
}

export interface FavoriteIngredient {
	id: number;
	recipeId: string;
	productSelectionId: string | null;
	productSelectionName: string | null;
	productId: string;
	productName: string;
	productDescription: string | null;
	productImageUrl: string | null;
	productUrl: string | null;
	quantity: number;
	price: number;
	isDeselected: boolean;
	isUnavailable: boolean;
	availabilityStatus: IngredientAvailabilityStatus;
	availabilityCheckedAt: Date | null;
	availabilityRetryAfter: Date | null;
	isCustom: boolean;
	sortOrder: number;
}

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

export type RecipeSortOrder = 'default' | 'recommended' | 'priceasc' | 'organic';

export const VALID_SORT_ORDERS = new Set<RecipeSortOrder>([
	'default', 'recommended', 'priceasc', 'organic',
]);

export function parseSortOrder(raw: string | null | undefined): RecipeSortOrder {
	return VALID_SORT_ORDERS.has(raw as RecipeSortOrder) ? (raw as RecipeSortOrder) : 'default';
}
