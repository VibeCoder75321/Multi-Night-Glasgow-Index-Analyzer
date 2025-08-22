/* 
Copyright 2025 DaveSkvn
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the
 Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
*/


const MILLIS_PER_SAMPLE = 40;
const DETAIL_SAMPLES_SHOW = 1500;
const FLOW_BALANCE_ERROR_PCNT = 20;

const STD_COLOURS = ["#ffffff", "#bab8e0",  "#aca9eb", "#8680ed",  "#090387" ];
const OVERALL_COLOURS = ["#ffffff", "#faacb7",  "#f7798a", "#f7546a",  "#ed0c2a" ];
const BLACK_COLOUR = "#000000";

const MIN_WINDOW = 25;
const GREY_ZONE_LOWER = -10;

// Look for maximum negative (expiration) flow 
function findMins(dataArray){
	for (let ptr = 0; ptr < (MIN_WINDOW) ; ptr++){
// ignore first MIN_WINDOW samples (1 seconds worth)
		dataArray[ptr].min = false;
	}
	
	// look at each flow rate sample in turn
	for(let ptr = MIN_WINDOW; ptr < (dataArray.length - MIN_WINDOW) ; ptr++){
		
		// assume each sample is a minimum
		let minDetected = true;
		for(let winPtr = (ptr - MIN_WINDOW); winPtr < (ptr + MIN_WINDOW -1) ; winPtr++){
			if (dataArray[winPtr].y < dataArray[ptr].y){
				//There is a lower valued sample within one second. Overwrite flag and move on to next sample.
				minDetected = false;
				break;
			}
		}

		if ( (minDetected === true) && (dataArray[ptr].y < GREY_ZONE_LOWER) ){
			// this is the lowest valued sample within 1 second. Flag as a minimum if it is below the "grey zone"
			dataArray[ptr].min = true;
		}else{
			// this is NOT the lowest valued sample within 1 second.
			dataArray[ptr].min = false;
		}
	}
	
	for (let ptr = (dataArray.length - MIN_WINDOW -1 ); ptr < (dataArray.length - 1) ; ptr++){
		// ignore last MIN_WINDOW samples (1 seconds worth)
		dataArray[ptr].min = false;	
	}
}

const TOP_THRESHOLD_PRECENT_90 = 0.9;
const GREY_ZONE_UPPER = 5;

