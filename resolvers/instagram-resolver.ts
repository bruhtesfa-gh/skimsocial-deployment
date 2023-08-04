import { GraphQLResolveInfo } from "graphql";
import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import InstagramAPI from "../helper/API/instagram";
import { Instagram, User } from "@prisma/client";
import prisma from "../prisma/prisma-client";
import Mail from "../helper/API/mail";
import { exec as execnormal } from 'child_process';
import util from "util";
import { downloadFiles } from '../helper/FileManagment/downloader';
import fs from "fs";
import path from 'path';
import cheerio from 'cheerio';

const exec = util.promisify(execnormal);
const proxyaddress = process.env.PROXY_ADDRESS || '';
const proxyauth = process.env.PROXY_AUTH || '';

/**
 * convert double coted string to single coted string
 * @param str 
 * @returns single coted string
 */
const sq = (str: string): string => {
    return str.replace(/\"/g, "'");
}

const disconnectInstagram = async (instagram: Instagram & { user: User }) => {
    await prisma.instagram.update({
        where: {
            id: instagram.id
        },
        data: {
            connected: false
        }
    });
    //send email to user that instagram account is not connected
    const html = `<p>Hi ${instagram.user.name} ${instagram.user.lastname},</p>
<p>Instagram account <b>${instagram.username}</b> is not connected to Skim Social now.</p>
<p>Please reconnect your instagram account to Skim Social again.</p>
<p>Best regards,</p>
<p>Skim Social Team</p>`;
    Mail.Send(Mail.MailType.NEW_MESSAGE, instagram.user.email, html, 'Instagram is pendding').then((result) => {
        //console.log(result);
    }).catch((err: any) => {
        //console.log(err.message);
    });
}

const storySaver = async (username: string, content_id: string, instagram: Instagram & { user: User }) => {
    try {
        //find instagramAccount from database by username
        let instadata = null;
        let pk = "";
        let member = await prisma.member.findUnique({
            where: {
                username
            },
            include: {
                userInstaMembers: true
            }
        })
        if (!member) {
            //get from instagram.com
            try {
                instadata = (await InstagramAPI.getProfileInfoByUsername(username, instagram.cookie, instagram.browser)).data.user;
            } catch (error: any) {
                if (error.message == "DISCONNECTED") {
                    disconnectInstagram(instagram)
                    return {
                        success: false,
                        message: `Instagram disconnected`,
                        contents: []
                    }
                }
                return {
                    success: false,
                    message: `Instagram with username of ${username} not found. Please check the url and try again.`,
                    contents: []
                }
            }
            pk = instadata.id
        } else {
            pk = member.pk;
        }
        const browser = instagram.browser as any;
        const headers: { [key: string]: string } = browser.headers;
        const csrf_token = instagram.cookie.split('csrftoken=')[1].split(';')[0];
        const curl = `curl --insecure -f "https://www.instagram.com/api/v1/feed/reels_media/?media_id=${content_id}&reel_ids=${pk}" -x "${proxyaddress}" -U "${proxyauth}" -H "authority: www.instagram.com" -H "accept: */*" -H "accept-language: ${sq(sq(headers['accept-language']))}" -H "cookie: ${instagram.cookie}" -H "referer: https://www.instagram.com/stories/${username}/${content_id}/" -H "sec-ch-prefers-color-scheme: dark" -H "sec-ch-ua: ${sq(sq(headers['sec-ch-ua']))}" -H "sec-ch-ua-full-version-list: ${sq(sq(headers['sec-ch-ua']))}" -H "sec-ch-ua-mobile: ${sq(sq(headers['sec-ch-ua-mobile']))}" -H "sec-ch-ua-platform: ${sq(headers['sec-ch-ua-platform'])}" -H "sec-ch-ua-platform-version: 15.0.0" -H "sec-fetch-dest: empty" -H "sec-fetch-mode: cors" -H "sec-fetch-site: same-origin" -H "user-agent: ${sq(sq(headers['user-agent']))}" -H "viewport-width: ${browser.screen.width}" -H "x-asbd-id: 129477" -H "x-csrftoken: ${csrf_token}" -H "x-ig-app-id: 936619743392459" -H "x-ig-www-claim: hmac.AR1ZzYLWa9nVcjhrpoITy-n6pMAYn8YuDQVAP1Eh3pFjXzGO" -H "x-requested-with: XMLHttpRequest"`
        const story = (await InstagramAPI.instagramCurlRequest(curl)).reels_media[0];
        //console.log(story);
        if (story == null)
            return {
                success: false,
                message: 'Story not saved',
                contents: []
            }
        let contents: CustomType.Content[] = [];
        for (let i = 0; i < story.items.length; i++) {
            let item = story.items[i];
            contents.push({
                content: item.media_type == 1 ? {
                    media_id: item.pk,
                    display_url: item.image_versions2.candidates[0].url,
                    url: item.image_versions2.candidates[0].url,
                    width: item.image_versions2.candidates[0].width,
                    height: item.image_versions2.candidates[0].height,
                    taken_at: +item.taken_at,
                } as CustomType.ImageContent : {
                    media_id: item.pk,
                    display_url: item.image_versions2.candidates[0].url,
                    url: item.video_versions[0].url,
                    width: item.video_versions[0].width,
                    height: item.video_versions[0].height,
                    taken_at: +item.taken_at,
                    duration: item.video_duration,
                    has_audio: item.has_audio,
                } as CustomType.VideoContent,
            } as CustomType.Content);
        }
        ////console.log(contents);
        let linkedMember = null;
        //save content file to cloud
        let carouselContents = await InstagramAPI.downloadCarouselFiles(contents);
        if (carouselContents.length == 0)
            return {
                success: false,
                message: 'the story may expired.'
            }
        if (member) {
            const userInstaMember = await prisma.userInstaMember.findFirst({
                where: {
                    memberId: member.id,
                    userId: instagram.userId
                },
            });
            if (userInstaMember) {
                linkedMember = member;
            } else {
                //connect to users instagram account
                try {
                    const connect = await prisma.userInstaMember.create({
                        data: {
                            user: { connect: { id: instagram.userId } },
                            member: { connect: { id: member.id } },
                        },
                    });
                    linkedMember = member;
                } catch (error: any) {
                    return {
                        success: false,
                        message: 'Account not added please try again',
                        contents: []
                    }
                }
            }
        } else {
            try {
                let default_profile = `https://ui-avatars.com/api/?uppercase=true&name=${instadata?.full_name}&length=1&bold=true&rounded=true&font-size=0.5&background=d62976&color=ffffff`;
                try {
                    const download_profile_picture = await downloadFiles(
                        {
                            'profile': {
                                path: instadata.profile_pic_url,
                                size: 0,
                                uploaded: false,
                                file_not_found: false
                            }
                        });
                    if (download_profile_picture['profile'].uploaded)
                        default_profile = download_profile_picture['profile'].path
                } catch (error: any) {
                    //console.log(error.message);
                }
                try {
                    linkedMember = await prisma.member.create({
                        data: {
                            pk: instadata.id,
                            username,
                            full_name: instadata.full_name,
                            verified: instadata.is_verified,
                            followers: instadata.edge_followed_by.count,
                            profile_pic_url: default_profile,
                            userInstaMembers: {
                                create: {
                                    user: {
                                        connect: {
                                            id: instagram.user.id
                                        }
                                    }
                                }
                            }
                        },
                        include: {
                            userInstaMembers: true
                        }
                    });
                    if (linkedMember) {
                        try {
                            const curent_user = await prisma.user.findUnique({
                                where: {
                                    id: instagram.user.id
                                },
                                select: {
                                    id: true,
                                    number_of_insta_members: true,
                                }
                            });
                            if (curent_user) {
                                await prisma.user.update({
                                    where: {
                                        id: instagram.user.id
                                    },
                                    data: {
                                        number_of_insta_members: curent_user.number_of_insta_members + 1
                                    }
                                });
                            }
                        } catch (error: any) {

                        }
                    }
                } catch (error: any) {
                    //console.log(error.message);
                    return {
                        success: false,
                        message: 'Account not added please try again',
                        contents: []
                    }
                }
            } catch (error) {
                return {
                    success: false,
                    message: 'Account not added please try again',
                    contents: []
                }
            }
        }

        const mentions = story.items.map((item: any) => {
            return (item.story_bloks_stickers == null ? '' : item.story_bloks_stickers.map((i: any) => i.bloks_sticker.sticker_data.ig_mention.username).join(', '))
        });
        ////console.log(mentions);
        //save story to database
        try {
            //
            const _story = await prisma.story.create({
                data: {
                    latest_reel_media: +story.latest_reel_media,
                    mentions: mentions,
                    owner_pk: story.user.pk,
                    owner_full_name: linkedMember.full_name,
                    owner_username: linkedMember.username,
                    owner_followers: linkedMember.followers,
                    owner_verified: linkedMember.verified,
                    owner_profile_pic_url: linkedMember.profile_pic_url,
                    instagram: {
                        connect: {
                            id: instagram.id
                        }
                    },
                    user: {
                        connect: {
                            id: instagram.user.id
                        }
                    },
                    member: {
                        connect: {
                            id: linkedMember.id
                        }
                    },
                    igContents: {
                        create: carouselContents
                    }
                }
            });
            return {
                success: true,
                message: 'Story saved successfully',
                contents: carouselContents.map(item => ({
                    url: item.url,
                    display_url: item.display_url,
                    is_video: item.is_video,
                }))
            }
        } catch (error: any) {
            return {
                success: false,
                message: 'Story not saved',
                contents: []
            }
        }
    } catch (error: any) {
        if (error.message == "DISCONNECTED") {
            disconnectInstagram(instagram)
            return {
                success: false,
                message: `Instagram disconnected`,
                contents: []
            }
        }
        return GQLErrors.SERVER_ERROR;
    }
}

const postSaver = async (url: string, instagram: Instagram & { user: User }) => {
    try {
        //#region Fetch HTML
        //find instagramAccount from database by username
        const htmlpath = path.resolve(__dirname, `../helper/FileManagment/temp/${url.split('/p/')[1].split('/')[0] + '.html'}`);
        ////console.log(htmlpath);
        //const htmlpath = "test.html"
        const browser = instagram.browser as any;
        const headers: { [key: string]: string } = browser.headers;
        const csrf_token = instagram.cookie.split('csrftoken=')[1].split(';')[0];
        //console.log(csrf_token);
        const curl = `curl --insecure "${url}" -x "${proxyaddress}" -U "${proxyauth}" -H "authority: www.instagram.com" -H "accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" -H "accept-language: ${sq(headers['accept-language'])}" -H "cache-control: max-age=0" -H "cookie: ${instagram.cookie}" -H "sec-ch-prefers-color-scheme: dark" -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" -H "sec-ch-ua-full-version-list: ${sq(headers['sec-ch-ua'])}" -H "sec-ch-ua-mobile: ${sq(headers['sec-ch-ua-mobile'])}" -H "sec-ch-ua-platform: ${headers['sec-ch-ua-platform']}" -H "sec-ch-ua-platform-version: "15.0.0"" -H "sec-fetch-dest: document" -H "sec-fetch-mode: navigate" -H "sec-fetch-site: same-origin" -H "sec-fetch-user: ?1" -H "upgrade-insecure-requests: 1" -H "user-agent: ${sq(headers['user-agent'])}" -H "viewport-width: ${browser.screen.width}"  -o "${htmlpath}"`
        //console.log(curl);
        await InstagramAPI.instagramCurlRequest(curl, "HTML");
        if (!fs.existsSync(htmlpath))
            return {
                success: false,
                message: 'the post may deleted. f',
                contents: []
            }
        const html = fs.readFileSync(htmlpath);
        //#endregion

        //#region Parse HTML
        //regex for checking if the data is html
        const regex = /<html[\s\S]*<\/html>/gmi;
        if (!html)
            return {
                success: false,
                message: 'the post may deleted. 1',
                contents: []
            }
        const $ = cheerio.load(html);
        if (fs.existsSync(htmlpath))
            fs.unlinkSync(htmlpath);
        //find the script tag that contains the "items\" string 
        const script = $('script').filter((i, el) => {
            return $(el).text().includes('items\\');
        }).html();
        //console.log(script);
        let json = null;
        if (!script)
            return {
                success: false,
                message: 'make sure your url is correctly copied',
                contents: []
            }
        try {
            //get the json data from script tag
            json = JSON.parse(JSON.parse(script.split('{"response":')[1].split(',"status_code"')[0]));
            //console.log(json);
        } catch (error: any) {
            //console.log(error.message);
            return {
                success: false,
                message: 'the post may deleted. 3',
                contents: []
            }
        }
        if (!json || !json.items)
            return {
                success: false,
                message: 'the post may deleted. 4',
                contents: []
            }
        //#endregion
        let pk = json.user.pk;
        let linkedMember = null;
        let member = await prisma.member.findUnique({
            where: {
                pk
            },
            include: {
                userInstaMembers: true
            }
        })
        if (!member) {
            //get from instagram.com
            try {
                linkedMember = await InstagramAPI.createMemberForUser(json.user.pk, true, instagram.user, instagram.id);
            } catch (error: any) {
                if (error.message == "DISCONNECTED") {
                    disconnectInstagram(instagram)
                }
                return {
                    success: false,
                    message: `Instagram with username of ${json.user.username} not found. Please check the url and try again.`,
                    contents: []
                }
            }
        } else {
            //check if user already added this account
            const isAlreadyAdded = member.userInstaMembers.find((item) => item.userId === instagram.userId);
            if (!isAlreadyAdded) {
                //connect to users instagram account
                try {
                    const connect = await prisma.userInstaMember.create({
                        data: {
                            user: { connect: { id: instagram.userId } },
                            member: { connect: { id: member.id } },
                        },
                    });
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
                linkedMember = member;
            } else {
                linkedMember = member;
            }
        }
        const shortCode = url.split('/p/')[1].split('/')[0];
        const post = json.items.find((item: any) => item.code == shortCode);
        if (!post)
            return {
                success: false,
                message: 'the post may deleted. 5',
                contents: []
            }
        const mentions = post.usertags?.in ? post.usertags.in.map((item: any) => item.user.username) : [];
        let contents: CustomType.Content[] = [];
        if (post.carousel_media) {
            for (let i = 0; i < post.carousel_media.length; i++) {
                let item = post.carousel_media[i];
                contents.push({
                    content: item.media_type == 1 ? {
                        media_id: item.id,
                        display_url: item.image_versions2.candidates[0].url,
                        url: item.image_versions2.candidates[0].url,
                        width: item.image_versions2.candidates[0].width,
                        height: item.image_versions2.candidates[0].height,
                        taken_at: +post.taken_at,
                    } as CustomType.ImageContent : {
                        media_id: item.id,
                        display_url: item.image_versions2.candidates[0].url,
                        url: item.video_versions[0].url,
                        width: item.video_versions[0].width,
                        height: item.video_versions[0].height,
                        taken_at: +post.taken_at,
                        duration: item.video_duration,
                        has_audio: true,
                    } as CustomType.VideoContent,
                } as CustomType.Content);
            }
            let carouselContents: any[] = await InstagramAPI.downloadCarouselFiles((contents as CustomType.Content[]));
            //console.log(carouselContents);
            if (carouselContents.length > 0) {
                //create post
                try {
                    const _post = await prisma.post.create({
                        data: {
                            pk: post.pk,
                            link: url,
                            caption: post.caption?.text,
                            mentions: mentions,
                            owner_pk: post.user.pk,
                            owner_full_name: linkedMember.full_name,
                            owner_username: linkedMember.username,
                            owner_followers: linkedMember.followers,
                            owner_verified: linkedMember.verified,
                            owner_profile_pic_url: linkedMember.profile_pic_url,
                            instagram: {
                                connect: {
                                    id: instagram.id
                                }
                            },
                            user: {
                                connect: {
                                    id: instagram.user.id
                                }
                            },
                            member: {
                                connect: {
                                    id: linkedMember.id
                                }
                            },
                            igContents: {
                                create: carouselContents
                            }
                        }
                    });
                    return {
                        success: true,
                        message: 'Post saved successfully',
                        contents: carouselContents.map(item => ({
                            url: item.url,
                            display_url: item.display_url,
                            is_video: item.is_video,
                        }))
                    }
                }
                catch (error: any) {
                    //console.log(error);
                    return {
                        success: false,
                        message: 'Post not saved 1',
                        contents: []
                    }
                }
            } else {
                return {
                    success: false,
                    message: 'Post not saved 2',
                    contents: []
                }
            }
        } else {
            if (post.media_type == 1) {
                let content = {
                    media_id: post.id,
                    display_url: post.image_versions2.candidates[0].url,
                    url: post.image_versions2.candidates[0].url,
                    width: post.image_versions2.candidates[0].width,
                    height: post.image_versions2.candidates[0].height,
                    taken_at: +post.taken_at,
                } as CustomType.ImageContent
                let download = await downloadFiles(
                    {
                        'image': {
                            path: content.url,
                            size: 0,
                            uploaded: false,
                            file_not_found: false
                        }
                    });
                if (download['image'].uploaded) {
                    content.url = download['image'].path;
                    content.display_url = download['image'].path;
                    //create post
                    try {
                        const _post = await prisma.post.create({
                            data: {
                                pk: post.pk,
                                link: url,
                                caption: post.caption?.text,
                                mentions: mentions,
                                owner_pk: post.user.pk,
                                owner_full_name: linkedMember.full_name,
                                owner_username: linkedMember.username,
                                owner_followers: linkedMember.followers,
                                owner_verified: linkedMember.verified,
                                owner_profile_pic_url: linkedMember.profile_pic_url,
                                instagram: {
                                    connect: {
                                        id: instagram.id
                                    }
                                },
                                user: {
                                    connect: {
                                        id: instagram.user.id
                                    }
                                },
                                member: {
                                    connect: {
                                        id: linkedMember.id
                                    }
                                },
                                igContents: {
                                    create: [
                                        {
                                            ...content,
                                            is_video: false
                                        }
                                    ]
                                }
                            }
                        });
                        return {
                            success: true,
                            message: 'Post saved successfully',
                            contents: [
                                {
                                    url: download['image'].path,
                                    display_url: download['image'].path,
                                    is_video: false,
                                }
                            ]
                        }
                    }
                    catch (error: any) {
                        return {
                            success: false,
                            message: 'Post not saved 3',
                            contents: []
                        }
                    }
                } else {
                    return {
                        success: false,
                        message: 'Post not saved 4',
                        contents: []
                    }
                }

            } else {
                let content = {
                    media_id: post.id,
                    display_url: post.image_versions2.candidates[0].url,
                    url: post.video_versions[0].url,
                    width: post.video_versions[0].width,
                    height: post.video_versions[0].height,
                    taken_at: +post.taken_at,
                    duration: post.video_duration,
                    has_audio: post.has_audio || true,
                } as CustomType.VideoContent;
                //console.log(content);
                let download = await downloadFiles(
                    {
                        'image': {
                            path: content.display_url,
                            size: 0,
                            uploaded: false,
                            file_not_found: false
                        },
                        'video': {
                            path: content.url,
                            size: 0,
                            uploaded: false,
                            file_not_found: false
                        }
                    });
                if (download['image'].uploaded && download['video'].uploaded) {
                    content.url = download['video'].path;
                    content.display_url = download['image'].path;
                } else if (download["video"].uploaded) {
                    content.url = download['video'].path;
                }
                if (!download["video"].uploaded)
                    return {
                        success: false,
                        message: 'Post not saved 5',
                        contents: []
                    }
                //create Reel
                try {
                    const _post = await prisma.reel.create({
                        data: {
                            pk: post.pk,
                            link: url,
                            caption: post.caption?.text,
                            mentions: mentions,
                            owner_pk: post.user.pk,
                            owner_full_name: linkedMember.full_name,
                            owner_username: linkedMember.username,
                            owner_followers: linkedMember.followers,
                            owner_verified: linkedMember.verified,
                            owner_profile_pic_url: linkedMember.profile_pic_url,
                            instagram: {
                                connect: {
                                    id: instagram.id
                                }
                            },
                            user: {
                                connect: {
                                    id: instagram.user.id
                                }
                            },
                            member: {
                                connect: {
                                    id: linkedMember.id
                                }
                            },
                            igContent: {
                                create: {
                                    ...content,
                                    is_video: true
                                }
                            }
                        }
                    });
                    return {
                        success: true,
                        message: 'Reel saved successfully',
                        contents: [
                            {
                                url: download['video'].path,
                                display_url: download['image'].path,
                                is_video: true,
                            }
                        ]
                    }
                } catch (error: any) {
                    return {
                        success: false,
                        message: 'Reel not saved',
                        contents: []
                    }
                }

            }
        }
    } catch (error: any) {
        if (error.message == "DISCONNECTED") {
            disconnectInstagram(instagram)
            return {
                success: false,
                message: `Instagram disconnected`,
                contents: []
            }
        }
        //console.log(error.message);
        return GQLErrors.SERVER_ERROR;
    }
}

export default {
    storySaver,
    getInstagramAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccount');
        if (_Error)
            return _Error;
        try {
            const { instagram_id } = args.json_input;
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id
                },
                select: {
                    id: true,
                    username: true,
                    full_name: true,
                    active: true,
                    story_enabled: true,
                    post_enabled: true,
                    reel_enabled: true,
                    connected: true,
                    reels_count: true,
                    stories_count: true,
                    posts_count: true,
                    followers: true,
                    following: true,
                    profile_pic_url: true,
                    userId: true,
                }
            });
            if (instagram) {
                if (instagram.userId != auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                return {
                    id: instagram.id,
                    full_name: instagram.full_name,
                    username: instagram.username,
                    profile_pic_url: instagram.profile_pic_url,
                    followers: instagram.followers,
                    following: instagram.following,
                    posts_count: instagram.posts_count,
                    reels_count: instagram.reels_count,
                    stories_count: instagram.stories_count,
                    story_enabled: instagram.story_enabled,
                    post_enabled: instagram.post_enabled,
                    reel_enabled: instagram.reel_enabled,
                    connected: instagram.connected,
                    active: instagram.active
                }
            } else {
                return GQLErrors.INSTAGRAM_ACCOUNT_NOT_FOUND
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getUserInstagramAccounts: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        // let _Error = await Excuter([Middlewares.DeletedFilterParseJson], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccount');
        // if (_Error)
        //     return _Error;
        try {
            const instagrams = await prisma.instagram.findMany({
                where: {
                    userId: parent.id,
                    active: true
                },
                select: {
                    id: true,
                    pk: true,
                    username: true,
                    connected: true,
                    full_name: true,
                    profile_pic_url: true,
                }
            });
            if (instagrams) {
                return instagrams;
            } else {
                return GQLErrors.INSTAGRAM_ACCOUNT_NOT_FOUND
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getInstagramAccountPosts: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccountPosts');
        if (_Error)
            return _Error;
        try {
            const posts = await prisma.post.findMany({
                where: {
                    instagramId: parent.id
                },
                select: {
                    id: true,
                    caption: true,
                    link: true,
                    mentions: true,
                    usage_right: true,
                    owner_username: true,
                    owner_full_name: true,
                    owner_profile_pic_url: true,
                    owner_followers: true,
                    owner_verified: true,
                }
            });
            return posts;
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getInstagramAccountReels: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccountReels');
        if (_Error)
            return _Error;
        try {
            const reels = await prisma.reel.findMany({
                where: {
                    instagramId: parent.id
                },
                select: {
                    id: true,
                    mentions: true,
                    link: true,
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
            return GQLErrors.SERVER_ERROR;
        }
    },
    getInstagramAccountStories: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccountStories');
        if (_Error)
            return _Error;
        try {
            const stories = await prisma.story.findMany({
                where: {
                    instagramId: parent.id
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
            return stories;
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getUserInstaMembers: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getInstagramAccountMembers');
        if (_Error)
            return _Error;
        try {
            const members = await prisma.userInstaMember.findMany({
                where: {
                    userId: auth.id
                },
                select: {
                    id: true,
                    paused: true,
                    member: {
                        select: {
                            id: true,
                            full_name: true,
                            username: true,
                            profile_pic_url: true,
                            followers: true,
                            verified: true,
                        }
                    }
                }
            });
            if (members) {
                return members.map((item) => item.member);
            }
            return [];
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getPostIgContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        //let _Error = await Excuter([Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getPostIgContents');
        //if (_Error)
        //    return _Error;
        try {
            const contents = await prisma.igContent.findMany({
                where: {
                    postId: parent.id
                },
                select: {
                    id: true,
                    url: true,
                    width: true,
                    height: true,
                    has_audio: true,
                    duration: true,
                    display_url: true,
                    taken_at: true,
                    is_video: true,
                }
            });
            if (contents) {
                return contents;
            } else
                return [];
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getStoryIgContents: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        //let _Error = await Excuter([Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'getStoryIgContents');
        //if (_Error)
        //    return _Error;
        try {
            const contents = await prisma.igContent.findMany({
                where: {
                    storyId: parent.id
                },
                select: {
                    id: true,
                    url: true,
                    width: true,
                    height: true,
                    has_audio: true,
                    duration: true,
                    display_url: true,
                    taken_at: true,
                    is_video: true,
                }
            });
            if (contents) {
                return contents;
            } else
                return [];
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    getReelIgContent: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        try {
            const content = await prisma.igContent.findFirst({
                where: {
                    reelId: parent.id
                },
                select: {
                    id: true,
                    url: true,
                    width: true,
                    height: true,
                    has_audio: true,
                    duration: true,
                    display_url: true,
                    taken_at: true,
                    is_video: true,
                }
            });
            if (content) {
                return content;
            } else
                return GQLErrors.SERVER_ERROR;
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    addSocialAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'addSocialAccount');
        if (_Error)
            return _Error;
        try {
            const { username } = args.json_input;
            const user = await prisma.user.findUnique({
                where: {
                    id: auth.id
                },
            });

            const social = await prisma.member.findUnique({
                where: {
                    username: username
                },
                include: {
                    userInstaMembers: true
                }
            });

            if (social) {
                //chech if user alraedy added this account
                const isAlreadyAdded = social.userInstaMembers.find((item) => item.userId === auth.id);
                if (isAlreadyAdded) {
                    return {
                        success: false,
                        message: 'Account already added'
                    }
                } else {
                    //connect to users instagram account
                    try {
                        const connect = await prisma.userInstaMember.create({
                            data: {
                                user: { connect: { id: auth.id } },
                                member: { connect: { id: social.id } },
                            },
                        });
                    } catch (error: any) {
                        return {
                            success: false,
                            message: 'Account not added please try again'
                        }
                    }
                    return {
                        success: true,
                        message: 'Account added successfully'
                    }
                }
            } else {
                try {
                    const insta = await prisma.instagram.findFirst();
                    if (insta && user) {
                        const social = await InstagramAPI.createMemberForUser(username, false, user, insta.id);
                    } else {
                        return {
                            success: false,
                            message: 'not found'
                        }
                    }
                } catch (error: any) {
                    return {
                        success: false,
                        message: 'Account not added please try again'
                    }
                }
                return {
                    success: true,
                    message: 'Account added successfully'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                message: 'Account not added'
            }
        }
    },
    pauseSocialAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'pauseSocialAccount');
        if (_Error)
            return _Error;
        try {
            const { socialId } = args.json_input;
            const userSocial = await prisma.userInstaMember.findFirst({
                where: {
                    userId: auth.id,
                    memberId: socialId
                },
                include: {
                    member: true
                }
            });
            if (userSocial) {
                if (userSocial.paused) {
                    return {
                        success: false,
                        message: 'Account already paused'
                    }
                } else {
                    try {
                        const pause = await prisma.userInstaMember.update({
                            where: {
                                id: userSocial.id
                            },
                            data: {
                                paused: true
                            }
                        });
                    } catch (error: any) {
                        return {
                            success: false,
                            message: 'Account not paused please try again'
                        }
                    }
                    return {
                        success: true,
                        message: 'Account paused successfully'
                    }
                }
            } else {
                return {
                    success: false,
                    message: 'you are not connected to this account yet'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                message: 'Account not paused'
            }
        }
    },
    activateSocialAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'activateSocialAccount');
        if (_Error)
            return _Error;
        try {
            const { socialId } = args.json_input;
            const userSocial = await prisma.userInstaMember.findFirst({
                where: {
                    userId: auth.id,
                    memberId: socialId
                },
                include: {
                    member: true
                }
            });
            if (userSocial) {
                if (!userSocial.paused) {
                    return {
                        success: false,
                        message: 'Account already active'
                    }
                } else {
                    try {
                        const pause = await prisma.userInstaMember.update({
                            where: {
                                id: socialId
                            },
                            data: {
                                paused: false
                            }
                        });
                    } catch (error: any) {
                        return {
                            success: false,
                            message: 'Account not activated please try again'
                        }
                    }
                    return {
                        success: true,
                        message: 'Account activated successfully'
                    }
                }
            } else {
                return {
                    success: false,
                    message: 'you are not connected to this account yet'
                }
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    toggleStorySaving: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'toggleStorySaving');
        if (_Error)
            return _Error;
        const { enabled, instagram_id } = args.json_input;
        try {
            //find instagram account for authed user
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id,
                },
                select: {
                    id: true,
                    userId: true,
                }
            });

            if (instagram) {
                if (instagram.userId !== auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                try {
                    const update = await prisma.instagram.update({
                        where: {
                            id: instagram.id
                        },
                        data: {
                            story_enabled: enabled
                        }
                    });
                    if (enabled) {
                        return {
                            success: true,
                            message: `Story saving enabled successfully now Skim Social save stories from your connected accounts automatically`
                        }
                    } else {
                        return {
                            success: true,
                            message: `Story saving disabled successfully now Skim Social not save stories from your connected accounts automatically`
                        }
                    }
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
            }
            return {
                success: false,
                message: 'Instagram account not found'
            }

        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    togglePostSaving: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'togglePostSaving');
        if (_Error)
            return _Error;
        const { enabled, instagram_id } = args.json_input;
        try {
            //find instagram account for authed user
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id
                },
                select: {
                    id: true,
                    userId: true,
                }
            });

            if (instagram) {
                //check if instagram account belongs to authed user
                if (instagram.userId !== auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                try {
                    const update = await prisma.instagram.update({
                        where: {
                            id: instagram.id
                        },
                        data: {
                            post_enabled: enabled
                        }
                    });
                    if (enabled) {
                        return {
                            success: true,
                            message: `Post saving enabled successfully now Skim Social save posts from your connected accounts automatically`
                        }
                    } else {
                        return {
                            success: true,
                            message: `Post saving disabled successfully now Skim Social not save posts from your connected accounts automatically`
                        }
                    }
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
            }
            return {
                success: false,
                message: 'Instagram account not found'
            }

        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    toggleReelSaving: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'toggleReelSaving');
        if (_Error)
            return _Error;
        const { enabled, instagram_id } = args.json_input;
        try {
            //find instagram account for authed user
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id
                },
                select: {
                    id: true,
                    userId: true,
                }
            });

            if (instagram) {
                //check if instagram account belongs to authed user
                if (instagram.userId !== auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                try {
                    const update = await prisma.instagram.update({
                        where: {
                            id: instagram.id
                        },
                        data: {
                            reel_enabled: enabled
                        }
                    });
                    if (enabled) {
                        return {
                            success: true,
                            message: `Reel saving enabled successfully now Skim Social save reels from your connected accounts automatically`
                        }
                    } else {
                        return {
                            success: true,
                            message: `Reel saving disabled successfully now Skim Social not save reels from your connected accounts automatically`
                        }
                    }
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
            }
            return {
                success: false,
                message: 'Instagram account not found'
            }

        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    activateInActivateInstagramAccount: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        const _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'activateInActivateInstagramAccount');
        if (_Error)
            return _Error;
        const { enabled, instagram_id } = args.json_input;
        try {
            //find instagram account for authed user
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id
                },
                select: {
                    id: true,
                    userId: true,
                }
            });

            if (instagram) {
                //check if instagram account belongs to authed user
                if (instagram.userId !== auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                try {
                    const update = await prisma.instagram.update({
                        where: {
                            id: instagram.id
                        },
                        data: {
                            active: enabled
                        }
                    });
                    if (enabled) {
                        return {
                            success: true,
                            message: `Instagram account activated successfully`
                        }
                    } else {
                        return {
                            success: true,
                            message: `Instagram account deactivated successfully`
                        }
                    }
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
            }
            return {
                success: false,
                message: 'Instagram account not found'
            }

        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    saveInstagramContentWithUrl: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'saveInstagramContentWithUrl');
        if (_Error)
            return _Error;
        try {
            const { url, instagram_id }: { url: string, instagram_id: string } = args.json_input;
            //find instagram account for authed user
            const instagram = await prisma.instagram.findUnique({
                where: {
                    id: instagram_id
                },
                include: {
                    user: true
                }
            });
            if (instagram) {
                //check if instagram account belongs to authed user
                if (instagram.userId !== auth.id) {
                    return GQLErrors.UNAUTHORIZED;
                }
                const ValidMember = await InstagramAPI.getValidMemberBasedOnSubscription(instagram.user.id, instagram.user.number_of_socials);
                if (!ValidMember.unlimited && ValidMember.remaining_members < 1) {
                    return {
                        success: false,
                        message: 'You have reached your limit for saving contents from Instagram. Please upgrade your subscription to save more contents.',
                        url: '',
                        thumbnail: ' ',
                    }
                }
                if (url.split('/')[3] == 'stories') {
                    //story link
                    //console.log("first");
                    return storySaver(url.split('/')[4], url.split('/')[5], instagram)
                } else {
                    //console.log("second");
                    return postSaver(url, instagram);
                }
            }
            return {
                success: false,
                message: 'Instagram account not found',
                contents: []
            }
        }
        catch (error: any) {
            //console.log("first ", error.message);
            return GQLErrors.SERVER_ERROR;
        }
    }
}