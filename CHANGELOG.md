# Changelog

## [1.1.0](https://github.com/milkrunner/FoodPlanner/compare/v1.0.0...v1.1.0) (2026-01-03)


### Features

* add Swagger API documentation and integrate with Express ([#81](https://github.com/milkrunner/FoodPlanner/issues/81)) ([350f3b0](https://github.com/milkrunner/FoodPlanner/commit/350f3b044db4d00e784a3b60cebfd7d94528f2d2))
* extend health check endpoints with detailed status and metrics ([ff56cd8](https://github.com/milkrunner/FoodPlanner/commit/ff56cd8f6fa6c76e9e8928735e24b7ea1886c221))


### Bug Fixes

* update permissions to include package write access ([a400d5d](https://github.com/milkrunner/FoodPlanner/commit/a400d5dc86dbab60c332269deedaf36eeac94c7b))

## 1.0.0 (2026-01-01)


### ⚠ BREAKING CHANGES

* Requires PostgreSQL database instead of SQLite

### Features

* add AI-based ingredient categorization and enhance README with new features ([75fb355](https://github.com/milkrunner/FoodPlanner/commit/75fb35527751139993bb0ce015647e07f8f17610))
* add category support to ingredients and enhance shopping list rendering ([c54afea](https://github.com/milkrunner/FoodPlanner/commit/c54afeaef544250c4a8c1d29eddac2a8b266f934))
* add cooking history management with CRUD endpoints and frontend integration ([b9cc1cc](https://github.com/milkrunner/FoodPlanner/commit/b9cc1ccba2a35d282b5c45b9558a4afc84a03f2b))
* add initial Docker and Nginx configuration ([#22](https://github.com/milkrunner/FoodPlanner/issues/22)) ([a45db08](https://github.com/milkrunner/FoodPlanner/commit/a45db089dc1e715d15c8a4be45bd029763056cf9))
* add manual items to shopping list (Issue [#5](https://github.com/milkrunner/FoodPlanner/issues/5)) ([23d3602](https://github.com/milkrunner/FoodPlanner/commit/23d3602d1b137bfc110c993236fd24858ccd9e40))
* add recipe tags functionality with database integration ([ce51b51](https://github.com/milkrunner/FoodPlanner/commit/ce51b514b4215ed6049be6da0559eca895176ffc)), closes [#8](https://github.com/milkrunner/FoodPlanner/issues/8)
* add smart recipe parser with URL fetching and structured output ([#49](https://github.com/milkrunner/FoodPlanner/issues/49)) ([ef52d49](https://github.com/milkrunner/FoodPlanner/commit/ef52d499c60bdeda639fb9f0c8df701ab89a5b86))
* add video recipe parsing functionality with support for multiple platforms ([e0bac60](https://github.com/milkrunner/FoodPlanner/commit/e0bac60eb618815ef0f6e07c13bc30de8fb5eec0))
* Docker-Setup mit Backend und persistenter Datenbank ([#18](https://github.com/milkrunner/FoodPlanner/issues/18)) ([0c38358](https://github.com/milkrunner/FoodPlanner/commit/0c38358838114c56d4dbbcfde0398556849b3569))
* enhance AI recipe generation feedback and improve error handling ([759cdbd](https://github.com/milkrunner/FoodPlanner/commit/759cdbd25b630e31379b0c87675c80e39d98ea77))
* enhance Recipe Database View for dark mode support ([fd0d4e8](https://github.com/milkrunner/FoodPlanner/commit/fd0d4e87fdc96268233e116debdda2a40c183bd4))
* enhance week planner with date utilities and server support for multiple weeks ([45e1ae9](https://github.com/milkrunner/FoodPlanner/commit/45e1ae907d1306e2d70306db41871b99055a1f9b))
* implement AI recipe generation and related features ([ce67b67](https://github.com/milkrunner/FoodPlanner/commit/ce67b67c6386c1765abec66848a54f2990c021bd))
* implement AI-based portion scaling feature with intelligent rounding ([ababe01](https://github.com/milkrunner/FoodPlanner/commit/ababe015621da3f00dc3591d0cfc6c4c9d751e60))
* implement auto-categorization for ingredients in RecipeDatabaseView ([b715625](https://github.com/milkrunner/FoodPlanner/commit/b715625090e0ae2e58b51886d07d3b034f524273))
* implement automatic release process and update documentation ([#75](https://github.com/milkrunner/FoodPlanner/issues/75)) ([b9a654a](https://github.com/milkrunner/FoodPlanner/commit/b9a654a4d823f4d2b18d44f217160f2fe493fe15))
* implement rate limiting for API and AI endpoints ([1cff0e5](https://github.com/milkrunner/FoodPlanner/commit/1cff0e5304d252dec726fe7905f1d825350a6100))
* implement shopping budget management and optimization features ([c637edb](https://github.com/milkrunner/FoodPlanner/commit/c637edb06438ce8372d15da0d2041360c1aa53eb))
* implement undo functionality with toast notifications ([d404a4e](https://github.com/milkrunner/FoodPlanner/commit/d404a4e604923810d9698d39e7a0e263fba36373))
* implement week plan templates (Issue [#3](https://github.com/milkrunner/FoodPlanner/issues/3)) ([4b80b21](https://github.com/milkrunner/FoodPlanner/commit/4b80b21e5b62f0f3e9da2549d4844dc7970d55b0))
* migrate database from SQLite to PostgreSQL ([545d189](https://github.com/milkrunner/FoodPlanner/commit/545d189d91e5fed9f5ea32b310f4f05503b0d322))
* update .gitignore and add VSCode settings for improved development environment ([c36a06a](https://github.com/milkrunner/FoodPlanner/commit/c36a06a7bf0c1e551ca6732e5760b3a94ba5d700))


### Bug Fixes

* apply rate limiting to all routes instead of /api/ only ([d902435](https://github.com/milkrunner/FoodPlanner/commit/d902435eb2575696adc251703f0d7db6702de6b5))
* implement URL validation to prevent SSRF attacks and enhance toast notification safety ([668ebe1](https://github.com/milkrunner/FoodPlanner/commit/668ebe121c73ecdf88b001a13929a5d39de6977c))
* prevent command injection in video download ([c522564](https://github.com/milkrunner/FoodPlanner/commit/c522564ef23be0c1f9656a0c6d85f7b3c5d9aa61))
* show 'Add Item' button even when shopping list is empty ([3d164a5](https://github.com/milkrunner/FoodPlanner/commit/3d164a55e56c082c1d6053aaac645b202ca1664e))
* update release type from 'node' to 'simple' in configuration files ([0aca693](https://github.com/milkrunner/FoodPlanner/commit/0aca693414cdaacb546fe0496af3fd40afcc55c1))
