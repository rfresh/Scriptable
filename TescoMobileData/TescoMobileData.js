// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: broadcast-tower;

// User settings
const MOBILE_NUMBER = "your-mobile-number-no-spaces";
const API_KEY = "your-api-key";
const AUTH_TOKEN = "your-auth-token";
const TAP_HANDLER = "https://www.tescomobile.com/customer/account";

const API_URL = "https://api.tescomobile.com/";

const THEME = {
    startColor: "a0c1b9",
    endColor: "70a0af",
    textColor: "000000",
    gaugeColor: "00539f",
    iconColor: "00539f",
    darkStartColor: "00203d",
    darkEndColor: "000000",
    darkTextColor: "c2e1ff",
    darkGaugeColor: "00539f",
    darkIconColor: "00539f"
};

// Get JSON from a local file
function getCachedData(fileName) {
    const fileManager = FileManager.local();
    const cacheDirectory = fileManager.joinPath(fileManager.libraryDirectory(), "tesco-mobile");
    const cacheFile = fileManager.joinPath(cacheDirectory, fileName);

    if (!fileManager.fileExists(cacheFile)) {
        return undefined;
    }

    const contents = fileManager.readString(cacheFile);
    return JSON.parse(contents);
}

// Write JSON to a local file
function cacheData(fileName, data) {
    const fileManager = FileManager.local();
    const cacheDirectory = fileManager.joinPath(fileManager.libraryDirectory(), "tesco-mobile");
    const cacheFile = fileManager.joinPath(cacheDirectory, fileName);

    if (!fileManager.fileExists(cacheDirectory)) {
        fileManager.createDirectory(cacheDirectory);
    }

    const contents = JSON.stringify(data);
    fileManager.writeString(cacheFile, contents);
}

// Get mobile usage info
async function getMobileUsage(mpn) {

    const url = `${API_URL}/app/accounts/v2/subscriptions/${MOBILE_NUMBER}/allowance_usage_and_charges`;

    console.log(`GET: ${url}`)
    
    let req = new Request(url)
    req.headers = {
        "Cache-Control": "no-cache",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "clientId": "com.tescoMobile.ios.app",
        "Accept-Language": "en-GB,en;q=0.9",
        "clientAppVersion": "6.26.0(5063)",
        "User-Agent": "Tesco%20Mobile/5063 CFNetwork/1474 Darwin/23.0.0",
        "clientOSVersion": "17.0.3",
        "deviceType": "iPhone14,4",
        "clientOSName": "iOS",
        "apiKey": API_KEY,
        "Authorization": `Bearer ${AUTH_TOKEN}`
      }
    
    let json = await req.loadJSON();

    // console.log(json);
    return json;
}

async function getAllData() {
    let allData = {
        mobileUsage: {},
        updatedTime: new Date(),
        accessedTime: new Date()
    };

    const cachedData = getCachedData("usage-data.json");
    const cacheExpiryTime = new Date();
    cacheExpiryTime.setHours(cacheExpiryTime.getHours() - 1);

    if (cachedData) {
        console.log("Cached data found");

        allData.mobileUsage = cachedData.mobileUsage;
        allData.updatedTime = new Date(cachedData.updatedTime);

        // Cache age in hours
        const cacheAge = (Date.now() - allData.updatedTime) / (60 * 60 * 1000);

        // Cache gets refreshed once per interval
        if (cacheAge > 1) {
            console.log("Cache expired, getting usage data")
            allData.mobileUsage = await getMobileUsage(MOBILE_NUMBER);
            allData.updatedTime = new Date(allData.mobileUsage.dates.info_correct_as);
        }

        // Can be just an update to accessedTime to mark as checked
        console.log("Refreshing cache")
        cacheData("usage-data.json", allData);

    } else {
        console.log("No cached data found - building cache")
        allData.mobileUsage = await getMobileUsage(MOBILE_NUMBER);
        allData.updatedTime = new Date(allData.mobileUsage.dates.info_correct_as);

        cacheData("usage-data.json", allData);
    }

    return allData;
}

function getGauge(percentage) {
    function drawArc(ctr, rad, w, deg) {
      bgx = ctr.x - rad
      bgy = ctr.y - rad
      bgd = 2 * rad
      bgr = new Rect(bgx, bgy, bgd, bgd)
    
      canvas.setFillColor(Color.dynamic(new Color(THEME.gaugeColor), new Color(THEME.darkGaugeColor)))
      canvas.setStrokeColor(Color.dynamic(new Color(THEME.endColor), new Color(THEME.darkEndColor)))
      canvas.setLineWidth(w)
      canvas.strokeEllipse(bgr)
    
      for (t = 0; t < deg; t++) {
        rect_x = ctr.x + rad * sinDeg(t) - w / 2
        rect_y = ctr.y - rad * cosDeg(t) - w / 2
        rect_r = new Rect(rect_x, rect_y, w, w)
        canvas.fillEllipse(rect_r)
      }
    }

    function sinDeg(deg) {
      return Math.sin((deg * Math.PI) / 180)
    }
    
    function cosDeg(deg) {
      return Math.cos((deg * Math.PI) / 180)
    }

    const canvas = new DrawContext()
    const canvSize = 260
    const canvTextSize = 50
    
    const canvWidth = 30
    const canvRadius = 100
    
    canvas.opaque = false  
    canvas.size = new Size(canvSize, canvSize)
    canvas.respectScreenScale = true
      
    drawArc(
      new Point(canvSize / 2, canvSize / 2),
      canvRadius,
      canvWidth,
      Math.floor(percentage * 3.6)
    )
  
    const canvTextRect = new Rect(
      0,
      124 - canvTextSize / 2,
      canvSize,
      canvTextSize
    )
    canvas.setTextAlignedCenter()
    canvas.setTextColor(Color.dynamic(new Color(THEME.textColor), new Color(THEME.darkTextColor)))
    canvas.setFont(Font.heavySystemFont(canvTextSize))
    canvas.drawTextInRect(`${percentage}%`, canvTextRect)
  
    return canvas.getImage()
}  

