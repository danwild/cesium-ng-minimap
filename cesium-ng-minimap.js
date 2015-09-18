/**
 * Created by danielwild on 10/09/2015.
 */

'use strict';

angular.module('cesium.minimap', [])

.directive('cesiumMiniMap', [function() {

	return {
		templateUrl : 'components/minimap/minimap.html',
		controller : 'miniMapController'
	};
}])

.controller('miniMapController', ['$scope', 'miniMapService', 'miniMapState', function($scope, miniMapService, miniMapState) {

		$scope.miniMapService = miniMapService;
		$scope.miniMapState = miniMapState;
}])

.factory('miniMapState', [function() {

		var state = {
			init: false,
			expanded: true,
			focused: true,
			nationalScale: true
		}

		return state;
}])

/**
 *
 * Add 2d mini map to your cesium viewer
 * fires an event 'extentOfInterestChanged' with a buffered map extent.
 *
 */
.factory('miniMapService', ['$rootScope', 'miniMapState',
		function($rootScope, miniMapState) {


		var service = {};

		service.parentViewer;
		service.miniViewer;

		service.parentCamera;
		service.container;
		service.bounds;

		var miniRectangleId = "miniRectangle";
		var globeRectangleId = "globeRectangle";

		service.options = {
			animation: false,
			baseLayerPicker: false,
			fullscreenButton: false,
			geocoder: false,
			homeButton: false,
			infoBox: false,
			sceneModePicker: false,
			selectionIndicator: false,
			timeline: false,
			navigationHelpButton: false,
			navigationInstructionsInitiallyVisible: false,
			orderIndependentTranslucency: false,
			sceneMode: Cesium.SceneMode.SCENE2D,
			mapProjection: new Cesium.WebMercatorProjection()
		};

		/**
		 *
		 * @param parentViewer the 3d parent globe viewer
		 * @param imageryProvider the imageryProvider to be used on the minimap
		 *
		 */
		service.init = function(parentViewer, imageryProvider){

			service.parentViewer = parentViewer;
			service.parentCamera = service.parentViewer.scene.camera;

			setupMap();
			setupListeners();

			service.miniViewer.scene.imageryLayers.addImageryProvider(imageryProvider);
			service.miniViewer.camera.viewRectangle(ausExtent);

			miniMapState.init = true;
		};

		/**
		 *
		 * Expand/contract the minimap
		 *
		 */
		service.toggle = function() {
			miniMapState.expanded = !miniMapState.expanded;
		};

		/**
		 *
		 * Show/hide the extent/rectangle entity on the parent globe
		 *
         */
		service.setExtentVisible = function(visible){

			if(visible && !miniMapState.nationalScale && service.bounds.hasOwnProperty("rectangle")){

				updateOrAddRectangleEntity(service.parentViewer, service.bounds.rectangle, globeRectangleId);
			}
			else {
				service.parentViewer.entities.removeById(globeRectangleId);
			}

		};

		/**
		 * Setup the minimap, add any special scene config here
		 *
		 */
		function setupMap() {

			var viewer = new Cesium.Viewer(document.getElementById("minimapContainer"), service.options);
			viewer.scene.imageryLayers.removeAll();

			var scene = viewer.scene;
			scene.screenSpaceCameraController.enableRotate = false;
			scene.screenSpaceCameraController.enableTranslate = false;
			scene.screenSpaceCameraController.enableZoom = false;
			scene.screenSpaceCameraController.enableTilt = false;
			scene.screenSpaceCameraController.enableLook = false;
			service.miniViewer = viewer;
		}

		/**
		 *
		 * Use move start/stop so we're only looping when it matters
		 *
		 */
		function mapMoving(){

			service.intervalHandle = setInterval(function() {

				// get buffered rectangle for extent
				service.bounds = getExtentBounds(-150);

				if(service.bounds){

					// get miniMap rectangle for display bounds
					var miniMapRectangle = getViewRectangle(100);

					if(cesiumUtil.isValidRectangle(miniMapRectangle)){

						updateOrAddRectangleEntity(service.miniViewer, service.bounds.rectangle, miniRectangleId);

						service.miniViewer.scene.camera.viewRectangle(miniMapRectangle);
						miniMapState.nationalScale = false;

						// safe apply
						if(!$rootScope.$$phase) {
							$rootScope.$apply();
						}
					}
					else {
						fallbackView();
					}
				}
				else {
					fallbackView();
				}

			}, 10);
		};

		/**
		 * quit interval when map inactive
		 */
		function mapStopped(){
			clearInterval(service.intervalHandle);

			$rootScope.$broadcast('extentOfInterestChanged', service.bounds.extent);

			console.log("stopped");
			if(miniMapState.nationalScale){
				service.miniViewer.entities.removeById(miniRectangleId)
			};
		};

		function updateOrAddRectangleEntity(viewer, rectangle, id) {

			var rectangleEntity = viewer.entities.getById(id);

			if(rectangleEntity){
				rectangleEntity.rectangle.coordinates = rectangle;
			}
			else {
				viewer.entities.add({
					id: id,
					rectangle : {
						coordinates : rectangle,
						outline : true,
						outlineColor : Cesium.Color.RED,
						outlineWidth : 3,
						material : Cesium.Color.RED.withAlpha(0.0)
					}
				});
			}
		};


		/**
		 * Get a position for each four corners of the canvas
		 *
         * @param offset
		 * @returns {Array}
		 */
		function getCanvasCorners(offset){

			// retina displays are the future, man
			var pixelRatio = window.devicePixelRatio || 1;
			var ellipsoid = Cesium.Ellipsoid.WGS84;

			var corners = [];

			// topLeft
			var c2Pos = new Cesium.Cartesian2(-offset, -offset);
			corners.push(service.parentViewer.scene.camera.pickEllipsoid(c2Pos, ellipsoid));

			// bottomLeft
			c2Pos = new Cesium.Cartesian2(
				-offset,
				(service.parentViewer.scene.canvas.height / pixelRatio) + offset
			);
			corners.push(service.parentViewer.scene.camera.pickEllipsoid(c2Pos, ellipsoid));

			// bottomRight
			c2Pos = new Cesium.Cartesian2(
				(service.parentViewer.scene.canvas.width / pixelRatio) + offset,
				(service.parentViewer.scene.canvas.height / pixelRatio) + offset
			);
			corners.push(service.parentViewer.scene.camera.pickEllipsoid(c2Pos, ellipsoid));

			// topRight
			var c2Pos = new Cesium.Cartesian2(
				(service.parentViewer.scene.canvas.width / pixelRatio) + offset,
				-offset
			);
			corners.push(service.parentViewer.scene.camera.pickEllipsoid(c2Pos, ellipsoid));


			// make sure we've got valid positions for each of the canvas corners
			// (invalid if we've got sky)
			for(var i = 0; i < corners.length; i++){

				if(corners[i]){
					corners[i] = ellipsoid.cartesianToCartographic(corners[i]);
				}

				else {
					fallbackView();
					return;
				}
			}

			return corners;
		};

		/**
		 *
		 * Shuffles the canvas corner orientations to
		 * eliminate rectangle skew caused by offset globe headings
		 * i.e. if globe is at 20 degrees topRight becomes the highest latitude for our 2d bounds
		 *
		 * @param degrees
		 * @param corners
		 * @returns {{rectangle: (Cesium.Rectangle.fromDegrees|*), extent: {xmin: *, ymin: *, xmax: *, ymax: *}}}
		 */
		function getOrientedBounds(degrees, corners){

			var rectangle;

			/*
				 <degrees> -> <north corner>

				 0-90 -> topRight
				 90-180 -> bottomRight
				 180-270 -> bottomLeft
				 270-360 -> topRight

				 <northIndex> -> [cornerIndexes]

				 0 = [0,1,2,3]
				 1 = [3,0,1,2]
				 2 = [2,3,0,1]
				 3 = [1,2,3,0]
			 */

			var northCornerIndex = Math.abs(parseInt(degrees / 90));
			var cornerPositions = [
				[0,1,2,3],
				[3,0,1,2],
				[2,3,0,1],
				[1,2,3,0]
			];

			// west, south, east, north
			rectangle = new Cesium.Rectangle.fromDegrees(
				Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][0] ].longitude),
				Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][1] ].latitude),
				Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][2] ].longitude),
				Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][3] ].latitude)
			);

			//xmin, ymin, xmax, ymax
			var extent = {
				'xmin': Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][0] ].longitude),
				'ymin': Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][1] ].latitude),
				'xmax': Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][2] ].longitude),
				'ymax': Cesium.Math.toDegrees(corners[ cornerPositions[northCornerIndex][3] ].latitude)
			};

			return {
				rectangle: rectangle,
				extent: extent
			};
		};

		/**
		 * Gets the extent of bounds + offset
		 *
		 * @param offset
		 * @returns {{rectangle, extent}|{rectangle: (Cesium.Rectangle.fromDegrees|*), extent: {xmin: *, ymin: *, xmax: *, ymax: *}}}
		 */
		function getExtentBounds(offset) {

			var corners = getCanvasCorners(offset);

			if(!corners){
				return;
			}

			var heading = parseFloat(Cesium.Math.toDegrees(service.parentCamera.heading));
			var degrees = 360 - heading;

			return getOrientedBounds(degrees, corners);
		};

		/**
		 *
		 * Get rectangle of current view + offset
		 * don't bother adjusting orientation as Cesiums viewRectangle() seems to work ok regardless
		 *
		 * @param offset
		 * @returns rectangle or null
		 */
		function getViewRectangle(offset){

			var ellipsoid = Cesium.Ellipsoid.WGS84;

			// retina displays are the future, man
			var pixelRatio = window.devicePixelRatio || 1;

			var c2 = new Cesium.Cartesian2(-offset, -offset);
			var leftTop = service.parentViewer.scene.camera.pickEllipsoid(c2, ellipsoid);

			c2 = new Cesium.Cartesian2(
				(service.parentViewer.scene.canvas.width / pixelRatio) + offset,
				(service.parentViewer.scene.canvas.height / pixelRatio) + offset
			);

			var rightDown = service.parentViewer.scene.camera.pickEllipsoid(c2, ellipsoid);

			if(leftTop != null && rightDown != null){

				leftTop = ellipsoid.cartesianToCartographic(leftTop);
				rightDown = ellipsoid.cartesianToCartographic(rightDown);

				// west, south, east, north
				var rectangle = new Cesium.Rectangle.fromDegrees(
					Cesium.Math.toDegrees(leftTop.longitude),
					Cesium.Math.toDegrees(rightDown.latitude),
					Cesium.Math.toDegrees(rightDown.longitude),
					Cesium.Math.toDegrees(leftTop.latitude)
				);

				return rectangle;
			}

			// The sky is visible in 3D, fallback to ausExtent national map
			else {

				fallbackView();
				return null;
			}
		}

		function fallbackView(){

			console.log("falling back to national scale");

			service.miniViewer.camera.viewRectangle(ausExtent);
			miniMapState.nationalScale = true;

			clearInterval(service.intervalHandle);

			// safe apply
			if(!$rootScope.$$phase) {
				$rootScope.$apply();
			};

			return;
		};

		function setupListeners() {
			service.parentViewer.scene.camera.moveStart.addEventListener(mapMoving);
			service.parentViewer.scene.camera.moveEnd.addEventListener(mapStopped);
		}

		/**
		 *
		 * Pinched from Cesium Rectangle.js, but return a boolean instead of throwing dev errors
		 *
		 * @param rectangle
		 */
		service.isValidRectangle = function(rectangle) {

			var isValid =  true;

			if (!rectangle) {
				isValid = false;
				console.log('rectangle is required');
			}

			var north = rectangle.north;
			if (typeof north !== 'number') {
				isValid = false;
				console.log('north is required to be a number.');
			}

			if (north < -Cesium.Math.PI_OVER_TWO || north > Cesium.Math.PI_OVER_TWO) {
				isValid = false;
				console.log('north must be in the interval [-Pi/2, Pi/2].');
			}

			var south = rectangle.south;
			if (typeof south !== 'number') {
				isValid = false;
				console.log('south is required to be a number.');
			}

			if (south < -Cesium.Math.PI_OVER_TWO || south > Cesium.Math.PI_OVER_TWO) {
				isValid = false;
				console.log('south must be in the interval [-Pi/2, Pi/2].');
			}

			var west = rectangle.west;
			if (typeof west !== 'number') {
				isValid = false;
				console.log('west is required to be a number.');
			}

			if (west < -Math.PI || west > Math.PI) {
				isValid = false;
				console.log('west must be in the interval [-Pi, Pi].');
			}

			var east = rectangle.east;
			if (typeof east !== 'number') {
				isValid = false;
				console.log('east is required to be a number.');
			}

			if (east < -Math.PI || east > Math.PI) {
				isValid = false;
				console.log('east must be in the interval [-Pi, Pi].');
			}

			return isValid;
		};

		return service;
}]);