// ==========================================
// 1. ระบบเวลาและวันที่ (Real-time Clock)
// ==========================================
function updateTime() {
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('clock-display').textContent = `${hours}:${minutes}`;

    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-GB', options);
    document.querySelector('.date-display').textContent = dateStr;
}
setInterval(updateTime, 1000); 
updateTime(); 


// ==========================================
// 2. ระบบแผนที่ (Leaflet + CartoDB Dark Mode)
// ==========================================
const defaultLat = 13.7563;
const defaultLon = 100.5018;

const map = L.map('map', { zoomControl: false }).setView([defaultLat, defaultLon], 14);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap & CartoDB',
    maxZoom: 19
}).addTo(map);

const customIcon = L.divIcon({
    className: 'custom-icon',
    html: '<div class="pulse-marker"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8] 
});

let userMarker = L.marker([defaultLat, defaultLon], { icon: customIcon }).addTo(map);


// ==========================================
// 3. ระบบระบุตำแหน่ง (GPS) & ดึงสภาพอากาศ
// ==========================================
function fetchWeatherData(lat, lon) {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`;

    Promise.all([fetch(weatherUrl), fetch(aqiUrl)])
        .then(async ([weatherRes, aqiRes]) => {
            const weatherData = await weatherRes.json();
            const aqiData = await aqiRes.json();

            const temp = Math.round(weatherData.current_weather.temperature);
            const isDay = weatherData.current_weather.is_day; 
            const pm25 = Math.round(aqiData.current.pm2_5);

            document.getElementById('weather-text').textContent = `Local, ${temp}°C | PM2.5: ${pm25}`;
            
            const iconElement = document.getElementById('weather-icon');
            if(iconElement) {
                iconElement.textContent = isDay ? 'partly_cloudy_day' : 'partly_cloudy_night';
            }
        })
        .catch(error => {
            console.error("Error fetching weather:", error);
            const weatherText = document.getElementById('weather-text');
            if(weatherText) weatherText.textContent = "Weather offline";
        });
}

let watchId = null;
let lastWeatherFetch = 0; 
let lastLat = 0;
let lastLon = 0;

function startLocationTracking() {
    if ('geolocation' in navigator) {
        const geoOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const now = Date.now();
                
                const distanceMoved = Math.abs(lat - lastLat) + Math.abs(lon - lastLon);

                if (distanceMoved > 0.00005 || lastLat === 0) { 
                    map.panTo([lat, lon], { animate: true, duration: 1 });
                    userMarker.setLatLng([lat, lon]);
                    lastLat = lat;
                    lastLon = lon;
                }
                
                if (now - lastWeatherFetch > 300000) {
                    fetchWeatherData(lat, lon);
                    lastWeatherFetch = now;
                    console.log("Weather Updated");
                }
            },
            (error) => {
                console.warn("GPS Error:", error.message);
                if(lastWeatherFetch === 0) {
                    fetchWeatherData(defaultLat, defaultLon);
                    lastWeatherFetch = Date.now();
                }
            },
            geoOptions
        );
    } else {
        fetchWeatherData(defaultLat, defaultLon);
    }
}

startLocationTracking();


// ==========================================
// 4. ระบบเปิดแอป (App Launcher / Deep Links สำหรับ Android)
// ==========================================
function openApp(appName) {
    console.log("Opening App: ", appName);
    switch(appName) {
        case 'settings':
            // เปิดหน้าตั้งค่า (Settings) รวมของเครื่อง
            window.location.href = 'intent://#Intent;action=android.settings.SETTINGS;end';
            break;
        case 'wifi':
            // เปิดหน้าตั้งค่า Wi-Fi โดยตรง
            window.location.href = 'intent://#Intent;action=android.settings.WIFI_SETTINGS;end';
            break;
        case 'gmail':
            window.location.href = 'intent://#Intent;package=com.google.android.gm;end';
            break;
        case 'maps':
            // เปิด Google Maps แบบแอปเต็ม
            window.location.href = 'intent://#Intent;package=com.google.android.apps.maps;end';
            break;
        case 'youtube':
            window.location.href = 'intent://#Intent;package=com.google.android.youtube;end';
            break;
        case 'ytmusic':
            window.location.href = 'intent://#Intent;package=com.google.android.apps.youtube.music;end';
            break;
        case 'evernote':
            window.location.href = 'intent://#Intent;package=com.evernote;end';
            break;
        case 'discord':
            window.location.href = 'intent://#Intent;package=com.discord;end';
            break;
        default:
            console.warn("App link not configured yet.");
    }
}


// ==========================================
// 5. ระบบสลับโหมดสี (Day / Night)
// ==========================================
function toggleTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    
    const buttons = document.querySelectorAll('.theme-mode');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase() === mode) {
            btn.classList.add('active');
        }
    });

    if (mode === 'light') {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    } else {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    }
}


// ==========================================
// 6. ระบบ Google Calendar (ล่วงหน้า 3 วัน & รวม 4 IDs)
// ==========================================
const CALENDAR_API_KEY = 'AIzaSyDps0FZLP_2CZRvG_RBJjosOcBkZeQ0rrE';

const CALENDAR_IDS = [
    'tor@9togethers.com',
    '9togethers.com_l1g8v8dgc1f8rdknqj30de5e38@group.calendar.google.com',
    'tor@marvelic.co.th',
    'marvelic.co.th_baa7hqicnkfln28t74oh307pvs@group.calendar.google.com'
];

async function fetchCalendarEvents() {
    // ตั้งค่าเวลาเริ่มต้น (ตอนนี้)
    const now = new Date();
    const timeMinStr = now.toISOString();

    // ตั้งค่าเวลาสิ้นสุด (บวกไปอีก 3 วัน เวลา 23:59:59)
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 3);
    maxDate.setHours(23, 59, 59, 999);
    const timeMaxStr = maxDate.toISOString();

    let allEvents = [];
    const taskList = document.querySelector('.task-list');

    try {
        const fetchPromises = CALENDAR_IDS.map(id => {
            // เพิ่ม &timeMax ลงใน URL เพื่อให้ Google กรองข้อมูลให้ดึงมาแค่ 3 วัน
            const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?key=${CALENDAR_API_KEY}&timeMin=${timeMinStr}&timeMax=${timeMaxStr}&orderBy=startTime&singleEvents=true&maxResults=10`;
            return fetch(url).then(res => res.json());
        });

        const results = await Promise.all(fetchPromises);
        
        results.forEach(data => {
            if (data.items) {
                allEvents = allEvents.concat(data.items);
            }
        });

        if (allEvents.length === 0) {
            taskList.innerHTML = `
                <div class="task-category">TODAY</div>
                <div class="task"><div class="task-detail" style="color: var(--text-dim); font-size: 12px;">No events today</div></div>
            `;
            return;
        }

        allEvents.sort((a, b) => {
            const timeA = new Date(a.start.dateTime || a.start.date).getTime();
            const timeB = new Date(b.start.dateTime || b.start.date).getTime();
            return timeA - timeB;
        });

        const displayEvents = allEvents.slice(0, 8); // โชว์ไม่เกิน 8 รายการเพื่อความสวยงาม

        let todayHtml = '';
        let upcomingHtml = '';
        const todayStr = new Date().toDateString();

        displayEvents.forEach(event => {
            let isToday = false;
            let displayTime = "";
            let displayDate = "";

            if (event.start.dateTime) {
                const eventDate = new Date(event.start.dateTime);
                displayTime = eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                isToday = (eventDate.toDateString() === todayStr);
                displayDate = eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            } else {
                displayTime = "All Day";
                const eventDate = new Date(event.start.date);
                isToday = (eventDate.toDateString() === todayStr);
                displayDate = eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }
            
            const eventLink = event.htmlLink || '#';

            const taskHtml = `
                <div class="task" style="margin-bottom: 12px; cursor: pointer;" onclick="window.open('${eventLink}', '_blank')">
                    <div class="task-time" style="color: var(--accent); font-weight: 500;">
                        ${isToday ? displayTime : displayDate + ' • ' + displayTime}
                    </div>
                    <div class="task-detail">${event.summary}</div>
                </div>
            `;

            if (isToday) {
                todayHtml += taskHtml;
            } else {
                upcomingHtml += taskHtml;
            }
        });

        let finalHtml = '';
        
        finalHtml += `<div class="task-category">TODAY</div>`;
        if (todayHtml !== '') {
            finalHtml += todayHtml;
        } else {
            finalHtml += `<div class="task" style="border-left-color: var(--border);"><div class="task-detail" style="color: var(--text-dim); font-size: 12px;">No events today</div></div>`;
        }

        if (upcomingHtml !== '') {
            finalHtml += `<div class="task-category" style="margin-top: 20px;">UPCOMING (NEXT 3 DAYS)</div>${upcomingHtml}`;
        }

        taskList.innerHTML = finalHtml;

    } catch (err) {
        console.error('Error fetching calendar:', err);
        taskList.innerHTML = '<div class="task"><div class="task-detail">Calendar Sync Error</div></div>';
    }
}

fetchCalendarEvents();
setInterval(fetchCalendarEvents, 900000);