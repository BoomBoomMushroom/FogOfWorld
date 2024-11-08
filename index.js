// https://supabase.com/docs/reference/javascript/auth-signout
   
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabaseUrl = 'https://mlicpopsfugokqdpmutt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1saWNwb3BzZnVnb2txZHBtdXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA4NDY1MDcsImV4cCI6MjA0NjQyMjUwN30.evamdKmRu8pjo8YOqKbqeEa7aWb-uBXiH3lhbx2FPyM'
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Supabase Instance: ', supabase)


async function getLocationPoints(){
    const session = await getSession()
    if(session == null){
        console.error("Not logged in!")
        return
    }
    
    const out = await supabase
        .from('Locations')
        .select()
    return out["data"]
}
async function setLocationPoints(pointData){
    const session = await getSession()
    if(session == null){
        console.error("Not logged in!")
        return
    }
    let userId = session["user"]["id"]

    const out = await supabase
        .from('Locations')
        .upsert({ user_id: userId, location_data: pointData })
        .select()
    
    return out
}
async function getSession(){
    const session = await supabase.auth.getSession()
    return session["data"]["session"]
}
let session = await getSession()
if(session == null){
    console.log("Session Expired!! | index.js")
    window.location.href = "/authflow.html";
}
else{
    console.log("Valid Session | index.js")
}

var map = L.map('map').setView([51.5, 0], 1);
map._zoomAnimated = false
let firstGo = true

const svgOverlay = document.getElementById('svg-overlay');
const mask = svgOverlay.querySelector('#holeMask');
let lastPin = null

let markers = []
let maskThingsAdded = []

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

function addCircle(latitude, longitude){
    var circle = L.circle([latitude, longitude], {
        color: 'black',
        fillColor: '#f03',
        fillOpacity: 0,
        radius: 100,
        weight: 0
    }).addTo(map);
    markers.push(circle)
}

let previousPoints = []
let allUserData = await getLocationPoints()
allUserData.forEach((userData)=>{
    if(userData["user_id"] == session["user"]["id"]){
        previousPoints = userData["location_data"]
    }
})

previousPoints.forEach((point)=>{
    console.log("Loading Point: " + point)
    let latitude = point[0]
    let longitude = point[1]
    addCircle(latitude, longitude)
})

setInterval(()=>{
    updateMask()
}, 1)

setInterval(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
    }
}, 1000);

function success(position) {
    let { latitude, longitude, accuracy } = position.coords;
    console.log(`Latitude: ${latitude}, Longitude: ${longitude}, Accuracy: ${accuracy} meters`);
    if(firstGo==true){
        map.setView([latitude, longitude], 17);
        firstGo = false
    }
    if(lastPin != null){
        map.removeLayer(lastPin)
    }

    if(accuracy > 100){
        console.error("Data isn't accurate enough! " + accuracy + " > 100")
        return
    }
    
    let pointAlreadyAdded = previousPoints.some(item => item[0] === latitude && item[1] === longitude)
    if(pointAlreadyAdded){
        console.error("Data point is already in database!")
        return
    }
    
    addCircle(latitude, longitude)
    previousPoints.push([latitude, longitude])

    setLocationPoints(previousPoints)

    //lastPin = L.marker([latitude, longitude]).addTo(map)
}

function error(err) {
    document.body.innerText = (`ERROR(${err.code}): ${err.message}`);
}


function updateMask() {
    // Clear previous circles in mask
    while (mask.firstChild && mask.firstChild.tagName === 'circle') {
        mask.removeChild(mask.firstChild);
    }

    maskThingsAdded.forEach(hole => {
        hole.remove()
    })

    // Add a circle to the mask for each marker
    markers.forEach(marker => {
        const latLng = marker.getLatLng();
        const point = map.latLngToContainerPoint(latLng);  // Convert to screen coordinates
    
        // Project the circle's radius (in meters) to pixels for the current zoom level
        const radiusMeters = marker.getRadius();
    
        // Calculate the horizontal (X) radius in pixels
        const radiusPointX = map.latLngToContainerPoint(
          L.latLng(latLng.lat, latLng.lng + radiusMeters / 6378137 * (180 / Math.PI))
        );
        const radiusInPixelsX = Math.abs(radiusPointX.x - point.x);
    
        // Calculate the vertical (Y) radius in pixels
        const radiusPointY = map.latLngToContainerPoint(
          L.latLng(latLng.lat + radiusMeters / 6378137 * (180 / Math.PI), latLng.lng)
        );
        const radiusInPixelsY = Math.abs(radiusPointY.y - point.y);
    
        // Scale to SVG's 100x100 viewBox (assuming fullscreen SVG)
        const cx = (point.x / window.innerWidth) * 100;
        const cy = (point.y / window.innerHeight) * 100;
        const scaledRadiusX = (radiusInPixelsX / window.innerWidth) * 100;
        const scaledRadiusY = (radiusInPixelsY / window.innerHeight) * 100;
    
        // Create a black ellipse (hole) for each marker
        const hole = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        hole.setAttribute('cx', cx);
        hole.setAttribute('cy', cy);
        hole.setAttribute('rx', scaledRadiusX * 1.29);  // Adjusted horizontal radius
        hole.setAttribute('ry', scaledRadiusY * 1);  // Adjusted vertical radius
        hole.setAttribute('fill', 'black');
        mask.appendChild(hole);
        maskThingsAdded.push(hole);
    });
}

// Update the mask whenever the map is moved or zoomed
map.on('move', updateMask);
map.on('zoom', updateMask);