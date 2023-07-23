// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: tree;

// User settings
const API_KEY = "your-api-key-goes-here";
const STATIC_LAT_LON = ""; // Set with lat,lon to disable location services
const TAP_HANDLER = "https://www.metoffice.gov.uk/weather/warnings-and-advice/seasonal-advice/pollen-forecast";

const API_URL = "https://api.tomorrow.io/v4";

// Pollen level display attributes. Array index matches tomorrow.io level.
const LEVEL_ATTRIBUTES = [
    {
        label: "None",
        startColor: "8fec74",
        endColor: "77c853",
        textColor: "1f1f1f",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "6de46d",
        sfSymbol: "aqi.low",
    },
    {
        label: "Very Low",
        startColor: "f2e269",
        endColor: "dfb743",
        textColor: "1f1f1f",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "f2e269",
        sfSymbol: "aqi.low",
    },
    {
        label: "Low",
        startColor: "f5ba2a",
        endColor: "d3781c",
        textColor: "1f1f1f",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "f7a021",
        sfSymbol: "aqi.low",
    },
    {
        label: "Medium",
        startColor: "da5340",
        endColor: "bc2f26",
        textColor: "eaeaea",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "f16745",
        sfSymbol: "aqi.medium",
    },
    {
        label: "High",
        startColor: "9c2424",
        endColor: "661414",
        textColor: "f0f0f0",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "f33939",
        sfSymbol: "aqi.high",
    },
    {
        label: "Very High",
        startColor: "76205d",
        endColor: "521541",
        textColor: "f0f0f0",
        darkStartColor: "333333",
        darkEndColor: "000000",
        darkTextColor: "ce4ec5",
        sfSymbol: "aqi.high",
    }
];

// Constructs an SFSymbol from the given symbolName (https://developer.apple.com/sf-symbols/)
function createSymbol(symbolName, fontSize) {
    const symbol = SFSymbol.named(symbolName);
    symbol.applyFont(Font.systemFont(fontSize));
    return symbol;
}

// Get JSON from a local file
function getCachedData(fileName) {
    const fileManager = FileManager.local();
    const cacheDirectory = fileManager.joinPath(fileManager.libraryDirectory(), "pollen-level");
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
    const cacheDirectory = fileManager.joinPath(fileManager.libraryDirectory(), "pollen-level");
    const cacheFile = fileManager.joinPath(cacheDirectory, fileName);

    if (!fileManager.fileExists(cacheDirectory)) {
        fileManager.createDirectory(cacheDirectory);
    }

    const contents = JSON.stringify(data);
    fileManager.writeString(cacheFile, contents);
}

// Returns the index, between 0 and 5, of the pollen level.
function getCurrentPollenIndex(todaysPollen) {
    let currentTime = new Date();

    // Filter the array to remove objects with "endTime" later than the target date
    const currentIntervals = todaysPollen.data.timelines[0].intervals.filter(interval => {
        const startTime = new Date(interval.startTime);
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + 1);

        return startTime < currentTime && endTime >= currentTime;
    });

    // Return the only matching item in the array
    return currentIntervals[0].values.pollenIndex;
}

// Get hourly pollen data for today
async function getTodaysPollen(location) {
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(23, 0, 0, 0);

    const url = `${API_URL}/timelines?location=${location.latitude},${location.longitude}&timesteps=1h&fields=treeIndex,grassIndex,weedIndex&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}&apikey=${API_KEY}`;

    console.log(`GET: ${url}`)
    let req = new Request(url);
    let json = await req.loadJSON();

    let chartData = [];

    // Save the max pollen level to each interval
    json.data.timelines[0].intervals.forEach(interval => {
        let pollenIndex = Math.max(interval.values.grassIndex, interval.values.weedIndex, interval.values.treeIndex);
        interval.values.pollenIndex = pollenIndex;

        // Quick access to the full array of today's levels for charting
        chartData.push(pollenIndex);
    });

    console.log(`Retrieved today's pollen levels for '${location.displayLocation}':`);
    console.log(chartData);
    json.data.timelines[0].chartData = chartData;
    json.data.timelines[0].url = url;

    // TODO: return error ... graph should show error
    return json;
}