// Look for the inspirations
function findInspirations(dataArray, results){

	results.inspirations = [];
	let ignoreUntil = 0;
	
// look at each sample in turn	
	for(let i = 0; i < dataArray.length - 1; i++){
		if (i < ignoreUntil){ 
// ignore until end of last determined inspiration
			continue;
		}

		if (dataArray[i].y <= GREY_ZONE_UPPER){
			//point is below mid line / grey zone. Ignore and move on 
			dataArray[i].max = false;
			continue;
		}
		
		if ( i === 0 || i === dataArray.length - 1){
			// ignore first and last sample - to avoid explosion on next step			
			dataArray[i].max = false;
			continue;
		}
		
		if ( (dataArray[i-1].y > dataArray[i].y ) || (dataArray[i].y < dataArray[i+1].y) ){
			// Adjacent point is higher - not a max	
			dataArray[i].max = false;
			continue;
		}
		

		let inspirInstance = {};
		// look backwards (from sample i) for the mid line & a higher max
		for(let downPtr = i;  downPtr > 0 ; downPtr-- ){
			if (dataArray[downPtr].y > dataArray[i].y){
// there is a higher point between "sample i" and the mid line (looking backwards) - prob already processed  
				break;	
			}
			if (dataArray[downPtr].y <= GREY_ZONE_UPPER){
// have travelled from sample i to mid line (backwards) without hitting a higher max
				inspirInstance.start = downPtr;
				break;
			}
		}
		if (inspirInstance.start==null){  
			// Did not make it from Sample I to mid line without hitting a higher max - ignore these breaths
			continue;
		}

		// look forwards (from sample i) for the mid line & a higher max
		for(let upPtr = i; upPtr < dataArray.length - 1; upPtr++ ){
			if (dataArray[upPtr].y > dataArray[i].y){
				// there is a higher point between "sample i" and the mid line (looking forwards) - soon to be processed...  
				break;
			}
			if (dataArray[upPtr].y <= GREY_ZONE_UPPER){
				// have travelled from sample i to mid line (forward) without hitting a higher max
				inspirInstance.end = upPtr;
				break;
			}
		}
		if (inspirInstance.end==null){  
			// end of inspiration missing - ignore these breaths
			continue;
		}
		
		if (inspirInstance.end - inspirInstance.start < 8){  
			// ignore inspirations of less than 8 samples (approx 0.4 secs)
			continue;
		}

		// store time text of inspiration and the max value 
		inspirInstance.startTime = dataArray[inspirInstance.start].x;
		inspirInstance.maxValue = dataArray[i].y;
		inspirInstance.midPoint= inspirInstance.start + Math.round( (inspirInstance.end - inspirInstance.start) / 2 );
				
		// set variables for the determination of the characteristics of this inspiration
		let leftVol = 0.0;
		let rightVol = 0.0;
		top_t90 = 0;
		
		let threshold_90 = inspirInstance.maxValue * TOP_THRESHOLD_PRECENT_90;
		
		inspirInstance.multiPeak = false;
		let firstPeakFound = false;
		let lookingForNextPeak = false;
		let lastMax = 0;
		let lowestPostFirstPeak = 0;
		const MIN_PEAK_BUMP = 1;
		
		for(let ptr = inspirInstance.start; ptr < inspirInstance.end ; ptr++ ){
			// look at each sample between the start and end of the inspiration
			if (ptr < inspirInstance.midPoint){
				// Add all the flow before the mid point together to determine skew  
				leftVol = leftVol + dataArray[ptr].y;
			}else if(ptr > inspirInstance.midPoint){
				// Add all the flow after the mid point together to determine skew  
				rightVol = rightVol + dataArray[ptr].y;
			}
			
			if (dataArray[ptr].y > threshold_90){
				// How many samples were the value above 90% of the maximum (to determine "Top heavy")
				top_t90++;
			}

			// look to see if this inspiration has multiple peaks
			if (firstPeakFound===false){
				// keep looking for a max until one is found then flag "firstPeakFound" to move onto the next state
				if (dataArray[ptr].y > lastMax){
					lastMax = dataArray[ptr].y; 
				}else if (dataArray[ptr].y < lastMax){
					firstPeakFound=true
				}
			}else if ( lookingForNextPeak ===false &&
					(lastMax - dataArray[ptr].y ) > MIN_PEAK_BUMP ){
				// So first peak found. Heading downward. Haven't hit a min yet. Keep track of value looking for a min.
				lookingForNextPeak = true;
				lowestPostFirstPeak = dataArray[ptr].y;
			}if (lookingForNextPeak === true && inspirInstance.multiPeak === false){
				// first peak found, have hit a min and now on way back up. Look for another max above "MIN_PEAK_BUMP" 
				if (dataArray[ptr].y < lowestPostFirstPeak){
					lowestPostFirstPeak = dataArray[ptr].y;
				}else if ( dataArray[ptr].y > (lowestPostFirstPeak + MIN_PEAK_BUMP) ){
					// Have hit one peak, a min and now more than MIN_PEAK_BUMP on the way back up. There's another max coming.
					// Flag and move on.
					inspirInstance.multiPeak = true;
				}
			}
		}
		inspirInstance.leftVol = leftVol;
		inspirInstance.rightVol = rightVol;
		if (inspirInstance.end - inspirInstance.start > 12){
			// only record skew and top heavy for inspirations over 0.5 secs
			inspirInstance.leftPercent = Math.round(10000 * leftVol / (leftVol + rightVol), 2) / 100;
			inspirInstance.top90Percent = Math.round(10000 * top_t90 / (inspirInstance.end  - inspirInstance.start)) / 100;
		}else{
			// set benign values for skew and top heavy for inspirations under 0.5 secs			
			inspirInstance.leftPercent = 50;
			inspirInstance.top90Percent = 32;
		}

		// looking for "Flat Top". Calc variance over the middle 50% of inspiration.
		let varStart = Math.round(inspirInstance.midPoint - ( 0.25 * (inspirInstance.end - inspirInstance.start) ));
		let varEnd = Math.round(inspirInstance.midPoint + ( 0.25 * (inspirInstance.end - inspirInstance.start) ));
		
		let midSum = 0;
		for(let ptr = varStart; ptr < varEnd ; ptr++ ){
			midSum += dataArray[ptr].y;
		}
		
		// calc mean flow value over middle 50% of inspiration 
		let midMean = midSum / ( 0.5 * (inspirInstance.end - inspirInstance.start) );
		let midVar = 0;
		// use mean to calculate variance of flow over middle 50% of inspiration  
		for(let ptr = varStart; ptr < varEnd ; ptr++ ){
			midVar += Math.pow( (midMean - dataArray[ptr].y ), 2);
		}
		//Hold mid inspiration variance to two decimal places
		inspirInstance.midVar =  Math.round(100 * midVar / ( 0.5 * (inspirInstance.end - inspirInstance.start) ) ) / 100;;
		
		results.inspirations.push(inspirInstance);
		ignoreUntil = inspirInstance.end; // only process an inspiration instance once. Ignore multiple peaks at this stage.
	}

}

const EXTRAPOLATION_SAMPLES = 25;

