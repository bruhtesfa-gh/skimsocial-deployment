import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Middlewares from "../middleware/middleware";
import Excuter from "../middleware/middleware-executer";
interface FilterInput {
    usernames: string[],
    unique_ids: string[],
    type: string[],
    start_time: number,
    end_time: number,
    hashtags: string[],
    content_type: number,
    usage_right: Array<'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFAULT'>,
    followers: number,
    verified: 0 | 1 | 2,
    collection_include: string[],
    collection_exclude: string[],
    likes: number,
    comments: number,
    shares: number,
    views: number,
    limit: number,
    offset: number,
}
export default {
    filterPostIgContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            return await prisma.igContent.findMany({
                where: {
                    postId: parent.id
                }
            });
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterReelIgContent: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            return await prisma.igContent.findFirst({
                where: {
                    reelId: parent.id
                }
            });
        } catch (error: any) {
            //console.log(error);
        }
        return null;
    },
    filterStoryIgContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            return await prisma.igContent.findMany({
                where: {
                    storyId: parent.id
                }
            })
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterInstagramPosts: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const input = parent.input as FilterInput;
        try {
            const post = await prisma.post.findMany({
                where: {
                    AND: [
                        {
                            instagramId: parent.id
                        },
                        input.hashtags.length > 0 ? {
                            OR: input.hashtags.map((hashtag) => {
                                return {
                                    caption: {
                                        contains: hashtag
                                    }
                                }
                            })
                        } : {},
                        input.start_time > 0 ? {
                            igContents: {
                                some: {
                                    taken_at: {
                                        gte: input.start_time,
                                    }
                                }
                            }
                        } : {},
                        input.end_time > 0 ? {
                            igContents: {
                                some: {
                                    taken_at: {
                                        lte: input.end_time,
                                    }
                                }
                            }
                        } : {},
                        input.followers > 0 ? {
                            owner_followers: {
                                gte: input.followers
                            }
                        } : {},
                        input.usage_right.length > 0 ? {
                            OR: input.usage_right.map((usage_right) => {
                                return {
                                    usage_right: usage_right
                                }
                            })
                        } : {},
                        input.verified !== 2 ? {
                            owner_verified: input.verified == 1
                        } : {},
                        input.collection_include.length > 0 ? {
                            OR: input.collection_include.map((collection) => {
                                return {
                                    collection: {
                                        name: collection
                                    }
                                }
                            })
                        } : {},
                        input.content_type != 2 ? {
                            igContents: {
                                some: {
                                    is_video: input.content_type == 1
                                }
                            }
                        } : {},
                    ]
                },
                select: {
                    id: true,
                    caption: true,
                    mentions: true,
                    owner_username: true,
                    owner_full_name: true,
                    owner_profile_pic_url: true,
                    owner_followers: true,
                    owner_verified: true,
                    usage_right: true,
                }
            });
            return post;
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterInstagramReels: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const input = parent.input as FilterInput;
        try {
            const reels = await prisma.reel.findMany({
                where: {
                    AND: [
                        {
                            instagramId: parent.id
                        },
                        input.hashtags.length > 0 ? {
                            OR: input.hashtags.map((hashtag) => {
                                return {
                                    caption: {
                                        contains: hashtag
                                    }
                                }
                            })
                        } : {},
                        input.start_time > 0 ? {
                            igContent: {
                                taken_at: {
                                    gte: input.start_time,
                                }
                            }
                        } : {},
                        input.end_time > 0 ? {
                            igContent: {
                                taken_at: {
                                    lte: input.end_time,
                                }
                            }
                        } : {},
                        input.followers > 0 ? {
                            owner_followers: {
                                gte: input.followers
                            }
                        } : {},
                        input.usage_right.length > 0 ? {
                            OR: input.usage_right.map((usage_right) => {
                                return {
                                    usage_right: usage_right
                                }
                            })
                        } : {},
                        input.verified !== 2 ? {
                            owner_verified: input.verified == 1
                        } : {},
                        input.collection_include.length > 0 ? {
                            OR: input.collection_include.map((collection) => {
                                return {
                                    collection: {
                                        name: collection
                                    }
                                }
                            })
                        } : {},
                        input.content_type != 2 ? {
                            igContent: {
                                is_video: input.content_type == 1
                            }
                        } : {},
                    ]
                },
                select: {
                    id: true,
                    caption: true,
                    mentions: true,
                    usage_right: true,
                    owner_username: true,
                    owner_full_name: true,
                    owner_profile_pic_url: true,
                    owner_followers: true,
                    owner_verified: true,
                }
            });
            return reels;
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterInstagramStories: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const input = parent.input as FilterInput;
        try {
            return await prisma.story.findMany({
                where: {
                    AND: [
                        {
                            instagramId: parent.id
                        },
                        input.start_time > 0 ? {
                            igContents: {
                                some: {
                                    taken_at: {
                                        gte: input.start_time,
                                    }
                                }
                            }
                        } : {},
                        input.end_time > 0 ? {
                            igContents: {
                                some: {
                                    taken_at: {
                                        lte: input.end_time,
                                    }
                                }
                            }
                        } : {},
                        input.followers > 0 ? {
                            owner_followers: {
                                gte: input.followers
                            }
                        } : {},
                        input.usage_right.length > 0 ? {
                            OR: input.usage_right.map((usage_right) => {
                                return {
                                    usage_right: usage_right
                                }
                            })
                        } : {},
                        input.verified !== 2 ? {
                            owner_verified: input.verified == 1
                        } : {},
                        input.collection_include.length > 0 ? {
                            OR: input.collection_include.map((collection) => {
                                return {
                                    collection: {
                                        name: collection
                                    }
                                }
                            })
                        } : {},
                        input.content_type != 2 ? {
                            igContents: {
                                some: {
                                    is_video: input.content_type == 1
                                }
                            }
                        } : {},
                    ]
                },
                select: {
                    id: true,
                    mentions: true,
                    usage_right: true,
                    owner_username: true,
                    owner_full_name: true,
                    owner_profile_pic_url: true,
                    owner_followers: true,
                    owner_verified: true,
                }
            });
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterVideoOwner: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            return await prisma.tikTokMember.findUnique({
                where: {
                    id: parent.tikTokMemberId
                }
            });
        } catch (error: any) {
            //console.log(error);
        }
        return null;
    },
    filterTikTokVideos: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const input = parent.input as FilterInput;
        //console.log(parent);
        try {
            return await prisma.video.findMany({
                where: {
                    AND: [
                        {
                            tikTokId: parent.id
                        },
                        input.hashtags.length > 0 ? {
                            OR: input.hashtags.map((hashtag) => {
                                return {
                                    caption: {
                                        contains: hashtag
                                    }
                                }
                            })
                        } : {},
                        input.start_time > 0 ? {
                            timestamp: {
                                gte: input.start_time,
                            }
                        } : {},
                        input.end_time > 0 ? {
                            timestamp: {
                                lte: input.end_time,
                            }
                        } : {},
                        input.followers > 0 ? {
                            tikTokMember: {
                                followerCount: {
                                    gte: input.followers
                                }
                            }
                        } : {},
                        input.usage_right.length > 0 ? {
                            OR: input.usage_right.map((usage_right) => {
                                return {
                                    usage_right: usage_right
                                }
                            })
                        } : {},
                        input.collection_include.length > 0 ? {
                            OR: input.collection_include.map((collection) => {
                                return {
                                    collection: {
                                        name: collection
                                    }
                                }
                            })
                        } : {},
                    ]
                },
            });
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterInstagrams: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        if (!parent.input)
            return [];
        try {
            const instagrams = await prisma.instagram.findMany({
                where: {
                    AND: [
                        {
                            username: {
                                in: parent.input.usernames
                            }
                        },
                        {
                            userId: parent.id
                        }
                    ]
                },
                select: {
                    id: true,
                    full_name: true,
                    username: true,
                    profile_pic_url: true,
                    followers: true,
                    following: true,
                    posts_count: true,
                    reels_count: true,
                    stories_count: true,
                }
            });

            return instagrams.map((instagram) => {
                return {
                    ...instagram,
                    input: parent.input
                };
            });
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterTikToks: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        if (!parent.input)
            return [];
        ////console.log(parent.input);
        try {
            const tiktoks = await prisma.tikTok.findMany({
                where: {
                    AND: [
                        {
                            uniqueId: {
                                in: parent.input.unique_ids
                            }
                        },
                        {
                            userId: parent.id
                        }
                    ]
                },
                select: {
                    id: true,
                    uniqueId: true,
                    nickname: true,
                    bio: true,
                    profilePic: true,
                    followerCount: true,
                    followingCount: true,
                    heartCount: true,
                    videoCount: true,
                }
            });
            return tiktoks.map((tiktok) => {
                return {
                    ...tiktok,
                    input: parent.input
                };
            });
        } catch (error: any) {
            //console.log(error);
        }
        return [];
    },
    filterContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'filterContents');
        if (_Error)
            return _Error;
        const input = args.json_input;
        if (!input)
            return {
                success: false,
                message: 'Filter input is required!',
                id: auth.id,
                instagrams: [],
                tiktoks: [],
            }
        if (!input.usernames && !input.uniqueIds)
            return {
                success: false,
                message: 'Either instagram or tiktok is required!',
                id: auth.id,
                instagrams: [],
                tiktoks: [],
            }
        const user = await prisma.user.findUnique({
            where: {
                id: auth.id
            },
            select: {
                id: true,
            }
        });
        if (user)
            return {
                success: true,
                message: 'Filter contents!',
                id: user.id,
                input
            }
        else
            return {
                success: false,
                message: 'User not found!',
                id: auth.id,
                instagrams: [],
                tiktoks: [],
            }
    }
}