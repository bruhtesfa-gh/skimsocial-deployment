import axios from 'axios';
import cheerio from 'cheerio';
import prisma from '../../prisma/prisma-client';
import { downloadFiles } from '../FileManagment/downloader';
import util from "util";
import fs from "fs";
import path from 'path';
import { TikTok, TikTokMember, User, UserTikTokMember } from '@prisma/client';
import CustomType from '../../custom-type/custom-type';

import { exec as execnormal } from 'child_process';
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
interface TikTokMiniprofile {
    username: string;
    user_id: string;
    avatar_url: string;
}

interface UserModule {
    id: string;
    uniqueId: string;
    nickname: string;
    avatarLarger: string;
    avatarMedium: string;
    avatarThumb: string;
    signature: string;
    createTime: number;
    verified: boolean;
    secUid: string;
    ftc: boolean;
    openFavorite: boolean;
    privateAccount: boolean;
    secret: boolean;
    isADVirtual: boolean;
    roomId: string;
    uniqueIdModifyTime: number;
    ttSeller: boolean;
    region: string;
    followingVisibility: number;
    isEmbedBanned: boolean;
}

interface Stats {
    followerCount: number,
    followingCount: number,
    heart: number,
    heartCount: number,
    videoCount: number,
    diggCount: number,
}

const tikTokCurl = async (command: string, type = "JSON") => {
    console.log(type);
    ////console.log(command);
    try {
        const { stdout, stderr }: { stdout: any, stderr: any } = await exec(command);
        let response = null;
        try {
            if (type === "JSON")
                response = JSON.parse(stdout.substring(0, stdout.lastIndexOf('}') + 1));
            else
                response = stdout;
            //console.log(response);
        } catch (error: any) {
            console.log(error.message);
            throw Error(error.message);
        }
        if (response && (response.status_code && response.status_code === 8) && (response.status_msg && response.status_msg === 'Login expired')) {
            throw Error("DISCONNECTED");
        }
        else if (response == null)
            throw Error("request failed");
        else
            return response;
    } catch (error: any) {
        console.log(error.message);
        let response = null;
        try {
            if (type === "JSON")
                response = JSON.parse(error.stdout.substring(0, error.stdout.lastIndexOf('}') + 1));
            else
                response = error.stdout;
        } catch (error: any) {
            console.log(error.message);
            throw Error(error.message);
        }
        if (response && (response.status_code && response.status_code === 8) && (response.status_msg && response.status_msg === 'Login expired')) {
            throw Error("DISCONNECTED");
        }
        else if (response == null)
            throw Error("request failed");
        else
            return response;
    };
}

const getTikTokProfile = async (username: string): Promise<any | null> => {
    const url = `https://www.tiktok.com/@${username}?lang=en`;
    try {
        let htmlpath = path.resolve(__dirname, `../FileManagment/temp/${username + '.html'}`);
        //let htmlpath = `${username + '.html'}`;
        await tikTokCurl(`curl ${process.env.PROXY_LINK || ''} "${url}" -o ${htmlpath}`, 'HTML');
        console.log(htmlpath);
        if (!fs.existsSync(htmlpath))
            return null;

        const html = fs.readFileSync(htmlpath);

        const $ = cheerio.load(html, { xmlMode: true });
        const script = $('script#SIGI_STATE').text() as any;
        // Extract the desired information from the scripts
        console.log(script);
        try {
            const profileinfo = JSON.parse(script)
            if (fs.existsSync(htmlpath))
                fs.unlinkSync(htmlpath);
            if (!profileinfo && profileinfo.UserPage.uniqueId !== username) {
                return null;
            }
            return profileinfo;
        } catch (error: any) {
            if (fs.existsSync(htmlpath))
                fs.unlinkSync(htmlpath);
            console.error('Error:', error);
            return null;
        }
    } catch (error: any) {
        console.error('Error:', error);
        // Return null or throw an error as desired
        return null;
    }
}

