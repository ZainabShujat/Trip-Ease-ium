-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PLANNING', 'DRAFT_INVALID', 'PLANNED', 'BOOKING', 'TRAVELLING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('LIVE', 'CACHED', 'ESTIMATED', 'MOCK');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TransportDirection" AS ENUM ('OUTBOUND', 'RETURN', 'LOCAL');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('BUS', 'TRAIN', 'FLIGHT', 'CAR', 'TAXI', 'AUTO_RICKSHAW', 'SCOOTER', 'WALK');

-- CreateEnum
CREATE TYPE "ComfortTier" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "TransportArchetype" AS ENUM ('CHEAPEST', 'BALANCED', 'FASTEST');

-- CreateEnum
CREATE TYPE "LodgingArchetype" AS ENUM ('BUDGET', 'BEST_OVERALL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LodgingTier" AS ENUM ('BUDGET', 'MID', 'PREMIUM');

-- CreateEnum
CREATE TYPE "PoiCategory" AS ENUM ('SIGHT', 'ACTIVITY', 'RESTAURANT', 'CAFE', 'SHOPPING', 'NATURE', 'TEMPLE', 'MUSEUM', 'VIEWPOINT', 'MARKET');

-- CreateEnum
CREATE TYPE "TripPoiStatus" AS ENUM ('SHORTLISTED', 'SCHEDULED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('TRANSPORT', 'CHECK_IN', 'CHECK_OUT', 'SIGHT', 'ACTIVITY', 'MEAL', 'CAFE', 'SHOPPING', 'REST', 'FREE_TIME');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('NOT_REQUIRED', 'NOT_STARTED', 'LINK_OPENED', 'BOOKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'LOCAL_TRANSPORT', 'MISC');

-- CreateEnum
CREATE TYPE "BookingKind" AS ENUM ('TRANSPORT', 'LODGING', 'ACTIVITY', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('BOOKING', 'DOCUMENT', 'PACKING', 'PERMIT', 'OTHER');

-- CreateEnum
CREATE TYPE "TripPace" AS ENUM ('RELAXED', 'BALANCED', 'PACKED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "homeCity" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originCity" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION,
    "originLng" DOUBLE PRECISION,
    "destinationCity" TEXT NOT NULL,
    "destLat" DOUBLE PRECISION,
    "destLng" DOUBLE PRECISION,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "travellerCount" INTEGER NOT NULL,
    "budgetTotalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripVersion" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "engineMs" INTEGER,
    "stageTimingMs" JSONB,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Traveller" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageBand" TEXT,
    "accessibilityNeeds" TEXT[],
    "dietary" TEXT[],

    CONSTRAINT "Traveller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPreference" (
    "tripId" TEXT NOT NULL,
    "pace" "TripPace" NOT NULL DEFAULT 'BALANCED',
    "wakeTime" TEXT NOT NULL DEFAULT '08:00',
    "sleepTime" TEXT NOT NULL DEFAULT '22:30',
    "interests" TEXT[],
    "transportModes" "TransportMode"[],
    "avoidOvernightTransport" BOOLEAN NOT NULL DEFAULT false,
    "maxDailyTravelMins" INTEGER NOT NULL DEFAULT 240,
    "lodgingTier" "LodgingTier" NOT NULL DEFAULT 'MID',
    "foodPrefs" TEXT[],
    "constraints" TEXT[],
    "notes" TEXT,

    CONSTRAINT "TripPreference_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "TransportOption" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "direction" "TransportDirection" NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "operator" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "departAt" TIMESTAMP(3),
    "arriveAt" TIMESTAMP(3),
    "durationMins" INTEGER NOT NULL,
    "pricePerPersonMinor" INTEGER NOT NULL,
    "comfortTier" "ComfortTier" NOT NULL,
    "archetype" "TransportArchetype",
    "score" DOUBLE PRECISION,
    "rationale" TEXT,
    "bookingUrl" TEXT,
    "providerRef" TEXT,
    "provider" TEXT NOT NULL,
    "sourceKind" "SourceKind" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TransportOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LodgingOption" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT,
    "nightlyRateMinor" INTEGER NOT NULL,
    "totalRateMinor" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "tier" "LodgingTier" NOT NULL,
    "amenities" TEXT[],
    "distanceToCentroidM" INTEGER,
    "archetype" "LodgingArchetype",
    "score" DOUBLE PRECISION,
    "rationale" TEXT,
    "bookingUrl" TEXT,
    "providerRef" TEXT,
    "provider" TEXT NOT NULL,
    "sourceKind" "SourceKind" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LodgingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poi" (
    "id" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "PoiCategory" NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "priceLevel" INTEGER,
    "typicalDurationMins" INTEGER NOT NULL,
    "openingHours" JSONB NOT NULL,
    "address" TEXT,
    "photoRef" TEXT,
    "mapsUrl" TEXT,
    "websiteUrl" TEXT,
    "tags" TEXT[],
    "provider" TEXT NOT NULL,
    "sourceKind" "SourceKind" NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPoi" (
    "tripId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rationale" TEXT,
    "status" "TripPoiStatus" NOT NULL DEFAULT 'SHORTLISTED',

    CONSTRAINT "TripPoi_pkey" PRIMARY KEY ("tripId","poiId")
);

-- CreateTable
CREATE TABLE "ItineraryDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "summary" TEXT,
    "clusterCentroidLat" DOUBLE PRECISION,
    "clusterCentroidLng" DOUBLE PRECISION,
    "totalCostMinor" INTEGER NOT NULL DEFAULT 0,
    "totalTravelMins" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItineraryDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "poiId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "estimatedCostMinor" INTEGER NOT NULL DEFAULT 0,
    "travelMinsFromPrev" INTEGER,
    "travelDistanceM" INTEGER,
    "transportModeFromPrev" "TransportMode",
    "externalUrl" TEXT,
    "notes" TEXT,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "allocatedMinor" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinor" INTEGER NOT NULL DEFAULT 0,
    "actualMinor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "itemId" TEXT,
    "transportOptionId" TEXT,
    "lodgingOptionId" TEXT,
    "kind" "BookingKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "reference" TEXT,
    "amountMinor" INTEGER,
    "bookedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripTask" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL DEFAULT 'OTHER',
    "dueDate" DATE,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TripTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL,
    "tripId" TEXT,
    "task" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "schemaValid" BOOLEAN NOT NULL,
    "repairAttempts" INTEGER NOT NULL DEFAULT 0,
    "rawResponse" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationReport" (
    "id" TEXT NOT NULL,
    "tripVersionId" TEXT NOT NULL,
    "violations" JSONB NOT NULL,
    "hardCount" INTEGER NOT NULL DEFAULT 0,
    "softCount" INTEGER NOT NULL DEFAULT 0,
    "relaxedConstraints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCache" (
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_currentVersionId_key" ON "Trip"("currentVersionId");

-- CreateIndex
CREATE INDEX "Trip_userId_startDate_idx" ON "Trip"("userId", "startDate");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "TripVersion_tripId_idx" ON "TripVersion"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripVersion_tripId_versionNo_key" ON "TripVersion"("tripId", "versionNo");

-- CreateIndex
CREATE INDEX "Traveller_tripId_idx" ON "Traveller"("tripId");

-- CreateIndex
CREATE INDEX "TransportOption_tripId_direction_idx" ON "TransportOption"("tripId", "direction");

-- CreateIndex
CREATE INDEX "LodgingOption_tripId_idx" ON "LodgingOption"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Poi_providerRef_key" ON "Poi"("providerRef");

-- CreateIndex
CREATE INDEX "Poi_category_idx" ON "Poi"("category");

-- CreateIndex
CREATE INDEX "Poi_lat_lng_idx" ON "Poi"("lat", "lng");

-- CreateIndex
CREATE INDEX "TripPoi_poiId_idx" ON "TripPoi"("poiId");

-- CreateIndex
CREATE INDEX "ItineraryDay_tripId_idx" ON "ItineraryDay"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryDay_tripId_dayIndex_key" ON "ItineraryDay"("tripId", "dayIndex");

-- CreateIndex
CREATE INDEX "ItineraryItem_dayId_idx" ON "ItineraryItem"("dayId");

-- CreateIndex
CREATE INDEX "ItineraryItem_poiId_idx" ON "ItineraryItem"("poiId");

-- CreateIndex
CREATE UNIQUE INDEX "ItineraryItem_dayId_seq_key" ON "ItineraryItem"("dayId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_tripId_category_key" ON "BudgetLine"("tripId", "category");

-- CreateIndex
CREATE INDEX "Booking_tripId_idx" ON "Booking"("tripId");

-- CreateIndex
CREATE INDEX "TripTask_tripId_idx" ON "TripTask"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPlace_userId_poiId_key" ON "SavedPlace"("userId", "poiId");

-- CreateIndex
CREATE INDEX "LlmCall_tripId_idx" ON "LlmCall"("tripId");

-- CreateIndex
CREATE INDEX "LlmCall_task_promptVersion_idx" ON "LlmCall"("task", "promptVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationReport_tripVersionId_key" ON "ValidationReport"("tripVersionId");

-- CreateIndex
CREATE INDEX "ProviderCache_provider_idx" ON "ProviderCache"("provider");

-- CreateIndex
CREATE INDEX "ProviderCache_expiresAt_idx" ON "ProviderCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "TripVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripVersion" ADD CONSTRAINT "TripVersion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traveller" ADD CONSTRAINT "Traveller_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPreference" ADD CONSTRAINT "TripPreference_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOption" ADD CONSTRAINT "TransportOption_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LodgingOption" ADD CONSTRAINT "LodgingOption_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPoi" ADD CONSTRAINT "TripPoi_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPoi" ADD CONSTRAINT "TripPoi_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryDay" ADD CONSTRAINT "ItineraryDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ItineraryDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItineraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_transportOptionId_fkey" FOREIGN KEY ("transportOptionId") REFERENCES "TransportOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_lodgingOptionId_fkey" FOREIGN KEY ("lodgingOptionId") REFERENCES "LodgingOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripTask" ADD CONSTRAINT "TripTask_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmCall" ADD CONSTRAINT "LlmCall_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_tripVersionId_fkey" FOREIGN KEY ("tripVersionId") REFERENCES "TripVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

