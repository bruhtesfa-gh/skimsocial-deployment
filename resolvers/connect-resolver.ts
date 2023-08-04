import CustomType from "../custom-type/custom-type";
import Excuter from "../middleware/middleware-executer";
import Middlewares, { GQLErrors } from "../middleware/middleware";
import axios from 'axios';
import { PrismaClient } from "@prisma/client";
import { GraphQLResolveInfo } from "graphql";
import jwt from "jsonwebtoken";
import InstagramAPI from "../helper/API/instagram";
import { downloadFiles } from "../helper/FileManagment/downloader";
import Mail from "../helper/API/mail";
import TikTokAPI from "../helper/API/tiktok";
import fs from "fs";

/**
 * get csrf token by sending get request to https://www.instagram.com/account/login/
 * and parse csrf token from response
 * @returns response object
 */
const getCsrfToken = async (): Promise<CustomType.CsrfTokenResponse> => {
    try {
        //send get response to https://www.instagram.com/account/login/
        //and set nessary headers
        const response = await axios({
            method: 'get',
            url: 'https://www.instagram.com/accounts/login/',
            headers: {
                'authority': 'www.instagram.com',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
            }
        });
        const html = response.data as string;
        let csrftoken: string = '';
        csrftoken = html.substring(html.indexOf("csrf_token"), html.indexOf('viewer')).match(/[a-zA-Z0-9]+/gi)![2] as string;
        if (!csrftoken) {
            //console.log('csrftoken not found in first try')
            csrftoken = html.substring(html.lastIndexOf("csrf_token"), html.lastIndexOf('viewer')).match(/[a-zA-Z0-9]+/gi)![2] as string;
        }
        //if csrf is found return success and token
        if (csrftoken) {
            return {
                success: true,
                token: csrftoken,
                error: false,
                message: 'csrf token found'
            };
        }
        //if csrf is not found return error

    } catch (error: any) {
        console.error(error);
    }

    return {
        success: false,
        token: '',
        error: true,
        message: 'csrf token not found'
    };
}
const logInToInstagram = async (username: string, password: string): Promise<CustomType.InstagramLoginResponse> => {
    return new Promise(async (resolve, reject) => {
        try {
            //get csrf token
            const csrfTokenResponse = await getCsrfToken();
            if (!csrfTokenResponse.success) {
                return resolve({
                    success: false,
                    error: true,
                    message: csrfTokenResponse.message,
                    data: {
                        cookies: [''],
                        cookie: '',
                        pk: ''
                    }
                });
            }
            //get current time in seconde
            const time = Math.floor(Date.now() / 1000);
            //send post request to https://www.instagram.com/accounts/login/ajax/
            //and set nessary headers
            const curl = `curl -X POST 'https://www.instagram.com/accounts/login/ajax/' \
            -H 'Content-Type: application/x-www-form-urlencoded' \
            -H 'x-csrftoken: ${csrfTokenResponse.token}' \
            -H 'x-requested-with: XMLHttpRequest' \
            -H 'referer: https://www.instagram.com/accounts/login/' \
            -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36' \
            --data-urlencode 'username=username' \
            --data-urlencode 'enc_password=#PWD_INSTAGRAM_BROWSER:0:${time}:${password}' \
            --data-urlencode 'queryParams={}' \
            --data-urlencode 'optIntoOneTap=false'`
            const response = await axios({
                method: 'post',
                url: 'https://www.instagram.com/accounts/login/ajax/',
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "x-csrftoken": csrfTokenResponse.token,
                    "x-requested-with": "XMLHttpRequest",
                    "referer": "https://www.instagram.com/accounts/login/",
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
                },
                data: {
                    username: username,
                    enc_password: `#PWD_INSTAGRAM_BROWSER:0:${time}:${password}`,
                    queryParams: {},
                    optIntoOneTap: "false",
                }
            });
            //console.log(response.data)
            //if login is successfull return success and cookies
            if (response.data.authenticated) {
                return resolve({
                    success: true,
                    error: false,
                    message: 'login successfull',
                    data: {
                        cookies: response.headers['set-cookie'] as [string],
                        cookie: response.headers['set-cookie']!.map(cookie => cookie.split(';')[0]).join('; '),
                        pk: response.data.userId
                    }
                });
            }
            //if login is not successfull return error
            return resolve({
                success: false,
                error: true,
                message: 'login failed',
                data: {
                    cookies: [''],
                    cookie: '',
                    pk: ''
                }
            });
        } catch (error: any) {
            console.error(error.message);
            return resolve({
                success: false,
                error: true,
                message: 'login failed',
                data: {
                    cookies: [''],
                    cookie: '',
                    pk: ''
                }
            });
        }
    });
}
export default {
    connectToInstagram: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.Authenticate, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'connectToInstagram')
        if (_Error)
            return _Error;
        const { username, password } = args.json_input;
        //check if the user has instagram account with the same username 
        const instagram = await prisma.instagram.findUnique({
            where: {
                username: username as string
            }
        });
        if (instagram) {
            //check if the instagram account is the authuser's account
            if (instagram.userId === auth.id) {
                //check if the instagram account is connected
                if (instagram.connected) {
                    return {
                        success: false,
                        message: 'This instagram account is already connected'
                    }
                } else {
                    //connect to instagram
                    const loginResponse = await logInToInstagram(username, password);
                    if (loginResponse.success) {
                        //update instagram account
                        const updatedInstagram = await prisma.instagram.update({
                            where: {
                                username: username
                            },
                            data: {
                                connected: true,
                                cookies: loginResponse.data.cookies,
                                cookie: loginResponse.data.cookie
                            }
                        });
                        if (updatedInstagram) {
                            return {
                                success: true,
                                message: 'Connected successfully'
                            }
                        } else {
                            return {
                                success: false,
                                message: 'Unknown error'
                            }
                        }
                    } else {
                        return {
                            success: false,
                            message: loginResponse.message
                        }
                    }
                }
            } else {
                //return unautherized error
                return GQLErrors.UNAUTHORIZED;
            }
        }
        const cookies = [
            'csrftoken=YsM7aBI4hT8SJGwgsjppfI4h4YOBef6s; Domain=.instagram.com; expires=Wed, 05-Jun-2024 11:21:44 GMT; Max-Age=31449600; Path=/; Secure',
            'rur="NCG\\05459232070850\\0541717672904:01f79df78356b77714fa29750178a4d50033e038d495231b707689c8d9d90d35b1f90a0c"; Domain=.instagram.com; HttpOnly; Path=/; SameSite=Lax; Secure',
            'mid=ZIBoRQALAAGIZx9f-CFpASw40tzh; Domain=.instagram.com; expires=Fri, 06-Jun-2025 11:21:44 GMT; Max-Age=63072000; Path=/; Secure',
            'ds_user_id=59232070850; Domain=.instagram.com; expires=Tue, 05-Sep-2023 11:21:44 GMT; Max-Age=7776000; Path=/; Secure',
            'ig_did=1F28B843-EBBC-4E97-8B5E-6403BD62151F; Domain=.instagram.com; expires=Fri, 06-Jun-2025 11:21:44 GMT; HttpOnly; Max-Age=63072000; Path=/; Secure',
            'sessionid=59232070850%3AcyJVEGYaje2VzC%3A29%3AAYfgdMQosY3QLCcFA5IqaMOzYQX8QA8iRLOJaqg5Xg; Domain=.instagram.com; expires=Thu, 06-Jun-2024 11:21:44 GMT; HttpOnly; Max-Age=31536000; Path=/; Secure'
        ];
        const loginResponse = await logInToInstagram(username, password);
        // const loginResponse = {
        //     success: true,
        //     error: false,
        //     message: 'login successfull',
        //     data: {
        //         cookies: cookies,
        //         cookie: cookies.map(cookie => cookie.split(';')[0]).join('; '),
        //         pk: "59232070850"
        //     }
        // };

        //console.log(loginResponse);
        if (loginResponse.success) {
            const pk = loginResponse.data.pk;
            //get profile info by using pk
            let profileInfo = null;
            try {
                profileInfo = await InstagramAPI.getProfileInfoById(pk, loginResponse.data.cookie);
                let default_profile = `https://ui-avatars.com/api/?uppercase=true&name=${profileInfo.user?.full_name}&length=1&bold=true&rounded=true&font-size=0.5&background=d62976&color=ffffff`;
                try {
                    const download_profile_picture = await downloadFiles(
                        {
                            "profile": {
                                path: profileInfo.user.profile_pic_url,
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
                const InstagramAccount = await prisma.instagram.create({
                    data: {
                        username: (username as string),
                        password: jwt.sign({ password }, process.env.INSTA_PASSWORD_SECRET as string),
                        cookies: loginResponse.data.cookies,
                        cookie: loginResponse.data.cookie,
                        user: {
                            connect: {
                                id: auth.id
                            }
                        },
                        full_name: profileInfo.user?.full_name,
                        pk: pk,
                        followers: profileInfo.user?.follower_count,
                        following: profileInfo.user?.following_count,
                        profile_pic_url: default_profile
                    },
                    include: {
                        user: true
                    }
                });

                if (InstagramAccount) {
                    InstagramAPI.getTaggedStories(InstagramAccount, InstagramAccount.user).then((story_result) => {
                        //send notification email for the user that saving done
                        //send email
                        InstagramAPI.getTaggedPostsAndReels(InstagramAccount, InstagramAccount.user).then((post_result) => {
                            //send notification email for the user that saving done
                            //send email
                            const htmlstory = `
                            <div style="background-color: #f5f5f5; padding: 20px;">
                                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                    <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                    <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                    <p style="text-align: center;">Your stories are saved successfully</p>
                                    <p style="text-align: center;">We saved ${story_result.total_saved_stories} stories</p>
                                </div>
                                </div>Best regards,<br>Wild Social Team</div>
                            </div>
                            `;
                            Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, htmlstory, 'Saving done').then((result) => {
                                //console.log(result);
                            }).catch((err) => {
                                //console.log(err);
                            });
                            const html = `
                                    <div style="background-color: #f5f5f5; padding: 20px;">
                                        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                            <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                            <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                            <p style="text-align: center;">Your posts and reels are saved successfully</p>
                                            <p style="text-align: center;">We saved ${post_result.total_saved_posts} posts and ${post_result.total_saved_reels} reels</p>
                                        </div>
                                        </div>Best regards,<br>Wild Social Team</div>
                                    </div>
                                    `;
                            Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving done').then((result) => {
                                //console.log(result);
                            }).catch((err) => {
                                //console.log(err);
                            });
                        }).catch((err) => {
                            //console.log(err);
                        });
                    }).catch((err) => {
                        //console.log(err);
                        InstagramAPI.getTaggedPostsAndReels(InstagramAccount, InstagramAccount.user).then((result) => {
                            //send notification email for the user that saving done
                            //send email
                            const html = `
                                <div style="background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                        <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                        <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                        <p style="text-align: center;">Your posts and reels are saved successfully</p>
                                    </div>
                                    </div>Best regards,<br>Wild Social Team</div>
                                </div>
                                `;
                            Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving done').then((result) => {
                                //console.log(result);
                            }).catch((err) => {
                                //console.log(err);
                            });
                        }).catch((err) => {
                            //console.log(err);
                            const html = `
                                <div style="background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">    
                                        <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                        <h2 style="text-align: center; color: #d62976;">Saving Faild</h2>
                                        <p style="text-align: center;">Your posts and reels are not saved successfully</p>
                                        <p style="text-align: center;">Please check your instagram account is connected</p>
                                    </div>
                                    </div>Best regards,<br>Wild Social Team</div>
                                </div>
                                `;
                            Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving Faild').then((result) => {
                                //console.log(result);
                            }).catch((err) => {
                                //console.log(err);
                            });
                        });
                    });
                    return {
                        success: true,
                        message: 'Connected successfully'
                    }
                } else {
                    return GQLErrors.SERVER_ERROR;
                }
            } catch (error: any) {
                return GQLErrors.SERVER_ERROR;
            }
        }
        return {
            success: false,
            message: loginResponse.message
        }
    },
    connectToInstagramWithCookies: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'connectToInstagramWithCookies')
        if (_Error)
            return _Error;
        const { cookies, userID, username, width, height }: { cookies: string[], userID: string, username: string, width: number, height: number } = args.json_input;
        const cookie = cookies.map(c => c.split(';')[0]).join('; ');
        const pk = cookie.split('ds_user_id=')[1].split(';')[0];

        const user = await prisma.user.findUnique({
            where: {
                id: userID as string
            },
            include: {
                instagrams: {
                    where: {
                        pk: pk
                    },
                    include: {
                        posts: true,
                        reels: true,
                        stories: true
                    }
                }
            }
        });
        const browser = {
            headers: {
                'accept-encoding': req.headers['accept-encoding'],
                'accept-language': req.headers['accept-language'],
                'sec-ch-ua': req.headers['sec-ch-ua'],
                'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'],
                'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'],
                'sec-fetch-dest': req.headers['sec-fetch-dest'],
                'sec-fetch-mode': req.headers['sec-fetch-mode'],
                'user-agent': req.headers['user-agent'],
            },
            screen: {
                width: width,
                height: height
            }
        }
        ////console.log(user);

        if (!user) {
            return {
                success: false,
                message: 'Please login to your skim social account first',
                instagram: null
            };
        }

        //test response
        // if (user.instagrams.length > 0 && user.instagrams[0].connected) {
        //     return {
        //         success: false,
        //         message: `This instagram account with username of ${user.instagrams[0].username} is already connected to your account`,
        //         instagram: null
        //     };
        // } else {
        // }
        const instagram = await prisma.instagram.findUnique({
            where: {
                pk: pk
            },
            include: {
                user: {
                    select: {
                        id: true

                    }
                }
            }
        });

        if (instagram) {
            if (instagram.user.id !== userID) {
                return {
                    success: false,
                    message: `This instagram account with username of ${instagram.username} is already connected to another user`,
                    instagram: null
                };
            }
        }

        let profileInfo = null;
        try {
            profileInfo = (await InstagramAPI.getProfileInfoByUsername(username, cookie, browser));
            //console.log(profileInfo);
            if (profileInfo.status !== 'ok') {
                return {
                    success: false,
                    message: `some error occured while connecting to instagram please try again later.
                              It is recommeded that bing on home page while connecting to instagram`,
                };
            }
            profileInfo = profileInfo.data.user;
            let default_profile = `https://ui-avatars.com/api/?uppercase=true&name=${profileInfo?.full_name}&length=1&bold=true&rounded=true&font-size=0.5&background=d62976&color=ffffff`;
            try {
                const download_profile_picture = await downloadFiles(
                    {
                        "profile": {
                            path: profileInfo.profile_pic_url,
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
            const InstagramAccount = user.instagrams.length > 0 ? await prisma.instagram.update({
                where: {
                    pk: pk
                },
                data: {
                    connected: true,
                    cookies: cookies,
                    cookie: cookie,
                    biography: profileInfo?.biography,
                    profile_pic_url: default_profile,
                    followers: profileInfo?.edge_followed_by.count,
                    following: profileInfo?.edge_follow.count,
                    full_name: profileInfo?.full_name,
                    browser: browser
                },
                include: {
                    user: true
                }
            }) : await prisma.instagram.create({
                data: {
                    username: username,
                    password: '',
                    cookies: cookies,
                    cookie: cookie,
                    biography: profileInfo?.biography,
                    user: {
                        connect: {
                            id: userID
                        }
                    },
                    full_name: profileInfo?.full_name,
                    pk: pk,
                    followers: profileInfo?.edge_followed_by.count,
                    following: profileInfo?.edge_follow.count,
                    profile_pic_url: default_profile,
                    browser: browser
                },
                include: {
                    user: true
                }
            });

            if (InstagramAccount !== null) {
                InstagramAPI.getTaggedStories(InstagramAccount, InstagramAccount.user).then((story_result) => {
                    //send notification email for the user that saving done
                    //send email
                    InstagramAPI.getTaggedPostsAndReels(InstagramAccount, InstagramAccount.user).then((post_result) => {
                        //send notification email for the user that saving done
                        //send email
                        const htmlstory = `
                        <div style="background-color: #f5f5f5; padding: 20px;">
                            <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                <p style="text-align: center;">Your stories are saved successfully</p>
                                <p style="text-align: center;">We saved ${story_result.total_saved_stories} stories</p>
                            </div>
                            </div>Best regards,<br>Wild Social Team</div>
                        </div>
                        `;
                        Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, htmlstory, 'Saving done').then((result) => {
                            //console.log(result);
                        }).catch((err) => {
                            //console.log(err);
                        });
                        const html = `
                                <div style="background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                        <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                        <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                        <p style="text-align: center;">Your posts and reels are saved successfully</p>
                                        <p style="text-align: center;">We saved ${post_result.total_saved_posts} posts and ${post_result.total_saved_reels} reels</p>
                                    </div>
                                    </div>Best regards,<br>Wild Social Team</div>
                                </div>
                                `;
                        Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving done').then((result) => {
                            //console.log(result);
                        }).catch((err) => {
                            //console.log(err);
                        });
                    }).catch((err) => {
                        //console.log(err);
                    });
                }).catch((err) => {
                    //console.log(err);
                    InstagramAPI.getTaggedPostsAndReels(InstagramAccount, InstagramAccount.user).then((result) => {
                        //send notification email for the user that saving done
                        //send email
                        const html = `
                            <div style="background-color: #f5f5f5; padding: 20px;">
                                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                    <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                    <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                    <p style="text-align: center;">Your posts and reels are saved successfully</p>
                                </div>
                                </div>Best regards,<br>Wild Social Team</div>
                            </div>
                            `;
                        Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving done').then((result) => {
                            //console.log(result);
                        }).catch((err) => {
                            //console.log(err);
                        });
                    }).catch((err) => {
                        //console.log(err);
                        const html = `
                            <div style="background-color: #f5f5f5; padding: 20px;">
                                <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">    
                                    <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                    <h2 style="text-align: center; color: #d62976;">Saving Faild</h2>
                                    <p style="text-align: center;">Your posts and reels are not saved successfully</p>
                                    <p style="text-align: center;">Please check your instagram account is connected</p>
                                </div>
                                </div>Best regards,<br>Wild Social Team</div>
                            </div>
                            `;
                        Mail.Send(Mail.MailType.NEW_MESSAGE, InstagramAccount.user.email, html, 'Saving Faild').then((result) => {
                            //console.log(result);
                        }).catch((err) => {
                            //console.log(err);
                        });
                    });
                });
                return {
                    success: true,
                    message: 'Connected successfully',
                    instagram: InstagramAccount
                }
            } else {
                return GQLErrors.SERVER_ERROR;
            }
        } catch (error: any) {
            return {
                success: false,
                message: 'Cookies are not correct',
                instagram: null
            };
        }
    },
    connectToTikTokWithCookies: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput], parent, args, { prisma, auth, req, res }, info, 'connectToTikTokWithCookies')
        if (_Error)
            return _Error;
        const { cookies, userID, url_param, device_id }: { cookies: string[], userID: string, url_param: string, device_id: string } = args.json_input;
        const browser = {
            headers: {
                'accept-encoding': req.headers['accept-encoding'],
                'accept-language': req.headers['accept-language'],
                'sec-ch-ua': req.headers['sec-ch-ua'],
                'sec-ch-ua-mobile': req.headers['sec-ch-ua-mobile'],
                'sec-ch-ua-platform': req.headers['sec-ch-ua-platform'],
                'sec-fetch-dest': req.headers['sec-fetch-dest'],
                'sec-fetch-mode': req.headers['sec-fetch-mode'],
                'user-agent': req.headers['user-agent'],
            },
            param: url_param,
            device_id: device_id,
        }

        //authenticate user
        const user = await prisma.user.findUnique({
            where: {
                id: userID as string
            },
            select: {
                id: true,
            }
        });
        if (!user) {
            return {
                success: false,
                message: 'Please login to your skim social account first',
                tiktok: null
            };
        }
        ////console.log(cookies);
        const TikTokMiniProfile = await TikTokAPI.getTikTokMiniProfile(cookies, browser);
        //console.log(TikTokMiniProfile);
        if (!TikTokMiniProfile)
            return {
                success: false,
                message: 'Please login to your tiktok account, we could not get your profile info',
                tiktok: null
            };
        try {
            const TikTokAccount = await prisma.tikTok.findUnique({
                where: {
                    t_id: TikTokMiniProfile.user_id
                },
                include: {
                    user: true
                }
            });

            if (TikTokAccount) {
                //check if tiktok account is connected to another user
                if (TikTokAccount.user.id !== userID) {
                    return {
                        success: false,
                        message: `This tiktok account with username of ${TikTokAccount.uniqueId} is already connected to another user`,
                        tiktok: null
                    };
                }
                try {
                    //update tiktok account
                    const UpdatedTikTokAccount = await prisma.tikTok.update({
                        where: {
                            t_id: TikTokMiniProfile.user_id
                        },
                        data: {
                            cookies: cookies,
                            cookie: cookies.map(cookie => cookie.split(';')[0]).join('; '),
                            browser: browser,
                            profilePic: TikTokMiniProfile.avatar_url,
                            connected: true,
                        }
                    });

                    if (UpdatedTikTokAccount) {
                        TikTokAPI.saveMentionedTikTokVideos(UpdatedTikTokAccount, TikTokAccount.user).then((result) => {
                            if (result.total_saved_videos !== undefined || result.total_saved_videos !== null) {
                                //send notification email for the user that saving done
                                //send email
                                const html = `
                                    <div style="background-color: #f5f5f5; padding: 20px;">
                                        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                            <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                            <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                            <p style="text-align: center;">Your videos are saved successfully</p>
                                            <p style="text-align: center;">We saved ${result.total_saved_videos} videos</p>
                                        </div>
                                        </div>Best regards,<br>Wild Social Team</div>
                                    </div>
                                    `;
                                Mail.Send(Mail.MailType.NEW_MESSAGE, TikTokAccount.user.email, html, 'Saving done').then((result) => {
                                    ////console.log(result);
                                }).catch((err) => {
                                    //console.log(err);
                                });
                            }
                        }).catch((err) => { });
                        return {
                            success: true,
                            message: 'Connected successfully',
                            tiktok: UpdatedTikTokAccount
                        }
                    } else {
                        return {
                            success: false,
                            message: 'Unknown error, please try again',
                            tiktok: null
                        };
                    }
                } catch (error: any) {
                    return GQLErrors.SERVER_ERROR;
                }
            } else {
                const profileInfo = await TikTokAPI.getTikTokProfile(TikTokMiniProfile.username);
                if (!profileInfo) {
                    return GQLErrors.SERVER_ERROR;
                }
                if (profileInfo.UserPage.uniqueId !== TikTokMiniProfile.username) {
                    return {
                        success: false,
                        message: 'Please login to your tiktok account, we could not get your profile info',
                        tiktok: null
                    };
                }
                try {
                    //create tiktok account
                    const TikTokAccount = await prisma.tikTok.create({
                        data: {
                            t_id: TikTokMiniProfile.user_id,
                            uniqueId: TikTokMiniProfile.username,
                            cookies: cookies,
                            cookie: cookies.map(cookie => cookie.split(';')[0]).join('; '),
                            profilePic: TikTokMiniProfile.avatar_url,
                            connected: true,
                            followerCount: profileInfo.UserModule.stats[TikTokMiniProfile.username].followerCount,
                            followingCount: profileInfo.UserModule.stats[TikTokMiniProfile.username].followingCount,
                            heartCount: profileInfo.UserModule.stats[TikTokMiniProfile.username].heartCount,
                            videoCount: profileInfo.UserModule.stats[TikTokMiniProfile.username].videoCount,
                            nickname: profileInfo.UserModule.users[TikTokMiniProfile.username].nickname,
                            bio: profileInfo.UserModule.users[TikTokMiniProfile.username].signature,
                            secUid: profileInfo.UserModule.users[TikTokMiniProfile.username].secUid,
                            country_code: profileInfo.UserModule.users[TikTokMiniProfile.username].region,
                            browser: browser,
                            user: {
                                connect: {
                                    id: userID
                                }
                            }
                        },
                        include: {
                            user: true
                        }
                    });
                    if (TikTokAccount) {
                        TikTokAPI.saveMentionedTikTokVideos(TikTokAccount, TikTokAccount.user).then((result) => {
                            if (result.total_saved_videos) {
                                //send notification email for the user that saving done
                                //send email
                                const html = `
                                    <div style="background-color: #f5f5f5; padding: 20px;">
                                        <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                                            <h1 style="text-align: center; color: #d62976;">Wild Social</h1>
                                            <h2 style="text-align: center; color: #d62976;">Saving done</h2>
                                            <p style="text-align: center;">Your videos are saved successfully</p>
                                            <p style="text-align: center;">We saved ${result.total_saved_videos} videos</p>
                                        </div>
                                        </div>Best regards,<br>Wild Social Team</div>
                                    </div>
                                    `;
                                Mail.Send(Mail.MailType.NEW_MESSAGE, TikTokAccount.user.email, html, 'Saving done').then((result) => {
                                    ////console.log(result);
                                }).catch((err) => {
                                    //console.log(err);
                                });
                            }
                        }).catch((err) => { });
                        return {
                            success: true,
                            message: 'Connected successfully',
                            tiktok: TikTokAccount
                        }
                    }
                    return {
                        success: false,
                        message: 'Unknown error, please try again',
                        tiktok: null
                    }
                } catch (error: any) {
                    ////console.log(error.message);
                    return GQLErrors.SERVER_ERROR;
                }
            }
        } catch (error: any) {
            return GQLErrors.SERVER_ERROR;
        }
    },
    connectToTiktok: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'connectToTiktok')
        if (_Error)
            return _Error;
        return true;
    },
    disconnectFromTiktok: async (parent: any, args: any, { prisma, auth, req, res }: CustomType.Context, info: GraphQLResolveInfo) => {
        let _Error = await Excuter([Middlewares.DeletedFilterParseJson, Middlewares.ValidateJsonInput, Middlewares.Authenticate], parent, args, { prisma, auth, req, res }, info, 'disconnectFromTiktok')
        if (_Error)
            return _Error;
        return true;
    },
}