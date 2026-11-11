# Nearby map and product cards — 2026-11-03

Published release: 20261103T161027Z. Only the running release remains on the VPS.

Confirmed offers are ordered by straight-line distance from the selected anchor in the buyer UI. There is no fixed six-result limit; the list progressively reveals ten results at a time. All confirmed points remain selectable on the map. Clicking a marker selects and reveals its first product; individual offers in the map panel select and reveal their corresponding list card. Selecting a list card highlights its seller point. The mobile map retains the list below it.

Product images have larger dedicated slots. External photos load through /api/search/image using a server-issued details key, not an arbitrary client URL. IPv4 DNS addresses are checked and pinned, redirects are not followed, supported raster signatures are required, responses are capped at 4 MiB, downloads are queued four at a time, and the in-memory cache is capped at 32 MiB. No photo copies accumulate on disk.

Structured product model, brand, characteristics and aggregate ratings are extracted when published; a few direct item pages are also checked for those facts. Ratings stay product-scoped and are not invented from a seller score. Missing fields remain absent.

Verification: typecheck, production build, offer/search regression scripts and image-loader restrictions passed. Browser fixtures at 390 and 1440 px verified marker-to-card selection, selecting a different map offer, full addresses, route targets, large photo slots, facts and ratings. Live search returned 12 located products; eight actual product photos concurrently returned HTTP 200 image/jpeg. Raw live report: artifacts/coat-map/live-report.json. Browser interactions use simulated transport; the live API and photo checks use production.
