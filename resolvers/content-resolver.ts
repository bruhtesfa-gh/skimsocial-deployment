import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Middlewares from "../middleware/middleware";
import Excuter from "../middleware/middleware-executer";
interface deleteContentsArgs {
    posts: Array<string>;
    stories: Array<string>;
    reels: Array<string>;
    videos: Array<string>;
}

export default {
    deleteContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'deleteContents');
        if (_Error)
            return _Error;
        const { posts, stories, reels, videos } = args.json_input as deleteContentsArgs;

        try {
            let _posts = await prisma.post.deleteMany({
                where: {
                    id: {
                        in: posts
                    }
                }
            });
            let _stories = await prisma.story.deleteMany({
                where: {
                    id: {
                        in: stories
                    }
                }
            });
            let _reels = await prisma.reel.deleteMany({
                where: {
                    id: {
                        in: reels
                    }
                }
            });
            let _videos = await prisma.video.deleteMany({
                where: {
                    id: {
                        in: videos
                    }
                }
            });
            return {
                success: true,
                message: 'Contents deleted successfully',
                data: {
                    posts: _posts,
                    stories: _stories,
                    reels: _reels,
                    videos: _videos
                }
            }
        } catch (error: any) {
            //console.log(error);
            return {
                success: false,
                message: 'Contents not deleted',
                data: null
            }
        }
    },
}