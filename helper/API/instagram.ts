import axios from 'axios';
import CustomType, { MediaType } from '../../custom-type/custom-type';
import { downloadFiles } from '../FileManagment/downloader';
import { GQLErrors } from '../../middleware/middleware';
import Mail from './mail';
import prisma from '../../prisma/prisma-client';
import util from "util";
import { exec as execnormal } from 'child_process';
import { User, Instagram, IgContent } from '@prisma/client';
const exec = util.promisify(execnormal);
const proxy = '-x pr.oxylabs.io:7777 -U customer-bruk_x:Snpgl2iDY69GGhhhh821387213 --insecure'
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
// {
//     'accept': '*/*',
//         // 'accept-encoding': 'gzip, deflate, br',
//         // 'accept-language': '${sq(headers['accept-language'])}',
//         'cookie': cookie,
//             // 'referer': 'https://www.instagram.com/stories/jerusalem_mulugeta/',
//             // 'sec-ch-prefers-color-scheme': 'dark',
//             // 'sec-ch-ua': '"Google Chrome";v="111", "Not(A:Brand";v="8", "Chromium";v="111"',
//             // 'sec-ch-ua-mobile': '${headers['sec-ch-ua-mobile']}',
//             // 'sec-ch-ua-platform': ${headers['sec-ch-ua-platform']},
//             // 'sec-fetch-dest': 'empty',
//             // 'sec-fetch-mode': 'cors',
//             // 'sec-fetch-site': 'same-origin',
//             'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
//                 // 'viewport-width': 1746,
//                 // 'x-asbd-id': 198387,
//                 //'x-csrftoken': cookies.csrftoken,
//                 'x-ig-app-id': '936619743392459',
//                     //'x-ig-www-claim': 'hmac.AR2JOZyKIrOspwcSdlvIMF_YwbbaBpNmTcDcxH9pVESUJ8Ak',
//                     'x-requested-with': 'XMLHttpRequest',
//         }
const getHeaders = (cookie: string, refer: string | null = null) => {
    return {
        'accept': '*/*',
        'cookie': cookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest',
    }
};

const instagramCurlRequest = async (command: string, type = "JSON") => {
    try {
        const { stdout, stderr }: { stdout: any, stderr: any } = await exec(command);
        let response = null;
        try {
            console.log("success", stdout);
            if (type == "JSON")
                response = JSON.parse(stdout.substring(0, stdout.lastIndexOf('}') + 1));
            else
                response = stdout;
            //console.log(stdout);
        } catch (error: any) {
            console.log(error.message);
            throw Error(error.message);
        }
        if (response && response.status !== 'ok' && response.require_login && response.message == 'Please wait a few minutes before you try again.') {
            throw Error("DISCONNECTED");
        }
        else if (type == 'JSON' && (response == null || response.status !== 'ok'))
            throw Error("request failed");
        else
            return response;
    } catch (error: any) {
        let response = null;
        console.log("fail", error.stdout)
        try {
            if (type == "JSON")
                response = JSON.parse(error.stdout.substring(0, error.stdout.lastIndexOf('}') + 1));
            else
                response = error.stdout;
            ////console.log(response);
        } catch (error: any) {
            //console.log(error.message);
            throw Error(error.message);
        }
        if (response && response.status !== 'ok' && response.require_login) {
            throw Error("DISCONNECTED");
        }
        else if (type == 'JSON' && (response == null || response.status !== 'ok'))
            throw Error("request failed");
        else
            return response
    };
}

const getProfileInfoById = async (id: string, cookie: string) => {
    const curl = `curl ${proxy} -H "accept: */*" -H "cookie: ${cookie}" -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36" -H "x-ig-app-id: 936619743392459" -H "x-requested-with: XMLHttpRequest" "https://i.instagram.com/api/v1/users/${id}/info/"`
    //const url = `https://i.instagram.com/api/v1/users/${id}/info/`;
    try {
        return await instagramCurlRequest(curl);
    } catch (err: any) {
        throw Error(err.message);
    };
};

const getProfileInfoByUsername = async (username: string, cookie: string, browser: any) => {
    //const url = `http://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const headers: { [key: string]: string } = browser.headers;
    const csrf_token = cookie.split('csrftoken=')[1].split(';')[0];
    const curl = `curl "https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}" \
                        -x "${proxyaddress}" \
                        -U "${proxyauth}" \
                        -H "authority: www.instagram.com" \
                        -H "accept: */*" \
                        -H "accept-language: ${sq(headers['accept-language'])}" \
                        -H "cookie: ${cookie}" \
                        -H "referer: https://www.instagram.com/${username}/" \
                        -H "sec-ch-prefers-color-scheme: dark" \
                        -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" \
                        -H "sec-ch-ua-full-version-list: ${sq(headers['sec-ch-ua'])}" \
                        -H "sec-ch-ua-mobile: ${sq(headers['sec-ch-ua-mobile'])}" \
                        -H "sec-ch-ua-platform: ${sq(headers['sec-ch-ua-platform'])}" \
                        -H "sec-ch-ua-platform-version: 15.0.0" \
                        -H "sec-fetch-dest: empty" \
                        -H "sec-fetch-mode: cors" \
                        -H "sec-fetch-site: same-origin" \
                        -H "user-agent: ${sq(headers['user-agent'])}" \
                        -H "viewport-width: ${browser.screen.width}" \
                        -H "x-asbd-id: 129477" \
                        -H "x-csrftoken: ${csrf_token}" \
                        -H "x-ig-app-id: 936619743392459" \
                        -H "x-ig-www-claim: hmac.AR1ZzYLWa9nVcjhrpoITy-n6pMAYn8YuDQVAP1Eh3pFjXzGO" \
                        -H "x-requested-with: XMLHttpRequest"`
    try {
        return (await instagramCurlRequest(curl));
    } catch (error: any) {
        throw Error(error.message);
    }
};