function calcCycleBasedIndicators(dataArray, results){
	let nextInspirIndex = 0;
	
	//Find the sample index IDs of minimums (peak expiration) 
	let minsAtIndex = [];
	for(let i = 0; i < dataArray.length - 1 ; i++){
		if (dataArray[i].min === true){
			minsAtIndex.push(i);
		}
	}
	
	// try to mach up expirations with inspirations and determine their relationship (pause in between?) 
	for(let i = 0; i < minsAtIndex.length - 1; i++){
		//look at each min / peak expiration in turn 
		let indexOfMin = minsAtIndex[i];	
	
		if (nextInspirIndex >= results.inspirations.length ){
			break;
		}

		let emgyBreak = 10;
		do{
			if (emgyBreak-- <= 0 ) {
				console.log("NOT SUPPOSED TO GET HERE"); 
				break;
			}
			if (results.inspirations[nextInspirIndex].start < indexOfMin){
// The "nextInspirIndex" starts before the min/expiration we are looking at. 
// There have been two inspiration curves for one min/expiration. Flag inspiration as "orphaned" and move on.
				results.inspirations[nextInspirIndex].noExhale = true;
				nextInspirIndex++;
			}else if ( ( i < minsAtIndex.length - 1) &&
				results.inspirations[nextInspirIndex].start > minsAtIndex[i+1] ){
// "nextInspirIndex" starts after next min - move to next min...
				break; // to next min
			}else if (results.inspirations[nextInspirIndex].start > indexOfMin){
// The "nextInspirIndex" is after the min we are looking at. Link the two and determine relationship.
				results.inspirations[nextInspirIndex].noExhale = false;
				results.inspirations[nextInspirIndex].linkedMinAt = indexOfMin;
				
				let minValue = dataArray[indexOfMin].y;
				let minValuePlusOneSec = dataArray[indexOfMin+EXTRAPOLATION_SAMPLES].y;
				if (minValuePlusOneSec < 0){
// Expiration is proceeding normally (not complete 1s after peak). Extrapolate where it would intersect with X-axis to determine
// the generated "pre inspiration rest" / pause length.
					let intersection = indexOfMin + Math.round( EXTRAPOLATION_SAMPLES * minValue / (minValue - minValuePlusOneSec) ); 
					results.inspirations[nextInspirIndex].intersection = intersection;
					results.inspirations[nextInspirIndex].preRest = results.inspirations[nextInspirIndex].start - intersection;
				}else{
// inspiration started less than 1s after min. Set default preRest indicating problem (that's too fast for normal breathing).
					results.inspirations[nextInspirIndex].preRest = -10;
				}
				nextInspirIndex++;
				break;
			}else{
				console.log("inspiration neither before nor after selected min!");
			}
		}while (nextInspirIndex < results.inspirations.length - 1)
			
	}
}

// prepare an idealised inspiration flow for presentation - not used in calcs
function prepIdealFlow(dataArray, results){
 	results.idealArray = [];
	let nextInspirCntr = 0;
	
// Prime pointers for iteration	
	let nextInspir = results.inspirations[nextInspirCntr];
// The idealised flow is parabola/quadratic based. Coefficient A & B are calculated for each inspiration max.  
	let coefA = nextInspir.end - nextInspir.start;
	let coefB = (4 * nextInspir.maxValue ) / ( coefA * coefA);
 	
	for(let i = 0; i < dataArray.length - 1; i++){
// look at each data sample in turn

		if ( (nextInspir===null) || (i < nextInspir.start) ){
// set output to 0 outside inspiration
			results.idealArray.push({x:dataArray[i].x , y: 0});
		}else if (i == nextInspir.start){
// set output to 0 at start of inspiration
			results.idealArray.push({x:dataArray[i].x , y: 0});
		}else if (i == nextInspir.end){
// set output to 0 at end of inspiration
			results.idealArray.push({x:dataArray[i].x , y: 0});
			
			if (nextInspirCntr < (results.inspirations.length - 1) ){
				// more inpirations to look at
				nextInspirCntr++;
				// move onto to next inspiration & calc coefficients
				nextInspir = results.inspirations[nextInspirCntr];
				coefA = nextInspir.end - nextInspir.start;
				coefB = (4 * nextInspir.maxValue ) / ( coefA * coefA);
			}else{
				// that was the last inspiration
				nextInspir = null;
			}
		}else{
// set output in between start & end of inspiration based on quadratic formula
 			xValue = i - nextInspir.start;
 			yValue = coefB * xValue * ( coefA - xValue );
			results.idealArray.push({x:dataArray[i].x , y: yValue});
		}
 	}
}

const AMP_WINDOW_LEN = 5;