// Layout debugging
function borderize(stack) {
    stack.borderColor = Color.cyan()
    stack.borderWidth = 1
    return stack;
}

async function run() {
    const listWidget = new ListWidget();
    listWidget.useDefaultPadding();

    try {
        if (!MOBILE_NUMBER || MOBILE_NUMBER === "your-mobile-number-no-spaces") {
            throw 'You need to provide your mobile number.';
        }

        if (!API_KEY || API_KEY === "your-api-key") {
            throw `You need to provide a tescomobile.com API key.`;
        }

        if (!AUTH_TOKEN || AUTH_TOKEN === "your-auth-token") {
            throw `You need to provide a tescomobile.com auth token.`;
        }

        // Get all necessary data from cache or Tesco Mobile
        const { mobileUsage, updatedTime } = await getAllData();

        const dataAllowance = mobileUsage.allowances.find(item => item.type === "Data");

        const startColor = Color.dynamic(new Color(THEME.startColor), new Color(THEME.darkStartColor));
        const endColor = Color.dynamic(new Color(THEME.endColor), new Color(THEME.darkEndColor));
        const textColor = Color.dynamic(new Color(THEME.textColor), new Color(THEME.darkTextColor));
        const iconColor = Color.dynamic(new Color(THEME.iconColor), new Color(THEME.darkIconColor));

        // BACKGROUND

        const gradient = new LinearGradient();
        gradient.colors = [startColor, endColor];
        gradient.locations = [0.0, 1];

        listWidget.backgroundGradient = gradient;

        // HEAD STACK

        const headStack = listWidget.addStack();
        headStack.layoutHorizontally();
        headStack.topAlignContent();
        headStack.setPadding(0, 0, 0, 0);

        const textStack = headStack.addStack();
        textStack.layoutVertically();
        textStack.topAlignContent();
        textStack.setPadding(0, 0, 0, 0);

        const header = textStack.addText("Mobile Data".toUpperCase());
        header.textColor = textColor;
        header.font = Font.regularSystemFont(12);
        header.minimumScaleFactor = 0.7;
        header.lineLimit = 1;

        const remaining = (dataAllowance.remaining / 1024).toFixed(2);
        const mobileData = textStack.addText(`${remaining}GB`);
        mobileData.textColor = textColor;
        mobileData.font = Font.semiboldSystemFont(18);
        mobileData.minimumScaleFactor = 0.7;
        mobileData.lineLimit = 1;

        headStack.addSpacer();

        const icon = Image.fromData(Data.fromBase64String("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAAXNSR0IArs4c6QAAACFQTFRFR3BMAFKgAFOiAFKhAFKgAFOhAFKhAFKhAFOiAFKhAFKgDCW0lQAAAAp0Uk5TAOIQsMw5TWQdg1zIliwAAAEQSURBVCiRdVG7bgJBDFyBgFCexCtXnRReKUMXOiIKoDpEQxkor+LRURGKSKnT0a2OEMVfmfHsnQCdcGN7dsce28bcse7hJm1/Dyqvy0vemQjstEnzQl/E80XiMAEWiOefLyI1lxfxWOU/+05gCv4b/DNxY3KoIA2N1hIHcCXt8GNctIJrKvBH8pHUSAHLjk9yJqzWoyBff2rNofyS04/RBLLjw8xJiE6BeYAsPK+p8sPuCYBZ9DYJoBR8NDsdbaqRFoWevDzOW1oUba2vs0HMgAIjGX15IalCYU3oXdQDLe6mLqFrWcZbCl5xfBu6Z3HjY0H1bgJU0xUOXZ6sUJfsrHZ1BlZIz5A5VPaU2WNf2T821oV4fZix7wAAAABJRU5ErkJggg=="));
        const img = headStack.addImage(icon);
        img.resizable = false;
        img.tintColor = iconColor;

        //listWidget.addSpacer();

        // GAUGE STACK

        const gaugeStack = listWidget.addStack();
        gaugeStack.centerAlignContent()
        gaugeStack.addSpacer();

        const percentageRemaining = Math.round((dataAllowance.remaining / dataAllowance.total) * 100);
        const gauge = getGauge(percentageRemaining);
        gaugeStack.addImage(gauge);

        gaugeStack.addSpacer();

        //listWidget.addSpacer();

        // RENEWAL DAYS

        const endDate = new Date(mobileUsage.dates.end_date.replace(/Z$/, 'T00:00:00Z'));
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = Math.ceil((endDate - today) / (1000 * 3600 * 24));

        const updatedText = listWidget.addText(`${days} days to go`);
        updatedText.textColor = textColor;
        updatedText.font = Font.regularSystemFont(8);
        updatedText.minimumScaleFactor = 0.7;
        updatedText.lineLimit = 1;

        // TAP HANDLER

        listWidget.url = TAP_HANDLER;
    } catch (error) {
        console.log(`Could not render widget: ${error}`);

        const errorWidgetText = listWidget.addText(`${error}`);
        errorWidgetText.textColor = Color.red();
        errorWidgetText.textOpacity = 30;
        errorWidgetText.font = Font.regularSystemFont(10);
    }

    if (config.runsInApp) {
        listWidget.presentSmall();
    }

    Script.setWidget(listWidget);
    Script.complete();
}

await run();
