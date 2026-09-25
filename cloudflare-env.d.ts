declare namespace Cloudflare {
  interface Env {
    OVERPASS_URL?: string;
    PERPLEXITY_API_KEY?: string;
    ROUTERAI_WEB_MODE?: string;
    ROUTERAI_WEB_MODEL?: string;
    API_MONTHLY_LIMIT_RUB?: string;
    API_MAX_CALL_RUB?: string;
    ROUTERAI_API_KEY?: string;
    ROUTERAI_MODEL?: string;
    ADMIN_EMAIL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    BRAVE_SEARCH_API_KEY?: string;
    PHOTON_URL?: string;
    VALHALLA_URL?: string;
    AUTH_TRUSTED_PROXY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