// calculate the variance of the inspiration amplitude - Are the breaths getting stronger and weaker? 
function inspirationAmplitude(dataArray, results){
	
	for(let i = AMP_WINDOW_LEN; i < results.inspirations.length - 1; i++){
		// look at each inspiration (from number "AMP_WINDOW_LEN" onward) 
		let ampMean = 0;
		
		// determine the mean of the max amplitude of these inspiration
		for(let cnt = 0; cnt < AMP_WINDOW_LEN; cnt++){			
			ampMean += results.inspirations[i - cnt].maxValue;
		}
		ampMean = ampMean / AMP_WINDOW_LEN;
		
		let ampVar = 0;
		// Use the mean calcuated to determine the variance of the amplitude
		for(let cnt = 0; cnt < AMP_WINDOW_LEN; cnt++){
			ampVar += Math.pow(results.inspirations[i - cnt].maxValue - ampMean, 2);
		}
		// round to two decimal places 
		ampVar = Math.round( 100 * ampVar / AMP_WINDOW_LEN ) / 100;
		results.inspirations[i].ampVar = ampVar;
		
		// used the time differnce between this inspiration and the inspiration 'AMP_WINDOW_LEN' ago to determine how many
		// inspirations per minute
		let samplesForAveBreaths = results.inspirations[i].start - results.inspirations[i - AMP_WINDOW_LEN].start;
		results.inspirations[i].inspirPerMin = Math.round( (AMP_WINDOW_LEN * 60 * 1000) / (samplesForAveBreaths * MILLIS_PER_SAMPLE) );
	}	
}

// prepare the indices based on the calculated data 
function prepIndices(results){
	// prepare the cumulative indices
	let cumIndex = {};
	cumIndex.skew = 0;
	cumIndex.topHeavy = 0;
	cumIndex.flatTop = 0;
	cumIndex.spike = 0;
	cumIndex.multiPeak = 0;
	cumIndex.noPause = 0;
	cumIndex.inspirRate = 0;
	cumIndex.multiBreath = 0;
	cumIndex.ampVar = 0;
	
	for(const nextInspir of results.inspirations){
		// look at each inspiration in turn. The first few will be incomplete due to the nature of processing. 
		nextInspir.indices = {};
		nextInspir.indices.overall = 0;
		
		if ( (nextInspir.leftPercent < 45) || (nextInspir.leftPercent > 55) ){
// Inspirations with over 55% of the flow volume to the left or right of the mid line are defined as "skewed". 
			nextInspir.indices.skew = true;
			cumIndex.skew++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.skew = false;
		} 
		if ((nextInspir.top90Percent > 40) ){ 
// Where the inspiration spends more than 40% of its time with a value over 90% of the max, it is flagged as "top heavy". 
// Parabola would be 31.6%, sine wave would be 28.7% of the time.
			nextInspir.indices.topHeavy = true;
			cumIndex.topHeavy++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.topHeavy = false;
		} 
		if ((nextInspir.midVar < 0.75) ){ 
// Where the flow rate variance over the mid 50% of the inspiration is low, it is a "flat top".
			nextInspir.indices.flatTop = true;
			cumIndex.flatTop++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.flatTop = false;
		} 

		if ((nextInspir.top90Percent <20) ){ 
// Where the inspiration spends less than 20% of its time with a value over 90% of the max, it is flagged as a "spike". 
// Parabola would be 31.6%, sine wave would be 28.7% of the time.
			nextInspir.indices.spike = true;
			cumIndex.spike++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.spike = false;
		} 
		if (nextInspir.multiPeak ===true){
// If multiple peaks were found on the inspiration (ignoring small bumps), flagged as multipeak.  
			nextInspir.indices.multiPeak = true;
			cumIndex.multiPeak++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.multiPeak = false;
		}
		if (nextInspir.preRest < 10){
//When using the expir. extrapolation above, where the expiration intersects with the x-axis less than 10 samples (0.4 seconds)
//before an inspiration it is flagged as no Pause. Pause normally around 30 samples (1+ secs).
			nextInspir.indices.noPause = true;
			cumIndex.noPause++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.noPause = false;
		}
		if (nextInspir.inspirPerMin > 20){
// Inspiration rate is the number of "inspirations" humps recorded in the flow rate graph per minute. Normal range is 12 to 20.
			nextInspir.indices.inspirRate = true;
			cumIndex.inspirRate++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.inspirRate = false;
		}
		if (nextInspir.noExhale ===true){
// If more than one inspiration "humps" is detected for each expiration min, one or more will be flagged as "multibreath".
// Not seen in normaly breathing.
			nextInspir.indices.multiBreath = true;
			cumIndex.multiBreath++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.multiBreath = false;
		}
		if (nextInspir.ampVar > 4){
// Where the max inspiration amplitude variance is more than 4 the breathing is flagged as unsettled. 			
			nextInspir.indices.ampVar = true;
			cumIndex.ampVar++;
			nextInspir.indices.overall++;
		}else{
			nextInspir.indices.ampVar = false;
		}
	}

// determine the cumulative indices to two decimal places
	cumIndex.skew = Math.round(100 * cumIndex.skew / results.inspirations.length) / 100;
	cumIndex.flatTop = Math.round(100 * cumIndex.flatTop / results.inspirations.length) / 100;
	cumIndex.topHeavy = Math.round(100 * cumIndex.topHeavy / results.inspirations.length) / 100;
	cumIndex.spike = Math.round(100 * cumIndex.spike / results.inspirations.length) / 100;
	cumIndex.multiPeak = Math.round(100 * cumIndex.multiPeak / results.inspirations.length) / 100;
	cumIndex.noPause = Math.round(100 * cumIndex.noPause / results.inspirations.length) / 100;
	cumIndex.inspirRate = Math.round(100 * cumIndex.inspirRate / results.inspirations.length) / 100;
	cumIndex.multiBreath = Math.round(100 * cumIndex.multiBreath / results.inspirations.length) / 100;
	cumIndex.ampVar = Math.round(100 * cumIndex.ampVar / results.inspirations.length) / 100;
	cumIndex.overall = Math.round(100 * (cumIndex.skew + cumIndex.flatTop + cumIndex.spike + cumIndex.multiPeak + cumIndex.noPause +
							cumIndex.inspirRate + cumIndex.multiBreath + cumIndex.ampVar ) ) / 100;
	
	return cumIndex;
}

