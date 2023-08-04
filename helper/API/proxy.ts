import axios from "axios";
import cheerio from "cheerio";
import InstagramAPI from "./instagram";
import fs from "fs";
const proxyurl = `https://www.proxynova.com/proxy-server-list/country-us/`;

interface ProxyInfo {
    ipAddress: string;
    uptime: string;
    speed: string;
    port: string;
}
////console.log(req.headers['x-forwarded-for'] || req.socket.remoteAddress);

const proxyIPs = async (): Promise<ProxyInfo[]> => {
    try {
        const response = await axios.get(proxyurl);
        const $ = cheerio.load(response.data);
        const proxyList: ProxyInfo[] = [];
        function atob(input: string) {
            return Buffer.from(input, 'base64').toString('binary');
        }
        const regex = /^(\d{1,3}\.){3}\d{1,3}:\d+$/;
        // Find the table rows containing the US IP addresses
        $('table#tbl_proxy_list tbody tr').each((index, element) => {
            try {
                const ipscript = $(element).find('td:nth-child(1)').text().trim();
                const ipAddress = eval(ipscript.substring(15, ipscript.length - 1));
                const uptime = $(element).find('td:nth-child(5) > span:first').text().trim().replace('%', '');
                const speed = $(element).find('td:nth-child(4)').text().trim().replace(' ms', '');
                const port = $(element).find('td:nth-child(2)').text().trim();
                //select by class name of uptime-low
                if (regex.test(`${ipAddress}:${port}`)) {
                    proxyList.push({ ipAddress, uptime, speed, port });
                } else {
                    //console.log("fail => " + `${ipAddress}:${port}`)
                }
            } catch (error: any) {
                //console.log(error.message)
            }
        });

        // Sort the proxy list based on uptime (descending) and speed (descending)
        proxyList.sort((a, b) => {
            const uptimeA = parseFloat(a.uptime);
            const uptimeB = parseFloat(b.uptime);
            const speedA = parseFloat(a.speed);
            const speedB = parseFloat(b.speed);

            if (uptimeA === uptimeB) {
                return speedB - speedA;
            } else {
                return uptimeB - uptimeA;
            }
        });

        // Get the top 3 IPs
        return proxyList.slice(0, 3)
    } catch (error: any) {
        //console.log('Error:', error.message);
    }
    return []
}

export default proxyIPs;