const downloadCarouselFiles = async (contents: CustomType.Content[]): Promise<any[]> => {
    let filesToBeUploaded: CustomType.FileToBeUploaded1 = {};

    contents.forEach((c: any) => {
        if (c.content.duration == undefined) {
            let imageContent = c.content as CustomType.ImageContent;
            filesToBeUploaded[imageContent.media_id] = {
                path: imageContent.url,
                size: 0,
                file_not_found: false,
                uploaded: false
            }
        } else {
            let videoContent = c.content as CustomType.VideoContent;
            filesToBeUploaded['url' + videoContent.media_id] = {
                path: videoContent.url,
                size: 0,
                file_not_found: false,
                uploaded: false
            }
            filesToBeUploaded['display' + videoContent.media_id] = {
                path: videoContent.display_url,
                size: 0,
                file_not_found: false,
                uploaded: false
            }
        }
    });
    let downloaded = await downloadFiles(filesToBeUploaded);
    let carouselContents: any[] = [];
    for (let i = 0; i < contents.length; i++) {
        const c: any = contents[i];
        if (c.content.duration == undefined) {
            let imageContent = c.content as CustomType.ImageContent;
            let imageDownloaded = downloaded[imageContent.media_id];
            if (imageDownloaded?.uploaded) {
                imageContent.url = imageDownloaded.path;
                imageContent.display_url = imageDownloaded.path;
                carouselContents.push({
                    ...imageContent,
                    is_video: false
                });
            }
        } else {
            let videoContent = c.content as CustomType.VideoContent;
            let urlDownloaded = downloaded['url' + videoContent.media_id];
            let displayDownloaded = downloaded['display' + videoContent.media_id];
            if (urlDownloaded?.uploaded) {
                videoContent.url = urlDownloaded.path;
                videoContent.display_url = displayDownloaded ? displayDownloaded.path : videoContent.display_url;
                carouselContents.push({
                    ...videoContent,
                    is_video: true
                });
            }
        }
    }
    return carouselContents;
}

const getValidMemberBasedOnSubscription = async (id: string, number_of_socials: string) => {
    let members = null;
    let unlimited = false;
    let remaining_members = 0;
    let paused_members: string[] = [];
    try {
        const all_members = await prisma.member.findMany({
            where: {
                userInstaMembers: {
                    some: {
                        userId: id,
                        paused: true
                    }
                }
            },
            select: {
                pk: true,
            }
        });
        paused_members = all_members !== null ? all_members.map((m) => m.pk) : [];
        if (number_of_socials === 'INFINITY') {
            unlimited = true;
            members = await prisma.member.findMany({
                where: {
                    userInstaMembers: {
                        some: {
                            userId: id,
                            paused: false
                        }
                    }
                },
            });
        } else {
            members = await prisma.member.findMany({
                where: {
                    userInstaMembers: {
                        some: {
                            userId: id,
                            paused: false
                        }
                    }
                },
                select: {
                    id: true,
                    pk: true,
                    username: true,
                },
                take: +number_of_socials
            });
            remaining_members = +number_of_socials - members.length;
            if (remaining_members < 0)
                remaining_members = 0;
        }
        return {
            members,
            unlimited,
            remaining_members,
            paused_members
        }
    } catch (error: any) {
        //console.log(error.message);
        throw Error(error.message);
    }
}

