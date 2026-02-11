import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

const sw = /** @type {any} */ (self);

sw.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Safe profile only precache build assets injected at compile time
// No runtime caching routes for api and html so fresh data comes from network
// @ts-expect-error - replaced by Workbox injectManifest at build time
precacheAndRoute(self.__WB_MANIFEST);
