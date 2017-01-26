// Copyright (C) 2014 Viet Nguyen
//
// This program is temporarily licensed under GNU GPLv2 until the software code
// has been prepared for proper public release. Please see
// http://www.gnu.org/licenses/gpl-2.0.html for the license and more
// information.
//
// Fractal Terrain Generator is licensed by Xueqiau Xu under the MIT License.
// See website (https://github.com/qiao/fractal-terrain-generator) or source
// file (terrain.js) for license.
//
// jQuery is licensed under the MIT License. See website
// (https://jquery.org/license/) for license and information.

var animats = require('./js/animats.js');

var settings = require('./'+process.argv[2]);
console.log('settings:');
console.log(settings);

animats.init(640.0, 32, 400, settings);

if( settings.terrainDataPath !== undefined )
{
	var terrainData = null;
	try
	{
		terrainData = require('./'+settings.terrainDataPath);
	}
	catch( err )
	{
	}
	if( terrainData != null )
	{
		animats.suckTerrain(terrainData);
		console.log('Terrain data loaded from "' + settings.terrainDataPath + '"!');
	}
}

// Load a data file if specified in the arguments.
var animatDataFileName = process.argv[3];
var animatData = null;
if( animatDataFileName  !== undefined )
{
	try
	{
		animatData = require('./'+process.argv[3]);
	}
	catch( err )
	{
	}
}
if( animatData != null )
{
	animats.suck(animatData);
	console.log('Animat data loaded from "' + animatDataFileName + '"!');
}

while( true )
{
	animats.update();
}

