// -------------------------------------------------------------------------
// utility

function isClient()
{
	try
	{
		window
	}
	catch( err )
	{
		return false;
	}

	return true;
}

function clamp(x, a, b)
{
	return Math.min(Math.max(x, a), b);
}

function randRange(a, b)
{
	return Math.random() * (b - a) + a;
}

function randInt(a, b)
{
	return parseInt(Math.random() * (b - a + 1) + a);
}

function simpleSquash(x, a)
{
	return (a + 2) * (x - 0.5) / (1 + a * Math.abs(x - 0.5));
}

function simpleNormalizedSquash(x, a)
{
	return simpleSquash(x, a) * 0.5 + 0.5;
}

function simpleSigmoid(x)
{
	return x / (1.0 + Math.abs(x));
}

function lerpColor(a, b, t)
{
	return d3.rgb(
		a.r * (1.0 - t) + b.r * t,
		a.g * (1.0 - t) + b.g * t,
		a.b * (1.0 - t) + b.b * t);
}

function seedSquareArray(arr, numOfSeeds, seedValueFunc)
{
	for( var seedIndex = 0; seedIndex < numOfSeeds; seedIndex += 1 )
	{
		var i = randInt(0, arr.length - 1),
			j = randInt(0, arr[0].length - 1);
		arr[i][j] = seedValueFunc(i, j);
	}
}

function cartesianToPolar(vec)
{
	return [
		Math.atan2(vec[1], vec[0]),
		Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1])
	];
}

function polarToCartesian(rd)
{
	return [
		Math.cos(rd[1]) * rd[0],
		Math.sin(rd[1]) * rd[0]
	];
}

function rotateVec(vec, ang)
{
	return [
		vec[0] * Math.cos(ang) + vec[1] * -Math.sin(ang),
		vec[0] * Math.sin(ang) + vec[1] * Math.cos(ang)
	];
}