// Balance the inspiration and expiration flow. Flag where the two are not balanced with black lines in the overall flow.
// Would be an indication of aerophagia. 
function flowBalance(){
	let flowZones = []; //
	for(let i = 0; i < results.inspirations.length - 2 ; i++) {
		// look at each expiration in turn. Form a "zone" (one inspiration start to the next)
		let nextZone = {upper: 0, lower:0};
		nextZone.start = results.inspirations[i].start;
		nextZone.end = results.inspirations[i+1].start - 1;
		if ( (nextZone.end - nextZone.start) < 100) {
		// ignore breaths / zones less than 2.5 seconds long. 
			continue;
		}
		for(let j = nextZone.start; j < nextZone.end; j++) {
// add up the inspiration and expiration flow volumes 			
			if (dataArray[j].y > 0) {
				nextZone.upper += dataArray[j].y; 
			}else {
				nextZone.lower -= dataArray[j].y;
			}
		}
//determine the net flow volume 
		nextZone.net = nextZone.upper - nextZone.lower;
		nextZone.netPercent = Math.round(10000 * nextZone.net / (nextZone.upper + nextZone.lower))/ 100;
		nextZone.inspirPtr = i;
		flowZones.push(nextZone);
	}
	
	results.flowImbalance = [];
// look at each zone (breath) ignoring those where the net volume difference is below some generous error level 
	for(let i = 1; i < flowZones.length - 2 ; i++) {
		// phase 1 - check if this zone has balanced flow
		if (flowZones[i].netPercent < FLOW_BALANCE_ERROR_PCNT) {
			continue;
		}
		// phase 2 - check if this and the previous zone together have balanced flow
		if ( ( flowZones[i].netPercent + flowZones[i-1].netPercent) < FLOW_BALANCE_ERROR_PCNT) {
			continue;
		}
		// phase 1 - check if this and the next zone together have balanced flow
		if ( ( flowZones[i].netPercent + flowZones[i+1].netPercent) < FLOW_BALANCE_ERROR_PCNT) {
			continue;
		}
		// only the zones with imbalanced flow when considering the neighbouring breaths will be flagged for display. 
		results.flowImbalance.push({start:flowZones[i].start, inspirPtr: flowZones[i].inspirPtr} );
	}
}