const getTikTokMiniProfile = async (cookies: string[], browser: any): Promise<TikTokMiniprofile | null> => {
    let response = null;
    try {
        const headers: { [key: string]: string } = browser.headers;
        const device_id = browser.device_id as string;
        const param = (browser.param as string);
        const url_param = param === '' ? `"aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=${encodeURIComponent(sq(headers['user-agent']).substring(sq(headers['user-agent']).indexOf('/') + 1))}&channel=tiktok_web&cookie_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=video&group_list=%5B%7B%22count%22%3A20%2C%22is_mark_read%22%3A1%2C%22group%22%3A6%2C%22max_time%22%3A0%2C%22min_time%22%3A0%7D%5D&history_len=4"` : param;
        const curl = `curl --insecure "https://www.tiktok.com/passport/web/account/info/?${url_param}" \
        -x "${proxyaddress}" \
        -U "${proxyauth}" \
        -H "authority: www.tiktok.com" \
        -H "accept: */*" \
        -H "accept-language: ${headers['accept-language']}" \
        -H "cookie: ${cookies.map(cookie => cookie.split(';')[0]).join('; ')}" \
        -H "referer: https://www.tiktok.com/" \
        -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" \
        -H "sec-ch-ua-mobile: ${sq(headers['sec-ch-ua-mobile'])}" \
        -H "sec-ch-ua-platform: ${sq(headers['sec-ch-ua-platform'])}" \
        -H "sec-fetch-dest: empty" \
        -H "sec-fetch-mode: cors" \
        -H "sec-fetch-site: same-origin" \
        -H "user-agent: ${sq(headers['user-agent'])}"`;
        //console.log(curl);
        response = await tikTokCurl(curl);
        if (response.message !== 'success') {
            return null;
        }
        return {
            username: response.data.username,
            user_id: response.data.user_id_str,
            avatar_url: response.data.avatar_url
        };
    } catch (error: any) {
        console.error('Error:', error.message);
        // Return null or throw an error as desired
        return null;
    }
}

const getValidMemberBasedOnSubscription = async (id: string, number_of_socials: string) => {
    let tik_tok_members = null;
    let unlimited = false;
    let remaining_tik_tok_members = 0;
    let paused_tik_tok_members: string[] = [];
    try {
        const all_tik_tok_members = await prisma.tikTokMember.findMany({
            where: {
                userTikTokMembers: {
                    some: {
                        userId: id,
                        paused: true
                    }
                }
            },
            select: {
                t_id: true,
                uniqueId: true,
            }
        });
        paused_tik_tok_members = all_tik_tok_members !== null ? all_tik_tok_members.map((m) => m.t_id) : [];
        if (number_of_socials === 'INFINITY') {
            unlimited = true;
            tik_tok_members = await prisma.tikTokMember.findMany({
                where: {
                    userTikTokMembers: {
                        some: {
                            userId: id,
                            paused: false
                        }
                    }
                },
                select: {
                    id: true,
                    t_id: true,
                    uniqueId: true,
                },
            });
        } else {
            tik_tok_members = await prisma.tikTokMember.findMany({
                where: {
                    userTikTokMembers: {
                        some: {
                            userId: id,
                            paused: false
                        }
                    }
                },
                select: {
                    id: true,
                    t_id: true,
                    uniqueId: true,
                },
                take: +number_of_socials
            });
            remaining_tik_tok_members = +number_of_socials - tik_tok_members.length;
            if (remaining_tik_tok_members < 0)
                remaining_tik_tok_members = 0;
        }
        return {
            tik_tok_members,
            unlimited,
            remaining_tik_tok_members,
            paused_tik_tok_members
        }
    } catch (error: any) {
        //console.log(error.message);
        throw Error(error.message);
    }
}

