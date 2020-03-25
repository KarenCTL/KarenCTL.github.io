///////////////////////////////////////////////////////////////////////////
// Copyright 2020, all rights reserved Berntsen International, Inc.
//
// Subject to your agreement of the disclaimer set forth below, permission is given by Berntsen International, Inc. ("Berntsen")
//
// BY USING ALL OR ANY PORTION OF THIS CODE, YOU ACCEPT AND AGREE TO THE BELOW DISCLAIMER. 
//
// If you do not accept or agree to the below disclaimer, then you may not use or modify this code.
// THE CODE IS PROVIDED UNDER THIS LICENSE ON AN "AS IS" BASIS,
// WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, WITHOUT LIMITATION, 
// WARRANTIES THAT THE COVERED CODE IS FREE OF DEFECTS, MERCHANTABLE, FIT FOR A PARTICULAR PURPOSE OR NON-INFRINGING.
// THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE COVERED CODE IS WITH YOU.
// SHOULD ANY COVERED CODE PROVE DEFECTIVE IN ANY RESPECT, YOU (NOT THE INITIAL DEVELOPER OR ANY OTHER CONTRIBUTOR)
// ASSUME THE COST OF ANY NECESSARY SERVICING, REPAIR OR CORRECTION. UNDER NO CIRCUMSTANCES WILL BERNTSEN BE LIABLE TO YOU,
// OR ANY OTHER PERSON OR ENTITY, FOR ANY LOSS OF USE, REVENUE OR PROFIT, LOST OR DAMAGED DATA, 
// OR OTHER COMMERCIAL OR ECONOMIC LOSS OR FOR ANY DAMAGES WHATSOEVER RELATED TO YOUR USE OR RELIANCE UPON THE SOFTWARE,
// EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES OR IF SUCH DAMAGES ARE FORESEEABLE. 
// THIS DISCLAIMER OF WARRANTY AND LIABILITY CONSTITUTES AN ESSENTIAL PART OF THIS LICENSE. 
// NO USE OF ANY COVERED CODE IS AUTHORIZED HEREUNDER EXCEPT UNDER THIS DISCLAIMER.
//
// THE EXPRESS USE OF THIS CODE IS GRANTED PER AGREEMENTS DEFINED IN THE LICENSE AGREEMENT BETWEEN YOU, YOUR ENTITY OR COMPANY AND BERNTSEN.
///////////////////////////////////////////////////////////////////////////