// Display the heat map on the web page
function displayHeatMap(results){	
	chartTop = document.getElementById("chartTop");
	chartTop.width = window.innerWidth;

	chartTop.height = 350;
	var ctx = chartTop.getContext("2d");
	
// output texts on the canvas
	ctx.font = "bold 14px sans-serif" ;
	ctx.fillText(startDateTime.getDate() + " " +
				 startDateTime.toLocaleString('default', { month: 'short' }) + " " +
				 startDateTime.getFullYear(), 10, 20);
	
	ctx.font = "14px sans-serif" ;
	ctx.fillText("Skew (" + results.cumIndex.skew + ")", 10, 50);
	ctx.fillText("Spike (" + results.cumIndex.spike + ")", 10, 80);
	ctx.fillText("Flat Top (" + results.cumIndex.flatTop + ")", 10, 110);
	ctx.fillText("Top Heavy (" + results.cumIndex.topHeavy + ")", 10, 140);
	ctx.fillText("Double Peak (" + results.cumIndex.multiPeak + ")", 10, 170);
	ctx.fillText("No Pause (" + results.cumIndex.noPause + ")", 10, 200);
	ctx.fillText("Inspir Rate (" + results.cumIndex.inspirRate + ")", 10, 230);
	ctx.fillText("Double Insp (" + results.cumIndex.multiBreath + ")", 10, 260);
	ctx.fillText("Variable Amp (" + results.cumIndex.ampVar + ")", 10, 290);
	ctx.font = "bold 14px sans-serif" ;
	ctx.fillText("Overall (" + results.cumIndex.overall + ")", 10, 330);
	
// prepare the geometry of the heat map area.
	let left = 150;  // start of the heat map area
	let rightEdge = chartTop.width - 10; // right limit of the heat map area that can be used 
	let dataLen = results.inspirations.length; // one many inspirations need to be summarized
	
	let perCell = Math.ceil( dataLen / ( rightEdge - left ) );  // number of inspiration per "cell" / pixel
	let noCells = Math.round(dataLen / perCell); // number of "cells" / pixels
	let right = left + noCells;  // actual right limit that will be used 
	
	// output the hours at the top of the canvas.
	let sampleCnt = results.inspirations[results.inspirations.length-1].end;
	outputHoursText(ctx, startDateTime, sampleCnt, 20, left, right);
	
	let ptr = perCell;
	let nextCell = {skew:0, flatTop:0, topHeavy:0, spike:0, multiPeak:0, noPause:0, inspirRate:0, multiBreath:0, ampVar:0, overall:0};
	let cellCnt = 0;
	for(let i = 0; i < results.inspirations.length ; i++){
		// add each inspiration's data to the cell
		if (results.inspirations[i].indices.skew === true){
			nextCell.skew++;
		}
		if (results.inspirations[i].indices.flatTop === true){
			nextCell.flatTop++;
		}
		if (results.inspirations[i].indices.topHeavy === true){
			nextCell.topHeavy++;
		}
		if (results.inspirations[i].indices.spike === true){
			nextCell.spike++;
		}
		if (results.inspirations[i].indices.multiPeak === true){
			nextCell.multiPeak++;
		}
		if (results.inspirations[i].indices.noPause === true){
			nextCell.noPause++;
		}
		if (results.inspirations[i].indices.inspirRate === true){
			nextCell.inspirRate++;
		}
		if (results.inspirations[i].indices.multiBreath === true){
			nextCell.multiBreath++;
		}
		if (results.inspirations[i].indices.ampVar === true){
			nextCell.ampVar++;
		}
		if (results.inspirations[i].indices.overall > 0){
			nextCell.overall += results.inspirations[i].indices.overall;
		}
		ptr--;
		
		if (ptr ===0){
			// once the cell data is complete, generate the averages
			nextCell.skew = nextCell.skew / perCell;
			nextCell.flatTop = nextCell.flatTop / perCell;
			nextCell.topHeavy = nextCell.topHeavy / perCell;
			nextCell.spike = nextCell.spike / perCell;
			nextCell.multiPeak = nextCell.multiPeak / perCell;
			nextCell.noPause = nextCell.noPause / perCell;
			nextCell.inspirRate = nextCell.inspirRate / perCell;
			nextCell.multiBreath = nextCell.multiBreath / perCell;
			nextCell.ampVar = nextCell.ampVar / perCell;
			nextCell.overall = nextCell.overall / perCell;
			
			// display the cell's data on the canvas
			outputIndicesLine(ctx, nextCell, left + cellCnt);
			cellCnt++;
			
			// reset the cell data and move onto the next cell
			nextCell = {skew:0, flatTop:0, topHeavy:0, spike:0, multiPeak:0, noPause:0, inspirRate:0, multiBreath:0, ampVar:0, overall:0};
			ptr = perCell;
		}
	}

	// output the flow balance anomalys
	outputFlowAnomaly(ctx, left, perCell, 310);
	
	var elemLeft = chartTop.offsetLeft + chartTop.clientLeft;
	var elemTop = chartTop.offsetTop + chartTop.clientTop;

	if (chartDetail!=null){
//when displaying the top canvas, clear the lower graph area (and scroll buttons)
		clearDetailGraph();
	}
	
	//Add event listener for `click` events.
	chartTop.addEventListener('click', function(event) {
	    var x = event.pageX - elemLeft;  //      y = event.pageY - elemTop;
		if (x < left || x > right){
			// only process clicks within the coloured "cell" area
			return;
		}
	    
		// determine how far left/right was clicked and display the flow graph of the appropraite time 
	    var instanceIndex = Math.trunc( ( (x - left) / noCells ) * results.inspirations.length);
	    showDetailOneMinute(dataArray, results, results.inspirations[instanceIndex].start);
	}, false);
	
}