const createTiktokMemberForUser = async (unique_id: string, user: User): Promise<TikTokMember & { userTikTokMembers: UserTikTokMember[] } | null> => {
    const member = await prisma.tikTokMember.findUnique({
        where: {
            uniqueId: unique_id
        },
        include: {
            userTikTokMembers: true
        }

    });
    if (member) {
        const userTikTokMember = await prisma.userTikTokMember.findFirst({
            where: {
                userId: user.id,
                tikTokMemberId: member.id
            }
        });
        if (userTikTokMember) {
            return member;
        } else {
            try {
                const userTikTokMember = await prisma.userTikTokMember.create({
                    data: {
                        user: {
                            connect: {
                                id: user.id
                            }
                        },
                        tikTokMember: {
                            connect: {
                                id: member.id
                            }
                        }
                    },
                });
                if (userTikTokMember) {
                    return member;
                }
            } catch (error: any) {
                //console.log(error.message);
                return null;
            }
        }
    }
    const profile = await getTikTokProfile(unique_id);
    if (!profile) {
        return null;
    }
    try {
        const userInfo = profile.UserModule.users[unique_id] as UserModule;
        let default_profile = userInfo.avatarLarger;
        try {
            const download_profile_picture = await downloadFiles(
                {
                    "profile": {
                        path: userInfo.avatarLarger,
                        size: 0,
                        uploaded: false,
                        file_not_found: false
                    }
                });
            if (download_profile_picture["profile"].uploaded)
                default_profile = download_profile_picture["profile"].path
        } catch (error: any) {
            //console.log(error.message);
        }
        const stats = profile.UserModule.stats[unique_id] as Stats;
        const tikTokMember = await prisma.tikTokMember.create({
            data: {
                t_id: userInfo.id,
                uniqueId: unique_id,
                followerCount: stats.followerCount,
                followingCount: stats.followingCount,
                heartCount: stats.heartCount,
                videoCount: stats.videoCount,
                profileUrl: default_profile,
                nickname: userInfo.nickname,
                bio: userInfo.signature,
                userTikTokMembers: {
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
                userTikTokMembers: true
            }
        });
        if (tikTokMember) {
            try {
                const curent_user = await prisma.user.findUnique({
                    where: {
                        id: user.id
                    },
                    select: {
                        id: true,
                        number_of_tiktok_members: true,
                    }
                });
                if (curent_user) {
                    await prisma.user.update({
                        where: {
                            id: user.id
                        },
                        data: {
                            number_of_tiktok_members: curent_user.number_of_tiktok_members + 1
                        }
                    });
                }
            } catch (error: any) {

            }
        }
        return tikTokMember;
    }
    catch (error: any) {
        //console.log(error.message);
        return null;
    }
}

const getTumbnail = async (uniqueId: string, content_id: string): Promise<any | null> => {
    try {
        const response = await axios.get(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${uniqueId}/video/${content_id}`, {
            headers: {
                'authority': 'www.tiktok.com',
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9',
                'origin': 'https://tiktok.coderobo.org',
                'referer': 'https://tiktok.coderobo.org/',
                'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });
        if (response.status == 200) {
            return (response.data);
        } else
            return null;
    } catch (error: any) {
        //console.log(error.message);
        return null;
    }
}

const getThumbnail2 = async (uniqueId: string, content_id: string): Promise<string | null> => {
    try {
        const response = await axios.get(`https://www.svtiktok.com/@${uniqueId}/video/${content_id}`, {
            headers: {
                'authority': 'www.svtiktok.com',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'accept-language': 'en-US,en;q=0.9',
                'cookie': '',
                'if-none-match': 'W/"10a7e-UQCFj+c9KMkZC0pyAOynEVj/Lv4"',
                'referer': `https://www.svtiktok.com/@${uniqueId}/video/${content_id}`,
                'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });
        if (response.status == 200) {
            const $ = cheerio.load(response.data, { xmlMode: true });
            // Extract the desired information from the scripts
            return $('img#tiktok-video-thumbnail').attr('src') || $('img:first').attr('src') || null;
        } else
            return null;
    } catch (error: any) {
        //console.log(error.message);
        return null;
    }
}

const getDownloadableUrl = async (uniqueId: string, content_id: string) => {
    //send request to snaptik.app to get downloadable url
    try {
        const response = await axios.post(
            'https://tiktokdownload.online/abc',
            new URLSearchParams({
                'id': `https://www.tiktok.com/@${uniqueId}/video/${content_id}`,
                'locale': 'en',
                'tt': 'UkdNc3M0'
            }),
            {
                params: {
                    'url': 'dl'
                },
                headers: {
                    'authority': 'tiktokdownload.online',
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'hx-current-url': 'https://tiktokdownload.online/',
                    'hx-request': 'true',
                    'hx-target': 'target',
                    'hx-trigger': '_gcaptcha_pt',
                    'origin': 'https://tiktokdownload.online',
                    'referer': 'https://tiktokdownload.online/',
                    'sec-ch-ua': '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
                }
            }
        );
        if (response.status == 200) {
            const $ = cheerio.load(response.data, { xmlMode: true });
            // Extract the desired information from the scripts
            return $('a:first').attr('href');
        } else {
            return null;
        }
    } catch (error: any) {
        //console.log(error.message, 'tiktokdownload.online');
        return null;
    }
}

const getDownloadableUrl2 = async (uniqueId: string, content_id: string, thumbnail = '') => {
    try {
        const response = await axios.post(
            'https://ssstik.io/abc',
            new URLSearchParams({
                'id': `https://www.tiktok.com/@${uniqueId}/video/${content_id}`,
                'locale': 'en',
                'tt': 'ZWgxelBh'
            }),
            {
                params: {
                    'url': 'dl'
                },
                headers: {
                    'authority': 'ssstik.io',
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'hx-current-url': 'https://ssstik.io/en',
                    'hx-request': 'true',
                    'hx-target': 'target',
                    'hx-trigger': '_gcaptcha_pt',
                    'origin': 'https://ssstik.io',
                    'referer': 'https://ssstik.io/en',
                    'sec-ch-ua': '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
                }
            }
        );
        const $ = cheerio.load(response.data, { xmlMode: true });
        return $('a:first').attr('href');
    } catch (error: any) {
        //console.log("getDownloadableUrl2", error.message);
        return null;
    }
}

const saveMentionedTikTokVideos = async (tikTokAccount: TikTok, user: User, total_saved_videos = 0, last_saved_time = ""): Promise<any | null> => {
    let response: any | null = null;
    try {
        const browser = tikTokAccount.browser as any;
        const headers: { [key: string]: string } = browser.headers;
        const device_id = browser.device_id as string;
        const param = (browser.param as string);
        const url_param = param === '' ? `"aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=${encodeURIComponent(sq(headers['user-agent']).substring(sq(headers['user-agent']).indexOf('/') + 1))}&channel=tiktok_web&cookie_enabled=true&device_id=${device_id}&device_platform=web_pc&focus_state=true&from_page=video&group_list=%5B%7B%22count%22%3A20%2C%22is_mark_read%22%3A1%2C%22group%22%3A6%2C%22max_time%22%3A0%2C%22min_time%22%3A0%7D%5D&history_len=4"` : param;
        const curl = `curl --insecure "https://www.tiktok.com/api/notice/multi/?${url_param}" \
        -x "${proxyaddress}" \
        -U "${proxyauth}" \
        -H "authority: www.tiktok.com" \
        -H "accept: */*" \
        -H "accept-language: ${headers['accept-language']}" \
        -H "cookie: ${tikTokAccount.cookie}" \
        -H "referer: https://www.tiktok.com/" \
        -H "sec-ch-ua: ${sq(headers['sec-ch-ua'])}" \
        -H "sec-ch-ua-mobile: ${sq(headers['sec-ch-ua-mobile'])}" \
        -H "sec-ch-ua-platform: ${sq(headers['sec-ch-ua-platform'])}" \
        -H "sec-fetch-dest: empty" \
        -H "sec-fetch-mode: cors" \
        -H "sec-fetch-site: same-origin" \
        -H "user-agent: ${sq(headers['user-agent'])}"`;
        response = await tikTokCurl(curl);
        //console.log(response.notice_lists);
        if (response.notice_lists.length === 0) {
            return null;
        }
    } catch (error: any) {
        //console.log(error);
        if (error.message === 'DISCONNECTED') {
            await prisma.tikTok.update({
                where: {
                    id: tikTokAccount.id
                },
                data: {
                    connected: false
                }
            });
        }
        return null;
    }

    let reach_on_last_video = false;
    let tik_tok_members: {
        id: string,
        t_id: string,
        uniqueId: string,
    }[] | null = null;
    let unlimited = false;
    let remaining_tik_tok_members = 0;
    let paused_tik_tok_members: string[] = [];
    //console.log('getValidMemberBasedOnSubscription');
    try {
        const ValidMember = await getValidMemberBasedOnSubscription(user.id, user.number_of_socials);
        tik_tok_members = ValidMember.tik_tok_members;
        unlimited = ValidMember.unlimited;
        remaining_tik_tok_members = ValidMember.remaining_tik_tok_members;
        paused_tik_tok_members = ValidMember.paused_tik_tok_members;
    } catch (error: any) {
        //console.log(error.message);
        return null;
    }
    const contents = response.notice_lists[0].notice_list;
    //console.log("contents amount => " + contents.length);
    if (contents.length === 0) {
        return {
            total_saved_videos,
            last_saved_time
        };
    }
    let contents_to_save = [];
    for (let i = 0; i < contents.length; i++) {
        const content = contents[i].at;
        if (+contents[i].create_time <= +tikTokAccount.last_saved_time) {
            reach_on_last_video = true;
            break;
        }
        if (!paused_tik_tok_members.includes(content.user_info.uid) && content.sub_type == 1) {
            contents_to_save.push({
                id: content.aweme.aweme_id as string,
                display_url: content.image_url.url_list[0] as string,
                width: content.image_url.width as number,
                height: content.image_url.height as number,
                caption: content.aweme.desc as string,
                owner_t_id: content.user_info.uid as string,
                owner_uid: content.user_info.unique_id as string,
                taken_at: +contents[i].create_time as number,
            });
        }
    }

    if (contents_to_save.length === 0) {
        return {
            total_saved_videos,
            last_saved_time
        };
    }
    //console.log(contents_to_save);
    try {
        // iterate over contents_to_save and save them
        for (let i = 0; i < contents_to_save.length; i++) {
            const content = contents_to_save[i];
            let tikTokMember = await prisma.tikTokMember.findUnique({
                where: {
                    t_id: content.owner_t_id
                },
                include: {
                    userTikTokMembers: true
                }
            });

            if (!tikTokMember && (unlimited || remaining_tik_tok_members > 0)) {
                try {
                    tikTokMember = (await createTiktokMemberForUser(content.owner_uid, user))
                    if (tikTokMember) {
                        tik_tok_members.push({
                            id: tikTokMember.id,
                            t_id: tikTokMember.t_id,
                            uniqueId: tikTokMember.uniqueId
                        });
                        remaining_tik_tok_members--;
                    }
                    if (!unlimited && tikTokMember) {
                        remaining_tik_tok_members--;
                    } else {
                        continue;
                    }
                } catch (error: any) {
                    //console.log(error.message);
                    continue;
                }
            } else if (!tikTokMember && !unlimited && remaining_tik_tok_members == 0) {
                continue;
            }
            //now check a thier linked member or not
            let linkedMember = null;
            if (tikTokMember == null) {
                continue;
            }
            if (!unlimited && remaining_tik_tok_members == 0) {
                if (tik_tok_members.find((m) => m.t_id == tikTokMember?.t_id)) {
                    linkedMember = tikTokMember;
                } else {
                    continue;
                }
            } else {
                let unconnected = true;
                if (!unlimited && remaining_tik_tok_members !== 0) {
                    if (tik_tok_members.find((m) => m.t_id == tikTokMember?.t_id)) {
                        unconnected = false
                        linkedMember = tikTokMember;
                    }
                } else {
                    if (unlimited) {
                        if (tikTokMember.userTikTokMembers.find((social) => social.userId == user.id)) {
                            unconnected = false;
                            linkedMember = tikTokAccount;
                        }
                    }
                }
                if (unconnected) {
                    //connect member to instagram account
                    try {
                        await prisma.userTikTokMember.create({
                            data: {
                                user: { connect: { id: user.id } },
                                tikTokMember: { connect: { id: tikTokMember.id } },
                            },
                        });
                        try {
                            const curent_user = await prisma.user.findUnique({
                                where: {
                                    id: user.id
                                },
                                select: {
                                    id: true,
                                    number_of_tiktok_members: true,
                                }
                            });
                            if (curent_user) {
                                tik_tok_members.push({
                                    id: tikTokMember.id,
                                    t_id: tikTokMember.t_id,
                                    uniqueId: tikTokMember.uniqueId
                                });
                                remaining_tik_tok_members--;
                                await prisma.user.update({
                                    where: {
                                        id: user.id
                                    },
                                    data: {
                                        number_of_tiktok_members: curent_user.number_of_tiktok_members + 1
                                    }
                                });
                            }
                        } catch (error: any) {
                            //console.log(error.message);
                        }
                        linkedMember = tikTokMember;
                        if (!unlimited) {
                            tik_tok_members.push({
                                id: tikTokMember.id,
                                t_id: tikTokMember.t_id,
                                uniqueId: tikTokMember.uniqueId
                            });
                            remaining_tik_tok_members--;
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
            //#endregion

            //save the content
            try {
                //get downloadable url
                let video_url = await getDownloadableUrl(linkedMember.uniqueId, content.id);
                //console.log(video_url);
                if (!video_url) {
                    //console.log('video_url not found');
                    video_url = await getDownloadableUrl2(linkedMember.uniqueId, content.id);
                }

                if (!video_url) {
                    continue;
                }
                let is_thumb = false;
                //get thumbnail
                let thumbnail_detail = await getTumbnail(linkedMember.uniqueId, content.id);
                if (!thumbnail_detail)
                    is_thumb = true;
                // let filesToBeUploaded: CustomType.FileToBeUploaded1 = 
                // }
                const download_video = await downloadFiles({
                    "video": {
                        path: video_url,
                        size: 0,
                        uploaded: false,
                        file_not_found: false
                    },
                    "thumbnail": {
                        path: is_thumb ? thumbnail_detail.thumbnail_url : content.display_url,
                        size: 0,
                        uploaded: false,
                        file_not_found: false
                    }
                });
                //console.log(download_video);
                if (!download_video["video"].uploaded) {
                    //console.log('video not uploaded');
                    continue;
                }
                try {
                    const video = await prisma.video.create({
                        data: {
                            t_id: content.id,
                            link: `https://www.tiktok.com/@${linkedMember.uniqueId}/video/${content.id}`,
                            width: is_thumb ? thumbnail_detail.thumbnail_width : content.width,
                            height: is_thumb ? thumbnail_detail.thumbnail_height : content.height,
                            duration: 0,
                            caption: content.caption,
                            url: download_video["video"].path,
                            display_url: download_video["thumbnail"].path ? download_video["thumbnail"].path : content.display_url,
                            timestamp: content.taken_at,
                            tikTokMember: {
                                connect: {
                                    id: linkedMember.id
                                }
                            },
                            tiktok: {
                                connect: {
                                    id: tikTokAccount.id
                                }
                            },
                            user: {
                                connect: {
                                    id: user.id
                                }
                            },
                        },
                    });
                    if (video) {
                        total_saved_videos++;
                        if (content.taken_at > +tikTokAccount.last_saved_time)
                            last_saved_time = content.taken_at.toString();
                    }
                } catch (error: any) {
                    //console.log(error.message);
                }
            } catch (error: any) {
                //console.log(error.message);
            }
        }
    } catch (error: any) {
        //console.log(error.message);
    }
    //console.log('total_saved_videos', total_saved_videos);
    if (response.has_more == 1 && !reach_on_last_video) {
        return await saveMentionedTikTokVideos(tikTokAccount, user, total_saved_videos, last_saved_time);
    } else {
        try {
            if (last_saved_time !== '')
                try {
                    const t = await prisma.tikTok.update({
                        where: {
                            id: tikTokAccount.id
                        },
                        data: {
                            last_saved_time: last_saved_time
                        }
                    });
                    if (t) {
                        tikTokAccount = t;
                    }
                } catch (error: any) {

                }
        } catch (error: any) {
            //console.log(error.message);
        }
        return {
            total_saved_videos
        }
    }
}

const DownloadTiktokVideo = async (uniqueId: string, content_id: string): Promise<{ url: string, detail: any } | null> => {
    let url = await getDownloadableUrl(uniqueId, content_id);
    if (!url) {
        url = await getDownloadableUrl2(uniqueId, content_id);
    }
    if (!url) {
        return null;
    }
    let detail = await getTumbnail(uniqueId, content_id);
    return {
        url,
        detail: detail
    }
}

const TikTokAPI = {
    getTikTokProfile,
    getTikTokMiniProfile,
    getValidMemberBasedOnSubscription,
    saveMentionedTikTokVideos,
    createTiktokMemberForUser,
    DownloadTiktokVideo,
    downloadFiles
};

export default TikTokAPI;
