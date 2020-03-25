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

define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dojo/_base/lang',
  'dojo/_base/array',
  '../IMDialogs',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/DataSourceManager',
  'jimu/LayerInfos/LayerInfos',
  'dijit/form/Select'
],
function(declare, BaseWidgetSetting, lang, array, IMDialogs, _WidgetsInTemplateMixin, DataSourceManager, LayerInfos) {

  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-infraMarkerRead-setting',
    dataSourceManager: null,
    layerInfosObj: null,

    postMixInProperties: function() {
      this.inherited(arguments);
      lang.mixin(this.nls, window.jimuNls.common);
      lang.mixin(this.nls, window.jimuNls.timeUnit);
      this.dataSourceManager = DataSourceManager.getInstance();
      this.layerInfosObj = LayerInfos.getInstanceSync();
    },

    postCreate: function(){
      //the config object is passed in
      this.setConfig(this.config);
    },

    setConfig: function(config){
      
      // Get all feature layers from the map
      LayerInfos.getInstance(this.map, this.map.itemInfo)
        .then(lang.hitch(this, function (layerInfosObj) {
          var infos = layerInfosObj.getLayerInfoArray();
          var options = [{label: 'No layer selected', value: ''}];
          array.forEach(infos, function (info) {
            if (info.originOperLayer.layerType === 'ArcGISFeatureLayer') {
              options.push({
                label: info.title,
                value: info.id
              });
            }
          });
          this.layerSelect.set('options', options);
          this.layerSelect.on('change', lang.hitch(this, function (value) {
            var selectedLayer = layerInfosObj.getLayerInfoById(value);
            if (selectedLayer) {
              var fieldOptions = array.map(selectedLayer.layerObject.fields, function (field) {
                return {
                  label: field.alias || field.name,
                  value: field.name
                }
              });
              fieldOptions.unshift({label: 'No field selected', value: ''});
              this.assetIdForRFIDSelect.set('options', fieldOptions);
            }
          }));
        }));
    },

    getConfig: function(){
      //WAB will get config object through this method

      // if no epc field is configured, pop up an error message and don't exit settings.
      var epcField = this.assetIdForRFIDSelect.get('value');
      if (epcField == "") {
        var dialogParams = {
          'title': "Warning",
          'body': "An RFID key field must be provided.",
          'buttons': "OK"
        };
        IMDialogs.confirmDialog(dialogParams)
        .then(lang.hitch(this, function (response) {
          console.log("RFID key field not provided");
        }));
        return false;
      }
      return {
        layerId: this.layerSelect.get('value'),
        assetIdForRFID: epcField,
      };
    }
  });
});