define(['dojo/_base/declare', 
'jimu/BaseWidget', 
'jimu/SelectionManager',
'jimu/WidgetManager',
'jimu/utils',
'dojo/_base/lang', 
"dojo/_base/fx",
"dojo/dom-style",
'dojo/_base/html',
'dojo/_base/array',
'dojo/Deferred', 
'dgrid/OnDemandList', 
'dstore/RequestMemory',
'dgrid/Selection', 
'dojo/store/Memory',
'esri/tasks/query',
'esri/request',
"esri/dijit/editing/Editor",
"esri/config",
'esri/urlUtils',
"jimu/dijit/CheckBox",
"dijit/Dialog",
'./IMDialogs',
'moment/moment',
"dijit/_WidgetsInTemplateMixin",
"dijit/form/Form",
"esri/map", 
"esri/tasks/IdentifyTask",
],
function(
  declare, 
  BaseWidget, 
  SelectionManager,
  WidgetManager,
  jimuUtils,
  lang, 
  baseFx,
  style,
  html,
  array, 
  Deferred, 
  OnDemandList, 
  RequestMemory, 
  Selection, 
  Memory, 
  Query, 
  esriRequest, 
  Editor,
  esriConfig,
  esriUrlUtils,
  CheckBox,
  dijitDialog,
  IMDialogs,
  moment,
  _WidgetsInTemplateMixin) {

  //To create a widget, you need to derive from BaseWidget.
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
  
    //please note that this property is be set by the framework when widget is loaded.
    //templateString: template,

    baseClass: 'jimu-widget-infraMarkerRead',

    // History of completed reads, format:
    //[{"timeStamp":dateTime, "json":jason returned from completed read}]
    rfidReads: null, 
     
    postCreate: function () {
      this.inherited(arguments);
    
      jimuUtils.loadStyleLink("dgrid", apiUrl + "dgrid/css/dgrid.css");

      this.featureLayer = this.map.getLayer(this.config.layerId);
      this.selectedAsset = null;

      this.selectionManager = SelectionManager.getInstance();
      this.WidgetManager = WidgetManager.getInstance();
      
      this.rfidReads = [];
      this.RFIDReadsGrid = null;

      this._footer_info.innerHTML = this.manifest.copyright + ", Version " + this.manifest.version + ", S1";

      this.readURL = "http://localhost:8080/api/v1/rfid/read";

      // Begin demo setup
      // Code from here to end of demo setup is pulled out for distrubuted version.
      var params = esriUrlUtils.urlToObject(document.location.href);  
      this.spoof = null;
      if (params.query && params.query.s) {  
        this.spoof = params.query.s;
      }  

      if (this.spoof != null) {
        this.readURL = "https://www.customtechnologyltd.com/rfid/read.php";
      }
      // End demo setup
    },

    startup: function() {
      this.inherited(arguments);
    },

    onOpen: function () {
    
      if (this.RFIDReadsGrid != null && this.RFIDReadsGrid != undefined) {
        this.RFIDReadsGrid.store = null;
        this.RFIDReadsGrid.refresh();
      }
      this.featureLayer = this.map.getLayer(this.config.layerId);
      console.log( "Using field " + this.config.assetIdForRFID + " in layer " + this.featureLayer.name + " as assetID for RFID");
    },

    onClose: function(){
      console.log('onClose');
    },

    onMinimize: function(){
      console.log('onMinimize');
    },

    onMaximize: function(){
      console.log('onMaximize');
    },

    onSignIn: function(credential){
      /* jshint unused:false*/
      console.log('onSignIn');
    },

    onSignOut: function(){
      console.log('onSignOut');
    },

    // called from html button
    _clickReadTag: function () {

      this._readRFIDTag(this.readURL);
    },

    _readRFIDTag: function (apiUrl) {

      console.log('Read Marker button clicked');

      var rfidRequest = this._readOldSchool(apiUrl);
      rfidRequest.then(lang.hitch(this, function (response) {

        // The request succeeded
        if (response && response.type !== 'error') {
          console.log(response.data);
          var LastRFIDReadObj = this.rfidReads[this.rfidReads.length - 1];
          var RFIDjson = LastRFIDReadObj['json'];

          if (this.RFIDReadsGrid == null) {

            this.createList(RFIDjson);
          }
          else {
            var RFIDReadStore = new Memory({ data: RFIDjson, idProperty: 'epc' });
            this.RFIDReadsGrid.store = RFIDReadStore;
            this.RFIDReadsGrid.refresh();
          }

          let rfids = [];
          for (let i = 0; i < response.data.length; ++i) {
            rfids.push(response.data[i]['epc']);
          }
          this._zoomToFeatures(rfids);
        }

        else {
          errorMsg = response.err;
          if (response.err.match(/no transponder found/i) != null) {
            errorMsg = "No markers found."
          }
          var dialogParams = {
            'title': "Warning",
            'body': errorMsg,
            'buttons': "OK"
          };
          IMDialogs.confirmDialog(dialogParams)
          .then(lang.hitch(this, function (response) {
            console.log(errorMsg);
          }));
      }
      }));
    },

    _readOldSchool: function(apiUrl) {

      var resultDef = new Deferred();

      // Create a new http handler
      var xhttp = new XMLHttpRequest();

      // Bind the response sent event handler
      xhttp.onreadystatechange = lang.hitch(this, function () {
        if (xhttp.readyState == 4 && xhttp.status == 200) {

          // The request was successful
          var response = JSON.parse(xhttp.responseText);

          var filteredResponse = response;
          this._read_feedback.innerHTML = '';
          if (response.length > 0){
            var filterDiff = response.length - filteredResponse.length;
            if ( response.length > 0 && filterDiff > 0) {
              this._read_feedback.innerHTML = "(" + filterDiff + " tag read(s) have been ignored.)";
            }
          }

          var timeStamp = new Date();
          this.rfidReads.push({
            'date': timeStamp,
            'json': filteredResponse
          });

          resultDef.resolve({
            type: 'success',
            data: filteredResponse,
            url: apiUrl
          });

        } 
        else if (xhttp.readyState == 4) {
          resultDef.resolve({
            type: 'error',
            err: xhttp.responseText ? xhttp.responseText : 'Unknown read error.',
            url: apiUrl
          });
        }
      });

      // Create a new HTTP request to scan for RFID tags
      xhttp.open('GET', apiUrl, true);
      xhttp.send();
 
      return resultDef.promise;
   },

    // Create a dojo OnDemandList from an array of RFID marker data formatted as JSON.
    // JSON keys that will be displayed:
    // assetName, assetOwner, latitude, longitude, dateTime
    createList: function (RFIDjson) {
      if (this.rfidReads.length >= 1) {
        var RFIDReadStore = new Memory({ data: RFIDjson, idProperty: 'epc' });

        this.RFIDReadsGrid = new (declare([OnDemandList, Selection]))({
          'store': RFIDReadStore,
          'selectionMode': 'single',
          'renderRow': lang.hitch(this, function (object, options) {
            return this._createListItem(object);
          })
        }, this.RFIDReadsGridNode);
        this.RFIDReadsGrid.startup();
        this.RFIDReadsGrid.on('.dgrid-row:click', lang.hitch(this, function (evt) {
          console.log("Row clicked");
          var row = this.RFIDReadsGrid.row(evt);
          this._selected_row_data = row.data;
          var matchingFeature = this._getFeatureWithRFID(row.data.epc, row.data.assetName);
        }));
      }
    },

    _createListItem: function (featureObj) {
      var listItemRoot = document.createElement('div');
      listItemRoot.className = 'rfid-list-items';

      if (featureObj) {
        listItemAssetName = document.createElement('div');
        listItemAssetName.innerHTML = "<span class='title'>Asset Name:  </span>" + "<span>" + this.displayValue(featureObj.assetName, false) + "</span>";
        listItemRoot.appendChild(listItemAssetName);

        listItemAssetOwner = document.createElement('div');
        listItemAssetOwner.innerHTML = "<span class='title'>Asset Owner:  </span>" + "<span>" + this.displayValue(featureObj.assetOwner, false) + "</span>";
        listItemRoot.appendChild(listItemAssetOwner);

        listItemLatitude = document.createElement('div');
        listItemLatitude.innerHTML = "<span class='title'>Latitude:  </span>" + "<span>" + this.displayValue(featureObj.latitude, true) + "</span>";
        listItemRoot.appendChild(listItemLatitude);

        listItemLongitude = document.createElement('div');
        listItemLongitude.innerHTML = "<span class='title'>Longitude:  </span>" + "<span>" + this.displayValue(featureObj.longitude, true) + "</span>";
        listItemRoot.appendChild(listItemLongitude);

        listItemDateTime = document.createElement('div');
        var formattedDate = moment(featureObj.dateTime).format('M/D/YYYY, h:mm:ss a');
        listItemDateTime.innerHTML = "<span class='title'>Date & Time:  </span>" + "<span>" + this.displayValue(formattedDate, false) + "</span>";
        listItemRoot.appendChild(listItemDateTime);
      }
      else {
        listItemRoot.innerHTML = 'NO DATA AVAILABLE';
      }
      return listItemRoot;
    },

    displayValue: function (param, numberOK) {

      var paramType = typeof param;
      if (paramType === 'string') return param;
      if (paramType === 'undefined') return 'missing';
      if (numberOK && (paramType === 'number')) return param;
      return 'invalid format: ' + paramType;
    },

    // Typically used to find the asset matching the RFID scan.
    // Specifically the function is called with the target key to match.
    // It looks within the feature layer and field that was 
    // configured to contain the RFID unique key to find a match.
    // If multiple matches ae found, it uses the name to pick one.
   _getFeatureWithRFID: function (RFIDKey, RFIDName) {

      var query = new Query();

      query.where = this.config.assetIdForRFID + "='" + RFIDKey + "'";
      var feature = null;
      this.featureLayer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW, lang.hitch(this, function (result) {
        if (result.length) {
          for (var idx = 0; idx < result.length; idx++) {
            if (result[idx].attributes.AssetName == RFIDName) {
              feature = result[idx];
              break;
            }
          }
          if (feature == null) feature = result[0];
          this.selectedAsset = feature;

          var newMapCenter,
            geometry = feature.geometry,
            extent = geometry.getExtent(),
            shape = feature.getShape();
          if (extent && extent.getCenter) {
            newMapCenter = extent.getCenter(); // polygon & polyline
          } else {
            newMapCenter = geometry; // point
          }

          // Good doc on what zoom / scale represents:
          // https://www.esri.com/arcgis-blog/products/product/mapping/web-map-zoom-levels-updated/
          this.map.centerAndZoom(newMapCenter, 19).then(lang.hitch(this, function () {
            if (shape) shape.moveToFront(); // move the feature to front
            this.editSelectedFeatures([feature]);
          }));
        }
        else {
          var dialogParams = {
            'title': "Warning",
            'body': "No assets match the marker's epc:\n\n" + RFIDKey,
            'buttons': "OK"
          }
          IMDialogs.confirmDialog(dialogParams)
            .then(lang.hitch(this, function (response) {
              console.log("confirmDialog response from " + response["id"]);
              this._readRFIDTag(apiReadUrl);
            }));
        }
      }));
      return feature;
    },

    _zoomToFeatures: function (RFIDKeys) {
      var query = new Query();
      let rfidList = "'" + RFIDKeys.join("', '") + "'";
      query.where = this.config.assetIdForRFID + " in (" + rfidList + ")";
      this.featureLayer.selectFeatures(
        query, esri.layers.FeatureLayer.SELECTION_NEW,
        lang.hitch(this, function (result) {
          if (result.length > 0) {
            jimuUtils.featureAction.zoomTo(this.map, result);
          }
        }));
    },

    _getWidgetConfig: function (widgetName) {
      var widgetCnfg = null;

      array.some(WidgetManager.getInstance().appConfig.widgetPool.widgets, function (aWidget) {
        if (aWidget.name == widgetName) {
          widgetCnfg = aWidget;
          return true;
        }
        return false;
      });
      if (!widgetCnfg) {
        /*Check OnScreen widgets if not found in widgetPool*/
        array.some(WidgetManager.getInstance().appConfig.widgetOnScreen.widgets, function (aWidget) {
          if (aWidget.name == widgetName) {
            widgetCnfg = aWidget;
            return true;
          }
          return false;
        });
      }
      return widgetCnfg;
    },

    editSelectedFeatures: function (result) {
      if (result && result.length > 0) {
        if (this.WidgetManager) {
          var widgetCfg = this._getWidgetConfig('SmartEditor');
          if (widgetCfg) {
            this.WidgetManager.triggerWidgetOpen(widgetCfg.id).then(lang.hitch(this, function (editWidget) {
              this.setTimestampField('MarkerReadDate', null);
              setTimeout(lang.hitch(this, function () {
                var showEvent = { screenPoint: { x: 0, y: 0 } };
                var featurePoint;
                if (result[0].geometry.type === 'point') {
                  featurePoint = result[0].geometry;
                } else {
                  featurePoint = result[0].geometry.getExtent().getCenter();
                }
                console.info(featurePoint);
                showEvent.mapPoint = featurePoint;
                showEvent.graphic = result[0];

                // The onClick simulates a user click, selecting the feature that matched the RFID and...
                // unfortunately other very close features.
                try {
                  this.map.setInfoWindowOnClick(false);
                  this.map.onClick(showEvent);
                  this.map.setInfoWindowOnClick(true);
                }
                catch (error) {
                  this.map.setInfoWindowOnClick(true);
                }
              }), 500);
            }), lang.hitch(this, function (err) {
              if (err && err.message !== 'Edit request canceled') {
                console.error(err);
              }
            }));
          }
        } else {
          this._popupMessage('WidgetManager not set up');
        }
      }
    },

    // If the timestamp is null, it uses the current time.
    setTimestampField(fieldId, timestamp) {
      // The Marker Write Date is taken from the server's response
      // and written back to the (currently) hard-coded field in the feature layer
      var currentFieldValue = this.selectedAsset.attributes[fieldId];
      if (currentFieldValue === undefined) {
        console.log("Specified timestamp field " + fieldId + " does not exist in the feature layer");
        return;
      }
      if (timestamp == null) {
        timestamp = new Date();
      }
      this.selectedAsset.attributes[fieldId] = timestamp.valueOf();
      this.selectedAsset.getLayer().applyEdits(null, [this.selectedAsset], null, function () {
        console.log("Features updated!");
      }, function (error) {
        console.log("Features not updated! ", error);
      });
    },

    initUserLoc: function () {
      // Detect whether or not the navigator.geolocation object is available. 
      // The position object will return the coords.latitude, coords.longitude, and coords.accuracy.
      // The position object may also return the coords.altitude, coords.altitudeAccuracy, coords.heading, coords.speed and timestamp.
      if (window.navigator.geolocation) {
        window.navigator.geolocation.getCurrentPosition(lang.hitch(this, function (location) {
          console.log("getCurrentPosition returns " + location.coords.latitude + ", " + location.coords.longitude);
        }), this.locationError);
      }
    },

    locationError: function (error) {
      switch (error.code) {
        case error.PERMISSION_DENIED: alert("Location not provided");
          break;
        case error.POSITION_UNAVAILABLE: alert("Current location not available");
          break;
        case error.TIMEOUT: alert("Timeout");
          break;
        default: alert("unknown error");
          break;
      }
    },
      

  });
});
