<h1>cesium-ng-minimap</h1>

A simple AngularJS service to add minimap for Cesium.js.

It adds a 2d map and also provides an <strong>approximate</strong> extent based on Cesiums Camera position (plus optional buffer).

<h2>Usage:</h2>

Add <code>'cesium.minimap'</code> module to your Angular app.

Add the directive to your page somewhere:

`<cesium-mini-map></cesium-mini-map>`


The extent object is broadcast as an event whenever the map stops moving: `extentOfInterestChanged`
