-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "UsageRight" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEFAULT');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('Ethiopia', 'America', 'Polland');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "sub" TEXT,
    "name" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "password" TEXT,
    "picture" TEXT NOT NULL,
    "tags" TEXT[],
    "permissions" TEXT[],
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "subscription_expired" BOOLEAN NOT NULL DEFAULT false,
    "stripe_customer_id" TEXT NOT NULL,
    "checkout_session_id" TEXT,
    "number_of_socials" TEXT NOT NULL,
    "number_of_insta_members" INTEGER NOT NULL DEFAULT 0,
    "number_of_tiktok_members" INTEGER NOT NULL DEFAULT 0,
    "provider" "Provider" NOT NULL DEFAULT 'LOCAL',
    "pricingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instagram" (
    "id" TEXT NOT NULL,
    "pk" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "browser" JSONB NOT NULL DEFAULT '{}',
    "cookies" JSONB NOT NULL,
    "cookie" TEXT NOT NULL,
    "profile_pic_url" TEXT NOT NULL,
    "biography" TEXT,
    "followers" INTEGER NOT NULL,
    "following" INTEGER NOT NULL,
    "posts_count" INTEGER NOT NULL DEFAULT 0,
    "reels_count" INTEGER NOT NULL DEFAULT 0,
    "stories_count" INTEGER NOT NULL DEFAULT 0,
    "story_enabled" BOOLEAN NOT NULL DEFAULT true,
    "post_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reel_enabled" BOOLEAN NOT NULL DEFAULT true,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_saved_content" TEXT NOT NULL DEFAULT '0',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instagram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "pk" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_pic_url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTokMember" (
    "id" TEXT NOT NULL,
    "t_id" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "heartCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstaMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstaMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTikTokMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tikTokMemberId" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTikTokMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "pk" TEXT NOT NULL,
    "caption" TEXT,
    "mentions" TEXT[],
    "owner_pk" TEXT NOT NULL,
    "owner_full_name" TEXT NOT NULL,
    "owner_username" TEXT NOT NULL,
    "owner_followers" INTEGER NOT NULL,
    "owner_verified" BOOLEAN NOT NULL,
    "owner_profile_pic_url" TEXT NOT NULL,
    "usage_right" "UsageRight" NOT NULL DEFAULT 'DEFAULT',
    "instagramId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "latest_reel_media" INTEGER NOT NULL,
    "mentions" TEXT[],
    "owner_pk" TEXT NOT NULL,
    "owner_full_name" TEXT NOT NULL,
    "owner_username" TEXT NOT NULL,
    "owner_followers" INTEGER NOT NULL,
    "owner_verified" BOOLEAN NOT NULL,
    "owner_profile_pic_url" TEXT NOT NULL,
    "usage_right" "UsageRight" NOT NULL DEFAULT 'DEFAULT',
    "instagramId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "pk" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "usage_right" "UsageRight" NOT NULL DEFAULT 'DEFAULT',
    "caption" TEXT,
    "mentions" TEXT[],
    "owner_pk" TEXT NOT NULL,
    "owner_full_name" TEXT NOT NULL,
    "owner_username" TEXT NOT NULL,
    "owner_followers" INTEGER NOT NULL,
    "owner_verified" BOOLEAN NOT NULL,
    "owner_profile_pic_url" TEXT NOT NULL,
    "instagramId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgContent" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "taken_at" INTEGER NOT NULL,
    "is_video" BOOLEAN NOT NULL,
    "has_audio" BOOLEAN NOT NULL DEFAULT false,
    "duration" DOUBLE PRECISION,
    "display_url" TEXT,
    "postId" TEXT,
    "storyId" TEXT,
    "reelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TikTok" (
    "id" TEXT NOT NULL,
    "t_id" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "last_saved_time" TEXT NOT NULL DEFAULT '0',
    "followerCount" INTEGER NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "heartCount" INTEGER NOT NULL,
    "videoCount" INTEGER NOT NULL,
    "profilePic" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL,
    "secUid" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "connected" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "browser" JSONB NOT NULL DEFAULT '{}',
    "cookies" TEXT[],
    "cookie" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "t_id" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "caption" TEXT NOT NULL DEFAULT '',
    "timestamp" INTEGER NOT NULL,
    "usage_right" "UsageRight" NOT NULL DEFAULT 'DEFAULT',
    "display_url" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tikTokId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tikTokMemberId" TEXT NOT NULL,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "lable" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalAccessToken" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResetPasswordToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pricing" (
    "id" TEXT NOT NULL,
    "stripe_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prod_id" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "lookup_key" TEXT NOT NULL,
    "dictiption" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "number_of_socials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_sub_key" ON "User"("sub");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_customer_id_key" ON "User"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Instagram_id_key" ON "Instagram"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Instagram_pk_key" ON "Instagram"("pk");

-- CreateIndex
CREATE UNIQUE INDEX "Instagram_username_key" ON "Instagram"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Instagram_cookie_key" ON "Instagram"("cookie");

-- CreateIndex
CREATE UNIQUE INDEX "Member_id_key" ON "Member"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Member_pk_key" ON "Member"("pk");

-- CreateIndex
CREATE UNIQUE INDEX "Member_username_key" ON "Member"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokMember_id_key" ON "TikTokMember"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokMember_t_id_key" ON "TikTokMember"("t_id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTokMember_uniqueId_key" ON "TikTokMember"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInstaMember_id_key" ON "UserInstaMember"("id");

-- CreateIndex
CREATE INDEX "UserInstaMember_userId_memberId_idx" ON "UserInstaMember"("userId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTikTokMember_id_key" ON "UserTikTokMember"("id");

-- CreateIndex
CREATE INDEX "UserTikTokMember_userId_tikTokMemberId_idx" ON "UserTikTokMember"("userId", "tikTokMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTikTokMember_userId_tikTokMemberId_key" ON "UserTikTokMember"("userId", "tikTokMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_id_key" ON "Post"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Story_id_key" ON "Story"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Reel_id_key" ON "Reel"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IgContent_id_key" ON "IgContent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IgContent_media_id_key" ON "IgContent"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "IgContent_reelId_key" ON "IgContent"("reelId");

-- CreateIndex
CREATE UNIQUE INDEX "TikTok_id_key" ON "TikTok"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTok_t_id_key" ON "TikTok"("t_id");

-- CreateIndex
CREATE UNIQUE INDEX "TikTok_uniqueId_key" ON "TikTok"("uniqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_id_key" ON "Video"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Video_t_id_key" ON "Video"("t_id");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_id_key" ON "Collection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_id_key" ON "Tag"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_lable_key" ON "Tag"("lable");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_id_key" ON "PersonalAccessToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_access_token_key" ON "PersonalAccessToken"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_refresh_token_key" ON "PersonalAccessToken"("refresh_token");

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_id_key" ON "ResetPasswordToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_token_key" ON "ResetPasswordToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_userId_key" ON "ResetPasswordToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_id_key" ON "Pricing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_stripe_id_key" ON "Pricing"("stripe_id");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_name_key" ON "Pricing"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_prod_id_key" ON "Pricing"("prod_id");

-- CreateIndex
CREATE UNIQUE INDEX "Pricing_lookup_key_key" ON "Pricing"("lookup_key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "Pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instagram" ADD CONSTRAINT "Instagram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstaMember" ADD CONSTRAINT "UserInstaMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstaMember" ADD CONSTRAINT "UserInstaMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTikTokMember" ADD CONSTRAINT "UserTikTokMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTikTokMember" ADD CONSTRAINT "UserTikTokMember_tikTokMemberId_fkey" FOREIGN KEY ("tikTokMemberId") REFERENCES "TikTokMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_instagramId_fkey" FOREIGN KEY ("instagramId") REFERENCES "Instagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_instagramId_fkey" FOREIGN KEY ("instagramId") REFERENCES "Instagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_instagramId_fkey" FOREIGN KEY ("instagramId") REFERENCES "Instagram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgContent" ADD CONSTRAINT "IgContent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgContent" ADD CONSTRAINT "IgContent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgContent" ADD CONSTRAINT "IgContent_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TikTok" ADD CONSTRAINT "TikTok_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_tikTokId_fkey" FOREIGN KEY ("tikTokId") REFERENCES "TikTok"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_tikTokMemberId_fkey" FOREIGN KEY ("tikTokMemberId") REFERENCES "TikTokMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalAccessToken" ADD CONSTRAINT "PersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResetPasswordToken" ADD CONSTRAINT "ResetPasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