// Output the hours texts at the top of the canvas 
function outputHoursText(ctx, startDateTime, sampleCnt, pixelHeight, leftPx, rightPx){
	let startHour = startDateTime.getHours();
	let endTime = new Date(startDateTime.getTime() + sampleCnt * MILLIS_PER_SAMPLE);
	if (startDateTime.getHours()===endTime.getHours()){// don't attempt to output if the data does not cross an hour boundary
		return;
	}
// the start time will not be output. We need to work out the first hour boundary after the start time.
	let startTimeISOStr = startDateTime.toISOString();
	let previousHourISOStr = startTimeISOStr.substring(0, 13) + ":00:00.000"; 
	let previousHour = new Date(previousHourISOStr);
	let nextHour = new Date(previousHour.getTime() + 3600000);   //add an hour - gives the first hour after start of recording
	
	fieldWidthPixel = rightPx - leftPx;
	
	let outHours = [];
	while(nextHour.getTime() < endTime.getTime()){  // exit if we've gone over the end time
		// Determine how many SAMPLES from the start the next hour boundary is 
		let nextHourSampleCnt = ( nextHour.getTime() - startDateTime.getTime() ) / MILLIS_PER_SAMPLE ;
		// Use the sample could to determine the pixel location 
	    let pixelLoc = leftPx + Math.round(  (nextHourSampleCnt / sampleCnt ) * fieldWidthPixel ) - 25;
		// output the hour text
		ctx.fillText(twoCharLeadingZero(nextHour.getHours()) + ":00", pixelLoc, 20);
		// move onto the next hour boundary
		nextHour = new Date(nextHour.getTime() + 3600000);   //add an hour
	}
	
}

// output the flow anomaly markings
function outputFlowAnomaly(ctx, leftPx, smplPerCell, heightPx){

	ctx.lineWidth = 3;
	for(let i = 0; i< results.flowImbalance.length; i++){
		// put a black line in the overview heat map where the flow in and out were not balanced
		let linePx = leftPx + Math.round(results.flowImbalance[i].inspirPtr / smplPerCell) - 1;
		
		ctx.beginPath();
		ctx.moveTo(linePx, heightPx);
		ctx.lineTo(linePx, (heightPx+30) );
		ctx.strokeStyle = BLACK_COLOUR;
		ctx.closePath();
		ctx.stroke();
	}
	
}

// output a cell's index lines
function outputIndicesLine(ctx, indices, leftPx){
	outputIndexLine(ctx, indices.skew, leftPx, 30);
	outputIndexLine(ctx, indices.spike, leftPx, 60);
	outputIndexLine(ctx, indices.flatTop, leftPx, 90);
	outputIndexLine(ctx, indices.topHeavy, leftPx, 120);
	outputIndexLine(ctx, indices.multiPeak, leftPx, 150);
	outputIndexLine(ctx, indices.noPause, leftPx, 180);
	outputIndexLine(ctx, indices.inspirRate, leftPx, 210);
	outputIndexLine(ctx, indices.multiBreath, leftPx, 240);
	outputIndexLine(ctx, indices.ampVar, leftPx, 270);	
	
	// output overall cell line
	ctx.beginPath();
	ctx.moveTo(leftPx, 310);
	ctx.lineTo(leftPx, 340);
	ctx.strokeStyle = getOverallColourFromValue(indices.overall);
	ctx.closePath();
	ctx.stroke();
}

// output a single index line for a single characteristic
function outputIndexLine(ctx, indexValue, leftPx, heightPx){
	ctx.beginPath();
	ctx.moveTo(leftPx, heightPx);
	ctx.lineTo(leftPx, (heightPx+25) );
	ctx.strokeStyle = getColourFromValue(indexValue);
	ctx.closePath();
	ctx.stroke();
}

// determine the colour from the index value
function getColourFromValue(indexValue){
	if (indexValue > 0.8){
		return STD_COLOURS[4];	
	}else if(indexValue > 0.6){
		return STD_COLOURS[3];	
	}else if(indexValue > 0.4){
		return STD_COLOURS[2];	
	}else if(indexValue > 0.2){
		return STD_COLOURS[1];	
	}else{
		return STD_COLOURS[0];	
	}
}

//determine the colour from the index value
function getOverallColourFromValue(indexValue){
	if (indexValue > 4){
		return OVERALL_COLOURS[4];	
	}else if(indexValue > 3){
		return OVERALL_COLOURS[3];	
	}else if(indexValue > 2){
		return OVERALL_COLOURS[2];	
	}else if(indexValue > 1){
		return OVERALL_COLOURS[1];	
	}else{
		return OVERALL_COLOURS[0];	
	}
}