var animats = (function()
{
	// -------------------------------------------------------------------------
	// NodeJS Requirements

	var fs = isClient() ? null : require('fs');
	var d3 = isClient() ? window.d3 : require('d3');
	var $ = isClient() ? window.$ : require('jquery');

	var terrain = isClient() ? { generateTerrain: window.generateTerrain } : require('./terrain.js');

	// -------------------------------------------------------------------------
	// Application Data

	var app = {};
	var exports = {};

	app.tick = 0;
	app.tickf = 0.0;
	app.generations = 0;
	app.numOfGenerationsBeforeSave = 20
	app.dynamicEnvironment = true;
	app.evaluationMode = false;
	app.calamitySeverityIncrement = 0.05;
	app.calamityInterval = 400;
	app.calamityApproachRate = 0.01;
	app.randomizeTerrainOnGeneration = true;
	
	var logHistory = new Array(10);
	function log(message)
	{
		message = message.toString();
		console.log(message);
		logHistory.pop();
		logHistory.unshift(message);
	}
	exports.log = log;
	exports.logHistory = logHistory;

	// -------------------------------------------------------------------------
	// Color Scales

	var rainbowColorScale = d3.scale.linear()
		.domain([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
		.range([
			d3.hsl(360*0.0, 1.0, 0.5),
			d3.hsl(360*0.2, 1.0, 0.5),
			d3.hsl(360*0.4, 1.0, 0.5),
			d3.hsl(360*0.6, 1.0, 0.5),
			d3.hsl(360*0.8, 1.0, 0.5),
			d3.hsl(360*1.0, 1.0, 1.0)
		]);
	var greenRedColorScale = d3.scale.linear()
		.domain([0.0, 1.0])
		.range(['#00FF00', '#FF0000']);
	var redGreenColorScale = d3.scale.linear()
		.domain([0.0, 1.0])
		.range(['#FF0000', '#00FF00']);

	var terrainColorScale = d3.scale.linear()
		.domain([0.0, 0.12, 0.5, 0.8, 1.0])
		.range(['#E5D4C2', '#E5D4C2', '#AD8557', '#785440', '#F1F1EE']);
	var waterColor = d3.rgb('#5278B6');
	var moistureColorScale = d3.scale.linear()
		.domain([0.0, 1.0])
		.range(['#E5C089', '#5278B6']);
	var temperatureColorScale = d3.scale.linear()
		.domain([0.0, 0.2, 0.4, 0.6, 0.8, 1.0])
		.range([
			d3.hsl(360*1.0, 1.0, 1.0),
			d3.hsl(360*0.8, 1.0, 0.5),
			d3.hsl(360*0.6, 1.0, 0.5),
			d3.hsl(360*0.4, 1.0, 0.5),
			d3.hsl(360*0.2, 1.0, 0.5),
			d3.hsl(360*0.0, 1.0, 0.5)
		]);
	var vegetationColorScale = d3.scale.linear()
		.domain([0.0, 1.0])
		.range(['#8BC89E', '#6B9A86']);
	var animatDensityColorScale = d3.scale.linear()
		.domain([0.0, 0.5, 1.0, 5.0, 11.0, 20.0])
		.range([
			d3.hsl(360*0.0, 1.0, 0.5),
			d3.hsl(360*0.2, 1.0, 0.5),
			d3.hsl(360*0.4, 1.0, 0.5),
			d3.hsl(360*0.6, 1.0, 0.5),
			d3.hsl(360*0.8, 1.0, 0.5),
			d3.hsl(360*1.0, 1.0, 1.0)
		]);
	var animatEnergyColorScale = d3.scale.linear()
		.domain([0.0, 20.0, 40.0, 60.0, 100.0])
		.range(['#DC7772', '#FACB7B', '#FFDD55', '#B3FF80', '#1763E0']);
	var avoidanceColorScale = d3.scale.linear()
		.domain([-0.000030, 0.0, 0.000085])
		.range(['#FF0000', '#FFFF80', '#00FF00']);

	// ---- settings

	settings = {};

	settings.visualize = false;

	// environment display mode
	settings.ED_NORMAL = 0,
	settings.ED_TEMPERATURE_ONLY = 1,
	settings.ED_MOISTURE_ONLY = 2,
	settings.ED_VEGETATION_ONLY = 3;
	settings.ED_ANIMAT_DENSITY_ONLY = 4;
	settings.numOfEnvironmentDisplayModes = 5;
	settings.tileDisplayMode = settings.ED_NORMAL;

	// animat display mode
	settings.AD_NORMAL = 0,
	settings.AD_SWIMMING_ONLY = 1,
	settings.AD_EATING_ONLY = 2,
	settings.AD_STOMACH_ONLY = 3,
	settings.AD_MOVING_ONLY = 4;
	settings.AD_VULNERABILITY_ONLY = 5;
	settings.AD_DISTFROMHIST_ONLY = 6;
	settings.AD_AVOIDANCE_ONLY = 7;
	settings.numOfAnimatDisplayModes = 8;
	settings.animatDisplayMode = settings.AD_NORMAL;

	exports.settings = settings;

	// -------------------------------------------------------------------------
	// Environment
	// Holds everything related to the environment, including terrain,
	// representative tiles, and other environment factors such as water level,
	// temperature, and calamity status.

	// ---- constructor

	function Environment(numOfTiles, tileSize, terrainSmoothness)
	{
		this.numOfTiles = numOfTiles;
		this.tileSize = parseFloat(tileSize);
		this.size = this.numOfTiles * this.tileSize;

		this.terrain = new Terrain(numOfTiles, tileSize, terrainSmoothness);

		this.altitudeToTemperatureScale = d3.scale.linear()
			.domain([0.0, 1.0])
			.range([0.8, 0.05]);
		this.globalTemperature = 0.0;
		this.temperature = new Terrain(numOfTiles, tileSize, 1.0, function(value, arr, x, y) { arr[x][y] = 0.25; });

		this.tempertureToMoistureLossScale = d3.scale.linear()
			.domain([0.0, 0.8, 1.0])
			.range([0.2, 1.0, 30.0])
		this.altitudeToMoisureLossScale = d3.scale.linear()
			.domain([0.0, 0.2, 0.45, 0.7, 0.9, 1.0])
			.range([2.0, 1.0, 0.8, 1.0, 1.7, 2.0]);
		this.waterLevel = 0.2;
		this.moisture = new Terrain(numOfTiles, tileSize, 1.0, function(value, arr, x, y) { arr[x][y] = 0.25; });

		this.temperatureToVegetationFactor = d3.scale.linear()
			.domain([0.0, 0.2, 0.3, 0.4, 0.5, 0.8, 1.0])
			.range([-2.0, -0.3, 0.7, 1.0, 0.7, -0.3, -2.0]);
		this.vegetationGrowthModifier = 0.0;
		this.vegetation = new Terrain(numOfTiles, tileSize, 1.0, function(value, arr, x, y) { arr[x][y] = 0.0; });
		seedSquareArray(this.vegetation.values, parseInt(Math.pow(numOfTiles*0.2, 2.0)), function(x, y) { return 1.0; });

		this.animatDensity = new Terrain(numOfTiles, tileSize, 1.0, function(value, arr, x, y) { arr[x][y] = 0.0; });

		this.tiles = Tile.init(this.terrain);
	}

	// ---- methods
	
	Environment.prototype.iterateTiles = function(func)
	{
		for( var i = 0; i < this.tiles.length; i += 1 )
		{
			func(this.tiles, i, this.tiles[i]);
		}
	}

	Environment.prototype.update = function()
	{
		this.updateMoisture();
		this.updateTemperature();
		this.updateVegetation();
		if( settings.visualize )
		{
			this.updateTiles();
		}
	}

	Environment.prototype.updateMoisture = function()
	{
		var env = this;

		this.moisture.iterateVertices(function(value, arr, x, y)
		{
			var height = env.terrain.values[x][y];
			if( height < env.waterLevel )
			{
				// Submerged means full moisture!
				arr[x][y] = 1.0;
			}
			else
			{
				// Evaporation effects.
				var temperature = env.temperature.values[x][y];
				value += -value * env.tempertureToMoistureLossScale(temperature) * env.altitudeToMoisureLossScale(height) * 0.03;

				// Vegetation uses up moisture as a resource.
				var vegetation = env.vegetation.values[x][y];
				value += -vegetation * 0.03;

				arr[x][y] = value;
			}
		});

		this.moisture.iterateNeighbors(function(value1, value2, arr, x1, y1, x2, y2, dist)
		{
			var h1 = env.terrain.values[x1][y1],
				h2 = env.terrain.values[x2][y2];
			var h = (h1 + h2) / 2.0;
			var slope = (h2 - h1) / dist;
			value1 += (value2 - value1) / dist * (1.0 - slope * 2.0) / 8.0 * 1.5 * (1.0 - h * 0.5);
			arr[x1][y1] = clamp(value1, 0.0, 1.0);
		});
	}

	Environment.prototype.updateTemperature = function()
	{
		var env = this;

		this.temperature.iterateNeighbors(function(value1, value2, arr, x1, y1, x2, y2, dist)
		{
			// Temperature diffusion (not a realistic model).
			value1 += (value2 - value1) / dist / 8.0 * 0.25;
			arr[x1][y1] = clamp(value1, 0.0, 1.0);
		});

		this.temperature.iterateVertices(function(value, arr, x, y)
		{
			var height = env.terrain.values[x][y];
			var targetTemperature = env.globalTemperature;
			if( height < env.waterLevel )
			{
				// Water acts as a heat sink, modulating temperature.
				targetTemperature += 0.25;
				value += (targetTemperature - value) * 0.02;
			}
			else
			{
				// Temperature is affected by altitude with a simple try-to-be-this-
				// temperature-at-this-altitude model.
				targetTemperature += env.altitudeToTemperatureScale(height);
				value += (targetTemperature - value) * 0.01;
			}
			arr[x][y] = clamp(value, 0.0, 1.0);
		});
	}

	Environment.prototype.updateVegetation = function()
	{
		var env = this;

		this.vegetation.iterateNeighbors(function(value1, value2, arr, x1, y1, x2, y2, dist)
		{
			// Spread based on temperature and moisture.
			var temperature = env.temperature.values[x1][y1];
			var moisture = env.moisture.values[x1][y1];
			value1 += (value2 - value1 * 0.8) / dist * 0.40 / (value1 * 2.0 + 1.0) * Math.random() * env.temperatureToVegetationFactor(temperature) * moisture;
			arr[x1][y1] = clamp(value1, 0.0, 1.0);
		});

		this.vegetation.iterateVertices(function(value, arr, x, y)
		{
			// Being under water kills off the vegetation based on the depth it is submerged.
			value += -clamp(env.waterLevel - env.terrain.values[x][y], 0.0, 1.0) * 2.0;

			// Vegetation die off due to lack of moisture.
			var moisture = env.moisture.values[x][y];
			value = clamp(value - (1.0 - moisture) * 0.01, 0.0, 1.0);

			// Controllable modifier.
			value = clamp(value + env.vegetationGrowthModifier, 0.0, 1.0);

			// Ensure there's a bit of vegetation near water always or else the vegetation can die out.
			var height = env.terrain.values[x][y];
			if( height - env.waterLevel > 0.0 && height - env.waterLevel < 0.05 )
			{
				value = clamp(value, 0.3, 1.0);
			}
			
			arr[x][y] = value;
		});
	}
	
	Environment.prototype.updateAnimatDensity = function()
	{
		this.animatDensity.iterateNeighbors(function(value1, value2, arr, x1, y1, x2, y2, dist)
		{
			// Temperature diffusion (not a realistic model).
			value1 += (value2 - value1) / dist / 8.0 * 0.05;
			arr[x1][y1] = value1;
		});

		this.animatDensity.iterateVertices(function(value, arr, x, y)
		{
			arr[x][y] *= 0.95;
		});
	}

	Environment.prototype.updateTiles = function()
	{
		var env = this;
		this.iterateTiles(function(tiles, i, tile) { tile.update(env); });
	}

	Environment.prototype.render = function(tilesRoot)
	{
		Tile.updateRepresentations(tilesRoot, this.tiles);
	}

	// The x and y coordinates here represent page coordinates where positive x
	// goes to the right and positive y goes down.
	Environment.prototype.getValue = function(x, y, terrain)
	{
		// Convert page coordinates to tile coordinates.
		x = x / this.tileSize;
		y = y / this.tileSize;

		return this[terrain].getValue(x, y);
	}

	Environment.prototype.addValue = function(x, y, a, terrain)
	{
		// Convert page coordinates to tile coordinates.
		x = x / this.tileSize;
		y = y / this.tileSize;

		return this[terrain].addValue(x, y, a);
	}

	Environment.prototype.getGradient = function(x, y, terrain)
	{
		// Convert page coordinates to tile coordinates.
		x = x / this.tileSize;
		y = y / this.tileSize;
		var step = 1.1;
		
		var ret = this[terrain].getGradient(x, y, step);
		return [ret[0] / this.tileSize, ret[1] / this.tileSize];
	}

	// ---- statics

	// -------------------------------------------------------------------------
	// Terrain
	// The terrain is represented by a two-dimensional array of vertex heights.
	// The class also includes convenience functions to calculate value given
	// a page coordinate and to calculate a gradient at a page coordinate.

	// ---- constructor

	function Terrain(numOfSegments, segmentLength, smoothness, postProcessFunc)
	{
		this.numOfSegments = numOfSegments;
		this.numOfVertices = this.numOfSegments + 1;
		this.sizeInSegments = this.numOfSegments * this.numOfSegments;
		this.sizeInVertices = this.numOfVertices * this.numOfVertices;

		this.segmentLength = segmentLength;

		if( smoothness === undefined )
		{
			smoothness = 1.0;
		}

		// The `heights` array is index as [row][column] where row results in
		// increasing y-coordinate value (down the page) and column results in
		// increasing x-coordinate value (to the right across the page).
		// Usually I have it as [x][y] but my recently experience with matrix
		// calculations and NumPy have me thinking in [row][column].
		this.values = terrain.generateTerrain(this.numOfSegments, this.numOfSegments, smoothness);
		this.normalizeValues();

		if( postProcessFunc !== undefined )
		{
			this.iterateVertices(postProcessFunc);
		}
	}

	// ---- methods
	
	// Convenience function to iterate across all vertices.
	Terrain.prototype.iterateVertices = function(func)
	{
		for( var i = 0; i < this.numOfVertices; i += 1 )
		{
			for( var j = 0; j < this.numOfVertices; j += 1 )
			{
				func(this.values[i][j], this.values, i, j);
			}
		}
	}
	
	Terrain.prototype.iterateNeighbors = function(func)
	{
		for( var i = 0; i < this.numOfVertices - 1; i += 1 )
		{
			for( var j = 0; j < this.numOfVertices - 1; j += 1 )
			{
				func(this.values[i  ][j  ], this.values[i+1][j  ], this.values, i  , j  , i+1, j  , 1.0);
				func(this.values[i  ][j  ], this.values[i+1][j+1], this.values, i  , j  , i+1, j+1, 1.4142135623730951);
				func(this.values[i  ][j  ], this.values[i  ][j+1], this.values, i  , j  , i  , j+1, 1.0);
				func(this.values[i+1][j  ], this.values[i  ][j+1], this.values, i+1, j  , i  , j+1, 1.4142135623730951);

				func(this.values[i+1][j  ], this.values[i  ][j  ], this.values, i+1, j  , i  , j  , 1.0);
				func(this.values[i+1][j+1], this.values[i  ][j  ], this.values, i+1, j+1, i  , j  , 1.4142135623730951);
				func(this.values[i  ][j+1], this.values[i  ][j  ], this.values, i  , j+1, i  , j  , 1.0);
				func(this.values[i  ][j+1], this.values[i+1][j  ], this.values, i  , j+1, i+1, j  , 1.4142135623730951);
			}
		}
	}

	// Ensure that the heights are normalized (with values between 0 and 1)
	// since I can't find any material on what the bounds are on heights generated
	// by the terrain generator.
	Terrain.prototype.normalizeValues = function()
	{
		// Figure out what the range of heights is.
		var minValue = Number.POSITIVE_INFINITY, maxValue = Number.NEGATIVE_INFINITY;
		this.iterateVertices(function(value)
		{
			minValue = Math.min(minValue, value);
			maxValue = Math.max(maxValue, value);
		});

		// Transform the heights to a domain of [0, 1]
		this.iterateVertices(function(value, arr, i, j)
		{
			arr[i][j] = (arr[i][j] - minValue) / (maxValue - minValue);
		});
	}

	// The x and y coordinates here represent tile coordinates where positive x
	// goes to the right and positive y goes down but the domain is
	// [0, numOfVertices].
	Terrain.prototype.getValue = function(x, y)
	{
		// I'll just do bilinear interpolation for now, but I'd like to get
		// bicubic interpolation working.
		// TODO: http://www.strauss-acoustics.ch/js-bilinear-interpolation.html

		// Clamp coordinates to prevent indexing errors.
		x = Math.max(Math.min(x, this.numOfVertices - 1), 0);
		y = Math.max(Math.min(y, this.numOfVertices - 1), 0);

		// Calculate values for bilinear interpolation.
		var l = Math.floor(x), // left
			r = Math.ceil(x),  // right
			t = Math.floor(y), // top
			b = Math.ceil(y);  // bottom
		var tlh = this.values[t][l], // top-left
			trh = this.values[t][r], // top-right
			blh = this.values[b][l], // bottom-left
			brh = this.values[b][r]; // bottom-right
		var tx = x - l, // x parameter [0, 1]
			ty = y - t; // y parameter [0, 1]
		
		// Return bilinearly interpolated value.
		return tlh * (1 - tx) * (1 - ty) + trh * tx * (1 - ty) + blh * (1 - tx) * ty + brh * tx * ty;
	}

	Terrain.prototype.addValue = function(x, y, a)
	{
		// I'll just do bilinear interpolation for now, but I'd like to get
		// bicubic interpolation working.
		// TODO: http://www.strauss-acoustics.ch/js-bilinear-interpolation.html

		// Clamp coordinates to prevent indexing errors.
		x = Math.max(Math.min(x, this.numOfVertices - 1), 0);
		y = Math.max(Math.min(y, this.numOfVertices - 1), 0);

		// Calculate values for bilinear interpolation.
		var l = Math.floor(x), // left
			r = Math.ceil(x),  // right
			t = Math.floor(y), // top
			b = Math.ceil(y);  // bottom
		var tx = x - l, // x parameter [0, 1]
			ty = y - t; // y parameter [0, 1]
		
		this.values[t][l] += a * (1 - tx) * (1 - ty);
		this.values[t][r] += a * tx * (1 - ty);
		this.values[b][l] += a * (1 - tx) * ty;
		this.values[b][r] += a * tx * ty;
	}
	
	Terrain.prototype.getGradient = function(x, y, step)
	{
		var lh = this.getValue(x - step, y),
			rh = this.getValue(x + step, y),
			th = this.getValue(x, y - step),
			bh = this.getValue(x, y + step);
		step = step * 2.0;
		return [(rh - lh) / step, (bh - th) / step];
	}

	// ---- statics

	// -------------------------------------------------------------------------
	// Tile
	// Tiles are used to represent the terrain, vegetation, water, etc. Their
	// actual on screen representation is simply a rectangle that is colored
	// according to what is there.

	// ---- constructor

	function Tile(row, col, x, y, size, height)
	{
		this.row = row;
		this.col = col,
		this.x = x;
		this.y = y;
		this.size = size;
		this.height = height; // height won't change so let's cache the value
		this.color = d3.rgb(255, 255, 255);
	}

	// ---- methods

	Tile.prototype.update = function(environment)
	{
		switch( settings.tileDisplayMode )
		{
		case settings.ED_NORMAL:
			if( this.height < environment.waterLevel )
			{
				this.color = waterColor;
			}
			else
			{
				var t = clamp((this.height - environment.waterLevel) / 0.025, 0.0, 1.0);
				var terrainColor = d3.rgb(terrainColorScale(this.height));
				var vegetationColor = d3.rgb(vegetationColorScale(this.height));
				var vegetationValue = environment.vegetation.values[this.row][this.col];
				this.color = lerpColor(waterColor, lerpColor(terrainColor, vegetationColor, vegetationValue), t);
			}
			break;

		case settings.ED_TEMPERATURE_ONLY:
			var temperature = environment.temperature.values[this.row][this.col];
			var temperatureColor = d3.rgb(temperatureColorScale(temperature))
			this.color = temperatureColor;
			break;

		case settings.ED_MOISTURE_ONLY:
			var moisture = environment.moisture.values[this.row][this.col];
			var moistureColor = d3.rgb(moistureColorScale(moisture))
			this.color = moistureColor;
			break;

		case settings.ED_VEGETATION_ONLY:
			var vegetation = environment.vegetation.values[this.row][this.col];
			var vegetationColor = d3.rgb(vegetationColorScale(this.height));
			this.color = lerpColor(d3.rgb(0, 0, 0), vegetationColor, vegetation);
			break;

		case settings.ED_ANIMAT_DENSITY_ONLY:
			var animatDensity = environment.animatDensity.values[this.row][this.col] / (app.populationSize * 0.05);
			var animatDensityColor = d3.rgb(animatDensityColorScale(animatDensity));
			this.color = lerpColor(d3.rgb(0, 0, 0), animatDensityColor, Math.sqrt(animatDensity));
			break;

		default:
			break;
		}
	}

	// ---- statics

	// Initialize tiles which are used to display terrain height, water
	// height, vegetation, etc.
	Tile.init = function(terrain)
	{
		var tiles = new Array(terrain.numOfVertices * terrain.numOfVertices);

		terrain.iterateVertices(function(value, arr, i, j)
		{
			tiles[i * terrain.numOfVertices + j] = new Tile(
				i, j,
				j * terrain.segmentLength, i * terrain.segmentLength,
				terrain.segmentLength,
				arr[i][j]);
		});

		return tiles;
	}

	Tile.updateRepresentations = function(root, tiles)
	{
		var tilesSelection = root.selectAll('.tile').data(tiles);

		tilesSelection.enter().append('rect')
			.classed('tile', true);

		tilesSelection 
			.attr('x', function(d) { return d.x - d.size * 0.5; })
			.attr('y', function(d) { return d.y - d.size * 0.5; })
			.attr('width', function(d) { return d.size; })
			.attr('height', function(d) { return d.size; })
			.style('fill', function(d) { return d.color.toString(); })
		;
	}

	// -------------------------------------------------------------------------
	// Neuron

	// ---- constructor

	function Neuron(index, sign, threshold, domainScale, stochasticity)
	{
		this.index = index;
		this.sign = sign;
		this.threshold = threshold;
		this.domainScale = domainScale;
		this.stochasticity = stochasticity;
		this.connections = [];
	}

	// ---- methods

	Neuron.prototype.connect = function(neuron, strength)
	{
		return this.connections.push({
			neuron: neuron,
			strength: strength,
		});
	}

	Neuron.prototype.processInput = function()
	{
		this.totalInput = 0.0;
		for( var i = 0; i < this.connections.length; i += 1 )
		{
			var connection = this.connections[i];
			this.totalInput += connection.neuron.output * simpleNormalizedSquash(connection.strength, 6.0);
		}
	}

	Neuron.prototype.setInput = function(value)
	{
		this.totalInput = value;
	}
	
	Neuron.prototype.fire = function()
	{
		if( simpleSigmoid(this.totalInput * this.domainScale) >= this.threshold )
		{
			this.output = this.sign * ((1.0 - this.stochasticity) + Math.random() * this.stochasticity);
		}
		else
		{
			this.output = 0.0;
		}
	}

	// I don't have to worry about neuronal consistency because the neurons are
	// all the same by construction. This isn't ideal.
	Neuron.prototype.toGene = function()
	{
		var gene = [this.threshold, this.domainScale, this.stochasticity];
		for( var i = 0; i < this.connections.length; i += 1 )
		{
			gene.push(this.connections[i].strength);
		}
		return gene;
	}

	Neuron.prototype.fromGene = function(gene)
	{
		this.threshold = gene[0];
		this.domainScale = gene[1];
		this.stochasticity = gene[2];
		for( var i = 0; i < this.connections.length; i += 1 )
		{
			this.connections[i].strength = gene[3 + i];
		}
	}

	// ---- statics

	Neuron.mixGenes = function(geneA, geneB, crossOverRate, mutationRate)
	{
		var gene = [];
		var operator = randInt(0, 2);
		var crossOverChance = 0.0;
		for( var i = 0; i < geneA.length; i += 1 )
		{
			var bitA = geneA[i],
				bitB = geneB[i],
				bit = null;

			crossOverChance += crossOverRate;
			if( Math.random() < crossOverChance )
			{
				operator = randInt(0, 2);
				crossOverChance = 0.0;
			}
			switch( operator )
			{
			case 0: // use A
				bit = bitA;
				break;

			case 1: // use b
				bit = bitB;
				break;

			default: // mix
				var t = randRange(0.3, 0.7);
				bit = bitA * (1.0 - t) + bitB * t;
				break;
			}

			if( Math.random() < mutationRate )
			{
				bit = bit * randRange(0.5, 1.5);
			}

			gene.push(bit);
		}

		return gene;
	}

	Neuron.mutateGene = function(gene)
	{
		var gene = new Array(gene.length);
		gene[0] = randRange(0.2, 1.0);
		gene[1] = randRange(0.1, 2.0);
		gene[2] = randRange(0.0, 1.0);
		for( var i = 3; i < gene.length; i += 1 )
		{
			gene[i] = randRange(0.0, 1.0);
		}
		return gene;
	}

	// -------------------------------------------------------------------------
	// Brain

	// ---- constructor

	function Brain()
	{
		this.inputNeurons = [];
		this.nonInputNeurons = [];
	}

	// ---- methods

	Brain.prototype.addInputNeuron = function(neuron)
	{
		return this.inputNeurons.push(neuron);
	}

	Brain.prototype.addNonInputNeuron = function(neuron)
	{
		return this.nonInputNeurons.push(neuron);
	}

	Brain.prototype.step = function()
	{
		// Only non-input neurons process their inputs because input neurons have
		// their input set by the animat's sensors
		for( var i = 0; i < this.nonInputNeurons.length; i += 1 )
		{
			this.nonInputNeurons[i].processInput();
		}

		// All neurons fire.
		for( var i = 0; i < this.inputNeurons.length; i += 1 )
		{
			this.inputNeurons[i].fire();
		}
		for( var i = 0; i < this.nonInputNeurons.length; i += 1 )
		{
			this.nonInputNeurons[i].fire();
		}
	}

	// Right now I cheat because I have a set topology so this genome-making
	// process ensures the neurons represent the same thing in the same order
	// simply via consistent construction.
	Brain.prototype.toGenome = function()
	{
		var genome = [];
		for( var i = 0; i < this.inputNeurons.length; i += 1 )
		{
			genome.push(this.inputNeurons[i].toGene());
		}
		for( var i = 0; i < this.nonInputNeurons.length; i += 1 )
		{
			genome.push(this.nonInputNeurons[i].toGene());
		}
		return genome;
	}

	Brain.prototype.fromGenome = function(genome)
	{
		for( var i = 0; i < this.inputNeurons.length; i += 1 )
		{
			this.inputNeurons[i].fromGene(genome[i]);
		}
		for( var i = 0; i < this.nonInputNeurons.length; i += 1 )
		{
			this.nonInputNeurons[i].fromGene(genome[i + this.inputNeurons.length]);
		}
	}

	// ---- statics

	Brain.mixGenomes = function(genomeA, genomeB, crossOverRate, mutationRate, geneCrossOverRate, geneMutationRate)
	{
		var genome = [];
		var operator = randInt(0, 2);
		var crossOverChance = 0.0;
		for( var i = 0; i < genomeA.length; i++ )
		{
			var geneA = genomeA[i],
				geneB = genomeB[i],
				gene = null;

			crossOverChance += crossOverRate;
			if( Math.random() < crossOverChance )
			{
				operator = randInt(0, 2);
				crossOverChance = 0.0;
			}
			switch( operator )
			{
			case 0: // use A
				gene = geneA.slice(0);
				break;

			case 1: // use b
				gene = geneB.slice(0);
				break;

			default: // mix
				gene = Neuron.mixGenes(geneA, geneB, geneCrossOverRate, geneMutationRate);
				break;
			}

			if( Math.random() < mutationRate )
			{
				gene = Neuron.mutateGene(gene);
			}

			genome.push(gene);
		}

		return genome;
	}

	Brain.markI = function()
	{
		var neuronIndex = -1;
		function createStandardNeuron(sign)
		{
			//sign, threshold, domainScale, stochasticity
			neuronIndex += 1;
			return new Neuron(neuronIndex, sign, randRange(0.2, 1.0), randRange(0.1, 2.0), randRange(0.0, 1.0));
		}
			
		var brain = new Brain();
		brain.version = 'markI';

		// Create input neurons.
		var inputNeurons = [];

		// Sensors
		inputNeurons.push(brain.leftSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.temperature = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.moisture = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.vegetation = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardVegetationGradient = createStandardNeuron(1.0));

		// Internal state
		inputNeurons.push(brain.swimming = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLow = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyHigh = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLevel = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyChange = createStandardNeuron(1.0));
		inputNeurons.push(brain.stomach = createStandardNeuron(1.0));
		inputNeurons.push(brain.avoidance = createStandardNeuron(1.0));
		
		// Create output neurons.
		var outputNeurons = [];
		outputNeurons.push(brain.leanLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.leanRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.walkForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.runForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.eat = createStandardNeuron(1.0));

		// Create hidden neurons.
		var hiddenNeurons = [];
		var numOfHiddenExcitatoryNeurons = 10;
		var numOfHiddenInhibitoryNeurons = 10;
		for( var i = 0; i < numOfHiddenExcitatoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(1.0));
		}
		for( var i = 0; i < numOfHiddenInhibitoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(-1.0));
		}
		
		// Add neurons to all list and brain.
		var allNeurons = [];
		for( var i = 0; i < inputNeurons.length; i += 1 )
		{
			allNeurons.push(inputNeurons[i]);
			brain.addInputNeuron(inputNeurons[i]);
		}
		for( var i = 0; i < outputNeurons.length; i += 1 )
		{
			allNeurons.push(outputNeurons[i]);
			brain.addNonInputNeuron(outputNeurons[i]);
		}
		for( var i = 0; i < hiddenNeurons.length; i += 1 )
		{
			allNeurons.push(hiddenNeurons[i]);
			brain.addNonInputNeuron(hiddenNeurons[i]);
		}

		// Connect neurons together. Input neurons do not connect with other
		// neurons. All other neurons connect with every other neuron.
		for( var i = 0; i < brain.nonInputNeurons.length; i += 1 )
		{
			var nonInputNeuron = brain.nonInputNeurons[i];
			nonInputNeuron.output = Math.random(); // random seed, not sure how important this is
			for( var j = 0; j < allNeurons.length; j += 1 )
			{
				var otherNeuron = allNeurons[j];
				if( nonInputNeuron != otherNeuron )
				{
					nonInputNeuron.connect(otherNeuron, Math.random() * 1.0);
				}
			}
		}

		return brain;
	}

	Brain.markII = function()
	{
		var neuronIndex = -1;
		function createStandardNeuron(sign)
		{
			//sign, threshold, domainScale, stochasticity
			neuronIndex += 1;
			return new Neuron(neuronIndex, sign, randRange(0.2, 1.0), randRange(0.1, 2.0), randRange(0.0, 1.0));
		}
			
		var brain = new Brain();
		brain.version = 'markII';

		// Create input neurons.
		var inputNeurons = [];

		// Sensors
		inputNeurons.push(brain.altitude = createStandardNeuron(1.0));
		inputNeurons.push(brain.farAltitude = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.temperature = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.moisture = createStandardNeuron(1.0));
		inputNeurons.push(brain.farWater = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.vegetation = createStandardNeuron(1.0));
		inputNeurons.push(brain.farVegetation = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.animatDensity = createStandardNeuron(1.0));
		inputNeurons.push(brain.farAnimatDensity = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardAnimatDensityGradient = createStandardNeuron(1.0));

		// Internal state
		inputNeurons.push(brain.swimming = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLow = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyHigh = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLevel = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyChange = createStandardNeuron(1.0));
		inputNeurons.push(brain.stomach = createStandardNeuron(1.0));
		inputNeurons.push(brain.avoidance = createStandardNeuron(1.0));
		
		// Create output neurons.
		var outputNeurons = [];
		outputNeurons.push(brain.leanLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.leanRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.walkForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.runForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.eat = createStandardNeuron(1.0));

		// Create hidden neurons.
		var hiddenNeurons = [];
		var numOfHiddenExcitatoryNeurons = 14;
		var numOfHiddenInhibitoryNeurons = 15;
		for( var i = 0; i < numOfHiddenExcitatoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(1.0));
		}
		for( var i = 0; i < numOfHiddenInhibitoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(-1.0));
		}
		
		// Add neurons to all list and brain.
		var allNeurons = [];
		for( var i = 0; i < inputNeurons.length; i += 1 )
		{
			allNeurons.push(inputNeurons[i]);
			brain.addInputNeuron(inputNeurons[i]);
		}
		for( var i = 0; i < outputNeurons.length; i += 1 )
		{
			allNeurons.push(outputNeurons[i]);
			brain.addNonInputNeuron(outputNeurons[i]);
		}
		for( var i = 0; i < hiddenNeurons.length; i += 1 )
		{
			allNeurons.push(hiddenNeurons[i]);
			brain.addNonInputNeuron(hiddenNeurons[i]);
		}

		// Connect neurons together. Input neurons do not connect with other
		// neurons. All other neurons connect with every other neuron.
		for( var i = 0; i < brain.nonInputNeurons.length; i += 1 )
		{
			var nonInputNeuron = brain.nonInputNeurons[i];
			nonInputNeuron.output = Math.random(); // random seed, not sure how important this is
			for( var j = 0; j < allNeurons.length; j += 1 )
			{
				var otherNeuron = allNeurons[j];
				if( nonInputNeuron != otherNeuron )
				{
					nonInputNeuron.connect(otherNeuron, Math.random() * 1.0);
				}
			}
		}

		return brain;
	}

	Brain.markIIb = function()
	{
		var neuronIndex = -1;
		function createStandardNeuron(sign)
		{
			//sign, threshold, domainScale, stochasticity
			neuronIndex += 1;
			return new Neuron(neuronIndex, sign, randRange(0.2, 1.0), randRange(0.1, 2.0), randRange(0.0, 1.0));
		}
			
		var brain = new Brain();
		brain.version = 'markIIb';

		// Create input neurons.
		var inputNeurons = [];

		// Sensors
		inputNeurons.push(brain.altitude = createStandardNeuron(1.0));
		inputNeurons.push(brain.farAltitude = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardSlope = createStandardNeuron(1.0));
		inputNeurons.push(brain.temperature = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardTemperatureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.moisture = createStandardNeuron(1.0));
		inputNeurons.push(brain.farWater = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardMoistureGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.vegetation = createStandardNeuron(1.0));
		inputNeurons.push(brain.farVegetation = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardVegetationGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.animatDensity = createStandardNeuron(1.0));
		inputNeurons.push(brain.farAnimatDensity = createStandardNeuron(1.0));
		inputNeurons.push(brain.leftAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.rightAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.forwardAnimatDensityGradient = createStandardNeuron(1.0));
		inputNeurons.push(brain.backwardAnimatDensityGradient = createStandardNeuron(1.0));

		// Internal state
		inputNeurons.push(brain.swimming = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLow = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyHigh = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyLevel = createStandardNeuron(1.0));
		inputNeurons.push(brain.energyChange = createStandardNeuron(1.0));
		inputNeurons.push(brain.stomach = createStandardNeuron(1.0));
		inputNeurons.push(brain.avoidance = createStandardNeuron(1.0));
		
		// Create output neurons.
		var outputNeurons = [];
		outputNeurons.push(brain.leanLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnLeft = createStandardNeuron(1.0));
		outputNeurons.push(brain.leanRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.turnRight = createStandardNeuron(1.0));
		outputNeurons.push(brain.walkForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.runForward = createStandardNeuron(1.0));
		outputNeurons.push(brain.eat = createStandardNeuron(1.0));

		// Create hidden neurons.
		var hiddenNeurons = [];
		var numOfHiddenExcitatoryNeurons = 0;
		var numOfHiddenInhibitoryNeurons = 0;
		for( var i = 0; i < numOfHiddenExcitatoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(1.0));
		}
		for( var i = 0; i < numOfHiddenInhibitoryNeurons; i += 1 )
		{
			hiddenNeurons.push(createStandardNeuron(-1.0));
		}
		
		// Add neurons to all list and brain.
		var allNeurons = [];
		for( var i = 0; i < inputNeurons.length; i += 1 )
		{
			allNeurons.push(inputNeurons[i]);
			brain.addInputNeuron(inputNeurons[i]);
		}
		for( var i = 0; i < outputNeurons.length; i += 1 )
		{
			allNeurons.push(outputNeurons[i]);
			brain.addNonInputNeuron(outputNeurons[i]);
		}
		for( var i = 0; i < hiddenNeurons.length; i += 1 )
		{
			allNeurons.push(hiddenNeurons[i]);
			brain.addNonInputNeuron(hiddenNeurons[i]);
		}

		// Connect neurons together. Input neurons do not connect with other
		// neurons. All other neurons connect with every other neuron.
		for( var i = 0; i < brain.nonInputNeurons.length; i += 1 )
		{
			var nonInputNeuron = brain.nonInputNeurons[i];
			nonInputNeuron.output = Math.random(); // random seed, not sure how important this is
			for( var j = 0; j < allNeurons.length; j += 1 )
			{
				var otherNeuron = allNeurons[j];
				if( nonInputNeuron != otherNeuron )
				{
					nonInputNeuron.connect(otherNeuron, Math.random() * 1.0);
				}
			}
		}

		return brain;
	}

	// -------------------------------------------------------------------------
	// Animat

	// ---- constructor

	function Animat(index, brainFunc)
	{
		this.index = index;

		this.reset();

		if( brainFunc === undefined )
		{
			brainFunc = app.defaultBrain;
		}
		this.brain = brainFunc();
	}

	// ---- methods

	Animat.prototype.reset = function()
	{
		this.ticks = 0;

		//this.dir = randRange(0.0, Math.PI * 2.0);
		//this.x = randRange(0.0, app.environment.size);
		//this.y = randRange(0.0, app.environment.size);
		this.dir = randRange(-0.1, 0.1);
		this.x = app.environment.size * (0.5 + randRange(-0.02, 0.02));
		this.y = app.environment.size * (0.5 + randRange(-0.02, 0.02));

		this.xHistory = this.x;
		this.yHistory = this.y;

		this.energy = 100.0;
		this.stomach = 1.0;
		this.vulnerability = 0.0;
	}

	Animat.prototype.update = function()
	{
		this.ticks += 1;

		// Gather local environmental information.
		this.farDist = app.environment.tileSize * 4.0 // maybe later make this an output neuron?
		this.farX = this.x + Math.cos(this.dir) * this.farDist;
		this.farY = this.y + Math.sin(this.dir) * this.farDist;

		this.altitude = app.environment.getValue(this.x, this.y, 'terrain');
		this.farAltitude = app.environment.getValue(this.farX, this.farY, 'terrain');
		this.swimming = this.altitude < app.environment.waterLevel;
		this.farWater = this.farAltitude < app.environment.waterLevel;
		this.slope = rotateVec(app.environment.getGradient(this.x, this.y, 'terrain'), -this.dir);

		this.temperature = app.environment.getValue(this.x, this.y, 'temperature');
		this.temperatureGradient = rotateVec(app.environment.getGradient(this.x, this.y, 'temperature'), -this.dir);

		this.moisture = app.environment.getValue(this.x, this.y, 'moisture');
		this.moistureGradient = rotateVec(app.environment.getGradient(this.x, this.y, 'moisture'), -this.dir);

		this.vegetation = app.environment.getValue(this.x, this.y, 'vegetation');
		this.farVegetation = app.environment.getValue(this.farX, this.farY, 'vegetation');
		this.vegetationGradient = rotateVec(app.environment.getGradient(this.x, this.y, 'vegetation'), -this.dir);

		this.animatDensity = clamp(app.environment.getValue(this.x, this.y, 'animatDensity') - 0.6, 0.0, app.populationSize);
		this.farAnimatDensity = clamp(app.environment.getValue(this.farX, this.farY, 'animatDensity') - 0.6, 0.0, app.populationSize);
		this.animatDensityGradient = rotateVec(app.environment.getGradient(this.x, this.y, 'animatDensity'), -this.dir);

		// Update sensors in the brain. Zero direction in this coordinate system is
		// at positive X. This means left is -Y, right is +Y, forward is +X, and
		// backward is -X.
		this.brain.leftSlope.setInput(-this.slope[1] * 1000.0);
		this.brain.rightSlope.setInput(this.slope[1] * 1000.0);
		this.brain.forwardSlope.setInput(this.slope[0] * 1000.0);
		this.brain.backwardSlope.setInput(-this.slope[0] * 1000.0);
		this.brain.temperature.setInput(this.temperature);
		this.brain.leftTemperatureGradient.setInput(-this.temperatureGradient[1] * 1000.0);
		this.brain.rightTemperatureGradient.setInput(this.temperatureGradient[1] * 1000.0);
		this.brain.forwardTemperatureGradient.setInput(this.temperatureGradient[0] * 1000.0);
		this.brain.backwardTemperatureGradient.setInput(-this.temperatureGradient[0] * 1000.0);
		this.brain.moisture.setInput(this.moisture);
		this.brain.leftMoistureGradient.setInput(-this.moistureGradient[1] * 1000.0);
		this.brain.rightMoistureGradient.setInput(this.moistureGradient[1] * 1000.0);
		this.brain.forwardMoistureGradient.setInput(this.moistureGradient[0] * 1000.0);
		this.brain.backwardMoistureGradient.setInput(-this.moistureGradient[0] * 1000.0);
		this.brain.vegetation.setInput(this.vegetation);
		this.brain.leftVegetationGradient.setInput(-this.vegetationGradient[1] * 1000.0);
		this.brain.rightVegetationGradient.setInput(this.vegetationGradient[1] * 1000.0);
		this.brain.forwardVegetationGradient.setInput(this.vegetationGradient[0] * 1000.0);
		this.brain.backwardVegetationGradient.setInput(-this.vegetationGradient[0] * 1000.0);

		if( this.brain.version == 'markII' || this.brain.version == 'markIIb' )
		{
			this.brain.altitude.setInput(this.altitude);
			this.brain.farAltitude.setInput(this.farAltitude);
			this.brain.farWater.setInput(this.farWater ? 1.0 : 0.0);
			this.brain.farVegetation.setInput(this.farVegetation);
			this.brain.farAnimatDensity.setInput(this.farAnimatDensity);

			this.brain.animatDensity.setInput(this.animatDensity);
			this.brain.leftAnimatDensityGradient.setInput(-this.animatDensityGradient[1]);
			this.brain.rightAnimatDensityGradient.setInput(this.animatDensityGradient[1]);
			this.brain.forwardAnimatDensityGradient.setInput(this.animatDensityGradient[0]);
			this.brain.backwardAnimatDensityGradient.setInput(-this.animatDensityGradient[0]);
		}

		// Update animat's internal state in the brain.
		this.brain.swimming.setInput(this.swimming ? 1.0 : 0.0);
		this.brain.energyLow.setInput(clamp((25.0 - this.energy) / 25.0 * 2.0, 0.0, 1.0));
		this.brain.energyHigh.setInput(clamp((this.energy - 75.0) / 25.0 * 2.0, 0.0, 1.0));
		this.brain.energyLevel.setInput(this.energy / 100.0);
		this.brain.stomach.setInput(this.stomach);
		this.brain.avoidance.setInput(this.distanceFromHistory / 10.0);

		// Execute brain behavior.
		this.brain.step();

		// Translate turning control (note the left-handed coordinate system).
		this.turnAmount = 0.0;
		this.turnAmount += this.brain.leanLeft.output * (Math.PI / 10.0 * 0.25);
		this.turnAmount += this.brain.turnLeft.output * (Math.PI / 10.0 * 1.0);
		this.turnAmount += this.brain.leanRight.output * -(Math.PI / 10.0 * 0.25);
		this.turnAmount += this.brain.turnRight.output * -(Math.PI / 10.0 * 1.0);

		// Translate movement control.
		this.moveAmount = 0.0;
		this.moveAmount += this.brain.walkForward.output * 0.3;
		this.moveAmount += this.brain.runForward.output * 1.2;
		this.moveAmount += -this.slope[0] * 100.0;
		this.moveAmount = clamp(this.moveAmount, 0.0, 3.0);

		// Eat
		this.eatAmount = this.brain.eat.output;
		this.eatAmount = clamp(Math.min(this.vegetation, this.eatAmount), 0.0, 1.0);
		this.moveAmount = this.moveAmount * (1.0 - this.eatAmount);

		// Swimming
		if( this.swimming )
		{
			if( this.moveAmount > 0.0 )
			{
				this.moveAmount = 0.3;
			}
			else
			{
				this.moveAmount = 0.0;
			}
			this.eatAmount = 0.0;
		}

		// Energy changes
		{
			var energyChange = 0.0;
			var energyMultiplier = 0.5;

			// Energy loss due to homeostasis.
			energyChange -= 0.45;
			
			// Energy loss due to temperature maintenance. If the local temperature is
			// between a range then no energy is lost maintaining temperature. Outside
			// that band the temperature maintenance scales.
			energyChange -= Math.pow(clamp(Math.abs(this.temperature - 0.43) - 0.08, 0.0, 1.0) / 0.5, 2.0) * 4.0;

			// Energy loss due to turning.
			energyChange -= Math.pow(Math.abs(this.turnAmount / 0.7), 1.5) * 0.25;

			// Energy loss due to movement.
			energyChange -= Math.pow(Math.abs(this.moveAmount / 1.5), 1.5) * 1.0;

			// Energy loss due to swimming.
			if( this.swimming )
			{
				energyChange -= 1.5;
			}

			// Energy loss due to eating.
			if( !this.swimming )
			{
				energyChange -= this.eatAmount * 1.0;
			}

			// Energy gain from digestion.
			if( this.stomach > 0.0 )
			{
				var digestedAmount = Math.min(this.stomach, 0.005);
				this.stomach = clamp(this.stomach - digestedAmount * energyMultiplier, 0.0, 1.0);
				energyChange += digestedAmount * 450.0;
			}

			// Extra energy loss due to starvation.
			if( this.stomach < 0.01 )
			{
				energyChange -= clamp(1.0 - this.stomach / 0.01, 0.0, 1.0) * 0.15;
			}

			// Store for internal state how much energy has changed.
			this.brain.energyLevel.setInput(this.energy / 100.0);

			this.energy = clamp(this.energy + energyChange * energyMultiplier, 0.0, 120.0);
		}

		// Execute animat motor control.
		this.dir += this.turnAmount;
		this.x += Math.cos(this.dir) * this.moveAmount;
		this.y += Math.sin(this.dir) * this.moveAmount;

		// Keep the animat inside the environment.
		this.x = Math.min(Math.max(this.x, 0), app.environment.size);
		this.y = Math.min(Math.max(this.y, 0), app.environment.size);

		// Maintain history
		var historyPreference = 0.9
		this.xHistory = this.xHistory * historyPreference + this.x * (1.0 - historyPreference);
		this.yHistory = this.yHistory * historyPreference + this.y * (1.0 - historyPreference);

		// Eat.
		if( !this.swimming )
		{
			app.environment.addValue(this.x, this.y, this.eatAmount * -0.5, 'vegetation');
			this.stomach = clamp(this.stomach + this.eatAmount * 0.1, 0.0, 1.0);
		}

		// Update vulnerability.
		this.distanceFromHistory = Math.sqrt((this.x - this.xHistory) * (this.x - this.xHistory) + (this.y - this.yHistory) * (this.y - this.yHistory));
		this.avoidance = -0.00006 + this.distanceFromHistory * 0.00005 + clamp(this.animatDensity, 0.0, 3.0) * 0.000015;
		this.vulnerability = clamp(this.vulnerability - this.avoidance, 0.0, 0.03);
		if( Math.random() < this.vulnerability && !this.swimming )
		{
			this.energy -= 80.0;
			this.vulnerability *= 0.5;
		}
	}

	// ---- statics

	// -------------------------------------------------------------------------
	// Population
	// Represents a population of animats and handles updating the animats,
	// killing them, populating them, handling generational changes, and
	// rendering them.

	// ---- constructor

	function Population()
	{
		this.animatCounter = 0;
		this.aliveAnimats = [];
		this.deadAnimats = []
	}

	// ---- methods

	Population.prototype.add = function(animat)
	{
		this.aliveAnimats.push(animat);
	}

	Population.prototype.populateRandom = function(numOfAnimats)
	{
		for( var i = 0; i < numOfAnimats; i+= 1 )
		{
			this.add(new Animat(this.animatCounter));
			this.animatCounter += 1;
		}
	}

	Population.prototype.update = function()
	{
		app.environment.updateAnimatDensity();
		for( var i = 0; i < this.aliveAnimats.length; i += 1 )
		{
			app.environment.addValue(this.aliveAnimats[i].x, this.aliveAnimats[i].y, 0.15, 'animatDensity');
		}

		for( var i = 0; i < this.aliveAnimats.length; i += 1 )
		{
			var animat = this.aliveAnimats[i];

			animat.update();

			if( animat.energy <= 0.0 )
			{
				if( !app.evaluationMode )
				{
					log('Animat #'+animat.index+' died at tick '+app.tick+', '+(this.aliveAnimats.length-1)+' remaining');
				}

				this.aliveAnimats.splice(i, 1);
				this.deadAnimats.push(animat);
				i -= 1;
			}
		}
	}

	Population.prototype.render = function(root)
	{
		var representations = root.selectAll('.animat').data(this.aliveAnimats);

		representations.enter().append('path')
			.classed('animat', true)
			.attr('d', 'M 4 0 L -4 3 L -4 -3 L 4 0');
		representations.exit().remove();

		representations
			.attr('transform', function(d) { return 'matrix('+Math.cos(d.dir)+' '+Math.sin(d.dir)+' '+(-Math.sin(d.dir))+' '+Math.cos(d.dir)+' '+d.x+' '+d.y+')'; });

		switch( settings.animatDisplayMode )
		{
		case settings.AD_NORMAL:
			representations.style('fill', function(d) { return animatEnergyColorScale(d.energy); });
			break;
		case settings.AD_SWIMMING_ONLY:
			representations.style('fill', function(d) { return d.swimming ? '#0000ff' : '#ffff00'; });
			break;
		case settings.AD_EATING_ONLY:
			representations.style('fill', function(d) { return redGreenColorScale(d.eatAmount / 0.2); });
			break;
		case settings.AD_STOMACH_ONLY:
			representations.style('fill', function(d) { return redGreenColorScale(d.stomach); });
			break;
		case settings.AD_MOVING_ONLY:
			representations.style('fill', function(d) { return redGreenColorScale(d.moveAmount / 1.5); });
			break;
		case settings.AD_VULNERABILITY_ONLY:
			representations.style('fill', function(d) { return greenRedColorScale(d.vulnerability / 0.01); });
			break;
		case settings.AD_DISTFROMHIST_ONLY:
			representations.style('fill', function(d) { return redGreenColorScale(d.distanceFromHistory / 10.0); });
			break;
		case settings.AD_AVOIDANCE_ONLY:
			representations.style('fill', function(d) { return avoidanceColorScale(d.avoidance); });
			break;
		}
	}

	// ---- statics

	// -------------------------------------------------------------------------
	// interface methods

	exports.init = function(size, numOfTiles, populationSize, settings)
	{
		if( settings === undefined )
		{
			settings = {};
		}

		app.size = size;
		app.numOfTiles = numOfTiles;
		app.populationSize = populationSize;
		
		if( settings.numOfGenerationsBeforeSave !== undefined )
		{
			log('Number of generations before save: ' + settings.numOfGenerationsBeforeSave);
			app.numOfGenerationsBeforeSave = settings.numOfGenerationsBeforeSave;
		}

		if( settings.dynamicEnvironment !== undefined )
		{
			app.dynamicEnvironment = settings.dynamicEnvironment;
			log('Dynamic environment: ' + app.dynamicEnvironment);
		}

		if( settings.randomizeTerrainOnGeneration !== undefined )
		{
			app.randomizeTerrainOnGeneration = settings.randomizeTerrainOnGeneration;
			log('Randomize terrain on generation: ' + app.randomizeTerrainOnGeneration);
		}

		if( settings.evaluationMode !== undefined )
		{
			app.evaluationMode = settings.evaluationMode;
			log('Evaluation mode: ' + app.evaluationMode);
		}

		app.defaultBrain = Brain.markII;
		if( settings.defaultBrain !== undefined )
		{
			switch( settings.defaultBrain )
			{
			case 'markI':
				app.defaultBrain = Brain.markI;
				log('Using brain "markI".');
				break;
			case 'markII':
				app.defaultBrain = Brain.markII;
				log('Using brain "markII".');
				break;
			case 'markIIb':
				app.defaultBrain = Brain.markIIb;
				log('Using brain "markIIb".');
				break;
			}
		}

		var rootSelection = settings.container;
		if( rootSelection !== undefined )
		{
			var parentSelection = rootSelection.append('div')
				.style('width', size+'px')
				.style('height', size+'px');

			// initialize svg element
			app.svgSelection = parentSelection.append('svg')
				.attr('viewBox', '0 0 '+size+' '+size)
				.classed('fill-parent', true);

			// create background rect
			app.bgRectSelection = app.svgSelection.append('rect')
				.classed('fill-parent', true)
				.classed('invisible-mouse-capture', true);

			// create world origin
			app.worldOrigin = app.svgSelection.append('g');
			app.background = app.worldOrigin.append('g');
			app.foreground = app.worldOrigin.append('g');
		}

		exports.environment = app.environment = new Environment(numOfTiles, parseFloat(size) / parseFloat(numOfTiles), 0.8);

		app.environment.waterLevel = 0.0;
		app.calamity = {
			name: 'Nothing',
			waterLevel: 0.2,
			globalTemperature: 0.0,
			vegetationGrowthModifier: 0.0
		};
		app.calamityCountDown = 400;
		app.calamitySeverity = 0.0;

		exports.population = app.population = new Population();
		app.population.populateRandom(app.populationSize);
	}

	// update function
	var fireX, fireY;
	var oasisX, oasisY;
	exports.update = function()
	{
		app.tick += 1;
		app.tickf += 1.0;
		exports.tick = app.tick;

		if( app.dynamicEnvironment )
		{
			if( app.tick % 120 == 1 )
			{
				fireX = randRange(0.0, app.environment.size);
				fireY = randRange(0.0, app.environment.size);
			}
			app.environment.addValue(fireX, fireY, 10.0, 'temperature');

			if( app.tick % 120 == 1 )
			{
				oasisX = randRange(0.0, app.environment.size);
				oasisY = randRange(0.0, app.environment.size);
			}
			app.environment.addValue(oasisX, oasisY, 1.0, 'vegetation');

			app.calamityCountDown -= 1;
		}
		if( app.calamityCountDown <= 0 )
		{
			var calamityType = randInt(0, 4);
			switch( calamityType )
			{
			case 0: // flood
				app.calamity = {
					name: "Flood",
					waterLevel: clamp(0.2 + app.calamitySeverity * 0.5, 0.0, 1.0),
					globalTemperature: app.calamitySeverity * -0.1,
					vegetationGrowthModifier: 0.0,
				};
				break;
			case 1: // drought
				app.calamity = {
					name: "Drought",
					waterLevel: clamp(0.2 - app.calamitySeverity * 0.3, 0.0, 1.0),
					globalTemperature: app.calamitySeverity * 0.1,
					vegetationGrowthModifier: 0.0,
				};
				break;
			case 2: // heat wave
				app.calamity = {
					name: "Heat Wave",
					waterLevel: clamp(0.2 - app.calamitySeverity * 0.05, 0.0, 1.0),
					globalTemperature: app.calamitySeverity * 1.5,
					vegetationGrowthModifier: 0.0,
				};
				break;
			case 3: // cold snap
				app.calamity = {
					name: "Cold Snap",
					waterLevel: 0.2,
					globalTemperature: app.calamitySeverity * -1.5,
					vegetationGrowthModifier: 0.0,
				};
				break;
			case 4: // famine
				app.calamity = {
					name: "Famine",
					waterLevel: 0.2,
					globalTemperature: 0.0,
					vegetationGrowthModifier: app.calamitySeverity * -0.2,
				};
				break;
			}
			app.calamitySeverity += app.calamitySeverityIncrement;
			app.calamityCountDown = app.calamityInterval;
		}
		exports.calamity = app.calamity;
		exports.calamitySeverity = app.calamitySeverity;
		exports.calamityCountDown = app.calamityCountDown;

		// Environment tends towards calamity levels
		app.environment.waterLevel += (app.calamity.waterLevel - app.environment.waterLevel) * app.calamityApproachRate;
		app.environment.globalTemperature += (app.calamity.globalTemperature - app.environment.globalTemperature) * app.calamityApproachRate;
		app.environment.vegetationGrowthModifier += (app.calamity.vegetationGrowthModifier - app.environment.vegetationGrowthModifier) * app.calamityApproachRate;

		app.environment.update();
		if( settings.visualize )
		{
			app.environment.render(app.background);
		}

		app.population.update();
		if( settings.visualize )
		{
			app.population.render(app.foreground);
		}

		// time limit
		var ticksSinceLastDeath = 0;
		if( app.population.deadAnimats.length > 0 )
		{
			ticksSinceLastDeath = app.tick - app.population.deadAnimats[app.population.deadAnimats.length - 1].ticks;
		}
		exports.ticksSinceLastDeath = ticksSinceLastDeath;

		if( app.tick >= 6000 || ticksSinceLastDeath >= 500 )
		{
			while( app.population.aliveAnimats.length > 0 )
			{
				app.population.deadAnimats.push(app.population.aliveAnimats.pop());
			}
		}

		if( app.population.aliveAnimats.length == 0 )
		{
			var oldTerrain = app.environment.terrain.values;
			delete exports.environment;
			delete app.environment;
			exports.environment = app.environment = new Environment(app.numOfTiles, parseFloat(app.size) / parseFloat(app.numOfTiles), 0.8);
			if( !app.randomizeTerrainOnGeneration )
			{
				app.environment.terrain.values = oldTerrain;
			}

			if( app.evaluationMode )
			{
				var survivalArray = '[';

				while( app.population.deadAnimats.length > 0 )
				{
					var animat = app.population.deadAnimats.pop();
					survivalArray += animat.ticks + ', ';
					app.population.aliveAnimats.push(animat);
				}

				survivalArray += ']';
				log(survivalArray);

				for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
				{
					app.population.aliveAnimats[i].reset();
				}

				app.numOfGenerationsBeforeSave -= 1;
				if( app.numOfGenerationsBeforeSave <= 0 )
				{
					process.exit();
				}
			}
			else
			{
				log('All animats dead, starting new generation...')

				var percentageOfWinners = 0.3;
				var percentageOfLosers = 1.0 - percentageOfWinners;
				var percentageOfReincarnation = 0.3;
				var percentageOfChildren = 0.6;

				// Truncate the ones who die early (the losers), then shuffle and pair consecutive animats for sex
				var winners = app.population.deadAnimats;
				winners.splice(0, parseInt(winners.length * percentageOfLosers));
				winners.reverse();

				var highestTicks = 0;
				for( var i = 0; i < winners.length; i += 1 )
				{
					highestTicks = Math.max(highestTicks, winners[i].ticks);
				}

				// Reincarnate a percentage of the winners
				for( var i = 0; i < parseInt(winners.length * percentageOfReincarnation / percentageOfWinners); i += 1 )
				{
					app.population.aliveAnimats.push(winners[i]);
				}

				// Second segment of population are the children of the winners
				while( app.population.aliveAnimats.length < parseInt(app.populationSize * (percentageOfReincarnation + percentageOfChildren)) )
				{
					// Select with preference to beginning of winner list (best scores)
					var aIndex = winners.length - 1;
					var aAnimat = winners[aIndex];
					for( var i = 0; i < winners.length; i += 1 )
					{
						if( randRange(0, highestTicks * 2) < winners[i].ticks )
						{
							aIndex = i;
							aAnimat = winners[i];
							break;
						}
					}

					// Move the aIndex to the end of the winner list
					winners.push(winners.splice(aIndex, 1)[0]);

					// Select with preference to beginning of winner list (best scores)
					var bIndex = winners.length - 2;
					var bAnimat = winners[bIndex];
					for( var i = 0; i < winners.length - 1; i += 1 )
					{
						if( randRange(0, highestTicks * 2) < winners[i].ticks )
						{
							bIndex = i;
							bAnimat = winners[i];
							break;
						}
					}

					// Move the bIndex to the end of the winner list
					winners.push(winners.splice(bIndex, 1)[0]);

					// Sexy time
					var aGenome = aAnimat.brain.toGenome();
					var bGenome = bAnimat.brain.toGenome();
					var childGenome = Brain.mixGenomes(aGenome, bGenome, 0.1, 0.01, 0.1, 0.01);

					var child = new Animat(app.population.animatCounter);
					app.population.animatCounter += 1;
					child.brain.fromGenome(childGenome);
					app.population.aliveAnimats.push(child);
				}

				for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
				{
					app.population.aliveAnimats[i].reset();
				}

				// Last segment of population are new random entrants
				while( app.population.aliveAnimats.length < app.populationSize )
				{
					var child = new Animat(app.population.animatCounter);
					app.population.animatCounter += 1;
					app.population.aliveAnimats.push(child);
				}

				log('...done!')
				log('Starting generation #'+(app.generations+1));

				if( fs != null && app.generations % app.numOfGenerationsBeforeSave == 0 )
				{
					outputFileName = (new Date()).toISOString().replace(/:/g, '-').replace(/\..+/g, '')+'-run.json';
					log('Saving generation #'+(app.generations+1)+' to file "'+outputFileName+'"...');
					var outputContents = exports.dump();
					fs.writeFileSync(outputFileName, outputContents, 'utf8', function(err)
						{
							if( err )
							{
								log(err);
							}
							else
							{
								log('...saved!');
							}
						});
					process.exit();
				}
			}

			app.population.deadAnimats.length = 0;

			app.tick = 0;
			app.generations += 1;
			exports.generations = app.generations;

			app.environment.waterLevel = -0.2;
			app.calamity = {
				name: 'Nothing',
				waterLevel: 0.2,
				globalTemperature: 0.0,
				vegetationGrowthModifier: 0.0
			};
			app.calamityCountDown = 400;
			app.calamitySeverity = 0.0;
		}
	}

	// Export animat data.
	var dumpVersion1 = function()
	{
		var animats = [];
		for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
		{
			var animat = app.population.aliveAnimats[i];
			animats.push({index: animat.index, genome: animat.brain.toGenome()});
		}
		for( var i = 0; i < app.population.deadAnimats.length; i += 1 )
		{
			var animat = app.population.deadAnimats[i];
			animats.push({index: animat.index, genome: animat.brain.toGenome()});
		}
		animats.push(app.population.animatCounter);
		return JSON.stringify(animats, null, '\t');
	}
	var dumpVersion2 = function()
	{
		var animats = [];
		for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
		{
			var animat = app.population.aliveAnimats[i];
			animats.push({index: animat.index, genome: animat.brain.toGenome()});
		}
		for( var i = 0; i < app.population.deadAnimats.length; i += 1 )
		{
			var animat = app.population.deadAnimats[i];
			animats.push({index: animat.index, genome: animat.brain.toGenome()});
		}
		var metaInfo = {
			animatCounter: app.population.animatCounter,
			generations: app.generations,
		};
		switch( app.defaultBrain )
		{
		case Brain.markI:
			metaInfo.defaultBrain = 'markI';
			break;
		case Brain.markII:
			metaInfo.defaultBrain = 'markII';
			break;
		case Brian.markIIb:
			metaInfo.defaultBrain = 'markIIb';
			break;
		}
		animats.push(metaInfo);
		return JSON.stringify(animats, null, '\t');
	}

	// Import saved data and apply it to existing animats.
	var suckVersion1 = function(animatData)
	{
		var dataIndex = 0;
		for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
		{
			app.population.aliveAnimats[i].index = animatData[dataIndex].index;
			app.population.aliveAnimats[i].brain.fromGenome(animatData[dataIndex].genome);
			dataIndex += 1;
		}
		for( var i = 0; i < app.population.deadAnimats.length; i += 1 )
		{
			app.population.deadAnimats[i].index = animatData[dataIndex].index;
			app.population.deadAnimats[i].brain.fromGenome(animatData[dataIndex].genome);
			dataIndex += 1;
		}
		app.population.animatCounter = animatData[dataIndex];
		dataIndex += 1;
	}
	var suckVersion2 = function(animatData)
	{
		var dataIndex = 0;
		for( var i = 0; i < app.population.aliveAnimats.length; i += 1 )
		{
			app.population.aliveAnimats[i].index = animatData[dataIndex].index;
			app.population.aliveAnimats[i].brain.fromGenome(animatData[dataIndex].genome);
			dataIndex += 1;
		}
		for( var i = 0; i < app.population.deadAnimats.length; i += 1 )
		{
			app.population.deadAnimats[i].index = animatData[dataIndex].index;
			app.population.deadAnimats[i].brain.fromGenome(animatData[dataIndex].genome);
			dataIndex += 1;
		}
		var metaInfo = animatData[dataIndex];
		dataIndex += 1;
		app.population.animatCounter = metaInfo.animatCounter;
		app.generations = metaInfo.generations;
		if( metaInfo.defaultBrain !== undefined )
		{
			switch( metaInfo.defaultBrain )
			{
			case 'markI':
				app.defaultBrain = Brain.markI;
				log('Using brain "markI".');
				break;
			case 'markII':
				app.defaultBrain = Brain.markII;
				log('Using brain "markII".');
				break;
			case 'markIIb':
				app.defaultBrain = Brain.markIIb;
				log('Using brain "markIIb".');
				break;
			}
		}
	}

	exports.dump = dumpVersion2;
	exports.suck = suckVersion2;

	var dumpTerrain1 = function()
	{
		return JSON.stringify(app.environment.terrain.values, null, '\t');
	}

	var suckTerrain1 = function(terrainData)
	{
		app.environment.terrain.values = terrainData;
	}

	exports.dumpTerrain = dumpTerrain1;
	exports.suckTerrain = suckTerrain1;

	return exports;
})();

if( !isClient() )
{
	module.exports = animats;
}

