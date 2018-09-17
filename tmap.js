(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('echarts')) :
        typeof define === 'function' && define.amd ? define(['exports', 'echarts'], factory) :
            (factory((global.tmap = {}), global.echarts));
}(this, (function (exports, echarts) {
    'use strict';

    /*
    * Licensed to the Apache Software Foundation (ASF) under one
    * or more contributor license agreements.  See the NOTICE file
    * distributed with this work for additional information
    * regarding copyright ownership.  The ASF licenses this file
    * to you under the Apache License, Version 2.0 (the
    * "License"); you may not use this file except in compliance
    * with the License.  You may obtain a copy of the License at
    *
    *   http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing,
    * software distributed under the License is distributed on an
    * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    * KIND, either express or implied.  See the License for the
    * specific language governing permissions and limitations
    * under the License.
    * 此扩展参考了官方的百度地图扩展以及https://github.com/gnijuohz/echarts-leaflet
    * 感谢所有人员
    */
    
    /* global BMap */

    function TMapCoordSys(tmap, api) {
        this._tmap = tmap;
        this.dimensions = ['lng', 'lat'];
        this._maxBounds = null;
        this._api = api;
        this._mapOffset = [0, 0];
        this._projection = "EPSG: 900913";
    }

    TMapCoordSys.prototype.dimensions = ['lng', 'lat'];

    TMapCoordSys.prototype.setZoom = function (zoom) {
        this._zoom = zoom;
    };

    TMapCoordSys.prototype.setMapOffset = function (mapOffset) {
        this._mapOffset = mapOffset;
    };

    TMapCoordSys.prototype.setCenter = function (center) {
        var lnt = new T.LngLat(center[0], center[1]);
        this._center = this._tmap.lngLatToContainerPoint(lnt);
    };

    TMapCoordSys.prototype.setMaxBounds = function (bounds) {
        this._maxBounds = new T.LngLatBounds(new T.LngLat(bounds[0], bounds[1]), new T.LngLat(bounds[2], bounds[3]));
    };

    TMapCoordSys.prototype.getTMap = function () {
        return this._tmap;
    };

    TMapCoordSys.prototype.dataToPoint = function (data) {
        var point = new T.LngLat(data[0], data[1]);
        var px = this._tmap.lngLatToLayerPoint(point);
        var mapOffset = this._mapOffset;
        return [px.x - mapOffset[0], px.y - mapOffset[1]];
    };

    TMapCoordSys.prototype.pointToData = function (pt) {
        var mapOffset = this._mapOffset;
        var npt = this._tmap.layerPointToLngLat({
            x: pt[0] + mapOffset[0],
            y: pt[1] + mapOffset[1]
        });
        return [npt.lng, npt.lat];
    };

	TMapCoordSys.prototype.convertToPixel = echarts.util.curry(doConvert, 'dataToPoint');

	TMapCoordSys.prototype.convertFromPixel = echarts.util.curry(doConvert, 'pointToData');

  /**
   * find appropriate coordinate system to convert
   * @param {*} methodName
   * @param {*} ecModel
   * @param {*} finder
   * @param {*} value
   * @return {*} converted value
   */
  function doConvert(methodName, ecModel, finder, value) {
    var tmapModel = finder.tmapModel;
    var seriesModel = finder.seriesModel;

    var coordSys = tmapModel ? tmapModel.coordinateSystem : seriesModel ? seriesModel.coordinateSystem || // For map.
    (seriesModel.getReferringComponents('tmap')[0] || {}).coordinateSystem : null;
    /* eslint-disable no-invalid-this */
    return coordSys === this ? coordSys[methodName](value) : null;
  }
  
    TMapCoordSys.prototype.getViewRect = function () {
        var api = this._api;
        return new echarts.graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight());
    };

    TMapCoordSys.prototype.getRoamTransform = function () {
        return echarts.matrix.create();
    };

    // For deciding which dimensions to use when creating list data
    TMapCoordSys.dimensions = TMapCoordSys.prototype.dimensions;

   

    var CustomOverlay = T.Overlay.extend({
        initialize: function initialize(container) {
            this._container = container;
        },

        onAdd: function onAdd(map) {
			this.map=map;
            map.getPanes().overlayPane.appendChild(this._container);
            // Calculate initial position of container with
            // `L.Map.latLngToLayerPoint()`, `getPixelOrigin()
            // and/or `getPixelBounds()`

            // L.DomUtil.setPosition(this._container, point);

            // Add and position children elements if needed

            // map.on('zoomend viewreset', this._update, this);
        },

        onRemove: function onRemove() {
            var parent = this._container.parentNode;
                    if (parent) {
                        parent.removeChild(this._container);
                        this.map = null;
                        this._container = null;
                    }
        },

        update: function update() {
			console.log("updated");
            // Recalculate position of container
            // L.DomUtil.setPosition(this._container, point);
            // Add/remove/reposition children elements if needed
        }
    });

    TMapCoordSys.create = function (ecModel, api) {
        var tMapCoordSys=void 0;
        var root = api.getDom();

        // TODO Dispose
        ecModel.eachComponent('tmap', function (tmapModel) {
            var painter = api.getZr().painter;
            var viewportRoot = painter.getViewportRoot();
            if (typeof T === 'undefined') {
                throw new Error('TMap api is not loaded');
            }
			
            if (tMapCoordSys) {
                throw new Error('Only one tmap component can exist');
            }
            if (!tmapModel.__tmap) {

                var tmapRoot = root.querySelector('.ec-extension-tmap');
                if (tmapRoot) {
                    viewportRoot.style.left = '0px';
                    viewportRoot.style.top = '0px';
                    root.removeChild(tmapRoot);
                }
                tmapRoot = document.createElement('div');
                tmapRoot.style.cssText = 'width:100%;height:100%';
                // Not support IE8
                tmapRoot.classList.add('ec-extension-tmap');
                root.appendChild(tmapRoot);
                var tmap = tmapModel.__tmap = new T.Map(tmapRoot);

                var overlay = new CustomOverlay(viewportRoot);
                tmap.addOverLay(overlay);

                // Override
                painter.getViewportRootOffset = function () {
                    return { offsetLeft: 0, offsetTop: 0 };
                };
            }
            var map = tmapModel.__tmap;
            // Set bmap options
            // centerAndZoom before layout and render
            var center = tmapModel.get('center');
            var zoom = tmapModel.get('zoom');
            //console.log(center);
            if (center && zoom) {
                var pt = new T.LngLat(center[0], center[1]);
                map.centerAndZoom(pt, zoom);
            }

            tMapCoordSys = new TMapCoordSys(map, api);
            tMapCoordSys.setMapOffset(tmapModel.__mapOffset || [0, 0]);
            tMapCoordSys.setZoom(zoom);
            tMapCoordSys.setCenter(center);

            tmapModel.coordinateSystem = tMapCoordSys;
        });

        ecModel.eachSeries(function (seriesModel) {
            if (seriesModel.get('coordinateSystem') === 'tmap') {
                seriesModel.coordinateSystem = tMapCoordSys;
            }
        });
    };

    /*
    * Licensed to the Apache Software Foundation (ASF) under one
    * or more contributor license agreements.  See the NOTICE file
    * distributed with this work for additional information
    * regarding copyright ownership.  The ASF licenses this file
    * to you under the Apache License, Version 2.0 (the
    * "License"); you may not use this file except in compliance
    * with the License.  You may obtain a copy of the License at
    *
    *   http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing,
    * software distributed under the License is distributed on an
    * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    * KIND, either express or implied.  See the License for the
    * specific language governing permissions and limitations
    * under the License.
    */

    function v2Equal(a, b) {
        return a && b && a[0] === b[0] && a[1] === b[1];
    }

    echarts.extendComponentModel({
        type: 'tmap',

        getTMap: function () {
            // __tmap is injected when creating TMapCoordSys
            return this.__tmap;
        },

        setCenterAndZoom: function (center, zoom) {
            this.option.center = center;
            this.option.zoom = zoom;
        },

        centerOrZoomChanged: function (center, zoom) {
			console.log(this.option);
            var option = this.option;
            return !(v2Equal(center, option.center) && zoom === option.zoom);
        },

        defaultOption: {

            center: [104.114129, 37.550339],

            zoom: 5

        }
    });

    /*
    * Licensed to the Apache Software Foundation (ASF) under one
    * or more contributor license agreements.  See the NOTICE file
    * distributed with this work for additional information
    * regarding copyright ownership.  The ASF licenses this file
    * to you under the Apache License, Version 2.0 (the
    * "License"); you may not use this file except in compliance
    * with the License.  You may obtain a copy of the License at
    *
    *   http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing,
    * software distributed under the License is distributed on an
    * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    * KIND, either express or implied.  See the License for the
    * specific language governing permissions and limitations
    * under the License.
    */

    echarts.extendComponentView({
        type: 'tmap',

        render: function (tMapModel, ecModel, api) {
            var rendering = true;

            var tmap = tMapModel.getTMap();
            var viewportRoot = api.getZr().painter.getViewportRoot();
            var coordSys = tMapModel.coordinateSystem;
            var moveHandler = function moveHandler(type, target) {
                if (rendering) {
                    return;
                }
                var offsetEl = viewportRoot.parentNode.parentNode;
				
				var transformStyle = offsetEl.style.transform;
				
				var dx = 0;
				var dy = 0;
				if (transformStyle) {
					transformStyle = transformStyle.replace('translate3d(', '');
				var parts = transformStyle.split(',');
				dx = parseInt(parts[0], 10);
				dy = parseInt(parts[1], 10);
				} else {
					// browsers that don't support transform: matrix
						dx = -parseInt(offsetEl.style.left, 10);
						dy = -parseInt(offsetEl.style.top, 10);
				}
				var mapOffset = [dx, dy];
				viewportRoot.style.left = mapOffset[0] + 'px';
				viewportRoot.style.top = mapOffset[1] + 'px';
				
                coordSys.setMapOffset(mapOffset);
                tMapModel.__mapOffset = mapOffset;
				
				offsetEl.getElementsByClassName("tdt-pane tdt-overlay-pane")[0].style.visibility="inherit";
 
                api.dispatchAction({
                    type: 'tmapRoam'
                });
            };

            function zoomEndHandler() {
                if (rendering) {
                    return;
                }
                api.dispatchAction({
                    type: 'tmapRoam'
                });
            }
			function zoomHandler() {
				moveHandler();
			}
            tmap.removeEventListener('move', this._oldMoveHandler);
			tmap.removeEventListener('zoom',this._oldZoomHandler);
            tmap.removeEventListener('zoomend', this._oldZoomEndHandler);
			
            tmap.addEventListener('move', moveHandler);         
            tmap.addEventListener('zoom', zoomHandler);
            tmap.addEventListener('zoomend', zoomEndHandler);

            this._oldMoveHandler = moveHandler;
			this._oldZoomHandler=zoomHandler;
            this._oldZoomEndHandler = zoomEndHandler;

            var roam = tMapModel.get('roam');
            if (roam && roam !== 'scale') {
                tmap.enableDrag();
            }
            else {
                tmap.disableDrag();
            }
            if (roam && roam !== 'move') {
                tmap.enableScrollWheelZoom();
                tmap.enableDoubleClickZoom();
                //tmap.enablePinchToZoom();
            }
            else {
                tmap.disableScrollWheelZoom();
                tmap.disableDoubleClickZoom();
                //tmap.disablePinchToZoom();
            }

            //var originalStyle = tMapModel.__mapStyle;

            //var newMapStyle = tMapModel.get('mapStyle') || {};
            //// FIXME, Not use JSON methods
            //var mapStyleStr = JSON.stringify(newMapStyle);
            //if (JSON.stringify(originalStyle) !== mapStyleStr) {
            //    // FIXME May have blank tile when dragging if setMapStyle
            //    if (Object.keys(newMapStyle).length) {
            //        bmap.setMapStyle(newMapStyle);
            //    }
            //    tMapModel.__mapStyle = JSON.parse(mapStyleStr);
            //}

            rendering = false;
        }
    });

    /*
    * Licensed to the Apache Software Foundation (ASF) under one
    * or more contributor license agreements.  See the NOTICE file
    * distributed with this work for additional information
    * regarding copyright ownership.  The ASF licenses this file
    * to you under the Apache License, Version 2.0 (the
    * "License"); you may not use this file except in compliance
    * with the License.  You may obtain a copy of the License at
    *
    *   http://www.apache.org/licenses/LICENSE-2.0
    *
    * Unless required by applicable law or agreed to in writing,
    * software distributed under the License is distributed on an
    * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    * KIND, either express or implied.  See the License for the
    * specific language governing permissions and limitations
    * under the License.
    */

    /**
     * BMap component extension
     */

    echarts.registerCoordinateSystem('tmap', TMapCoordSys);

    // Action
    echarts.registerAction({
        type: 'tmapRoam',
        event: 'tmapRoam',
        update: 'updateLayout'
    }, function (payload, ecModel) {
        ecModel.eachComponent('tmap', function (tMapModel) {
            var tmap = tMapModel.getTMap();
            var center = tmap.getCenter();
            tMapModel.setCenterAndZoom([center.lng, center.lat], tmap.getZoom());
        });
    });

    var version = '1.0.0';

    exports.version = version;

})));
//# sourceMappingURL=bmap.js.map