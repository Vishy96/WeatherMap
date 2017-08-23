const DEFAULT_ZOOM = 8;
const DEFAULT_MAP_OPTIONS = {"minZoom": 2, "maxZoom": 11, center: [0,0], zoom: DEFAULT_ZOOM};
const DEFAULT_TILE_LAYER = "Bing"; 
const DEFAULT_CACHE_TIME = 15*60*1000; //ms
const MAP_REQUEST_API_KEY = "hwG85epZUf05bOLoXpgqgte8Ga0qnejp";
var map = L.map('map', DEFAULT_MAP_OPTIONS); 
var weatherIconsLayer = L.layerGroup().addTo(map);
var alreadySettingWeatherIcons = true;
var globalMarkerReferenceCounter = 0;                        
var currentWeatherIcons = [];    
var onLoadMarkerRef = false;  
var activeCenter = 0;                                                           
var fetchLimit = [null, null, 16, 10, 6.5, 3.4, 1.5, 1, 0.5, 0.3, 0.12, 0.075]; //MAX ZOOM: 11, MIN ZOOM: 2
var iconCache = new Cache();

var onMapLoad = function(){
    mapSet();  
    callWeatherIcons();
    activeCenter = map.getCenter();
  }

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
  onLoadMarkerRef = [];
  onLoadMarkerRef[0] = L.marker([position.coords.latitude, position.coords.longitude], {title: "Click for more information", riseOnHover: true}).addTo(map);
  setMarkerPopup(onLoadMarkerRef[0], {lat: position.coords.latitude, lng: position.coords.longitude });
}

function geoInfoLoad(lat, lon){
  mapInit(lat, lon, DEFAULT_ZOOM);
  onMapLoad();
};

function geoError(error) {

      onLoadMarkerRef = [];
    
      let form = document.createElement('form');
      form.className = "form-wrapper";
      let userInput = document.createElement('input');
      userInput.type = "text";
      userInput.placeholder = "Search your location...";
      userInput.hasAttribute('required');
      userInput.id = "search_1";
      let buttonSubmit = document.createElement('button');
      buttonSubmit.textContent = "Search";
      buttonSubmit.id = "submit";
      buttonSubmit.type = "button";
      form.appendChild(userInput);
      form.appendChild(buttonSubmit);
      document.body.appendChild(form);
     
      let table;
      let firstClick = true;
    buttonSubmit.addEventListener("click", function Submitter (){
      if(!firstClick)
        document.body.removeChild(table);

      table = document.createElement("table");
     getOSMApiResponse(userInput.value, form, table);
     firstClick = false;
  
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
  var markerRef = L.marker([0,0], {riseOnHover: true,
  title: "Click for more information"});

  var searchControl = new L.Control.Search({
	url: 'http://nominatim.openstreetmap.org/search?format=json&q={s}',
		jsonpParam: 'json_callback',
		propertyName: 'display_name',
		propertyLoc: ['lat','lon'],
		marker: markerRef,
		autoCollapse: true,
		autoType: false,
		minLength: 2
    });

   map.addControl(searchControl);

   searchControl.addEventListener('search:locationfound', function (data) {
                      
                       if(onLoadMarkerRef){
                         map.removeLayer(onLoadMarkerRef[0]);
                         if(onLoadMarkerRef[1] != undefined)
                         weatherIconsLayer.removeLayer(onLoadMarkerRef[1]);
                         onLoadMarkerRef = false;
                       }

                      setMarkerPopup(markerRef, data.latlng); 
  });

  
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
          
  function getOSMApiResponse (cityName, searchFormToRemove, table){
   
    let url_constructor_OSM = "http://nominatim.openstreetmap.org/search?format=json&city=" + cityName;
                           
            getJSON(url_constructor_OSM, function (err, data) {
              
             if (err != null) {
               
               alert('Something went wrong: ' + err + '\nSetting default...');
            } else {
                  //TODO: Implement 'Show All' button which would collapse the whole search table content
                   var i = 0;
                
                   while(data[i] != undefined){
                      
                      let tr = document.createElement('tr');   

                      let td1 = document.createElement('td');
                      td1.className = "td1";
                      let td2 = document.createElement('td');
                      td2.className = "td2";
                      let td3 = document.createElement('td');

                      let text1 = document.createTextNode(i+1);
                      let text2 = document.createTextNode(data[i].display_name);

                      let btn = document.createElement('input');
                      btn.type = "button";
                      btn.className="button";
                      btn.id = "b" + i;
                      btn.value = "Show this on map";                 
                    
                      td1.appendChild(text1);
                      td2.appendChild(text2);
                      td3.appendChild(btn);
                      tr.appendChild(td1);
                      tr.appendChild(td2);
                      tr.appendChild(td3);

                      table.appendChild(tr);
                       i++;
                   }                   
                   document.body.appendChild(table); 

                   for(let j=0; j<i;j++)
                    handleElement(j, data, table, searchFormToRemove);
             }       
          }); 
  };
  
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
                                                                                    + '\n' +  string_title[1] + owmObjectReference.list[i].weather[0].description}).bindPopup(string_popup[i]);
                  weatherIconsLayer.addLayer(currentWeatherIcons[i]);
                   }
                    alreadySettingWeatherIcons = false;              
                };