const getTaggedStories = async (instagram: Instagram, user: User): Promise<CustomType.TaggedStories> => {
    //#region 1. Define variables
    const headers: { [key: string]: string } = (instagram.browser as any).headers;
    const csrf_token = instagram.cookie.split('csrftoken=')[1].split(';')[0];
    const curl = `curl --insecure "https://www.instagram.com/api/v1/feed/reels_tray/" \
                       -x "${proxyaddress}" \
                       -U "${proxyauth}" \
                       -H "authority: www.instagram.com" \
                       -H "accept: */*" \
                       -H "accept-language: ${sq(headers['accept-language'])}" \
                       -H "cookie: ${instagram.cookie}" \
                       -H "referer: https://www.instagram.com/stories/${instagram.username}" \
                       -H "sec-ch-prefers-color-scheme: dark" \
                       -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" \
                       -H "sec-ch-ua-full-version-list: ${sq(headers['sec-ch-ua'])}" \
                       -H "sec-ch-ua-mobile: ${headers['sec-ch-ua-mobile']}" \
                       -H "sec-ch-ua-platform: ${headers['sec-ch-ua-platform']}" \
                       -H "sec-ch-ua-platform-version: "15.0.0"" \
                       -H "sec-fetch-dest: empty" \
                       -H "sec-fetch-mode: cors" \
                       -H "sec-fetch-site: same-origin" \
                       -H "user-agent: ${sq(headers['user-agent'])}" \
                       -H "viewport-width: 1746" \
                       -H "x-asbd-id: 129477" \
                       -H "x-csrftoken: ${csrf_token}" \
                       -H "x-ig-app-id: 936619743392459" \
                       -H "x-ig-www-claim: hmac.AR1ZzYLWa9nVcjhrpoITy-n6pMAYn8YuDQVAP1Eh3pFjXzGO" \
                       -H "x-requested-with: XMLHttpRequest"`
    let stories_id: string[] = [];
    let total_saved_stories = 0;
    let response = null;
    //#endregion

    //#region 2. Get tagged stories from instagram    
    try {
        response = await instagramCurlRequest(curl);
        ////console.log(response);
    } catch (error: any) {
        //console.log(error.message);
        if (error.message == "DISCONNECTED") {
            await prisma.instagram.update({
                where: {
                    id: instagram.id
                },
                data: {
                    connected: false
                }
            });
            //send email to user that instagram account is not connected
            const html = `<p>Hi ${user.name} ${user.lastname},</p>
            <p>Instagram account <b>${instagram.username}</b> is not connected to Skim Social now.</p>
            <p>Please reconnect your instagram account to Skim Social again.</p>
            <p>Best regards,</p>
            <p>Skim Social Team</p>`;
            Mail.Send(Mail.MailType.NEW_MESSAGE, user.email, html, 'Instagram is pendding').then((result) => {
                //console.log(result);
            }).catch((err: any) => {
                //console.log(err.message);
            });
        }
        //throw GQLErrors.BAD_USER_INPUT
        return {
            stories_id,
            total_saved_stories
        }
    }
    //#endregion

    //#region 3. get valid user's members based on subscription
    let members: { id: string, pk: string, username: string }[] | null = null;
    let unlimited = false;
    let remaining_members = 0;
    let paused_members: string[] = [];
    try {
        const getValidMember = await getValidMemberBasedOnSubscription(user.id, user.number_of_socials);
        members = getValidMember.members;
        unlimited = getValidMember.unlimited;
        remaining_members = getValidMember.remaining_members;
        paused_members = getValidMember.paused_members;
    } catch (error: any) {
        //console.log(error.message);
        return {
            stories_id,
            total_saved_stories
        }
    }
    //#endregion

    try {
        if (response.status !== 'ok')
            return {
                total_saved_stories: 0,
                stories_id: []
            }
        //filtter stories which new story
        let stories: any[] = response.tray;
        let temp: any[] = [];
        for (let i = 0; i < stories.length; i++) {
            const s = stories[i];

            if (paused_members.includes(s.user.pk)) continue;

            //find latest story of user with same owner_pk
            try {
                const latest_story = await prisma.story.findFirst({
                    where: {
                        owner_pk: s.user.pk,
                        instagramId: instagram.id
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                });
                // check if the latest story is not the same as the latest story in database 
                if (latest_story == null || s.latest_reel_media > latest_story.latest_reel_media)
                    temp.push(s);
            } catch (error: any) {
                //console.log(error.message);
            }
        }
        stories = temp;
        for (let i = 0; i < stories.length; i++) {
            let id = stories[i].id;
            const Mainstory = stories[i];
            try {
                const storyDetailCurl = `curl --insecure -x ${proxyaddress} -U ${proxyauth} -H "accept: */*" -H "cookie: ${instagram.cookie}" -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36" -H "x-ig-app-id: 936619743392459" -H "x-requested-with: XMLHttpRequest" "https://www.instagram.com/api/v1/feed/user/${id}/story/"`
                const storyDetail = await instagramCurlRequest(storyDetailCurl);
                ////console.log(storyDetail);
                // const storyDetail = (await axios({
                //     method: 'get',
                //     url: `https://www.instagram.com/api/v1/feed/user/${id}/story/`,
                //     headers: getHeaders(instagram.cookie),
                // })).data;

                if (storyDetail.status !== 'ok')
                    continue;

                let latest_story = null;

                try {
                    latest_story = await prisma.story.findFirst({
                        where: {
                            owner_pk: Mainstory.user.pk,
                            instagramId: instagram.id
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    });
                } catch (error: any) {
                    //console.log(error.message);
                }
                let mentions: string[] = [];
                let indexs: number[] = [];
                let storyMentions: string[] = [];
                //check if user is tagged in stories in every item
                for (let i = 0; i < storyDetail.reel.items.length; i++) {
                    let item = storyDetail.reel.items[i];
                    //check if user is tagged in this story
                    mentions = item.story_bloks_stickers == null ? '' : item.story_bloks_stickers.map((i: any) => i.bloks_sticker.sticker_data.ig_mention.username);

                    if (mentions.includes(instagram.username)) {
                        //check if story is not exist in database
                        if (latest_story == null || +item.taken_at > latest_story.latest_reel_media) {
                            indexs.push(i);
                            storyMentions.push(...mentions);
                        }
                    }
                }

                if (indexs.length == 0)
                    continue;
                let member = await prisma.member.findUnique({
                    where: {
                        pk: storyDetail.reel.user.pk
                    },
                    include: {
                        userInstaMembers: true
                    }
                });

                if (!member && (unlimited || remaining_members > 0)) {
                    try {
                        member = await createMemberForUser(storyDetail.reel.user.pk, true, user, instagram.id);
                        if (member) {
                            members.push({
                                id: member.id,
                                pk: member.pk,
                                username: member.username
                            });
                            remaining_members--;
                        }
                        if (!unlimited && member) {
                            remaining_members--;
                        }
                    } catch (error: any) {
                        //console.log(error.message);
                        continue;
                    }
                } else if (!member && !unlimited && remaining_members == 0) {
                    continue;
                }

                //now check a thier linked member or not
                let linkedMember = null;
                if (member) {
                    if (!unlimited && remaining_members == 0) {
                        if (members.find((m) => m.pk == member?.pk)) {
                            linkedMember = member;
                        } else {
                            continue;
                        }
                    } else {
                        let unconnected = true;
                        if (!unlimited && remaining_members !== 0) {
                            if (members.find((m) => m.pk == member?.pk)) {
                                unconnected = false
                                linkedMember = member;
                            }
                        } else {
                            if (unlimited) {
                                if (member.userInstaMembers.find((social) => social.userId == user.id)) {
                                    unconnected = false;
                                    linkedMember = member;
                                }
                            }
                        }
                        if (unconnected) {
                            //connect member to instagram account
                            try {
                                const userInstaMember = await prisma.userInstaMember.create({
                                    data: {
                                        user: { connect: { id: user.id } },
                                        member: { connect: { id: member.id } },
                                    },
                                });
                                try {
                                    const curent_user = await prisma.user.findUnique({
                                        where: {
                                            id: user.id
                                        },
                                        select: {
                                            id: true,
                                            number_of_insta_members: true,
                                        }
                                    });
                                    if (curent_user) {
                                        members.push({
                                            id: member.id,
                                            pk: member.pk,
                                            username: member.username
                                        });
                                        remaining_members--;

                                        await prisma.user.update({
                                            where: {
                                                id: user.id
                                            },
                                            data: {
                                                number_of_insta_members: curent_user.number_of_insta_members + 1
                                            }
                                        });
                                    }
                                } catch (error: any) {

                                }
                                linkedMember = member;
                                if (!unlimited) {
                                    members.push({
                                        id: member.id,
                                        pk: member.pk,
                                        username: member.username
                                    });
                                    remaining_members--;
                                }
                            } catch (error: any) {
                                //console.log(error.message);
                                continue;
                            }
                        } else {
                            if (linkedMember == null)
                                continue;
                        }
                    }
                } else {
                    continue;
                }
                let contents: CustomType.Content[] = [];
                for (let i = 0; i < indexs.length; i++) {
                    let item = storyDetail.reel.items[indexs[i]];
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
                //save content file to cloud
                let carouselContents = await downloadCarouselFiles(contents);
                if (carouselContents.length == 0)
                    continue;
                //save story to database
                try {
                    const story = await prisma.story.create({
                        data: {
                            latest_reel_media: +stories[i].latest_reel_media,
                            mentions: storyMentions.filter((item, index) => storyMentions.indexOf(item) === index),
                            owner_pk: stories[i].user.pk,
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
                                    id: user.id
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
                    stories_id.push(story.id);
                } catch (error: any) {
                    //console.log(error.message);
                }
            } catch (error: any) {

                if (error.message == "DISCONNECTED") {
                    await prisma.instagram.update({
                        where: {
                            id: instagram.id
                        },
                        data: {
                            connected: false
                        }
                    });
                    //send email to user that instagram account is not connected
                    const html = `<p>Hi ${user.name} ${user.lastname},</p>
                    <p>Instagram account <b>${instagram.username}</b> is not connected to Skim Social now.</p>
                    <p>Please reconnect your instagram account to Skim Social again.</p>
                    <p>Best regards,</p>
                    <p>Skim Social Team</p>`;
                    Mail.Send(Mail.MailType.NEW_MESSAGE, user.email, html, 'Instagram is pendding').then((result) => {
                        //console.log(result);
                    }).catch((err: any) => {
                        //console.log(err.message);
                    });

                    continue;
                }
                //console.log(error.message);

            }
        }
    } catch (error: any) {
        //console.log(error.message);
    }
    try {
        //update instagram stories_count
        await prisma.instagram.update({
            where: {
                id: instagram.id
            },
            data: {
                stories_count: stories_id.length + instagram.stories_count
            }
        });
    } catch (error: any) {
        //console.log(error.message);
    }
    return {
        total_saved_stories: stories_id.length,
        stories_id
    }
}

const getTaggedPostsAndReels = async (instagram: Instagram, user: User, total_saved_reels = 0, total_saved_posts = 0, reels_id: string[] = [], posts_id: string[] = [], after: string = 'null', last_saved_content = ''): Promise<CustomType.TaggedPostsAndReels> => {

    //#region 1. Define variables
    const headers: { [key: string]: string } = (instagram.browser as any).headers;
    const csrf_token = instagram.cookie.split('csrftoken=')[1].split(';')[0];
    const curl = `curl --insecure "https://www.instagram.com/graphql/query/?query_hash=be13233562af2d229b008d2976b998b5&variables=%7B%22id%22%3A${instagram.pk}%2C%22first%22%3A12%2C%22after%22%3A${after}%7D" \
                       -x "${proxyaddress}" \
                       -U "${proxyauth}" \                    
                       -H "authority: www.instagram.com" \
                       -H "accept: */*" \
                       -H "accept-language: ${sq(headers['accept-language'])}" \
                       -H "cookie: ${instagram.cookie}" \
                       -H "referer: https://www.instagram.com/${instagram.username}/tagged/" \
                       -H "sec-ch-prefers-color-scheme: dark" \
                       -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" \
                       -H "sec-ch-ua-full-version-list: ${sq(headers['sec-ch-ua'])}" \
                       -H "sec-ch-ua-mobile: ${headers['sec-ch-ua-mobile']}" \
                       -H "sec-ch-ua-platform: ${headers['sec-ch-ua-platform']}" \
                       -H "sec-ch-ua-platform-version: "15.0.0"" \
                       -H "sec-fetch-dest: empty" \
                       -H "sec-fetch-mode: cors" \
                       -H "sec-fetch-site: same-origin" \
                       -H "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36" \
                       -H "viewport-width: 1746" \
                       -H "x-asbd-id: 129477" \
                       -H "x-csrftoken: ${csrf_token}" \
                       -H "x-ig-app-id: 936619743392459" \
                       -H "x-ig-www-claim: hmac.AR1ZzYLWa9nVcjhrpoITy-n6pMAYn8YuDQVAP1Eh3pFjXzGO" \
                       -H "x-requested-with: XMLHttpRequest"`
    //#endregion

    //#region 2. Get tagged posts and reels from instagram
    let response = null;
    try {
        response = await instagramCurlRequest(curl);
    } catch (error: any) {
        if (error.message == "DISCONNECTED") {
            await prisma.instagram.update({
                where: {
                    id: instagram.id
                },
                data: {
                    connected: false
                }
            });
            //send email to user that instagram account is not connected
            try {
                const html = `<p>Hi ${user.name} ${user.lastname},</p>
                <p>Instagram account <b>${instagram.username}</b> is not connected to Skim Social now.</p>
                <p>Please reconnect your instagram account to Skim Social again.</p>
                <p>Best regards,</p>
                <p>Skim Social Team</p>`;
                Mail.Send(Mail.MailType.NEW_MESSAGE, user.email, html, 'Instagram is pendding').then((result) => {
                    //console.log(result);
                }).catch((err: any) => {
                    //console.log(err.message);
                });

            } catch (error: any) {

            }
        }
        //throw GQLErrors.BAD_USER_INPUT
        return {
            total_saved_posts,
            total_saved_reels,
            reels_id,
            posts_id
        }
    }
    //#endregion

    //#region 3. get valid user's members based on subscription
    let reach_on_last_post = false;
    let members = null;
    let unlimited = false;
    let remaining_members = 0;
    let paused_members: string[] = [];
    try {
        const ValidMember = await getValidMemberBasedOnSubscription(user.id, user.number_of_socials);
        members = ValidMember.members;
        unlimited = ValidMember.unlimited;
        remaining_members = ValidMember.remaining_members;
        paused_members = ValidMember.paused_members;
    } catch (error: any) {
        //console.log(error.message);
        return {
            total_saved_posts,
            total_saved_reels,
            reels_id,
            posts_id
        }
    }
    //#endregion

    const data = response.data.user?.edge_user_to_photos_of_you?.edges;
    ////console.log(data);
    const page_info = response.data.user?.edge_user_to_photos_of_you?.page_info;
    if (data == null) {
        //console.log("data is null");
        return {
            total_saved_posts,
            total_saved_reels,
            reels_id,
            posts_id
        }
    }
    ////console.log(data.length);
    try {
        let posts: { id: string, display_url: string, owner_pk: string, owner_username: string, taken_at: number, shortcode: string }[] = [];
        ////console.log(paused_members);
        for (let i = 0; i < data.length; i++) {
            const post = data[i].node;
            ////console.log(post);
            if (+post.taken_at_timestamp <= +instagram.last_saved_content) {
                //console.log("reach on last post");
                reach_on_last_post = true;
                break;
            }
            if (!paused_members.includes(post.owner.id)) {
                posts.push({
                    id: post.id as string,
                    display_url: post.display_url as string,
                    owner_pk: post.owner.id as string,
                    shortcode: post.shortcode as string,
                    owner_username: post.owner.username as string,
                    taken_at: +post.taken_at_timestamp,
                });
            } else {
                //console.log("paused member");
            }
        }

        //console.log(posts.length);

        for (let i = 0; i < posts.length; i++) {
            //get detail info of post
            let { id, display_url, taken_at, owner_pk, shortcode } = posts[i];

            //#region check if the owner of the post is in the database and create if not
            let member = await prisma.member.findUnique({
                where: {
                    pk: owner_pk
                },
                include: {
                    userInstaMembers: true
                }
            });

            if (!member && (unlimited || remaining_members > 0)) {
                try {
                    member = await createMemberForUser(owner_pk, true, user, instagram.id);
                    if (member) {
                        members.push({
                            id: member.id,
                            pk: member.pk,
                            username: member.username
                        });
                        remaining_members--;
                    }
                    if (!unlimited && member) {
                        remaining_members--;
                    }
                } catch (error: any) {
                    //console.log(error.message);
                    continue;
                }
            } else if (!member && !unlimited && remaining_members == 0) {
                continue;
            }
            //now check a thier linked member or not
            let linkedMember = null;
            if (member) {
                if (!unlimited && remaining_members == 0) {
                    if (members.find((m) => m.pk == member?.pk)) {
                        linkedMember = member;
                    } else {
                        continue;
                    }
                } else {
                    let unconnected = true;
                    if (!unlimited && remaining_members !== 0) {
                        if (members.find((m) => m.pk == member?.pk)) {
                            unconnected = false
                            linkedMember = member;
                        }
                    } else {
                        if (unlimited) {
                            if (member.userInstaMembers.find((social) => social.userId == user.id)) {
                                unconnected = false;
                                linkedMember = member;
                            }
                        }
                    }
                    if (unconnected) {
                        //connect member to instagram account
                        try {
                            const instagramMember = await prisma.userInstaMember.create({
                                data: {
                                    user: { connect: { id: user.id } },
                                    member: { connect: { id: member.id } },
                                },
                            });
                            try {
                                const curent_user = await prisma.user.findUnique({
                                    where: {
                                        id: user.id
                                    },
                                    select: {
                                        id: true,
                                        number_of_insta_members: true,
                                    }
                                });
                                if (curent_user) {
                                    members.push({
                                        id: member.id,
                                        pk: member.pk,
                                        username: member.username
                                    });
                                    remaining_members--;
                                    await prisma.user.update({
                                        where: {
                                            id: user.id
                                        },
                                        data: {
                                            number_of_insta_members: curent_user.number_of_insta_members + 1
                                        }
                                    });
                                }
                            } catch (error: any) {

                            }
                            linkedMember = member;
                            if (!unlimited) {
                                members.push({
                                    id: member.id,
                                    pk: member.pk,
                                    username: member.username
                                });
                                remaining_members--;
                            }
                        } catch (error: any) {
                            //console.log(error.message);
                            continue;
                        }
                    } else {
                        if (linkedMember == null)
                            continue;
                    }
                }
            } else {
                continue;
            }
            //#endregion

            try {
                const post_detail = await getMediaDetailInfo({ id, display_url, taken_at }, instagram.cookie);
                let filesToBeUploaded: CustomType.FileToBeUploaded1 = {};
                if (post_detail.type === MediaType.IMAGE) {
                    let content = post_detail.data as CustomType.ImageContent;
                    filesToBeUploaded = {
                        [content.media_id]: {
                            path: content.url,
                            size: 0,
                            file_not_found: false,
                            uploaded: false
                        }
                    }
                    //download file
                    try {
                        let downloaded = (await downloadFiles(filesToBeUploaded))[content.media_id];
                        if (downloaded.uploaded) {
                            content.url = downloaded.path;
                            content.display_url = downloaded.path;
                            //create post in database
                            try {
                                const post = await prisma.post.create({
                                    data: {
                                        pk: id,
                                        link: `https://www.instagram.com/p/${shortcode}/`,
                                        caption: post_detail.caption,
                                        mentions: post_detail.mentions,
                                        owner_pk: linkedMember.pk,
                                        owner_username: linkedMember.username,
                                        owner_full_name: linkedMember.full_name,
                                        owner_followers: linkedMember.followers,
                                        owner_profile_pic_url: linkedMember.profile_pic_url,
                                        owner_verified: linkedMember.verified,
                                        instagram: {
                                            connect: {
                                                id: instagram.id
                                            }
                                        },
                                        user: {
                                            connect: {
                                                id: user.id
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
                                if (post) {
                                    if (total_saved_posts == 0 && total_saved_reels == 0) {
                                        last_saved_content = taken_at.toString()
                                    }
                                    posts_id.push(post.id);
                                    total_saved_posts++;
                                }
                            } catch (error: any) {
                                //console.log(error.message);
                            }
                        }
                    } catch (error: any) {
                        //console.log(error.message);
                    }
                } else if (post_detail.type === MediaType.VIDEO) {
                    let content = post_detail.data as CustomType.VideoContent;
                    filesToBeUploaded = {
                        ['url' + content.media_id]: {
                            path: content.url,
                            size: 0,
                            file_not_found: false,
                            uploaded: false
                        },
                        ['display' + content.media_id]: {
                            path: content.display_url,
                            size: 0,
                            file_not_found: false,
                            uploaded: false
                        },
                    }
                    //download file
                    try {
                        let downloaded = await downloadFiles(filesToBeUploaded);
                        let urlDownloaded = downloaded['url' + content.media_id];
                        let displayDownloaded = downloaded['display' + content.media_id];
                        if (urlDownloaded?.uploaded) {
                            content.url = urlDownloaded.path;
                            content.display_url = displayDownloaded ? displayDownloaded.path : content.display_url;
                            //create post in database
                            try {
                                const reel = await prisma.reel.create({
                                    data: {
                                        pk: id,
                                        link: `https://www.instagram.com/p/${shortcode}/`,
                                        caption: post_detail.caption,
                                        mentions: post_detail.mentions,
                                        owner_pk: linkedMember.pk,
                                        owner_username: linkedMember.username,
                                        owner_full_name: linkedMember.full_name,
                                        owner_followers: linkedMember.followers,
                                        owner_profile_pic_url: linkedMember.profile_pic_url,
                                        owner_verified: linkedMember.verified,
                                        instagram: {
                                            connect: {
                                                id: instagram.id
                                            }
                                        },
                                        user: {
                                            connect: {
                                                id: user.id
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
                                if (reel) {
                                    if (total_saved_posts == 0 && total_saved_reels == 0) {
                                        last_saved_content = taken_at.toString()
                                    }
                                    reels_id.push(reel.id);
                                    total_saved_reels++;
                                }
                            } catch (error: any) {
                                //console.log(error.message);
                            }
                        }
                    } catch (error: any) {
                        //console.log(error.message);
                    }
                } else {
                    let carouselContents: any[] = await downloadCarouselFiles((post_detail.data as CustomType.Content[]));

                    try {
                        //create post in database
                        const post = await prisma.post.create({
                            data: {
                                pk: id,
                                link: `https://www.instagram.com/p/${shortcode}/`,
                                caption: post_detail.caption,
                                mentions: post_detail.mentions,
                                owner_pk: linkedMember.pk,
                                owner_username: linkedMember.username,
                                owner_full_name: linkedMember.full_name,
                                owner_followers: linkedMember.followers,
                                owner_profile_pic_url: linkedMember.profile_pic_url,
                                owner_verified: linkedMember.verified,
                                instagram: {
                                    connect: {
                                        id: instagram.id
                                    }
                                },
                                user: {
                                    connect: {
                                        id: user.id
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
                        if (post) {
                            if (total_saved_posts == 0 && total_saved_reels == 0) {
                                last_saved_content = taken_at.toString()
                            }
                            posts_id.push(post.id);
                            total_saved_posts++;
                        }
                    } catch (error: any) {
                        //console.log(error.message);
                    }
                }
            } catch (error: any) {
                //console.log(error.message);
            }
        }
    } catch (error: any) {
        //console.log(error.message);
    }
    if (page_info.has_next_page && page_info.end_cursor && !reach_on_last_post) {
        return await getTaggedPostsAndReels(instagram, user, total_saved_reels, total_saved_posts, reels_id, posts_id, page_info.end_cursor, last_saved_content);
    } else {
        try {
            if (last_saved_content !== '')
                await prisma.instagram.update({
                    where: {
                        id: instagram.id
                    },
                    data: {
                        posts_count: total_saved_posts + instagram.posts_count,
                        reels_count: total_saved_reels + instagram.reels_count,
                        last_saved_content: last_saved_content
                    }
                });
            else
                await prisma.instagram.update({
                    where: {
                        id: instagram.id
                    },
                    data: {
                        posts_count: total_saved_posts + instagram.posts_count,
                        reels_count: total_saved_reels + instagram.reels_count,
                    }
                });
        } catch (error: any) {
            //console.log(error.message);
        }
        return {
            total_saved_posts,
            total_saved_reels,
            reels_id,
            posts_id
        }
    }
}

/**
 * 
 * @param post 
 * @param cookie 
 * @returns CustomType.MediaDetailInfo
 */
const getMediaDetailInfo = async (post: { id: string, display_url: string, taken_at: number }, cookie: string): Promise<CustomType.MediaDetailInfo> => {
    const url = `https://www.instagram.com/api/v1/media/${post.id}/info/`;
    const response = await axios({
        method: 'get',
        url: url,
        headers: getHeaders(cookie),
    });
    const info = response.data.items[0];
    //get caption text if caption is not null
    let caption = null;
    if (info.caption) {
        caption = info.caption.text;
    }
    //get image version
    let image_version = null;
    if (info.image_versions2) {
        image_version = info.image_versions2.candidates[0];
    }
    const mentions = info.usertags.in.map((data: any) => {
        return data.user.username;
    });
    const content_type = info.media_type == 1 ? MediaType.IMAGE : info.media_type == 2 ? MediaType.VIDEO : MediaType.CAROUSEL_ALBUM;
    let content: CustomType.ImageContent | CustomType.VideoContent | CustomType.Content[] | null = null;


    if (info.media_type == 1) {
        const image_versions = info.image_versions2.candidates[0];
        content = {
            media_id: post.id,
            url: image_versions.url,
            width: image_versions.width,
            height: image_versions.height,
            display_url: post.display_url,
            taken_at: post.taken_at,
        } as CustomType.ImageContent;
    } else if (info.media_type == 2) {
        const video_versions = info.video_versions[0];
        content = {
            media_id: post.id,
            url: video_versions.url,
            width: video_versions.width,
            height: video_versions.height,
            has_audio: info.has_audio,
            duration: info.video_duration,
            taken_at: post.taken_at,
            display_url: post.display_url,
        } as CustomType.VideoContent;
    } else if (info.media_type == 8) {
        const carousel_media = info.carousel_media;
        content = carousel_media.map((_content: any) => {
            let media_type = _content.media_type == 1 ? MediaType.IMAGE : MediaType.VIDEO;
            if (media_type == MediaType.IMAGE) {
                return {
                    content: {
                        media_id: _content.pk,
                        url: _content.image_versions2.candidates[0].url,
                        width: _content.image_versions2.candidates[0].width,
                        height: _content.image_versions2.candidates[0].height,
                        display_url: _content.image_versions2.candidates[0].url,
                        taken_at: post.taken_at,
                    } as CustomType.ImageContent
                };
            } else {
                return {
                    content: {
                        media_id: _content.pk,
                        url: _content.video_versions[0].url,
                        width: _content.video_versions[0].width,
                        height: _content.video_versions[0].height,
                        has_audio: true,
                        duration: _content.video_duration,
                        display_url: _content.image_versions2.candidates[0].url,
                        taken_at: +post.taken_at,
                    } as CustomType.VideoContent
                };
            }
        }) as CustomType.Content[];
    }
    if (content !== null) {
        const mediaDetailInfo: CustomType.MediaDetailInfo = {
            caption: caption,
            mentions: mentions,
            type: content_type,
            data: content,
        };

        return mediaDetailInfo;
    } else {
        throw new Error('content is null');
    }
}

const createMemberForUser = async (identifier: string, byID: boolean, user: User, id: string) => {
    let profileInfo = null;
    const instagram = await prisma.instagram.findUnique({
        where: {
            id: id
        }
    });
    if (instagram === null) {
        throw new Error('instagram is null');
    }
    try {
        if (byID) {
            profileInfo = await getProfileInfoById(identifier, instagram.cookie);
        } else {
            profileInfo = await getProfileInfoByUsername(identifier, instagram.cookie, instagram.browser);
        }
    } catch (error: any) {
        throw new Error(error.message);
    }

    if (profileInfo && profileInfo.status === 'ok') {
        let default_profile = `https://ui-avatars.com/api/?uppercase=true&name=${profileInfo.user?.full_name}&length=1&bold=true&rounded=true&font-size=0.5&background=d62976&color=ffffff`;
        try {
            const download_profile_picture = await downloadFiles(
                {
                    'profile': {
                        path: profileInfo.user.profile_pic_url,
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
            const instaMember = await prisma.member.create({
                data: {
                    pk: byID ? identifier : profileInfo.user.id,
                    username: byID ? profileInfo.user.username : identifier,
                    full_name: profileInfo.user.full_name,
                    verified: profileInfo.user.is_verified,
                    followers: byID ? profileInfo.user.follower_count : profileInfo.user.edge_followed_by.count,
                    profile_pic_url: default_profile,
                    userInstaMembers: {
                        create: {
                            user: {
                                connect: {
                                    id: user.id
                                }
                            }
                        }
                    }
                },
                include: {
                    userInstaMembers: true
                }
            });
            if (instaMember) {
                try {
                    const curent_user = await prisma.user.findUnique({
                        where: {
                            id: user.id
                        },
                        select: {
                            id: true,
                            number_of_insta_members: true,
                        }
                    });
                    if (curent_user) {
                        await prisma.user.update({
                            where: {
                                id: user.id
                            },
                            data: {
                                number_of_insta_members: curent_user.number_of_insta_members + 1
                            }
                        });
                    }
                } catch (error: any) {

                }
            }
            return instaMember;
        } catch (error: any) {
            //console.log(error.message);
            throw new Error('Could not create member');
        }
    } else {
        throw new Error('Could not get profile info');
    }
}

const InstagramAPI = {
    getHeaders,
    getProfileInfoById,
    getProfileInfoByUsername,
    getTaggedPostsAndReels,
    getTaggedStories,
    createMemberForUser,
    getValidMemberBasedOnSubscription,
    instagramCurlRequest,
    downloadCarouselFiles
};

export default InstagramAPI;