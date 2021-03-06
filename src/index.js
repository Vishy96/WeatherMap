const DEFAULT_ZOOM = 8;
const DEFAULT_MAP_OPTIONS = {"minZoom": 2, "maxZoom": 11};
const DEFAULT_TILE_LAYER = "Bing"; 
const DEFAULT_CACHE_TIME = 15*60*1000; //ms
var map = L.map('map', DEFAULT_MAP_OPTIONS); 
var alreadySettingWeatherIcons = true;
var globalMarkerReferenceCounter = 0;                        
var currentWeatherIcons = [];           
var activeCenter = 0;                                                           
var fetchLimit = [null, null, 16, 10, 6.5, 3.4, 1.5, 1, 0.5, 0.3, 0.12, 0.075]; //MAX ZOOM: 11, MIN ZOOM: 2
var iconCache = new Cache();
navigator.geolocation.getCurrentPosition(geoSuccess, geoError, geoOptions); 

map.on("moveend", function (e) { let currentCenter = map.getCenter();
                                 let currentDisplacement = Math.sqrt( Math.pow((currentCenter.lat - activeCenter.lat),2)  + Math.pow((currentCenter.lng - activeCenter.lng),2));
                                  if(currentDisplacement >= fetchLimit[map.getZoom()] && !alreadySettingWeatherIcons){
                                    activeCenter = currentCenter;
                                    let owmCacheObject = iconCache.get(getCurrentBoundsCacheCode());
                                    if(owmCacheObject){
                                      //ZOVI IZ MEMORIJE
                                      console.log("Calling setWeatherIcons() from Cache...");
                                      clearAndResetWeatherIconsFromCache(JSON.parse(owmCacheObject));
                                    }else{
                                      clearAndResetWeatherIcons();
                                  }}
                                });
                               

function geoSuccess(position) {
 mapInit(position.coords.latitude, position.coords.longitude, DEFAULT_ZOOM);
 onMapLoad();
}

function geoError() {
      const MAP_REQUEST_API_KEY = "hwG85epZUf05bOLoXpgqgte8Ga0qnejp";
      //WORKFLOW: zatrazi input od strane korisnika te inicijaliziraj mapu
      //Saljem zahtjev na Map Request API kako bi dobio (na temelju inputa) city/street latLng Object, te tako
      //postaviti pocetni lat i lon
      
   
      let userInput = document.createElement('input');
      userInput.type = "text";
      let buttonSubmit = document.createElement('button');
      buttonSubmit.textContent = 'Submit';
      document.body.appendChild(userInput);
      document.body.appendChild(buttonSubmit);

      buttonSubmit.addEventListener("click", function Submitter (){
              manualMapSet(userInput.value, MAP_REQUEST_API_KEY, DEFAULT_ZOOM);
              document.body.removeChild(userInput);
              document.body.removeChild(buttonSubmit);
      }); 
  };
  

var geoOptions = {
  enableHighAccuracy: false, 
  maximumAge        : 30000, 
  timeout           : 20000
};
 
function mapInit(latitude, longitude, default_zoom){

  map.setView([latitude, longitude], default_zoom);  

  // leaflet search map plugin. Pretrazivanje pomocu web API nominatim.openstreetmap.org. Podrazumijeva se da postoji  
  // varijabla 'map' koja je leaflet object L.map
  map.addControl( new L.Control.Search({
		url: 'http://nominatim.openstreetmap.org/search?format=json&q={s}',
		jsonpParam: 'json_callback',
		propertyName: 'display_name',
		propertyLoc: ['lat','lon'],
		marker: L.circleMarker([0,0],{radius:30}),
		autoCollapse: true,
		autoType: false,
		minLength: 2
    }));
}

function mapSet(){  
  setDefaultTileLayer();
  setLeafletControlLayers();  
};

