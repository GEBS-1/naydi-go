import { pgTable, unique, text, bigint, index, uniqueIndex, foreignKey, check, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const apiBudget = pgTable("api_budget", {
	month: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	committed: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "api_budget_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("api_budget_rowid_key").on(table.rowid),
]);

export const apiCalls = pgTable("api_calls", {
	id: text().primaryKey().notNull(),
	month: text().notNull(),
	provider: text().notNull(),
	model: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reserved: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	actual: bigint({ mode: "number" }),
	status: text().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "api_calls_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_api_calls_month").using("btree", table.month.asc().nullsLast().op("text_ops")),
	unique("api_calls_rowid_key").on(table.rowid),
]);

export const connectionRequests = pgTable("connection_requests", {
	id: text().primaryKey().notNull(),
	data: text().notNull(),
	status: text().default('pending').notNull(),
	createdAt: text("created_at").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "connection_requests_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("connection_requests_rowid_key").on(table.rowid),
]);

export const discoveredOffers = pgTable("discovered_offers", {
	id: text().primaryKey().notNull(),
	city: text().notNull(),
	sourceKey: text("source_key").notNull(),
	sourceUrl: text("source_url").notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	checkedAt: bigint("checked_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "discovered_offers_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_discovered_checked").using("btree", table.checkedAt.asc().nullsLast().op("int8_ops")),
	index("idx_discovered_city_checked").using("btree", table.city.asc().nullsLast().op("int8_ops"), table.checkedAt.asc().nullsLast().op("int8_ops")),
	uniqueIndex("idx_discovered_city_source").using("btree", table.city.asc().nullsLast().op("text_ops"), table.sourceKey.asc().nullsLast().op("text_ops")),
	unique("discovered_offers_rowid_key").on(table.rowid),
]);

export const discoveryLimits = pgTable("discovery_limits", {
	id: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	count: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "discovery_limits_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("discovery_limits_rowid_key").on(table.rowid),
]);

export const discoverySources = pgTable("discovery_sources", {
	id: text().primaryKey().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "discovery_sources_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("discovery_sources_rowid_key").on(table.rowid),
]);

export const externalPlaces = pgTable("external_places", {
	id: text().primaryKey().notNull(),
	city: text().notNull(),
	category: text().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	checkedAt: bigint("checked_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "external_places_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_external_city_category").using("btree", table.city.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")),
	unique("external_places_rowid_key").on(table.rowid),
]);

export const paymentAudit = pgTable("payment_audit", {
	id: text().primaryKey().notNull(),
	orderId: text("order_id").notNull(),
	status: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	test: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "payment_audit_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("payment_audit_order").using("btree", table.orderId.asc().nullsLast().op("int8_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	unique("payment_audit_rowid_key").on(table.rowid),
]);

export const productEvents = pgTable("product_events", {
	id: text().primaryKey().notNull(),
	event: text().notNull(),
	city: text().notNull(),
	category: text().notNull(),
	dayActor: text("day_actor").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "product_events_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("product_events_time").using("btree", table.createdAt.asc().nullsLast().op("int8_ops"), table.event.asc().nullsLast().op("int8_ops")),
	unique("product_events_rowid_key").on(table.rowid),
]);

export const searchCache = pgTable("search_cache", {
	id: text().primaryKey().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "search_cache_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_search_cache_expiry").using("btree", table.expiresAt.asc().nullsLast().op("int8_ops")),
	unique("search_cache_rowid_key").on(table.rowid),
]);

export const searchLocks = pgTable("search_locks", {
	id: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	untilMs: bigint("until_ms", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "search_locks_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("search_locks_rowid_key").on(table.rowid),
]);

export const searchMetrics = pgTable("search_metrics", {
	id: text().primaryKey().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "search_metrics_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("search_metrics_rowid_key").on(table.rowid),
]);

export const searches = pgTable("searches", {
	id: text().primaryKey().notNull(),
	query: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	resultCount: bigint("result_count", { mode: "number" }).notNull(),
	createdAt: text("created_at").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "searches_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("searches_rowid_key").on(table.rowid),
]);

export const shoppingPlans = pgTable("shopping_plans", {
	id: text().primaryKey().notNull(),
	owner: text().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "shopping_plans_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_plans_owner").using("btree", table.owner.asc().nullsLast().op("text_ops")),
	unique("shopping_plans_rowid_key").on(table.rowid),
]);

