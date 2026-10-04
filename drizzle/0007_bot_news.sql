CREATE TABLE bot_news_consent (
 provider TEXT NOT NULL, subject TEXT NOT NULL,
 subscribed INTEGER NOT NULL DEFAULT 0 CHECK(subscribed IN (0,1)),
 updated_at INTEGER NOT NULL, consent_version TEXT NOT NULL,
 PRIMARY KEY(provider,subject)
);
CREATE TABLE bot_news_deliveries (
 campaign TEXT NOT NULL, provider TEXT NOT NULL, subject TEXT NOT NULL,
 status TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(campaign,provider,subject)
);