function createOSMTileLayer(){
 return L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoidmlzZXNsYXYiLCJhIjoiY2o2NHVvOWUwMXZ5YTJ3anhkamZtMmV4dyJ9.fCnexghPYMIuM29dTcfvSA',
     });
}

function createBingTileLayer(){
  const BING_KEY ='AiqfCwhUnUy97WyEF547k75oSgoRk8SGFYBfCNZRi7zJzurEv0pWOSU6B6LZxz2s';
  return new L.BingLayer(BING_KEY, {type: 'Road'});
}

function createGoogleTileLayer(){
 // googleMaps API ukljucen u script tag 
 return L.gridLayer.googleMutant({
      type: 'roadmap' //'roadmap', 'satellite', 'terrain' , 'hybrid'
  });  
};

function setDefaultTileLayer (){
  switch (DEFAULT_TILE_LAYER) {
    case 'Bing':
      createBingTileLayer().addTo(map);
      break;
    case 'Google':
      createGoogleTileLayer().addTo(map);
        break;
    default:
       createOSMTileLayer().addTo(map);
  }   
};

var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('get', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status == 200) {
        callback(null, xhr.response);
      } else {
        callback(status);
      }
    };
    xhr.send();
};
function manualMapSet (cityName, MAP_REQUEST_API_KEY, DEFAULT_ZOOM){ 

            let url_constructor_MR = 'http://www.mapquestapi.com/geocoding/v1/address?key=' + MAP_REQUEST_API_KEY + '&location=' + cityName;
          
            getJSON(url_constructor_MR, function(err, data) {
              
            if (err != null) {
              //ukoliko se pojavi error, postavi default lat i lng
              default_lat = 45.813155;  //Zagreb
              default_lng = 15.97703;
              mapInit(default_lat, default_lng, DEFAULT_ZOOM);  
              alert('Something went wrong: ' + err + ' Setting default...');
            } else {
              mapInit(data.results[0].locations[0].latLng.lat, data.results[0].locations[0].latLng.lng, DEFAULT_ZOOM);
            }
             onMapLoad();  //set map current layer, TO DO: ukoliko uspijem osposobiti onload event listener, mogao bih onMapLoad premjestiti tamo          
              });
  };
  //funkcija koju sam stvorio za primanje trenutnih parametara mape potrebnih za bounding box API call na OWM
  function getOWMparam (){
    let mapParams = {
      lon_left : map.getBounds().getWest().toFixed(2),
      lon_right: map.getBounds().getEast().toFixed(2),
      lat_bottom: map.getBounds().getSouth().toFixed(2),
      lat_top: map.getBounds().getNorth().toFixed(2),
      zoom_level: map.getZoom()
    }  
    return mapParams;
  };

  //workflow funkcije callWeatherIcons: callWeatherIcons() -> getOWMparam() -> getJSON(url, handleOWM) -> handleOWM() -> setWeatherIcons()
      var callWeatherIcons = function (){
      const OWM_API_KEY = '0826bd98905da40265152b2bb7f9d3e8';
      let owmParams = getOWMparam();
   
      let url_constructor_OWM = 'http://api.openweathermap.org/data/2.5/box/city?bbox=' + owmParams.lon_left + ','
                                                                                        + owmParams.lat_bottom + ','
                                                                                        + owmParams.lon_right + ','
                                                                                        + owmParams.lat_top + ','
                                                                                        + owmParams.zoom_level 
                                                                                        + '&APPID=' 
                                                                                        + OWM_API_KEY 
                                                                                        + '&units=metric';
                                                                                    
      getJSON(url_constructor_OWM, handleOWM);                
  };
  
    //callback funkcija: ima pristup OWM objectu koji sadrzi sve gradove koji su trenutno na mapi
var handleOWM = function (err, owmObject){

          if (err != null) {
            console.log("Error inside handleOWM!");
              alert("Error occured while trying to reach data from OWM API!");
            } else {  
             iconCache.put(getCurrentBoundsCacheCode(), JSON.stringify(owmObject), DEFAULT_CACHE_TIME);
             console.log("Calling setWeatherIcons() from handleOWM()...");
             setWeatherIcons(owmObject);
            }
  };

