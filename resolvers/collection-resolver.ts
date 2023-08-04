import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import { User } from "@prisma/client";

export default {
    getUserMiniCollections: async (parent: User, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const { id } = parent;
        try {
            const collections = await prisma.collection.findMany({
                where: {
                    userId: id,
                },
                select: {
                    id: true,
                    name: true,
                }
            });
            return collections;
        } catch (error: any) {
            return [];
        }
    },
    getCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getCollection');
        if (_Error)
            return _Error;
        const { id } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id,
                },
                include: {
                    posts: true,
                    reels: true,
                    stories: true,
                    videos: true,
                }
            });
            //check if collection is requested by the owner
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            return collection;
        } catch (error: any) {
            return null; { id }
        }
    },
    createCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'createCollection');
        if (_Error)
            return _Error;
        const { name } = args.json_input;
        try {
            const checkCollection = await prisma.collection.findUnique({
                where: {
                    userId_name: {
                        name,
                        userId: auth.id,
                    }
                }
            });
            if (checkCollection)
                return {
                    success: false,
                    message: 'Collection already exists with the same name',
                    data: null,
                };
            const collection = await prisma.collection.create({
                data: {
                    name,
                    user: {
                        connect: {
                            id: auth.id,
                        }
                    }
                }
            });
            if (collection)
                return {
                    success: true,
                    message: 'Collection created successfully',
                    data: collection,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Collection not created',
            data: null,
        };
    },
    renameCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'renameCollection');
        if (_Error)
            return _Error;
        const { id, name } = args.json_input;
        try {
            const checkCollection = await prisma.collection.findUnique({
                where: {
                    userId_name: {
                        name,
                        userId: auth.id,
                    }
                }
            });
            if (checkCollection)
                return {
                    success: false,
                    message: 'Collection already exists with the same name',
                    data: null,
                };
            let collection = await prisma.collection.findUnique({
                where: {
                    id,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            collection = await prisma.collection.update({
                where: {
                    id,
                },
                data: {
                    name,
                }
            });
            if (collection)
                return {
                    success: true,
                    message: 'Collection renamed successfully',
                    data: collection,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Collection not renamed',
            data: null,
        };
    },
    deleteCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'deleteCollection');
        if (_Error)
            return _Error;
        const { id } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const deletedCollection = await prisma.collection.delete({
                where: {
                    id,
                }
            });
            if (deletedCollection)
                return {
                    success: true,
                    message: 'Collection deleted successfully',
                    data: deletedCollection,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Collection not deleted',
            data: null,
        };
    },
    addPostToCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'addPostToCollection');
        if (_Error)
            return _Error;
        const { collectionId, postId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const post = await prisma.post.findUnique({
                where: {
                    id: postId,
                }
            });
            if (!post)
                return {
                    success: false,
                    message: 'Post not found',
                    data: null,
                };
            if (post.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (post?.collectionId === collectionId)
                return {
                    success: false,
                    message: 'Post already added to collection',
                    data: null,
                };
            const addedPost = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    posts: {
                        connect: {
                            id: postId,
                        }
                    }
                }
            });
            if (addedPost)
                return {
                    success: true,
                    message: 'Post added to collection successfully',
                    data: addedPost,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Post not added to collection',
            data: null,
        };
    },
    removePostFromCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'removePostFromCollection');
        if (_Error)
            return _Error;
        const { collectionId, postId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const post = await prisma.post.findUnique({
                where: {
                    id: postId,
                }
            });
            if (!post)
                return {
                    success: false,
                    message: 'Post not found',
                    data: null,
                };
            if (post.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (post?.collectionId !== collectionId)
                return {
                    success: false,
                    message: 'Post not added to collection',
                    data: null,
                };
            const removedPost = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    posts: {
                        disconnect: {
                            id: postId,
                        }
                    }
                }
            });
            if (removedPost)
                return {
                    success: true,
                    message: 'Post removed from collection successfully',
                    data: removedPost,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Post not removed from collection',
            data: null,
        };
    },
    addReelToCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'addReelToCollection');
        if (_Error)
            return _Error;
        const { collectionId, reelId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const reel = await prisma.reel.findUnique({
                where: {
                    id: reelId,
                }
            });
            if (!reel)
                return {
                    success: false,
                    message: 'Reel not found',
                    data: null,
                };
            if (reel.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (reel?.collectionId === collectionId)
                return {
                    success: false,
                    message: 'Reel already added to collection',
                    data: null,
                };
            const addedReel = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    reels: {
                        connect: {
                            id: reelId,
                        }
                    }
                }
            });
            if (addedReel)
                return {
                    success: true,
                    message: 'Reel added to collection successfully',
                    data: addedReel,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Reel not added to collection',
            data: null,
        };
    },
    removeReelFromCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'removeReelFromCollection');
        if (_Error)
            return _Error;
        const { collectionId, reelId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const reel = await prisma.reel.findUnique({
                where: {
                    id: reelId,
                }
            });
            if (!reel)
                return {
                    success: false,
                    message: 'Reel not found',
                    data: null,
                };
            if (reel.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (reel?.collectionId !== collectionId)
                return {
                    success: false,
                    message: 'Reel not added to collection',
                    data: null,
                };
            const removedReel = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    reels: {
                        disconnect: {
                            id: reelId,
                        }
                    }
                }
            });
            if (removedReel)
                return {
                    success: true,
                    message: 'Reel removed from collection successfully',
                    data: removedReel,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Reel not removed from collection',
            data: null,
        };
    },
    addStoryToCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'addStoryToCollection');
        if (_Error)
            return _Error;
        const { collectionId, storyId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const story = await prisma.story.findUnique({
                where: {
                    id: storyId,
                }
            });
            if (!story)
                return {
                    success: false,
                    message: 'Story not found',
                    data: null,
                };
            if (story.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (story?.collectionId === collectionId)
                return {
                    success: false,
                    message: 'Story already added to collection',
                    data: null,
                };
            const addedStory = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    stories: {
                        connect: {
                            id: storyId,
                        }
                    }
                }
            });
            if (addedStory)
                return {
                    success: true,
                    message: 'Story added to collection successfully',
                    data: addedStory,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Story not added to collection',
            data: null,
        };
    },
    removeStoryFromCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'removeStoryFromCollection');
        if (_Error)
            return _Error;
        const { collectionId, storyId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const story = await prisma.story.findUnique({
                where: {
                    id: storyId,
                }
            });
            if (!story)
                return {
                    success: false,
                    message: 'Story not found',
                    data: null,
                };
            if (story.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (story?.collectionId !== collectionId)
                return {
                    success: false,
                    message: 'Story not added to collection',
                    data: null,
                };
            const removedStory = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    stories: {
                        disconnect: {
                            id: storyId,
                        }
                    }
                }
            });
            if (removedStory)
                return {
                    success: true,
                    message: 'Story removed from collection successfully',
                    data: removedStory,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Story not removed from collection',
            data: null,
        };
    },
    addVideoToCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'addVideoToCollection');
        if (_Error)
            return _Error;
        const { collectionId, videoId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const video = await prisma.video.findUnique({
                where: {
                    id: videoId,
                }
            });
            if (!video)
                return {
                    success: false,
                    message: 'Video not found',
                    data: null,
                };
            if (video.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (video?.collectionId === collectionId)
                return {
                    success: false,
                    message: 'Video already added to collection',
                    data: null,
                };
            const addedVideo = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    videos: {
                        connect: {
                            id: videoId,
                        }
                    }
                }
            });
            if (addedVideo)
                return {
                    success: true,
                    message: 'Video added to collection successfully',
                    data: addedVideo,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Video not added to collection',
            data: null,
        };
    },
    removeVideoFromCollection: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'removeVideoFromCollection');
        if (_Error)
            return _Error;
        const { collectionId, videoId } = args.json_input;
        try {
            const collection = await prisma.collection.findUnique({
                where: {
                    id: collectionId,
                }
            });
            if (collection && collection.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;
            const video = await prisma.video.findUnique({
                where: {
                    id: videoId,
                }
            });
            if (!video)
                return {
                    success: false,
                    message: 'Video not found',
                    data: null,
                };
            if (video.userId !== auth.id)
                return GQLErrors.UNAUTHORIZED;

            if (video?.collectionId !== collectionId)
                return {
                    success: false,
                    message: 'Video not added to collection',
                    data: null,
                };
            const removedVideo = await prisma.collection.update({
                where: {
                    id: collectionId,
                },
                data: {
                    videos: {
                        disconnect: {
                            id: videoId,
                        }
                    }
                }
            });
            if (removedVideo)
                return {
                    success: true,
                    message: 'Video removed from collection successfully',
                    data: removedVideo,
                };
        } catch (error: any) {
            //console.log(error);
        }
        return {
            success: false,
            message: 'Video not removed from collection',
            data: null,
        };
    }

}