// Get current location, or use static lat/lon. Return fallback if error.
async function getCurrentLocation(fallbackLocation) {
    let lat = 0.0, lon = 0.0;

    // Check for a valid lat,long else ask iOS
    if (/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(STATIC_LAT_LON)) {
        console.log("Static location provided");
        ([lat, lon] = STATIC_LAT_LON.split(",").map(s => parseFloat(s)));
    } else {
        try {
            console.log("Looking up current location");
            const loc = await Location.current();
            lat = loc.latitude;
            lon = loc.longitude;    
        } catch (error) {
            console.log(`Error querying location: ${error}`)
            if (fallbackLocation) {
                console.log("Using fallback location instead")
                return fallbackLocation;
            }

            // If no fallbackLocation is set, just throw
            throw error;
        }
    }

    const geo = await Location.reverseGeocode(lat, lon);

    let geoData = {
        latitude: lat,
        longitude: lon,
        neighborhood: geo[0].subLocality,
        city: geo[0].locality,
        region: geo[0].administrativeArea,
        displayLocation: ''
    };

    // Set the displayLocation
    if (geoData.neighborhood && geoData.city) {
        geoData.displayLocation = `${geoData.neighborhood}, ${geoData.city}`;
    } else 
    if (geoData.city) {
        geoData.displayLocation = geoData.city;
    } else {
        geoData.displayLocation = geoData.region;
    }

    console.log(`Current location found: '${geoData.displayLocation}'`);

    return geoData;
}

// LineChart by https://kevinkub.de/ with some alterations
class LineChart {

    constructor(width, height, ymax, values) {
        this.ctx = new DrawContext();
        this.ctx.size = new Size(width, height);
        this.ymax = ymax;
        this.values = values;
    }

    _calculatePath() {
        let maxValue = Math.max(Math.max(...this.values), this.ymax);
        let minValue = Math.min(...this.values);
        let difference = maxValue - minValue;
        let count = this.values.length;
        let step = this.ctx.size.width / (count - 1);
        let points = this.values.map((current, index, all) => {
            let x = step * index;
            let y = this.ctx.size.height - (current - minValue) / difference * this.ctx.size.height;

            // Show x-axis
            y = Math.min(y, this.ctx.size.height - 2);

            return new Point(x, y);
        });
        return this._getSmoothPath(points);
    }

    _getSmoothPath(points) {
        let path = new Path();
        path.move(new Point(0, this.ctx.size.height));
        path.addLine(points[0]);
        for (let i = 0; i < points.length - 1; i++) {
            let xAvg = (points[i].x + points[i + 1].x) / 2;
            let yAvg = (points[i].y + points[i + 1].y) / 2;
            let avg = new Point(xAvg, yAvg);
            let cp1 = new Point((xAvg + points[i].x) / 2, points[i].y);
            let next = new Point(points[i + 1].x, points[i + 1].y);
            let cp2 = new Point((xAvg + points[i + 1].x) / 2, points[i + 1].y);
            path.addQuadCurve(avg, cp1);
            path.addQuadCurve(next, cp2);
        }
        path.addLine(new Point(this.ctx.size.width, this.ctx.size.height));
        path.closeSubpath();
        return path;
    }

    configure(fn) {
        let path = this._calculatePath();
        if (fn) {
            fn(this.ctx, path);
        } else {
            this.ctx.addPath(path);
            this.ctx.fillPath(path);
        }
        return this.ctx;
    }

}

// Returns a chart of the hourly pollen level throughout the day. Chart shows an  
// indicator line at the current time.
function getTodaysChart(data, timeIndicatorColor) {

    let chart = new LineChart(420, 160, 5, data).configure((ctx, path) => {

        // CHART

        ctx.opaque = false;
        ctx.setFillColor(new Color("888888", 0.5));
        ctx.addPath(path);
        ctx.fillPath(path);

        // TIME INDICATOR

        // Get location of time indicator on x-axis
        const currentDate = new Date();
        const hoursPastMidnight = currentDate.getHours() + (currentDate.getMinutes() / 60);
        xpoint = parseInt(ctx.size.width / (24 / hoursPastMidnight));

        let timeIndicator = new Path();
        timeIndicator.move(new Point(xpoint, 0));
        timeIndicator.addLine(new Point(xpoint, ctx.size.height));
        ctx.addPath(timeIndicator);
        ctx.setStrokeColor(timeIndicatorColor, 1);
        ctx.setLineWidth(2);
        ctx.strokePath();

    }).getImage();

    return chart;
}

