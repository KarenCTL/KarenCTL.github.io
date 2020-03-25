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
'jimu/utils',
'dojo/_base/lang', 
"dojo/_base/fx",
"dojo/dom-style",
'dojo/dom-construct',
"dojo/dom-geometry", 
'dojo/_base/html',
'dojo/_base/array',
'dojo/Deferred', 
'dojo/on',
'dgrid/Selection', 
'dojo/store/Memory',
'esri/tasks/query',
'esri/request',
"esri/dijit/editing/Editor",
"esri/config",
'esri/urlUtils',
'./IMDialogs',
"dijit/_WidgetsInTemplateMixin",
"dijit/form/Form"
],
function(
  declare, 
  BaseWidget, 
  SelectionManager,
  jimuUtils,
  lang, 
  baseFx,
  style,
  domConstruct,
  domGeom,
  html,
  array, 
  Deferred, 
  on,
  Selection, 
  Memory, 
  Query, 
  esriRequest, 
  Editor,
  esriConfig,
  esriUrlUtils,
  IMDialogs,
  _WidgetsInTemplateMixin) {

  //To create a widget, you need to derive from BaseWidget.
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    // DemoWidget code goes here

    //please note that this property is be set by the framework when widget is loaded.
    //templateString: template,

    baseClass: 'jimu-widget-infraMarkerWrite',

    // RFIDtoFeaturePairing is a key-value store that has a key for each field that will be written to the RFID tag.
    // The value is the field within the selected feature that pairs with that RFID field.
    // Below is an example pairing used for testing. 
    // {
    //   "tid": { "source": "featureLayer", "value": "tid" },
    //   "epc": { "source": "featureLayer", "value": "rfid_info" },
    //   "assetOwner": { "source": "featureLayer", "value": "asset_owner" },
    //   "assetName":  { "source": "featureLayer", "value": "assetName" },
    //   "latitude": { "source": "special", "value": "map" },
    //   "longitude":  { "source": "special", "value": "map" },
    //   "lock": { "source": "assign", "value": "false" }
    // },
    RFIDtoFeaturePairings: {},
    
     postCreate: function () {
      this.inherited(arguments);
    
      this.featureLayer = this.map.getLayer(this.config.layerId);
      this.selectedAsset = null;
      this.selectedAssetRFIDWriteFields = {};
      this.writeAttempt = {}; //selectedAsset: null, readStatus: null, writeStatus: null
       
       this.vectorFont = null;
       this.surface = null;

       // History of completed reads, format:
       //[{"timeStamp":dateTime, "json":jason returned from completed read}]
       this.rfidReads = [];

       // History of completed writes, format:
       //[{"timeStamp":dateTime, "json":jason returned from completed write}]
       this.rfidWrites = [];

       this.readState = { "attempts": 0, "startTime": null };
       this.writeState = { "attempts": 0, "startTime": null };

      this.map.on("click", lang.hitch(this, function (evt) {
        this.updateSelection();
      }));

      console.log(this.selectedAsset);

      if (this.config.sourceForAssetOwner != null && this.config.sourceForAssetOwner != undefined) {
        this.RFIDtoFeaturePairings["assetOwner"] = this.config.sourceForAssetOwner;
      }
      if (this.config.sourceForAssetName != null && this.config.sourceForAssetName != undefined) {
        this.RFIDtoFeaturePairings["assetName"] = this.config.sourceForAssetName;
      }
      if (this.config.sourceForLatitude != null && this.config.sourceForLatitude != undefined) {
        this.RFIDtoFeaturePairings["latitude"] = this.config.sourceForLatitude;
      }
      if (this.config.sourceForLongitude != null && this.config.sourceForLongitude != undefined) {
        this.RFIDtoFeaturePairings["longitude"] = this.config.sourceForLongitude;
      }
      if (this.config.sourceForTid != null && this.config.sourceForTid != undefined) {
        this.RFIDtoFeaturePairings["tid"] = this.config.sourceForTid;
      }
      if (this.config.sourceForEpc != null && this.config.sourceForEpc != undefined) {
        this.RFIDtoFeaturePairings["epc"] = this.config.sourceForEpc;
      }
      if (this.config.sourceForLock != null && this.config.sourceForLock != undefined) {
        this.RFIDtoFeaturePairings["lock"] = this.config.sourceForLock;
      }

      style.set(this.epcInputNode, "opacity", "0");
      style.set(this.tidInputNode, "opacity", "0");
    
      this._footer_info.innerHTML = this.manifest.copyright + ", Version " + this.manifest.version + ", S1";


      this.readURL = "http://localhost:8080/api/v1/rfid/read";
      this.writeURL = "http://localhost:8080/api/v1/rfid/write";

      // Begin demo setup
      // Code from here to end of demo setup is pulled out for distrubuted version.
      var params = esriUrlUtils.urlToObject(document.location.href);  
      this.spoof = null;
      if (params.query && params.query.s) {  
        this.spoof = params.query.s;
      }  

      if (this.spoof != null) {
        this.readURL = "https://www.customtechnologyltd.com/rfid/read.php";
        this.writeURL = "https://www.customtechnologyltd.com/rfid/write.php";

        if (this.spoof == 42) {
          this.msgDiv = document.createElement('div');
          //html.addClass(this.msgDiv, "jimu-filter-list-value-provider-tip-container");
          this.msgDiv.innerHTML = "<input  type='button' value='Clean' id='spoofCleanBtn' data-dojo-attach-point='spoofCleanBtn' style='float:right'>";
          this._footer_info.parentNode.appendChild(this.msgDiv);

          var handle = dojo.connect(this.msgDiv, "onclick", lang.hitch(this, function (event) {
            console.log("spoofCleanBtn clicked");
            this._spoofClean();
          }));

          this.msgDiv = document.createElement('div');
          //html.addClass(this.msgDiv, "jimu-filter-list-value-provider-tip-container");
          this.msgDiv.innerHTML = "<input  type='button' value='Web BT' id='spoofWebBTBtn' data-dojo-attach-point='spoofWebBTBtn' style='float:right'>";
          this._footer_info.parentNode.appendChild(this.msgDiv);

          var handle = dojo.connect(this.msgDiv, "onclick", lang.hitch(this, function (event) {
            console.log("spoofWebBTBtn clicked");
            this._spoofWebBT();
          }));
        }
      }
    },

    _spoofClean: function () {

      var query = new Query();
      var epcSource = this.config.sourceForEpc["value"];
      query.where = epcSource + " IS NOT NULL";
      this.featureLayer.selectFeatures(query, esri.layers.FeatureLayer.SELECTION_NEW, lang.hitch(this, function (result) {

        var assetListString = result.length + " assets found with " + epcSource + " values:<br>";
        if (result.length) {
          for (var idx = 0; idx < result.length; idx++) {
            assetListString = assetListString + result[idx].attributes[epcSource] + ", ";
          }
        }
        // Check if fields exist for tid, writeDate and readDate which, 
        // in addition to epc, will be cleared.
        var clearList = epcSource;
        var unconfigList = null;
        var tidSource = this.config.sourceForTid["value"];
        var writeDateSource = 'MarkerWriteDate';
        var readDateSource = 'MarkerReadDate';

        // Make an array of field names
        // Need to do it using array.map to force retrieval of field objects
        var fieldNames = array.map(this.featureLayer.fields, function (field) {
          return field.name
        });

        // Create string that lists which fields will be cleared
        if (array.indexOf(fieldNames, tidSource) >= 0) {
          clearList = clearList + ", " + tidSource;
        }
        else {
          unconfigList = tidSource;
        }
        if (array.indexOf(fieldNames, writeDateSource) >= 0) {
          clearList = clearList + ", " + writeDateSource;
        }
        else {
          unconfigList = unconfigList ? unconfigList + ", " + writeDateSource : writeDateSource
        }
        if (array.indexOf(fieldNames, readDateSource) >= 0) {
          clearList = clearList + ", " + readDateSource;
        }
        else {
          unconfigList = unconfigList ? unconfigList + ", " + readDateSource : readDateSource;
        }
        assetListString = assetListString + "<br><br>" + clearList + " will be cleared."
        if (unconfigList != null) {
          assetListString = assetListString + "<br>fields " + unconfigList + " are not configured."
        }
        var dialogParams = {
          'title': "Spoof cleaning",
          'body': assetListString + "<br><br>Reset these assets?",
          'buttons': ["Reset", "Cancel"]
        };
        IMDialogs.confirmDialog(dialogParams)
          .then(lang.hitch(this, function (response) {
            console.log(assetListString);

            // If the reset was confirmed, do it.
            if (response["id"] == 1) {
              for (var idx = 0; idx < result.length; idx++) {

                result[idx].attributes[epcSource] = null;
                if (tidSource) {
                  result[idx].attributes[tidSource] = null;
                }
                if (writeDateSource) {
                  result[idx].attributes[writeDateSource] = null;
                }
                if (readDateSource) {
                  result[idx].attributes[readDateSource] = null;
                }

                // Apply changes to epc, tid and dates all at once as individually seemed to fail at times.
                result[idx].getLayer().applyEdits(null, [result[idx]], null, function () {
                  console.log("Features updated!");
                }, function (error) {
                  console.log("Features not updated! ", error);
                });
              }
            }
          }));
      }));
    },

    _spoofWebBT: function () {
      var myDevice;
      var myService = 0x9800;   // BLE Simulator:
      //var myService = 0x0AF0;   // Karen's cheap heart monitor:
      // https://www.amazon.com/gp/product/B07PLPFX6V/ref=ppx_yo_dt_b_asin_title_o03_s00?ie=UTF8&psc=1

      navigator.bluetooth.requestDevice({
        // filters: [myFilters]       // you can't use filters and acceptAllDevices together
        optionalServices: [myService],
        acceptAllDevices: true
      })
        .then(lang.hitch(this, function (device) {
          // save the device returned so you can disconnect later:
          myDevice = device;
          console.log(device);
          // connect to the device once you find it:
          return device.gatt.connect();
        }))
        .then(lang.hitch(this, function (server) {
          // get the primary service:
          return server.getPrimaryService(myService);
        }))
        .then(lang.hitch(this, function (service) {
          // get the  characteristic:
          console.log("Characteristics of primary service " + service);
          return service.getCharacteristics();
        }))
        .then(lang.hitch(this, function (characteristics) {
          // subscribe to the characteristic:

          // Traverse array of BluetoothRemoteGATTCharacteristic
          characteristics.forEach(lang.hitch(this, function (c) {
            console.log(" - " + c.uuid + ": " + c.properties.notify);
            if (c.properties.notify) {
              c.startNotifications()
                .then(lang.hitch(this, function () {
                  console.log("   startNotifications");
                  c.addEventListener('characteristicvaluechanged', lang.hitch(this, function (event) {
                    console.log("characteristicvaluechanged");
                    this.handleData (event);
                  }));
                  //c.addEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);
                  //c.oncharacteristicvaluechanged = this.handleData;
                }));
            }
          }));
        }))
        .catch(function (error) {
          // catch any errors:
          console.error('BLE error', error);
        });
    },

    onCharacteristicValueChanged: function (e) {
      var str_arr = [];
      for (var i = 0; i < this.value.byteLength; i++) {
        str_arr[i] = this.value.getUint8(i);
      }
      var str = String.fromCharCode.apply(null, str_arr);
      alert("msg:" + str);
    },

    // subscribe to changes from the meter:
    subscribeToChanges: function (characteristic) {
      characteristic.oncharacteristicvaluechanged = handleData;
    },

    // handle incoming data:
    handleData: function (event) {
      // get the data buffer from the meter:
      // event.target.value.readValue()
      //   .then(lang.hitch(this, function (data) {
      //     const sensorLocation = data.getUint8(0);
      //   }));
      var buf = new Uint8Array(event.target.value);
      console.log(buf);
      var str_arr = [];
      for (var i = 0; i < event.target.value.byteLength; i++) {
        str_arr[i] = event.target.value.getUint8(i);
      }
      var str = String.fromCharCode.apply(null, str_arr);
      alert("msg: " + str_arr + "\nas string: " + str);
    },

    // disconnect function:
    disconnect: function () {
      if (myDevice) {
        // disconnect:
        myDevice.gatt.disconnect();
      }
    },

    // End demo setup
    
    resize: function() {
    },

    startup: function() {
      this.inherited(arguments);
      console.log('startup');
    },

    onOpen: function () {
      console.log('onOpen');

      var intialSelection = this.map.infoWindow.getSelectedFeature();
      console.log(intialSelection);

      // If there is no initial selection, initialize just the display,
      // otherwise update selection with the standard method.
      if (intialSelection === null || intialSelection === undefined) {
        this.updateStatus();
      }
      else {
        this.updateSelection();
      }
    },

    // Generate an object containing RFID field values from the paired fields in the selected asset
    updateSelectedAssetRFIDWriteFields: function () {
      if (this.selectedAsset == null || this.selectedAsset == undefined) {
        return;
      }
      var featureKeys = Object.keys(this.selectedAsset.attributes);
      var RFIDPairingKeys = Object.keys(this.RFIDtoFeaturePairings);
      array.forEach(RFIDPairingKeys, lang.hitch(this, function (RFIDkey, attributeIdx) {
        var source = this.RFIDtoFeaturePairings[RFIDkey]["source"];
        var value = this.RFIDtoFeaturePairings[RFIDkey]["value"];

        // "source" defines where to get this RFID field's value.

        // "featureLayer" uses the value from a field in the feature layer
        if (source == "featureLayer") {
          this.selectedAssetRFIDWriteFields[RFIDkey] = this.selectedAsset.attributes[value];
        }

        // "assign" simply assigns the corresponding value from the config
        else if (source == "assign") {
          this.selectedAssetRFIDWriteFields[RFIDkey] = value;
        }

        // "special"  uses the value to select a special function 
        else if (source == "special") {
          switch (value) {

            case "mapLatitude":
              this.selectedAssetRFIDWriteFields[RFIDkey] = this._getLatitudeFromFeature(this.selectedAsset);
              break;

            case "mapLongitude":
              this.selectedAssetRFIDWriteFields[RFIDkey] = this._getLongitudeFromFeature(this.selectedAsset);
              break;
          }
        }

      }));

      // The date field displays the last time the asset's marker was written,
      // which is stored in 'MarkerWriteDate' field in the feature layer.
      // The Marker write date field should probably be configured,
      // but for the first release it is hard-codoed.
      var writeDate = this.selectedAsset.attributes['MarkerWriteDate'];
      if (writeDate != null) {
        this.selectedAssetRFIDWriteFields['dateTime'] = writeDate;
      }
      else delete this.selectedAssetRFIDWriteFields.dateTime;
    },

    onClose: function () {
      console.log('onClose');
    },

    onMinimize: function () {
      console.log('onMinimize');
    },

    onMaximize: function () {
      console.log('onMaximize');
    },

    onSignIn: function (credential) {
      /* jshint unused:false*/
      console.log('onSignIn');
    },

    onSignOut: function () {
      console.log('onSignOut');
    },

    updateStatus: function () {
      if (this.selectedAsset !== null && this.selectedAsset !== undefined) {
        this.statusNode.innerHTML = "";

        var fadeArgs = {
          node: this.markerFieldBlock
        };
        baseFx.fadeIn(fadeArgs).play();

        this.writeTagButton.disabled = false;
      }
      else {
        this.statusNode.innerHTML = "Please select an asset.";
        this.writeTagButton.disabled = true;

        var fadeArgs = {
          node: this.markerFieldBlock
        };
        baseFx.fadeOut(fadeArgs).play();
      }
    },
   
    updateSelection: function () {
      console.log("selection was changed?");
      prevAsset = this.selectedAsset;
      this.selectedAsset = this.map.infoWindow.getSelectedFeature();

      if (this.selectedAsset != prevAsset) {
        this.writeAttempt = { "selectedAsset": this.selectedAsset };
        this.updateSelectedAssetRFIDWriteFields();
        this.updateDisplayFields(this.selectedAssetRFIDWriteFields);
        this.updateStatus();
      }
      
    },

    updateDisplayFields: function (RFIDWriteFields) {

      // The tid and epc fields are taken from the pre-assigned values on the tag.
      // Don't display values until a successful read is done.
      if (this.writeAttempt["readStatus"] == "success") {
        this.tidInputNode.value = RFIDWriteFields['tid'];
        this.epcInputNode.value = RFIDWriteFields['epc'];
      }
      else {
        this.tidInputNode.value = "<will be assignned from tag>";
        this.epcInputNode.value = "<will be assignned from tag>";
      }

      this.assetNameInputNode.value = RFIDWriteFields['assetName'];
      this.assetOwnerInputNode.value = RFIDWriteFields['assetOwner'];
      this.latitudeInputNode.value = RFIDWriteFields['latitude'];
      this.longitudeInputNode.value = RFIDWriteFields['longitude'];

      // The dateTime in RFIDWriteFields is in the format returned by the feature layer,
      // which is a UNIX timestamp so needs some massaging to look good.
      var writeDate = RFIDWriteFields['dateTime'];
      if (writeDate == null) writeDate = "";
      else writeDate = new Date(writeDate).toLocaleString();
      this.dateTimeInputNode.value = writeDate;
    },

    // called from html button
    _clickWriteTag: function () {

      // Get ready to write tag
      console.log('Write RFID Tag button clicked');
      this.statusNode.innerHTML = "";
      var dialogParams = {
        'title': "Aim Reader",
        'body': "Please ensure the reader is pointing at the marker to be written and click OK.\n\n",
        'buttons': ["OK", "Skip this reminder"]
      }
      IMDialogs.confirmDialog(dialogParams, "skip")
        .then(lang.hitch(this, function (response) {

          console.log("confirmDialog response from " + response["id"]);
          this._writeTag(this.readURL, this.writeURL);
        }));
    },

     _writeTag: function (apiReadUrl, apiWriteUrl) {

      var rfidRequest = this._readOldSchool(apiReadUrl);
      rfidRequest.then(lang.hitch(this, function (response) {
        // The request went OK
        if (response && response.type !== 'error') {
          console.log(response.data);

          // Check the returned data for multiple tags,
          if (response.data.length > 1) {
            this.statusNode.innerHTML = "Multiple markers detected. Get closer and try again.";
            return;
          }

          this.writeAttempt["readStatus"] = "success";
          this.selectedAssetRFIDWriteFields['tid'] = response.data[0]['tid'];
          this.selectedAssetRFIDWriteFields['epc'] = response.data[0]['epc'];
          this.updateDisplayFields(this.selectedAssetRFIDWriteFields);

          this.statusNode.innerHTML = "Information below is being written to the marker.";

          style.set(this.markerFieldBlock, "opacity", "1");
            var fadeArgs = {
              node: this.markerFieldBlock
            };
            baseFx.fadeIn(fadeArgs).play();
        
          var dialogParams = {
            'title': "Confirm to write marker",
            'body': "Please ensure the reader is pointing at the marker to be written and in close for writing.\n\nInformation below will be written to the marker.\n\n(List will be displayed here but for now its in main widget window)",
            'buttons': ["OK", "Cancel"]
          }
          IMDialogs.confirmDialog(dialogParams, "skip")
            .then(lang.hitch(this, function (response) {
              console.log("confirmDialog response from " + response["id"]);

              this._writeOldSchool(apiWriteUrl);
            }));
        }

        else {
          errorMsg = response.err;
          console.log(errorMsg);
          if (response.err.match(/no transponder found/i) != null) {
            errorMsg = "No markers found."
          }
          this.statusNode.innerHTML = "Unable to write marker: " + errorMsg;
        }
      }));
    },

    _readOldSchool: function (apiUrl) {

      var resultDef = new Deferred();

      // Create a new http handler
      var xhttp = new XMLHttpRequest();

      // Bind the response sent event handler
      xhttp.onreadystatechange = lang.hitch(this, function () {
        if (xhttp.readyState == 4 && xhttp.status == 200) {

          // The request was successful
          var filteredResponse = JSON.parse(xhttp.responseText);

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

    _writeOldSchool: function (apiUrl) {

      // Use values form selectedAssetRFIDWriteFields which retains the appropriate type,
      // e.g. latitude should be a number, not string, for api.
      let paramObj = {
        "tid": this.selectedAssetRFIDWriteFields["tid"],
        "epc": this.selectedAssetRFIDWriteFields["epc"],
        "assetOwner": this.selectedAssetRFIDWriteFields["assetOwner"],
        "assetName": this.selectedAssetRFIDWriteFields["assetName"],
        "latitude": this.selectedAssetRFIDWriteFields["latitude"],
        "longitude": this.selectedAssetRFIDWriteFields["longitude"],
        "lock": this.selectedAssetRFIDWriteFields["lock"],
      };

      let params = "tid=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["tid"]) +
        "&epc=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["epc"]) +
        "&assetOwner=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["assetOwner"]) +
        "&assetName=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["assetName"]) +
        "&latitude=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["latitude"]) +
        "&longitude=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["longitude"]) +
        "&lock=" + encodeURIComponent(this.selectedAssetRFIDWriteFields["lock"]);

      console.log('write', params);

      // Create a new http handler
      var xhttp = new XMLHttpRequest();
      xhttp.open('POST', apiUrl, true);

      //Send the proper header information along with the request
      xhttp.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');

      //Call a function when the state changes.
      xhttp.onreadystatechange = lang.hitch(this, function () {
        if (xhttp.readyState == 4 && xhttp.status == 200) {

          // The request was successful
          var response = JSON.parse(xhttp.responseText);

          this._handleWriteResponse(response);
        }
        else if (xhttp.readyState == 4) {
          // Error
          alert("There was an error while trying to write a marker.\n" + apiUrl + "\n" + xhttp.responseText);
          this.statusNode.innerHTML = "Error encountered writing marker:\n" + xhttp.responseText;
        }
      });
      xhttp.send(params);
    },

    // Called after a successful write
    _handleWriteResponse: function (response) {
      console.log("success on writing ", response);
      this.statusNode.innerHTML = "Marker was successfully written.";
      this.writeAttempt["writeStatus"] = "success";

      // Write the epc back to the feature layer
      var epcPairedField = null;
      var epcPairing = this.RFIDtoFeaturePairings["epc"];
      if (epcPairing != undefined && epcPairing["source"] == "featureLayer") {
        epcPairedField = epcPairing["value"];
      }
      var epcOnMarker = response["epc"];
      if (epcPairedField != null && epcOnMarker != null && epcOnMarker != undefined) {
        this.selectedAsset.attributes[epcPairedField] = epcOnMarker;
      }

      // Write the tid back to the feature layer
      var tidPairedField = null;
      var tidPairing = this.RFIDtoFeaturePairings["tid"];
      if (tidPairing != undefined && tidPairing["source"] == "featureLayer") {
        tidPairedField = tidPairing["value"];
      }
      var tidOnMarker = response["tid"];
      if (tidPairedField != null && tidOnMarker != null && tidOnMarker != undefined) {
        this.selectedAsset.attributes[tidPairedField] = tidOnMarker;
      }

      // The Marker Write Date is taken from the server's response
      // and written back to the (currently) hard-coded field in the feature layer
      var rawDateTimeFromServer = response['dateTime'];
      var writeDate = this.selectedAsset.attributes['MarkerWriteDate'];
      if (writeDate !== undefined && rawDateTimeFromServer != null && rawDateTimeFromServer != undefined) {

        // Check to make sure whatever string the server returns can be converted to a valid date,
        // which JavaScript stores as a UNIX timestamp.
        var tsDateTimeFromServer = new Date(rawDateTimeFromServer);
        if (tsDateTimeFromServer != null) { // undefined is implied
          this.selectedAsset.attributes['MarkerWriteDate'] = tsDateTimeFromServer.valueOf();
  
          // Finally update the value displayed to the user with the local string.
          this.dateTimeInputNode.value = tsDateTimeFromServer.toLocaleString();
         }
        else console.log("dateTime returned by server:\n" + rawDateTimeFromServer +"\ncannot be converted to UNIX timestamp");
      }

      // Apply changes to epc, tid and date all at once as individually seemed to fail at times.
      this.selectedAsset.getLayer().applyEdits(null, [this.selectedAsset], null, function () {
        console.log("Features updated!");
      }, function (error) {
        console.log("Features not updated! ", error);
      });
    },

    _getLatitudeFromFeature: function(feature) {
      if (feature.geometry.type === 'point'){
        return feature.geometry.getLatitude();
      }
      return null;
    },

    _getLongitudeFromFeature: function(feature) {
      if (feature.geometry.type === 'point'){
        return feature.geometry.getLongitude();
      }
      return null;
    },

  });
});