export const uploads = pgTable("uploads", {
	id: text().primaryKey().notNull(),
	owner: text().notNull(),
	mime: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "uploads_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	unique("uploads_rowid_key").on(table.rowid),
]);

export const buyerAccounts = pgTable("buyer_accounts", {
	id: text().primaryKey().notNull(),
	provider: text().notNull(),
	subject: text().notNull(),
	name: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_accounts_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	uniqueIndex("unique_buyer_accounts_0").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.subject.asc().nullsLast().op("text_ops")),
	unique("buyer_accounts_rowid_key").on(table.rowid),
]);

export const buyerLogins = pgTable("buyer_logins", {
	hash: text().primaryKey().notNull(),
	browserHash: text("browser_hash").notNull(),
	provider: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
	codeHash: text("code_hash"),
	subject: text(),
	name: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	attempts: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	consumed: bigint({ mode: "number" }).default(0).notNull(),
	linkBuyerId: text("link_buyer_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_logins_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("buyer_logins_expiry").using("btree", table.expiresAt.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.linkBuyerId],
			foreignColumns: [buyerAccounts.id],
			name: "buyer_logins_link_buyer_id_fkey"
		}),
	unique("buyer_logins_rowid_key").on(table.rowid),
]);

export const buyerPayments = pgTable("buyer_payments", {
	id: text().primaryKey().notNull(),
	buyerId: text("buyer_id").notNull(),
	providerId: text("provider_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amount: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	searches: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	days: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	test: bigint({ mode: "number" }).notNull(),
	status: text().notNull(),
	confirmationUrl: text("confirmation_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_payments_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	uniqueIndex("buyer_one_pending_payment").using("btree", table.buyerId.asc().nullsLast().op("text_ops")).where(sql`(status = ANY (ARRAY['creating'::text, 'pending'::text, 'waiting_for_capture'::text]))`),
	index("buyer_payments_owner").using("btree", table.buyerId.asc().nullsLast().op("int8_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	uniqueIndex("unique_buyer_payments_2").using("btree", table.providerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyerAccounts.id],
			name: "buyer_payments_buyer_id_fkey"
		}),
	unique("buyer_payments_rowid_key").on(table.rowid),
]);

export const buyerPersonal = pgTable("buyer_personal", {
	buyerId: text("buyer_id").primaryKey().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	version: bigint({ mode: "number" }).default(1).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_personal_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyerAccounts.id],
			name: "buyer_personal_buyer_id_fkey"
		}),
	unique("buyer_personal_rowid_key").on(table.rowid),
]);

export const buyerGrants = pgTable("buyer_grants", {
	id: text().primaryKey().notNull(),
	buyerId: text("buyer_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	remaining: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }),
	kind: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	test: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_grants_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("buyer_grants_owner").using("btree", table.buyerId.asc().nullsLast().op("int8_ops"), table.expiresAt.asc().nullsLast().op("int8_ops")),
	unique("buyer_grants_rowid_key").on(table.rowid),
	check("buyer_grants_remaining_check", sql`remaining >= 0`),
]);

export const buyerSearches = pgTable("buyer_searches", {
	id: text().primaryKey().notNull(),
	buyerId: text("buyer_id").notNull(),
	grantId: text("grant_id").notNull(),
	status: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_searches_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	foreignKey({
			columns: [table.grantId],
			foreignColumns: [buyerGrants.id],
			name: "buyer_searches_grant_id_fkey"
		}),
	unique("buyer_searches_rowid_key").on(table.rowid),
]);

export const buyerSessions = pgTable("buyer_sessions", {
	hash: text().primaryKey().notNull(),
	buyerId: text("buyer_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
	loginProvider: text("login_provider"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_sessions_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("buyer_sessions_expiry").using("btree", table.expiresAt.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyerAccounts.id],
			name: "buyer_sessions_buyer_id_fkey"
		}),
	unique("buyer_sessions_rowid_key").on(table.rowid),
]);

export const shops = pgTable("shops", {
	id: text().primaryKey().notNull(),
	owner: text(),
	data: text().notNull(),
	visibility: text().default('public').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "shops_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_shops_owner").using("btree", table.owner.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_shops_single_social_owner").using("btree", table.owner.asc().nullsLast().op("text_ops")).where(sql`((owner ~~ 'telegram:%'::text) OR (owner ~~ 'max:%'::text) OR (owner ~~ 'vk:%'::text))`),
	unique("shops_rowid_key").on(table.rowid),
]);

export const claims = pgTable("claims", {
	id: text().primaryKey().notNull(),
	storeId: text("store_id").notNull(),
	applicant: text().notNull(),
	status: text().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "claims_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_claims_applicant").using("btree", table.applicant.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "claims_store_id_fkey"
		}),
	unique("claims_rowid_key").on(table.rowid),
]);

