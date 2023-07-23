# Pollen Level

## About

This widget displays the local pollen level on the home screen of iOS or iPadOS devices. It is displayed via the [Scriptable](https://scriptable.app) app. The widget obtains data from [tomorrow.io APIs](https://app.tomorrow.io/home).

## How to use

To use this widget, make a new script inside Scriptable and paste in the contents of `PollenLevel.js`. 

You can run the script from within the app, or add a new **small** widget on your home screen, set it to Scriptable, and choose the script by tapping and holding on the widget, choosing Edit Widget, and choosing the script by tapping on the Script field. 

You will require an API key to obtain data from tomorrow.io. If you don't have one, you'll need to request one from tomorrow.io and enter your key in the API_KEY variable in the script.

The widget is designed to use Location Services to find the pollen level for your location. If that's not working reliably, you can specify a static location by tapping and holding on the widget, choosing Edit Widget, and then entering the latitude and longitude (separated by comma) in the STATIC_LAT_LON variable.