var setWeatherIcons = function (owmObjectReference){
              const prefix = 'wi wi-';
              let code;
              let icon;

              globalMarkerReferenceCounter = owmObjectReference.cnt;

              for(let i = 0; i < owmObjectReference.cnt; i++){
              code = owmObjectReference.list[i].weather[0].id;
              icon = weatherIconsFile[code].icon;
                
              //PLUGIN CODE: 
              // If we are not in the ranges mentioned above, add a day/night prefix.
              if (!(code > 699 && code < 800) && !(code > 899 && code < 1000)) {
                icon = 'day-' + icon;
              }
              icon = prefix + icon;
              //PLUGIN CODE END

              var myIcon = [];
              myIcon[i] = L.divIcon({className: icon,
                           iconSize: [-20,10]  //pomak od prave lokacije na mapi --BUG?-- 
                            });

                  let string_title = ["City: ", "Weather: "];  
                  let string_popup = [];   
                  string_popup[i]  = '         <b>City:</b> ' + owmObjectReference.list[i].name + '<br>' +
                                     '<b>Temperature (°C):</b> ' + owmObjectReference.list[i].main.temp + '<br>' +
                                     '    <b>Humidity (%):</b> ' + owmObjectReference.list[i].main.humidity + '<br>' +
                                     '  <b>Pressure (hPa):</b> ' + owmObjectReference.list[i].main.pressure + '<br>' +
                                     '<b>Wind speed (m/s):</b> ' + owmObjectReference.list[i].wind.speed;
                    
                  currentWeatherIcons[i] = L.marker([owmObjectReference.list[i].coord.Lat, owmObjectReference.list[i].coord.Lon], {icon: myIcon[i],
                                                                                     title: string_title[0] + owmObjectReference.list[i].name 
                                                                                    + '\n' +  string_title[1] + owmObjectReference.list[i].weather[0].description}).bindPopup(string_popup[i]).addTo(map);
 
                   }
                    alreadySettingWeatherIcons = false;              
                };

  var onMapLoad = function(){
    mapSet();  
    callWeatherIcons();
    activeCenter = map.getCenter();
  }

var clearAndResetWeatherIcons = function (){
      alreadySettingWeatherIcons = true;
      for(let i=0; i < globalMarkerReferenceCounter; i++){
      map.removeLayer(currentWeatherIcons[i]);   
      }
   //     console.log("Calling callWeatherIcons() from clearAndResetWeatherIcons()");
          callWeatherIcons(); 
};

var clearAndResetWeatherIconsFromCache = function (cacheObject){
      alreadySettingWeatherIcons = true;
      for(let i=0; i < globalMarkerReferenceCounter; i++){
      map.removeLayer(currentWeatherIcons[i]);   
      }
          setWeatherIcons(cacheObject); 
};