// When selected, output the detail graph for one minute of flow.  
function showDetailOneMinute(dataArray, results, samplePos){  
	if (chartDetail != null){
		// clear a chart if one is already in view
		chartDetail.destroy();
	}
	
	detailSampleSelected = samplePos;
	
// determine which flow sample to start and end the graph with
	let startPtr = samplePos - (DETAIL_SAMPLES_SHOW / 2);
	let endPtr = samplePos + (DETAIL_SAMPLES_SHOW / 2);
	if (startPtr < 0){
		startPtr = 0;
		endPtr = DETAIL_SAMPLES_SHOW;
	}else if(endPtr > (dataArray.length -1)){
		startPtr = dataArray.length - DETAIL_SAMPLES_SHOW - 1;
		endPtr = dataArray.length -1;
	}
	
	// obtain the flow data
	let flowData = dataArray.slice(startPtr, endPtr);
	let idealData = results.idealArray.slice(startPtr, endPtr);
	
// prepare the chart for display
	const ctx = document.getElementById('chartDetail');
      
	chartDetail = new Chart(ctx, {
		    type: 'line',
		    data: {
		    	datasets: [{
		            label: 'Flow Rate (l/min)',
			        data: flowData,
			        pointStyle: false,
			        borderColor: '#1b1e7a',
			        borderWidth: 2,
		    	},{
		            label: 'Idealized',
			        data: idealData,
			        pointStyle: false,
			        borderColor: '#f21e0f',
			        borderWidth: 1,
		    	}],
		    },
		    options: {
    	      maintainAspectRatio: false,
		      scales: {
		        y: {
		            min: -40,
		            max: 40,
		        },
		        x: {
		        	type: 'timeseries',
		        	ticks: {
		        		callback: dateTickFormat,
		        	},
		        }
		        
		      },		    
		    },
		  });
// active the scroll buttons	
	document.getElementById('backBtn').style.visibility = "visible";
	document.getElementById('fwdBtn').style.visibility = "visible";
}

function clearDetailGraph(){
	// clear the detail graph
	if (chartDetail != null){
		chartDetail.destroy();
	}
	// hide the back and forward buttons
	document.getElementById('backBtn').style.visibility = "hidden";
	document.getElementById('fwdBtn').style.visibility = "hidden";
}

const DETAIL_SAMPLES_MOVE = 1125;

function showDetailBack(){
// show the data about 45 seconds before that currently selected 
	if (chartDetail == null){
		console.log("No detail being displayed. Cannot move back.")
		return;
	}	
	
	let refreshSampleSelected = detailSampleSelected - DETAIL_SAMPLES_MOVE;
	if (refreshSampleSelected < 0){
		refreshSampleSelected = 0;
	}
	
	showDetailOneMinute(dataArray, results, refreshSampleSelected);
}

function showDetailForward(){
	// show the data about 45 seconds after that currently selected
	if (chartDetail == null){
		console.log("No detail being displayed. Cannot move forward.")
		return;
	}

	let refreshSampleSelected = detailSampleSelected + DETAIL_SAMPLES_MOVE;
	if (refreshSampleSelected > dataArray.length - (DETAIL_SAMPLES_SHOW/2) ){
		refreshSampleSelected = dataArray.length - (DETAIL_SAMPLES_SHOW/2);
	}
	
	showDetailOneMinute(dataArray, results, refreshSampleSelected);
}


function downloadJSON(jsObj, fileName){
	
	var fileToSave = new Blob([JSON.stringify(jsObj, undefined, 2)], {
	    type: 'application/json'
	});
	
	saveAs(fileToSave, fileName);
}

// Take the input EDF data and form the data for further processing and display 
function formDataArray(fileData){
	dataArray = [];
	startDateTime = new Date(fileData.startDateTime.getTime());
    for (const nextSignal of fileData.signals) {
		if (!nextSignal.label.includes("Flow")){
			continue;				
		}
		let nextSampleDateTime = fileData.startDateTime;
		for (const nextValue of nextSignal.physicalValues){
			 
			 dataArray.push({x:formatChartDate(nextSampleDateTime), y: nextValue * 1});
			 
			 nextSampleDateTime = new Date(nextSampleDateTime.getTime() + nextSignal.sampleIntervalmS);
		 }
	}
    return dataArray;
}

//Called by the chart library for each "tick" on the chart. This will only return one in every 12 ticks
// to avoid the chart becoming overcrowded.
function dateTickFormat(value, index, ticks){
	
	if (index % 12 !== 0){
		return "";
	}
	let tickDate = new Date(value);
	return twoCharLeadingZero(tickDate.getHours()) + ":" + twoCharLeadingZero(tickDate.getMinutes())
			 + ":" + twoCharLeadingZero(tickDate.getSeconds());
}

function twoCharLeadingZero(inVal){
	if (typeof inVal !== 'string' || !inVal instanceof String){
		inVal = inVal + "";
	}
	if (inVal.length < 2){
		return "0" + inVal;
	}else{
		return inVal;
	}
}

function threeCharLeadingZero(inVal){
	if (typeof inVal !== 'string' || !inVal instanceof String){
		inVal = inVal + "";
	}
	for(let cnt = inVal.length; cnt < 3; cnt++){
		inVal = "0" + inVal;
	}
	return inVal;
}

function formatChartDate(inDate){
	return 	inDate.getFullYear() + "-" +
			twoCharLeadingZero( (inDate.getMonth() + 1) ) + "-" +
			twoCharLeadingZero( inDate.getDate() ) + " " +
			twoCharLeadingZero( inDate.getHours() ) + ":" +
			twoCharLeadingZero( inDate.getMinutes() ) + ":" + 
			twoCharLeadingZero( inDate.getSeconds() ) + "." +
			threeCharLeadingZero( inDate.getMilliseconds() );	
}