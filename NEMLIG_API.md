# Nemlig.com API Specification Summary

This specification details the endpoints, methods, and parameters identified from the traffic report.

#### **1\. Base URLs**

* **Primary API**: https://www.nemlig.com/webapi

* **Banner Service**: https://webapi.prod.knl.nemlig.it/bannerservicebff/api

#### **2\. Core Endpoints**

| Category | Method | Endpoint | Description |
| :---- | :---- | :---- | :---- |
| **Products** | GET | /{session}/Products/GetByProductGroupId | Retrieves products by group ID. Parameters include productGroupId, sortorder, pageIndex, and pagesize.  |
| **Orders** | GET | /order/GetBasicOrderHistory | Fetches a summary of order history. Uses skip and take for pagination.  |
| **Orders** | GET | /v2/order/GetOrderHistory/{orderId} | Retrieves detailed history for a specific order ID. |
| **Shopping Lists** | GET | /ShoppingList/GetShoppingLists | Lists the user's saved shopping lists with skip and take. |
| **Shopping Lists** | GET | /ShoppingList/getShoppingList | Gets items from a specific list using listId. |
| **Shopping Lists** | POST | /webapi/ShoppingList/UpdateProductInShoppingList | Add/update a product in a shopping list. Params: `listId`, `productId`, `amount`. |
| **Basket** | GET  | /basket/GetBasket | Returns the current basket. `Lines[]` contains the items; each has `Id`, `Name`, `Description`, `PrimaryImage`, `ItemPrice`, `UnitPrice` (formatted string), `UnitPriceLabel`, `Price` (line total), `Quantity`. Top-level `TotalProductsPrice` is the products subtotal. |
| **Basket** | POST | /basket/addShoppingListToBasket | Adds all items from a saved list to the active cart. |
| **Basket** | POST | /basket/AddToBasket | Sets the absolute quantity of a product in the basket. Body: `{ ProductId: string, quantity: number, AffectPartialQuantity: true, disableQuantityValidation: false }`. `quantity: 0` removes the item. |
| **Basket** | POST | /basket/AddRecipeToBasket | Adds a recipe's ingredients to the basket. Body: `{ RecipeId: string (UUID), NumberOfPeople: string, Sorting: string (e.g. "priceasc"), SelectedProducts: [{ ProductSelectionId: string (UUID), ProductSelectionName: string, ProductId: string, Quantity: number }], SoldoutProducts: [], SupplementProducts: [] }`. `SelectedProducts` must be non-empty — populate from `Recipe/GetProductSelections` for the matching sort order and persons count. Returns the full basket object including `Recipes[]` with `RecipeLineItems`, `RecipeTotalPrice`, `Persons`, and `Sorting`. Note: ProductSelectionId must be a valid UUID for the specific recipe, but can be reused to create unlimited custom ingredients. |
| **Basket** | POST | /basket/RemoveRecipeFromBasket | Removes a recipe from the basket. Query param: `recipeId` (UUID). No request body. Returns the full basket object. |
| **Recipes** | GET | /8N2gkvhu/recipe/GetByRecipeGroupId | Fetches recipes in a group, often with a contextId. |
| **Filters** | GET | /{session}/{id}/Filter/GetFilter | Retrieves faceted search filters for products or recipes. |
| **Auth** | POST | /Token | Manages authentication tokens and sessions. |

#### **3\. Common Request Headers**

Requests typically include the following metadata headers:

* **accept**: application/json, text/plain, \*/\*

* **device-size**: desktop

* **platform**: web

* **version**: 11.233.0

* **x-correlation-id**: A unique UUID for request tracking (e.g., 282a80ac-015f-4eef-b073-02596edec573).  
