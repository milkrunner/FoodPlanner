# Changelog

## [2.1.1](https://github.com/milkrunner/FoodPlanner/compare/v2.1.0...v2.1.1) (2026-02-18)


### Performance Improvements

* **recipes:** debounce search input and add virtual pagination ([#150](https://github.com/milkrunner/FoodPlanner/issues/150)) ([f2b90d8](https://github.com/milkrunner/FoodPlanner/commit/f2b90d88bf5eb3a266cd33f9c0e512862b9b4136)), closes [#117](https://github.com/milkrunner/FoodPlanner/issues/117)

## [2.1.0](https://github.com/milkrunner/FoodPlanner/compare/v2.0.3...v2.1.0) (2026-01-31)


### Features

* Add meal prep support to recipes and week plans ([#137](https://github.com/milkrunner/FoodPlanner/issues/137)) ([f9bc042](https://github.com/milkrunner/FoodPlanner/commit/f9bc042b6c39b24ca0a60c44515110036908fb2b))

## [2.0.3](https://github.com/milkrunner/FoodPlanner/compare/v2.0.2...v2.0.3) (2026-01-10)


### Bug Fixes

* sync package-lock.json with package.json ([#133](https://github.com/milkrunner/FoodPlanner/issues/133)) ([bf734f2](https://github.com/milkrunner/FoodPlanner/commit/bf734f255f5b5fa9ee3390b7e96c6a2e5b3f9432))

## [2.0.2](https://github.com/milkrunner/FoodPlanner/compare/v2.0.1...v2.0.2) (2026-01-10)


### Bug Fixes

* use --omit=dev instead of deprecated --only=production in Dockerfile ([#131](https://github.com/milkrunner/FoodPlanner/issues/131)) ([33fdb00](https://github.com/milkrunner/FoodPlanner/commit/33fdb002725fe60788be1f065d0c691370ad5939))

## [2.0.1](https://github.com/milkrunner/FoodPlanner/compare/v2.0.0...v2.0.1) (2026-01-10)


### Bug Fixes

* remove CORS restrictions and CSP headers ([#129](https://github.com/milkrunner/FoodPlanner/issues/129)) ([729a8b4](https://github.com/milkrunner/FoodPlanner/commit/729a8b4c80bb02d2ebecc1a020f5707b2973e25d))

## [2.0.0](https://github.com/milkrunner/FoodPlanner/compare/v1.6.1...v2.0.0) (2026-01-10)


### ⚠ BREAKING CHANGES

* Requires PostgreSQL database instead of SQLite

### Features

* add AI-based ingredient categorization and enhance README with new features ([75fb355](https://github.com/milkrunner/FoodPlanner/commit/75fb35527751139993bb0ce015647e07f8f17610))
* add category support to ingredients and enhance shopping list rendering ([c54afea](https://github.com/milkrunner/FoodPlanner/commit/c54afeaef544250c4a8c1d29eddac2a8b266f934))
* add cooking history management with CRUD endpoints and frontend integration ([b9cc1cc](https://github.com/milkrunner/FoodPlanner/commit/b9cc1ccba2a35d282b5c45b9558a4afc84a03f2b))
* add initial Docker and Nginx configuration ([#22](https://github.com/milkrunner/FoodPlanner/issues/22)) ([a45db08](https://github.com/milkrunner/FoodPlanner/commit/a45db089dc1e715d15c8a4be45bd029763056cf9))
* add manual items to shopping list (Issue [#5](https://github.com/milkrunner/FoodPlanner/issues/5)) ([23d3602](https://github.com/milkrunner/FoodPlanner/commit/23d3602d1b137bfc110c993236fd24858ccd9e40))
* add onboarding tour and accessibility improvements ([#122](https://github.com/milkrunner/FoodPlanner/issues/122)) ([3e30ec9](https://github.com/milkrunner/FoodPlanner/commit/3e30ec93008c436e4a69971eed7f30dfa2508a8a))
* add recipe tags functionality with database integration ([ce51b51](https://github.com/milkrunner/FoodPlanner/commit/ce51b514b4215ed6049be6da0559eca895176ffc)), closes [#8](https://github.com/milkrunner/FoodPlanner/issues/8)
* add security headers to nginx configuration for enhanced protection ([365cd81](https://github.com/milkrunner/FoodPlanner/commit/365cd81cd199cef4197c79e98bf081c3ee39a427))
* add smart recipe parser with URL fetching and structured output ([#49](https://github.com/milkrunner/FoodPlanner/issues/49)) ([ef52d49](https://github.com/milkrunner/FoodPlanner/commit/ef52d499c60bdeda639fb9f0c8df701ab89a5b86))
* add Swagger API documentation and integrate with Express ([#81](https://github.com/milkrunner/FoodPlanner/issues/81)) ([350f3b0](https://github.com/milkrunner/FoodPlanner/commit/350f3b044db4d00e784a3b60cebfd7d94528f2d2))
* add video recipe parsing functionality with support for multiple platforms ([e0bac60](https://github.com/milkrunner/FoodPlanner/commit/e0bac60eb618815ef0f6e07c13bc30de8fb5eec0))
* Docker-Setup mit Backend und persistenter Datenbank ([#18](https://github.com/milkrunner/FoodPlanner/issues/18)) ([0c38358](https://github.com/milkrunner/FoodPlanner/commit/0c38358838114c56d4dbbcfde0398556849b3569))
* enhance AI recipe generation feedback and improve error handling ([759cdbd](https://github.com/milkrunner/FoodPlanner/commit/759cdbd25b630e31379b0c87675c80e39d98ea77))
* enhance Docker setup with separate metadata extraction for frontend and backend, add health checks, and improve logging in backend ([45ceaa4](https://github.com/milkrunner/FoodPlanner/commit/45ceaa4a425be9630dde276b923dbf83eebdbd84))
* Enhance PWA features and frontend responsiveness ([#103](https://github.com/milkrunner/FoodPlanner/issues/103)) ([45650df](https://github.com/milkrunner/FoodPlanner/commit/45650dfc26c850e403af1c008411541ac0e912d8))
* enhance Recipe Database View for dark mode support ([fd0d4e8](https://github.com/milkrunner/FoodPlanner/commit/fd0d4e87fdc96268233e116debdda2a40c183bd4))
* Enhance recipe retrieval with pagination and detailed response structure ([3e4bb5f](https://github.com/milkrunner/FoodPlanner/commit/3e4bb5f5971eb8183570329db1c0a105c2f8c3a0))
* Enhance recipe retrieval with pagination and detailed response structure ([af35bb0](https://github.com/milkrunner/FoodPlanner/commit/af35bb05c0e9833cf308b9d4a696c87e9f7f06fd))
* enhance week planner with date utilities and server support for multiple weeks ([45e1ae9](https://github.com/milkrunner/FoodPlanner/commit/45e1ae907d1306e2d70306db41871b99055a1f9b))
* extend health check endpoints with detailed status and metrics ([ff56cd8](https://github.com/milkrunner/FoodPlanner/commit/ff56cd8f6fa6c76e9e8928735e24b7ea1886c221))
* implement AI recipe generation and related features ([ce67b67](https://github.com/milkrunner/FoodPlanner/commit/ce67b67c6386c1765abec66848a54f2990c021bd))
* implement AI-based portion scaling feature with intelligent rounding ([ababe01](https://github.com/milkrunner/FoodPlanner/commit/ababe015621da3f00dc3591d0cfc6c4c9d751e60))
* Implement AI-powered natural language search for recipes ([#112](https://github.com/milkrunner/FoodPlanner/issues/112)) ([326af30](https://github.com/milkrunner/FoodPlanner/commit/326af30c52d7b816217487b2b5d1756cab063a0b))
* implement auto-categorization for ingredients in RecipeDatabaseView ([b715625](https://github.com/milkrunner/FoodPlanner/commit/b715625090e0ae2e58b51886d07d3b034f524273))
* implement automatic release process and update documentation ([#75](https://github.com/milkrunner/FoodPlanner/issues/75)) ([b9a654a](https://github.com/milkrunner/FoodPlanner/commit/b9a654a4d823f4d2b18d44f217160f2fe493fe15))
* implement CORS whitelist configuration and update API documentation ([f31bb1e](https://github.com/milkrunner/FoodPlanner/commit/f31bb1eea74cff996b913578789cf1f4119c351a))
* implement rate limiting for API and AI endpoints ([1cff0e5](https://github.com/milkrunner/FoodPlanner/commit/1cff0e5304d252dec726fe7905f1d825350a6100))
* implement shopping budget management and optimization features ([c637edb](https://github.com/milkrunner/FoodPlanner/commit/c637edb06438ce8372d15da0d2041360c1aa53eb))
* implement undo functionality with toast notifications ([d404a4e](https://github.com/milkrunner/FoodPlanner/commit/d404a4e604923810d9698d39e7a0e263fba36373))
* implement week plan templates (Issue [#3](https://github.com/milkrunner/FoodPlanner/issues/3)) ([4b80b21](https://github.com/milkrunner/FoodPlanner/commit/4b80b21e5b62f0f3e9da2549d4844dc7970d55b0))
* Improve URL validation and sanitization tests for security ([7b26191](https://github.com/milkrunner/FoodPlanner/commit/7b261919cd87d87517bd263e02eb5426e0d2a97b))
* migrate database from SQLite to PostgreSQL ([545d189](https://github.com/milkrunner/FoodPlanner/commit/545d189d91e5fed9f5ea32b310f4f05503b0d322))
* Optimize Node.js setup in CI workflow by removing caching and simplifying dependency installation ([d22121e](https://github.com/milkrunner/FoodPlanner/commit/d22121eca897ea5370b3e1732349e6e5e58bef25))
* Restrict permissions in CI workflow and remove coverage comment step ([4ec7305](https://github.com/milkrunner/FoodPlanner/commit/4ec7305e8404f702ad1978c4b2e4e50f4ce364f4))
* update .gitignore and add VSCode settings for improved development environment ([c36a06a](https://github.com/milkrunner/FoodPlanner/commit/c36a06a7bf0c1e551ca6732e5760b3a94ba5d700))
* Update frozen ingredient names in categorization tests for accuracy ([61f0279](https://github.com/milkrunner/FoodPlanner/commit/61f0279c1184b46b72d0c46cc37b7ff9b5cd462a))
* Update ingredient names in categorization tests for accuracy ([b10b853](https://github.com/milkrunner/FoodPlanner/commit/b10b853ca9a0bd0cee83f72b726b5cda71ba0dcc))


### Bug Fixes

* apply rate limiting to all routes instead of /api/ only ([d902435](https://github.com/milkrunner/FoodPlanner/commit/d902435eb2575696adc251703f0d7db6702de6b5))
* correct docker-compose filename in release workflow ([64e9eb4](https://github.com/milkrunner/FoodPlanner/commit/64e9eb45692df74373a5a9eb7c80e128b8d84349))
* correct docker-compose filename in release workflow ([224c85d](https://github.com/milkrunner/FoodPlanner/commit/224c85d80a554131606ec9ada3a44e8ad5317ec9))
* enable release workflow to trigger on version tags ([#125](https://github.com/milkrunner/FoodPlanner/issues/125)) ([759e5cc](https://github.com/milkrunner/FoodPlanner/commit/759e5cca0c679c9ab35423d275d9a72f007c1e08))
* ensure CSP headers are applied to all nginx locations ([#127](https://github.com/milkrunner/FoodPlanner/issues/127)) ([33eea94](https://github.com/milkrunner/FoodPlanner/commit/33eea94688f103dadd443499ad4621012097b0f8))
* implement URL validation to prevent SSRF attacks and enhance toast notification safety ([668ebe1](https://github.com/milkrunner/FoodPlanner/commit/668ebe121c73ecdf88b001a13929a5d39de6977c))
* prevent command injection in video download ([c522564](https://github.com/milkrunner/FoodPlanner/commit/c522564ef23be0c1f9656a0c6d85f7b3c5d9aa61))
* remove duplicate lines in docker-compose.yml ([#92](https://github.com/milkrunner/FoodPlanner/issues/92)) ([57aca73](https://github.com/milkrunner/FoodPlanner/commit/57aca73ee4de51f1695d793b77c28a8b27b0d89c))
* remove leaked .env file from repository ([7eab476](https://github.com/milkrunner/FoodPlanner/commit/7eab476cacbf686a4fff3f57ce22fa8ca1453c82))
* remove leaked .env file from repository ([2e25103](https://github.com/milkrunner/FoodPlanner/commit/2e25103366bf6ac34ff191db99c7dd9d8c377948))
* show 'Add Item' button even when shopping list is empty ([3d164a5](https://github.com/milkrunner/FoodPlanner/commit/3d164a55e56c082c1d6053aaac645b202ca1664e))
* update Dockerfile to remove dependency reuse and streamline npm installation ([#120](https://github.com/milkrunner/FoodPlanner/issues/120)) ([cdd26de](https://github.com/milkrunner/FoodPlanner/commit/cdd26de6a064bf8b1cce3eae2a6aee8736cc66ae))
* update permissions to include package write access ([a400d5d](https://github.com/milkrunner/FoodPlanner/commit/a400d5dc86dbab60c332269deedaf36eeac94c7b))
* update release type from 'node' to 'simple' in configuration files ([0aca693](https://github.com/milkrunner/FoodPlanner/commit/0aca693414cdaacb546fe0496af3fd40afcc55c1))
* use --omit=dev instead of deprecated --only=production ([ebe25a7](https://github.com/milkrunner/FoodPlanner/commit/ebe25a718742466450ae79f01e15741dd5c5078c))
* use --omit=dev instead of deprecated --only=production ([0e933f6](https://github.com/milkrunner/FoodPlanner/commit/0e933f67345bf9aec2b933045343427754226fbe))

## [1.6.1](https://github.com/milkrunner/FoodPlanner/compare/v1.6.0...v1.6.1) (2026-01-10)


### Bug Fixes

* enable release workflow to trigger on version tags ([#125](https://github.com/milkrunner/FoodPlanner/issues/125)) ([759e5cc](https://github.com/milkrunner/FoodPlanner/commit/759e5cca0c679c9ab35423d275d9a72f007c1e08))

## [1.6.1](https://github.com/milkrunner/FoodPlanner/compare/v1.6.0...v1.6.1) (2026-01-10)


### Bug Fixes

* simplify Docker deployment to require only docker-compose.yml and .env ([#124](https://github.com/milkrunner/FoodPlanner/issues/124)) ([0abe90d](https://github.com/milkrunner/FoodPlanner/commit/0abe90de4f3e143bdce659ae606e4c8f87f419fc))
  * Frontend Docker image now includes all static files (nginx.conf, icons, etc.)
  * No more volume mounts required for production deployment
  * Updated documentation for simplified setup

## [1.6.0](https://github.com/milkrunner/FoodPlanner/compare/v1.5.1...v1.6.0) (2026-01-09)


### Features

* add onboarding tour and accessibility improvements ([#122](https://github.com/milkrunner/FoodPlanner/issues/122)) ([3e30ec9](https://github.com/milkrunner/FoodPlanner/commit/3e30ec93008c436e4a69971eed7f30dfa2508a8a))

## [1.5.1](https://github.com/milkrunner/FoodPlanner/compare/v1.5.0...v1.5.1) (2026-01-09)


### Bug Fixes

* update Dockerfile to remove dependency reuse and streamline npm installation ([#120](https://github.com/milkrunner/FoodPlanner/issues/120)) ([cdd26de](https://github.com/milkrunner/FoodPlanner/commit/cdd26de6a064bf8b1cce3eae2a6aee8736cc66ae))

## [1.5.0](https://github.com/milkrunner/FoodPlanner/compare/v1.4.0...v1.5.0) (2026-01-09)


### Features

* Implement AI-powered natural language search for recipes ([#112](https://github.com/milkrunner/FoodPlanner/issues/112)) ([326af30](https://github.com/milkrunner/FoodPlanner/commit/326af30c52d7b816217487b2b5d1756cab063a0b))

## [1.4.0](https://github.com/milkrunner/FoodPlanner/compare/v1.3.3...v1.4.0) (2026-01-05)


### Features

* Enhance PWA features and frontend responsiveness ([#103](https://github.com/milkrunner/FoodPlanner/issues/103)) ([45650df](https://github.com/milkrunner/FoodPlanner/commit/45650dfc26c850e403af1c008411541ac0e912d8))


### Bug Fixes

* remove leaked .env file from repository ([7eab476](https://github.com/milkrunner/FoodPlanner/commit/7eab476cacbf686a4fff3f57ce22fa8ca1453c82))
* remove leaked .env file from repository ([2e25103](https://github.com/milkrunner/FoodPlanner/commit/2e25103366bf6ac34ff191db99c7dd9d8c377948))

## [1.3.3](https://github.com/milkrunner/FoodPlanner/compare/v1.3.2...v1.3.3) (2026-01-05)


### Bug Fixes

* correct docker-compose filename in release workflow ([64e9eb4](https://github.com/milkrunner/FoodPlanner/commit/64e9eb45692df74373a5a9eb7c80e128b8d84349))
* correct docker-compose filename in release workflow ([224c85d](https://github.com/milkrunner/FoodPlanner/commit/224c85d80a554131606ec9ada3a44e8ad5317ec9))

## [1.3.2](https://github.com/milkrunner/FoodPlanner/compare/v1.3.1...v1.3.2) (2026-01-05)


### Bug Fixes

* use --omit=dev instead of deprecated --only=production ([ebe25a7](https://github.com/milkrunner/FoodPlanner/commit/ebe25a718742466450ae79f01e15741dd5c5078c))
* use --omit=dev instead of deprecated --only=production ([0e933f6](https://github.com/milkrunner/FoodPlanner/commit/0e933f67345bf9aec2b933045343427754226fbe))

## [1.3.1](https://github.com/milkrunner/FoodPlanner/compare/v1.3.0...v1.3.1) (2026-01-05)


### Bug Fixes

* remove duplicate lines in docker-compose.yml ([#92](https://github.com/milkrunner/FoodPlanner/issues/92)) ([57aca73](https://github.com/milkrunner/FoodPlanner/commit/57aca73ee4de51f1695d793b77c28a8b27b0d89c))

## [1.3.0](https://github.com/milkrunner/FoodPlanner/compare/v1.2.0...v1.3.0) (2026-01-05)


### Features

* enhance Docker setup with separate metadata extraction for frontend and backend, add health checks, and improve logging in backend ([45ceaa4](https://github.com/milkrunner/FoodPlanner/commit/45ceaa4a425be9630dde276b923dbf83eebdbd84))

## [1.2.0](https://github.com/milkrunner/FoodPlanner/compare/v1.1.0...v1.2.0) (2026-01-04)


### Features

* Enhance recipe retrieval with pagination and detailed response structure ([3e4bb5f](https://github.com/milkrunner/FoodPlanner/commit/3e4bb5f5971eb8183570329db1c0a105c2f8c3a0))
* Enhance recipe retrieval with pagination and detailed response structure ([af35bb0](https://github.com/milkrunner/FoodPlanner/commit/af35bb05c0e9833cf308b9d4a696c87e9f7f06fd))
* implement CORS whitelist configuration and update API documentation ([f31bb1e](https://github.com/milkrunner/FoodPlanner/commit/f31bb1eea74cff996b913578789cf1f4119c351a))
* Improve URL validation and sanitization tests for security ([7b26191](https://github.com/milkrunner/FoodPlanner/commit/7b261919cd87d87517bd263e02eb5426e0d2a97b))
* Optimize Node.js setup in CI workflow by removing caching and simplifying dependency installation ([d22121e](https://github.com/milkrunner/FoodPlanner/commit/d22121eca897ea5370b3e1732349e6e5e58bef25))
* Restrict permissions in CI workflow and remove coverage comment step ([4ec7305](https://github.com/milkrunner/FoodPlanner/commit/4ec7305e8404f702ad1978c4b2e4e50f4ce364f4))
* Update frozen ingredient names in categorization tests for accuracy ([61f0279](https://github.com/milkrunner/FoodPlanner/commit/61f0279c1184b46b72d0c46cc37b7ff9b5cd462a))
* Update ingredient names in categorization tests for accuracy ([b10b853](https://github.com/milkrunner/FoodPlanner/commit/b10b853ca9a0bd0cee83f72b726b5cda71ba0dcc))

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