export const inquiries = pgTable("inquiries", {
	id: text().primaryKey().notNull(),
	storeId: text("store_id").notNull(),
	customer: text().notNull(),
	data: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "inquiries_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_inquiries_customer").using("btree", table.customer.asc().nullsLast().op("text_ops")),
	index("idx_inquiries_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "inquiries_store_id_fkey"
		}),
	unique("inquiries_rowid_key").on(table.rowid),
]);

export const onboarding = pgTable("onboarding", {
	storeId: text("store_id").primaryKey().notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: text("created_at").notNull(),
	consent: text(),
	confirmedAt: text("confirmed_at"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "onboarding_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "onboarding_store_id_fkey"
		}),
	unique("onboarding_rowid_key").on(table.rowid),
]);

export const ownerInvites = pgTable("owner_invites", {
	hash: text().primaryKey().notNull(),
	storeId: text("store_id").notNull(),
	email: text().notNull(),
	expiresAt: text("expires_at").notNull(),
	usedAt: text("used_at"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "owner_invites_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_invites_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "owner_invites_store_id_fkey"
		}),
	unique("owner_invites_rowid_key").on(table.rowid),
]);

export const ownerAccounts = pgTable("owner_accounts", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "owner_accounts_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	uniqueIndex("owner_accounts_email_unique").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("owner_accounts_rowid_key").on(table.rowid),
]);

export const ownerSessions = pgTable("owner_sessions", {
	hash: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "owner_sessions_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_owner_session_expiry").using("btree", table.expiresAt.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [ownerAccounts.id],
			name: "owner_sessions_user_id_fkey"
		}),
	unique("owner_sessions_rowid_key").on(table.rowid),
]);

export const previewTokens = pgTable("preview_tokens", {
	hash: text().primaryKey().notNull(),
	storeId: text("store_id").notNull(),
	expiresAt: text("expires_at").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	revoked: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "preview_tokens_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_preview_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "preview_tokens_store_id_fkey"
		}),
	unique("preview_tokens_rowid_key").on(table.rowid),
]);

export const products = pgTable("products", {
	id: text().primaryKey().notNull(),
	storeId: text("store_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	published: bigint({ mode: "number" }).notNull(),
	data: text().notNull(),
	normalizedName: text("normalized_name"),
	sourceType: text("source_type"),
	sourceUrl: text("source_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	checkedAt: bigint("checked_at", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "products_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("idx_products_normalized_name").using("btree", table.normalizedName.asc().nullsLast().op("text_ops")),
	index("idx_products_published").using("btree", table.published.asc().nullsLast().op("int8_ops")),
	index("idx_products_source").using("btree", table.sourceType.asc().nullsLast().op("text_ops"), table.sourceUrl.asc().nullsLast().op("text_ops")),
	index("idx_products_store").using("btree", table.storeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.storeId],
			foreignColumns: [shops.id],
			name: "products_store_id_fkey"
		}),
	unique("products_rowid_key").on(table.rowid),
]);