// Read or refresh cache and return data
async function getAllData() {
    let allData = {
        myLocation: {},
        todaysPollen: {},
        updatedTime: new Date(),
        accessedTime: new Date()
    };

    const cachedData = getCachedData("hourly-data.json");
    const cacheExpiryTime = new Date();
    cacheExpiryTime.setHours(cacheExpiryTime.getHours() - 1);

    if (cachedData) {
        console.log("Cached data found");

        allData.myLocation = cachedData.myLocation;
        allData.todaysPollen = cachedData.todaysPollen;
        allData.updatedTime = new Date(cachedData.updatedTime);

        // Cache age in hours
        const cacheAge = (Date.now() - allData.updatedTime) / (60 * 60 * 1000);

        // Cache is for previous day
        const isOutdated = allData.updatedTime.toDateString() !== new Date().toDateString();

        // Check cache is valid every hour or so
        if (cacheAge > 1.25 || isOutdated) {
            console.log("Time to check cache")
            const currentLocation = await getCurrentLocation(allData.myLocation);
            const isNewLocation = cachedData?.location?.displayLocation !== currentLocation.displayLocation;
            
            // Also refresh if the date has changed or if the cache is too old
            if (isNewLocation || isOutdated || cacheAge > 3) {
                console.log("Refreshing cache");
                allData.myLocation = currentLocation;
                allData.todaysPollen = await getTodaysPollen(allData.myLocation);
                allData.updatedTime = new Date();
            } else {
                console.log("Cache is current, mark as checked");
            }

            cacheData("hourly-data.json", allData);
        }
    } else {
        console.log("No cached data found - building cache")
        allData.myLocation = await getCurrentLocation();
        allData.todaysPollen = await getTodaysPollen(allData.myLocation);
        allData.updatedTime = new Date();

        cacheData("hourly-data.json", allData);
    }

    return allData;
}

// Layout debugging helper
function borderize(stack) {
    stack.borderColor = Color.cyan()
    stack.borderWidth = 1
    return stack;
}

// Start here
async function run() {
    const listWidget = new ListWidget();
    listWidget.useDefaultPadding();

    try {
        if (!API_KEY || API_KEY === "your-api-key-goes-here") {
            throw `You need a tomorrow.io API key for this widget.`;
        }

        // Get all necessary data from cache, location services, tomorrow.io
        const { myLocation, todaysPollen, updatedTime } = await getAllData();

        const pollenIndex = getCurrentPollenIndex(todaysPollen);
        const level = LEVEL_ATTRIBUTES[pollenIndex];

        const startColor = Color.dynamic(new Color(level.startColor), new Color(level.darkStartColor));
        const endColor = Color.dynamic(new Color(level.endColor), new Color(level.darkEndColor));
        const textColor = Color.dynamic(new Color(level.textColor), new Color(level.darkTextColor));

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

        const header = textStack.addText("Pollen Level".toUpperCase());
        header.textColor = textColor;
        header.font = Font.regularSystemFont(11);
        header.minimumScaleFactor = 0.8;

        const pollenLevel = textStack.addText(level.label);
        pollenLevel.textColor = textColor;
        pollenLevel.font = Font.semiboldSystemFont(20);
        pollenLevel.minimumScaleFactor = 0.3;
        pollenLevel.lineLimit = 1;

        headStack.addSpacer();

        const statusSymbol = createSymbol(level.sfSymbol, 20);
        const statusImg = headStack.addImage(statusSymbol.image);
        statusImg.resizable = false;
        statusImg.tintColor = textColor;

        listWidget.addSpacer();

        // CHART STACK

        const chartStack = listWidget.addStack();
        chartStack.centerAlignContent()
        chartStack.addSpacer();

        let chartData = todaysPollen.data.timelines[0].chartData;
        console.log(`Chart data (${chartData.length} entries): ${chartData}`);
        let chart = getTodaysChart(chartData.flatMap(
            i => [i, i, i]), textColor); // Duplicating entries creates step at each hour
        chartStack.addImage(chart);
        
        chartStack.addSpacer();

        listWidget.addSpacer();

        // LOCATION

        const locationText = listWidget.addText(myLocation.displayLocation);
        locationText.textColor = textColor;
        locationText.font = Font.regularSystemFont(10);
        locationText.minimumScaleFactor = 0.5;
        locationText.lineLimit = 1;

        listWidget.addSpacer(2);

        // UPDATED AT

        const updatedTimeText = updatedTime.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
        const updatedText = listWidget.addText(`Updated ${updatedTimeText}`);
        updatedText.textColor = textColor;
        updatedText.font = Font.regularSystemFont(8);
        updatedText.minimumScaleFactor = 0.5;
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
