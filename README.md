# nemmest

Nemmest is a single-user, self-hosted web app that automates grocery shopping on nemlig.com. It generates a weekly meal plan from followed nemlig.com recipes, scores selections by current vs. historical pricing.

It also provides a true favorites system for products, without clutter of previous purchases or search history.

Users can easily add favorite products and meal plans to their nemlig.com shopping basket.

> **Note**
> This project is very early stage.

## Roadmap

- [x] Create a settings page for testing login
- [x] Implement nemlig API proxy at /api/nemlig and /api/nemlig-search
- [x] Implement postgres database to store user favorites
- [ ] Create a product page with search and favoritize
- [ ] Create a recipe page with search and favoritize
- [ ] Create an automated meal planner based on favorite recipes only
- [ ] Add functionality to add mealplan, recipes or products to nemlig basket