export const favorites = pgTable("favorites", {
	customer: text().notNull(),
	productId: text("product_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "favorites_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	primaryKey({ columns: [table.customer, table.productId], name: "favorites_pkey"}),
	unique("favorites_rowid_key").on(table.rowid),
]);

export const buyerIdentities = pgTable("buyer_identities", {
	provider: text().notNull(),
	subject: text().notNull(),
	buyerId: text("buyer_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "buyer_identities_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	index("buyer_identities_account").using("btree", table.buyerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.buyerId],
			foreignColumns: [buyerAccounts.id],
			name: "buyer_identities_buyer_id_fkey"
		}),
	primaryKey({ columns: [table.provider, table.subject], name: "buyer_identities_pkey"}),
	unique("buyer_identities_rowid_key").on(table.rowid),
]);

export const botNewsConsent = pgTable("bot_news_consent", {
	provider: text().notNull(),
	subject: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subscribed: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
	consentVersion: text("consent_version").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "bot_news_consent_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	primaryKey({ columns: [table.provider, table.subject], name: "bot_news_consent_pkey"}),
	unique("bot_news_consent_rowid_key").on(table.rowid),
]);

export const botNewsDeliveries = pgTable("bot_news_deliveries", {
	campaign: text().notNull(),
	provider: text().notNull(),
	subject: text().notNull(),
	status: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowid: bigint({ mode: "number" }).generatedByDefaultAsIdentity({ name: "bot_news_deliveries_rowid_seq", startWith: 1, increment: 1, minValue: 1, cache: 1 }),
}, (table) => [
	primaryKey({ columns: [table.campaign, table.provider, table.subject], name: "bot_news_deliveries_pkey"}),
	unique("bot_news_deliveries_rowid_key").on(table.rowid),
]);

export const listingDrafts = pgTable("listing_drafts", {owner:text().primaryKey().references(()=>buyerAccounts.id),data:text().notNull(),version:bigint({mode:"number"}).notNull().default(1),updatedAt:bigint("updated_at",{mode:"number"}).notNull()});

export const chatThreads=pgTable('chat_threads',{
 id:text().primaryKey(),productId:text('product_id').references(()=>products.id,{onDelete:'set null'}),
 buyerId:text('buyer_id').notNull().references(()=>buyerAccounts.id,{onDelete:'cascade'}),
 sellerId:text('seller_id').notNull().references(()=>buyerAccounts.id,{onDelete:'cascade'}),
 productName:text('product_name').notNull(),photoUrl:text('photo_url').notNull(),city:text().notNull(),
 buyerName:text('buyer_name').notNull(),sellerName:text('seller_name').notNull(),
 createdAt:bigint('created_at',{mode:'number'}).notNull(),updatedAt:bigint('updated_at',{mode:'number'}).notNull(),
},t=>[uniqueIndex('chat_threads_product_buyer').on(t.productId,t.buyerId),index('chat_threads_buyer_updated').on(t.buyerId,t.updatedAt),index('chat_threads_seller_updated').on(t.sellerId,t.updatedAt),check('chat_threads_distinct_participants',sql`${t.buyerId} <> ${t.sellerId}`)]);
export const chatMessages=pgTable('chat_messages',{
 id:text().primaryKey(),threadId:text('thread_id').notNull().references(()=>chatThreads.id,{onDelete:'cascade'}),
 senderId:text('sender_id').notNull().references(()=>buyerAccounts.id,{onDelete:'cascade'}),
 seq:bigint({mode:'number'}).generatedByDefaultAsIdentity(),body:text().notNull(),
 sentAt:bigint('sent_at',{mode:'number'}).notNull(),readAt:bigint('read_at',{mode:'number'}),
},t=>[index('chat_messages_thread_seq').on(t.threadId,t.seq),index('chat_messages_sender').on(t.senderId),index('chat_messages_unread').on(t.threadId,t.senderId).where(sql`${t.readAt} IS NULL`)]);

export const buyerContactPhones = pgTable("buyer_contact_phones", {
 buyerId: text("buyer_id").primaryKey().references(() => buyerAccounts.id, { onDelete: "cascade" }),
 phone: text().notNull(),
 provider: text().notNull(),
 updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (table) => [
 check("buyer_contact_phones_provider_check", sql`${table.provider} IN ('telegram', 'max')`),
]);