var setLeafletControlLayers = function () {
  //TODO: DODAJ overlayere koji omogucuju izbor prikaza pojedinog map providera (SATELLITE, ROADMAP, etc)
  var temperature = L.OWM.temperature({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var clouds = L.OWM.clouds({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var precipitation = L.OWM.precipitation({appId: '0826bd98905da40265152b2bb7f9d3e8'});
  var rain = L.OWM.rain({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var snow = L.OWM.snow({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var pressure = L.OWM.pressure({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});

  var overlayMaps = {"Temperature": temperature, "Clouds": clouds, 
                     "Rain":rain, "Snow": snow, "Precipitation": precipitation, "Pressure": pressure};
                     
  var googleTileLayer = createGoogleTileLayer();
  var bingTileLayer = createBingTileLayer();
  var osmTileLayer = createOSMTileLayer();
  
  var baselayMaps = {"Google Maps": googleTileLayer, "Bing": bingTileLayer, "OpenStreetMap": osmTileLayer};
  var layerControl = L.control.layers(baselayMaps, overlayMaps).addTo(map);

};

var getCurrentBoundsCacheCode = function() {
  return map.getZoom() + returnCacheCodedBound(map.getBounds().getSouth()) + returnCacheCodedBound(map.getBounds().getWest());
}

var returnCacheCodedBound = function(thisBound) {

  let sign;
  let decimalPart;
  let mapZoom = map.getZoom();

   if(thisBound < 0)
       sign = -1;
   else 
       sign = 1;

   if(mapZoom == 11 || mapZoom == 10){
   
 decimalPart = Math.abs(thisBound % 1);

       switch(true){
        case (decimalPart < 0.25):  
             decimalPart = 0;
             break;
        case (decimalPart < 0.5 && decimalPart >= 0.25):
             decimalPart = 0.25 * sign;
             break;
        case (decimalPart < 0.75 && decimalPart >= 0.5):
             decimalPart = 0.5 * sign;
             break;
        default:
             decimalPart = 0.75 * sign;
                      }
             return Math.floor(thisBound) + decimalPart + "";


   } else if(mapZoom == 9 || mapZoom == 8 ){

        return Math.floor(thisBound) + "";

   } else if (mapZoom == 7){
    	//zaokruzi na 2
     decimalPart = Math.abs((thisBound/10) % 1);
   switch(true){
        case (decimalPart < 0.2):  
             decimalPart = 0;
             break;
        case (decimalPart < 0.4 && decimalPart >= 0.2):
             decimalPart = 0.2 * sign * 10;
             break;
        case (decimalPart < 0.6 && decimalPart >= 0.4):
             decimalPart = 0.4 * sign * 10;
             break;
       case (decimalPart < 0.8 && decimalPart >= 0.6):
             decimalPart = 0.6 * sign * 10;
             break;
       default:
             decimalPart = 0.8 * sign * 10;
  
                      }
            return Math.floor((thisBound/10)) * 10 + decimalPart + "";


   }else if(mapZoom == 6){
      
            //zaokruzi na 2.5
        decimalPart = Math.abs((thisBound/10)%1);
          switch(true){
        case (decimalPart < 0.25):   
             decimalPart = 0;
             break;
        case (decimalPart < 0.5 && decimalPart >= 0.25):
             decimalPart = 0.25 * sign * 10;
             break;
        case (decimalPart < 0.75 && decimalPart >= 0.5):
             decimalPart = 0.5 * sign * 10;
             break;
        default:
             decimalPart = 0.75 * sign * 10;
                      }
             return Math.floor((thisBound/10)) * 10 + decimalPart + "";

   }else if(mapZoom == 5){

          //Zaokruzi na 5
       decimalPart = Math.abs((thisBound/10) % 1);
          switch(true){
        case (decimalPart < 0.5):  
             decimalPart = 0;
             break;
        default:
             decimalPart = 0.5 * sign * 10;
          }
            return Math.floor((thisBound/10))*10 + decimalPart + "";

   }else if (mapZoom == 4 || mapZoom == 3){
      
            return Math.floor((thisBound/10))*10 + "";

        

   }else if (mapZoom == 2){
              //zaokruzi na desetice
             decimalPart = Math.abs((thisBound/100) % 1);
   switch(true){
        case (decimalPart < 0.2):  
             decimalPart = 0;
             break;
        case (decimalPart < 0.4 && decimalPart >= 0.2):
             decimalPart = 0.2 * sign * 100;
             break;
        case (decimalPart < 0.6 && decimalPart >= 0.4):
             decimalPart = 0.4 * sign * 100;
             break;
       case (decimalPart < 0.8 && decimalPart >= 0.6):
             decimalPart = 0.6 * sign * 100;
             break;
       default:
             decimalPart = 0.8 * sign * 100;
  
                      }
            return Math.floor((thisBound/100))*100 + decimalPart + "";
   }
  
};