/**
 * Created by danielwild on 10/09/2015.
 */

'use strict';

angular.module('cesium.minimap', [])

/**
 *
 * TODO: ng refactor
 *
 * An ng service wrapper to add 2d mini map to your cesium viewer
 *
 */
.factory('miniMapService', [function() {


		var service = {};

		service.parentViewer;
		service.parentCamera;

		service.expanded = true;
		service.miniViewer;
		service.container;
		service.toggleButton;
		service.logging;

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

			// create container div -> directive...?
			var div = document.createElement('div');
			div.className = 'minimap-container';
			service.logging = document.createElement('div');
			service.logging.innerHTML = "Using National Scale"
			service.logging.className = 'minimap-logging';
			div.appendChild(service.logging);

			service.container = getContainer();
			service.container.appendChild(div);
			service.toggleButton = createToggleButton();
			service.container.appendChild(service.toggleButton);
			setupMap(div);
			setupListeners();

			service.miniViewer.scene.imageryLayers.addImageryProvider(imageryProvider);
			service.miniViewer.camera.viewRectangle(ausExtent);
		};


		// gets the miniMap container div
		function getContainer() {
			var parentDiv = document.createElement('div');
			parentDiv.className = 'cesium-minimap';
			service.parentViewer.bottomContainer.appendChild(parentDiv);
			return parentDiv;
		}

		function addLayer(layer) {
			service.miniViewer.imageryLayers.addImageryProvider(layer.imageryProvider);
		}

		function setupMap(div) {

			service.options.creditContainer = document.createElement('div');

			var viewer = new Cesium.Viewer(div, service.options);
			viewer.scene.imageryLayers.removeAll();

			var scene = viewer.scene;
			scene.screenSpaceCameraController.enableRotate = false;
			scene.screenSpaceCameraController.enableTranslate = false;
			scene.screenSpaceCameraController.enableZoom = false;
			scene.screenSpaceCameraController.enableTilt = false;
			scene.screenSpaceCameraController.enableLook = false;

			// inherit parent map..? nah
			//service.parentViewer.scene.imageryLayers.layerAdded.addEventListener(addLayer);

			service.miniViewer = viewer;
		}

		// use move start/stop so we're only looping when it matters
		function mapMoving(){

			service.intervalHandle = setInterval(function() {
				getExtentView();
			}, 10);

		};

		// clear interval when map inactive
		function mapStopped(){
			clearInterval(service.intervalHandle);
			console.log("stopped");
		};

		// get 2d rectangle from current view
		function getExtentView(){

			var ellipsoid = Cesium.Ellipsoid.WGS84;

			var c2 = new Cesium.Cartesian2(0,0);
			var leftTop = service.parentViewer.scene.camera.pickEllipsoid(c2, ellipsoid);

			c2 = new Cesium.Cartesian2(service.parentViewer.scene.canvas.width, service.parentViewer.scene.canvas.height);
			var rightDown = service.parentViewer.scene.camera.pickEllipsoid(c2, ellipsoid);

			if(leftTop != null && rightDown != null){

				leftTop = ellipsoid.cartesianToCartographic(leftTop);
				rightDown = ellipsoid.cartesianToCartographic(rightDown);

				// west, south, east, north
				var extent = new Cesium.Rectangle.fromDegrees(
					Cesium.Math.toDegrees(leftTop.longitude),
					Cesium.Math.toDegrees(rightDown.latitude),
					Cesium.Math.toDegrees(rightDown.longitude),
					Cesium.Math.toDegrees(leftTop.latitude)
				);

				service.miniViewer.scene.camera.viewRectangle(extent);
				console.log(extent);

				service.logging.style.display = "none";

				return extent;
			}

			// The sky is visible in 3D, fallback to ausExtent national map
			else {

				console.log("the sky is falling :`(");

				service.miniViewer.camera.viewRectangle(ausExtent);
				service.logging.style.display = "block";

				return null;
			}
		}


		function setupListeners() {
			service.parentViewer.scene.camera.moveStart.addEventListener(mapMoving);
			service.parentViewer.scene.camera.moveEnd.addEventListener(mapStopped);
		}

		function toggle() {
			service.expanded = !service.expanded;

			if (service.expanded) {
				service.container.style.width = '200px';
				service.container.style.height = '200px';
				service.toggleButton.className = service.toggleButton.className.replace(
					' minimized',
					''
				);
			} else {
				//close
				service.container.style.width = '19px';
				service.container.style.height = '19px';
				service.toggleButton.className += ' minimized';
			}
		}

		function createToggleButton() {

			var btn = document.createElement('a');
			btn.className = 'minimap-toggle-display';

			var icon = document.createElement('i');
			icon.className = 'fa fa-arrow-right';

			btn.appendChild(icon);

			btn.onclick = function (e) {
				e.preventDefault();
				toggle();
				return false;
			};
			return btn;
		}

		return service;
}]);