var setWeatherIcon = function (owmObjectReference){
              const prefix = 'wi wi-';
              let code;
              let icon;

              code = owmObjectReference.weather[0].id;
              icon = weatherIconsFile[code].icon;
                
              //PLUGIN CODE: 
              // If we are not in the ranges mentioned above, add a day/night prefix.
              if (!(code > 699 && code < 800) && !(code > 899 && code < 1000)) {
                icon = 'day-' + icon;
              }
              icon = prefix + icon;
              //PLUGIN CODE END

              let myIcon = L.divIcon({className: icon,
                           iconSize: [20,-10]  //pomak od prave lokacije na mapi --BUG?-- 
                            });

                  let string_title = ["City: ", "Weather: "];  
                  let string_popup = '         <b>City:</b> ' + owmObjectReference.name + '<br>' +
                                     '<b>Temperature (°C):</b> ' + owmObjectReference.main.temp + '<br>' +
                                     '    <b>Humidity (%):</b> ' + owmObjectReference.main.humidity + '<br>' +
                                     '  <b>Pressure (hPa):</b> ' + owmObjectReference.main.pressure + '<br>' +
                                     '<b>Wind speed (m/s):</b> ' + owmObjectReference.wind.speed;
                    
                  onLoadMarkerRef[1] = L.marker([owmObjectReference.coord.lat, owmObjectReference.coord.lon], {icon: myIcon,
                                                                                     title: string_title[0] + owmObjectReference.name 
                                                                                    + '\n' +  string_title[1] + owmObjectReference.weather[0].description}).bindPopup(string_popup);
 
                  weatherIconsLayer.addLayer(onLoadMarkerRef[1]); 
                  alreadySettingWeatherIcons = false;              
                };

var clearAndResetWeatherIcons = function (){
      alreadySettingWeatherIcons = true;
      weatherIconsLayer.clearLayers();
      callWeatherIcons(); 
      if(onLoadMarkerRef[1] != undefined)
        weatherIconsLayer.addLayer(onLoadMarkerRef[1]);
};

var clearAndResetWeatherIconsFromCache = function (cacheObject){
      alreadySettingWeatherIcons = true;
      weatherIconsLayer.clearLayers();
      setWeatherIcons(cacheObject); 
      if(onLoadMarkerRef[1] != undefined)
        weatherIconsLayer.addLayer(onLoadMarkerRef[1]);
};

