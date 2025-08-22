/* 
Copyright 2025 DaveSkvn
This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the
 Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>. 
*/

function parseEDFFile(arrayBuffer){
	
	let fileObject = {};
	fileObject.bytePtr = 0;
	fileObject.array = new Uint8Array(arrayBuffer);
	fileObject.getNextFld = function(byteCount){
		let endByte = this.bytePtr + byteCount;
		outFld = String.fromCharCode(...fileObject.array.slice(this.bytePtr, endByte)).trim();
		this.bytePtr = endByte;
		return outFld;
	};
	fileObject.getNextInt16 = function(){
		let lsb = fileObject.array[this.bytePtr++];
		let msb = fileObject.array[this.bytePtr++];
		
		let sampleValue = ( (msb & 0xFF) << 8) | (lsb & 0xFF); 
		if (msb >>> 7 == 1){  // Is this value negative?
			return 0xFFFF0000 | sampleValue;  // Fill to 32 bit negative (2s-compliment format)
		}else{
			return sampleValue;  // First 16 bits of 32 bit are zero 
		}
	};  
	
	let fileData = parseFileHeader(fileObject);
	fileData = parseSignalHeader(fileObject, fileData);
	fileData = parseSignals(fileObject, fileData);
	return fileData;
}

function parseFileHeader(fileArray){
	let fileData = {};
	fileData.formatVersion = fileArray.getNextFld(8);
 	fileData.patientID = fileArray.getNextFld(80);
	fileData.recID = fileArray.getNextFld(80);
	fileData.startDate = fileArray.getNextFld(8);
	fileData.startTime = fileArray.getNextFld(8);
	fileData.headerBytes = fileArray.getNextFld(8);
	fileData.reserved = fileArray.getNextFld(44);
	fileData.dataRecCnt = fileArray.getNextFld(8);
	fileData.dataDuration = fileArray.getNextFld(8);
	fileData.noSignals = fileArray.getNextFld(4);
	fileData.startDateTime = new Date("20" + fileData.startDate.substring(6,8),
			 fileData.startDate.substring(3,5)-1,
			 fileData.startDate.substring(0,2),
			 fileData.startTime.substring(0,2),
			 fileData.startTime.substring(3,5),
			 fileData.startTime.substring(6,8),
			 0);
	return fileData;
}


function parseSignalHeader(fileArray, fileData){
	let noSignals = fileData.noSignals;
	fileData.signals = [];
    for (let i = 0; i < noSignals; i++) {
    	fileData.signals.push({})
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.label = fileArray.getNextFld(16);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.transType = fileArray.getNextFld(80);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.physDimension = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.physMin = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.physMax = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.digMin = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.digMax = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.preFilter = fileArray.getNextFld(80);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.samplesPerRec = fileArray.getNextFld(8);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.reserved = fileArray.getNextFld(32);
    }
    for (const nextSignal of fileData.signals) {
    	nextSignal.physFactor = nextSignal.physMax / nextSignal.digMax;
    	nextSignal.sampleIntervalmS = (1000 * fileData.dataDuration)  / nextSignal.samplesPerRec;
//    	console.log(fileData.dataDuration + " " + nextSignal.samplesPerRec + " " + nextSignal.sampleIntervalmS);
    }
    return fileData;
}

function parseSignals(fileArray, fileData){
	for(const nextSignal of fileData.signals){
		nextSignal.digitalValues = [];
		nextSignal.physicalValues = [];
	}
	for (let rec = 0; rec < fileData.dataRecCnt; rec++) { //fileData.dataRecCnt
		for(const nextSignal of fileData.signals){
			for (let smpl = 0; smpl < nextSignal.samplesPerRec; smpl++) {
				let nextDigitalVal = fileArray.getNextInt16();
				nextSignal.digitalValues.push(nextDigitalVal);
				if (nextSignal.label.includes("Flow")){
					nextSignal.physicalValues.push( (nextDigitalVal * nextSignal.physFactor * 60).toFixed(2));
				}else if(nextSignal.label.includes("Press")){
					nextSignal.physicalValues.push( (nextDigitalVal * nextSignal.physFactor).toFixed(2));
				}else{
					nextSignal.physicalValues.push( nextDigitalVal);
				}
//				console.log(  (nextDigitalVal * nextSignal.physFactor * 60).toFixed(2)  );
			}
		}
    }
    return fileData;
}
