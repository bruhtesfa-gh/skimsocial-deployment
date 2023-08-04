import { createTransport } from "nodemailer";

/**
 * MailType is an enum that contains all the types of emails that can be sent
 */
enum MailType {
    WELCOME = 'WELCOME',
    RESET_PASSWORD = 'RESET_PASSWORD',
    VERIFY_EMAIL = 'VERIFY_EMAIL',
    NEW_MESSAGE = 'NEW_MESSAGE',
}
const getEmailAddressBasedOnMailType = (mailType: MailType) => {
    switch (mailType) {
        case MailType.WELCOME:
            return process.env.EMAIL;
        case MailType.RESET_PASSWORD:
            return process.env.EMAIL;
        case MailType.VERIFY_EMAIL:
            return process.env.EMAIL;
        case MailType.NEW_MESSAGE:
            return process.env.EMAIL;
        default:
            return process.env.EMAIL;
    }
}

const getSubjectBasedOnMailType = (mailType: MailType) => {
    switch (mailType) {
        case MailType.WELCOME:
            return 'Welcome to Skim Social';
        case MailType.RESET_PASSWORD:
            return 'Reset your password';
        case MailType.VERIFY_EMAIL:
            return 'Verify your email';
        case MailType.NEW_MESSAGE:
            return 'You have a new message';
        default:
            return 'Skim Social';
    }
}
/**
 * 
 * @param mailType 
 * @param to 
 * @param html 
 * @param subject is optional
 * @returns asyncronous function that sends email
 */
const Send = async (mailType: MailType, to: string, html: string, subject: string = 'SYSTEM') => {
    const transporter = createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    });

    if (subject === 'SYSTEM') {
        subject = getSubjectBasedOnMailType(mailType);
    }

    const mailOptions = {
        from: getEmailAddressBasedOnMailType(mailType),
        to: to,
        subject: subject,
        html: html,
    };
    return await transporter.sendMail(mailOptions);
};
const Mail = {
    Send,
    MailType,
};
export default Mail