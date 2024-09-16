import React, { Component, createRef } from 'react';

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import {fromLonLat} from 'ol/proj.js';
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON.js';
import Style from 'ol/style/Style';
import { Circle, LineString, Point } from 'ol/geom';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { getDistance } from 'ol/sphere';
import { closestOnSegment, squaredDistanceToSegment } from 'ol/coordinate';
import { Feature } from 'ol';

import '../styles/map.scss';

const apiUrl = `https://vkszft603d.execute-api.us-west-1.amazonaws.com/dev/location/cuties!`;


const clStyle = [
    new Style({
        stroke: new Stroke({
            color: 'blue',
            width: 3
        }),
        fill: new Fill({
            color: 'rgba(0, 0, 255, 0.1)'
        })
    })
]

class GISMap extends Component {
    componentWillUnmount() { this.map.setTarget(undefined); }

    loadMileMarkers() {
        fetch('Full_PCT_Mile_Marker.geojson')
            .then((response) => response.json())
            .then((geojsonData) => {
                const format = new GeoJSON();
                const features = format.readFeatures(geojsonData, {
                    featureProjection: 'EPSG:3857', // OpenLayers default projection
                });
                // Add the mile marker features to the vector source
                this.setState({'mileFeatures': features})
            })
            .catch((error) => {
                console.error('Error loading the GeoJSON file:', error);
            });
    }

    componentDidMount() {
        this.view = new View({
            center: fromLonLat([-120, 41]),
            zoom: 5.5
        })

        this.map = new Map({
            target: this.mapRef.current,
            layers: [
                new TileLayer({
                    source: new XYZ({
                        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                    })
                })
            ],
            view: this.view,
            controls: [],
        });

        this.pctVEC = new VectorSource({
            format: new GeoJSON(),
            url: 'Full_PCT.geojson',
            wrapX: false,
        })

        const getGPSReq = fetch(apiUrl)

        this.pctVEC.on('change', (e) => {
            if (this.pctVEC.getState() === 'ready') {
                getGPSReq
                    .then((e) => e.json())
                    .then((body) => this.findNearestPoint(body.longitude, body.latitude))
                    .catch((error) => console.error('Error:', error))
            }
        });

        this.cl_layer = new VectorLayer({
            source: new VectorSource({
                projection: 'EPSG:4326',
            }),
            map: this.map,
            style: clStyle
        })
        
        this.pathVectorLayer = new VectorLayer({
            source: this.pctVEC,
            updateWhileInteracting: false,
            map: this.map,
            style: new Style({
                stroke: new Stroke({
                    color: "#FF5733",
                    width: 3,
                }),
            }),
        });
    }

    findNearestPoint(lon, lat) {
        const features = this.pctVEC.getFeatures();

        console.log(features)
        const userCoordWebMercator = fromLonLat([lon, lat])
        let minDistance = Infinity;
        let nearestPointOnPath = null;
        
        
        // Iterate over the features to find the nearest point
        features.forEach((feature) => {
            const featureGeometry = feature.getGeometry();
            if (featureGeometry instanceof LineString) {
                const coordinates = featureGeometry.getCoordinates();
                // Find the closest point on each segment of the LineString
                for (let i = 0; i < coordinates.length - 1; i++) {
                    const segmentStart = coordinates[i];
                    const segmentEnd = coordinates[i + 1];
        
                    const closestPoint = closestOnSegment(userCoordWebMercator, [segmentStart, segmentEnd]);
                    const distance = getDistance(userCoordWebMercator, closestPoint);
        
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPointOnPath = closestPoint;
                    }
                }
            }
        })

        const circleFeature = new Feature({
            geometry: new Circle(nearestPointOnPath, 30000)
        });
        this.cl_layer.getSource().addFeature(circleFeature);
    }

    constructor() {
        super()
        this.mapRef = createRef()
    }

    render() {
        return <div className='mapContainer' ref={this.mapRef} style={{
            // height: '20vh'
        }}
        />
    }
}

export default GISMap