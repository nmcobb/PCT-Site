import React, { Component, createRef } from 'react';

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat, toLonLat} from 'ol/proj.js';
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON.js';
import Style from 'ol/style/Style';
import { Circle, LineString, MultiLineString } from 'ol/geom';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { getDistance } from 'ol/sphere';
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

    // loadMileMarkers() {
    //     fetch('Full_PCT_Mile_Marker.geojson')
    //         .then((response) => response.json())
    //         .then((geojsonData) => {
    //             const format = new GeoJSON();
    //             const features = format.readFeatures(geojsonData, {
    //                 featureProjection: 'EPSG:3857', // OpenLayers default projection
    //             });
    //             // Add the mile marker features to the vector source
    //             this.setState({'mileFeatures': features})
    //         })
    //         .catch((error) => {
    //             console.error('Error loading the GeoJSON file:', error);
    //         });
    // }
    // This function is triggered whenever new GPS coordinates are received
    componentDidUpdate(prevProps) {
        if (prevProps.gpsCoordinates !== this.props.gpsCoordinates) {
            // Safely filter out null values before mapping
            this.props.gpsCoordinates
                .filter(coord => coord !== null)  // Filter out null values
                .forEach(({longitude, latitude}, idx) => {
                    this.addPoint(fromLonLat([longitude, latitude]), idx);
                });
        }
    }
    

    componentWillUnmount() {
        this.map.un('click', this.handleMapClick); // Clean up the event listener
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

        this.map.on('click', this.handleMapClick); // Register click event on map

        this.pctVEC = new VectorSource({
            format: new GeoJSON(),
            url: `${process.env.PUBLIC_URL}/Pacific Crest Trail.js`,
        })

        const getGPSReq = fetch(apiUrl)
        let altitudes = []; 

        this.pctVEC.on('change', (_) => {
            if (this.pctVEC.getState() === 'ready') {
                getGPSReq
                    .then((e) => e.json())
                    .then((body) => this.addPoint(this.findNearestPoint(body.longitude, body.latitude)))
                    .catch((error) => console.error('Error:', error))

                this.pctVEC.getFeatures().forEach((feature) => {
                    const coordinates = feature.getGeometry().getCoordinates()[0];
                    coordinates.forEach((coord) => {
                        if (coord.length > 2) {
                            altitudes.push(coord[2]); // Add altitude to the array
                        }
                    });
                });
                this.props.setAltitudes(altitudes)
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
        const userCoordWebMercator = fromLonLat([lon, lat])
        var minDistance = Infinity;
        var nearestPointOnPath = null;
        
        // Iterate over the features to find the nearest point
        features.forEach((feature) => {
            var featureGeometry = feature.getGeometry();
            if (featureGeometry instanceof MultiLineString || featureGeometry instanceof LineString) {
                var closestPoint = featureGeometry.getClosestPoint(userCoordWebMercator)
                const distance = getDistance(toLonLat(userCoordWebMercator), toLonLat(closestPoint));
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPointOnPath = closestPoint;
                }
            } else {
                console.log("something went wrong!")
            }
        })

        return nearestPointOnPath
    }

    addPoint(point, id) {
        // TODO
        var circleFeature = new Feature({
            geometry: new Circle(point, 50000),
        });

        circleFeature.set('id', id)
        this.cl_layer.getSource().addFeature(circleFeature);
    }

    handleMapClick = (event) => {
        this.map.forEachFeatureAtPixel(event.pixel, (feature) => {
            console.log(feature.get('id'), 'scrolling!');
            this.props.scrollToImage(feature.get('id'))
        });
    };

    constructor() {
        super()
        this.mapRef = createRef()
    }

    render() {
        return <div className='mapContainer' ref={this.mapRef} />
    }
}

export default GISMap