var setLeafletControlLayers = function () {
  
  var temperature = L.OWM.temperature({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var clouds = L.OWM.clouds({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var precipitation = L.OWM.precipitation({appId: '0826bd98905da40265152b2bb7f9d3e8'});
  var rain = L.OWM.rain({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var snow = L.OWM.snow({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});
  var pressure = L.OWM.pressure({appId: '0826bd98905da40265152b2bb7f9d3e8', showLegend: false});

  var overlayMaps = {"Weather Icons": weatherIconsLayer,"Temperature": temperature, "Clouds": clouds, 
                     "Rain":rain, "Snow": snow, "Precipitation": precipitation, "Pressure": pressure};
                     
  var googleTileLayer = createGoogleTileLayer();
  var bingTileLayer = createBingTileLayer();
  var osmTileLayer = createOSMTileLayer();
  
  var baselayMaps = {"Google Maps": googleTileLayer, "Bing": bingTileLayer, "OpenStreetMap": osmTileLayer};
  var layerControl = L.control.layers(baselayMaps, overlayMaps).addTo(map);

};

var getCurrentBoundsCacheCode = function () {
  return map.getZoom() + returnCacheCodedBound(map.getBounds().getSouth()) + returnCacheCodedBound(map.getBounds().getWest());
}

var returnCacheCodedBound = function (thisBound) {

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

var getWeatherByCityName = function (cityName, handlerFunction){
  const OWM_API_KEY = '0826bd98905da40265152b2bb7f9d3e8';

  let url_constructor_OWM = 'http://api.openweathermap.org/data/2.5/weather?q=' + cityName + '&APPID=0826bd98905da40265152b2bb7f9d3e8&units=metric';

  getJSON(url_constructor_OWM, handlerFunction);

};

var weatherByCityNameHandler = function (err, owmObject) {

    if(err != null){
      alert("Error while trying to reach weather by city name. " + "\nError: " + err);
    }else{
      alreadySettingWeatherIcons = true;
      setWeatherIcon(owmObject);
    }

}

function handleElement(i, data, table, formToRemove) {
    document.getElementById("b"+i).onclick = function() {
        geoInfoLoad(data[i].lat, data[i].lon);
        document.body.removeChild(table);
        document.body.removeChild(formToRemove);

        onLoadMarkerRef[0] = L.marker([data[i].lat, data[i].lon], {riseOnHover: true,
         title: data[i].display_name}).addTo(map);

        getWeatherByCityName(data[i].display_name, weatherByCityNameHandler);   //marker and weather icon will be dismissed only on new searchlocation:found event
        setMarkerPopup(onLoadMarkerRef[0],{lat: data[i].lat, lng: data[i].lon});
}}


function setMarkerPopup (markerRef, latlng){

                          let defaultEntryNotClicked = true; 
                          if(JSON.parse(localStorage.getItem('currentEntry'))){
                              currentEntryObj = JSON.parse(localStorage.getItem('currentEntry'));
                              latlng.lat = Number(latlng.lat);
                              latlng.lng = Number(latlng.lng);
                              currentEntryObj.lat= Number(currentEntryObj.lat);
                              currentEntryObj.lng= Number(currentEntryObj.lng);
                          if(latlng.lat.toFixed(2) == currentEntryObj.lat.toFixed(2) && latlng.lng.toFixed(2) == currentEntryObj.lng.toFixed(2)){
                              defaultEntryNotClicked = false;
                            }
                             }
                    
                       let popupBox = document.createElement('div');
                       popupBox.className="box";
                       popupBox.innerText = 'Do you want to set this location as your default entry point?\n\n';
                       let locationSetButton = document.createElement('button');
                       locationSetButton.className="button";
                       locationSetButton.textContent = "Set Default"; 
                       popupBox.appendChild(locationSetButton);

                        let popupBoxAfter = document.createElement('div');
                        popupBoxAfter.className="box";
                        popupBoxAfter.innerText = "This is your default entry point.\n\n";

                        let locationResetButton = document.createElement('button');
                        locationResetButton.className = "button";
                        locationResetButton.textContent = "Dismiss";
                        popupBoxAfter.appendChild(locationResetButton);

                       markerRef.addEventListener("click", () => { 

                        
                        if(defaultEntryNotClicked){
                          markerRef.unbindPopup();
                          markerRef.bindPopup(popupBox);
                          markerRef.openPopup();
                          locationSetButton.addEventListener("click", () => {
                           markerRef.closePopup();
                           localStorage.removeItem('currentEntry');
                           localStorage.setItem('currentEntry', JSON.stringify(latlng));
                           defaultEntryNotClicked = false;
                          });
                          
                        }else{
                          markerRef.unbindPopup();
                          markerRef.bindPopup(popupBoxAfter);
                          markerRef.openPopup();
                          locationResetButton.addEventListener("click", () => {
                            localStorage.removeItem('currentEntry');
                            markerRef.closePopup();
                            defaultEntryNotClicked = true;
                          });
                          
                         }
                       });
}
//ENTRY POINT:

if(localStorage.getItem('currentEntry')){
  let defaultEntry = JSON.parse(localStorage.getItem('currentEntry'));
  mapInit(defaultEntry.lat, defaultEntry.lng, DEFAULT_ZOOM);
  onMapLoad();
  onLoadMarkerRef = [];
  onLoadMarkerRef[0] = L.marker([defaultEntry.lat, defaultEntry.lng], {title: "Click for more information", riseOnHover: true}).addTo(map);
  setMarkerPopup(onLoadMarkerRef[0], defaultEntry);
}else
navigator.geolocation.getCurrentPosition(geoSuccess, geoError, geoOptions); 