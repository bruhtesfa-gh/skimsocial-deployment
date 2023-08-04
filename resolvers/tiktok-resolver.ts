import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import TikTokAPI from "../helper/API/tiktok";


export default {
    getUserTikTokAccounts: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            const tiktoks = await prisma.tikTok.findMany({
                where: {
                    userId: parent.id,
                },
                select: {
                    id: true,
                    uniqueId: true,
                    connected: true,
                    profilePic: true,
                    nickname: true,
                }
            });
            if (tiktoks) {
                return tiktoks;
            } else {
                return GQLErrors.INSTAGRAM_ACCOUNT_NOT_FOUND
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getTikTokAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getTikTokAccount');
        if (_Error)
            return _Error;
        try {
            const { tik_tok_id } = args.json_input;
            const tiktok = await prisma.tikTok.findUnique({
                where: {
                    id: tik_tok_id
                },
                select: {
                    id: true,
                    t_id: true,
                    uniqueId: true,
                    connected: true,
                    followerCount: true,
                    followingCount: true,
                    heartCount: true,
                    videoCount: true,
                    profilePic: true,
                    nickname: true,
                    bio: true,
                    userId: true,
                }
            });
            if (tiktok) {
                if (tiktok.userId != auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                return tiktok;
            } else {
                return GQLErrors.INSTAGRAM_ACCOUNT_NOT_FOUND
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getTikTokAccountVideos: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            const videos = await prisma.video.findMany({
                where: {
                    tikTokId: parent.id
                },
                select: {
                    id: true,
                    link: true,
                    t_id: true,
                    width: true,
                    height: true,
                    duration: true,
                    caption: true,
                    timestamp: true,
                    usage_right: true,
                    display_url: true,
                    url: true,
                    tikTokId: true,
                    userId: true,
                    tikTokMemberId: true,
                }
            });
            return videos;
        } catch (error: any) {
            //console.log(error.message);
            return GQLErrors.SERVER_ERROR;
        }
    },
    getVideoOwner: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            const owner = await prisma.tikTokMember.findUnique({
                where: {
                    id: parent.tikTokMemberId
                },
                select: {
                    id: true,
                    uniqueId: true,
                    followerCount: true,
                    followingCount: true,
                    heartCount: true,
                    videoCount: true,
                    profileUrl: true,
                    nickname: true,
                    bio: true,
                }
            });
            return owner;
        } catch (error: any) {
            //console.log(error.message);
            return GQLErrors.SERVER_ERROR;
        }
    },
    saveTikTokVideoWithUrl: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'saveTikTokVideoWithUrl');
        if (_Error)
            return _Error;
        try {
            //get username and content id from url like this: https://www.tiktok.com/@username/video/1234567891234567891
            const { tiktok_id, url } = args.json_input;
            let username = url.split('/')[3].replace('@', '');
            let content_id = url.split('/')[5];
            const tiktok = await prisma.tikTok.findUnique({
                where: {
                    id: tiktok_id
                },
                select: {
                    id: true,
                    t_id: true,
                    uniqueId: true,
                    connected: true,
                    followerCount: true,
                    followingCount: true,
                    heartCount: true,
                    videoCount: true,
                    profilePic: true,
                    nickname: true,
                    bio: true,
                    userId: true,
                    user: true,
                }
            });
            if (tiktok) {
                if (tiktok.userId != auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                const ValidMember = await TikTokAPI.getValidMemberBasedOnSubscription(tiktok.user.id, tiktok.user.number_of_socials);
                if (!ValidMember.unlimited && ValidMember.remaining_tik_tok_members < 1) {
                    return {
                        success: false,
                        message: 'You have reached your limit for saving videos from TikTok. Please upgrade your subscription to save more videos.',
                        url: '',
                        thumbnail: '',
                    }
                }
                const video_info = await TikTokAPI.DownloadTiktokVideo(username, content_id);
                if (!video_info || !video_info.detail) {
                    return {
                        success: false,
                        message: 'Video not found on TikTok. Please check the url and try again.',
                        url: '',
                        thumbnail: '',
                    }
                }
                let download_data: any = {
                    "video": {
                        path: video_info.url,
                        size: 0,
                        uploaded: false,
                        file_not_found: false
                    },
                }
                download_data["thumbnail"] = {
                    path: video_info.detail.thumbnail_url,
                    size: 0,
                    uploaded: false,
                    file_not_found: false
                }
                const download_video = await TikTokAPI.downloadFiles(download_data);
                ////console.log(download_video);
                if (!download_video["video"].uploaded) {
                    return {
                        success: false,
                        message: 'Video not found on TikTok. Please check the url and try again.',
                        url: '',
                        thumbnail: '',
                    }
                }
                const tikTokMember = await TikTokAPI.createTiktokMemberForUser(username, tiktok.user);
                if (tikTokMember) {
                    try {
                        const video = await prisma.video.create({
                            data: {
                                t_id: content_id,
                                link: `https://www.tiktok.com/@${username}/video/${content_id}`,
                                width: video_info.detail.thumbnail_width,
                                height: video_info.detail.thumbnail_height,
                                duration: 0,
                                caption: video_info.detail.title,
                                url: download_video["video"].path,
                                display_url: download_video["thumbnail"].path,
                                timestamp: 0,
                                tikTokMember: {
                                    connect: {
                                        id: tikTokMember.id
                                    }
                                },
                                tiktok: {
                                    connect: {
                                        id: tiktok.id
                                    }
                                },
                                user: {
                                    connect: {
                                        id: tiktok.userId
                                    }
                                },
                            },
                        });
                        return {
                            success: true,
                            message: 'Video saved successfully.',
                            url: video.url,
                            thumbnail: video.display_url,
                        }
                    } catch (error: any) {
                        return GQLErrors.SERVER_ERROR;
                    }
                } else {
                    return {
                        success: false,
                        message: 'TikTok account not found. Please check the url and try again.',
                        url: '',
                        thumbnail: '',
                    }
                }
            } else {
                return {
                    success: false,
                    message: 'TikTok account not found.',
                    url: '',
                    thumbnail: '',
                }
            }
        }
        catch (error: any) {
            //console.log(error.message);
            return GQLErrors.SERVER_ERROR;
        }
    },
}