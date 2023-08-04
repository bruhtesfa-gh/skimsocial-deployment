import prisma from "../prisma/prisma-client";
import InstagramAPI from "../helper/API/instagram";
const saveInstagramMedia = async (pageNumber = 1, pageSize = 10) => {
    const InstagramAccounts = await prisma.instagram.findMany({
        where: {
            active: true,
            connected: true,
        },
        include: {
            user: true,
        },
        take: pageSize,
        skip: pageSize * (pageNumber - 1),
    });
    const storyPromises = [];
    const postPromises = [];
    for (let index = 0; index < InstagramAccounts.length; index++) {
        const InstagramAccount = InstagramAccounts[index];
        storyPromises.push(InstagramAPI.getTaggedStories(InstagramAccount, InstagramAccount.user));
        postPromises.push(InstagramAPI.getTaggedPostsAndReels(InstagramAccount, InstagramAccount.user));
    }
    await Promise.all(storyPromises);
    await Promise.all(postPromises);
    //if we have more instagram account to call method again
    if (InstagramAccounts.length === pageSize) {
        await saveInstagramMedia(pageNumber + 1, pageSize);
    }
};

export default saveInstagramMedia;