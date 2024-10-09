import React, { Component } from 'react';
import { Amplify } from 'aws-amplify';
import { list } from '@aws-amplify/storage';
import Map from './map'
import awsExports from '../aws-exports'; // Ensure this path is correct for your project
import EXIF from 'exif-js';

import '../styles/home.scss';
import AltitudesPlot from './altitudesPlot';

Amplify.configure(awsExports);


export default class GISMap extends Component {
    imageRefs = {}; 

    state = {
        images: [],
        gpsCoordinates: [],
        altitudes: []
    }

    componentDidMount() {
        list('', { level: 'guest' })
            .then(res => this.setState({
                images: res.items,
                gpsCoordinates: Array(res.items.length).fill(null)
            }))
    }

    render () {
        const baseurl = 'https://pctimages369e4-pctenv.s3.us-west-1.amazonaws.com/public/'
        // this.state.images.map(i => getUrl({path: 'public/'+i.key}).then(console.log))
        return <div className='home'> 
            <div>
                <div className='imageContainer'>
                <p>Our Journey North! </p>
                    {this.state.images.map((i, idx) => <img 
                        key={`img_${idx}`}
                        ref={el => (this.imageRefs[idx] = el)}
                        onLoad={e => this.getGps(e, idx)}
                        className='postImg'
                        alt='missing!'
                        src={baseurl + i.key}
                    />)}
                </div>
                <AltitudesPlot altitudes={this.state.altitudes} />
            </div>
            <Map 
                gpsCoordinates={this.state.gpsCoordinates} 
                scrollToImage={(idx) => this.scrollToImage(idx)}
                setAltitudes={(altitudes) => this.setState({altitudes})}
            />
        </div>  
    }

    getGps = (event, idx) => {
        const imgElement = event.target; // Get the image element from the event
    
        // Convert DMS (degrees, minutes, seconds) to decimal degrees
        const convertDMSToDD = (dmsArray, direction) => {
            const degrees = dmsArray[0];
            const minutes = dmsArray[1];
            const seconds = dmsArray[2];
    
            let dd = degrees + minutes / 60 + seconds / (60 * 60);
            if (direction === 'S' || direction === 'W') {
                dd = dd * -1;
            }
            return dd;
        };
    
        // Use arrow function to keep 'this' context
        EXIF.getData(imgElement, () => {
            let lat = EXIF.getTag(imgElement, 'GPSLatitude');
            let lon = EXIF.getTag(imgElement, 'GPSLongitude');
    
            // Convert DMS to decimal degrees
            let latitude = lat ? convertDMSToDD(lat, EXIF.getTag(imgElement, 'GPSLatitudeRef')) : null;
            let longitude = lon ? convertDMSToDD(lon, EXIF.getTag(imgElement, 'GPSLongitudeRef')) : null;
    
            if (latitude && longitude) {
                // Update state with new coordinates
                this.setState(prevState => {
                    const updatedCoordinates = [...prevState.gpsCoordinates];
                    updatedCoordinates[idx] = { latitude, longitude };  // Set GPS data at correct index
                    
                    return { gpsCoordinates: updatedCoordinates };
                });
            }
        });
    };

    scrollToImage(idx) {
        const imgRef = this.imageRefs[idx];
        if (imgRef) {
            imgRef.scrollIntoView({ behavior: 'smooth', block: 'start' });  // Scroll to the image smoothly
        }
    };
}