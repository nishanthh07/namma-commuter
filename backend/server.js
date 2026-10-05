const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

function getWeatherDescription(code) {
    if (code === undefined || code === null) return { text: "Fair", icon: "🌡️" };
    
    const weatherMap = {
        0: { text: "Sunny / Clear", icon: "☀️" },
        1: { text: "Mainly Clear", icon: "🌤️" },
        2: { text: "Partly Cloudy", icon: "⛅" },
        3: { text: "Overcast / Cloudy", icon: "☁️" },
        45: { text: "Foggy", icon: "🌫️" },
        51: { text: "Light Drizzle", icon: "🌧️" },
        61: { text: "Rain Showers", icon: "🌧️" },
        95: { text: "Thunderstorm", icon: "⛈️" }
    };
    return weatherMap[code] || { text: "Clear / Fair", icon: "🌤️" };
}

app.get('/api/weather', async (req, res) => {
    try {
        const lat = req.query.lat || 12.9716;
        const lon = req.query.lon || 77.5946;
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature`);
        
        const currentWeather = response.data.current_weather;
        const condition = getWeatherDescription(currentWeather.weathercode);
        const hourly = response.data.hourly || {};
        
        res.json({
            temperature: currentWeather.temperature,
            feelsLike: hourly.apparent_temperature?.[0] || currentWeather.temperature,
            windspeed: currentWeather.windspeed,
            humidity: hourly.relativehumidity_2m?.[0] || 65,
            condition: condition.text,
            icon: condition.icon
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch weather' });
    }
});

app.get('/api/search-location', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query required' });

        let geoResponse = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
            const firstWord = query.split(' ')[0];
            geoResponse = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstWord)}&count=5&language=en&format=json`);
        }
        res.json(geoResponse.data.results || []);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

app.post('/api/evaluate-commute', (req, res) => {
    const { home, office, mode } = req.body; 
    
    if (mode === 'delayed') {
        return res.json({
            purpleLineStatus: '🔴 DELAYED: Signal failure at Indiranagar station!',
            greenLineStatus: 'Normal Service (Freq: 5 mins)',
            roadTraffic: '⚠️ Heavy congestion on Old Airport Road due to spillover traffic.',
            waterloggingAlert: '⚠️️ Minor waterlogging near Trinity Circle underpass.',
            constructionNote: 'BMRCL metro work active near Indiranagar 100ft road.',
            
            planA: {
                title: 'Plan A (Delayed): Metro Line Stalled',
                mode: 'Purple Line Halted',
                description: 'Signal outage detected at station block. Commute will be delayed by 25+ mins.',
                eta: '10:05 AM (Late!)',
                confidence: '12%',
                isDelayed: true
            },
            planB: {
                title: 'Plan B: BMTC Feeder Bus + Namma Yatri Auto',
                mode: 'BMTC Feeder #502 + Auto Connection',
                description: 'AI re-routed via surface bypass, skipping congested intersection.',
                busStopName: 'Indiranagar 12th Main BMTC Stop',
                walkDistance: '280 meters',
                walkTime: '4 mins walk',
                busFrequency: 'Next Bus #502 in 6 mins',
                eta: '9:46 AM (On Time!)',
                cost: '₹85',
                bookingUrl: 'https://nammayatri.in/',
                buttonText: '⚡ Instant Auto via Namma Yatri'
            },
            planC: {
                title: 'Plan C: Direct Namma Yatri Cab',
                mode: 'Point-to-Point Direct Cab',
                description: 'Bypasses metro station entirely via Inner Ring Road flyover.',
                busStopName: 'Doorstep Pickup',
                walkDistance: '0 meters',
                walkTime: 'Instant Pickup',
                eta: '9:48 AM',
                cost: '₹220',
                bookingUrl: 'https://nammayatri.in/',
                buttonText: '🚕 Book Namma Yatri Cab Now'
            }
        });
    }

    res.json({
        purpleLineStatus: 'Normal Service (Freq: 4 mins)',
        greenLineStatus: 'Normal Service (Freq: 5 mins)',
        roadTraffic: 'Smooth traffic flow across primary corridors.',
        waterloggingAlert: 'None. All underpasses clear.',
        constructionNote: 'No active roadblocks.',
        
        planA: {
            title: 'Plan A: Direct Metro + Short Walk',
            mode: 'Metro (Purple Line) + Walk',
            description: `Seamless daily transit from ${home || 'Home'} to ${office || 'Office'}. On-time arrival expected.`,
            eta: '9:40 AM',
            confidence: '98%',
            isDelayed: false
        },
        planB: {
            title: 'Plan B (Standby): BMTC Feeder Bus',
            mode: 'BMTC Bus #501C',
            description: 'Standby route configured for bus transit.',
            busStopName: 'Nearest Standby Stop (250m)',
            walkDistance: '250 meters',
            walkTime: '3 mins walk',
            busFrequency: 'Runs every 8 mins',
            eta: '9:43 AM',
            cost: '₹25',
            bookingUrl: 'https://nammayatri.in/',
            buttonText: 'Open Namma Yatri'
        },
        planC: {
            title: 'Plan C (Standby): Direct Auto / Cab',
            mode: 'Namma Yatri Auto / Cab',
            description: 'Standby cab option factoring in current road flow.',
            busStopName: 'Doorstep Pickup',
            walkDistance: '0 meters',
            walkTime: 'Instant Pickup',
            eta: '9:45 AM',
            cost: '₹140',
            bookingUrl: 'https://nammayatri.in/',
            buttonText: 'Open Namma Yatri'
        }
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Namma Commuter backend running on port ${PORT}`));